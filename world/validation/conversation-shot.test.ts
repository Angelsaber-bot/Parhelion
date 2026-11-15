import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CONVERSATION_SHOT, conversationShot, type ShotCast } from '../src/player/conversationShot';
import { createSettlementNpcs, NPC_ATTEND } from '../src/settlements/npcs';
import type { PlacedNpcSocket } from '../src/settlements/types';

const open: ShotCast = () => null;
const player = new THREE.Vector3(0, 1.55, 0), speaker = new THREE.Vector3(0, 1.5, -2);

test('the two-shot sits behind and beside the protagonist and looks between the two heads, nearer the speaker', () => {
  const shot = conversationShot(player, speaker, new THREE.Vector3(.45, 1.6, 3), open)!;
  assert.ok(shot, 'open ground always frames');
  assert.equal(shot.side, 1, 'stays on the side the camera is already on');
  assert.ok(Math.abs(shot.position.z - CONVERSATION_SHOT.back) < 1e-6 && Math.abs(shot.position.x - CONVERSATION_SHOT.side) < 1e-6, 'behind along the line to the speaker, out to the right');
  assert.ok(shot.position.y > player.y, 'slightly above the shoulder');
  assert.ok(Math.abs(shot.target.z - -2 * CONVERSATION_SHOT.bias) < 1e-6 && CONVERSATION_SHOT.bias > .5, 'looks nearer the speaker than the protagonist');
  // Both heads on screen, on opposite sides of the view axis: the protagonist never hides the speaker.
  const forward = shot.target.clone().sub(shot.position).setY(0).normalize(), right = new THREE.Vector3(-forward.z, 0, forward.x);
  const lateral = (p: THREE.Vector3) => p.clone().sub(shot.position).dot(right) / p.clone().sub(shot.position).dot(forward);
  assert.ok(lateral(player) < -.25 && lateral(speaker) > 0, `protagonist ${lateral(player).toFixed(2)} left, speaker ${lateral(speaker).toFixed(2)} right of centre`);
  const left = conversationShot(player, speaker, new THREE.Vector3(-2, 1.6, 3), open)!;
  assert.equal(left.side, -1); assert.ok(left.position.x < 0, 'a camera already on the left stays left');
});

test('a wall on the preferred side sends the camera to the other; no room or no sight line leaves the view alone', () => {
  // A wall along x = +0.6: the right-hand arm is cut short, the left is free.
  const wallRight: ShotCast = (from, dir, max) => { if (dir.x <= 0 || from.x >= .6) return null; const t = (.6 - from.x) / dir.x; return t <= max ? t : null; };
  const shot = conversationShot(player, speaker, new THREE.Vector3(1, 1.6, 2), wallRight)!;
  assert.equal(shot.side, -1, 'falls back to the open side');
  // A corridor: both arms blocked close to the head.
  const corridor: ShotCast = (from, dir, max) => { if (Math.abs(dir.x) < 1e-6) return null; const t = (.6 - Math.abs(from.x)) / Math.abs(dir.x); return t >= 0 && t <= max ? t : null; };
  assert.equal(conversationShot(player, speaker, new THREE.Vector3(1, 1.6, 2), corridor), null);
  // Arms fine, but something stands between each camera spot and the speaker (a pillar by their head).
  const pillar: ShotCast = (from, _dir, max) => from.distanceTo(player) > .5 ? Math.min(max, .4) : null;
  assert.equal(conversationShot(player, speaker, new THREE.Vector3(1, 1.6, 2), pillar), null);
  // A long arm trimmed by a far wall keeps a usable, shorter shot.
  const farWall: ShotCast = (from, _dir, max) => from.equals(player) && max > 1.5 ? 1.5 : null;
  const trimmed = conversationShot(player, speaker, new THREE.Vector3(1, 1.6, 2), farWall)!;
  assert.ok(trimmed && Math.abs(trimmed.position.distanceTo(player) - (1.5 - CONVERSATION_SHOT.skin)) < 1e-6);
});

test('only for two people standing a conversation apart', () => {
  assert.equal(conversationShot(player, new THREE.Vector3(0, 1.5, -.2), new THREE.Vector3(1, 1.6, 2), open), null, 'standing inside each other');
  assert.equal(conversationShot(player, new THREE.Vector3(0, 1.5, -(CONVERSATION_SHOT.reach + 1)), new THREE.Vector3(1, 1.6, 2), open), null, 'across the square');
  assert.equal(conversationShot(player, new THREE.Vector3(NaN, 1.5, -2), new THREE.Vector3(1, 1.6, 2), open), null);
  assert.ok(CONVERSATION_SHOT.fov < 75 && CONVERSATION_SHOT.fov >= 50, 'narrows the view a little, never a telephoto');
});

