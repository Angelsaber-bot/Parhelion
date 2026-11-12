import type { Localized } from '../settlements/types';
import { JOURNEY } from './worldJourney';

export const SHADOW_PLAY = {
  discover: 'orleans_shadow_play_door',
  rope: 'orleans_shadow_play_rope',
  encore: 'orleans_shadow_play_encore',
  swallowtail: 'orleans_shadow_flag_swallowtail',
} as const;
export const CROOKED_EFFIGY = {
  turn: 'qin_crooked_effigy_turn',
  maker: 'qin_crooked_effigy_maker',
} as const;

type CulturalStep = { id: string; label: Localized; hint: Localized };
type CulturalStory = {
  id: string;
  region: 'orleans' | 'qin';
  title: Localized;
  opensWith: string;
  steps: readonly CulturalStep[];
};

export const CULTURAL_STORIES: readonly CulturalStory[] = [
  {
    id: 'shadow-play', region: 'orleans', title: ['被藏起的小剧场', 'The Hidden Shadow Theatre'], opensWith: JOURNEY.orleansRead,
    steps: [
      { id: SHADOW_PLAY.discover, label: ['集市侧巷 · 敲剧场的门', 'Market lane · Knock on the theatre door'],
        hint: ['到布摊后的侧巷，找笑声和亮着的纸窗。', 'Look behind the cloth stalls for laughter and a lit paper window.'] },
      { id: SHADOW_PLAY.rope, label: ['幕后牵绳 · 选旗样并开演', 'Backstage rope · Choose a flag and start the play'],
        hint: ['绕到纸幕后，替演员拉旗绳。', 'Go behind the screen and take the actor’s flag rope.'] },
    ],
  },
  {
    id: 'crooked-effigy', region: 'qin', title: ['歪脸的半成品', 'The Crooked Face'], opensWith: JOURNEY.qinRead,
    steps: [
      { id: CROOKED_EFFIGY.turn, label: ['窑场 · 转动制俑台', 'Kiln yard · Turn the figure stand'],
        hint: ['窑场里有一尊歪着头的半成品，转动木台看看背面。', 'Look for the tilted figure in the kiln yard and turn its stand to see the back.'] },
      { id: CROOKED_EFFIGY.maker, label: ['陶工路容 · 询问背面刻痕', 'Potter Lu Rong · Ask about the marks'],
        hint: ['问旁边的陶工，背上为什么刻着不同手印。', 'Ask the potter why different handprints are cut into its back.'] },
    ],
  },
];
const encore: CulturalStep = {
  id: SHADOW_PLAY.encore, label: ['幕后牵绳 · 战后返场', 'Backstage rope · Post-siege encore'],
  hint: ['回剧场看演员把大家亲历的战役编进纸影戏。', 'Return to see how the troupe retells the siege the city lived through.'],
};
export const CULTURAL_STEPS = new Map([...CULTURAL_STORIES.flatMap(story => story.steps), encore].map(step => [step.id, step]));

export function culturalStoryNext(story: CulturalStory, done: ReadonlySet<string>) {
  if (!done.has(story.opensWith)) return null;
  const next = story.steps.find(step => !done.has(step.id));
  if (next) return next;
  return story.region === 'orleans' && done.has(JOURNEY.orleansDone) && !done.has(encore.id) ? encore : null;
}

export function culturalStepReady(id: string, done: ReadonlySet<string>) {
  return CULTURAL_STORIES.some(story => culturalStoryNext(story, done)?.id === id);
}
