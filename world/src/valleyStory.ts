import type { Localized } from './settlements/types';

/** Small, additive local story. Existing objective and inventory flags remain authoritative. */
export const VALLEY_STORY = {
  npc: 'alpha_archivist',
  terminal: 'hq_terminal',
  met: 'valley_story_met',
  resolved: 'valley_story_resolved',
  discovery: 'valley_route_note',
} as const;

export type ValleyStoryStage = 'meet' | 'restore' | 'report' | 'complete';
export interface ValleyStoryState {
  stage: ValleyStoryStage;
  powered: boolean;
  discovered: boolean;
  /** Shared useful outcome: either the resident or the player can open the same side entrance. */
  shortcutOpen: boolean;
  /** Advanced old saves must not be sent back to a new introductory task. */
  legacyAdvanced: boolean;
}
const advancedFlags = [
  'armory_rack', 'range_target_1', 'range_target_2', 'range_target_3',
  'ruin_target_1', 'ruin_target_2', 'ruin_target_3', 'relay_a', 'relay_b',
  'tower_console', 'seam_west', 'seam_north', 'seam_east', 'seam_south', 'summon_circle',
];

export function getValleyStoryState(done: ReadonlySet<string>): ValleyStoryState {
  const powered = done.has(VALLEY_STORY.terminal);
  const legacyAdvanced = !done.has(VALLEY_STORY.met) && !done.has(VALLEY_STORY.resolved)
    && advancedFlags.some((flag) => done.has(flag));
  const stage: ValleyStoryStage = done.has(VALLEY_STORY.resolved) || legacyAdvanced ? 'complete'
    : powered ? 'report' : done.has(VALLEY_STORY.met) ? 'restore' : 'meet';
  const discovered = done.has(VALLEY_STORY.discovery);
  const shortcutOpen = discovered || done.has(VALLEY_STORY.met) || done.has(VALLEY_STORY.resolved) || legacyAdvanced;
  return { stage, powered, discovered, shortcutOpen, legacyAdvanced };
}

export interface ValleyStoryGuide {
  title: Localized;
  text: Localized;
  targetId: string;
  targetKind: 'npc' | 'marker';
}
/** Only an Alpha-local guide override; never replaces another chapter's objective. */
export function getValleyStoryGuide(done: ReadonlySet<string>): ValleyStoryGuide | null {
  switch (getValleyStoryState(done).stage) {
    case 'meet': return {
      title: ['留一盏灯', 'A Light to Return To'],
      text: ['与驻地记录员交谈，了解观测所的情况。', 'Speak with the residence archivist about the Observatory.'],
      targetId: VALLEY_STORY.npc, targetKind: 'npc',
    };
    case 'restore': return {
      title: ['留一盏灯', 'A Light to Return To'],
      text: ['启动观测所终端，接通检修侧门的导引灯。', 'Activate the Observatory terminal to power the maintenance entrance lights.'],
      targetId: VALLEY_STORY.terminal, targetKind: 'marker',
    };
    case 'report': return {
      title: ['灯已亮起', 'The Lights Are On'],
      text: getValleyStoryState(done).shortcutOpen
        ? ['穿过侧门返回生活馆庭院，与记录员交谈。', 'Return through the side entrance to the residence court and speak with the archivist.']
        : ['返回生活馆庭院，与驻地记录员交谈。', 'Return to the residence court and speak with the archivist.'],
      targetId: VALLEY_STORY.npc, targetKind: 'npc',
    };
    case 'complete': return null;
  }
}

export interface ValleyStoryInteraction {
  handled: boolean;
  changed: boolean;
  dialogue: Localized | null;
  state: ValleyStoryState;
}

/**
 * Caller must validate range/LOS before calling, then save and apply visual state when changed.
 * We do NOT consume hq_terminal: its original quest interaction owns requirements and completion.
 * No resource rewards or hidden save writes; reset is simply WorldProgress.reset().
 */
export function interactValleyStory(id: string, done: Set<string>): ValleyStoryInteraction {
  const before = getValleyStoryState(done);
  let changed = false;
  const add = (flag: string) => { if (!done.has(flag)) { done.add(flag); changed = true; } };
  let dialogue: Localized | null = null;
  if (id === VALLEY_STORY.npc) {
    if (before.powered) {
      add(VALLEY_STORY.met); add(VALLEY_STORY.resolved);
      dialogue = !done.has('armory_rack')
        ? ['亮了。以后夜里回来，认这排灯就行。工坊给你备了装备，走之前记得拿；外面的路可没这么平。', 'There they are. Follow those lights when you return after dark. Your equipment is at the armory; collect it before you leave. The roads outside are rougher than this one.']
        : ['侧门的灯亮着呢。放心走，这边有人守。', 'The side-entrance lights are on. Go on; someone will keep watch here.'];
    } else if (before.legacyAdvanced) {
      // Preserve out-of-order advanced saves too. Never invent terminal completion or equipment.
      dialogue = ['侧门那排灯，还得从观测所的终端接电。你若正好路过，替我看看；别特意折返。', 'The side-entrance lights still need power from the Observatory terminal. Check it if you pass that way; do not turn back just for me.'];
    } else if (!done.has(VALLEY_STORY.met)) {
      add(VALLEY_STORY.met);
      dialogue = before.discovered
        ? ['你已经把侧门打开了？比我利索。再帮个忙，去观测所接通终端吧。天黑后回来的人，总找不着这扇门。', 'You opened the side entrance yourself? Faster than me. Could you reconnect the Observatory terminal too? People returning after dark keep missing this door.']
        : ['门闩老卡住，别硬挤。我替你把检修侧门打开了。能帮我去观测所接通终端吗？天黑后回来的人，总找不着这扇门。', 'The latch keeps sticking. Do not squeeze through; I have opened the maintenance entrance for you. Could you reconnect the Observatory terminal? People returning after dark keep missing this door.'];
    } else {
      dialogue = ['侧门开着，直接过吧。线路还好，去观测所接通终端就行。夜里回来的人，就差这点光。', 'The side entrance is open; go through. The wiring is sound. Just reconnect the Observatory terminal. That little light will help people find their way home.'];
    }
  } else if (id === VALLEY_STORY.discovery) {
    add(VALLEY_STORY.discovery);
    dialogue = before.discovered
      ? ['面板上的绿色通行灯亮着，侧门保持打开。', 'The green passage indicator is lit; the side entrance remains open.']
      : before.shortcutOpen
        ? ['侧门已经开着。你接通了面板上的绿色通行灯，现在从庭院也能辨认这条出口。', 'The side entrance is already open. You switch on its green passage indicator, making this exit identifiable from the court.']
        : ['你扳开了面板里的手动门闩，绿色通行灯也亮了起来。旁边的检修侧门打开了，庭院多了一条小路。', 'You release the manual latch and switch on the green passage indicator. The nearby maintenance entrance opens, adding another path through the court.'];
  }
  return { handled: dialogue !== null, changed, dialogue, state: getValleyStoryState(done) };
}
