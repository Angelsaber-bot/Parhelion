/** Reproducible ideal-input, flat-arena experiment; not a human playtest or renderer benchmark. */
import * as THREE from 'three';
import { WorldCombatState, COMBAT, enemyAttackRadius, enemyAttackContains, distanceXZ, type Enemy, type Point3, type CombatTerrain } from '../src/combat';
import type { EnemyRole } from '../src/enemyRoles';
import { WorldActions, type WorldActionContext, type ActionPoseCommand } from '../src/worldActions';
import { collectStrikeTargets } from '../src/combatActions';
import { CHARACTER_KITS } from '../src/characters/catalog';
import type { ServantId } from '../src/contracts';
import { MELEE_BEATS } from '../src/playerMelee';
import { PLAYER } from '../src/player';
import { resolveServantSkillAim } from '../src/skillAim';
import { CONTRACT_SKILLS } from '../src/contractSkills';
import { hazardContains, type Hazard } from '../src/bossHazards';
/** An ideal reader of phase-2 ground telegraphs: when standing in one that bursts soon, pick the
 * nearest spot that is clear of every telegraph bursting before (or just after) arrival. */
function hazardEscape(hazards: readonly Hazard[], position: Point3, speed: number, swing?: Enemy): Point3 | null {
  if (!hazards.some(h => hazardContains(h, position))) return null;
  // prefer spots clear well past arrival; settle for clear on arrival when a swing is closing in too
  for (const margin of [1.5, .3]) for (const d of [1, 2, 3, 4.5, 6, 8, 10]) for (let k = 0; k < 24; k++) {
    const p = { x: position.x + Math.cos(k / 12 * Math.PI) * d, y: position.y, z: position.z + Math.sin(k / 12 * Math.PI) * d };
    const arrive = d / speed;
    // on the way there, never stand on a telegraph at the moment it bursts
    const pathClear = [.25, .5, .75].every(f => { const q = { x: position.x + (p.x - position.x) * f, y: position.y, z: position.z + (p.z - position.z) * f }, at = f * arrive; return hazards.every(h => Math.abs(h.t - at) > arrive / 6 + .12 || !hazardContains(h, q)); });
    if (pathClear && hazards.every(h => h.t > arrive + margin || !hazardContains(h, p)) && !(swing?.mode === 'windup' && enemyAttackContains(swing, p))) return p;
  }
  return null;
}
export type Strategy = 'stationary-gun' | 'kite-gun' | 'dodge-gun' | 'melee-punish' | 'melee-spam' | 'melee-evade' | 'mixed' | 'gun-then-melee';
export interface Scenario { name: string; boss?: string; pack?: number; roles?: readonly EnemyRole[]; strategy: Strategy; identity?: ServantId; seconds?: number; companionGun?: boolean }
export interface Result { name: string; strategy: Strategy; terminal: string; seconds: number; damageTaken: number; damageDealt: number; kills: number; shots: number; dryPulls: number; ammoLeft: number; firstDryAt: number | null; phase2At: number | null; firstUltimateAt: number | null; ultimates: number; skillCasts: number; energy: number; hits: Record<string, number>; attacks: number }
const terrain: CombatTerrain = { walk: (_p, x, z) => ({ x, y: 0, z }), lineOfSight: () => true };
const dt = 1 / 120; // Production action/capsule clock; AI remains20Hz, fire/actor contacts60Hz.
export function runScenario(config: Scenario): Result {
  const count = config.boss ? 0 : config.pack ?? 2;
  const state = new WorldCombatState(Array.from({ length: count }, (_, i) => ({ id: `pack${i}`, kind: 'shade' as const, role: (config.roles ?? (['stalker', 'breaker', 'lancer', 'bombardier'] as const))[i % (config.roles ?? ['stalker', 'breaker', 'lancer', 'bombardier']).length], p: { x: (i % 2) * 1.1, y: 0, z: Math.floor(i / 2) * 1.1 } })), { id: config.boss ?? 'absent-boss', kind: 'king', p: { x: 0, y: 0, z: 0 }, requires: [] });
  if (config.boss) state.beginBoss(new Set());
  const context: WorldActionContext = { enabled: true, grounded: true, armed: true, bladeReady: true, position: { x: 0, y: 0, z: config.strategy.startsWith('melee') ? -1.5 : config.identity === 'musashi' ? -4 : config.identity === 'saber' ? -9 : config.identity === 'napoleon' ? -12 : -18 }, yaw: Math.PI, moveX: 0, moveZ: 0, identity: config.identity ?? null };
  let pose: { command: ActionPoseCommand; age: number; times: number[]; next: number; duration: number; origin: Point3; mounted: boolean } | undefined;
  const result: Result = { name: config.name, strategy: config.strategy, terminal: 'timeout', seconds: 0, damageTaken: 0, damageDealt: 0, kills: 0, shots: 0, dryPulls: 0, ammoLeft: 0, firstDryAt: null, phase2At: null, firstUltimateAt: null, ultimates: 0, skillCasts: 0, energy: 0, hits: {}, attacks: 0 };
  const consume = () => {
    for (const event of state.drainEvents()) {
      if (event.type === 'hit') { result.damageDealt += event.damage; result.hits[event.source ?? 'raw'] = (result.hits[event.source ?? 'raw'] ?? 0) + event.damage; actions.recordDamage({ id: event.id, damage: event.damage, source: event.source ?? 'servant', eligible: true }); }
      if (event.type === 'hurt') result.damageTaken += event.damage;
      if (event.type === 'kill') result.kills++;
      if (event.type === 'phase') result.phase2At ??= result.seconds;
    }
  };
  const actions = new WorldActions({ scene: new THREE.Scene(), context: () => context, reducedEffects: () => true, toast() {}, defense: value => state.setDefense(value),
    // This flat-arena harness places its simulated companion at context.position.
    // Use production live-hostile/range/height/LOS targeting, not an always-valid
    // target token: Saber now rejects a free-aim fallback before payment.
    resolveAim(identity, slot) {
      return resolveServantSkillAim({ player: context.position, caster: context.position,
        viewOrigin: { ...context.position, y: context.position.y + 1.7 },
        viewDirection: { x: -Math.sin(context.yaw), y: 0, z: -Math.cos(context.yaw) },
        range: Math.max(...CONTRACT_SKILLS[identity][slot].pulses.map(pulse => pulse.range)),
        enemies: state.enemies, terrain });
    },
    cancelPoses() { const previous = pose; pose = undefined; previous?.command.onFinish(false); },
    startPose(identity, command) {
      const clip = identity === 'saber' ? { duration: 1.2, events: [{ at: 1.2 * 5 / 9 }] } : CHARACTER_KITS[identity === 'napoleon' ? 'napoleonMounted' : identity].clips.attack;
      const times: number[] = [];
      for (let repeat = 0; times.length < command.contacts; repeat++) for (const event of clip.events) if (times.length < command.contacts) times.push(repeat * clip.duration + event.at);
      const repeats = Math.ceil(command.contacts / clip.events.length);
      pose = { command, age: 0, times, next: 0, duration: repeats * clip.duration, origin: { ...context.position }, mounted: identity === 'napoleon' }; return true;
    },
    strike(request, source) {
      const hits: { id: string; damage: number }[] = [], kills: string[] = [];
      for (const enemy of collectStrikeTargets(state.enemies, request, terrain)) {
        const before = enemy.hp; state.hitEnemy(enemy.id, request.damage, { source, origin: request.origin });
        hits.push({ id: enemy.id, damage: before - enemy.hp }); if (enemy.hp <= 0) kills.push(enemy.id);
      }
      consume(); return { hits, kills, damage: hits.reduce((n, h) => n + h.damage, 0) };
    },
  });
  let attackCounts = 0, orbitAngle = 0, aiAccumulator = 0;
  for (let frame = 0; frame < (config.seconds ?? 120) / dt; frame++) {
    result.seconds = frame * dt;
    const live = state.enemies.filter(e => e.mode !== 'dead' && (config.boss ? e === state.boss : e.kind !== 'king'));
    if (!live.length) { result.terminal = 'victory'; break; }
    if (state.defeated) { result.terminal = 'death'; break; }
    const target = live.sort((a, b) => distanceXZ(a.p, context.position) - distanceXZ(b.p, context.position))[0];
    const position = context.position;
    // A field player shoots while the sun-cell holds rounds and falls back to the blade when it runs dry.
    const strategy: Strategy = config.strategy !== 'gun-then-melee' ? config.strategy : state.ammo > 0 ? 'kite-gun' : 'melee-punish';
    if (state.ammo <= 0) result.firstDryAt ??= +result.seconds.toFixed(2);
    const escape = strategy === 'dodge-gun' || strategy === 'melee-evade' ? hazardEscape(state.hazards, position, PLAYER.sprint, target) : null;
    if (actions.evade.active) { position.x += actions.evade.x * 13 * Math.min(dt, actions.evade.remaining); position.z += actions.evade.z * 13 * Math.min(dt, actions.evade.remaining); }
    else if (escape) {
      const dx = escape.x - position.x, dz = escape.z - position.z, length = Math.hypot(dx, dz);
      if (length > 0) { position.x += dx * Math.min(1, PLAYER.sprint * dt / length); position.z += dz * Math.min(1, PLAYER.sprint * dt / length); }
      if (strategy === 'dodge-gun') orbitAngle = Math.atan2(position.x, -position.z);
    } else if (strategy === 'kite-gun' || strategy === 'dodge-gun' || strategy === 'mixed') {
      const radius = config.identity === 'musashi' ? 4 : config.identity === 'saber' ? 9 : config.identity === 'napoleon' ? 12 : 18;
      const speed = strategy === 'kite-gun' ? PLAYER.walk : target.mode === 'windup' ? PLAYER.sprint : PLAYER.walk;
      orbitAngle += speed / radius * dt;
      const dx = Math.sin(orbitAngle) * radius - position.x, dz = -Math.cos(orbitAngle) * radius - position.z, length = Math.hypot(dx, dz);
      const step = (sign: number) => { const a = orbitAngle + (sign < 0 ? -2 * speed / radius * dt : 0), ex = Math.sin(a) * radius - position.x, ez = -Math.cos(a) * radius - position.z, l = Math.hypot(ex, ez); return l > 0 ? { x: position.x + ex * Math.min(1, speed * dt / l), y: position.y, z: position.z + ez * Math.min(1, speed * dt / l) } : position; };
      let next = length > 0 ? { x: position.x + dx * Math.min(1, speed * dt / length), y: position.y, z: position.z + dz * Math.min(1, speed * dt / length) } : position;
      if (strategy === 'dodge-gun') {
        // the ideal reader never walks into a live telegraph or a locked impact zone: it doubles back instead
        const unsafe = (p: Point3) => state.hazards.some(h => hazardContains(h, p)) || (target.mode === 'windup' && enemyAttackContains(target, p));
        if (unsafe(next) && !unsafe(position)) { const back = step(-1); next = unsafe(back) ? position : back; }
        orbitAngle = Math.atan2(next.x, -next.z);
      }
      position.x = next.x; position.z = next.z;
    } else if (strategy.startsWith('melee')) {
      const distance = distanceXZ(target.p, position), awayX = (position.x - target.p.x) / Math.max(.001, distance), awayZ = (position.z - target.p.z) / Math.max(.001, distance);
      const wanted = strategy === 'melee-punish' && target.mode === 'windup' ? enemyAttackRadius(target) + 1 : MELEE_BEATS[0].range - .15;
      const movement = Math.max(-PLAYER.walk * dt, Math.min(PLAYER.walk * dt, wanted - distance));
      position.x += awayX * movement; position.z += awayZ * movement;
    }
    context.yaw = Math.atan2(-(target.p.x - position.x), -(target.p.z - position.z));
    context.moveZ = strategy === 'melee-evade' ? 1 : 0;
    if (strategy.startsWith('melee')) {
      if (strategy === 'melee-evade' && (target.mode === 'windup' && target.timer <= .1 || state.hazards.some(h => h.t <= .1 && hazardContains(h, context.position))) && actions.evade.cooldown <= 0) actions.press('evade');
      if (distanceXZ(target.p, position) <= MELEE_BEATS[0].range - .05 && (strategy === 'melee-spam' || target.mode === 'recover' || target.mode === 'stagger')) actions.press('melee');
    } else {
      if (strategy === 'mixed' && target.mode === 'windup' && target.timer <= .1 && actions.evade.cooldown <= 0) actions.press('evade');
      // the ideal ranged reader still has the evade's i-frames for a burst it could not clear on foot
      if (strategy === 'dodge-gun' && (state.hazards.some(h => h.t <= .1 && hazardContains(h, context.position)) || target.mode === 'windup' && target.timer <= .1 && enemyAttackContains(target, context.position)) && actions.evade.cooldown <= 0) actions.press('evade');
      if (strategy === 'mixed' && !actions.skills.casting) {
        const before = actions.skills.energy;
        if (before >= 100 && actions.skills.cooldown('ultimate') <= 0) { actions.press('ultimate'); if (actions.skills.energy < before) { result.ultimates++; result.firstUltimateAt ??= result.seconds; } }
        else if (actions.skills.cooldown('skill') <= 0) { actions.press('skill'); if (actions.skills.casting) result.skillCasts++; }
      }
      if (frame % 2 === 1 && (!actions.skills.casting || config.companionGun) && !actions.melee.active && !actions.evade.active) {
        const dry = state.dryPulls;
        if (state.canShoot()) { result.shots++; state.hitEnemy(target.id, COMBAT.shotDamage, { source: 'ranged', origin: position }); }
        else if (state.dryPulls > dry) result.dryPulls++;
      }
    }
    state.setDefense({ guard: actions.skills.guarding ? .55 : 1, invulnerable: actions.evade.remaining > .10 });
    aiAccumulator += dt;
    while (aiAccumulator + 1e-9 >= .05) { state.step(.05, position, true, terrain); aiAccumulator = Math.max(0, aiAccumulator - .05); }
    consume(); actions.update(dt);
    if (pose && frame % 2 === 1) {
      const current = pose; current.age += dt * 2;
      while (current.next < current.times.length && current.age + 1e-9 >= current.times[current.next]) {
        current.next++;
        const p = { ...current.origin }; if (current.mounted) { p.x += current.command.direction.x * 4.4 * 23 / 30; p.z += current.command.direction.z * 4.4 * 23 / 30; }
        current.command.onContact(p, current.command.direction);
      }
      if (current.age + 1e-9 >= current.duration) { pose = undefined; current.command.onFinish(true); }
    }
    actions.flush(); consume(); if (frame % 2 === 1) actions.present(dt * 2);
    attackCounts = Math.max(attackCounts, state.enemies.reduce((n, e) => n + e.attackCount, 0));
  }
  result.ammoLeft = state.ammo; result.energy = +actions.skills.energy.toFixed(2); result.seconds = +result.seconds.toFixed(2); result.damageTaken = +result.damageTaken.toFixed(2); result.damageDealt = +result.damageDealt.toFixed(2); result.attacks = attackCounts;
  actions.dispose(); return result;
}
export const BALANCE_SCENARIOS: Scenario[] = [
  ...([2, 4] as const).flatMap(pack => (['stationary-gun', 'kite-gun', 'dodge-gun', 'melee-spam', 'melee-punish', 'melee-evade'] as const).map(strategy => ({ name: `pack${pack}-${strategy}`, pack, strategy }))),
  ...(['stationary-gun', 'kite-gun', 'dodge-gun', 'melee-spam', 'melee-punish', 'melee-evade'] as const).map(strategy => ({ name: `king-${strategy}`, boss: 'boss_vacant_king', strategy })),
  ...(['saber', 'blackbeard', 'napoleon', 'musashi'] as const).map(identity => ({ name: `king-mixed-${identity}`, boss: 'boss_vacant_king', strategy: 'mixed' as const, identity })),
  ...(['boss_drowned_admiral', 'boss_winter_warden', 'boss_hellfire_lord'] as const).flatMap(boss => (['kite-gun', 'dodge-gun', 'melee-punish', 'melee-evade'] as const).map(strategy => ({ name: `${boss}-${strategy}`, boss, strategy }))),
  // Regional signature roles, and the field loop the ammo cap is meant to produce.
  ...(['shieldbearer', 'shinobi', 'powder', 'jaeger'] as const).flatMap(role => (['kite-gun', 'melee-evade', 'gun-then-melee'] as const)
    .map(strategy => ({ name: `${role}3-${strategy}`, pack: 3, roles: [role] as const, strategy }))),
  { name: 'attrition8-gun-then-melee', pack: 8, strategy: 'gun-then-melee' as const, seconds: 240 },
  { name: 'attrition8-kite-gun', pack: 8, strategy: 'kite-gun' as const, seconds: 240 },
];
