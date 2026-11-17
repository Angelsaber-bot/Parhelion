import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ARENA_HERO, ECHO_HALL_ID, ECHO_RETURN_KEY, createEchoHall, echoHallHref, markEchoDeparture, takeEchoReturn } from '../src/story/echoHall';
import { COMPANIONS } from '../src/companions/contracts';
import { CHARACTERS, PLAYABLE_HERO_INDICES } from '../../arena-game/shared/content';
import { cameFromWorld, heroFromWorld, WORLD_RETURN_HREF } from '../../arena-game/src/worldLink';

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

test('Arena remembers the World link for the tab and points back to the hall; unknown heroes are ignored', () => {
  const tab = memory();
  assert.equal(cameFromWorld(new URLSearchParams('from=world'), tab), true);
  assert.equal(cameFromWorld(new URLSearchParams(''), tab), true);
  assert.equal(cameFromWorld(new URLSearchParams(''), memory()), false);
  assert.equal(heroFromWorld(new URLSearchParams('hero=aster')), null);
  assert.equal(heroFromWorld(new URLSearchParams('hero=nobody')), null);
  assert.equal(new URL(WORLD_RETURN_HREF, 'https://example.test').searchParams.get('from'), 'arena');
});

test('a return lands at the hall only once, and only after leaving through it', () => {
  const tab = memory(), back = new URLSearchParams('from=arena');
  assert.equal(takeEchoReturn(back, tab), false);
  markEchoDeparture(tab); assert.equal(tab.getItem(ECHO_RETURN_KEY), ECHO_HALL_ID);
  assert.equal(takeEchoReturn(back, tab), true);
  assert.equal(takeEchoReturn(back, tab), false);
  markEchoDeparture(tab); assert.equal(takeEchoReturn(new URLSearchParams(''), tab), false);
});

test('the hall saves before leaving, refuses when saving fails, and offers the active servant', () => {
  const shown: { choices: { id: string }[]; pick: (id: string) => void }[] = [], went: string[] = [], toasts: unknown[] = [];
  let saved = true;
  const hall = createEchoHall({
    scene: new THREE.Scene(), prepareDialogue() {}, canInteract: () => true, safe: () => true, toast: l => toasts.push(l),
    dialogue: { showChoices: (_l: unknown, _n: unknown, choices: { id: string }[], pick: (id: string) => void) => shown.push({ choices, pick }) } as never,
    servant: () => 'musashi', servantName: () => ['宫本武藏', 'Miyamoto Musashi'], ground: () => 16, save: () => saved, navigate: h => went.push(h),
  });
  assert.equal(hall.markers[0].id, ECHO_HALL_ID); assert.equal(hall.colliders.length, 1);
  assert.equal(hall.interact('elsewhere'), false);
  assert.equal(hall.interact(ECHO_HALL_ID), true);
  assert.deepEqual(shown[0].choices.map(c => c.id), ['servant', 'free', 'later']);
  saved = false; shown[0].pick('servant'); assert.equal(went.length, 0); assert.equal(toasts.length, 1);
  saved = true; shown[0].pick('servant'); assert.match(went[0], /hero=musashi/);
  shown[0].pick('later'); assert.equal(went.length, 1);
  hall.dispose(); assert.equal(hall.colliders[0].enabled, false);
});

test('main.ts wires the hall into interaction, updates and the return spawn', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /echoHall\?\.interact\(m\.id\)/);
  assert.match(main, /echoHall\?\.update\(dt\)/);
  assert.match(main, /if\(echoReturn\)\{const pose=echoHall\.returnPose\(\)/);
  assert.match(main, /\?\? \(echoReturn \? 'home' : 'alpha'\)/);
});
