import { afterEach, expect, it, vi } from 'vitest';
import { buildMap } from '../shared/map.ts';
import { HUMAN_FEATURES } from '../shared/humanCombat.ts';
import { SCENE_DEPTH_OFFSET } from '../shared/exploration.ts';
import { getMap } from '../shared/arenaMap.ts';
import { botGunRecoil, recoverRecoil, shotRecoil } from '../shared/aimRecoil.ts';
import { neuralBotControl } from '../shared/botNeuralControl.ts';
import { Match } from '../shared/match.ts';
import { BTN, type Input } from '../shared/sim.ts';
import { ArenaRoom } from '../server/ArenaRoom.ts';
import { bundledOpponent, learnedOpponent } from '../shared/learnedOpponent.ts';
import { createNeuralPolicy, NEURAL_FEATURE_COUNT, NEURAL_OUTPUT_COUNT, parseNeuralPolicy, type NeuralPolicyModel } from '../shared/neuralPolicy.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { LOCAL_TRAINER, PUBLIC_TRAINER, releasedBotPolicies } from '../shared/releasedBotPolicy.ts';
import { releaseUrl } from '../src/network/training.ts';
import { startOffline } from '../src/network/session.ts';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function fixture(): NeuralPolicyModel {
  const width = 4, context = 3;
  const linear = (rows: number, cols: number, seed: number) => ({
    weight: Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => Math.sin(2 + seed + (row + 1) * .71 + (col + 1) * .43) * .31)),
    bias: Array.from({ length: rows }, (_, i) => Math.cos(seed + i * 1.3) * .11),
  });
  const norm = (seed: number) => ({
    weight: Array.from({ length: width }, (_, i) => 1 + Math.sin(seed + i * 1.1) * .28),
    bias: Array.from({ length: width }, (_, i) => Math.cos(seed + i * .97) * .16),
  });
  return {
    version: 1, rulesVersion: RULES_VERSION, context, width, heads: 2,
    embed: linear(width, NEURAL_FEATURE_COUNT, 0),
    position: Array.from({ length: context }, (_, t) => Array.from({ length: width }, (_, i) => Math.sin(t * .88 + i * .61) * .35)),
    layers: Array.from({ length: 2 }, (_, i) => ({
      norm1: norm(i * 7 + .4), qkv: linear(width * 3, width, i * 7 + 1), attn: linear(width, width, i * 7 + 2),
      norm2: norm(i * 7 + 3), up: linear(5, width, i * 7 + 4), down: linear(width, 5, i * 7 + 5),
    })),
    norm: norm(16),
    out: linear(NEURAL_OUTPUT_COUNT, width, 17),
  };
}

it('rejects models that cannot run on this version of the game', () => {
  const model = fixture();
  expect(parseNeuralPolicy(model)).toEqual(model);
  const option = { ...model, version: 2, controller: 'perceptual-options-v1' };
  expect(parseNeuralPolicy(option)).toEqual(option);
  const smokeSearch = { ...model, version: 3, controller: 'perceptual-options-v2' };
  expect(parseNeuralPolicy(smokeSearch)).toEqual(smokeSearch);
  const direct = { ...model, version: 4, controller: 'learned-input-v1' };
  expect(parseNeuralPolicy(direct)).toEqual(direct);
  expect(parseNeuralPolicy({ ...direct, version: 3 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...smokeSearch, version: 4 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...option, version: 3 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...smokeSearch, version: 2 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...smokeSearch, controller: undefined })).toBeUndefined();
  expect(parseNeuralPolicy({ ...option, version: 1 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...option, controller: undefined })).toBeUndefined();
  expect(parseNeuralPolicy({ ...option, controller: 'unknown' })).toBeUndefined();
  expect(parseNeuralPolicy({ ...model, rulesVersion: RULES_VERSION - 1 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...model, synthetic: true })?.synthetic).toBe(true);
  expect(parseNeuralPolicy({ ...model, synthetic: 'true' })).toBeUndefined();
  expect(parseNeuralPolicy({ ...model, heads: 3 })).toBeUndefined();
  expect(parseNeuralPolicy({ ...model, context: 17 })).toBeUndefined();
  const gigantic = { ...model, width: 128, context: 16, layers: Array.from({ length: 6 }, () => ({ up: { bias: Array(512).fill(0) } })) };
  expect(parseNeuralPolicy(gigantic)).toBeUndefined();
  const nonFinite = fixture();
  nonFinite.layers[0].qkv.weight[0][0] = Infinity;
  expect(parseNeuralPolicy(nonFinite)).toBeUndefined();
  const malformed = fixture();
  malformed.layers[0].down.weight[0].pop();
  expect(parseNeuralPolicy(malformed)).toBeUndefined();
});

