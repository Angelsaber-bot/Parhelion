/** Diagnostic runner executes the real production frame's timing/physics prefix, not a hand-written evade loop. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Player } from '../src/player';
import { WorldActions } from '../src/worldActions';
import { WorldCombatState } from '../src/combat';

export const AUDIT_FPS = [27, 30, 60, 120] as const;
const STEP = 1 / 120;
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const frame = source.slice(source.indexOf('function frame(now: number)'));
const prefix = frame.slice(frame.indexOf('  const frameSeconds ='), frame.indexOf('  const canAim ='));
const combatCall = frame.match(/^  combat\.update\([^\n]+/m)?.[0] ?? '';
const productionTick = new vm.Script(transformSync(`(()=>{${prefix}\n${combatCall}\n})()`, { loader: 'ts', format: 'cjs' }).code);

export function auditEvadeFrame(fps: number) {
  const floor = new THREE.BoxGeometry(100, 1, 100).translate(0, -.5, 0);
  const player = new Player([{ name: 'floor', enabled: true, bvh: new MeshBVH(floor) }], -10);
  player.teleport(0, .01, 0);
  const idle = { x: 0, z: 0, jump: false, sprint: false };
  for (let i = 0; i < 30; i++) player.step(STEP, idle);
  const start = player.pos.clone();
  const state = new WorldCombatState([], []);
  let defense = { guard: 1, invulnerable: false }, iframeSeconds = 0, evadeSeconds = 0, combatProtectedTicks = 0, combatAcc = 0;
  const actions = new WorldActions({ scene: new THREE.Scene(),
    context: () => ({ enabled: true, grounded: player.onGround, armed: true, bladeReady: true, position: player.pos, yaw: 0, moveX: 0, moveZ: 0, identity: null }),
    strike: () => ({ damage: 0, hits: [], kills: [] }), defense: value => { defense = value; state.setDefense(value); },
    startPose: () => false, cancelPoses() {}, toast() {}, reducedEffects: () => true,
  });
  const step = player.step.bind(player);
  player.step = (dt, input) => { if (input.evade) evadeSeconds += dt * (input.evade.strength ?? 1); if (defense.invulnerable) iframeSeconds += dt; step(dt, input); };
  const applyDefense = (value: { guard: number; invulnerable: boolean }) => { defense = value; state.setDefense(value); };
  const combat = { setDefense: applyDefense, simulate(dt: number) { combatAcc += dt; while (combatAcc + 1e-9 >= .05) { if (defense.invulnerable) combatProtectedTicks++; state.step(.05, player.pos, true, { walk: () => null, lineOfSight: () => true }); combatAcc = Math.max(0, combatAcc - .05); } }, get defeated() { return state.defeated; }, update(dt: number) {
    combatAcc += dt;
    while (combatAcc >= .05) { if (defense.invulnerable) combatProtectedTicks++; state.step(.05, player.pos, true, { walk: () => null, lineOfSight: () => true }); combatAcc -= .05; }
  }};
  const context = vm.createContext({ now: 0, last: 0, acc: 0, STEP, actions, player, combat,
    gameplayActive: () => true, down: () => false, cold: { frozen: false }, camera: {},
    keys: { clear() {} }, aim: { clear() {} }, audio: { setActive() {} }, fortCannon: { update() {} },
    locked: true, narrative: { open: false }, document: { visibilityState: 'visible', hasFocus: () => true },
  });
  actions.press('evade');
  for (let f = 1; f <= fps; f++) { context.now = f / fps * 1000; productionTick.runInContext(context); }
  const result = { fps, distance: player.pos.distanceTo(start), horizontalDistance: Math.hypot(player.pos.x - start.x, player.pos.z - start.z), evadeSeconds, iframeSeconds, combatProtectedTicks };
  actions.dispose(); floor.dispose(); return result;
}

/** Fixed120Hz simulation, held-fire attempts remain once per rendered frame. */
export function auditHeatFrame(fps: number, seconds = 10) {
  const state = new WorldCombatState([], []);
  let acc = 0, shots = 0, firstVent = -1, firstResume = -1;
  for (let f = 0; f < fps * seconds; f++) {
    acc += 1 / fps;
    while (acc + 1e-9 >= .05) { state.step(.05, { x: 0, y: 0, z: 0 }, true, { walk: () => null, lineOfSight: () => true }); acc = Math.max(0, acc - .05); }
    if (state.canShoot()) { shots++; if (shots === 8) firstVent = (f + 1) / fps; if (shots === 9) firstResume = (f + 1) / fps; }
  }
  return { fps, shots, firstVent, firstResume, ventSeconds: firstResume - firstVent };
}

if (process.argv[1]?.endsWith('action-frame-audit.ts')) console.log(JSON.stringify({ evade: AUDIT_FPS.map(auditEvadeFrame), heat: AUDIT_FPS.map(fps => auditHeatFrame(fps)) }, null, 2));
