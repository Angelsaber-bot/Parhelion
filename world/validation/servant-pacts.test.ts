import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MODEL_CLAIM_POINTS } from '../src/companions/modelClaimPoints';
import {
  JEANNE, JEANNE_HEARD, JEANNE_WITNESSES, OZY, OZY_CARVE_SECONDS, OZY_FRAGMENTS, PACT_CLAIM, QIN_PACT, QIN_RELAY_POSTS, QIN_RELAY_SECONDS, QIN_RELAY_START,
  jeannePresent, ozyWarmth, pactAvailable, pactStep, stepRelay,
} from '../src/story/servantPacts';
import { createServantPacts, pactResidentPosition, PACT_FRAGMENT_MARKER } from '../src/story/servantPactRuntime';

const REGION_DONE = ['orleans_campaign_complete', 'egypt_campaign_complete', 'qin_campaign_complete'];
function harness(flags: string[] = REGION_DONE) {
  const done = new Set(flags), shown: { line: [string, string]; choices: { id: string }[]; pick?: (id: string) => void }[] = [], toasts: string[] = [], sealed: string[] = [];
  const me = new THREE.Vector3();
  const pacts = createServantPacts({
    scene: new THREE.Scene(), done, prepareDialogue() {}, toast: l => toasts.push(l[1]), save: () => true, changed() {},
    dialogue: { show: (line: [string, string]) => shown.push({ line, choices: [] }), showChoices: (line: [string, string], _n: unknown, choices: { id: string }[], pick: (id: string) => void) => shown.push({ line, choices, pick }) } as never,
    player: () => me, ground: () => 14, marker: id => (MODEL_CLAIM_POINTS.find(p => p.marker.id === id)?.marker.p as [number, number, number]) ?? null,
    seal: id => { sealed.push(id); done.add(id); }, safe: () => true,
  });
  const last = () => shown[shown.length - 1];
  const goTo = (p: readonly number[] | null) => { assert.ok(p); me.set(p![0], p![1], p![2]); };
  return { done, pacts, shown, last, toasts, sealed, me, goTo };
}

test('each pact waits for its region story; a save that already claimed the servant keeps it', () => {
  const none = new Set<string>();
  for (const id of ['jeanne', 'ozymandias', 'qin'] as const) { assert.equal(pactAvailable(id, none), false); assert.equal(pactStep(id, none)!.target, null); }
  const h = harness([]);
  assert.equal(h.pacts.interact(PACT_CLAIM.jeanne), true); assert.match(h.last().line[1], /Finish the Orleans main story/);
  const old = harness(['servant_claim_qin']);
  assert.equal(old.pacts.interact(PACT_CLAIM.qin), false, 'already contracted: the old travel-with path runs');
  assert.equal(pactStep('qin', old.done), null);
});

test('Jeanne: question witnesses in any order, then win the hearing by presenting the right testimonies', () => {
  const h = harness();
  h.pacts.interact(PACT_CLAIM.jeanne); h.last().pick!('take'); assert.ok(h.done.has(JEANNE.open));
  // Four witnesses in an order of the player's choosing; Mathieu's honest-but-irrelevant card is among them.
  for (const w of [JEANNE_WITNESSES[4], JEANNE_WITNESSES[2], JEANNE_WITNESSES[0], JEANNE_WITNESSES[1]]) {
    assert.equal(h.pacts.talk(w.npc, ['', '']), true); h.last().pick!('ask'); assert.ok(h.done.has(JEANNE_HEARD(w)));
  }
  assert.equal(h.pacts.talk(JEANNE_WITNESSES[0].npc, ['', '']), false, 'a witness already heard just talks normally');
  h.goTo(MODEL_CLAIM_POINTS.find(p => p.id === 'jeanne')!.marker.p);
  h.pacts.interact(PACT_CLAIM.jeanne);
  assert.deepEqual(h.last().choices.map(c => c.id).sort(), ['adjourn', 'bell', 'clerk', 'grange', 'warden']);
  h.last().pick!('grange'); assert.match(h.last().line[1], /does not answer this charge/); assert.ok(h.done.has(JEANNE.miss));
  h.last().pick!('warden'); h.last().pick!('bell'); h.last().pick!('clerk');
  assert.deepEqual(h.sealed, [PACT_CLAIM.jeanne]); assert.ok(h.done.has(JEANNE.sealed));
  assert.match(h.last().line[1], /presented the wrong testimony once/);
});

test('Jeanne: an unheard card cannot be presented and the hearing needs four witnesses', () => {
  const d = new Set([...REGION_DONE, JEANNE.open, ...JEANNE_WITNESSES.slice(0, 3).map(JEANNE_HEARD)]);
  assert.equal(jeannePresent('warden', d), 'closed');
  d.add(JEANNE_HEARD(JEANNE_WITNESSES[4]));
  assert.equal(jeannePresent('cloth', d), 'unheard');
  assert.equal(jeannePresent('warden', d), 'won');
});

