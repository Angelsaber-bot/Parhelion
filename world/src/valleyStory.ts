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
        ? ['穿过已打开的侧门，看看灯亮后的庭院，再与记录员交谈。', 'Use the opened side entrance, see the relit court, and speak with the archivist.']
        : ['看看灯亮后的生活馆庭院，与驻地记录员交谈。', 'See the relit residence court and speak with the archivist.'],
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
        ? ['亮了。以后从外面回来，看到这排灯，就知道这里还有人在等你。工坊备着装备，出发前去拿上；外面的路可不都这么安稳。', 'There they are. When you return, these lights will tell you someone is still waiting here. Pick up your equipment at the armory before heading out; not every road is this quiet.']
        : ['检修侧门的灯已经亮着。这里会替你留一盏灯，继续你的旅程吧。', 'The maintenance entrance lights are on. We will keep a light on here; carry on with your journey.'];
    } else if (before.legacyAdvanced) {
      // Preserve out-of-order advanced saves too. Never invent terminal completion or equipment.
      dialogue = ['观测所的终端仍能接通检修侧门的路灯。你已经走得很远，不必为这件事停下；路过时再看看就好。', 'The Observatory terminal can still power the maintenance entrance lights. You have already come a long way; check it when you next pass through.'];
    } else if (!done.has(VALLEY_STORY.met)) {
      add(VALLEY_STORY.met);
      dialogue = before.discovered
        ? ['你已经把侧门打开了？比我利索。再帮个忙，去观测所接通终端吧。天黑后回来的人，总找不着这扇门。', 'You opened the side entrance yourself? Faster than me. Could you reconnect the Observatory terminal too? People returning after dark keep missing this door.']
        : ['门闩老卡住，别硬挤。我替你把检修侧门打开了。能帮我去观测所接通终端吗？天黑后回来的人，总找不着这扇门。', 'The latch keeps sticking. Do not squeeze through; I have opened the maintenance entrance for you. Could you reconnect the Observatory terminal? People returning after dark keep missing this door.'];
    } else {
      dialogue = ['侧门已经开着，你可以直接通行。检修灯的供电终端在观测所，不用另找零件；灯亮后，这扇侧门也不再黑着了。', 'The side entrance is open for you. The maintenance-light terminal is at the Observatory; no spare parts are needed. It will light this side entrance.'];
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
