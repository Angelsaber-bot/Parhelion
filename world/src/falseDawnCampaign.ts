import type { Localized, RegionId } from './settlements/types';
import type { CampaignChoice } from './campaignEpisodes';

/** Original fan-game continuation, not an official/canonical scenario.
 * All physical access, encounter acceptance, save writes and scene application
 * remain runtime-owned. No existing core, equipment or seam flag is invented.
 */
export const FALSE_DAWN = {
  recorder: 'false_dawn_recorder', harbor: 'false_dawn_harbor_console', winter: 'false_dawn_winter_console',
  array: 'false_dawn_array_console', emitters: ['false_dawn_emitter_1', 'false_dawn_emitter_2', 'false_dawn_emitter_3'],
  receiver: 'campaign_alpha_worked', started: 'false_dawn_started', routeHarbor: 'false_dawn_route_harbor', routeWinter: 'false_dawn_route_winter',
  harborKey: 'false_dawn_harbor_key', winterKey: 'false_dawn_winter_key', arrayStarted: 'false_dawn_array_started',
  anchors: ['false_dawn_anchor_1', 'false_dawn_anchor_2', 'false_dawn_anchor_3'],
  complete: 'false_dawn_complete', rescued: 'false_dawn_signal_repurposed', sealed: 'false_dawn_signal_sealed',
} as const;
export const FALSE_DAWN_ENCOUNTERS = ['false_dawn_courier', 'false_dawn_harbor', 'false_dawn_winter_1', 'false_dawn_winter_2', 'false_dawn_array', 'false_dawn_warden'] as const;
export type FalseDawnEncounterId = typeof FALSE_DAWN_ENCOUNTERS[number];
export const falseDawnEncounterFlags = (id: FalseDawnEncounterId) => ({ started: `${id}_started`, cleared: `${id}_cleared` });
export type FalseDawnStage = 'locked' | 'equipment' | 'lead' | 'courier' | 'route' | 'harbor' | 'harbor-key' | 'winter-one' | 'winter-two' | 'winter-key' | 'return' | 'array' | 'warden' | 'ending' | 'complete';
export interface FalseDawnState {
  stage: FalseDawnStage; route: 'harbor' | 'winter' | null; started: boolean; completed: boolean;
  anchors: readonly [boolean, boolean, boolean]; nextAnchor: 0 | 1 | 2 | null;
  ending: 'repurpose' | 'seal' | null;
}
const cleared = (id: FalseDawnEncounterId, done: ReadonlySet<string>) => done.has(falseDawnEncounterFlags(id).cleared);
export function getFalseDawnState(done: ReadonlySet<string>): FalseDawnState {
  const route = done.has(FALSE_DAWN.routeHarbor) ? 'harbor' : done.has(FALSE_DAWN.routeWinter) ? 'winter' : null;
  const anchors = FALSE_DAWN.anchors.map(flag => done.has(flag)) as [boolean, boolean, boolean];
  const next = anchors.findIndex(value => !value), completed = done.has(FALSE_DAWN.complete), started = done.has(FALSE_DAWN.started);
  const stage: FalseDawnStage = completed ? 'complete' : !done.has(FALSE_DAWN.receiver) ? 'locked' : !done.has('armory_rack') ? 'equipment'
    : !started ? 'lead' : !cleared('false_dawn_courier', done) ? 'courier' : !route ? 'route'
    : route === 'harbor' && !cleared('false_dawn_harbor', done) ? 'harbor' : route === 'harbor' && !done.has(FALSE_DAWN.harborKey) ? 'harbor-key'
    : route === 'winter' && !cleared('false_dawn_winter_1', done) ? 'winter-one' : route === 'winter' && !cleared('false_dawn_winter_2', done) ? 'winter-two'
    : route === 'winter' && !done.has(FALSE_DAWN.winterKey) ? 'winter-key'
    : !done.has(FALSE_DAWN.arrayStarted) ? 'return' : !anchors.every(Boolean) || !cleared('false_dawn_array', done) ? 'array'
    : !cleared('false_dawn_warden', done) ? 'warden' : 'ending';
  return { stage, route, started, completed, anchors, nextAnchor: next < 0 ? null : next as 0 | 1 | 2,
    ending: done.has(FALSE_DAWN.rescued) ? 'repurpose' : done.has(FALSE_DAWN.sealed) ? 'seal' : null };
}
export function getExpectedFalseDawnEncounter(done: ReadonlySet<string>): FalseDawnEncounterId | null {
  switch (getFalseDawnState(done).stage) {
    case 'lead': case 'courier': return 'false_dawn_courier';
    case 'harbor': return 'false_dawn_harbor';
    case 'winter-one': return 'false_dawn_winter_1';
    case 'winter-two': return 'false_dawn_winter_2';
    case 'return': return 'false_dawn_array';
    case 'array': return cleared('false_dawn_array', done) ? null : 'false_dawn_array';
    case 'warden': return 'false_dawn_warden';
    default: return null;
  }
}
export interface FalseDawnGuide { title: Localized; text: Localized; targetId: string; targetKind: 'marker' | 'npc'; region: RegionId; }
const TITLE: Localized = ['主线续篇 · 伪晓回声', 'Campaign Continuation · False Dawn'];
export function getFalseDawnGuide(done: ReadonlySet<string>, context: FalseDawnContext = {}): FalseDawnGuide | null {
  const state = getFalseDawnState(done);
  const at = (text: Localized, targetId: string, region: RegionId = 'alpha', targetKind: 'marker' | 'npc' = 'marker'): FalseDawnGuide => ({ title: TITLE, text, targetId, region, targetKind });
  switch (state.stage) {
    case 'locked': return at(['先帮助岚修好守频接收机。后续线索不要求完成全部五处纪事。', 'First help Lan repair the watch receiver. The new lead does not require completing all five chronicles.'], done.has('campaign_alpha_met') ? 'campaign_alpha_work' : 'alpha_signal_keeper', 'alpha', done.has('campaign_alpha_met') ? 'marker' : 'npc');
    case 'equipment': return at(['线索指向野外的旧收讯阵。先领取原主线的武器；不要空手追踪。', 'The lead points to an abandoned field receiver. Collect your main-story equipment before following it.'], 'armory_rack');
    case 'lead': case 'courier': return at(['沿幻日谷道路找到旧收讯阵，检查倒放的求援录音，截住携带它的回声信使。', 'Find the abandoned receiver off the Valley road, inspect the reversed distress call, and intercept its echo courier.'], FALSE_DAWN.recorder);
    case 'route': return at(['信使留下两条中继记录。回到收讯器，选择港口截讯或雪原守台。两条路任选其一。', 'The courier leaves two relay records. Choose harbor interception or snowfield defense at the receiver. Either route is enough.'], FALSE_DAWN.recorder);
    case 'harbor': return at(['到黑帆的废弃潮汐台截断伪讯号。使用掩体对付远程守卫，不能拿暖港灯当目标。', 'Intercept the false signal at the abandoned tide station in Black Sail. Use cover against ranged guards; the harbor’s warm light is not a target.'], FALSE_DAWN.harbor, 'blacksail');
    case 'harbor-key': return at(['检查已夺回的潮汐台，从真实延迟而非完美重复中辨认回传节拍。', 'Inspect the recovered tide station. Find the return timing in real delay, not perfect repetition.'], FALSE_DAWN.harbor, 'blacksail');
    case 'winter-one': case 'winter-two': return at(['守住雪原转发台。每一波结束后由你确认下一次接通；离开或失败后可回来重试。', 'Defend the snowfield repeater. Confirm each new connection between waves; leave or return after defeat to retry.'], FALSE_DAWN.winter, 'winter');
    case 'winter-key': return at(['雪原转发台已守住。读出带有停顿的回传节拍，不要误信没有呼吸的整齐回声。', 'The repeater is secure. Read the return cadence with its pauses; do not trust an echo too regular to breathe.'], FALSE_DAWN.winter, 'winter');
    case 'return': return at(['带着回传节拍返回幻日谷旧收讯阵，主动接通阵列，逼出复制求援声的源头。', 'Return to the Valley array with the return cadence. Deliberately energize it to expose the source copying distress calls.'], FALSE_DAWN.array);
    case 'array': return !cleared('false_dawn_array', done) && context.activeEncounter !== 'false_dawn_array'
      ? at(['在阵列台重新接通防卫战。已关闭的发射器会保留；未击败的守卫需要重新应对。', 'Restart the defense at the array console. Disabled emitters remain disabled; unfinished defenders must be faced again.'], FALSE_DAWN.array)
      : at(state.nextAnchor === null ? ['三处发射器已关闭，击败阵列守卫后回到控制台。', 'All three emitters are disabled. Defeat the array guards, then return to the console.'] : cleared('false_dawn_array', done) ? ['阵列守卫已被击败。依次关闭剩余的 I 收讯、II 转发、III 播送发射器，再回到控制台。', 'The array guards are defeated. Disable the remaining emitters in order: I Receive, II Relay, III Transmit. Then return to the console.'] : ['迎战时依次关闭 I 收讯、II 转发、III 播送发射器。操作不会暂停战斗；先读清敌人的预警。', 'During the battle, disable I Receive, II Relay, then III Transmit. These actions do not pause combat; read the enemy tells first.'], state.nextAnchor === null ? FALSE_DAWN.array : FALSE_DAWN.emitters[state.nextAnchor]);
    case 'warden': return at(['回到阵列控制台，挑战回声守门者。关闭的发射器已不再替它遮掩；分清直线突刺与大范围重击，等恢复时再反击。', 'Return to the console to face the Echo Warden. The disabled emitters no longer conceal it. Distinguish its locked thrust from its heavy sweep, then punish the recovery.'], FALSE_DAWN.array);
    case 'ending': return at(['源头已被击败。回到阵列台，决定保留一个真正的求援频道，还是封存复制讯号的装置。', 'The source is defeated. At the array console, choose a genuine rescue channel or seal the signal-copying device.'], FALSE_DAWN.array);
    case 'complete': return null;
  }
}