test('Ozymandias: hidden fragments, a sense of sunlight, a carving you must stay for, then an answer', () => {
  const h = harness();
  for (const f of OZY_FRAGMENTS) assert.equal(h.pacts.ready(PACT_FRAGMENT_MARKER(f.id)), false, 'nothing to find before the audience');
  h.pacts.interact(PACT_CLAIM.ozymandias); h.last().pick!('take');
  assert.equal(pactStep('ozymandias', h.done)!.target, null, 'no waypoint during the hunt');
  assert.equal(ozyWarmth(200), 0); assert.ok(ozyWarmth(20) > ozyWarmth(100)); assert.equal(ozyWarmth(0), 1);
  for (const f of OZY_FRAGMENTS) {
    const marker = h.pacts.markers.find(m => m.id === PACT_FRAGMENT_MARKER(f.id))!;
    const resident = pactResidentPosition(f.near)!;
    assert.ok(Math.hypot(marker.p[0] - resident[0], marker.p[2] - resident[2]) < 4, `${f.id} lies beside ${f.near}`);
    assert.equal(h.pacts.ready(marker.id), true); h.pacts.interact(marker.id); assert.ok(h.done.has(f.flag));
    assert.equal(h.pacts.ready(marker.id), false);
  }
  const claim = MODEL_CLAIM_POINTS.find(p => p.id === 'ozymandias')!.marker.p;
  h.goTo(claim); h.pacts.interact(PACT_CLAIM.ozymandias); h.last().pick!('carve');
  h.pacts.update(OZY_CARVE_SECONDS / 2); h.goTo([claim[0] + 20, claim[1], claim[2]]); h.pacts.update(.1);
  assert.equal(h.done.has(OZY.carved), false, 'walking away stops the carving');
  h.goTo(claim); h.pacts.interact(PACT_CLAIM.ozymandias); h.last().pick!('carve');
  for (let t = 0; t < OZY_CARVE_SECONDS + .5; t += .25) h.pacts.update(.25);
  assert.ok(h.done.has(OZY.carved));
  h.pacts.interact(PACT_CLAIM.ozymandias); assert.deepEqual(h.last().choices.map(c => c.id), ['kneel', 'stand']);
  h.last().pick!('stand'); assert.ok(h.done.has(OZY.stood)); assert.deepEqual(h.sealed, [PACT_CLAIM.ozymandias]);
});

test('Qin: the edict must pass five posts in order before the shadow moves; late means a fresh start', () => {
  const run0 = { started: 0, next: 0, finished: false, failed: false };
  assert.equal(stepRelay(run0, 1, 3, 99).next, 1);
  assert.equal(stepRelay(run0, 1, 30, 1).next, 0, 'the end does not count before the posts');
  assert.equal(stepRelay(run0, QIN_RELAY_SECONDS + .1, 1, 1).failed, true);
  const h = harness();
  h.pacts.interact(PACT_CLAIM.qin); h.last().pick!('take'); assert.ok(h.done.has(QIN_PACT.open));
  // A slow run: the shadow passes the mark.
  h.pacts.talk(QIN_RELAY_START, ['', '']); h.last().pick!('go');
  h.goTo(pactResidentPosition(QIN_RELAY_POSTS[0].npc)); h.pacts.update(.1); assert.equal(h.pacts.relay!.next, 1);
  h.pacts.update(QIN_RELAY_SECONDS); assert.equal(h.pacts.relay!.failed, true); assert.equal(h.done.has(QIN_PACT.delivered), false);
  // A good run.
  h.pacts.talk(QIN_RELAY_START, ['', '']); h.last().pick!('go');
  for (const post of QIN_RELAY_POSTS) { h.goTo(pactResidentPosition(post.npc)); h.pacts.update(5); }
  h.goTo(MODEL_CLAIM_POINTS.find(p => p.id === 'qinShiHuang')!.marker.p); h.pacts.update(5);
  assert.ok(h.done.has(QIN_PACT.delivered));
  h.pacts.interact(PACT_CLAIM.qin); assert.deepEqual(h.sealed, [PACT_CLAIM.qin]); assert.ok(h.done.has(QIN_PACT.sealed));
});

test('the three arcs are on the main line of the quest guide and the World wires every hook', () => {
  const catalog = readFileSync(new URL('../src/story/questGuideCatalog.ts', import.meta.url), 'utf8');
  assert.match(catalog, /id:`main:pact-\$\{pact\}`[^}]*category:'main'/s);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  for (const hook of [/servantPacts\?\.interact\(m\.id\)/, /servantPacts\?\.talk\(npc\.id,npc\.role\)/, /servantPacts\?\.update\(dt\)/, /servantPacts\?\.label\(marker\.id\)/, /servantPacts\?\.owns\(m\.id\)&&!servantPacts\.ready\(m\.id\)/, /servantPacts\?\.interrupt\(\)/])
    assert.match(main, hook);
});
