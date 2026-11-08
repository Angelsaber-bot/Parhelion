import type { Localized } from '../settlements/types';

/** Optional, unarmed observation. No chapter gates, combat rewards or timers. */
export const PARALLAX = {
  near: 'parallax_near_wheel', far: 'parallax_far_wheel', experiment: 'parallax_experiment_active', tested: 'parallax_experiment_tested',
  board: 'parallax_record', front: 'parallax_front', side: 'parallax_side',
  started: 'parallax_started', complete: 'parallax_recorded', quest: 'side:parallax',
  title: ['两步之间 · 视差庭院', 'A Change of View · Parallax Garden'] as Localized,
};
export const PARALLAX_LABELS: readonly (readonly [string, Localized])[] = [
  [PARALLAX.near, ['近环手轮 · 转动一格', 'Near-ring wheel · Turn one notch']],
  [PARALLAX.far, ['远环手轮 · 转动一格', 'Far-ring wheel · Turn one notch']],
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
  if (done.has(PARALLAX.complete)&&!done.has(PARALLAX.experiment)) return null;
  if (!done.has(PARALLAX.started)) return { targetId: PARALLAX.board, text: ['到观测所南侧的视差庭院读记录板。不需要武器，也不影响主线。', 'Read the board in the garden south of the Observatory. No weapon required; this is optional.'] };
  if (done.has(PARALLAX.experiment) && !parallaxAligned(done)) return { targetId: parallaxSetting(done,'near')!==1?PARALLAX.near:PARALLAX.far, text: ['用两个手轮分别调节近环、远环。观察圆形站位中的圆与椭圆：让两个环都正对你。', 'Turn the two wheels separately. At the round footprint, compare circles and ellipses until both rings face you.'] };
  if (!done.has(PARALLAX.front)) return { targetId: PARALLAX.front, text: ['站到圆形脚印内，把画面中央转向两枚景观环，再按交互记录正面视角。', 'Stand inside the round footprint, center the two rings in your view, then interact to record the front view.'] };
  if (!done.has(PARALLAX.side)) return { targetId: PARALLAX.side, text: ['走到右侧菱形脚印，转动视角重新看向双环，再按交互。留意两枚环的相对位置。', 'Walk to the diamond footprint on the right, face the rings and interact. Notice their relative positions.'] };
  return { targetId: PARALLAX.board, text: ['回到记录板，依据两个视角修正观测结果。', 'Return to the board and revise the observation using both views.'] };
}
export const PARALLAX_INTRO: Localized = [
  '两座支架上，近环和远环都被转动过。旧照片的窄轮廓让记录员以为零件丢失了。\n先亲手试验：圆形脚印两旁各有一个手轮，每次转动一格。看清哪一个环随之改变，让两环的正面都呈圆形，再记录。\n然后移到菱形脚印复查：同一套装置，换个位置会留下什么轮廓？答案由你的试验决定。没有计时，调错可以继续。',
  'Both instrument rings have been turned. Their narrow outlines in an old photograph made the observer suspect missing parts.\nExperiment first: each wheel beside the round footprint turns one ring by one notch. Watch which ring changes, face both circular fronts toward you, then record.\nMove to the diamond footprint and test the same arrangement from the side. What changes when the observer moves? There is no timer; keep experimenting.',
];
export function parallaxSetting(done: ReadonlySet<string>, ring: 'near'|'far'): number {
  for(let i=0;i<3;i++)if(done.has(`parallax_${ring}_${i}`))return i;
  return ring==='near'?0:2;
}
export function parallaxAligned(done: ReadonlySet<string>) { return parallaxSetting(done,'near')===1&&parallaxSetting(done,'far')===1; }
export function beginParallaxExperiment(done:Set<string>) {
  done.add(PARALLAX.started);done.add(PARALLAX.experiment);done.delete(PARALLAX.tested);
  done.delete(PARALLAX.front);done.delete(PARALLAX.side);
  for(const ring of ['near','far'])for(let i=0;i<3;i++)done.delete(`parallax_${ring}_${i}`);
}
export function turnParallaxRing(done:Set<string>,ring:'near'|'far'):boolean {
  if(!done.has(PARALLAX.experiment))return false;
  const next=(parallaxSetting(done,ring)+1)%3;
  for(let i=0;i<3;i++)done.delete(`parallax_${ring}_${i}`);
  done.add(`parallax_${ring}_${next}`);done.delete(PARALLAX.front);done.delete(PARALLAX.side);done.delete(PARALLAX.tested);return true;
}
export const PARALLAX_ENDING: Localized = [
  '你划掉“只剩一枚”，写下：“两枚环。调节改变了环的朝向；换位改变了它们的投影。”\n记录员没有拆掉任何一座支架，只把那张单独的照片翻到背面，添上了观察的位置。\n有些空白不需要再造一个答案。往旁边走几步，就能看见原来还在的东西。\n庭院会保留这份修正。已解锁“折光测绘”旅途涂装，可在操作设置中选择；它只改变外观。你仍可回来观察双环。',
  'You cross out “only one” and write: “Two rings. Adjustment changes their orientation; moving changes their projection.”\nNo support is removed. Instead, the observer adds the viewpoint to the back of the photograph.\nSometimes a blank needs no invented answer. A few steps reveal what was there all along.\nThe corrected record remains here. Refractive Survey is unlocked in the settings’ journey finishes; it changes appearance only. You can return to observe the rings.',
];
export function recordParallaxView(id: string, done: Set<string>, frame: SurveyFrame, station: SurveyPoint, subject: SurveyPoint): boolean {
  if (done.has(PARALLAX.experiment) && !parallaxAligned(done)) return false;
  if ((id !== PARALLAX.front && id !== PARALLAX.side) || !done.has(PARALLAX.started) || done.has(id) || !canRecordView(frame, station, subject)) return false;
  done.add(id); if(done.has(PARALLAX.experiment)&&done.has(PARALLAX.front)&&done.has(PARALLAX.side))done.add(PARALLAX.tested); return true;
}
export function concludeParallax(choice: string, done: Set<string>): boolean {
  if (choice !== 'perspective' || !done.has(PARALLAX.started) || !done.has(PARALLAX.front) || !done.has(PARALLAX.side) || (done.has(PARALLAX.complete)&&!done.has(PARALLAX.experiment)) || (done.has(PARALLAX.experiment)&&!done.has(PARALLAX.tested))) return false;
  done.delete(PARALLAX.experiment); done.add(PARALLAX.complete); return true;
}
