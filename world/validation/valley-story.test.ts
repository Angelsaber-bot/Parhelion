import test from 'node:test';
import assert from 'node:assert/strict';
import { VALLEY_STORY as V, getValleyStoryState as state, getValleyStoryGuide as guide, interactValleyStory as act } from '../src/valleyStory';

test('short arc: meet, restore, report, complete, preserving original HQ interaction', () => {
  const done = new Set<string>();
  assert.equal(state(done).stage, 'meet');
  assert.equal(guide(done)?.targetId, V.npc);
  assert.equal(act(V.npc, done).state.stage, 'restore');
  assert.equal(guide(done)?.targetId, V.terminal);
  assert.equal(act(V.terminal, done).handled, false);
  assert.equal(done.has(V.terminal), false);
  done.add(V.terminal);
  assert.equal(state(done).stage, 'report');
  assert.equal(guide(done)?.targetId, V.npc);
  assert.equal(act(V.npc, done).state.stage, 'complete');
  assert.equal(guide(done), null);
  assert.equal(done.has('armory_rack'), false);
});

test('NPC repetition is idempotent at all stages', () => {
  const done = new Set<string>();
  act(V.npc, done);
  const size = done.size;
  assert.equal(act(V.npc, done).changed, false);
  assert.equal(done.size, size);
  done.add(V.terminal); act(V.npc, done);
  const finished = [...done];
  assert.equal(act(V.npc, done).changed, false);
  assert.deepEqual([...done], finished);
});

test('optional discovery works before or after power, never gates main arc', () => {
  for (const early of [true, false]) {
    const done = new Set<string>();
    if (early) {
      assert.equal(act(V.discovery, done).changed, true);
      assert.equal(state(done).stage, 'meet');
      assert.equal(state(done).powered, false);
    }
    act(V.npc, done); done.add(V.terminal); act(V.npc, done);
    assert.equal(state(done).stage, 'complete');
    assert.equal(state(done).discovered, early);
    assert.equal(act(V.discovery, done).changed, !early);
    assert.equal(state(done).discovered, true);
    assert.equal(act(V.discovery, done).changed, false);
  }
});

test('terminal-first route can report directly without undoing original progress', () => {
  const done = new Set<string>([V.terminal]);
  assert.equal(state(done).stage, 'report');
  assert.equal(act(V.npc, done).state.stage, 'complete');
  assert.equal(done.has(V.terminal), true);
});

test('unknown IDs and other residents are not intercepted', () => {
  const done = new Set<string>();
  for (const id of ['alpha_steward', 'tower_console', 'armory_rack', '', 'random']) {
    assert.equal(act(id, done).handled, false);
    assert.equal(act(id, done).dialogue, null);
  }
  assert.equal(done.size, 0);
});

test('guidance and handled responses have nonempty bilingual strings', () => {
  const done = new Set<string>();
  for (const next of [null, V.npc, V.discovery, V.terminal, V.npc]) {
    if (next === V.terminal) done.add(next);
    else if (next) {
      const result = act(next, done);
      assert.equal(result.dialogue?.length, 2);
      assert.ok(result.dialogue?.every((s) => s.length > 5));
    }
    const objective = guide(done);
    if (objective) assert.ok([...objective.title, ...objective.text].every((s) => s.length > 0));
  }
});

test('resident cooperation immediately opens a usable side entrance without activating power', () => {
  const done = new Set<string>();
  assert.equal(state(done).shortcutOpen, false);
  const meeting = act(V.npc, done);
  assert.equal(meeting.state.shortcutOpen, true);
  assert.equal(meeting.state.powered, false);
  assert.equal(meeting.state.discovered, false);
  assert.match(meeting.dialogue![0], /我替你把检修侧门打开/);
  assert.equal(act(V.discovery, done).changed, true, 'panel still has its own visible result');
  assert.equal(state(done).discovered, true);
});

test('manual-first discovery is acknowledged rather than falsely credited to resident', () => {
  const done = new Set<string>();
  const panel = act(V.discovery, done);
  assert.equal(panel.state.shortcutOpen, true);
  assert.equal(panel.state.powered, false);
  const meeting = act(V.npc, done);
  assert.match(meeting.dialogue![0], /你已经把侧门打开/);
  assert.doesNotMatch(meeting.dialogue![0], /我替你把/);
});
