import type { Localized } from '../settlements/types';

/** Optional, unarmed observation. No chapter gates, combat rewards or timers. */
export const PARALLAX = {
  board: 'parallax_record', front: 'parallax_front', side: 'parallax_side',
  started: 'parallax_started', complete: 'parallax_recorded', quest: 'side:parallax',
  title: ['两步之间 · 视差庭院', 'A Change of View · Parallax Garden'] as Localized,
};
export const PARALLAX_LABELS: readonly (readonly [string, Localized])[] = [
  [PARALLAX.board, ['观测记录板', 'Observation record']],
  [PARALLAX.front, ['正面观察位 · 看向双环', 'Front viewpoint · Face the rings']],
  [PARALLAX.side, ['侧面观察位 · 看向双环', 'Side viewpoint · Face the rings']],
];
export type SurveyPoint = readonly [number, number, number];
export interface SurveyFrame {
  feet: SurveyPoint; eye: SurveyPoint; direction: SurveyPoint;
  grounded: boolean; playable: boolean; clear: boolean;
}
export function canRecordView(frame: SurveyFrame, station: SurveyPoint, subject: SurveyPoint): boolean {
  if (!frame.playable || !frame.grounded || !frame.clear) return false;
  if (![...frame.feet, ...frame.eye, ...frame.direction, ...station, ...subject].every(Number.isFinite)) return false;
  if (Math.hypot(frame.feet[0] - station[0], frame.feet[2] - station[2]) > 1.8 || Math.abs(frame.feet[1] - station[1]) > .7) return false;
  const delta = subject.map((n, i) => n - frame.eye[i]);
  const distance = Math.hypot(...delta), magnitude = Math.hypot(...frame.direction);
  if (distance < 1 || magnitude < .001) return false;
  const dot = delta.reduce((sum, n, i) => sum + n * frame.direction[i], 0) / (distance * magnitude);
  return dot >= Math.cos(16 * Math.PI / 180);
}
export function parallaxGuide(done: ReadonlySet<string>): { targetId: string; text: Localized } | null {
  if (done.has(PARALLAX.complete)) return null;
  if (!done.has(PARALLAX.started)) return { targetId: PARALLAX.board, text: ['到观测所南侧的视差庭院读记录板。不需要武器，也不影响主线。', 'Read the board in the garden south of the Observatory. No weapon required; this is optional.'] };
  if (!done.has(PARALLAX.front)) return { targetId: PARALLAX.front, text: ['站到圆形脚印内，把画面中央转向两枚景观环，再按交互记录正面视角。', 'Stand inside the round footprint, center the two rings in your view, then interact to record the front view.'] };
  if (!done.has(PARALLAX.side)) return { targetId: PARALLAX.side, text: ['走到右侧菱形脚印，转动视角重新看向双环，再按交互。留意两枚环的相对位置。', 'Walk to the diamond footprint on the right, face the rings and interact. Notice their relative positions.'] };
  return { targetId: PARALLAX.board, text: ['回到记录板，依据两个视角修正观测结果。', 'Return to the board and revise the observation using both views.'] };
}
export const PARALLAX_INTRO: Localized = [
  '旧记录写着：“庭院只剩一枚环。”\n记录员在边上留了一句：别急着拆掉空支架，先换个位置看看。\n从圆形脚印看向双环，再从右侧菱形脚印复查。站稳后，把双环转到画面中央，按交互留下观察。无需开镜，没有计时。',
  'The old record says: “Only one ring remains.”\nA note in the margin reads: Before removing the empty support, try another viewpoint.\nObserve the rings from the round footprint, then from the diamond on the right. Stand still, center the rings and interact. No weapon or time limit is needed.',
];
export const PARALLAX_ENDING: Localized = [
  '你划掉“只剩一枚”，写下：“两枚环。正面视线重叠，侧面可以分辨。”\n记录员没有拆掉任何一座支架，只把那张单独的照片翻到背面，添上了观察的位置。\n有些空白不需要再造一个答案。往旁边走几步，就能看见原来还在的东西。\n庭院会保留这份修正。已解锁“折光测绘”旅途涂装，可在操作设置中选择；它只改变外观。你仍可回来观察双环。',
  'You cross out “only one” and write: “Two rings. They overlap from the front and separate from the side.”\nNo support is removed. Instead, the observer adds the viewpoint to the back of the photograph.\nSometimes a blank needs no invented answer. A few steps reveal what was there all along.\nThe corrected record remains here. Refractive Survey is unlocked in the settings’ journey finishes; it changes appearance only. You can return to observe the rings.',
];
export function recordParallaxView(id: string, done: Set<string>, frame: SurveyFrame, station: SurveyPoint, subject: SurveyPoint): boolean {
  if ((id !== PARALLAX.front && id !== PARALLAX.side) || !done.has(PARALLAX.started) || done.has(id) || !canRecordView(frame, station, subject)) return false;
  done.add(id); return true;
}
export function concludeParallax(choice: string, done: Set<string>): boolean {
  if (choice !== 'perspective' || !done.has(PARALLAX.started) || !done.has(PARALLAX.front) || !done.has(PARALLAX.side) || done.has(PARALLAX.complete)) return false;
  done.add(PARALLAX.complete); return true;
}
