import * as THREE from 'three';
import type { Collider } from './player';
import type { Layout } from './types';
import { bilingual } from '../../shared-client/i18n';
import { BOSSES, COMBAT, WorldCombatState, makeWildernessSpawns, distanceXZ, type Enemy, type Point3 } from './combat';
import './combat.css';
import { makeCombatTerrain } from './combatTerrain';
import { EnemyVisuals, enemyModel, ENEMY_VISUAL_BUDGET, type EnemyModel } from './enemyVisuals';
import { MINIBOSSES, makeMinibossSpawns } from './minibosses';
import { enemyAttackRadius } from './combat';
import { makeValleySentinel } from './valleySentinel';

export interface WorldCombatOptions {
  scene: THREE.Scene; colliders: Collider[]; layout: Layout; done: Set<string>;
  groundHeight?: (x: number, z: number) => number | null;
  toast: (message: string) => void; onVictory: (core: string) => void; onPlayerDefeated: () => void;
}
interface EnemyVisual { root: THREE.Group; body: THREE.Group; fallback: THREE.Group; model: EnemyModel | null; flash: THREE.Mesh; lastMode?: Enemy['mode']; updateCreature?: (time: number, moving: boolean, attacking: boolean) => void; updateLabel?: () => void; sword?: THREE.Mesh; bar: THREE.Group; fill: THREE.Mesh; tell: THREE.Mesh; material: THREE.MeshStandardMaterial }
interface ShotVisual { line: THREE.Line; bolt: THREE.Mesh; flash: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; age: number; duration: number }
interface Spark { mesh: THREE.Mesh; left: number; full: number }
type Line = [string, string];
/** Per-boss names and battle lines (zh, en); attack names follow the boss's sweep / burst. */
const BOSS_TEXT: Record<string, { name: Line; start: Line; reset: Line; phase: Line; victory: Line; burst: Line; sweep: Line; colors: [string, string, string] }> = {
  boss_vacant_king: {
    name: ['空位之王', 'THE VACANT KING'],
    start: ['空位之王苏醒：离开红色预警圈，射击核心！', 'The Vacant King awakens: leave the red tells and fire at its core!'],
    reset: ['战斗重置：回到落日之核可再次挑战', 'Encounter reset: return to the Sun Core to retry.'],
    phase: ['第二阶段 · 余烬暴怒：攻击加速，预警仍可闪避', 'Phase II · Ember Fury: faster attacks, still dodgeable.'],
    victory: ['空位之王已击败 · 获得「落日誓约」纪念徽记', 'Vacant King defeated · Sunset Oath keepsake earned'],
    burst: ['日蚀冲击：离开红圈！', 'Eclipse burst: leave the red circle!'],
    sweep: ['王剑横扫：拉开距离！', 'Royal sweep: move away!'],
    colors: ['#3a3152', '#e57a3f', '#ffbe62'],
  },
  boss_drowned_admiral: {
    name: ['亡航提督', 'THE DROWNED ADMIRAL'],
    start: ['亡航提督从甲板下爬起：离开红色预警圈，射击它胸前的冷灯！', 'The Drowned Admiral rises from below deck: leave the red tells and shoot its cold lamp!'],
    reset: ['战斗重置：回到海之核可再次挑战', 'Encounter reset: return to the Sea Core to retry.'],
    phase: ['第二阶段 · 怒潮：舷炮齐射更快，预警仍可闪避', 'Phase II · Raging Tide: faster broadsides, still dodgeable.'],
    victory: ['亡航提督已击败 · 获得「黑帆」纪念徽记', 'Drowned Admiral defeated · Black Sail keepsake earned'],
    burst: ['舷炮齐射：离开红圈！', 'Broadside: leave the red circle!'],
    sweep: ['锚链横扫：拉开距离！', 'Anchor sweep: move away!'],
    colors: ['#24404a', '#5fe0c0', '#a8fff0'],
  },
  boss_winter_warden: {
    name: ['执冬者', 'THE WINTER WARDEN'],
    start: ['执冬者从红场的冰雾里站起：离开红色预警圈，射击它的冰心！', 'The Winter Warden rises from the frost on Red Square: leave the red tells and shoot its ice heart!'],
    reset: ['战斗重置：回到冬之核可再次挑战', 'Encounter reset: return to the Winter Core to retry.'],
    phase: ['第二阶段 · 暴风雪：攻势更快，预警仍可闪避', 'Phase II · Blizzard: faster attacks, still dodgeable.'],
    victory: ['执冬者已击败 · 获得「最后的鹰」纪念徽记', 'Winter Warden defeated · Last Eagle keepsake earned'],
    burst: ['冰枪坠落：离开红圈！', 'Falling ice lances: leave the red circle!'],
    sweep: ['寒霜横扫：拉开距离！', 'Frost sweep: move away!'],
    colors: ['#3a4a66', '#9fd8ff', '#e8fbff'],
  },
  boss_hellfire_lord: {
    name: ['业火之主', 'THE LORD OF HELLFIRE'],
    start: ['业火之主从本能寺的火海里走出：离开红色预警圈，射击它胸口的火核！', 'The Lord of Hellfire walks out of the blaze at Honnō-ji: leave the red tells and shoot the fire core in its chest!'],
    reset: ['战斗重置：回到京之核可再次挑战', 'Encounter reset: return to the Kyoto Core to retry.'],
    phase: ['第二阶段 · 天魔焚城：攻势更快，预警仍可闪避', 'Phase II · Demon Fire: faster attacks, still dodgeable.'],
    victory: ['业火之主已击败 · 获得「二天」纪念徽记', 'Lord of Hellfire defeated · Two Heavens keepsake earned'],
    burst: ['火雨坠落：离开红圈！', 'Rain of fire: leave the red circle!'],
    sweep: ['烈焰横扫：拉开距离！', 'Flame sweep: move away!'],
    colors: ['#3a1a1a', '#ff6a3d', '#ffd27a'],
  },
};
const bossText = (id: string) => BOSS_TEXT[id] ?? BOSS_TEXT.boss_vacant_king;