export interface FalseDawnContext { activeEncounter?: string | null; }
export interface FalseDawnInteraction {
  handled: boolean; changed: boolean; dialogue: Localized | null; speaker: Localized;
  choices: readonly CampaignChoice[] | null; encounter: FalseDawnEncounterId | null;
  /** Combat-time switches must use this non-pausing message, not a dialogue. */
  toast: Localized | null; state: FalseDawnState;
}
const SPEAKER: Localized = ['守频联络 · 岚', 'Watch Channel · Lan'];
function response(done: ReadonlySet<string>, extra: Partial<Omit<FalseDawnInteraction, 'state'>> = {}): FalseDawnInteraction {
  return { handled: true, changed: false, dialogue: null, speaker: SPEAKER, choices: null, encounter: null, toast: null, state: getFalseDawnState(done), ...extra };
}
const START: Localized = [
  '录音先说出了你还没有问出口的话：“有人在吗？”\n岚在联络器上说：“那不是预言。它把听见过的声音拼在一起，想让人追过去。”一枚移动的讯号正接近收讯阵。准备好，再接通。',
  'The recording asks the question before you do: “Is anybody there?”\nLan answers through the communicator: “Not a prophecy. It stitches together voices it has heard and makes people follow.” A moving signal is approaching the receiver. Connect only when ready.',
];
const ROUTE: Localized = [
  '信使没有留下人名，只有同一段求援声的两份副本。一份沿潮水回传，一份藏在雪原的烽火间隔里。\n岚说：“我们要找的不是谁喊得更像，是谁真的等过回答。”选择一条路拿到回传节拍；另一处不会因此被判定完成。',
  'The courier carries no names, only two copies of one distress call. One returns with the tide; the other hides between snowfield beacon pulses.\nLan says, “We are not looking for the best imitation. We need a voice that actually waited for an answer.” Choose one route to recover the return cadence; the other is not marked complete.',
];
const CHOOSE_ROUTE: readonly CampaignChoice[] = [
  { id: 'route_harbor', label: ['港口截讯：掩体间压制远程守卫', 'Harbor interception: counter ranged guards from cover'] },
  { id: 'route_winter', label: ['雪原守台：应对两波近战推进', 'Snowfield defense: hold against two advancing waves'] },
];
const FINAL_CHOICES: readonly CampaignChoice[] = [
  { id: 'ending_repurpose', label: ['拆除复制回路，保留真正的求援频道', 'Remove the copying circuit; keep a genuine rescue channel'] },
  { id: 'ending_seal', label: ['封存装置，把求援工作交回守频员', 'Seal the device; return rescue communications to the watch'] },
];
const ENCOUNTER_ORIGIN: Readonly<Record<FalseDawnEncounterId, string>> = {
  false_dawn_courier: FALSE_DAWN.recorder, false_dawn_harbor: FALSE_DAWN.harbor,
  false_dawn_winter_1: FALSE_DAWN.winter, false_dawn_winter_2: FALSE_DAWN.winter,
  false_dawn_array: FALSE_DAWN.array, false_dawn_warden: FALSE_DAWN.array,
};
export function getFalseDawnEncounterOrigin(id: FalseDawnEncounterId): string { return ENCOUNTER_ORIGIN[id]; }
function encounterPrompt(done: ReadonlySet<string>, id: FalseDawnEncounterId): FalseDawnInteraction {
  const labels: Record<FalseDawnEncounterId, Localized> = {
    false_dawn_courier: ['接通收讯器，截住回声信使', 'Connect the receiver and intercept the courier'],
    false_dawn_harbor: ['打开潮汐遮板，截断伪讯号', 'Open the tide shutter and intercept the signal'],
    false_dawn_winter_1: ['接通第一段转发，守住雪原台', 'Connect the first repeater and defend the station'],
    false_dawn_winter_2: ['接通第二段转发，迎接下一波', 'Connect the second repeater and face the next wave'],
    false_dawn_array: ['启动阵列，开始关闭三处发射器', 'Energize the array and disable its three emitters'],
    false_dawn_warden: ['引出回声守门者', 'Expose the Echo Warden'],
  };
  return response(done, { dialogue: id === 'false_dawn_courier' ? START : getFalseDawnGuide(done)!.text,
    choices: [{ id: `start:${id}`, label: labels[id] }, { id: 'later', label: ['先准备，稍后再接通', 'Prepare first; connect later'] }] });
}
export function interactFalseDawn(id: string, done: Set<string>, context: FalseDawnContext = {}): FalseDawnInteraction {
  const known = [FALSE_DAWN.recorder, FALSE_DAWN.harbor, FALSE_DAWN.winter, FALSE_DAWN.array, ...FALSE_DAWN.emitters] as readonly string[];
  if (!known.includes(id)) return response(done, { handled: false });
  const state = getFalseDawnState(done);
  if (state.completed) {
    if (id === FALSE_DAWN.array) return response(done, { dialogue: getFalseDawnEnding(done) });
    if ((FALSE_DAWN.emitters as readonly string[]).includes(id)) return response(done, { toast: state.ending === 'repurpose'
      ? ['复制发射器已关闭；保留下来的是有人值守的频道。', 'The copying emitter is disabled. The remaining channel has a person on watch.']
      : ['复制发射器已封存，不必再次操作。', 'The copying emitter is sealed; no further operation is needed.'] });
    if (id === FALSE_DAWN.recorder) return response(done, { dialogue: ['记录器不再抢先作答。想重读这次调查的记录，可以查看旁边的阵列台。', 'The recorder no longer answers first. Reread the investigation record at the nearby array console.'] });
    const chosen = id === FALSE_DAWN.harbor ? state.route === 'harbor' : state.route === 'winter';
    return response(done, { toast: chosen ? ['这段回传节拍已经比对过，调查记录仍在谷地阵列台。', 'This return cadence is already compared. The investigation record remains at the Valley array.']
      : ['你循另一条线索结束了调查；这处未选路线不会被记为已完成遭遇。', 'You resolved the investigation through the other lead; this unchosen route is not recorded as a cleared encounter.'] });
  }
  const emitter = (FALSE_DAWN.emitters as readonly string[]).indexOf(id);
  if (emitter >= 0) {
    if (done.has(FALSE_DAWN.anchors[emitter])) return response(done, { toast: ['这处发射器已经关闭。', 'This emitter is already disabled.'] });
    if (state.stage !== 'array') return response(done, { toast: ['阵列尚未接通。先追踪伪晓讯号的源头。', 'The array is dormant. Trace the False Dawn signal first.'] });
    if (context.activeEncounter !== 'false_dawn_array' && !cleared('false_dawn_array', done)) return response(done, { toast: ['先在阵列控制台重新接通防卫战。', 'Restart the defense at the array console first.'] });
    if (state.nextAnchor !== emitter) return response(done, { toast: ['先断收讯，再断转发，最后断播送：按 I、II、III 的顺序。', 'Cut Receive, then Relay, then Transmit: follow I, II, III.'] });
    done.add(FALSE_DAWN.anchors[emitter]);
    return response(done, { changed: true, toast: [
      `发射器 ${emitter + 1}/3 已关闭${emitter === 2 ? cleared('false_dawn_array', done) ? '。返回阵列台，准备引出守门者。' : '。守住阵列，别让未击败的守卫逼近。' : '。继续沿下一处标记移动。'}`,
      `Emitter ${emitter + 1}/3 disabled.${emitter === 2 ? cleared('false_dawn_array', done) ? ' Return to the array console to prepare for the Warden.' : ' Hold the array against any remaining guards.' : ' Move toward the next marked station.'}`,
    ] });
  }
  if (context.activeEncounter) return response(done, { toast: ['讯号正在接通。先应对现场威胁；发射器可在战斗中操作。', 'The signal is active. Deal with the threat; emitter switches remain usable during combat.'] });
  if (state.stage === 'locked' || state.stage === 'equipment') return response(done, { dialogue: getFalseDawnGuide(done)!.text });
  if (state.stage === 'route' && id === FALSE_DAWN.recorder) return response(done, { dialogue: getFalseDawnRouteBriefing(done), choices: CHOOSE_ROUTE });
  if ((state.stage === 'harbor-key' && id === FALSE_DAWN.harbor) || (state.stage === 'winter-key' && id === FALSE_DAWN.winter)) return response(done, {
    dialogue: state.stage === 'harbor-key' ? ['潮汐记录里，一段回声每次分毫不差；另一段在浪声后停顿，才有人回答。哪个节拍值得带回去？', 'One tide record repeats without the slightest change. Another pauses after the surf before someone replies. Which cadence should you take back?']
      : ['两轮接通后，记录出现两种节拍：整齐得没有呼吸的重复，以及被换气和风声打断、却仍能回应的来声。', 'After both connections, the log holds two rhythms: a repetition too regular to breathe, and a reply interrupted by breath and wind.'],
    choices: [{ id: 'key_perfect', label: ['选择没有误差的整齐重复', 'Take the perfectly regular repetition'] }, { id: 'key_living', label: ['选择留出呼吸和等待的回传', 'Take the return with breathing room and delay'] }],
  });
  if (state.stage === 'ending' && id === FALSE_DAWN.array) return response(done, { dialogue: [
    '守门者倒下后，装置还在重复：“有人在吗？”这次它没有追兵，也没有答案。\n岚说：“我们可以拆掉复制回路，只留下一个让人真正回答的频道。也可以封存它，不再让机器替人开口。”',
    'After the Warden falls, the device keeps asking, “Is anybody there?” This time there is no pursuer, and no answer.\nLan says, “We can remove the copying circuit and leave a channel where someone can truly answer. Or seal it and stop letting a machine speak for people.”',
  ], choices: FINAL_CHOICES });
  const encounter = getExpectedFalseDawnEncounter(done);
  if (encounter && ENCOUNTER_ORIGIN[encounter] === id) return encounterPrompt(done, encounter);
  return response(done, { dialogue: getFalseDawnGuide(done)!.text });
}
export function chooseFalseDawn(origin: string, choiceId: string, done: Set<string>, context: FalseDawnContext = {}): FalseDawnInteraction {
  const state = getFalseDawnState(done);
  if (context.activeEncounter) return response(done, { toast: ['已有遭遇正在进行。', 'An encounter is already active.'] });
  if (choiceId === 'later') return response(done, { dialogue: ['接通前仍可以离开。准备好再回来；已完成的调查不会丢失。', 'You can leave before connecting. Return when ready; completed investigations are retained.'] });
  if (choiceId.startsWith('start:')) {
    const id = choiceId.slice(6) as FalseDawnEncounterId;
    if (getExpectedFalseDawnEncounter(done) !== id || ENCOUNTER_ORIGIN[id] !== origin) return response(done, { toast: ['当前阶段不能接通这场遭遇。请重新检查现场。', 'That encounter is unavailable at this stage. Inspect the site again.'] });
    return response(done, { encounter: id });
  }
  if (state.stage === 'route' && origin === FALSE_DAWN.recorder && (choiceId === 'route_harbor' || choiceId === 'route_winter')) {
    done.add(choiceId === 'route_harbor' ? FALSE_DAWN.routeHarbor : FALSE_DAWN.routeWinter);
    const gate: Localized = done.has('summon_circle') ? ['', ''] : ['\n前往时层仍需沿原主线稳定召唤阵；这份线索不会自动打开断面。', '\nReaching an era still requires stabilizing the main-story summoning circle. This lead does not open a seam for you.'];
    const text = getFalseDawnGuide(done)!.text;
    return response(done, { changed: true, dialogue: [text[0] + gate[0], text[1] + gate[1]] });
  }
  if (((state.stage === 'harbor-key' && origin === FALSE_DAWN.harbor) || (state.stage === 'winter-key' && origin === FALSE_DAWN.winter)) && (choiceId === 'key_perfect' || choiceId === 'key_living')) {
    if (choiceId === 'key_perfect') {
      const retry = interactFalseDawn(origin, done);
      return response(done, { dialogue: ['岚指出每一次一模一样的底噪：“这是复制出来的，不是有人等过回答。再听一次。”', 'Lan points out the identical background noise. “A copy. Nobody waited for an answer here. Listen once more.”'], choices: retry.choices });
    }
    done.add(state.stage === 'harbor-key' ? FALSE_DAWN.harborKey : FALSE_DAWN.winterKey);
    return response(done, { changed: true, dialogue: ['你留下真实回传里的停顿。岚把它与谷地录音叠在一起，伪讯号错开的那一拍，暴露了旧收讯阵下面的复制回路。\n返回幻日谷。接通阵列后，依次关闭 I 收讯、II 转发、III 播送；这一次，不追声音，截断它的路。', 'You preserve the pauses in the genuine return. Lan aligns them with the Valley recording. The false signal slips by one beat, exposing the copying circuit beneath the old receiver.\nReturn to the Valley. Energize the array, then disable I Receive, II Relay, III Transmit. This time, do not chase the voice. Cut its route.'] });
  }
  if (state.stage === 'ending' && origin === FALSE_DAWN.array && (choiceId === 'ending_repurpose' || choiceId === 'ending_seal')) {
    done.add(FALSE_DAWN.complete); done.add(choiceId === 'ending_repurpose' ? FALSE_DAWN.rescued : FALSE_DAWN.sealed);
    return response(done, { changed: true, dialogue: getFalseDawnEnding(done) });
  }
  return response(done, { toast: ['这次决定已经过期。请重新查看当前目标。', 'That decision is no longer current. Inspect the active objective again.'] });
}
/** Invoke only after the combat director has accepted ALL safe actor placements. */
export function confirmFalseDawnEncounterStart(id: string, done: Set<string>): FalseDawnInteraction {
  if (!FALSE_DAWN_ENCOUNTERS.includes(id as FalseDawnEncounterId) || getExpectedFalseDawnEncounter(done) !== id) return response(done, { handled: false });
  const encounter = id as FalseDawnEncounterId, flag = falseDawnEncounterFlags(encounter).started;
  let changed = false;
  const add = (flag: string) => { if (!done.has(flag)) { done.add(flag); changed = true; } };
  add(flag);
  if (id === 'false_dawn_courier') add(FALSE_DAWN.started);
  if (id === 'false_dawn_array') add(FALSE_DAWN.arrayStarted);
  return response(done, { changed, toast: ['讯号已接通。离开或失败不会抹去已完成的调查；未结束的遭遇需要重新接通。', 'Signal connected. Leaving or defeat preserves finished investigations; restart any unfinished encounter at its console.'] });
}
/** Actual director victory only, never a proximity/interaction or kill-count guess. */
export function recordFalseDawnEncounterVictory(id: string, done: Set<string>): FalseDawnInteraction {
  if (!FALSE_DAWN_ENCOUNTERS.includes(id as FalseDawnEncounterId) || getExpectedFalseDawnEncounter(done) !== id || !done.has(falseDawnEncounterFlags(id as FalseDawnEncounterId).started)) return response(done, { handled: false });
  const flag = falseDawnEncounterFlags(id as FalseDawnEncounterId).cleared;
  if (done.has(flag)) return response(done, { handled: true });
  done.add(flag);
  return response(done, { changed: true, toast: getFalseDawnGuide(done)?.text ?? ['伪晓源头已安静。', 'The source of False Dawn is quiet.'] });
}
export function getFalseDawnEnding(done: ReadonlySet<string>): Localized {
  const ending: Localized = done.has(FALSE_DAWN.rescued) ? [
    '复制回路被拆除，发射器只剩一道稳定的暖光。岚没有让它替任何人答话，只把守频值班表挂在控制台旁。\n“有人在吗？”频道里又响起这句话。这一次，回答晚了一拍——是岚亲口说的：“在。慢慢说。”\n伪晓回声结束。道路和原来的约定都还在；不是每一声呼唤都该追，但每个真正等待的人，都值得有个回答。',
    'The copying circuit is removed. One steady warm light remains. Lan does not let it answer for anyone; a watch rota hangs beside the console.\n“Is anybody there?” asks the channel again. This time the answer is a beat late—Lan speaking in person: “Yes. Take your time.”\nFalse Dawn is over. The roads and earlier promises remain. Not every call should be followed, but someone truly waiting deserves an answer.',
  ] : [
    '复制回路的接头被封进匣子，三座发射器都熄灭了。岚把地点记进巡查册，没有把机器的沉默写成所有人的沉默。\n生活馆的守频器仍亮着。以后有人求援，回答来自守在那里的一个人，而不是一段借来的声音。\n伪晓回声结束。道路和原来的约定都还在；这一次，你没有把另一个人的等待交给回声。',
    'The copying circuit is sealed in its case and all three emitters go dark. Lan marks the place for inspection without mistaking the machine’s silence for everyone’s silence.\nThe residence receiver remains lit. When someone calls for help, an actual person on watch will answer—not a borrowed voice.\nFalse Dawn is over. The roads and earlier promises remain. This time, you did not entrust another person’s waiting to an echo.',
  ];
  const route = getFalseDawnState(done).route;
  if (route) {
    const memory: Localized = route === 'harbor'
      ? ['你从潮汐台带回的那一拍等待，留在了归路记录里：真实的回应不必完美重复。', 'The waiting beat you recovered at the tide station remains in the record: a genuine answer need not repeat perfectly.']
      : ['你在两轮雪原接通之间守住的那段停顿，留在了归路记录里：活人的回应，需要喘息的时间。', 'The pause you held between the snowfield connections remains in the record: a living answer needs time to breathe.'];
    return [`${ending[0]}\n${memory[0]}`, `${ending[1]}\n${memory[1]}`];
  }
  return ending;
}

