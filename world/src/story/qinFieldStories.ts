import type { FieldSideStory, FieldStep } from './fieldSideStories';
import { JOURNEY } from './worldJourney';

export const QIN_FIELD = {
  lists: { people: 'field_qin_people_list', tools: 'field_qin_tools_list', seats: 'field_qin_family_seats' },
  cart: { find: 'field_qin_cart_find', align: 'field_qin_cart_align', wheel: 'field_qin_cart_wheel', push: 'field_qin_cart_push', cache: 'field_qin_cart_cache' },
  stars: { foot: 'field_qin_stars_foot', latch: 'field_qin_stars_latch', view: 'field_qin_stars_view' },
  oldRank: { traces: 'field_qin_old_rank_traces', first: 'field_qin_old_rank_first', second: 'field_qin_old_rank_second', exit: 'field_qin_old_rank_exit' },
  troupe: { entry: 'field_qin_troupe_entry', frame: 'field_qin_troupe_frame', finish: 'field_qin_troupe_finish' },
  range: { read: 'field_qin_range_read', start: 'field_qin_range_start' },
} as const;

function story(id: string, title: FieldSideStory['title'], steps: FieldStep[]): FieldSideStory {
  return { id, region: 'qin', title, available: done => done.has(JOURNEY.qinRead), steps };
}
const { lists, cart, stars, oldRank, troupe, range } = QIN_FIELD;