it('uses the learned inputs throughout visible contact and loss of sight in v4', () => {
  const match = new Match(getMap('aster'), '1v1');
  match.addPlayer('pilot', { name: 'pilot', team: 'A', char: 0, bot: true, skins: [] });
  match.addPlayer('target', { name: 'target', team: 'B', char: 0, bot: true, skins: [] });
  const me = match.player('pilot')!, target = match.player('target')!;
  Object.assign(me, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  Object.assign(target, { x: 0, y: 0, z: -1 });
  vi.spyOn(match.heroes, 'visible').mockReturnValue(true);
  const model = fixture();
  // A constant output layer makes the real inference pipeline reproducible.
  model.out.weight.forEach(row => row.fill(0));
  model.out.bias.fill(-1);
  model.out.bias.fill(0, 0, 4);
  model.out.bias[11] = 1;
  const actor = neuralBotControl({ ...model, version: 4, controller: 'learned-input-v1' });
  for (let tick = 1; tick <= 64; tick++) {
    match.tick = tick;
    if (tick === 41) target.alive = false;
    const input: Input = { seq: tick, view: tick, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0 };
    const result = actor.apply(match, me, input);
    expect([result.mx, result.mz, result.yaw, result.pitch, result.buttons & BTN.FIRE, result.weapon]).toEqual([0, 0, 0, 0, 0, 0]);
  }
  model.out.bias[0] = .4;
  model.out.bias[4] = 1;
  const moving = neuralBotControl({ ...model, version: 4, controller: 'learned-input-v1' });
  const result = moving.apply(match, me, { seq: 65, view: 65, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: 0, weapon: 0 });
  expect(result.yaw).toBeGreaterThan(0);
  expect(result.buttons & BTN.FIRE).toBe(BTN.FIRE);
});

it('observes only visible smoke at three quantized depths without locating occluded opponents', () => {
  const empty = buildMap({ ...getMap('aster').data, objects: [] });
  const wall = buildMap({ ...empty.data, objects: [{ id: 'wall', type: 'box', position: [0, 2, -2], size: [15, 4, .4], material: 'stone', role: 'wall', collision: true }] });
  const smoke = { id: 1, owner: 'unknown', x: 0, y: 0, z: -6, life: 155, box: { yaw: 0, width: 4, height: 3, depth: 2 } };
  const shield = { id: 1, owner: 'unknown', team: 'A' as const, x: 0, y: 0, z: -2, yaw: 0, life: 100, hp: 100 };
  function perceive(map = empty, clouds = [smoke], targetX = 0, yaw = 0, legacy = false, shields: Match['shields'] = []) {
    const match = new Match(map, '1v1');
    match.addPlayer('pilot', { name: 'pilot', team: 'A', char: 0, bot: true, skins: [] });
    match.addPlayer('target', { name: 'target', team: 'B', char: 0, bot: true, skins: [] });
    const me = match.player('pilot')!, enemy = match.player('target')!;
    Object.assign(me, { x: 0, y: 0, z: 0, yaw, pitch: 0 });
    Object.assign(enemy, { x: targetX, y: 0, z: -10 });
    match.smokes = clouds; match.shields = shields;
    const model = fixture();
    const actor = legacy ? model : { ...model, version: 4 as const, controller: 'learned-input-v1' as const };
    let observed: number[] = [];
    neuralBotControl(actor, values => {
      observed = values;
      return { axes: [0, 0, 0, 0], buttons: 0, weapon: 0 };
    }).apply(match, me, { seq: 0, view: 0, mx: 0, mz: 0, yaw, pitch: 0, buttons: 0, weapon: 0 });
    return observed;
  }
  const center = HUMAN_FEATURES.length + SCENE_DEPTH_OFFSET + 1;
  expect(perceive()[0]).toBe(0);
  expect(perceive()[center]).toBe(-3 / 8);
  expect(perceive(empty, [smoke], .7)).toEqual(perceive());
  expect(perceive(empty, [], 0, 0, true)).toEqual(perceive(empty, []));
  expect(perceive(empty, [smoke], 0, 0, true)[center]).toBe(1);
  expect(perceive(wall, [smoke])).toEqual(perceive(wall, []));
  expect(perceive(empty, [smoke], 0, Math.PI)).toEqual(perceive(empty, [], 0, Math.PI));
  expect(perceive(empty, [smoke], 0, 0, false, [shield])).toEqual(perceive(empty, [], 0, 0, false, [shield]));
});

it('applies the shared shot recoil only when the bot actually consumed ammunition', () => {
  const match = new Match(getMap('aster'), '1v1');
  match.addPlayer('pilot', { name: 'pilot', team: 'A', char: 0, bot: true, skins: [] });
  const me = match.player('pilot')!, recoil = botGunRecoil();
  const tick = () => {
    const input: Input = { seq: 1, view: 1, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.FIRE, weapon: 0 };
    recoil(me, input); return input;
  };
  expect(tick().pitch).toBe(0);
  expect(tick().pitch).toBe(0);
  me.ammo[me.weapon]--;
  const shot = tick();
  const min = shotRecoil(me.weapon, () => 0), max = shotRecoil(me.weapon, () => 1);
  expect(shot.pitch).toBeGreaterThanOrEqual(min.pitch - recoverRecoil(min.debt, 1 / 60));
  expect(shot.pitch).toBeLessThanOrEqual(max.pitch);
  expect(tick().pitch).toBeLessThan(0);
  me.lifeId++;
  expect(tick().pitch).toBe(0);
});

it('executes causal attention with fixed positions, left padding and rolling history', () => {
  const policy = createNeuralPolicy(fixture());
  const observations = Array.from({ length: 5 }, (_, t) => Array.from({ length: NEURAL_FEATURE_COUNT }, (_, i) => Math.cos(t * .82 + i * .37) * .9));
  // Independent matrix reference for both trained-style blocks, showing the first four outputs.
  const expected = [
    [-0.11392451001021626,-0.29719116856880773,-0.4289214638019359,-0.43234649301016886],
    [0.07591442448080114,0.42587790232376654,0.477935635852659,0.2200361387959973],
    [0.08278818861416727,0.4843127753942888,0.5596914316493499,0.28560222307242583],
    [0.07995441463196275,0.4892288366031242,0.5699815124331874,0.2962933717982404],
    [0.06594583717672402,0.46468696452850405,0.5467668495947702,0.285625013351602]
  ];
  const output = observations.map(features => policy.think(features));
  for (let step = 0; step < expected.length; step++) {
    expect(output[step]).toHaveLength(NEURAL_OUTPUT_COUNT);
    for (let i = 0; i < expected[step].length; i++) expect(output[step][i]).toBeCloseTo(expected[step][i], 9);
  }
  expect(() => policy.think([1])).toThrow(/Arena observations/);
  policy.reset();
  expect(policy.think(observations[0])).toEqual(output[0]);
});

it('uses the promoted policy service on public, LAN and loopback games unless local development is selected', () => {
  expect(releaseUrl('localhost', '')).toBe(PUBLIC_TRAINER);
  expect(releaseUrl('192.168.1.123', '')).toBe(PUBLIC_TRAINER);
  expect(releaseUrl('parhelion-game.pages.dev', '?trainer=local')).toBe(PUBLIC_TRAINER);
  expect(releaseUrl('[::1]', '?trainer=local')).toBe(LOCAL_TRAINER);
});

it('shares concurrent downloads, retains a vetted release on outages, and honors withdrawal', async () => {
  const model = fixture();
  const fetcher = vi.fn((url: string) => Promise.resolve(Response.json(url.endsWith('/neural') ? model : null)));
  vi.stubGlobal('fetch', fetcher);
  const releases = releasedBotPolicies(PUBLIC_TRAINER);
  const refreshing = releases.refresh();
  const [first, concurrent] = await Promise.all([releases.forMatch(refreshing), releases.forMatch()]);
  expect(first).toBe(concurrent);
  expect(first.neural).toEqual(model);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([PUBLIC_TRAINER + '/neural']);
  fetcher.mockRejectedValue(new Error('Offline'));
  const disconnected = await releases.forMatch();
  expect(disconnected.neural).toBe(first.neural);
  fetcher.mockImplementation(async url => Response.json(url.endsWith('/neural') ? { ...model, version: 999 } : null));
  const newerServer = await releases.forMatch();
  expect(newerServer.neural).toBe(first.neural);
  fetcher.mockImplementation(async url => url.endsWith('/neural') ? new Response(null, { status: 404 }) : Response.json(null));
  expect(await releases.forMatch()).toEqual({ neural: undefined });
  expect(first.neural).toEqual(model);
  fetcher.mockImplementation(async () => Response.json({ ...model, synthetic: true }));
  expect((await releases.forMatch()).neural).toBeUndefined();
});

it('starts a fresh offline match on time and makes a slow release available to the following match', async () => {
  vi.useFakeTimers();
  let settle!: (response: Response) => void;
  const transfer = new Promise<Response>(resolve => { settle = resolve; });
  vi.stubGlobal('fetch', (url: string) => url.endsWith('/neural') ? transfer : Promise.resolve(Response.json(null)));
  const releases = releasedBotPolicies(PUBLIC_TRAINER);
  const refreshing = releases.refresh(), match = releases.forMatch(refreshing);
  await vi.advanceTimersByTimeAsync(1500);
  const fallback = await match;
  expect(fallback.neural).toBeUndefined();
  settle(Response.json(fixture()));
  await refreshing;
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Disconnected')));
  expect((await releases.forMatch()).neural).toEqual(fixture());
  expect(fallback.neural).toBeUndefined();
});

it('applies the same promoted action in an offline match and a Colyseus bot-fill room', async () => {
  const model = fixture();
  model.out.weight.forEach(row => row.fill(0));
  model.out.bias.fill(0);
  model.out.bias[2] = 1.2;
  model.out.bias[3] = -.7;
  const fetcher = vi.fn(async (url: string) => Response.json(url.endsWith('/neural') ? model : null));
  vi.stubGlobal('fetch', fetcher);

  const options = { layout: '1v1', team: 'A', name: 'Player', char: 0, skins: [] } as const;
  const room = new ArenaRoom();
  vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room, 'setSimulationInterval').mockImplementation(() => {});
  room.onCreate({ layout: '1v1' });
  expect(fetcher).not.toHaveBeenCalled();
  const botRoom = new ArenaRoom();
  vi.spyOn(botRoom, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(botRoom, 'setSimulationInterval').mockImplementation(() => {});
  await botRoom.onCreate({ layout: '1v1', bots: true });
  const policies = await releasedBotPolicies(PUBLIC_TRAINER).forMatch();
  const offline = startOffline({ ...options, skins: [] }, 'normal', Math.random, undefined, policies.neural);
  try {
    offline.setPaused(true);
    for (const match of [botRoom.match, offline.match!]) {
      match.phase = 'live';
      const bot = [...match.slots.values()].find(slot => slot.info.bot)!;
      const action = bot.controller!.think(match, bot.state.id);
      expect(action.mx).toBeCloseTo(Math.tanh(1.2), 9);
      expect(action.mz).toBeCloseTo(Math.tanh(-.7), 9);
    }
  } finally { offline.close(); }
});


it('uses the bundled learned actions on cold start, an old assisted release, or a synthetic model', async () => {
  const legacy = { ...fixture(), version: 3 as const, controller: 'perceptual-options-v2' as const };
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json(legacy)));
  expect((await releasedBotPolicies(PUBLIC_TRAINER).forMatch()).neural).toBeUndefined();
  const match = new Match(getMap('aster'), '1v1');
  match.addPlayer('pilot', { name: 'pilot', team: 'A', char: 2, skins: [], bot: true });
  match.phase = 'live';
  const reference = learnedOpponent(bundledOpponent);
  const alternatives = [undefined, legacy, { ...fixture(), synthetic: true as const }].map(learnedOpponent);
  for (match.tick = 1; match.tick < 39; match.tick++) {
    const expected = reference.think(match,'pilot');
    for (const driver of alternatives) expect(driver.think(match,'pilot')).toEqual(expected);
  }
});
