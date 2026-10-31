import * as THREE from 'three';
import type { Collider } from './player';
import type { Layout } from './types';
import { bilingual } from '../../shared-client/i18n';
import { BOSSES, COMBAT, WorldCombatState, makeWildernessSpawns, distanceXZ, isMeleePunishWindow, type Enemy, type Point3, type HitContext } from './combat';
import './combat.css';
import { makeCombatTerrain } from './combatTerrain';
import { EnemyVisuals, enemyModel, ENEMY_VISUAL_BUDGET, type EnemyModel } from './enemyVisuals';
import { MINIBOSSES, makeMinibossSpawns } from './minibosses';
import { enemyAttackRadius, enemyThrustLength, enemyAttackTiming } from './combat';
import { ENEMY_ROLES } from './enemyRoles';
import { collectStrikeTargets, type StrikeRequest, type StrikeResult } from './combatActions';
import { authorEncounters, KNIGHT_TRIAL_ID, KNIGHT_TRIAL_CLEAR } from './authoredEncounters';
import { getEraBossRequirements, isEraCoreCleared } from './eraStories';
import { makeValleySentinel } from './valleySentinel';
import { VisibleEnemyRoot } from './visibleEnemyRoot';

export interface WorldCombatOptions {
  scene: THREE.Scene; colliders: Collider[]; layout: Layout; done: Set<string>;
  onDamage?: (hit: { id: string; damage: number; source: HitContext['source']; eligible: true }) => void;
  onKill?: (id: string) => void;
  onHurt?: (damage: number) => void;
  groundHeight?: (x: number, z: number) => number | null;
  toast: (message: string) => void; onVictory: (core: string) => void; onPlayerDefeated: () => void;
}
interface EnemyVisual { peaceMarker?: THREE.Group; roleLabel?: THREE.Sprite; applyPacified?: (pacified: boolean) => void; root: THREE.Group; body: THREE.Group; fallback: THREE.Group; model: EnemyModel | null; lastMode?: Enemy['mode']; updateCreature?: (time: number, moving: boolean, attacking: boolean) => void; updateLabel?: () => void; sword?: THREE.Mesh; bar: THREE.Group; fill: THREE.Mesh; tell: THREE.Mesh; material: THREE.MeshStandardMaterial }
interface ShotVisual { line: THREE.Line; bolt: THREE.Mesh; flash: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; age: number; duration: number }
interface Spark { mesh: THREE.Mesh; left: number; full: number }
/** Six tapered, camera-facing spark streaks; 0.28m maximum width, never a body shell. */
function makeImpactStreaks(): THREE.BufferGeometry {
  const vertices: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3, x = Math.cos(angle), y = Math.sin(angle);
    const tip = i % 2 ? 0.105 : 0.14, inner = 0.022, halfWidth = 0.009;
    vertices.push(x * inner - y * halfWidth, y * inner + x * halfWidth, 0,
      x * tip, y * tip, 0, x * inner + y * halfWidth, y * inner - x * halfWidth, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.141);
  return geometry;
}
type Line = [string, string];
/** Per-boss names and battle lines (zh, en); guidance follows actual attack geometry, not a fictional weak point. */
const BOSS_TEXT: Record<string, { name: Line; start: Line; reset: Line; phase: Line; victory: Line; burst: Line; sweep: Line; colors: [string, string, string] }> = {
  boss_vacant_king: {
    name: ['空位之王', 'THE VACANT KING'],
    start: ['空位之王苏醒：看清预警，避招后近身反击！', 'The Vacant King awakens: read the tells, evade, then punish up close!'],
    reset: ['战斗重置：回到落日之核可再次挑战', 'Encounter reset: return to the Sun Core to retry.'],
    phase: ['第二阶段 · 余烬暴怒：攻击加速，预警仍可闪避', 'Phase II · Ember Fury: faster attacks, still dodgeable.'],
    victory: ['空位之王已击败 · 获得「落日誓约」纪念徽记', 'Vacant King defeated · Sunset Oath keepsake earned'],
    burst: ['日蚀冲击：离开红圈！', 'Eclipse burst: leave the red circle!'],
    sweep: ['王剑横扫：拉开距离！', 'Royal sweep: move away!'],
    colors: ['#3a3152', '#e57a3f', '#ffbe62'],
  },
  boss_drowned_admiral: {
    name: ['亡航提督', 'THE DROWNED ADMIRAL'],
    start: ['亡航提督迎战：躲开落点与横斩，装填时近身反击！', 'The Drowned Admiral engages: evade impacts and sweeps; punish the reload up close!'],
    reset: ['战斗重置：回到海之核可再次挑战', 'Encounter reset: return to the Sea Core to retry.'],
    phase: ['第二阶段 · 怒潮：舷炮齐射更快，预警仍可闪避', 'Phase II · Raging Tide: faster broadsides, still dodgeable.'],
    victory: ['亡航提督已击败 · 获得「黑帆」纪念徽记', 'Drowned Admiral defeated · Black Sail keepsake earned'],
    burst: ['舷炮齐射：离开红圈！', 'Broadside: leave the red circle!'],
    sweep: ['甲板横斩：退出近身圆圈！', 'Deck sweep: leave the close-range circle!'],
    colors: ['#24404a', '#5fe0c0', '#a8fff0'],
  },
  boss_winter_warden: {
    name: ['执冬者', 'THE WINTER WARDEN'],
    start: ['执冬者迎战：横移避开直刺，离开冰霜落点，再近身反击！', 'The Winter Warden engages: sidestep thrusts, leave frost impacts, then punish up close!'],
    reset: ['战斗重置：回到冬之核可再次挑战', 'Encounter reset: return to the Winter Core to retry.'],
    phase: ['第二阶段 · 暴风雪：攻势更快，预警仍可闪避', 'Phase II · Blizzard: faster attacks, still dodgeable.'],
    victory: ['执冬者已击败 · 获得「最后的鹰」纪念徽记', 'Winter Warden defeated · Last Eagle keepsake earned'],
    burst: ['冰枪坠落：离开红圈！', 'Falling ice lances: leave the red circle!'],
    sweep: ['寒霜横扫：拉开距离！', 'Frost sweep: move away!'],
    colors: ['#3a4a66', '#9fd8ff', '#e8fbff'],
  },
  boss_hellfire_lord: {
    name: ['业火之主', 'THE LORD OF HELLFIRE'],
    start: ['业火之主迎战：留意连续横斩与直刺，抓住收招破绽！', 'The Lord of Hellfire engages: watch for chained sweeps and thrusts; punish the recovery!'],
    reset: ['战斗重置：回到京之核可再次挑战', 'Encounter reset: return to the Kyoto Core to retry.'],
    phase: ['第二阶段 · 天魔焚城：攻势更快，预警仍可闪避', 'Phase II · Demon Fire: faster attacks, still dodgeable.'],
    victory: ['业火之主已击败 · 获得「二天」纪念徽记', 'Lord of Hellfire defeated · Two Heavens keepsake earned'],
    burst: ['火雨坠落：离开红圈！', 'Rain of fire: leave the red circle!'],
    sweep: ['烈焰横扫：拉开距离！', 'Flame sweep: move away!'],
    colors: ['#3a1a1a', '#ff6a3d', '#ffd27a'],
  },
};
const bossText = (id: string) => BOSS_TEXT[id] ?? BOSS_TEXT.boss_vacant_king;
/** Only nearby HUD text is generated; visual cues reuse each enemy's existing health bar. */
function counterHint(e: Enemy, playable: boolean): string {
  if (!playable) return bilingual('战斗暂停', 'Combat paused');
  if (e.mode === 'dead') return bilingual('已击败', 'Defeated');
  if (e.pacified) return bilingual('已停战', 'Standing down');
  if (!e.active) return bilingual('接近敌人开始交战', 'Move closer to engage');
  if (isMeleePunishWindow(e)) return `${bilingual('破绽 · 近战', 'PUNISH · MELEE')} ×${COMBAT.meleePunish} · ${Math.max(0,e.timer).toFixed(1)}s`;
  if (e.mode === 'stagger') return bilingual('已打断 · 普通伤害', 'INTERRUPTED · Normal damage');
  if (e.mode === 'recover') return bilingual('收招中 · 普通伤害', 'Recovering · Normal damage');
  if (e.mode === 'windup') {
    if (e.attack === 'thrust') return bilingual('锁定直刺：横移离开长条！', 'Locked thrust: sidestep the lane!');
    if (e.attack === 'shot') return bilingual('锁定射击：离开小圈或找掩体！', 'Locked shot: leave the small circle or take cover!');
    if (e.kind === 'king') return bilingual(...bossText(e.id)[e.attack === 'burst' ? 'burst' : 'sweep']);
    return e.attack === 'burst' ? bilingual('落点已锁定：离开红圈！', 'Impact locked: leave the red circle!') : bilingual('近身横扫：退出圆圈！', 'Close sweep: leave the circle!');
  }
  return e.kind === 'king' ? bilingual('看预警 · 躲招后反击 · 离场重置', 'Read tells · Evade, then counter · Leaving resets') : bilingual(...ENEMY_ROLES[e.role].counter);
}


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
  private readonly roleLabels = new Map<string, { material: THREE.SpriteMaterial; update: () => void }>();
  private readonly textures: THREE.Texture[] = [];
  private readonly hud = document.createElement('div');
  private readonly bossHud = document.createElement('div');
  private readonly impact = document.createElement('div');
  private readonly hurt = document.createElement('div');
  private readonly defeat = document.createElement('div');
  private readonly effectGroup = new THREE.Group();
  private readonly effectFacing = new THREE.Quaternion();
  private readonly thrustTellGeo = new THREE.PlaneGeometry(2, 1);
  private readonly boltGeo = new THREE.SphereGeometry(0.075, 6, 4);
  private readonly sparkGeo = makeImpactStreaks();
  private readonly sparkMat = new THREE.MeshBasicMaterial({ color: '#fff0b8', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: '#fff2ad', toneMapped: false });
  private readonly lineMat = new THREE.LineBasicMaterial({ color: '#ffd486', transparent: true, opacity: 0.7, toneMapped: false });
  private acc = 0;
  private time = 0;
  private impactFor = 0;
  private hitMarkerFor = 0;
  private hurtFor = 0;
  private allyCooldown = 0;
  private disposed = false;
  private player = { x: 0, y: 0, z: 0 };
  private playable = false;
  private warnedAssetFailure = false;
  constructor(private readonly options: WorldCombatOptions) {
    this.shared.push(this.thrustTellGeo);
    this.geometry = makeCombatTerrain(options.colliders, options.layout, options.groundHeight);
    // every era boss whose marker is in this world (a single-region layout may hold just one)
    this.bossDefs = BOSSES.filter(b => options.layout.markers.some(m => m.id === b.id));
    const bosses = this.bossDefs.map(b => {
      const marker = options.layout.markers.find(m => m.id === b.id)!;
      return { id: b.id, kind: 'king' as const, p: { x: marker.p[0], y: marker.p[1] + 0.05, z: marker.p[2] }, requires: getEraBossRequirements(b.core, options.done) ?? b.requires, cleared: isEraCoreCleared(b.core, options.done) ?? options.done.has(b.core) };
    });
    const wilderness = authorEncounters(makeWildernessSpawns(options.layout.world.seed ^ 537, this.geometry.safeSpawn), this.geometry.safeSpawn);
    const minis = makeMinibossSpawns(this.geometry.safeSpawn, wilderness);
    this.state = new WorldCombatState([...minis, ...wilderness], bosses);
    this.state.syncWorldFlags(options.done);
    if (options.done.has(KNIGHT_TRIAL_CLEAR)) this.state.retireOptionalTrial();
    for (const enemy of this.state.enemies) this.visuals.set(enemy.id, this.makeEnemy(enemy));
    options.scene.add(this.effectGroup);
    this.hud.id = 'world-vitals'; this.hud.className = 'combat-hud';
    this.hud.innerHTML = '<span></span><div class="combat-track"><div class="combat-fill"></div></div><small></small>';
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
    if (def) this.state.setBossRequirements(def.id, getEraBossRequirements(def.core, this.options.done) ?? def.requires);
    const began = !!def && this.state.beginBoss(this.options.done, def.id); this.events(); return began;
  }
  reset() {
    this.state.resetAll(this.bossDefs.map(b => isEraCoreCleared(b.core, this.options.done) ?? this.options.done.has(b.core)));
    this.state.syncWorldFlags(this.options.done);
    if (this.options.done.has(KNIGHT_TRIAL_CLEAR)) this.state.retireOptionalTrial();
    this.acc = 0; this.allyCooldown = 0; this.impactFor = 0; this.hurtFor = 0;
    for (const shot of this.shots) this.removeShot(shot);
    this.shots.length = 0;
    for (const spark of this.sparks) spark.mesh.removeFromParent();
    this.sparks.length = 0;
    for (const [id, v] of this.visuals) { this.enemyAssets.release(id); v.lastMode = undefined; v.root.visible = false; v.tell.visible = false; }
    this.impact.textContent = ''; this.hurt.style.opacity = '0';
    this.clearHitMarker();
    this.renderHud();
  }
  syncWorldProgress(done: ReadonlySet<string>) { this.state.syncWorldFlags(done); }
  requestKnightTrial() { return this.state.startOptionalTrial(KNIGHT_TRIAL_ID); }
  knightTrialPoint(): Point3 | null { const e = this.state.enemies.find(e => e.id === KNIGHT_TRIAL_ID); return e ? { ...e.home } : null; }
  startOptionalTrial(enemyId: string) { return this.state.startOptionalTrial(enemyId); }
  recoverAtSettlement(amount: number) { const healed = this.state.recoverAtSettlement(amount); if (healed) this.renderHud(); return healed; }
  canShoot() { return this.playable && this.state.canShoot(); }
  /** One bounded marker clock for enemy and quest hits; multi-target attacks allocate no timers. */
  flashHitMarker(duration = .13) {
    if (this.disposed || !this.playable || this.state.defeated || !Number.isFinite(duration) || duration <= 0) return;
    if (this.hitMarkerFor <= 0) document.getElementById('crosshair')?.classList.add('hit');
    this.hitMarkerFor = Math.max(this.hitMarkerFor, Math.min(.2, duration));
  }
  private clearHitMarker() {
    this.hitMarkerFor = 0;
    document.getElementById('crosshair')?.classList.remove('hit');
  }
  raycast(origin: Point3, direction: Point3, maxDistance: number) { return this.state.raycast(origin, direction, maxDistance); }
  damageEnemy(id: string, amount: number = COMBAT.shotDamage, context: HitContext = { source: 'ranged', origin: this.player }) { const hit = this.state.hitEnemy(id, amount, context); this.events(); return hit; }
  setDefense(defense: { guard: number; invulnerable: boolean }) { this.state.setDefense(defense); }
  /** Animation-contact attack API: all geometry and liveness are checked now, not at cast time. */
  applyStrike(strike: StrikeRequest, source: HitContext['source'] = 'skill'): StrikeResult {
    const result: StrikeResult = { damage: 0, hits: [], kills: [] };
    if (!this.playable || this.defeated) return result;
    for (const e of collectStrikeTargets(this.state.enemies, strike, this.geometry.terrain)) {
      const hp = e.hp;
      if (!this.state.hitEnemy(e.id, strike.damage, { source, origin: strike.origin })) continue;
      const damage = hp - e.hp;
      result.damage += damage; result.hits.push({ id: e.id, damage });
      if (e.mode === 'dead') result.kills.push(e.id);
      this.spark(new THREE.Vector3(e.p.x, e.p.y + 1.2, e.p.z), source === 'melee' ? .2 : .16);
    }
    this.events(); return result;
  }
  /** Read-only live observation. Tracking never consumes or waits for ally attack cooldown. */
  allyTrack(position: Point3, range = 3.5, targetId?: string, kind: 'melee' | 'ranged' = 'melee'): { id: string; p: Point3 } | null {
    if (!this.playable || this.state.defeated || (!Number.isFinite(position.x)||!Number.isFinite(position.y)||!Number.isFinite(position.z)) || !Number.isFinite(range) || range <= 0 || distanceXZ(position, this.player) > 25) return null;
    let enemy: Enemy | undefined, nearest = Math.min(kind === 'ranged' ? 14 : 5, range);
    const from = { x: position.x, y: position.y + 1, z: position.z };
    for (const candidate of this.state.enemies) {
      if (targetId && candidate.id !== targetId || !candidate.active || candidate.mode === 'dead' || candidate.pacified || Math.abs(candidate.p.y - position.y) >= 3) continue;
      const distance = distanceXZ(candidate.p, position);
      if (distance >= nearest || !this.geometry.terrain.lineOfSight(from, { x: candidate.p.x, y: candidate.p.y + 1, z: candidate.p.z })) continue;
      nearest = distance; enemy = candidate;
    }
    return enemy ? { id: enemy.id, p: { ...enemy.p } } : null;
  }
  /** Acquisition may wait for the shared damage throttle; observation during windup must not. */
  allyTarget(position: Point3, range = 3.5, targetId?: string, kind: 'melee' | 'ranged' = 'melee'): { id: string; p: Point3 } | null {
    return this.allyCooldown > 0 ? null : this.allyTrack(position, range, targetId, kind);
  }
  /** Choose a reachable-height, visible enemy near the PLAYER, observing from the actual companion. */
  allyEngage(radius = 15, from: Point3 = this.player): { id: string; p: Point3 } | null {
    if (!this.playable || this.state.defeated || (!Number.isFinite(from.x)||!Number.isFinite(from.y)||!Number.isFinite(from.z)) || !Number.isFinite(radius) || radius <= 0 || distanceXZ(from,this.player)>25) return null;
    let enemy: Enemy | undefined, nearest = Math.min(20,radius);
    const sight = { x: from.x, y: from.y+1, z: from.z };
    for (const candidate of this.state.enemies) {
      if (!candidate.active || candidate.mode === 'dead' || candidate.pacified || Math.abs(candidate.p.y - from.y) >= 3 || Math.abs(candidate.p.y-this.player.y)>=3) continue;
      const distance = distanceXZ(candidate.p, this.player);
      if (distance >= nearest || !this.geometry.terrain.lineOfSight(sight,{x:candidate.p.x,y:candidate.p.y+1,z:candidate.p.z})) continue;
      nearest=distance;enemy=candidate;
    }
    return enemy ? { id: enemy.id, p: { ...enemy.p } } : null;
  }
  /** Animation contact only: range/LOS/liveness/cooldown are checked again after wind-up. */
  allyStrike(position: Point3, range = 3.5, damage = 14, targetId?: string, kind: 'melee' | 'ranged' = 'melee'): { id: string; p: Point3 } | null {
    if(!Number.isFinite(damage) || damage<=0)return null;
    const target = this.allyTarget(position, range, targetId, kind);
    if (!target) return null;
    this.allyCooldown = 1.1;
    this.damageEnemy(target.id, Math.min(18, Math.max(0, damage)), { source: 'servant', origin: position });
    this.spark(new THREE.Vector3(target.p.x, target.p.y + 1.3, target.p.z), 0.16);
    return target;
  }
  shot(muzzle: THREE.Vector3, endpoint: THREE.Vector3, didHit: boolean) {
    while (this.shots.length >= 18) this.removeShot(this.shots.shift()!);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, endpoint]), this.lineMat);
    const bolt = new THREE.Mesh(this.boltGeo, this.boltMat); bolt.position.copy(muzzle);
    const flash = new THREE.Mesh(this.sparkGeo, this.sparkMat); flash.position.copy(muzzle); flash.scale.setScalar(0.8);
    this.effectGroup.add(line, bolt, flash);
    this.shots.push({ line, bolt, flash, from: muzzle.clone(), to: endpoint.clone(), age: 0, duration: Math.max(0.06, muzzle.distanceTo(endpoint) / 320) });
    if (didHit) this.spark(endpoint, 0.14);
  }
  private spark(point: THREE.Vector3, duration: number) {
    if (this.sparks.length >= 20) { const old = this.sparks.shift()!; old.mesh.removeFromParent(); }
    const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat); mesh.position.copy(point);
    this.effectGroup.add(mesh); this.sparks.push({ mesh, left: duration, full: duration });
  }
  /** Fixed simulation only: no DOM, model loading, sorting, animation, or effect iteration. */
  simulate(dt: number, player: Point3, active: boolean) {
    if (this.disposed) return;
    this.player.x = player.x; this.player.y = player.y; this.player.z = player.z; this.playable = active;
    this.allyCooldown = Math.max(0, this.allyCooldown - (active && Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0));
    if (!active) {
      this.state.setDefense({ guard: 1, invulnerable: false });
      if (this.hitMarkerFor > 0) this.clearHitMarker();
      return;
    }
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Called at120Hz, but retain20Hz AI/terrain budget. Boundary samples use this fixed step's defense/player.
    this.acc += Math.min(.1, dt);
    while (this.acc + 1e-9 >= .05) { this.state.step(.05, player, true, this.geometry.terrain); this.acc = Math.max(0, this.acc - .05); }
  }
  /** Legacy callers retain a combined tick; the production loop uses simulate + present separately. */
  update(dt: number, player: Point3, active: boolean, camera?: THREE.Camera) {
    this.simulate(dt, player, active); this.present(dt, player, active, camera);
  }
  present(dt: number, player: Point3, active: boolean, camera?: THREE.Camera) {
    if (this.disposed) return;
    this.state.syncWorldFlags(this.options.done);
    this.player.x = player.x; this.player.y = player.y; this.player.z = player.z; this.playable = active;
    if (!active) this.state.setDefense({ guard: 1, invulnerable: false });
    // Age the previous marker before draining new contact events so a new hit gets its full window.
    if (!active || this.state.defeated) { if (this.hitMarkerFor > 0) this.clearHitMarker(); }
    else if (this.hitMarkerFor > 0 && Number.isFinite(dt) && dt > 0) {
      this.hitMarkerFor = Math.max(0,this.hitMarkerFor-dt);
      if (this.hitMarkerFor <= 1e-9) this.clearHitMarker();
    }
    this.time += active ? dt : 0;
    this.enemyAssets.tick(dt);
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
      v.lastMode = e.mode;
      v.updateLabel?.();
      v.applyPacified?.(e.pacified);
      if (v.peaceMarker) v.peaceMarker.visible = e.pacified && distance < 24;
      if (v.roleLabel) v.roleLabel.visible = !e.pacified && distance < 24 && (e.mode !== 'idle' || distance < 12);
      const moving = e.mode === 'chase';
      v.updateCreature?.(e.pacified ? 0 : this.time, moving, e.mode === 'windup');
      v.body.position.y = skinned || v.updateCreature ? 0 : 0.025 * Math.sin(this.time * (moving ? 10 : 3));
      v.body.rotation.z = !skinned && !v.updateCreature && moving ? Math.sin(this.time * 9) * 0.04 : 0;
      const facing = e.pacified ? e.home : (e.mode === 'windup' || e.mode === 'recover') ? e.target : player;
      v.body.rotation.y = Math.atan2(facing.x - e.p.x, facing.z - e.p.z);
      if (v.sword) v.sword.rotation.z = e.mode === 'windup' ? -1.8 : e.mode === 'recover' ? 0.6 : -0.2;
      v.material.emissiveIntensity = e.pacified ? 0 : e.hitTime > 0 ? 2.5 : e.phase === 2 ? 0.6 : 0.12;
      const punishCue = active && !this.state.defeated && e.active && !e.pacified && isMeleePunishWindow(e);
      const interrupted = active && e.mode === 'stagger';
      // No new draw calls, body shells, lights or flashing: reuse the existing health bar.
      (v.fill.material as THREE.MeshBasicMaterial).color.set(e.pacified ? '#78949a' : punishCue ? '#79efdc' : interrupted ? '#d3ac77' : e.miniboss ? '#ffd36a' : '#ffb26f');
      v.bar.scale.y = punishCue ? 1.65 : 1;
      // A health bar promises a currently damageable opponent, never a dormant prop.
      v.bar.visible = active && e.active && !e.pacified && !this.state.defeated && (e.hp < e.maxHp || e.mode !== 'idle');
      if (camera) { v.bar.quaternion.copy(camera.quaternion); v.peaceMarker?.quaternion.copy(camera.quaternion); }
      const ratio = e.hp / e.maxHp; v.fill.scale.x = ratio; v.fill.position.x = -(1 - ratio) * (e.kind === 'king' ? 1.5 : 0.8) / 2;
      v.tell.visible = e.mode === 'windup';
      if (v.tell.visible) {
        const center = e.attack !== 'sweep' ? e.target : e.p;
        const radius = enemyAttackRadius(e);
        if (e.attack === 'thrust') {
          const dx = e.target.x - e.p.x, dz = e.target.z - e.p.z, distance = Math.hypot(dx, dz);
          const ux = distance > .001 ? dx / distance : 0, uz = distance > .001 ? dz / distance : 1;
          const length = enemyThrustLength(e);
          v.tell.geometry = this.thrustTellGeo;
          v.tell.rotation.set(-Math.PI / 2, 0, Math.atan2(-ux, -uz));
          v.tell.position.set(e.p.x + ux * length / 2, e.p.y + .13, e.p.z + uz * length / 2);
          v.tell.scale.set(radius, length, 1);
        } else {
          v.tell.geometry = v.tell.userData.circle;
          v.tell.rotation.set(-Math.PI / 2, 0, 0);
          v.tell.position.set(center.x, center.y + .13, center.z); v.tell.scale.setScalar(radius);
        }
        const progress = 1 - Math.max(0, e.timer) / enemyAttackTiming(e).windup;
        (v.tell.material as THREE.MeshBasicMaterial).opacity = .22 + .42 * progress;
      }
    }
    if (camera) camera.getWorldQuaternion(this.effectFacing);
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.age += dt;
      s.bolt.position.lerpVectors(s.from, s.to, Math.min(1, s.age / s.duration));
      if (camera) s.flash.quaternion.copy(this.effectFacing);
      s.flash.visible = s.age < 0.045; s.line.visible = s.age < 0.075;
      if (s.age > s.duration + 0.035) { this.removeShot(s); this.shots.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.left -= dt; // Shrink away over a short lifetime without changing shared materials.
      s.mesh.scale.setScalar(Math.max(0, s.left / s.full));
      if (camera) s.mesh.quaternion.copy(this.effectFacing);
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
      if (event.type === 'attackContact') {
        // A phase break/reset can enter recover without firing. Only simulation contact
        // may emit a tracer, including when presentation skipped an intermediate state.
        if (event.attack === 'shot' && this.playable && !this.state.defeated) {
          const direction = new THREE.Vector3(event.target.x - event.origin.x, 0, event.target.z - event.origin.z).normalize();
          const muzzle = new THREE.Vector3(event.origin.x, event.origin.y + 1.2, event.origin.z).addScaledVector(direction, .55);
          this.shot(muzzle, new THREE.Vector3(event.target.x, event.target.y + 1, event.target.z), false);
        }
      } else if (event.type === 'hit') {
        if (event.source) this.options.onDamage?.({ id: event.id, damage: event.damage, source: event.source, eligible: true });
        this.impact.textContent = `${event.punish ? bilingual('破绽 ×2 ', 'PUNISH ×2 ') : ''}−${event.damage}`; this.impactFor = 0.35;
        this.flashHitMarker();
      } else if (event.type === 'kill') {
        if (event.id === KNIGHT_TRIAL_ID) this.options.done.add(KNIGHT_TRIAL_CLEAR);
        this.options.onKill?.(event.id);
      }
      else if (event.type === 'stagger') { this.impact.textContent = bilingual('打断！', 'INTERRUPTED'); this.impactFor = .55;
      } else if (event.type === 'hurt') { this.hurtFor = 0.4; this.options.onHurt?.(event.damage); }
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
    this.hud.querySelector('span')!.textContent = `${bilingual('生命', 'HP')} ${Math.ceil(this.state.hp)} / ${COMBAT.playerHp}` + (this.state.gunVent > 0 ? ` · ${bilingual('散热', 'VENT')} ${this.state.gunVent.toFixed(1)}s` : this.state.gunHeat > 0 ? ` · ${bilingual('枪热', 'HEAT')} ${this.state.gunHeat}/${COMBAT.shotBurst}` : '');
    (this.hud.querySelector('.combat-fill') as HTMLElement).style.width = `${this.state.hp}%`;
    this.hud.title = bilingual('脱离战斗 5 秒后恢复生命', 'Health recovers after 5 seconds out of combat');
    this.bossHud.hidden = !this.state.bossStarted;
    const text = bossText(this.state.boss?.id ?? '');
    this.bossHud.querySelector('strong')!.textContent = bilingual(...text.name);
    (this.bossHud.querySelector('.combat-fill') as HTMLElement).style.width = `${100 * this.state.boss.hp / this.state.boss.maxHp}%`;
    let nearest: Enemy | undefined, closest = 20;
    for (const enemy of this.state.enemies) {
      const distance = distanceXZ(enemy.p, this.player);
      if (enemy.active && enemy.mode !== 'idle' && enemy.mode !== 'dead' && distance < closest) { nearest = enemy; closest = distance; }
    }
    const nearestHint = this.hud.querySelector('small')!;
    const playable = this.playable && !this.state.defeated;
    const nearestPunish = playable && nearest && !nearest.pacified && isMeleePunishWindow(nearest);
    nearestHint.className = nearestPunish ? 'combat-counter combat-counter--punish' : 'combat-counter';
    const nearestElite = nearest?.miniboss ? MINIBOSSES.find(m => m.id === nearest.miniboss) : undefined;
    nearestHint.textContent = nearest?.pacified ? (nearest.id.startsWith('wild_48') ? bilingual('中继已接管 · 哨卫休眠 · 无需攻击', 'Relay restored · Sentinel dormant · Non-hostile') : bilingual('旧誓试炼已完成 · 护路者停战 · 无需攻击', 'Oath trial complete · Road wardens stand down · Non-hostile')) : nearest && nearest.kind !== 'king' ? `${nearestElite ? bilingual(...nearestElite.name) : bilingual(...ENEMY_ROLES[nearest.role].name)} · ${counterHint(nearest,playable)}` : '';
    const b = this.state.boss, bossHint = this.bossHud.querySelector('small')!;
    const bossPunish = playable && b.active && !b.pacified && isMeleePunishWindow(b);
    bossHint.className = bossPunish ? 'combat-counter combat-counter--punish' : 'combat-counter';
    if (b) bossHint.textContent = `${bilingual('阶段', 'Phase')} ${b.phase} · ${Math.ceil(b.hp)} / ${b.maxHp} · ${counterHint(b,playable)}`;
    this.defeat.hidden = !this.state.defeated;
    this.defeat.textContent = bilingual('你倒下了\n即将回到安全地点 · 进度保留', 'You have fallen\nReturning to safety · Progress is kept');
  }
  private makeEnemy(e: Enemy): EnemyVisual {
    const king = e.kind === 'king', crystal = e.kind === 'crystal';
    const root = new VisibleEnemyRoot(), body = new THREE.Group(), fallback = new THREE.Group(); root.add(body); body.add(fallback); root.name = e.id;
    const model = enemyModel(e);
    const [kBody, kGlow, kLight] = (e.miniboss ? MINIBOSSES.find(m => m.id === e.miniboss)?.colors : undefined) ?? bossText(e.id).colors;
    const material = new THREE.MeshStandardMaterial({ color: king ? kBody : crystal ? '#49859b' : '#52637d', metalness: 0.35, roughness: 0.5, emissive: king ? kGlow : crystal ? '#63e4ed' : '#2f8f83', emissiveIntensity: 0.12 });
    const glow = new THREE.MeshBasicMaterial({ color: king ? kLight : crystal ? '#9dffff' : '#a1ffe7', toneMapped: false });
    if (model) { material.color.set(model === 'musketeer' || model === 'officer' ? '#3b594a' : model === 'samurai' || model === 'ashigaru' ? '#5b3434' : model === 'sunward_guard' ? '#8a8171' : '#62544a'); material.emissive.set('#000000'); }
    this.materials.push(material, glow);
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
    const barGeo = new THREE.PlaneGeometry(width, 0.09), backMat = new THREE.MeshBasicMaterial({ color: '#171c29', depthTest: true });
    const fillMat = new THREE.MeshBasicMaterial({ color: e.miniboss ? '#ffd36a' : '#ffb26f', depthTest: true });
    this.shared.push(barGeo); this.materials.push(backMat, fillMat);
    const back = new THREE.Mesh(barGeo, backMat), fill = new THREE.Mesh(barGeo, fillMat); fill.position.z = 0.005; bar.add(back, fill);
    const tellGeo = new THREE.CircleGeometry(1, 40), tellMat = new THREE.MeshBasicMaterial({ color: e.miniboss ? '#ffb82f' : '#ff4939', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    this.shared.push(tellGeo); this.materials.push(tellMat);
    const tell = new THREE.Mesh(tellGeo, tellMat); tell.userData.circle = tellGeo; tell.rotation.x = -Math.PI / 2; tell.visible = false;
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
    let roleLabel: THREE.Sprite | undefined;
    if (!king && !e.miniboss) {
      let cached = this.roleLabels.get(e.role);
      if (!cached) {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 64;
        const ctx = canvas.getContext?.('2d');
        if (ctx) {
          const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture);
          const labelMaterial = new THREE.SpriteMaterial({ map: texture, depthWrite: false }); this.materials.push(labelMaterial);
          let prior = '';
          const update = () => {
            const text = bilingual(...ENEMY_ROLES[e.role].name); if (text === prior) return; prior = text;
            ctx.clearRect(0, 0, 512, 64); ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = 5; ctx.strokeStyle = '#17232b'; ctx.strokeText(text, 256, 32);
            ctx.fillStyle = e.role === 'lancer' ? '#96dcff' : e.role === 'bombardier' ? '#e1bdff' : '#f2dec0'; ctx.fillText(text, 256, 32);
            texture.needsUpdate = true;
          };
          cached = { material: labelMaterial, update }; this.roleLabels.set(e.role, cached); update();
        }
      }
      if (cached) { roleLabel = new THREE.Sprite(cached.material); roleLabel.position.y = 2.55; roleLabel.scale.set(2.6, .325, 1); roleLabel.updateMatrix(); roleLabel.matrixAutoUpdate=false; root.add(roleLabel); updateLabel = cached.update; }
    }
    // Peaceful story sentinels use a mint pause emblem, never an enemy HP bar.
    // Geometry remains legible even if canvas/text creation is unavailable.
    let peaceMarker: THREE.Group | undefined;
    if (['wild_48', 'wild_48b', 'wild_56', 'wild_56b'].includes(e.id)) {
      peaceMarker = new THREE.Group(); peaceMarker.name = 'Standing_Down_Not_Attackable';
      peaceMarker.position.y = 2.45; peaceMarker.visible = false; root.add(peaceMarker);
      const signMaterial = new THREE.MeshBasicMaterial({ color: '#9dd8ce', side: THREE.DoubleSide });
      const signGeometry = new THREE.BoxGeometry(.06, .22, .06);
      this.materials.push(signMaterial); this.shared.push(signGeometry);
      for (const x of [-.065, .065]) { const mark = new THREE.Mesh(signGeometry, signMaterial); mark.position.x = x; peaceMarker.add(mark); }
    }
    let applyPacified: EnemyVisual['applyPacified'];
    if (e.id === 'wild_48' || e.id === 'wild_48b') {
      const unique = new Set<THREE.MeshStandardMaterial>();
      fallback.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) unique.add(object.material); });
      const original = [...unique].map(material => ({ material, color: material.color.clone(), emissive: material.emissiveIntensity }));
      let prior = false;
      applyPacified = pacified => {
        if (pacified === prior) return; prior = pacified;
        for (const item of original) { item.material.color.copy(item.color).multiplyScalar(pacified ? .55 : 1); item.material.emissiveIntensity = pacified ? 0 : item.emissive; }
      };
    }
    return { root, body, fallback, model, updateLabel, updateCreature, sword, bar, fill, tell, material, roleLabel, applyPacified, peaceMarker };
  }
  private removeShot(s: ShotVisual) { s.line.removeFromParent(); s.line.geometry.dispose(); s.bolt.removeFromParent(); s.flash.removeFromParent(); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.clearHitMarker();
    for (const v of this.visuals.values()) { v.root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); v.root.removeFromParent(); v.tell.removeFromParent(); }
    for (const s of this.shots) this.removeShot(s);
    this.enemyAssets.dispose();
    this.effectGroup.removeFromParent(); this.shared.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.boltGeo.dispose(); this.sparkGeo.dispose(); this.sparkMat.dispose(); this.boltMat.dispose(); this.lineMat.dispose();
    for (const el of [this.hud, this.bossHud, this.impact, this.hurt, this.defeat]) el.remove();
  }
}
