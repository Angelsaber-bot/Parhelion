import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ARENA_HERO, ECHO_HALL_ID, ECHO_RETURN_KEY, createEchoHall, echoHallHref, markEchoDeparture, takeEchoReturn } from '../src/story/echoHall';
import { ECHO_DESTINATIONS, echoMarkerId } from '../src/story/echoDestinations';
import { WORLD_REGION_IDS } from '../src/core/regionIdentity';
import { MAPS } from '../../arena-game/shared/arenaMap';
import { regionAt } from '../src/map/regions';
import { COMPANIONS } from '../src/companions/contracts';
import { CHARACTERS, PLAYABLE_HERO_INDICES } from '../../arena-game/shared/content';
import { heroFromWorld, worldReturnHref } from '../../arena-game/src/worldLink';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };

test('every World companion maps to a playable Arena hero, and the hall link preselects it on HOMEWARD', () => {
  for (const c of COMPANIONS) {
    const index = CHARACTERS.findIndex(h => h.id === ARENA_HERO[c.id]);
    assert.ok((PLAYABLE_HERO_INDICES as readonly number[]).includes(index), c.id);
    const url = new URL(echoHallHref(c.id), 'https://example.test');
    assert.equal(url.pathname, '/arena/'); assert.equal(url.searchParams.get('from'), 'world'); assert.equal(url.searchParams.get('map'), 'homeward');
    assert.equal(heroFromWorld(url.searchParams), index);
  }
  assert.equal(new URL(echoHallHref(null), 'https://example.test').searchParams.has('hero'), false);
});

test('Arena offers a return only for the trip in the URL and preserves legacy same-tab links', () => {
  const direct = new URL(echoHallHref('musashi', 'kyoto', false), 'https://example.test');
  assert.equal(worldReturnHref(direct.searchParams), null);
  assert.equal(direct.searchParams.get('map'), 'sakura');
  assert.equal(heroFromWorld(direct.searchParams), CHARACTERS.findIndex(c => c.id === ARENA_HERO.musashi));
  assert.equal(worldReturnHref(new URLSearchParams('from=world')), '/world/?from=arena');
  assert.equal(worldReturnHref(new URLSearchParams('station=home_echo_hall')), null);
  assert.equal(worldReturnHref(new URLSearchParams({ from: 'world', station: '//example.test' })), '/world/?from=arena');
  assert.equal(heroFromWorld(new URLSearchParams('hero=aster')), null);
  assert.equal(heroFromWorld(new URLSearchParams('hero=nobody')), null);
});

test('a return lands at the hall only once, and only after leaving through it', () => {
  const tab = memory(), back = new URLSearchParams('from=arena');
  assert.equal(takeEchoReturn(back, tab), undefined);
  markEchoDeparture(tab); assert.equal(tab.getItem(ECHO_RETURN_KEY), ECHO_HALL_ID);
  assert.equal(takeEchoReturn(back, tab), 'home');
  assert.equal(takeEchoReturn(back, tab), undefined);
  markEchoDeparture(tab); assert.equal(takeEchoReturn(new URLSearchParams(''), tab), undefined);
});

