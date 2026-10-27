import * as THREE from 'three';
import type { Collider } from './player';
import type { Layout } from './types';
import { bilingual } from '../../shared-client/i18n';
import { BOSSES, COMBAT, WorldCombatState, makeWildernessSpawns, distanceXZ, type Enemy, type Point3 } from './combat';
import './combat.css';
import { makeCombatTerrain } from './combatTerrain';

export interface WorldCombatOptions {
  scene: THREE.Scene; colliders: Collider[]; layout: Layout; done: Set<string>;
  toast: (message: string) => void; onVictory: (core: string) => void; onPlayerDefeated: () => void;
}
interface EnemyVisual { root: THREE.Group; body: THREE.Group; sword?: THREE.Mesh; bar: THREE.Group; fill: THREE.Mesh; tell: THREE.Mesh; material: THREE.MeshStandardMaterial }
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
  private readonly visuals = new Map<string, EnemyVisual>();
  private readonly shots: ShotVisual[] = [];
  private readonly sparks: Spark[] = [];
  private readonly shared: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
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
  constructor(private readonly options: WorldCombatOptions) {
    this.geometry = makeCombatTerrain(options.colliders, options.layout);
    // every era boss whose marker is in this world (a single-region layout may hold just one)
    this.bossDefs = BOSSES.filter(b => options.layout.markers.some(m => m.id === b.id));
    const bosses = this.bossDefs.map(b => {
      const marker = options.layout.markers.find(m => m.id === b.id)!;
      return { id: b.id, kind: 'king' as const, p: { x: marker.p[0], y: marker.p[1] + 0.05, z: marker.p[2] }, requires: b.requires, cleared: options.done.has(b.core) };
    });
    this.state = new WorldCombatState(makeWildernessSpawns(options.layout.world.seed ^ 537, this.geometry.safeSpawn), bosses);
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
    for (const v of this.visuals.values()) { v.root.visible = false; v.tell.visible = false; }
    this.impact.textContent = ''; this.hurt.style.opacity = '0';
    document.getElementById('crosshair')?.classList.remove('hit');
    this.renderHud();
  }
  canShoot() { return this.playable && this.state.canShoot(); }
  raycast(origin: Point3, direction: Point3, maxDistance: number) { return this.state.raycast(origin, direction, maxDistance); }
  damageEnemy(id: string, amount: number = COMBAT.shotDamage) { const hit = this.state.hitEnemy(id, amount); this.events(); return hit; }
  /** Read-only anticipation target. Contact revalidates this exact enemy below. */
  allyTarget(position: Point3, range = 3.5, targetId?: string): { id: string; p: Point3 } | null {
    if (!this.playable || this.state.defeated || this.allyCooldown > 0 || distanceXZ(position, this.player) > 12) return null;
    const enemy = this.state.enemies.filter(e => (!targetId || e.id === targetId) && e.active && e.mode !== 'dead' && e.mode !== 'idle' && distanceXZ(e.p, position) < Math.min(5, range) && Math.abs(e.p.y - position.y) < 3)
      .sort((a, b) => distanceXZ(a.p, position) - distanceXZ(b.p, position))[0];
    if (!enemy || !this.geometry.terrain.lineOfSight({ ...position, y: position.y + 1 }, { ...enemy.p, y: enemy.p.y + 1 })) return null;
    return { id: enemy.id, p: { ...enemy.p } };
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
    this.time += dt; this.acc += active ? dt : 0;
    this.allyCooldown = Math.max(0, this.allyCooldown - (active ? dt : 0));
    while (this.acc >= 0.05) { this.state.step(0.05, player, active, this.geometry.terrain); this.acc -= 0.05; }
    this.events();
    for (const e of this.state.enemies) {
      const v = this.visuals.get(e.id)!;
      v.root.visible = e.active && e.mode !== 'dead';
      v.root.position.set(e.p.x, e.p.y, e.p.z);
      if (!v.root.visible) { v.tell.visible = false; continue; }
      const moving = e.mode === 'chase';
      v.body.position.y = 0.06 * Math.sin(this.time * (moving ? 10 : 3));
      v.body.rotation.z = moving ? Math.sin(this.time * 9) * 0.04 : 0;
      v.body.rotation.y = Math.atan2(player.x - e.p.x, player.z - e.p.z);
      if (v.sword) v.sword.rotation.z = e.mode === 'windup' ? -1.8 : e.mode === 'recover' ? 0.6 : -0.2;
      v.material.emissiveIntensity = e.hitTime > 0 ? 2.5 : e.phase === 2 ? 0.6 : 0.12;
      v.bar.visible = e.hp < e.maxHp || e.mode !== 'idle';
      if (camera) v.bar.quaternion.copy(camera.quaternion);
      const ratio = e.hp / e.maxHp; v.fill.scale.x = ratio; v.fill.position.x = -(1 - ratio) * (e.kind === 'king' ? 1.5 : 0.8) / 2;
      v.tell.visible = e.mode === 'windup';
      if (v.tell.visible) {
        const center = e.attack === 'burst' ? e.target : e.p;
        const radius = e.kind === 'king' ? e.attack === 'burst' ? e.phase === 2 ? 6.2 : 4.8 : 5.5 : 2.4;
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
        const def = this.bossDefs.find(b => b.id === this.state.boss.id)!;
        this.options.done.add(def.reward); this.options.onVictory(def.core);
        this.options.toast(bilingual(...bossText(def.id).victory));
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
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.name = e.id;
    const [kBody, kGlow, kLight] = bossText(e.id).colors;
    const material = new THREE.MeshStandardMaterial({ color: king ? kBody : crystal ? '#49859b' : '#52637d', metalness: 0.35, roughness: 0.5, emissive: king ? kGlow : crystal ? '#63e4ed' : '#ac96fb', emissiveIntensity: 0.12 });
    const glow = new THREE.MeshBasicMaterial({ color: king ? kLight : crystal ? '#9dffff' : '#b9a6ff', toneMapped: false });
    this.materials.push(material, glow);
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], scale?: [number, number, number]) => {
      this.shared.push(g); const o = new THREE.Mesh(g, m); o.position.set(...p); if (scale) o.scale.set(...scale);
      o.castShadow = true; o.receiveShadow = true; body.add(o); return o;
    };
    mesh(new THREE.IcosahedronGeometry(king ? 1.1 : 0.62, 1), material, [0, king ? 1.7 : 1.0, 0], [1, 1.2, 0.65]);
    mesh(new THREE.IcosahedronGeometry(king ? 0.48 : 0.28, 1), material, [0, king ? 3.0 : 1.7, 0]);
    mesh(new THREE.OctahedronGeometry(king ? 0.38 : 0.2), glow, [0, king ? 1.85 : 1.1, king ? 0.66 : 0.4]);
    for (const side of [-1, 1]) {
      mesh(new THREE.ConeGeometry(king ? 0.42 : 0.25, king ? 1.2 : 0.65, 5), material, [side * (king ? 1.0 : 0.58), king ? 1.7 : 0.95, 0]);
      mesh(new THREE.BoxGeometry(king ? 0.4 : 0.22, king ? 0.85 : 0.5, king ? 0.42 : 0.27), material, [side * (king ? 0.46 : 0.24), king ? 0.45 : 0.28, 0]);
    }
    let sword: THREE.Mesh | undefined;
    if (king) {
      mesh(new THREE.CylinderGeometry(0.54, 0.48, 0.24, 7), glow, [0, 3.38, 0]);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; mesh(new THREE.ConeGeometry(0.1, 0.45, 4), glow, [Math.cos(a) * 0.43, 3.62, Math.sin(a) * 0.43]); }
      sword = mesh(new THREE.BoxGeometry(0.2, 2.6, 0.12).translate(0, 0.9, 0), glow, [1.35, 1.2, 0.45]);
    }
    const bar = new THREE.Group(); bar.position.y = king ? 4.1 : 2.25; root.add(bar);
    const width = king ? 1.5 : 0.8;
    const barGeo = new THREE.PlaneGeometry(width, 0.09), backMat = new THREE.MeshBasicMaterial({ color: '#171c29', depthTest: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: '#ffb26f', depthTest: false });
    this.shared.push(barGeo); this.materials.push(backMat, fillMat);
    const back = new THREE.Mesh(barGeo, backMat), fill = new THREE.Mesh(barGeo, fillMat); fill.position.z = 0.005; bar.add(back, fill);
    const tellGeo = new THREE.CircleGeometry(1, 40), tellMat = new THREE.MeshBasicMaterial({ color: '#ff4939', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    this.shared.push(tellGeo); this.materials.push(tellMat);
    const tell = new THREE.Mesh(tellGeo, tellMat); tell.rotation.x = -Math.PI / 2; tell.visible = false;
    this.options.scene.add(root, tell); root.visible = false;
    return { root, body, sword, bar, fill, tell, material };
  }
  private removeShot(s: ShotVisual) { s.line.removeFromParent(); s.line.geometry.dispose(); s.bolt.removeFromParent(); s.flash.removeFromParent(); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const v of this.visuals.values()) { v.root.removeFromParent(); v.tell.removeFromParent(); }
    for (const s of this.shots) this.removeShot(s);
    this.effectGroup.removeFromParent(); this.shared.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    this.boltGeo.dispose(); this.sparkGeo.dispose(); this.boltMat.dispose(); this.lineMat.dispose();
    for (const el of [this.hud, this.bossHud, this.impact, this.hurt, this.defeat]) el.remove();
  }
}