/** Earlier optional work changes recollection, never encounter admission or rewards. */
export function getFalseDawnRouteBriefing(done: ReadonlySet<string>): Localized {
  const lines: Localized[] = [ROUTE];
  if (done.has('campaign_blacksail_worked')) lines.push(['岚翻到你与玛拉核对过的货单：“没有口粮的船，和从不等待回答的声音。我们已经见过一次这样的矛盾。”', 'Lan opens the manifest you checked with Mara. “Boats without rations, voices that never wait for an answer. We have seen this kind of contradiction before.”']);
  if (done.has('campaign_winter_worked')) lines.push(['你替米哈伊固定担架时留下的绑带标记，让雪原记录里的停顿有了分量：行路的人，需要彼此等一等。', 'The strap marks from your work with Mikhail give weight to the pauses in the snowfield log: people on a road need time to wait for one another.']);
  return [lines.map(line => line[0]).join('\n'), lines.map(line => line[1]).join('\n')];
}

/** Original adaptation dialogue, not quotations. Caller must establish that the
 * contracted companion is actually summoned, loaded and near the player.
 * Read on deliberate dialogue only; never emit from an animation/update loop.
 */
export function getFalseDawnCompanionReaction(id: string | null | undefined, done: ReadonlySet<string>): { speaker: Localized; line: Localized } | null {
  if (!id || !['saber', 'blackbeard', 'napoleon', 'musashi'].includes(id)) return null;
  const state = getFalseDawnState(done);
  if (state.stage === 'locked' || state.stage === 'equipment') return null;
  const names: Record<string, Localized> = { saber: ['Saber', 'Saber'], blackbeard: ['黑胡子', 'Blackbeard'], napoleon: ['拿破仑', 'Napoleon'], musashi: ['宫本武藏', 'Miyamoto Musashi'] };
  const beat = state.completed ? state.ending === 'repurpose' ? 'rescue' : 'seal'
    : ['return', 'array', 'warden', 'ending'].includes(state.stage) ? 'array' : state.route ? state.route : 'trace';
  const lines: Record<string, Record<string, Localized>> = {
    saber: {
      trace: ['声音可以模仿命令，却不能替人立誓。先找出是谁在承担那句求援。', 'A voice can imitate an order. It cannot swear an oath for someone. First find who stands behind the call.'],
      harbor: ['让船留在安全的等待线。击败守卫之前，不要把希望当作通航的保证。', 'Keep the boats on the holding line. Until the guards fall, hope is not a guarantee of safe passage.'],
      winter: ['两次接通，两次守住。没有人要求你在准备之前冲出去。', 'Two connections, two defenses. No one asks you to charge before you are ready.'],
      array: ['先看它出手，再决定自己的步子。守住别人，不等于站着承受每一击。', 'Read its strike before choosing your step. Protecting others does not mean standing still for every blow.'],
      rescue: ['你留下的不是一句自动重复的承诺，而是一个愿意回答的位置。这就足够了。', 'You left not an automatically repeated promise, but a place for someone willing to answer. That is enough.'],
      seal: ['封起一件危险的工具，不是抛弃求援者。我们仍然在这里。', 'Sealing a dangerous instrument is not abandoning those who call for help. We are still here.'],
    },
    blackbeard: {
      trace: ['连求援都偷别人的？这家伙比只会印假藏宝图的还没品。先抓住带信的，再算账。', 'Stealing distress calls? Worse manners than selling fake treasure maps. Catch the messenger first; settle the bill after.'],
      harbor: ['船装满，饭一口不吃——不是幽灵，就是最抠门的船长。拿掩体挡枪，别拿脸。', 'Full cargo, no meals—ghosts, or the cheapest captain alive. Stop their shots with cover, not your face.'],
      winter: ['雪里我不跟你比谁站得久。打一波，喘口气；活着领下一班值守才叫本事。', 'I am not competing to stand longest in the snow. One wave, then a breath. Surviving the next watch is the clever part.'],
      array: ['收、转、发，三个机关三笔账。顺着拆，别一见大个子就忘了账本。', 'Receive, relay, transmit—three circuits, three debts. Dismantle them in order. Do not forget the ledger when the big fellow appears.'],
      rescue: ['不再乱抄别人的嗓子，倒能当个正经港灯了。行，这笔买卖我认。', 'No more borrowing strangers’ voices; it might make an honest harbor light yet. Fine. That is a deal I can respect.'],
      seal: ['坏罗盘锁进箱子，真航路还在。走吧，回去找点不像干粮的东西。', 'Lock the bad compass away; the real sea route remains. Come on. Let us find food that is not hardtack.'],
    },
    napoleon: {
      trace: ['真正的呼声，会给回答留出时间。让我们找到那一拍停顿！', 'A real call leaves time for an answer. Let us find that missing beat!'],
      harbor: ['他们把火力摆在明处，就把装填时的空隙留给了我们。掩体间前进，不必和枪口比耐心。', 'They show us their firepower—and the pause while they reload. Advance between cover. No need to outstare a muzzle.'],
      winter: ['一段一段接通。把能守住的路连起来，比喊着一口气走完更有用。', 'Connect one stretch at a time. A chain of defensible ground is worth more than a promise to march it all at once.'],
      array: ['这东西想让所有声音步调一致。偏不！突刺就侧移，重击就拉开，把自己的节奏打回来。', 'It wants every voice to march in lockstep. Not ours! Sidestep the thrust, give the heavy strike room, and win back your own rhythm.'],
      rescue: ['一盏灯，一个值班的人——这可比一千次空喊“放心”更像希望。', 'One light and one person on watch—that looks more like hope than a thousand empty reassurances.'],
      seal: ['能让人相信的，不一定是永不熄灭的机器。也可以是明早还会来接班的人。', 'Faith need not rest on a machine that never goes dark. It can rest on the person who returns for tomorrow’s watch.'],
    },
    musashi: {
      trace: ['抢在你前面作答，像是猜你的出刀。那就别跟着它的拍子走。', 'Answering before you speak—like guessing your next cut. Then stop following its rhythm.'],
      harbor: ['远的会开枪，近的会拦路。别盯着一个，把另一边留给别人出刀。', 'One shoots from far away; another bars the close path. Stare at either and you offer the other a cut.'],
      winter: ['第二波还没来，就先把第一波打明白。手里的这一刀，比下一刀的想象管用。', 'Understand the first wave before worrying about the second. The cut in your hands is more useful than the one in your imagination.'],
      array: ['直刺窄，重扫宽。别只看它抬手，看看它把脚落在哪里。等它收势，我们再说话。', 'A thrust is narrow; a heavy sweep is wide. Watch where its feet settle, not just its raised hand. We can talk when it recovers.'],
      rescue: ['这回，回答慢了一点。挺好。活人总得先吸一口气。', 'The answer was a little late this time. Good. A living person needs to take a breath.'],
      seal: ['刀入鞘了，路还在。别把结束一场架，当成结束所有相逢。', 'The blade is sheathed; the road remains. Ending one fight does not end every meeting.'],
    },
  };
  return { speaker: names[id], line: lines[id][beat] };
}

