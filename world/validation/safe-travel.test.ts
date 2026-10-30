import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeTravelStops, isTravelStopDiscovered, discoverTravelStops, getTravelBlock, planSafeTravel, TRAVEL_BLOCK_TEXT, type TravelContext } from '../src/safeTravel';
import type { SettlementPlacement, RegionId } from '../src/settlements/types';
import { ERA_OPTIONALS } from '../src/eraStories';

const regions: RegionId[] = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'];
const placements: SettlementPlacement[] = regions.map((id, index) => ({ id, name: [id, id], position: [index * 100, 10, 0], entry: [index * 100, 10, 15], footprint: [30,30], groundRange: 0 }));
const stops = createSafeTravelStops(placements);
const safe: TravelContext = { sessionReady: true, defeated: false, combatActive: false, threatened: false, quietSeconds: 5, flying: false, gliding: false, swimming: false, onGround: true, mounted: false, actionActive: false };

test('destinations come only from validated runtime settlement entrances and are copied', () => {
  assert.equal(stops.length, 5);
  assert.deepEqual(stops[0].position, placements[0].entry);
  const copy = createSafeTravelStops(placements); copy[0].position[0] = 999;
  assert.equal(placements[0].entry[0], 0);
  assert.throws(() => createSafeTravelStops([placements[0], placements[0]]), /Invalid travel/);
  assert.throws(() => createSafeTravelStops([{ ...placements[0], entry: [NaN,0,0] }]), /Invalid travel/);
  assert.throws(() => createSafeTravelStops([{ ...placements[0], id: 'arbitrary_map_point' as RegionId }]), /Invalid travel/);
});

test('only grounded nearby presence discovers a stop, once, in existing found set', () => {
  const found = new Set<string>();
  assert.deepEqual(discoverTravelStops(stops, [0,10,15], safe, found), ['travel_alpha']);
  assert.deepEqual(discoverTravelStops(stops, [0,10,15], safe, found), []);
  assert.equal(found.size, 1);
  for (const context of [{...safe, flying:true}, {...safe, gliding:true}, {...safe, swimming:true}, {...safe, onGround:false}, {...safe, defeated:true}, {...safe, sessionReady:false}]) {
    assert.deepEqual(discoverTravelStops(stops, [100,10,15], context, found), []);
  }
  for (const position of [[100,20,15], [100,10,50], [NaN,10,15], [100,10]]) assert.deepEqual(discoverTravelStops(stops, position, safe, found), []);
  assert.equal(found.has('travel_britain'), false);
  assert.deepEqual(discoverTravelStops(stops, [100,10,15], safe, found), ['travel_britain']);
});

test('legacy physical visits restore discovered hubs but cores and generic area exploration do not', () => {
  for (const stop of stops) {
    assert.equal(isTravelStopDiscovered(stop, new Set(), new Set()), false);
    assert.equal(isTravelStopDiscovered(stop, new Set(['sun_core','sea_core','winter_core','fire_core','summon_circle','hq_terminal']), new Set(['disc_camlann_hill','disc_flagship'])), false);
    if (stop.region === 'alpha') assert.equal(isTravelStopDiscovered(stop, new Set(['valley_story_met']), new Set()), true);
    else {
      assert.equal(isTravelStopDiscovered(stop, new Set([`era_${stop.region}_met`]), new Set()), true);
      assert.equal(isTravelStopDiscovered(stop, new Set([ERA_OPTIONALS[stop.region].id]), new Set()), true);
    }
  }
});

test('travel rejects battle, pursuit, unsafe locomotion, death, active actions and undiscovered regions', () => {
  const done = new Set(['summon_circle']), found = new Set(stops.map(stop => stop.foundFlag));
  const cases: [Partial<TravelContext>, string][] = [
    [{sessionReady:false},'unavailable'], [{defeated:true},'defeated'], [{combatActive:true},'combat'], [{threatened:true},'combat'],
    [{quietSeconds:4.99},'combat'], [{quietSeconds:NaN},'combat'], [{flying:true},'flying'], [{gliding:true},'airborne'],
    [{onGround:false},'airborne'], [{swimming:true},'swimming'], [{mounted:true},'busy'], [{actionActive:true},'busy'],
  ];
  for (const [patch, expected] of cases) assert.equal(getTravelBlock('travel_britain', stops, done, found, {...safe,...patch}), expected);
  assert.equal(getTravelBlock('travel_britain', stops, done, new Set(), safe), 'undiscovered');
  assert.equal(getTravelBlock('travel_britain', stops, new Set(), found, safe), 'seam-locked');
  assert.equal(getTravelBlock('travel_alpha', stops, new Set(), found, safe), null, 'returning home never opens a locked era seam');
  assert.equal(getTravelBlock('boss_core', stops, done, found, safe), 'unknown');
  assert.ok(Object.values(TRAVEL_BLOCK_TEXT).every(pair => pair.every(line => line.length > 5)));
});

test('selection is rechecked at execution, does not mutate progress, and reset relocks destinations', () => {
  const done = new Set(['summon_circle']), found = new Set(['travel_britain']);
  const snapshot = [[...done], [...found]];
  const plan = planSafeTravel('travel_britain', stops, done, found, safe);
  assert.equal(plan.ok, true);
  if (plan.ok) { assert.deepEqual(plan.position, placements[1].entry); plan.position[0] = 999; }
  assert.equal(stops[1].position[0], 100, 'plan owns its destination vector');
  assert.deepEqual([[...done], [...found]], snapshot);
  assert.deepEqual(planSafeTravel('travel_britain', stops, done, found, {...safe,threatened:true}), {ok:false,reason:'combat'});
  done.clear(); found.clear();
  assert.equal(planSafeTravel('travel_britain', stops, done, found, safe).ok, false);
});
