import { ARMORY_MARKER } from '../core/progress';
import type { Localized } from '../settlements/types';
import { VALLEY_STORY, getValleyStoryState } from './valleyStory';

export const VALLEY_PROLOGUE = {
  steward: 'alpha_steward',
  apprentice: 'valley_prologue_azhou',
  worker: 'valley_prologue_guqiao',
  room: 'valley_prologue_pack_radio',
  workshop: 'valley_prologue_radio_handoff',
  briefed: 'valley_prologue_briefed',
  cartStop: 'valley_prologue_cart_stop',
  cartReturn: 'valley_prologue_cart_return',
  radio: 'valley_prologue_radio',
  survey: 'valley_prologue_survey',
  firstSafe: 'valley_prologue_first_safe',
  machinesCleared: 'valley_prologue_machines_cleared',
  breaker: 'valley_prologue_breaker',
  pin: 'valley_prologue_pin',
  ratchet: 'valley_prologue_ratchet',
  record: 'valley_prologue_record',
} as const;

export const VALLEY_RESCUE_ENCOUNTER = 'adventure_valley_rescue';
export const VALLEY_SURVEY_HEIGHT = 1.08;
const P = VALLEY_PROLOGUE;
export const PROLOGUE_LABELS = {
  [P.room]: ['拿起旧收音机', 'Pick up the old radio'],
  [P.workshop]: ['把旧收音机交给工坊', 'Leave the old radio with the workshop'],
  [P.cartStop]: ['抬起轨道挡板', 'Raise the track stop'],
  [P.cartReturn]: ['把工具车推回轨道', 'Push the tool cart back'],
  [P.radio]: ['收听工坊电台', 'Listen to the workshop radio'],
  [P.survey]: ['查看检修平台', 'Inspect the service platform'],
  [P.breaker]: ['拉下本地急停', 'Pull the local cutoff'],
  [P.ratchet]: ['扣上机械棘爪', 'Engage the mechanical ratchet'],
  [P.record]: ['登记现场撤离人数', 'Record the evacuation count'],
} satisfies Record<string, Localized>;

export type ValleyPrologueStage = 'room' | 'briefing' | 'cart' | 'workshop' | 'armory' | 'radio' | 'survey' | 'release' | 'secure' | 'record' | 'complete' | 'legacy';

export function valleyPrologueStage(done: ReadonlySet<string>): ValleyPrologueStage {
  if (done.has(P.record)) return 'complete';
  if (!done.has(P.briefed)) {
    const existingStory = getValleyStoryState(done).stage !== 'meet' || done.has(VALLEY_STORY.discovery);
    return existingStory || done.has('adventure_v2') ? 'legacy' : done.has(P.room) ? 'briefing' : 'room';
  }
  if (!done.has(P.cartStop) && !done.has(P.cartReturn)) return 'cart';
  if (!done.has(ARMORY_MARKER)) return done.has(P.room) && !done.has(P.workshop) ? 'workshop' : 'armory';
  if (!done.has(P.radio)) return 'radio';
  if (!done.has(P.survey)) return 'survey';
  if (!done.has(P.breaker) && !done.has(P.pin)) return 'release';
  return done.has(P.ratchet) ? 'record' : 'secure';
}

export function valleyPrologueGuide(stage: ValleyPrologueStage): { targetId: string; title: Localized; text: Localized } | null {
  const home: Localized = ['序章 · 熟悉这条路', 'Prologue · A Familiar Road'];
  const rescue: Localized = ['序章 · 尚未发生的求救', 'Prologue · A Call Ahead of Time'];
  switch (stage) {
    case 'room': return { targetId: P.room, title: home, text: ['拿起房里的旧收音机。沿楼梯下去，到门口找孟槐。', 'Pick up the old radio. Go down the steps and meet Meng Huai at the entrance.'] };
    case 'briefing': return { targetId: P.steward, title: home, text: ['出发前，到生活馆门口找孟槐领外勤单。', 'Collect your field slip from Meng Huai at the residence entrance.'] };
    case 'cart': return { targetId: P.cartStop, title: home, text: ['帮阿舟拦住工具车。抬起前方挡板，或到车边把它推回去。', 'Help Azhou with the tool cart. Raise the stop ahead or walk to the cart and push it back.'] };
    case 'workshop': return { targetId: P.workshop, title: home, text: ['沿谷地道路到工坊，把旧收音机放在检修桌上。', 'Follow the valley road to the workshop and leave the old radio on the repair bench.'] };
    case 'armory': return { targetId: ARMORY_MARKER, title: home, text: ['沿谷地道路去枪械工坊领装备。靶场可自由试射。', 'Follow the valley road to the armory for your gear. The firing range is optional.'] };
    case 'radio': return { targetId: P.radio, title: rescue, text: ['从工坊西门出去，绕到北侧收听外勤电台。', 'Leave by the armory’s west door and round the north side to the field radio.'] };
    case 'survey': return { targetId: P.survey, title: rescue, text: ['去电台东面的检修平台。比对广播与现场。', 'Go east to the service platform and compare the broadcast with the scene.'] };
    case 'release': return { targetId: P.breaker, title: rescue, text: ['从正面拉下急停，或绕到侧道射断有黄黑标记的保险销。', 'Use the cutoff on the near side or circle around and shoot the striped shear pin.'] };
    case 'secure': return { targetId: P.ratchet, title: rescue, text: ['平台正在下沉。站在地面扣上机械棘爪，打开逃生门。', 'The platform is dropping. Engage the ratchet from solid ground to release the escape gate.'] };
    case 'record': return { targetId: P.record, title: rescue, text: ['到围栏外的记录台，登记真正撤出来的人。', 'Use the desk outside the rail to record who actually got out.'] };
    default: return null;
  }
}