const MARKER_LABELS: Readonly<Record<string, Localized>> = {
  [FALSE_DAWN.recorder]: ['检查旧收讯器', 'Inspect the old receiver'],
  [FALSE_DAWN.harbor]: ['操作潮汐截讯台', 'Operate the tide interceptor'],
  [FALSE_DAWN.winter]: ['操作雪原转发台', 'Operate the snowfield repeater'],
  [FALSE_DAWN.array]: ['操作回声阵列', 'Operate the echo array'],
  [FALSE_DAWN.emitters[0]]: ['I · 收讯发射器', 'I · Receive emitter'],
  [FALSE_DAWN.emitters[1]]: ['II · 转发发射器', 'II · Relay emitter'],
  [FALSE_DAWN.emitters[2]]: ['III · 播送发射器', 'III · Transmit emitter'],
};
/** Small interaction prompt labels; never reuse a multi-paragraph guide here. */
export function getFalseDawnMarkerLabel(id: string): Localized | null {
  const label = Object.hasOwn(MARKER_LABELS, id) ? MARKER_LABELS[id] : null;
  return label ? [...label] : null;
}

export interface FalseDawnObjective { title: Localized; line: Localized; }
/** Compact, truthful HUD text for an explicitly tracked continuation only.
 * Runtime may add its real remaining-actor count separately. No simulated count
 * or time-to-completion is inferred from saved flags.
 */