test('the hall saves before leaving, refuses when saving fails, and offers the active servant', () => {
  const shown: { choices: { id: string }[]; pick: (id: string) => void }[] = [], went: string[] = [], toasts: unknown[] = [];
  let saved = true;
  const hall = createEchoHall({
    scene: new THREE.Scene(), prepareDialogue() {}, canInteract: () => true, safe: () => true, toast: l => toasts.push(l),
    dialogue: { showChoices: (_l: unknown, _n: unknown, choices: { id: string }[], pick: (id: string) => void) => shown.push({ choices, pick }) } as never,
    servant: () => 'musashi', servantName: () => ['宫本武藏', 'Miyamoto Musashi'], ground: () => 16, save: () => saved, navigate: h => went.push(h),
  });
  assert.equal(hall.markers[0].id, ECHO_HALL_ID); assert.equal(hall.colliders.length, WORLD_REGION_IDS.length);
  assert.equal(hall.interact('elsewhere'), false);
  assert.equal(hall.interact(ECHO_HALL_ID), true);
  assert.deepEqual(shown[0].choices.map(c => c.id), ['servant', 'free', 'later']);
  saved = false; shown[0].pick('servant'); assert.equal(went.length, 0); assert.equal(toasts.length, 1);
  saved = true; shown[0].pick('servant'); assert.match(went[0], /hero=musashi/);
  shown[0].pick('later'); assert.equal(went.length, 1);
  assert.deepEqual(new Set(Object.values(ECHO_DESTINATIONS).map(d => d.map)), new Set(MAPS.map(m => m.id)));
  for (const region of WORLD_REGION_IDS) {
    const marker = hall.markers.find(m => m.id === echoMarkerId(region))!;
    const pose = hall.returnPose(region)!;
    assert.deepEqual(pose.p.toArray(), marker.p);
    assert.equal(regionAt(pose.p.x,pose.p.z).id,region);
    assert.ok(hall.interact(marker.id));
    shown.at(-1)!.pick('free');
    const link = new URL(went.at(-1)!, 'https://example.test');
    assert.equal(link.searchParams.get('map'), ECHO_DESTINATIONS[region].map);
    assert.equal(link.searchParams.get('from'),'world');
    link.searchParams.set('map', 'aster'); // Choosing a different Arena map cannot move the World return point.
    const roundTrip = new URL(worldReturnHref(link.searchParams)!, 'https://example.test');
    assert.equal(roundTrip.pathname, '/world/');
    assert.equal(takeEchoReturn(roundTrip.searchParams, null), region);
    assert.equal(takeEchoReturn(roundTrip.searchParams, null), region, 'same return after a reload');
    const tab = memory(), back = new URLSearchParams('from=arena');
    markEchoDeparture(tab, region);
    assert.equal(takeEchoReturn(back, tab), region);
    assert.equal(takeEchoReturn(back, tab), undefined);
  }
  hall.dispose(); assert.ok(hall.colliders.every(c => !c.enabled));
});

test('an explicit valid station wins over old tab data, including when storage is blocked', () => {
  const tab = memory();
  markEchoDeparture(tab, 'home');
  const params = new URLSearchParams('from=arena&station=arena_echo_winter');
  assert.equal(takeEchoReturn(params, tab), 'winter');
  assert.equal(tab.getItem(ECHO_RETURN_KEY), null);
  const blocked = { ...tab, getItem: () => { throw new Error('blocked storage'); } };
  assert.equal(takeEchoReturn(params, blocked), 'winter');
  assert.equal(takeEchoReturn(new URLSearchParams('from=arena&station=arena_echo_nowhere'), tab), undefined);
  assert.equal(takeEchoReturn(new URLSearchParams('station=arena_echo_winter'), tab), undefined);
});

test('main.ts wires the hall into interaction, updates and the return spawn', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /echoHall\?\.interact\(m\.id\)/);
  assert.match(main, /echoHall\?\.update\(dt\)/);
  assert.match(main, /echoHall\.returnPose\(echoReturn\)/);
});

test('World boots the return station’s art and collision before play resumes', async () => {
  const out = new URL(echoHallHref('napoleon', 'winter'), 'https://example.test');
  out.searchParams.set('map', 'sakura');
  const destination = worldReturnHref(out.searchParams);
  const h = await bootWorldWithoutGpu({ deterministic: true, streaming: true, bootTimeoutMs: 120_000,
    beforeBoot: window => { window.history.replaceState({}, '', `${destination}&region=home&q=low&nopost`); },
  });
  try {
    const w = h.world, position = w.player.pos, pose = w.echoHall.returnPose('winter');
    assert.equal(regionAt(position.x, position.z).id, 'winter');
    assert.equal(position.x, pose.p.x);
    assert.equal(position.z, pose.p.z);
    assert.equal(w.regionVisuals.ready('winter'), true);
    const floor = w.combat.geometry.ground(position.x, position.z, pose.p.y + 1.25);
    assert.ok(floor && w.combat.geometry.clear(floor.point, .38, 1.8));
    (h.window.document.getElementById('start') as HTMLElement).click();
    await Promise.resolve();
    for (let i = 0; i < 100; i++) h.frame(1000 + i * 1000 / 60);
    assert.equal(w.player.onGround, true);
    assert.ok(Math.abs(position.y - floor.point.y) < .2);
    assert.deepEqual(h.errors, []);
  } finally { await h.close(); }
});
