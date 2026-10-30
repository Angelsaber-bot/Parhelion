import type { Localized } from './settlements/types';
import { ERA_IDS, ERA_STORIES, ERA_OPTIONALS, ERA_KNIGHT_DEFEATED, isEraCoreCleared } from './eraStories';

/** Optional closing record, never a fifth gate or a replacement for individual contracts. */
export const CAMPAIGN_CLOSURE = {
  terminal: 'hq_terminal', recorded: 'world_epilogue_recorded',
  archivist: 'alpha_archivist', steward: 'alpha_steward',
} as const;
export interface CampaignClosureState {
  stage: 'journey' | 'ready' | 'recorded';
  resolved: number;
  total: 4;
  /** Existing companion recruitment may still be pending after the world is restored. */
  outstandingContracts: readonly string[];
}
export function getCampaignClosureState(done: ReadonlySet<string>): CampaignClosureState {
  const resolved = ERA_IDS.filter(region => isEraCoreCleared(ERA_STORIES[region].core, done)).length;
  return {
    stage: done.has(CAMPAIGN_CLOSURE.recorded) ? 'recorded' : resolved === 4 ? 'ready' : 'journey',
    resolved, total: 4,
    outstandingContracts: ERA_IDS.map(region => ERA_STORIES[region].contract).filter(id => !done.has(id)),
  };
}
export interface CampaignClosureGuide { title: Localized; text: Localized; targetId: string; }
/** A local optional invitation only. Never send a player across a 720m region to satisfy it. */
export function getCampaignClosureGuide(region: string, done: ReadonlySet<string>): CampaignClosureGuide | null {
  if (region !== 'alpha' || !done.has(CAMPAIGN_CLOSURE.terminal) || getCampaignClosureState(done).stage !== 'ready') return null;
  return {
    title: ['可选收束 · 灯火相连', 'Optional Epilogue · Lights Connected'],
    text: ['四处时层的核心已复原。路过观测所时，在终端留下这趟旅程的记录。', 'All four era cores are restored. When you pass the Observatory, leave an account of your journey at the terminal.'],
    targetId: CAMPAIGN_CLOSURE.terminal,
  };
}
/** Report only facts actually restored. Optional deeds remain optional even in the ending. */
export function getCampaignClosingText(done: ReadonlySet<string>): Localized {
  const text: Localized = [
    '观测记录归档：落日、海、冬与京都的四处核心已经复原。四条路重新落在同一张图上，你也回到了出发的地方。终端旁的灯还亮着，下一页留给下一次出发。',
    'Observation filed: the Sun, Sea, Winter, and Kyoto cores are restored. Four roads fit on the same map again, and you have returned to where you began. The terminal light stays on. The next page can wait for your next departure.',
  ];
  const echoes: Record<string, Localized> = {
    britain: ['王城的旧誓铭牌已被擦亮。', 'The kingdom’s old oath memorial is readable again.'],
    blacksail: ['港口归航灯仍替后来者引路。', 'The harbor return signal still guides later arrivals.'],
    winter: ['你点燃的驿站炉火仍为旅人保暖。', 'The post stove you lit still warms travelers.'],
    kyoto: ['你修复的旅籠路灯仍指向安静的小路。', 'The inn lanterns you restored still mark the quiet route.'],
  };
  for (const region of ERA_IDS) if (done.has(ERA_OPTIONALS[region].id)) {
    text[0] += '\n' + echoes[region][0]; text[1] += '\n' + echoes[region][1];
  }
  if (done.has(ERA_KNIGHT_DEFEATED)) {
    text[0] += '\n失誓骑士的试炼也已留下胜利记录。'; text[1] += '\nYour victory in the Oathless Knight’s trial is recorded too.';
  }
  if (ERA_IDS.some(region => !done.has(ERA_OPTIONALS[region].id))) {
    text[0] += '\n沿途还有没聊完的话、没修好的小物。下次路过，再停一停吧。';
    text[1] += '\nThere are conversations to finish and unfinished restorations along the road. Stop a while when you next pass through.';
  }
  return text;
}
export function interactCampaignClosure(id: string, done: Set<string>): { handled: boolean; changed: boolean; dialogue: Localized | null; state: CampaignClosureState } {
  const state = getCampaignClosureState(done);
  // The original HQ quest owns first activation. This never invents its completion or equipment.
  if (id !== CAMPAIGN_CLOSURE.terminal || !done.has(CAMPAIGN_CLOSURE.terminal) || state.stage === 'journey') {
    return { handled: false, changed: false, dialogue: null, state };
  }
  if (state.stage === 'recorded') return { handled: true, changed: false, dialogue: [
    '四时层的记录已收存。书页压平了，灯还亮着。下一页也给同行的人留着位置；等你想好了，再出发。',
    'The four-era record is safe. The pages lie flat; the light stays on. The next page has room for anyone who travels with you. Set out when you are ready.',
  ], state };
  done.add(CAMPAIGN_CLOSURE.recorded);
  return { handled: true, changed: true, dialogue: getCampaignClosingText(done), state: getCampaignClosureState(done) };
}
export function getCampaignResidentReaction(id: string, done: ReadonlySet<string>): Localized | null {
  const state = getCampaignClosureState(done);
  if (state.stage === 'journey') return null;
  if (id === CAMPAIGN_CLOSURE.archivist) return state.stage === 'ready'
    ? ['四处回声终于分得清了。路过终端时，把这一程记下来吧。我想知道，你在那些地方见到了谁。', 'I can tell the four echoes apart at last. Leave an account at the terminal when you pass. I would like to know whom you met out there.']
    : ['这次不是失踪者的名册，是归来者的记录。谢谢你把那盏灯接通，也把四条路走了回来。', 'This time the record lists those who returned, not those missing. Thank you for restoring that first light—and for returning from all four roads.'];
  if (id === CAMPAIGN_CLOSURE.steward) return [
    '生活馆一直给你们留着位置。先歇歇脚，路上没赴完的约定，等收拾好行装再去。',
    'There is still a place for you all at the residence. Rest your feet. Those unfinished promises will wait while you pack for the next road.',
  ];
  return null;
}