export function getFalseDawnObjective(done: ReadonlySet<string>, activeEncounter?: string | null): FalseDawnObjective | null {
  const state = getFalseDawnState(done);
  const act = ['locked','equipment','lead','courier','route'].includes(state.stage) ? 1
    : ['harbor','harbor-key','winter-one','winter-two','winter-key'].includes(state.stage) ? 2 : 3;
  const title: Localized = [`伪晓回声 · 第${act}幕`, `False Dawn · Act ${act}`];
  const at = (line: Localized): FalseDawnObjective => ({ title, line });
  switch (state.stage) {
    case 'locked': return at(['与岚交谈，完成接收机的两步检修。', 'Speak with Lan and complete the receiver’s two repair steps.']);
    case 'equipment': return at(['先到原主线军械架领取武器。', 'Collect your equipment from the original armory rack first.']);
    case 'lead': return at(['检查谷地旧收讯器，自主接通追踪。', 'Inspect the old Valley receiver; connect the trace when ready.']);
    case 'courier': return at(activeEncounter === 'false_dawn_courier'
      ? ['截住回声信使；先读预警，再反击。', 'Intercept the Echo Courier. Read its attack tell, then counter.']
      : ['返回旧收讯器，重新接通尚未完成的追踪。', 'Return to the old receiver to restart the unfinished interception.']);
    case 'route': return at(['在旧收讯器选择港口截讯或雪原守台。', 'At the receiver, choose harbor interception or snowfield defense.']);
    case 'harbor': return at(activeEncounter === 'false_dawn_harbor'
      ? ['借掩体击败潮汐台守卫，再检查控制台。', 'Use cover to defeat the tide-station guards, then inspect the console.']
      : ['到港口潮汐台，自主接通截讯战。', 'Reach the harbor tide station and deliberately start the interception.']);
    case 'harbor-key': return at(['核对潮汐记录，找出真正等待过的回传。', 'Compare the tide records; find the return that waited for an answer.']);
    case 'winter-one': return at(activeEncounter === 'false_dawn_winter_1'
      ? ['第1波：守住中继；需要时靠近火盆。', 'Wave 1: defend the repeater; use the brazier when you need warmth.']
      : ['在雪原台旁取暖，再接通第1波。', 'Warm up beside the snowfield station, then connect wave 1.']);
    case 'winter-two': return at(activeEncounter === 'false_dawn_winter_2'
      ? ['第2波：避开突进与重击，守住中继。', 'Wave 2: evade advancing attacks and heavy strikes; hold the repeater.']
      : ['第1波已完成；准备好后主动接通第2波。', 'Wave 1 is complete. Connect wave 2 only when ready.']);
    case 'winter-key': return at(['读取雪原来声，辨认呼吸与停顿。', 'Read the snowfield return; identify breathing room and pauses.']);
    case 'return': return at(['返回谷地阵列台，准备关闭三处发射器。', 'Return to the Valley array console; prepare to disable three emitters.']);
    case 'array': {
      const guardsCleared = cleared('false_dawn_array', done);
      if (!guardsCleared && activeEncounter !== 'false_dawn_array') return at(['回阵列台重启守卫战；已关闭的开关保留。', 'Restart at the array console; disabled emitters remain saved.']);
      if (state.nextAnchor === null) return at(['三处发射器已关闭；击败剩余守卫。', 'All three emitters are disabled. Defeat the remaining guards.']);
      const names: readonly Localized[] = [['I 收讯','I Receive'],['II 转发','II Relay'],['III 播送','III Transmit']];
      const name = names[state.nextAnchor];
      return guardsCleared ? at([`守卫已击败；下一处关闭 ${name[0]}。`, `Guards defeated. Next disable ${name[1]}.`])
        : at([`边迎战边依次关闭 I→II→III。下一处：${name[0]}。`, `Fight and disable I → II → III in order. Next: ${name[1]}.`]);
    }
    case 'warden': return at(activeEncounter === 'false_dawn_warden'
      ? ['守门者：侧移躲突刺，退开重扫，抓住恢复。', 'Warden: sidestep the thrust, leave the sweep, then punish recovery.']
      : ['回到阵列台，准备好后引出回声守门者。', 'Return to the array console; expose the Echo Warden when ready.']);
    case 'ending': return at(['在阵列台决定保留求援频道，或封存复制回路。', 'At the console, choose a rescue channel or seal the copying circuit.']);
    case 'complete': return null;
  }
}