/** Bounded renderer/facade around the local simulation. All combat resources are disposed on exit. */
export class WorldCombat {
  readonly state: WorldCombatState;
  private readonly bossDefs: typeof BOSSES;
  readonly geometry;
  private readonly enemyAssets = new EnemyVisuals();
  private readonly visuals = new Map<string, EnemyVisual>();
  private readonly shots: ShotVisual[] = [];
  private readonly sparks: Spark[] = [];
  private readonly shared: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly hud = document.createElement('div');
  private readonly bossHud = document.createElement('div');
  private readonly impact = document.createElement('div');
  private readonly hurt = document.createElement('div');
  private readonly defeat = document.createElement('div');
  private readonly effectGroup = new THREE.Group();
  private readonly boltGeo = new THREE.SphereGeometry(0.075, 6, 4);
  private readonly sparkGeo = new THREE.IcosahedronGeometry(0.16, 0);
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: '#fff2ad', toneMapped: false });
  private readonly lineMat = new THREE.LineBasicMaterial({ color: '#ffd486', transparent: true, opacity: 0.7, toneMapped: false });
  private acc = 0;
  private time = 0;
  private impactFor = 0;
  private hurtFor = 0;
  private allyCooldown = 0;
  private disposed = false;
  private player = { x: 0, y: 0, z: 0 };
  private playable = false;
  private warnedAssetFailure = false;
  constructor(private readonly options: WorldCombatOptions) {
    this.geometry = makeCombatTerrain(options.colliders, options.layout, options.groundHeight);
    // every era boss whose marker is in this world (a single-region layout may hold just one)
    this.bossDefs = BOSSES.filter(b => options.layout.markers.some(m => m.id === b.id));
    const bosses = this.bossDefs.map(b => {
      const marker = options.layout.markers.find(m => m.id === b.id)!;
      return { id: b.id, kind: 'king' as const, p: { x: marker.p[0], y: marker.p[1] + 0.05, z: marker.p[2] }, requires: b.requires, cleared: options.done.has(b.core) };
    });
    const wilderness = makeWildernessSpawns(options.layout.world.seed ^ 537, this.geometry.safeSpawn);
    const minis = makeMinibossSpawns(this.geometry.safeSpawn, wilderness);
    this.state = new WorldCombatState([...minis, ...wilderness], bosses);
    for (const enemy of this.state.enemies) this.visuals.set(enemy.id, this.makeEnemy(enemy));
    options.scene.add(this.effectGroup);
    this.hud.id = 'world-vitals'; this.hud.className = 'combat-hud';
    this.hud.innerHTML = '<span></span><div class="combat-track"><div class="combat-fill"></div></div>';
    this.bossHud.id = 'world-boss'; this.bossHud.className = 'combat-hud'; this.bossHud.hidden = true;
    this.bossHud.innerHTML = '<strong></strong><div class="combat-track"><div class="combat-fill"></div></div><small></small>';
    this.impact.id = 'world-impact'; this.impact.className = 'combat-hud';
    this.hurt.id = 'world-hurt';
    this.defeat.id = 'world-defeat'; this.defeat.className = 'combat-hud'; this.defeat.hidden = true;
    document.body.append(this.hud, this.bossHud, this.impact, this.hurt, this.defeat);
    this.renderHud();
  }
  get visualDiagnostics() { return { ...this.enemyAssets.diagnostics, budget: ENEMY_VISUAL_BUDGET }; }
  get defeated() { return this.state.defeated; }
  get bossStarted() { return this.state.bossStarted; }
  /** Start the boss guarding this core (default: the first era's sun core). */
  beginBoss(core = 'sun_core') {
    const def = this.bossDefs.find(b => b.core === core);
    const began = !!def && this.state.beginBoss(this.options.done, def.id); this.events(); return began;
  }
  reset() {
    this.state.resetAll(this.bossDefs.map(b => this.options.done.has(b.core)));
    this.acc = 0; this.allyCooldown = 0; this.impactFor = 0; this.hurtFor = 0;
    for (const shot of this.shots) this.removeShot(shot);
    this.shots.length = 0;
    for (const spark of this.sparks) spark.mesh.removeFromParent();
    this.sparks.length = 0;
    for (const [id, v] of this.visuals) { this.enemyAssets.release(id); v.lastMode = undefined; v.root.visible = false; v.tell.visible = false; }
    this.impact.textContent = ''; this.hurt.style.opacity = '0';
    document.getElementById('crosshair')?.classList.remove('hit');
    this.renderHud();
  }
  canShoot() { return this.playable && this.state.canShoot(); }
  raycast(origin: Point3, direction: Point3, maxDistance: number) { return this.state.raycast(origin, direction, maxDistance); }
  damageEnemy(id: string, amount: number = COMBAT.shotDamage) { const hit = this.state.hitEnemy(id, amount); this.events(); return hit; }
  /** Read-only anticipation target. Contact revalidates this exact enemy below. */
  allyTarget(position: Point3, range = 3.5, targetId?: string): { id: string; p: Point3 } | null {
    if (!this.playable || this.state.defeated || this.allyCooldown > 0 || distanceXZ(position, this.player) > 25) return null;
    const enemy = this.state.enemies.filter(e => (!targetId || e.id === targetId) && e.active && e.mode !== 'dead' && distanceXZ(e.p, position) < Math.min(5, range) && Math.abs(e.p.y - position.y) < 3)
      .sort((a, b) => distanceXZ(a.p, position) - distanceXZ(b.p, position))[0];
    if (!enemy || !this.geometry.terrain.lineOfSight({ ...position, y: position.y + 1 }, { ...enemy.p, y: enemy.p.y + 1 })) return null;
    return { id: enemy.id, p: { ...enemy.p } };
  }
  /** Servant lock-on: nearest live enemy within `radius` of the player (hit reach is still allyTarget's). */
  allyEngage(radius = 15): { id: string; p: Point3 } | null {
    if (!this.playable || this.state.defeated) return null;
    const enemy = this.state.enemies.filter(e => e.active && e.mode !== 'dead' && distanceXZ(e.p, this.player) < radius && Math.abs(e.p.y - this.player.y) < 6)
      .sort((a, b) => distanceXZ(a.p, this.player) - distanceXZ(b.p, this.player))[0];
    return enemy ? { id: enemy.id, p: { ...enemy.p } } : null;
  }
  /** Animation contact only: range/LOS/liveness/cooldown are checked again after wind-up. */
  allyStrike(position: Point3, range = 3.5, damage = 14, targetId?: string): { id: string; p: Point3 } | null {
    const target = this.allyTarget(position, range, targetId);
    if (!target) return null;
    this.allyCooldown = 1.1;
    this.damageEnemy(target.id, Math.min(18, Math.max(0, damage)));
    this.spark(new THREE.Vector3(target.p.x, target.p.y + 1.3, target.p.z), 0.24);
    return target;
  }
  shot(muzzle: THREE.Vector3, endpoint: THREE.Vector3, didHit: boolean) {
    while (this.shots.length >= 18) this.removeShot(this.shots.shift()!);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, endpoint]), this.lineMat);
    const bolt = new THREE.Mesh(this.boltGeo, this.boltMat);
    const flash = new THREE.Mesh(this.sparkGeo, this.boltMat); flash.position.copy(muzzle); flash.scale.set(0.8, 0.8, 1.8);
    this.effectGroup.add(line, bolt, flash);
    this.shots.push({ line, bolt, flash, from: muzzle.clone(), to: endpoint.clone(), age: 0, duration: Math.max(0.06, muzzle.distanceTo(endpoint) / 320) });
    if (didHit) this.spark(endpoint, 0.22);
  }
  private spark(point: THREE.Vector3, duration: number) {
    if (this.sparks.length >= 20) { const old = this.sparks.shift()!; old.mesh.removeFromParent(); }
    const mesh = new THREE.Mesh(this.sparkGeo, this.boltMat); mesh.position.copy(point);
    this.effectGroup.add(mesh); this.sparks.push({ mesh, left: duration, full: duration });
  }
  update(dt: number, player: Point3, active: boolean, camera?: THREE.Camera) {
    if (this.disposed) return;
    this.player = { ...player }; this.playable = active;
    this.time += active ? dt : 0; this.acc += active ? dt : 0;
    this.enemyAssets.tick(dt);
    this.allyCooldown = Math.max(0, this.allyCooldown - (active ? dt : 0));
    while (this.acc >= 0.05) { this.state.step(0.05, player, active, this.geometry.terrain); this.acc -= 0.05; }
    this.events();
    // Visibility is not combat activation: paused/free-flight scouting must show living encounters.
    const visible = (e: Enemy) => e.mode !== 'dead' && distanceXZ(e.p, player) <= COMBAT.activeRange &&
      (e.kind !== 'king' || this.state.bossStarted && e.id === this.state.boss.id);
    const detailed = new Set(this.state.enemies.filter(e => visible(e) && this.visuals.get(e.id)?.model)
      .sort((a, b) => distanceXZ(a.p, player) - distanceXZ(b.p, player)).slice(0, ENEMY_VISUAL_BUDGET).map(e => e.id));
    for (const e of this.state.enemies) {
      const v = this.visuals.get(e.id)!;
      const distance = distanceXZ(e.p, player);
      v.root.visible = visible(e);
      const skinned = v.model ? this.enemyAssets.update(e, v.model, v.body, v.fallback, active ? dt : 0, distance, v.root.visible && detailed.has(e.id)) : false;
      v.root.position.set(e.p.x, e.p.y, e.p.z);
      if (!v.root.visible) { v.tell.visible = false; v.lastMode = e.mode; continue; }
      if (e.attack === 'shot' && e.mode === 'recover' && v.lastMode === 'windup') {
        const direction = new THREE.Vector3(e.target.x - e.p.x, 0, e.target.z - e.p.z).normalize();
        const muzzle = new THREE.Vector3(e.p.x, e.p.y + 1.2, e.p.z).addScaledVector(direction, 0.55);
        this.shot(muzzle, new THREE.Vector3(e.target.x, e.target.y + 1, e.target.z), false);
      }
      v.lastMode = e.mode;
      v.updateLabel?.();
      const moving = e.mode === 'chase';
      v.updateCreature?.(this.time, moving, e.mode === 'windup');
      v.body.position.y = skinned || v.updateCreature ? 0 : 0.025 * Math.sin(this.time * (moving ? 10 : 3));
      v.body.rotation.z = !skinned && !v.updateCreature && moving ? Math.sin(this.time * 9) * 0.04 : 0;
      const facing = e.attack === 'shot' && (e.mode === 'windup' || e.mode === 'recover') ? e.target : player;
      v.body.rotation.y = Math.atan2(facing.x - e.p.x, facing.z - e.p.z);
      if (v.sword) v.sword.rotation.z = e.mode === 'windup' ? -1.8 : e.mode === 'recover' ? 0.6 : -0.2;
      v.flash.visible = skinned && e.hitTime > 0;
      v.material.emissiveIntensity = e.hitTime > 0 ? 2.5 : e.phase === 2 ? 0.6 : 0.12;
      v.bar.visible = e.hp < e.maxHp || e.mode !== 'idle';
      if (camera) v.bar.quaternion.copy(camera.quaternion);
      const ratio = e.hp / e.maxHp; v.fill.scale.x = ratio; v.fill.position.x = -(1 - ratio) * (e.kind === 'king' ? 1.5 : 0.8) / 2;
      v.tell.visible = e.mode === 'windup';
      if (v.tell.visible) {
        const center = e.attack !== 'sweep' ? e.target : e.p;
        const radius = enemyAttackRadius(e);
        v.tell.position.set(center.x, center.y + 0.13, center.z); v.tell.scale.setScalar(radius);
        (v.tell.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * 18));
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.age += dt;
      s.bolt.position.lerpVectors(s.from, s.to, Math.min(1, s.age / s.duration));
      s.flash.visible = s.age < 0.045; s.line.visible = s.age < 0.075;
      if (s.age > s.duration + 0.035) { this.removeShot(s); this.shots.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.left -= dt; s.mesh.scale.setScalar(0.5 + 3 * (1 - s.left / s.full));
      if (s.left <= 0) { s.mesh.removeFromParent(); this.sparks.splice(i, 1); }
    }
    this.impactFor = Math.max(0, this.impactFor - dt); if (!this.impactFor) this.impact.textContent = '';
    this.hurtFor = Math.max(0, this.hurtFor - dt); this.hurt.style.opacity = `${Math.min(0.7, this.hurtFor * 2)}`;
    if (!this.warnedAssetFailure && this.enemyAssets.diagnostics.exhausted > 0) {
      this.warnedAssetFailure = true;
      this.options.toast(bilingual('精细敌人模型加载失败，暂用简化模型；刷新页面可重试', 'Detailed enemy model failed to load; simplified model shown. Reload to retry.'));
    }
    this.renderHud();
  }
  private events() {
    for (const event of this.state.drainEvents()) {
      if (event.type === 'hit') {
        this.impact.textContent = `−${event.damage}`; this.impactFor = 0.35;
        document.getElementById('crosshair')?.classList.add('hit');
        window.setTimeout(() => document.getElementById('crosshair')?.classList.remove('hit'), 130);
      } else if (event.type === 'hurt') this.hurtFor = 0.4;
      else if (event.type === 'bossStart') this.options.toast(bilingual(...bossText(this.state.boss.id).start));
      else if (event.type === 'bossReset') this.options.toast(bilingual(...bossText(this.state.boss.id).reset));
      else if (event.type === 'phase') this.options.toast(bilingual(...bossText(this.state.boss.id).phase));
      else if (event.type === 'victory') {
        const def = this.bossDefs.find(b => b.id === event.id)!;
        if (event.firstClear) { this.options.done.add(def.reward); this.options.onVictory(def.core); }
        this.options.toast(event.firstClear ? bilingual(...bossText(def.id).victory) : bilingual('再次挑战成功 · 纪念奖励已领取', 'Rematch won · Keepsake already earned'));
      } else if (event.type === 'revive') this.options.onPlayerDefeated();
    }
  }
  private renderHud() {
    this.hud.querySelector('span')!.textContent = `${bilingual('生命', 'HP')} ${Math.ceil(this.state.hp)} / ${COMBAT.playerHp}`;
    (this.hud.querySelector('.combat-fill') as HTMLElement).style.width = `${this.state.hp}%`;
    this.hud.title = bilingual('脱离战斗 5 秒后恢复生命', 'Health recovers after 5 seconds out of combat');
    this.bossHud.hidden = !this.state.bossStarted;
    const text = bossText(this.state.boss.id);
    this.bossHud.querySelector('strong')!.textContent = bilingual(...text.name);
    (this.bossHud.querySelector('.combat-fill') as HTMLElement).style.width = `${100 * this.state.boss.hp / this.state.boss.maxHp}%`;
    const b = this.state.boss;
    this.bossHud.querySelector('small')!.textContent = `${bilingual('阶段', 'Phase')} ${b.phase} · ${Math.ceil(b.hp)} / ${b.maxHp} · ` +
      (b.mode === 'windup' ? b.attack === 'burst' ? bilingual(...text.burst) : bilingual(...text.sweep) : bilingual('射击核心 · 离开战场将重置', 'Fire at the core · Leaving resets the encounter'));
    this.defeat.hidden = !this.state.defeated;
    this.defeat.textContent = bilingual('你倒下了\n即将回到安全地点 · 进度保留', 'You have fallen\nReturning to safety · Progress is kept');
  }
  private makeEnemy(e: Enemy): EnemyVisual {
    const king = e.kind === 'king', crystal = e.kind === 'crystal';
    const root = new THREE.Group(), body = new THREE.Group(), fallback = new THREE.Group(); root.add(body); body.add(fallback); root.name = e.id;
    const model = enemyModel(e);
    const [kBody, kGlow, kLight] = (e.miniboss ? MINIBOSSES.find(m => m.id === e.miniboss)?.colors : undefined) ?? bossText(e.id).colors;
    const material = new THREE.MeshStandardMaterial({ color: king ? kBody : crystal ? '#49859b' : '#52637d', metalness: 0.35, roughness: 0.5, emissive: king ? kGlow : crystal ? '#63e4ed' : '#2f8f83', emissiveIntensity: 0.12 });
    const glow = new THREE.MeshBasicMaterial({ color: king ? kLight : crystal ? '#9dffff' : '#a1ffe7', toneMapped: false });
    if (model) { material.color.set(model === 'musketeer' || model === 'officer' ? '#3b594a' : model === 'samurai' || model === 'ashigaru' ? '#5b3434' : model === 'sunward_guard' ? '#8a8171' : '#62544a'); material.emissive.set('#000000'); }
    this.materials.push(material, glow);
    const flashGeo = new THREE.IcosahedronGeometry(0.6, 1), flashMat = new THREE.MeshBasicMaterial({ color: '#fff0c6', transparent: true, opacity: 0.4, wireframe: true, depthWrite: false });
    this.shared.push(flashGeo); this.materials.push(flashMat);
    const flash = new THREE.Mesh(flashGeo, flashMat); flash.position.y = 1.05; flash.visible = false; body.add(flash);
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], scale?: [number, number, number]) => {
      this.shared.push(g); const o = new THREE.Mesh(g, m); o.position.set(...p); if (scale) o.scale.set(...scale);
      o.castShadow = true; o.receiveShadow = true; fallback.add(o); return o;
    };
    if (model) {
      // Low-cost regional silhouettes also serve as network-failure fallbacks. Never purple blobs.
      mesh(new THREE.BoxGeometry(0.5, 0.68, 0.3), material, [0, 1.13, 0]);
      mesh(new THREE.SphereGeometry(0.19, 6, 4), material, [0, 1.68, 0]);
      for (const side of [-1, 1]) {
        mesh(new THREE.BoxGeometry(0.17, 0.8, 0.21), material, [side * 0.15, 0.4, 0]);
        mesh(new THREE.BoxGeometry(0.14, 0.65, 0.16), material, [side * 0.33, 1.15, 0]);
      }
      if (model === 'ashigaru' || model === 'samurai') mesh(new THREE.ConeGeometry(0.34, 0.2, 8), material, [0, 1.9, 0]);
      if (model === 'musketeer' || model === 'officer') mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.3, 6), material, [0, 1.94, 0]);
      if (model === 'sunward_guard') mesh(new THREE.BoxGeometry(0.45, 0.65, 0.08), material, [-0.4, 1.1, 0.2]);
      const weaponSide = model === 'deck_raider' ? -1 : 1;
      mesh(new THREE.BoxGeometry(0.055, model === 'ashigaru' ? 2.2 : 0.85, 0.055), material, [weaponSide * 0.42, 1.12, 0.15]);
    } else {
      const creature = makeValleySentinel(this.shared, this.materials, !!e.miniboss);
      fallback.add(creature.root);
      fallback.userData.updateCreature = creature.update;
    }
    const updateCreature = fallback.userData.updateCreature as EnemyVisual['updateCreature'];
    // Region-specific champions replace every old procedural purple chapter boss.
    // Scale keeps the authored human champion near the existing king hit sphere/height.
    if (king) {
      body.scale.setScalar(1.8);
      const crown = new THREE.Group(); crown.name = 'Champion_Gold_Crest'; crown.position.y = 2;
      const ringGeo = new THREE.TorusGeometry(.25,.025,4,12); this.shared.push(ringGeo);
      const ring = new THREE.Mesh(ringGeo,glow);ring.rotation.x=Math.PI/2;crown.add(ring);
      for(let i=0;i<5;i++) {
        const toothGeo=new THREE.ConeGeometry(.045,.18,4);this.shared.push(toothGeo);
        const tooth=new THREE.Mesh(toothGeo,glow),a=i/5*Math.PI*2;
        tooth.position.set(Math.cos(a)*.25,.08,Math.sin(a)*.25);crown.add(tooth);
      }
      body.add(crown);
    }
    const sword = undefined;
    const bar = new THREE.Group(); bar.position.y = king ? 4.1 : 2.25; root.add(bar);
    const width = king ? 1.5 : 0.8;
    const barGeo = new THREE.PlaneGeometry(width, 0.09), backMat = new THREE.MeshBasicMaterial({ color: '#171c29', depthTest: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: e.miniboss ? '#ffd36a' : '#ffb26f', depthTest: false });
    this.shared.push(barGeo); this.materials.push(backMat, fillMat);
    const back = new THREE.Mesh(barGeo, backMat), fill = new THREE.Mesh(barGeo, fillMat); fill.position.z = 0.005; bar.add(back, fill);
    const tellGeo = new THREE.CircleGeometry(1, 40), tellMat = new THREE.MeshBasicMaterial({ color: e.miniboss ? '#ffb82f' : '#ff4939', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    this.shared.push(tellGeo); this.materials.push(tellMat);
    const tell = new THREE.Mesh(tellGeo, tellMat); tell.rotation.x = -Math.PI / 2; tell.visible = false;
    this.options.scene.add(root, tell); root.visible = false;
    let updateLabel: (() => void) | undefined;
    if (e.miniboss) {
      const emblemGeo = new THREE.OctahedronGeometry(0.12), emblemMat = new THREE.MeshBasicMaterial({ color: '#ffd36a', toneMapped: false });
      this.shared.push(emblemGeo); this.materials.push(emblemMat);
      const emblem = new THREE.Mesh(emblemGeo, emblemMat); emblem.position.y = 2.55; root.add(emblem);
      const name = MINIBOSSES.find(m => m.id === e.miniboss)?.name;
      root.userData.minibossName = name;
      if (name) {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          let labelText = '';
          updateLabel = () => {
          const next = bilingual(...name); if (next === labelText) return; labelText = next;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 5; ctx.strokeStyle = '#16151c'; ctx.strokeText(bilingual(...name), 256, 32);
          ctx.fillStyle = '#ffdf8b'; ctx.fillText(next, 256, 32);
          texture.needsUpdate = true;
          };
          const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture); updateLabel();
          const labelMat = new THREE.SpriteMaterial({ map: texture, depthWrite: false }); this.materials.push(labelMat);
          const label = new THREE.Sprite(labelMat); label.position.y = 2.9; label.scale.set(3, 0.375, 1); root.add(label);
        }
      }
    }
    return { root, body, fallback, model, flash, updateLabel, updateCreature, sword, bar, fill, tell, material };
  }
  private removeShot(s: ShotVisual) { s.line.removeFromParent(); s.line.geometry.dispose(); s.bolt.removeFromParent(); s.flash.removeFromParent(); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const v of this.visuals.values()) { v.root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); v.root.removeFromParent(); v.tell.removeFromParent(); }
    for (const s of this.shots) this.removeShot(s);
    this.enemyAssets.dispose();
    this.effectGroup.removeFromParent(); this.shared.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.boltGeo.dispose(); this.sparkGeo.dispose(); this.boltMat.dispose(); this.lineMat.dispose();
    for (const el of [this.hud, this.bossHud, this.impact, this.hurt, this.defeat]) el.remove();
  }
}
