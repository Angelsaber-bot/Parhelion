import { getMap, MAPS } from '../shared/arenaMap.ts';
import { Bot, navFor } from '../shared/bot.ts';
import { SMOKE, TICK_HZ } from '../shared/content.ts';
import { EXPLORATION_TICKS } from '../shared/exploration.ts';
import { settleSmoke } from '../shared/grenade.ts';
import { lineOfSight } from '../shared/map.ts';
import { Match } from '../shared/match.ts';
import { applyNeuralAction, greedyAction } from '../shared/botNeuralControl.ts';
import { playerEye, type Input } from '../shared/sim.ts';
import { encodeDetailFrame } from '../shared/trainingView.ts';
import { ArenaScene } from '../src/rendering/scene.ts';
import { readArenaCamera } from '../src/player/humanDemo.ts';

type Infer = (wire: { luminance: string; reset: boolean }) => Promise<number[]>;

/** Developer audition. A browser renders the game and the policy subprocess sees only the pilot camera. */
export async function visualMatch(mapId: string, seconds: number, seed: number, smoke: boolean, infer: Infer) {
  const info = MAPS.find(m => m.id === mapId);
  if (!info) throw new Error('Unknown Arena map');
  const map = getMap(mapId), match = new Match(map, '1v1');
  const screen = document.createElement('canvas');
  document.body.append(screen);
  const scene = new ArenaScene(screen, 'low');
  await scene.loadMap(mapId, info.data.presentation?.preset ?? info.preset, info.data.presentation);
  const buffer = document.createElement('canvas');
  buffer.width = 192;
  buffer.height = 108;
  const pixels = buffer.getContext('2d', { willReadFrequently: true })!;
  match.addPlayer('pilot', { name: 'Pilot', team: 'A', char: 0, skins: [], bot: true });
  match.addPlayer('opponent', { name: 'Opponent', team: 'B', char: 1, skins: [], bot: true }, new Bot(seed));
  const me = match.player('pilot')!, foe = match.player('opponent')!;
  const nav = navFor(match);
  let generation = seed >>> 0;
  const random = () => (generation = (Math.imul(generation, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  let placed = false;
  for (let attempt = 0; attempt < 300 && !placed; attempt++) {
    const a = nav.nodes[Math.floor(random() * nav.nodes.length)];
    const angle = random() * 2 * Math.PI;
    const b = nav.nearest(a.x + 8 * Math.cos(angle), a.y, a.z + 8 * Math.sin(angle));
    if (!a.links.length || !b?.links.length || Math.abs(a.y - b.y) > .35 ||
        Math.hypot(a.x - b.x, a.z - b.z) < 6 ||
        !lineOfSight(map, [a.x, a.y + map.eye, a.z], [b.x, b.y + map.eye, b.z])) continue;
    Object.assign(me, { x: a.x, y: a.y, z: a.z, yaw: Math.atan2(a.x - b.x, a.z - b.z), pitch: 0 });
    Object.assign(foe, { x: b.x, y: b.y, z: b.z, yaw: Math.atan2(b.x - a.x, b.z - a.z), pitch: 0 });
    placed = true;
  }
  if (!placed) throw new Error('No valid start for visual audition');
  for (const slot of match.slots.values()) slot.spawnProtectedUntilTick = 0;
  match.phase = 'live';
  match.phaseT = seconds * TICK_HZ;
  const cloud = settleSmoke(map, { id: 1, owner: 'opponent', life: SMOKE.life - SMOKE.bloom,
    x: (me.x + foe.x) / 2, y: (me.y + foe.y) / 2, z: (me.z + foe.z) / 2 });
  const renderFrame = (dt: number) => {
    const snapshot = match.snapshot(), rival = snapshot.players.find(p => p.id === 'opponent')!;
    scene.setView(me.x, me.y + playerEye(map, me), me.z, me.yaw, me.pitch);
    scene.syncHeroes(snapshot, me.id, map, me);
    scene.syncShields(snapshot.shields);
    scene.syncGrenades(snapshot.grenades ?? [], snapshot.smokes ?? [], 0);
    scene.syncAvatar(rival, [rival.x, rival.y, rival.z], rival.yaw, rival.pitch, false);
    scene.endAvatars();
    scene.viewmodel.set(me.weapon, 0);
    scene.update(dt);
    scene.render(me.alive);
    return encodeDetailFrame(readArenaCamera(pixels, screen));
  };
  const clear = renderFrame(0);
  match.smokes = [cloud];
  const obscured = renderFrame(0);
  const clearAction = await infer({ luminance: clear, reset: true });
  const smokeAction = await infer({ luminance: obscured, reset: true });
  const before = atob(clear), after = atob(obscured);
  let changedPixels = 0;
  for (let i = 0; i < before.length; i++) {
    const delta = before.charCodeAt(i) ^ after.charCodeAt(i);
    changedPixels += Number((delta & 15) !== 0) + Number((delta >> 4) !== 0);
  }
  if (changedPixels === 0) throw new Error('Rendered smoke and clear probes are identical');
  if (!smoke) match.smokes = [];
  const start = [me.x, me.y, me.z, me.yaw], images = new Set<string>(), latencies: number[] = [];
  let lastLife = -1, actions = 0, appliedTicks = 0;
  while (match.phase === 'live' && match.tick < seconds * TICK_HZ) {
    if (!me.alive) { lastLife = -1; match.step(); continue; }
    const frame = renderFrame(EXPLORATION_TICKS / TICK_HZ);
    images.add(frame);
    const time = performance.now(), reset = lastLife !== me.lifeId;
    const logits = await infer({ luminance: frame, reset });
    latencies.push(performance.now() - time);
    const action = greedyAction([], logits);
    lastLife = me.lifeId;
    actions++;
    for (let i = 0; i < EXPLORATION_TICKS && match.phase === 'live' && me.alive && lastLife === me.lifeId; i++) {
      const input: Input = { seq: match.tick + 1, view: match.tick, yaw: me.yaw, pitch: me.pitch,
        mx: 0, mz: 0, buttons: 0, weapon: me.weaponSlot };
      match.queueInputs(me.id, [applyNeuralAction(input, me, action, i === 0)]);
      match.step();
      appliedTicks++;
    }
  }
  latencies.sort((a, b) => a - b);
  return { map: mapId, smoke, seed, ticks: match.tick, appliedTicks, decisions: actions, distinctFrames: images.size,
    clearVsSmokeChangedPixels: changedPixels, clearVsSmokeMaxLogitDelta: Math.max(...clearAction.map((x, i) => Math.abs(x - smokeAction[i]))),
    bridgeP95Ms: latencies[Math.max(0, Math.ceil(.95 * latencies.length) - 1)], score: match.score,
    start, end: [me.x, me.y, me.z, me.yaw] };
}
