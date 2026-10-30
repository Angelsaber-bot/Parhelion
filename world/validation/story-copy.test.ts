import test from 'node:test';
import assert from 'node:assert/strict';
import { ERA_IDS, ERA_RESIDENTS, ERA_STORIES, ERA_OPTIONALS, getEraResidentDialogue, getEraStoryGuide, getEraProgressReaction, interactEraStory } from '../src/eraStories';
import { CAMPAIGN_CLOSURE, getCampaignClosingText, getCampaignResidentReaction } from '../src/campaignClosure';
import { VALLEY_STORY, interactValleyStory, getValleyStoryGuide } from '../src/valleyStory';
import type { Localized } from '../src/settlements/types';
const meta = /主线|通关条件|解锁条件|不会重置|main.story|optional|condition of completion|resetting the/i;
function readable(text: Localized, zhLimit = 95, enLimit = 310) {
  assert.equal(text.length, 2);
  assert.ok(text[0].trim().length > 5 && text[0].length <= zhLimit, `Chinese copy length: ${text[0]}`);
  assert.ok(text[1].trim().length > 10 && text[1].length <= enLimit, `English copy length: ${text[1]}`);
  assert.match(text[0], /[\u4e00-\u9fff]/); assert.doesNotMatch(text[1], /[\u4e00-\u9fff]/);
}
test('resident dialogue stays brief and in-world at preparation, challenge, return and completion', () => {
  for (const region of ERA_IDS) {
    const chapter = ERA_STORIES[region];
    const snapshots = [new Set<string>(), new Set(chapter.beats.flatMap(b => [...b.flags])), new Set([chapter.core]), new Set([chapter.core, chapter.contract])];
    for (const done of snapshots) for (const id of ERA_RESIDENTS[region]) {
      const before = [...done], text = getEraResidentDialogue(id, done)!;
      readable(text); for (const line of text) assert.doesNotMatch(line, meta, `${id} should speak as a resident, not a designer`);
      assert.deepEqual([...done], before, 'copy lookup must not fabricate progress');
    }
  }
});
test('chapter objectives retain concrete locations, quantities and bilingual return destinations', () => {
  for (const region of ERA_IDS) {
    const chapter = ERA_STORIES[region];
    for (const beat of chapter.beats) readable(beat.text, 70, 220);
    readable(chapter.challenge, 70, 220); readable(chapter.returnText, 70, 220);
    const before = new Set<string>(), guide = getEraStoryGuide(region, before)!;
    assert.equal(guide.targetId, chapter.beats[0].flags[0]); assert.equal(before.size, 0);
  }
  assert.match(ERA_STORIES.britain.beats[1].text[0], /第一盏/); assert.match(ERA_STORIES.britain.beats[1].text[1], /first oath hearth/);
  for (const [region, noun] of [['blacksail', /three ghost boats/], ['winter', /three snowfield beacons/], ['kyoto', /three bellflower banners/]] as const) {
    const beat = ERA_STORIES[region].beats.at(-1)!;
    assert.equal(beat.flags.length, 3); assert.match(beat.text[0], /三/); assert.match(beat.text[1], noun);
  }
});
test('optional labels and numeric UI remain explicit without turning NPC speech into gate documentation', () => {
  for (const region of ERA_IDS) {
    const done = new Set<string>(), optional = ERA_OPTIONALS[region];
    for (let visit = 0; visit < 2; visit++) {
      const text = interactEraStory(optional.id, done).dialogue!;
      readable(text, 95, 310); for (const line of text) assert.doesNotMatch(line, meta);
    }
  }
  const winter = ERA_OPTIONALS.winter;
  for (const text of [winter.first, winter.repeat]) { assert.match(text[0], /三十秒/); assert.match(text[1], /thirty seconds/); }
  for (const text of [ERA_OPTIONALS.kyoto.first, ERA_OPTIONALS.kyoto.repeat]) {
    assert.match(text[0], /南门.*西/); assert.match(text[1], /south gate.*west/i);
  }
  const optionalUI = getEraProgressReaction('shard_treasure', new Set())!;
  assert.match(optionalUI[0], /可选/); assert.match(optionalUI[1], /optional/);
  for (const [id, flag] of [['ghost_boat_1', 'ghost_boat_1'], ['beacon_1', 'beacon_1'], ['kikyo_banner_1', 'kikyo_banner_1']]) {
    const text = getEraProgressReaction(id, new Set([flag]))!;
    assert.match(text[0], /1\/3/); assert.match(text[1], /1\/3/);
  }
});
test('closing voices avoid administrative game rules and only echo earned local repairs', () => {
  const done = new Set(ERA_IDS.map(region => ERA_STORIES[region].core));
  for (const id of [CAMPAIGN_CLOSURE.archivist, CAMPAIGN_CLOSURE.steward]) {
    const text = getCampaignResidentReaction(id, done)!;
    readable(text); for (const line of text) assert.doesNotMatch(line, meta);
  }
  const absent = getCampaignClosingText(done);
  for (const line of absent) assert.doesNotMatch(line, meta);
  for (const region of ERA_IDS) {
    const earned = getCampaignClosingText(new Set([...done, ERA_OPTIONALS[region].id]));
    assert.ok(earned[0].length > absent[0].length && earned[1].length > absent[1].length);
  }
  const archived = new Set([...done, CAMPAIGN_CLOSURE.recorded]);
  assert.match(getCampaignResidentReaction(CAMPAIGN_CLOSURE.archivist, archived)![0], /归来者/);
  assert.match(getCampaignResidentReaction(CAMPAIGN_CLOSURE.archivist, archived)![1], /those who returned/);
});
test('Valley opening preserves agency, truthful equipment advice and a direct return objective', () => {
  const manual = new Set([VALLEY_STORY.discovery]);
  const first = interactValleyStory(VALLEY_STORY.npc, manual).dialogue!;
  assert.match(first[0], /你已经把侧门打开/); assert.match(first[1], /opened the side entrance yourself/);
  const powered = new Set([VALLEY_STORY.terminal]);
  const reply = interactValleyStory(VALLEY_STORY.npc, powered).dialogue!;
  readable(reply); assert.match(reply[0], /装备/); assert.match(reply[1], /equipment.*armory/);
  const equipped = new Set([VALLEY_STORY.terminal, 'armory_rack']);
  const repeat = interactValleyStory(VALLEY_STORY.npc, equipped).dialogue!;
  assert.doesNotMatch(repeat[0], /领取|去拿|备了装备/); assert.doesNotMatch(repeat[1], /collect.*equipment/);
  const guide = getValleyStoryGuide(new Set([VALLEY_STORY.terminal, VALLEY_STORY.met]))!;
  assert.equal(guide.targetId, VALLEY_STORY.npc); assert.match(guide.text[0], /返回.*庭院.*记录员/);
});
