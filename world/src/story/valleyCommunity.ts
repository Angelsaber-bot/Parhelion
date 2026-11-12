import type { Localized } from '../settlements/types';
import { JOURNEY } from './worldJourney';

export const MIST_RESCUE = {
  intake: 'valley_mist_intake', upper: 'valley_mist_upper_pipe', lower: 'valley_mist_lower_pipe',
  hatch: 'valley_mist_release_hatch', safe: 'valley_mist_worker_safe',
} as const;
export const FREIGHT_YARD = {
  notice: 'valley_yard_notice', practice: 'valley_yard_practice', west: 'valley_yard_cover_west',
  east: 'valley_yard_cover_east', load: 'valley_yard_hook_load', loadTest: 'valley_yard_load_test',
  decision: 'valley_yard_decision', training: 'valley_yard_training', workshop: 'valley_yard_workshop',
  variant: 'valley_yard_variant', variantDone: 'valley_yard_variant_done',
} as const;
export const OLD_TICKET = {
  meet: 'valley_ticket_meet', mile: 'valley_ticket_mile', terminus: 'valley_ticket_terminus',
  seat: 'valley_ticket_seat',
} as const;
export const NEXT_SHIFT = {
  orders: 'valley_shift_orders', brake: 'valley_shift_brake', load: 'valley_shift_load',
  handoff: 'valley_shift_handoff', view: 'valley_shift_view',
} as const;

const M = MIST_RESCUE, Y = FREIGHT_YARD, T = OLD_TICKET, N = NEXT_SHIFT;
type Step = { id: string; label: Localized; line: Localized; requires: readonly string[] };
const step = (id: string, label: Localized, line: Localized, ...requires: string[]): Step => ({ id, label, line, requires });
const mist = [
  step(M.intake, ['雾瀑 · 在水声间听管道', 'Mistfall · Listen between the falls'],
    ['水声会盖过敲击。上渠和下渠都留有检修听管，听两处才知道声音在哪一段。', 'The falls drown the knocks. Check the listening pipes above and below to locate the trapped worker.']),
  step(M.upper, ['上渠 · 听上层管道', 'Upper channel · Listen to the upper pipe'],
    ['上面先响一声，隔了好久才回声。敲击点比这里低。', 'One knock, then a late echo. The worker is below this pipe.'], M.intake),
  step(M.lower, ['下渠 · 听下层管道', 'Lower channel · Listen to the lower pipe'],
    ['下管先传回三短一长。声音就在两段听管之间的检修室。', 'Three short knocks and a long one. The service room is between the two pipes.'], M.intake),
  step(M.hatch, ['检修室 · 松开变形门栓', 'Service room · Free the jammed latch'],
    ['检修工：“等我跨过下渠的黄线。上层步道的闸我已经松了，回头你可以直接上去。”', 'Worker: “Wait for me to clear the yellow line. I’ve freed the upper walkway latch so you can take it straight up.”'], M.upper, M.lower),
  step(M.safe, ['安全线 · 目送检修工上岸', 'Safety line · Confirm the worker is clear'],
    ['检修工：“这段我能走。等镇外站有空，我把那片漏雨的雨棚也补上。”', 'Worker: “I can walk from here. I’ll patch that leaky outpost roof when the crew has a free shift.”'], M.hatch),
];
const yard = [
  step(Y.notice, ['下堤货栈 · 听两种提案', 'Freight shed · Hear both proposals'],
    ['孟槐想留出邻里能借用的工作台，许青想留出有掩体的协作场。先试一次换位，再试一次吊具，货道两边都要留空。', 'Meng Huai wants a shared workbench. Xu Qing wants cover for team drills. Try both layouts and keep both ends of the freight lane clear.']),
  step(Y.practice, ['下堤货栈 · 和当前从者开始换位', 'Freight shed · Start a drill with your companion'],
    ['让从者跟到第一处挡板。第一声铃后走过货道，到另一处挡板回看伙伴，再按第二个信号。', 'Let your companion close to the first barricade. On the first bell, cross the lane. Check that they reach the other barricade, then signal again.'], Y.notice),
  step(Y.west, ['西挡板 · 打第一次掩护信号', 'West cover · Signal the first crossing'],
    ['第一声铃。沿着两道护板之间换位。', 'First bell. Move between the two barricades.'], Y.practice),
  step(Y.east, ['东挡板 · 等从者到达并回铃', 'East cover · Signal when your companion arrives'],
    ['两边都到位了。可以加练一次反向换位，也可以去试吊具。', 'Both of you are in position. Try the reverse drill, or test the hoist.'], Y.west),
  step(Y.load, ['共同工坊 · 扣住配重吊钩', 'Shared workshop · Clip the test load'],
    ['钩已经闭合，配重开始抬升。等黄标到位后再做承重验收。', 'The hook is closed and the load is rising. Wait for the yellow line before signing off.'], Y.notice),
  step(Y.loadTest, ['共同工坊 · 核对承重黄线', 'Shared workshop · Check the load against the line'],
    ['许青核完下梁的承重，孟槐把通道标回地上。这套布置能给住户使用。', 'Xu Qing checks the lower beam. Meng Huai marks the freight lane on the floor. The neighbors can use this layout.'], Y.load),
  step(Y.decision, ['下堤货栈 · 选择长期用途', 'Freight shed · Choose the permanent layout'],
    ['两种试运都过了。货车还是从中间过，沿边放公共挡板或保留吊具和邻里工作台。', 'Both trials passed. Freight still runs down the middle. Keep the public barricades, or keep the hoist and shared benches.'], Y.east, Y.loadTest),
  step(Y.variant, ['东挡板 · 试一次反向换位', 'East cover · Try the reverse drill'],
    ['从东挡板换到西挡板。到达后等从者就位再回铃。', 'Cross from the east barricade to the west. Wait for your companion before you signal.'], Y.east),
  step(Y.variantDone, ['西挡板 · 完成反向换位', 'West cover · Finish the reverse drill'],
    ['反向路线也试完了。', 'The reverse crossing is tested too.'], Y.variant),
];
const ticket = [
  step(T.meet, ['旧货线 · 跟陶叔去下一站', 'Old freight line · Join Tao at the next stop'],
    ['陶叔：“这站牌挂反了许多年。沿旧轨过去，把正面的站名和背面的刻痕对一下。”', 'Tao: “This sign’s been backward for years. Follow the old rail and compare the station name with the scratches on the back.”'], JOURNEY.cargo),
  step(T.mile, ['旧站牌 · 核对刻痕和日期', 'Old station sign · Check the scratches and date'],
    ['陶叔：“这是我儿子留下的。他在这儿等最后一班车，票后来还在我手里。”', 'Tao: “My son left those marks. He waited here for the last train. The ticket was still in my pocket afterward.”'], T.meet),
  step(T.terminus, ['水边候车处 · 等陶叔到达', 'Lakeside stop · Meet Tao by the water'],
    ['陶叔把旧票夹回站牌：“以后每一班什么时候走，大家都能在这块牌上看见。”', 'Tao clips the old ticket to the sign. “From now on, everyone can see when the next train leaves.”'], T.mile),
  step(T.seat, ['旧站台 · 坐一会儿', 'Old platform · Take a seat'],
    ['旧货线从水边绕过去，风吹动站牌下没寄出的车票。', 'The old line bends around the shore. Wind catches the unsent ticket below the sign.'], T.terminus),
];
const shift = [
  step(N.orders, ['下一班外勤 · 核对出发单', 'Next field shift · Check the departure slip'],
    ['阿舟：“这趟我负责。先试手刹，再给工具箱扣好束带。我在黄线外等你。”', 'Azhou: “I’m leading this run. Test the brake and strap down the tools. I’ll wait beyond the yellow line.”'], JOURNEY.epilogue),
  step(N.brake, ['外勤车 · 试手刹', 'Field cart · Test the handbrake'],
    ['驻车刹已咬合。再确认工具箱束带。', 'The parking brake holds. Check the tool straps before departure.'], N.orders),
  step(N.load, ['外勤车 · 扣好工具箱束带', 'Field cart · Secure the tool straps'],
    ['箱子不会在坡上滑落了。可以交给阿舟发车。', 'The box won’t slip on the slope. Azhou can take the cart out.'], N.orders),
  step(N.handoff, ['黄线 · 和阿舟交接发车', 'Yellow line · Hand the departure over to Azhou'],
    ['阿舟：“下一站我到了就报。你要留下合个影，从站棚边能拍到我出发。”', 'Azhou: “I’ll check in at the next stop. If you want a picture, you can see me roll out from beside the shelter.”'], N.brake, N.load),
  step(N.view, ['站棚 · 留影', 'Shelter · Take in the view'],
    ['新班次的车沿刚修好的路开出。站牌上还有空位留给后来人。', 'The next shift rolls out along the repaired road. There is room on the board for the people who follow.'], N.handoff),
];