const npc = (id = 'clerk'): PlacedNpcSocket => ({ id, region: 'alpha', role: ['记录员', 'Clerk'], position: [0, 0, 0], yaw: 0, lines: [['你好。', 'Hello.']] });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('the resident you talk to turns their whole body to you, then back to their work', () => {
  const system = createSettlementNpcs([npc()]), person = system.group.children[0], behind = new THREE.Vector3(1.2, 0, -1.6);
  for (let i = 0; i < 30; i++) system.update(.05, behind);
  assert.equal(person.rotation.y, 0, 'no turn without a conversation: only the head follows');
  system.setAttending('clerk');
  for (let i = 0; i < 40; i++) system.update(.05, behind);
  const facing = Math.atan2(behind.x, behind.z);
  assert.ok(Math.abs(wrap(person.rotation.y - facing)) < .02, `faces the player (${person.rotation.y.toFixed(2)} vs ${facing.toFixed(2)})`);
  system.setAttending(null);
  system.update(.05, behind); assert.ok(Math.abs(wrap(person.rotation.y - facing)) > .01 && Math.abs(person.rotation.y) > .5, 'eases back, no snap');
  for (let i = 0; i < 80; i++) system.update(.05, behind);
  assert.equal(person.rotation.y, 0, 'ends exactly where they stood');
  system.setAttending('nobody'); system.update(.05, behind); assert.equal(person.rotation.y, 0, 'unknown ids are ignored');
  assert.ok(NPC_ATTEND.turn > NPC_ATTEND.settle, 'turns to you promptly, returns unhurried');
  system.dispose();
});

test('a patrol or scene that re-poses a resident takes over at once; distance and pauses never spin them', () => {
  const system = createSettlementNpcs([npc()]), person = system.group.children[0], side = new THREE.Vector3(1.5, 0, 0);
  system.setAttending('clerk'); for (let i = 0; i < 40; i++) system.update(.05, side);
  system.setAttending(null); system.update(.05, side);
  system.pose('clerk', [0, 0, 0], 2.5); // the patrol resumes with its own heading
  for (let i = 0; i < 40; i++) system.update(.05, side);
  assert.equal(person.rotation.y, 2.5, 'the return never fights the new heading');
  // A walker that re-poses with the yaw it reads back (as the resident patrols do) cannot accumulate a spin.
  system.setAttending('clerk');
  for (let i = 0; i < 60; i++) { system.update(.05, side); system.pose('clerk', [0, 0, 0], person.rotation.y); }
  assert.ok(Math.abs(wrap(person.rotation.y - Math.PI / 2)) < .02, 'settles facing the player');
  // Paused frames change nothing, and a player across the square is not being talked to.
  const before = person.rotation.y; system.update(0, new THREE.Vector3(-1, 0, -1)); assert.equal(person.rotation.y, before);
  const far = createSettlementNpcs([npc()]), other = far.group.children[0]; far.setAttending('clerk');
  for (let i = 0; i < 20; i++) far.update(.05, new THREE.Vector3(NPC_ATTEND.reach + 2, 0, 0));
  assert.equal(other.rotation.y, 0);
  system.dispose(); far.dispose();
});

test('wiring: the talk shot follows the interaction that opened the dialogue and lets go when it closes', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const talk = main.slice(main.indexOf('function interactSettlementNpc()'), main.indexOf('function handleValleyInteraction('));
  assert.ok(talk.includes("if (typeof noteTalk === 'function') noteTalk(npc.id);"), 'noted only by addressing a resident');
  assert.ok(main.includes('if (talkCandidate && (narrative?.open || performance.now() - talkCandidate.at > 400)) { if (narrative?.open) talkWith = talkCandidate.id; talkCandidate = null; }'), 'adopted only when a dialogue actually opened, and never stale');
  assert.ok(main.includes('if (talkWith && !narrative?.open) talkWith = null;') && main.includes('settlementNpcs.setAttending(talkWith);'));
  assert.ok(main.includes('!portrait && !conversationActor ? settlementNpcs.group.getObjectByName(`Resident_${talkWith}`)'), 'never on top of the journey portrait shots');
  assert.ok(main.includes(": wx || wz ? Math.atan2(wx, wz) : typeof talkYaw === 'number' ? talkYaw : null,"), 'the protagonist turns to the speaker unless the player is steering');
  assert.ok(/talkBlend = talkFramed \? \(reducedEffects\(\) \? 1 :/.test(main), 'reduced effects cut instead of gliding');
});