export const QIN_FIELD_STORIES = [
  story('two-work-rolls', ['两张不同的作业表', 'Two Different Work Rolls'], [
    { id: lists.people, label: ['录事桌 · 看人员表', 'Clerk’s table · Read the workers’ roll'],
      hint: ['在工匠镇找记录领工人数的桌子。', 'Find the desk that records crew assignments in the workers’ town.'],
      line: ['周弭用朱笔划过一列：“出工的人写在这里，给他们送饭的人没写。”', 'Zhou Mi draws his brush across a column. “The workers are here. The people who bring their meals aren’t.”'] },
    { id: lists.tools, label: ['库房 · 对照工具表', 'Storehouse · Compare the tool roll'],
      hint: ['去工具架核对工号，听帮忙照管工具的人怎么说。', 'Compare the crew marks on the tool rack and talk to the people who look after it.'],
      line: ['借锯的不是木匠，是他女儿。她说弟弟也在等父亲回来。周弭拿来一张空签。', 'The saw was checked out by the carpenter’s daughter. She says her brother is waiting for him too. Zhou Mi brings out a blank tag.'] },
    { id: lists.seats, label: ['运输席 · 给工人家属留座', 'Transport bench · Reserve space for families'],
      hint: ['在等车棚为家属系上空签。', 'Tie the blank tags onto the waiting shelter’s family seats.'],
      line: ['空签被系在长凳两端。周弭说：“这一排随工队撤出，没工牌也有座。”', 'Blank tags go onto both ends of the bench. Zhou Mi says, “This row leaves with the crew. A work badge isn’t required.”'] },
  ]),
  story('wheel-left-behind', ['未带走的车轮', 'The Wheel Left Behind'], [
    { id: cart.find, label: ['铸造层 · 查缺轮的小车', 'Foundry · Inspect the cart with a missing wheel'],
      hint: ['在铸造层靠近下坡轨道的一侧找掉了轮子的车。', 'Look for the cart with a missing wheel beside the descending foundry rail.'],
      line: ['车身斜靠在轨上，掉下来的轮就在工架上。先让工俑把轴抬平。', 'The cart leans across the rails. Its wheel is on the repair rack. Have the worker figure level the axle first.'] },
    { id: cart.align, label: ['工俑 · 抬平车轴', 'Worker figure · Level the axle'],
      hint: ['在工俑身侧按下抬车工符。', 'Use the lifting token beside the worker figure.'],
      line: ['工俑把车身抬平，卡住了两侧轴套。', 'The worker figure levels the cart and holds both axle collars.'] },
    { id: cart.wheel, label: ['维修架 · 装轮并插销', 'Repair rack · Fit and pin the wheel'],
      hint: ['从维修架拿轮，套在工俑抬起的轴上。', 'Fit the wheel from the repair rack onto the supported axle.'],
      line: ['轴销穿过轮毂。把车推到下面的陵道岔口，给后队留补给。', 'The pin slides through the hub. Push the cart to the tomb-road turnout to leave supplies for the rear crew.'] },
    { id: cart.push, label: ['车把 · 推向陵道岔口', 'Cart handles · Push toward the turnout'],
      hint: ['站到车尾，推车走完这段短轨。', 'Stand behind the cart and push it along the short siding.'],
      line: ['车滚到止轮木前，装着补给的箱子没再往下滑。', 'The cart rolls to its chock. The supply crate stays put.'] },
  ]),
  story('astronomers-service-stair', ['星官维修梯', 'The Astronomer’s Service Stair'], [
    { id: stars.foot, label: ['军阵侧墙 · 查悬起的木梯', 'Garrison side wall · Inspect the raised stairs'],
      hint: ['从军阵东侧找挂在高处的木梯和双环。', 'Look for suspended timber stairs and paired rings on the east side of the garrison.'],
      line: ['两枚环是星官用来校准水平的。沿侧墙上去，把回程用的翻板放下。', 'The paired rings gave the astronomers a level reference. Go up the side wall and drop the hinged return deck.'] },
    { id: stars.latch, label: ['维修上层 · 解开翻板', 'Upper service landing · Release the deck'],
      hint: ['沿木梯走上高台，松开短桥的铜扣。', 'Follow the timber stair to the landing and release the bridge’s bronze catch.'],
      line: ['翻板架到对面的梁上。透过双环向下看，能看到军阵中间留下的空档。', 'The deck settles onto the opposite beam. Look down through the rings to see the gap between the ranks.'] },
    { id: stars.view, label: ['观察位 · 查看铜闸前的空档', 'Survey point · Look down toward the bronze gate'],
      hint: ['走过翻板，在两枚观测环之间停下。', 'Cross the hinged deck and stop between the survey rings.'],
      line: ['下方的灯给军阵留出了一条斜线。星官在栏上留了刻痕，好让后来的人也能从这里看见。', 'The lamps trace an angled route through the ranks below. A surveyor marked the rail so others could find the same view.'] },
  ]),
  story('old-figure-facing-away', ['背向寝殿的旧俑', 'The Figure Facing Away'], [
    { id: oldRank.traces, label: ['寝殿侧 · 看旧俑座磨痕', 'Sleeping hall · Inspect the worn figure base'],
      hint: ['到寝殿外侧找背过身去的俑和被磨亮的旧槽。', 'Outside the sleeping hall, look for a figure facing away and a worn groove in its base.'],
      line: ['后排的俑原本都朝外。有人转过两尊，把身后的维修廊压住了。', 'The back rank once faced outward. Someone turned two figures and blocked the service passage behind them.'] },
    { id: oldRank.first, label: ['旧俑首座 · 朝外转', 'First figure base · Turn toward the exterior'],
      hint: ['旋转第一尊旧俑，直到它面向墙外。', 'Turn the first figure until it faces out.'],
      line: ['第一面盾转出了廊口的槽。旁边那尊还有一处一样的刻痕。', 'The first shield clears its groove. The second base carries the same mark.'] },
    { id: oldRank.second, label: ['旧俑次座 · 与同列对齐', 'Second figure base · Match the rank'],
      hint: ['对齐第二面盾，使旧列都朝向外侧。', 'Turn the second shield to match the outward-facing rank.'],
      line: ['两道盾面朝着同一个方向，背后的门板滑进了墙槽。', 'Both shields face the same way. The panel behind them slides into the wall.'] },
    { id: oldRank.exit, label: ['外侧维修廊 · 识别回程路', 'Outer service gallery · Find the return path'],
      hint: ['穿过旧俑背后的廊门。', 'Go through the door behind the figures.'],
      line: ['门背面的拉环够得着。巡夜人从里面出去，也能从外面回来。', 'There is a reachable pull ring on the other side. The night watch could use this route both ways.'] },
  ]),
  story('silent-acrobats', ['寂静的百戏角', 'The Silent Acrobats'], [
    { id: troupe.entry, label: ['铸造层角落 · 看百戏俑', 'Foundry corner · Inspect the acrobat figures'],
      hint: ['在铸造层找矮灯后那列伸手、扭腰的百戏俑。', 'Find the reaching, twisting figures behind the low lamps in the foundry.'],
      line: ['蔺禾：“这排俑从没领过军令。横杆原本留给学徒爬，底下还有一条平路。”', 'Lin He says, “These figures never took military orders. The crossbar was for apprentices to climb. There’s a level path below.”'] },
    { id: troupe.frame, label: ['百戏架 · 转平跳板', 'Acrobats’ frame · Swing the jumping platform into place'],
      hint: ['在第一根横杆旁把跳板转到平台之间。', 'Swing the board between the platforms from the first crossbar.'],
      line: ['跳板扣住了，够你跨到台边。沿平路也能听见蔺禾。', 'The board locks into place. It is close enough to jump from. You can still hear Lin He from the level path.'] },
    { id: troupe.finish, label: ['歇脚台 · 听蔺禾说旧戏', 'Rest ledge · Hear Lin He’s story'],
      hint: ['跳过横架或沿平路绕到靠灯的一侧。', 'Cross the frames or take the level path around to the lamp.'],
      line: ['秦始皇：“她练了多久？”蔺禾：“您来的那天摔了一次。后来她自己把支架做宽了。”', 'Qin Shi Huang asks, “How long did she practice?” Lin He replies, “She fell once on the day you came. Later she built a wider stand herself.”'] },
  ]),
  story('abandoned-crossbow-range', ['废弃校弩廊', 'The Abandoned Crossbow Gallery'], [
    { id: range.read, label: ['校弩廊 · 看三道旧靶线', 'Crossbow gallery · Read the three old target lanes'],
      hint: ['在军阵西侧寻找三条红绳和布靶。', 'Find the three red cords and cloth targets on the west side of the garrison.'],
      line: ['校弩用软头练习箭。先后是左、中、右线；灯一亮，就离开亮线并回到起步区等下一令。', 'The gallery uses blunt practice bolts. Left, center, then right. Leave the lit lane and return to the starting area for the next order.'] },
    { id: range.start, label: ['起步线 · 练三道校弩令', 'Start line · Practice the three crossbow orders'],
      hint: ['在地面并列三盏灯处开始，避开每次亮起的射线。', 'Start by the three floor lamps and move off each lit lane.'],
      line: ['三次都走到了掩护侧。墙上的侧位记号也刻在封陵将的试场。', 'You reached cover all three times. The same side mark is cut into the Sealing General’s arena.'] },
  ]),
] satisfies readonly FieldSideStory[];