type CommunityQuest = { id: string; title: Localized; steps: readonly Step[]; terminal: string; opensWith?: string };
export const VALLEY_COMMUNITY: readonly CommunityQuest[] = [
  { id: 'mist-pipe', title: ['雾里有人敲管', 'Knocking in the Mist'], steps: mist, terminal: M.safe },
  { id: 'partner-drill', title: ['两个人的练习', 'Practice for Two'], steps: yard.slice(1, 4), terminal: Y.east, opensWith: Y.notice },
  { id: 'freight-yard', title: ['给谁留这块地', 'Room for the Neighborhood'], steps: [yard[0], yard[4], yard[5], yard[6]], terminal: Y.decision },
  { id: 'old-ticket', title: ['一张没有寄出的车票', 'The Unsent Ticket'], steps: ticket.slice(0, 3), terminal: T.terminus, opensWith: JOURNEY.cargo },
  { id: 'next-shift', title: ['下一班车', 'The Next Departure'], steps: shift.slice(0, 4), terminal: N.handoff, opensWith: JOURNEY.epilogue },
];
export const VALLEY_COMMUNITY_STEPS = new Map([...mist, ...yard, ...ticket, ...shift].map(s => [s.id, s]));
export function valleyCommunityReady(id: string, done: ReadonlySet<string>) {
  if (id === Y.practice) return done.has(Y.notice) && !done.has(Y.east);
  if (id === T.seat || id === N.view) return done.has(id === T.seat ? T.terminus : N.handoff);
  const step = VALLEY_COMMUNITY_STEPS.get(id);
  return !!step && !done.has(id) && step.requires.every(flag => done.has(flag));
}
export function chooseFreightYard(done: Set<string>, layout: 'training' | 'workshop') {
  done.delete(layout === 'training' ? Y.workshop : Y.training);
  done.add(layout === 'training' ? Y.training : Y.workshop);
  done.add(Y.decision);
}