/** Advance by one physical action. The caller validates reachability or the shot. */
export function advanceValleyPrologue(stage: ValleyPrologueStage, id: string, done: Set<string>): Localized | null {
  let flag = id;
  let line: Localized;
  switch (stage) {
    case 'room':
      if (id !== P.room) return null;
      line = ['装好旧收音机。窗边的单子还空着回程时间。', 'Old radio packed. The field slip by the window still has a blank return time.'];
      break;
    case 'briefing':
      if (id !== P.steward) return null;
      flag = P.briefed;
      line = ['第一次独立外勤，给，回程时间空着。出门前帮阿舟扶一下车。回来先吃饭，故事边吃边说。', 'First solo shift. Here’s your slip. Leave the return time blank. Give Azhou a hand with the cart before you go. Dinner first when you get back.'];
      break;
    case 'cart':
      if (id !== P.cartStop && id !== P.cartReturn) return null;
      line = id === P.cartStop ? ['挡板接住了车。我去卸工具。你回来时，试试我接好的屋顶信号线！', 'The stop caught it. I’ll unload the tools. Try my rooftop signal line when you get back!']
        : ['你把车推回去了！我来卸工具。等你回来，我给你看屋顶那条线能传多远。', 'You got the cart back! I’ll unload it. When you’re home I’ll show you how far my rooftop line can reach.'];
      break;
    case 'workshop':
      if (id !== P.workshop) return null;
      line = ['旧机只收不发。工坊留它检修，外勤电台在北门外。先去武器架。', 'The old set can receive but can’t transmit. Leave it here for repair. The field radio is outside the north side. Collect your gear first.'];
      break;
    case 'radio':
      if (id !== P.radio) return null;
      line = ['电台时钟 18:39。收到 18:42 的报文：「检修台坠落。巡护 07 已撤走一人。顾桥不在现场名单。」', 'Radio clock 18:39. Incoming report stamped 18:42: “Service platform collapsed. Patrol 07 evacuated one. Gu Qiao is absent from the manifest.”'];
      break;
    case 'survey':
      if (id !== P.survey) return null;
      line = ['落石打坏了巡检机。07 正把第一名工人扶出去，栏杆后还有人敲击。先让两台失控的机器远离出口，或绕侧道直奔急停。', 'Falling rock has damaged the inspection units. 07 is helping the first worker out. Someone still taps behind the bars. Drive the malfunctioning units away from the exit, or take the side path straight to the cutoff.'];
      break;
    case 'release':
      if (id !== P.breaker && id !== P.pin) return null;
      line = ['电锁松开，失去供电的卷轮也开始下滑。用旁边的棘爪撑住平台。', 'The lock releases and the unpowered winch slips. Use the ratchet to brace the platform.'];
      break;
    case 'secure':
      if (id !== P.ratchet) return null;
      line = ['平台稳住了，逃生门已打开。顾桥可以沿地面撤到围栏外。', 'The platform is braced and the escape gate is open. Gu Qiao can reach the safe side on foot.'];
      break;
    case 'record':
      if (id !== P.record) return null;
      line = ['现场撤离两人。顾桥亲手补上了自己的名字。带着这份记录去找讯号亭的岚。', 'Two evacuated in the field. Gu Qiao adds his own name. Take the record to Lan at the signal kiosk.'];
      break;
    default: return null;
  }
  if (stage !== valleyPrologueStage(done)) return null;
  done.add(flag);
  return line;
}
