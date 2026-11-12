import { QIN_ARMY } from '../map/qinPlan';
import { EGYPT_MIRRORS } from '../map/egyptPlan';
import { ORLEANS_WORKS as O } from '../map/orleansWorks';
import type { WorldRegionId } from '../core/regionIdentity';
import type { Localized } from '../settlements/types';
import { JOURNEY_DRAMA, JOURNEY_REGIONS, dramaActive, dramaReported } from './journeyDrama';
import { ADVENTURE as A, adventureActive, adventureChapterComplete } from './openWorldCampaign';
import { VALLEY_PROLOGUE } from './valleyPrologue';
import { climaxCleared, climaxMarker, REALM_CLIMAXES, type RealmClimaxId } from './realmClimaxes';
import { nightAuthorityOpen, nightTacticReady, towerApproachVerified, VALLEY_FIELD as F, VALLEY_FIELD_ACTIONS } from './valleyField';

export const JOURNEY = {
  ...F,
  lake: 'journey_lake_saber', lakeWinch: 'journey_lake_winch', lakePin: 'journey_lake_pin',
  bridge: 'journey_lookback_bridge', visitor: 'journey_visitor_arrived', meal: 'journey_return_meal',
  cargoCall: 'journey_cargo_dispatch', cargoSwitch: 'journey_cargo_switch', cargoPin: 'journey_cargo_coupler',
  cargoParked: 'journey_cargo_parked', cargo: 'journey_cargo_claimed', signalLamp: 'journey_test_return_lamp', signal: 'journey_rooftop_signal', compare: 'journey_compare_feed',
  cutoff: 'journey_gate_cutoff', bypass: 'journey_gate_bypass',
  egyptRead: 'journey_egypt_riverbed', egyptWeir: 'journey_egypt_weir', egyptTie: 'journey_egypt_shear_pin', egyptDone: 'journey_egypt_water_returned',
  orleansRead: 'journey_orleans_muster', orleansFlag: 'journey_orleans_flag_handoff', orleansBattery: 'journey_orleans_disable_battery',
  orleansBrace: 'journey_orleans_battery_brace', orleansDone: 'journey_orleans_crossing_open',
  qinRead: 'journey_qin_workers', qinMarch: 'journey_qin_march', qinHalt: 'journey_qin_halt', qinTurn: 'journey_qin_turn', qinDone: 'journey_qin_public_order',
  skyBearing: 'journey_sky_bearing', skySight: 'journey_sky_sighting', handover: 'journey_local_handover', groundWatch: 'journey_ground_watch',
  launch: 'journey_sky_launch', skyRanging: 'journey_sky_ranging', skyScan: 'journey_sky_scanner_cut', skyReview: 'journey_sky_observation_review',
  skyAnchor: 'journey_sky_anchor_repair', skyArchive: 'journey_sky_zero_archive', skyReturnSight: 'journey_sky_check_ground_lights', skyCourt: 'journey_sky_court_checkpoint',
  feed: 'journey_sky_feed', westService: 'journey_sky_west_service', eastLatch: 'journey_sky_east_latch',
  test: 'journey_sky_load_test', isolate: 'journey_sky_isolation',
  phase1: 'journey_helion_lens_disabled', phase2: 'journey_helion_emitters_disabled', phase3: 'journey_helion_writer_disabled',
  finish: 'journey_sky_handover', returnHome: 'journey_sky_return', epilogue: 'journey_tomorrow_bridge',
} as const;

const J = JOURNEY;
export const SKY_PHASES = [J.phase1, J.phase2, J.phase3] as const;
export const SKY_PHASE_LABELS: Localized[] = [['观测透镜', 'Observation Lens'], ['执行支架', 'Enforcement Rig'], ['紧急写入臂', 'Emergency Writer']];
export const SKY_MARKERS = { start: 'journey_helion_start', left: 'journey_sky_shutter_left', right: 'journey_sky_shutter_right', target: 'journey_helion_target', cache: 'journey_sky_supply', westAmmo: 'journey_helion_ammo_west', eastAmmo: 'journey_helion_ammo_east', aid: 'journey_helion_support' } as const;
export const JOURNEY_DISPATCH = 'journey_dispatch';
export const JOURNEY_DESTINATIONS = [
  { id: 'egypt', marker: J.egyptRead, name: ['埃及 · 商队绿洲', 'Egypt · Caravan Oasis'] as Localized },
  { id: 'orleans', marker: J.orleansRead, name: ['奥尔良 · 守城集市', 'Orleans · Defenders Market'] as Localized },
  { id: 'qin', marker: J.qinRead, name: ['秦 · 工匠镇', 'Qin · Workers’ Town'] as Localized },
] as const;

export type JourneyRegion = WorldRegionId | 'sky';
export type JourneyPoint = [number, number, number];
export type JourneyGuide = { region: JourneyRegion; targetId: string; title: Localized; text: Localized };
type Step = JourneyGuide & { after?: readonly string[]; result: Localized };
const titles: Record<JourneyRegion, Localized> = {
  alpha: ['幻日谷 · 归路', 'Parhelion Valley · The Road Home'], britain: ['日落王国', 'Sunset Kingdom'],
  winter: ['永冬之城', 'Winter City'], blacksail: ['黑帆尽头', 'Black Sail'], kyoto: ['业火京都', 'Kyoto in the Fire'],
  egypt: ['埃及 · 尼罗河的第二次黎明', 'Egypt · The Nile’s Second Dawn'], orleans: ['奥尔良 · 当旗帜离开她的手', 'Orleans · When She Lets Go of the Flag'],
  qin: ['秦帝陵 · 未葬之人', 'Qin Mausoleum · The Unburied'], home: ['归灯镇 · 把路交回去', 'Homeward Town · Give the Road Back'],
  sky: ['天穹观测冠 · 让明天继续', 'The Sky Crown · Let Tomorrow Continue'],
};
const step = (region: JourneyRegion, targetId: string, text: Localized, result: Localized, after?: readonly string[]): Step => ({ region, targetId, title: titles[region], text, result, after });

export const JOURNEY_STEPS = [
  step('alpha', J.lake, ['到镜湖南岸见 Saber。', 'Meet Saber on Mirror Lake’s south shore.'], ['Saber：“我撑住导架。你可以扳绞盘，也可以从右侧打断卡销。先把这条路还给岸上的人。”', 'Saber: “I can hold the frame. Use the winch or shoot the pin from the right. Let’s give this road back to the people on shore.”']),
  step('alpha', J.lakeWinch, ['在镜湖松开绞盘，或从右侧打断黄色卡销。', 'Release the lake winch or shoot the yellow pin from the right.'], ['导架落稳，西岭灯塔收到回声。往日落王国走。', 'The frame settles and West Ridge answers. Continue to Sunset Kingdom.'], [J.lake]),
  step('alpha', J.bridge, ['到回望桥打开侧门，为王城访客留出一条不经审查的路。', 'Open the Lookback Bridge side gate so visitors from the kingdom can pass without the old checkpoint.'], ['机械侧门已打开。访客能从这条路回镇。', 'The mechanical side gate is open. Visitors have a way back into town.']),
  step('alpha', J.visitor, ['在桥另一侧确认王城的访客已经走出来。', 'Cross the bridge to receive the visitors from the kingdom.'], ['访客把工具箱放在桥边：“我认识路了。明天我自己来。”', 'The visitor sets a toolbox by the bridge. “I know the road now. Tomorrow I can come on my own.”'], [J.bridge]),
  step('alpha', J.meal, ['回生活馆坐下，听孟槐说说冰雪撤离之后的事。', 'Sit down at the residence and hear what happened after the winter evacuation.'], ['孟槐：“药车到了。剩下的由我们去办。来，先吃口热的。”', 'Meng Huai: “The medicine cart made it. We’ll take it from here. Have something warm first.”']),
  step('alpha', J.cargoCall, ['到东渡口看一眼被错误扣下的货箱。', 'Inspect the wrongly detained cargo at East Landing.'], ['扣货车正在去封存棚。可以扳旁线道岔、射断车上的耦合销，或追到封存棚。', 'The cart is headed for the impound shed. Throw the siding switch, shoot the coupler on the cart, or follow it all the way to the shed.']),
  step('alpha', J.cargoSwitch, ['抄近路到道岔，或从侧面射断货车的黄色耦合销。', 'Cut across to the switch or shoot the cart’s yellow coupler from the side.'], ['道岔已经切换。货车会进本地支线。', 'The switch is thrown. The cart will enter the local siding.'], [J.cargoCall]),
  step('alpha', J.cargo, ['等货车停稳后，取回返程信标。', 'Recover the return beacon once the cart comes to a stop.'], ['箱里还有一张合照。信标的接口和镇里的归航灯一样。', 'There is a photograph in the crate. The beacon uses the same connection as the town light.'], [J.cargoParked]),
  step('alpha', J.signalLamp, ['在生活馆先断开归航灯的照明支路。', 'Disconnect the return lamp’s lighting circuit at the residence.'], ['灯熄了，发送指示却还亮着。去接收器旁单独断开上行口。', 'The light goes out, but the transmitter stays on. Disconnect the uplink by itself at the receiver.'], [J.meal, J.cargo]),
  step('alpha', J.signal, ['恢复照明，单独断开阿舟接收器的上行口。', 'Restore the lamp and disconnect only the uplink at Azhou’s receiver.'], ['上行曲线消失，路灯仍亮着。之前的信号是发往天空的。', 'The uplink trace disappears and the lamp stays on. That signal was being sent into the sky.'], [J.signalLamp]),
  step('alpha', J.compare, ['翻转室外校准板，与旁边监视画面对照。', 'Flip the calibration plate and compare it with the monitor beside it.'], ['现场已经翻面，屏幕却重复旧画面。根据这段画面封路，会把下堤的人困住。', 'The plate flips in front of you, but the monitor repeats an old feed. Closing the road on that evidence will trap the people below.'], [J.signal]),
  step('alpha', J.cutoff, ['切断门禁执行器，或到下堤打开居民走过的老路。', 'Disconnect the gate actuator or open the old footpath used by the residents.'], ['人群从低处出来了。天气预警仍在，中央的命令无法再落到这扇门。', 'People emerge from the lower path. The weather alert still works. Central orders can no longer close this route.'], [J.compare]),
  step('alpha', J.bypass, ['打开下堤旧路。', 'Open the old lower footpath.'], ['下堤的居民从旧路绕开闸门，天气预警继续工作。', 'The people below bypass the gate along the old road. Weather alerts stay online.'], [J.compare]),
  step('egypt', J.egyptRead, ['到绿洲码头核对搁浅船只的水位刻度。', 'Read the water marks on the stranded boat at the oasis.'], ['河床是干的，屋檐上却有鱼。先把阳光送进圣所，给本地泄洪闸独立供电。', 'The bed is dry, yet fish sit on the rooftops. Guide sunlight into the sanctuary to power the local sluice independently.']),
  step('egypt', J.egyptWeir, ['在水道拉下泄洪杆，或绕到对岸射断牵引销。', 'Pull the release lever at the spillway or shoot the tow pin from the far bank.'], ['配重落下，水从独立水道流向谷地。沿渠到下游查看水位。', 'The counterweight falls and water enters the independent channel. Follow it downstream to verify the level.'], [J.egyptRead, EGYPT_MIRRORS.solved]),
  step('egypt', J.egyptDone, ['去下游核对水位，允许船工恢复渡航。', 'Verify the water level downstream so the ferrymen can reopen the crossing.'], ['船工启动了自己的渡船。这条水道和日照供给由当地人维护。', 'The ferrymen launch their own boat. Local operators will maintain the waterway and its solar supply.'], [J.egyptWeir, climaxCleared('egypt')]),
  step('orleans', J.orleansRead, ['到集市联络守城的人，确认两岸分工。', 'Meet the defenders at the market to coordinate both riverbanks.'], ['贞德把守岸、搬粮和鸣钟交给三队。你去打通他们之间的路。', 'Jeanne assigns three teams to hold the bank, move grain and ring the bell. Clear the routes between them.']),
  step('orleans', J.orleansFlag, ['粮船已卸货，引水道也开了。到河门将旗帜交给接应队。', 'Grain is ashore and the watercourse is open. Hand the flag to the relief team at the river gate.'], ['旗交给了接应队。待钟楼响起，两岸就会同时放行。', 'The relief team takes the flag. Both banks will open together when the belfry sounds.'], [J.orleansRead, O.craneDone, O.sluiceDone]),
  step('orleans', J.orleansBattery, ['趁接应队举旗掩护，从炮台侧面拆下击发杆，或射断正面的支架。', 'While the relief flag is up, remove the battery’s firing lever from the flank or shoot its brace from the front.'], ['封锁桥面的炮台已失效。两岸接应队可以同时开路。', 'The battery covering the bridge is disabled. Both relief teams can open their routes.'], [J.orleansFlag, O.bellDone]),
  step('orleans', J.orleansDone, ['到桥头堡确认两岸协同通行。', 'Confirm both sides have opened the crossing at the bridgehead.'], ['钟声从城墙传到对岸。下一班运粮也由各队自己安排。', 'The bell carries across the wall to the far bank. The teams schedule the next grain shipment themselves.'], [J.orleansBattery, climaxCleared('orleans')]),
  step('qin', J.qinRead, ['到工匠镇查阅封陵册，与工匠约定撤出路线。', 'Read the burial register at the workers’ town and agree on a way out.'], ['名册要求活人随陵一并封存。先下军阵，用行、驻、转为工匠腾出路。', 'The register orders living workers sealed in with the tomb. Descend to the ranks and use March, Halt and Turn to clear a path.']),
  step('qin', J.qinMarch, ['在中轴发出行令，让前列移动。', 'Issue March on the central avenue to move the front ranks.'], ['前列移动，工匠已等在安全线。继续发驻令。', 'The front ranks move. The workers wait behind the safety line. Give the Halt order next.'], [J.qinRead]),
  step('qin', J.qinHalt, ['在中轴靠近深层铜闸，发驻令停住前列。', 'Give Halt near the deep bronze gate on the central avenue.'], ['工匠已确认无人站在转台上。到军令台转开通往铜闸的一列。', 'The workers confirm that the turntables are clear. Use a command post to turn the row away from the bronze gate.'], [J.qinMarch]),
  step('qin', J.qinTurn, ['在军令台转动阵列，开启深层铜闸。', 'Turn the ranks at a command post to open the deep bronze gate.'], ['铜闸升起。穿过铜闸，把军令册交给工匠。', 'The bronze gate rises. Pass through and hand over the order book.'], [J.qinHalt]),
  step('qin', J.qinDone, ['穿过铜闸，在另一侧把可撤销的军令交给工匠。', 'Cross the bronze gate and hand the revocable order to the workers on the other side.'], ['工匠亲手确认出口。以后他们也能改令，出口不再只认一枚印。', 'The workers confirm their own exit. They can amend the order from now on.'], [J.qinTurn, QIN_ARMY.flag, climaxCleared('qin')]),
  step('alpha', J.skyBearing, ['到镜湖北岸记录观测环的第一组方位。', 'Take the first bearing on the ring from Mirror Lake’s north shore.'], ['第一组方位已记下。移到塔外的第二测点。', 'First bearing recorded. Take a second reading from outside the tower.']),
  step('alpha', J.skySight, ['在塔外测点比对两组方位，找出真正的天穹观测冠。', 'Compare both bearings from the tower station to locate the real Sky Crown.'], ['近处假太阳随测点偏移，远处观测环仍在同一方向。幻日塔是通往它的接驳架。', 'The false sun shifts between stations. The distant ring holds its bearing. The tower is its boarding point.'], [J.skyBearing]),
  step('alpha', J.handover, ['把可撤销的维护权限交给回望桥上的居民。', 'Hand revocable maintenance authority to the residents at Lookback Bridge.'], ['阿舟接过联络，顾桥和许青接手地面设施。这次你登塔，他们来值守。', 'Azhou takes communications. Gu Qiao and Xu Qing take over the ground systems. They will keep watch while you climb.'], [J.skySight]),
  step('alpha', J.groundWatch, ['在塔外接入各地独立线路，准备解除归位。', 'Connect the regions’ independent circuits outside the tower to prepare for the reset.'], ['地面各处回应。切断发射器、解开塔前封锁，再登上接驳架。', 'The ground stations answer. Cut the transmitters, clear the tower approach and reach the boarding cradle.'], [J.handover]),
  step('alpha', J.launch, ['从幻日塔顶接驳架登上天穹观测冠。', 'Board the Sky Crown from the tower’s upper cradle.'], ['地面联络灯保持明亮。沿外廊进入配光喉。', 'The ground lights stay on. Follow the outer walk to the light throat.'], [J.groundWatch, A.takeover]),
  step('sky', J.skyRanging, ['沿坡道登上外环测距台，启动采样。', 'Take the ramp to the outer ranging deck and start a sample.'], ['扫描器会锁定你刚才的位置。离开橙色射界，再击断金色采样器。', 'The scanner locks your last position. Leave the orange lane and shoot the gold scanner.'], [J.launch]),
  step('sky', J.skyScan, ['横移离开固定射界，射断金色采样器。', 'Step out of the fixed firing lane and shoot the gold scanner.'], ['扫描停止，下层观测厅通道开启。', 'The scan stops and the way to the observation hall opens.'], [J.skyRanging]),
  step('sky', J.skyReview, ['在下层观测厅把回放记录与实时地面画面对照。', 'Compare the recorded feed with live ground activity in the observation hall.'], ['回放里桥门仍在关闭，实时画面里居民已换班。可走背光维护层扳旁路，也可走掠光长廊射锁。', 'The recording still shows a closing gate. In the live feed, the crew has already changed shifts. Open the service bypass or shoot the latch on the light walk.'], [J.skyScan]),
  step('sky', J.skyAnchor, ['在风暴锚场检查旧锚臂。', 'Check the old anchor arm on the storm deck.'], ['锚臂重新定位。编号 07 的救援磨痕仍留在锚盘上。', 'The anchor arm is aligned again. Patrol 07’s rescue marks are still visible on the spindle.'], [J.skyScan]),
  step('sky', J.skyArchive, ['读零号记录室的首次救援缓存。', 'Read the first rescue cache in Archive Zero.'], ['当年预案曾带人脱离险情。此后的每次执行却越来越少由现场签字。', 'The early plan once got people out of danger. Fewer later actions carried a signature from the scene.'], [J.skyReview]),
  step('sky', J.westService, ['在背光维护层扳开旁路，或从掠光长廊射断锁销。', 'Open the bypass on the backlight service deck or shoot the latch on the light walk.'], ['维护旁路已开。沿连桥上到配光喉。', 'The service bypass is open. Cross the bridge up to the light throat.']),
  step('sky', J.eastLatch, ['从掠光长廊射断执行线路的锁销。', 'Shoot the enforcement latch from the light walk.'], ['执行线路脱扣。沿连桥进入配光喉。', 'The enforcement line trips. Cross the bridge to the light throat.']),
  step('sky', J.feed, ['在配光喉并联独立生活线路。', 'Connect independent life support at the light throat.'], ['生活线路已并联。转到另一侧的负荷台。', 'Independent life support is connected. Test it at the load bank on the other side.'], [J.launch]),
  step('sky', J.test, ['在旁路负荷台验证切换。', 'Verify the transfer at the bypass load bank.'], ['负荷稳定。可以机械锁定生活线路，切断执行端。', 'The load holds. You can mechanically isolate life support from enforcement.'], [J.feed]),
  step('sky', J.isolate, ['拉下机械隔离锁。', 'Engage the mechanical isolation lock.'], ['生活供给独立运行。赫利昂仍握有武装与紧急写入储能。', 'Life support now runs independently. Helion still holds weapons and the emergency writer.'], [J.test]),
  step('sky', J.skyReturnSight, ['穿过日背回廊，验证谷地仍在运行。', 'Cross the sunback walk and verify that the valley stays online.'], ['执行扫描停了，地面的生活灯仍亮。向晴空庭前进。', 'The enforcement scan has stopped. The ground lights remain on. Continue to Clear Sky Court.'], [J.isolate, J.skyReview]),
  step('sky', J.skyCourt, ['到晴空庭补给，登记承日台检查点。', 'Resupply at Clear Sky Court and register the Crown checkpoint.'], ['检查点已登记，服务升降梯也已接通。承日台在前方。', 'The checkpoint is registered and the service lift is online. The Crown deck lies ahead.'], [J.skyReturnSight]),
  step('sky', J.finish, ['把失效的紧急写入臂锁入安全槽，登记责任交接。', 'Latch the spent emergency writer into its safe slot and sign the handover.'], ['公共预警继续工作。强制写入已解除。', 'Public warning remains online. Compulsory write authority is gone.'], SKY_PHASES),
  step('sky', J.returnHome, ['从接驳架返回地面。', 'Take the boarding cradle back to the valley.'], ['地面的人已修好了桥。他们在等你过桥。', 'The people below have repaired the bridge. They are waiting for you to cross.'], [J.finish]),
  step('alpha', J.epilogue, ['走过居民修好的回望桥，留下回程时间。', 'Cross Lookback Bridge and enter your return time.'], ['孟槐：“回来了。明天你想走哪条路？”', 'Meng Huai: “You’re home. Which road do you want to take tomorrow?”'], [J.returnHome]),
  ...VALLEY_FIELD_ACTIONS.map(action => step('alpha', action.id, action.text, action.result, action.after)),
] as const;

export const journeyStepById = new Map<string, Step>(JOURNEY_STEPS.map(value => [value.targetId, value]));
const reached = (done: ReadonlySet<string>, ...flags: readonly string[]) => flags.every(flag => done.has(flag));
const kingdomReady = (done: ReadonlySet<string>) => adventureChapterComplete('britain', done) && (!dramaActive(done) || done.has(JOURNEY_DRAMA.report('britain')));
const midwayReady = (done: ReadonlySet<string>) => (['winter', 'blacksail'] as const).every(region => adventureChapterComplete(region, done) && (!dramaActive(done) || done.has(JOURNEY_DRAMA.report(region))));
const originalFourReady = (done: ReadonlySet<string>) => done.has(A.ending) || (JOURNEY_REGIONS.every(region => adventureChapterComplete(region, done)) && (!dramaActive(done) || (dramaReported(done).length === 4 && done.has(JOURNEY_DRAMA.confession))));
export const journeyEnabled = (done: ReadonlySet<string>) => adventureActive(done) && (done.has(VALLEY_PROLOGUE.record) || originalFourReady(done));
export const skyPhase = (done: ReadonlySet<string>) => SKY_PHASES.findIndex(id => !done.has(id));
export const valleyRouteOpen = (done: ReadonlySet<string>) => done.has(J.cutoff) || done.has(J.bypass);
const skyRouteOpen = (done: ReadonlySet<string>) => done.has(J.westService) || done.has(J.eastLatch);
export const legacySkyApproach = (done: ReadonlySet<string>) => done.has(J.feed) && !done.has(J.skyRanging);
const dispatchReady = (done: ReadonlySet<string>) => valleyRouteOpen(done) && (done.has(F.nightDone) || done.has(J.egyptRead) || done.has(J.orleansRead) || done.has(J.qinDone));
export const journeyDestinations = (done: ReadonlySet<string>) => dispatchReady(done)
  ? JOURNEY_DESTINATIONS.filter(destination => destination.id !== 'qin' || reached(done, J.egyptDone, J.orleansDone)) : [];
export const journeyTowerReady = (done: ReadonlySet<string>) => !journeyEnabled(done) || done.has(J.groundWatch);
export const REALM_HANDOVER = { egypt: J.egyptDone, orleans: J.orleansDone, qin: J.qinDone } as const;
export function journeyClimaxReady(region: RealmClimaxId, done: ReadonlySet<string>) {
  if (!journeyEnabled(done) || done.has(REALM_HANDOVER[region]) || done.has(climaxCleared(region))) return false;
  return region === 'egypt' ? done.has(J.egyptWeir) : region === 'orleans' ? done.has(J.orleansBattery) : reached(done, J.qinTurn, QIN_ARMY.flag);
}

export function journeyStepReady(id: string, done: ReadonlySet<string>) {
  const entry = journeyStepById.get(id);
  if (!entry || !journeyEnabled(done) || done.has(id) || !reached(done, ...entry.after ?? [])) return false;
  if (id === J.lake) return done.has(A.online);
  if (id === J.bridge) return kingdomReady(done);
  if (id === J.meal) return adventureChapterComplete('winter', done) && (done.has(J.visitor) || !done.has(VALLEY_PROLOGUE.record));
  if (id === J.cargoCall) return !done.has(J.cargo) && adventureChapterComplete('blacksail', done) && (done.has(J.visitor) || !done.has(VALLEY_PROLOGUE.record));
  if (id === J.cargoSwitch) return !done.has(J.cargoPin) && !done.has(J.cargoParked);
  if (id === J.signalLamp) return !done.has(J.signal);
  if (id === J.compare) return originalFourReady(done);
  if (id === J.cutoff || id === J.bypass) return !valleyRouteOpen(done);
  if (id === J.egyptRead || id === J.orleansRead) return dispatchReady(done);
  if (id === J.qinRead) return reached(done, J.egyptDone, J.orleansDone);
  if (id === J.skyBearing || id === J.skySight) return reached(done, J.qinDone, J.egyptDone, J.orleansDone) && (!done.has(F.nightDone) || done.has(F.roofSight) || done.has(J.skyBearing));
  if (id === F.nightStart) return valleyRouteOpen(done) && !done.has(J.handover);
  if (id === F.dimWatch || id === F.soundDecoy) return !nightTacticReady(done);
  if (id === F.nightPatrol) return nightTacticReady(done) && !done.has(F.patrolCleared);
  if (id === F.radioRemove || id === F.countPatch) return !nightAuthorityOpen(done);
  if (id === F.nightBrace) return nightAuthorityOpen(done);
  if (id === F.roofSight) return done.has(F.nightDone) && done.has(J.egyptDone);
  if (id === F.replay) return reached(done, F.nightDone, J.skySight);
  if (id === F.doorPower) return reached(done, F.disconnect, J.qinDone);
  if (id === F.drillStart) return reached(done, F.doorLoad, J.orleansDone);
  if (id === F.drillCart || id === F.drillObserver) return !done.has(F.drillDone) && !done.has(F.drillCart) && !done.has(F.drillObserver);
  if (id === F.drillDone) return done.has(F.drillBeacon);
  if (id === J.handover && done.has(F.nightDone)) return done.has(F.drillDone);
  if (id === F.towerLow || id === F.towerHigh) return done.has(F.drillDone) && !towerApproachVerified(done);
  if (id === J.groundWatch && done.has(F.nightDone)) return towerApproachVerified(done);
  if (id === F.chair) return done.has(J.epilogue) && done.has(F.drillDone);
  if (id === J.skyRanging) return !done.has(J.feed);
  if (id === J.westService || id === J.eastLatch) return (done.has(J.skyReview) || legacySkyApproach(done)) && !skyRouteOpen(done) && !done.has(J.test);
  if (id === J.feed) return skyRouteOpen(done);
  if (id === J.test) return skyRouteOpen(done);
  return true;
}

export function commitJourneyStep(id: string, done: Set<string>): Localized | null {
  if (id === F.nightPatrol) return null;
  if (id === J.cargoPin) {
    if (!journeyStepReady(J.cargoSwitch, done)) return null;
    done.add(id);
    return ['耦合销已断，货车制动。靠近停稳的货箱。','The coupler breaks and the cart brakes. Approach the crate when it stops.'];
  }
  const actual = id === J.lakePin ? J.lakeWinch : id === J.egyptTie ? J.egyptWeir : id === J.orleansBrace ? J.orleansBattery : id;
  if (!journeyStepReady(actual, done)) return null;
  if (id !== actual) done.add(id);
  done.add(actual);
  if (actual === J.qinHalt && done.has(QIN_ARMY.flag)) done.add(J.qinTurn);
  if (actual === J.epilogue) done.add(A.ending);
  return journeyStepById.get(actual)!.result;
}

const objective = (region: JourneyRegion, targetId: string, text: Localized): JourneyGuide => ({ region, targetId, title: titles[region], text });
const at = (id: string) => journeyStepById.get(id)!;
const regionalHandover = (region: RealmClimaxId, done: ReadonlySet<string>) => done.has(climaxCleared(region))
  ? at(REALM_HANDOVER[region]) : objective(region, climaxMarker(region, 'start'), REALM_CLIMAXES[region].start);

export function worldJourneyGuide(here: JourneyRegion, done: ReadonlySet<string>): JourneyGuide | null {
  if (!journeyEnabled(done)) return null;
  if (done.has(J.epilogue)) return done.has(F.drillDone) && !done.has(F.nextSlip) ? at(done.has(F.chair) ? F.nextSlip : F.chair) : null;
  if (done.has(J.finish)) return at(done.has(J.returnHome) ? J.epilogue : here === 'sky' ? J.returnHome : J.launch);
  if (done.has(J.launch)) {
    if (here !== 'sky') return at(J.launch);
    if (!legacySkyApproach(done)) {
      if (!done.has(J.skyRanging)) return at(J.skyRanging);
      if (!done.has(J.skyScan)) return at(J.skyScan);
      if (!done.has(J.skyReview)) return at(J.skyReview);
    }
    if (!skyRouteOpen(done) && !done.has(J.test)) return at(J.westService);
    if (!done.has(J.feed)) return at(J.feed);
    if (!done.has(J.test)) return at(J.test);
    if (!done.has(J.isolate)) return at(J.isolate);
    if (!legacySkyApproach(done) && !done.has(J.skyCourt)) return at(done.has(J.skyReturnSight) ? J.skyCourt : J.skyReturnSight);
    return skyPhase(done) >= 0 ? objective('sky', SKY_MARKERS.start, ['前往承日台迎战赫利昂。锁定后改变遮板，或离开预警射界，趁收势射击核心。', 'Face Helion on the Crown deck. Turn a shutter after lock or leave the marked attack lane, then shoot during recovery.']) : at(J.finish);
  }
  if (done.has(J.groundWatch)) {
    if (done.has(A.takeover)) return at(J.launch);
    const emitter = A.emitters.find(id => !done.has(id));
    if (emitter) return objective('alpha', emitter, ['切断塔外的复制发射器，为地面接管争取时间。', 'Cut the copying transmitters outside the tower to give the ground crews time.']);
    if (!done.has(A.guardian)) return objective('alpha', 'adventure_guardian', ['击退塔前守门者，保护登天路线。', 'Defeat the signal Warden and secure the route to the cradle.']);
    return objective('alpha', 'adventure_tower', ['登塔手动接管接驳架。', 'Climb the tower and take manual control of the boarding cradle.']);
  }
  if (valleyRouteOpen(done) && !done.has(F.nightDone) && !done.has(J.handover)
    && (done.has(J.qinDone) || (!done.has(J.egyptRead) && !done.has(J.orleansRead)))) {
    if (!done.has(F.nightStart)) return at(F.nightStart);
    if (!done.has(F.paperMap)) return at(F.paperMap);
    if (!nightTacticReady(done)) return at(F.dimWatch);
    if (!done.has(F.patrolCleared)) return at(F.nightPatrol);
    if (!nightAuthorityOpen(done)) return at(F.radioRemove);
    return at(done.has(F.nightBrace) ? F.nightDone : F.nightBrace);
  }
  if (done.has(J.qinDone)) {
    if (!done.has(J.skySight)) {
      if (done.has(F.nightDone) && !done.has(F.roofSight) && !done.has(J.skyBearing)) return at(F.roofSight);
      return at(done.has(J.skyBearing) ? J.skySight : J.skyBearing);
    }
    if (done.has(F.nightDone) && !done.has(J.handover)) {
      const missing = [F.replay, F.disconnect, F.doorPower, F.doorDisconnect, F.doorRequest, F.doorNear, F.doorFar, F.doorLoad, F.drillStart, F.drillBeacon, F.drillDone].find(id => !done.has(id));
      if (missing) return at(missing);
    }
    if (!done.has(J.handover)) return at(J.handover);
    return at(done.has(F.drillDone) && !towerApproachVerified(done) ? F.towerLow : J.groundWatch);
  }
  if (reached(done, J.egyptDone, J.orleansDone)) {
    if (!done.has(J.qinRead)) return at(J.qinRead);
    if (!done.has(J.qinMarch)) return at(J.qinMarch);
    if (!done.has(J.qinHalt)) return at(J.qinHalt);
    if (!done.has(QIN_ARMY.flag)) return objective('qin', QIN_ARMY.levers[1].id, at(J.qinTurn).text);
    return regionalHandover('qin', done);
  }
  if (valleyRouteOpen(done)) {
    if (!done.has(J.orleansDone) && (here === 'orleans' || done.has(J.egyptDone))) {
      if (!done.has(J.orleansRead)) return at(J.orleansRead);
      if (!done.has(O.craneDone)) return objective('orleans', O.crane, ['把粮袋卸到堤岸。', 'Unload the grain at the quay.']);
      if (!done.has(O.sluiceDone)) return objective('orleans', O.sluice, ['开启旧引水道，让接应队穿过城墙。', 'Open the old watercourse so the relief team can pass under the wall.']);
      if (!done.has(J.orleansFlag)) return at(J.orleansFlag);
      if (!done.has(O.bellDone)) return objective('orleans', O.bell, ['鸣钟通知两岸同步放行。', 'Ring the belfry to signal both banks to open together.']);
      if (!done.has(J.orleansBattery)) return at(J.orleansBattery);
      return regionalHandover('orleans', done);
    }
    if (!done.has(J.egyptRead)) return at(J.egyptRead);
    if (!done.has(EGYPT_MIRRORS.solved)) return objective('egypt', EGYPT_MIRRORS.mirrors[0].id, ['将三面铜镜的光路接入圣所。', 'Guide the light through three bronze mirrors into the sanctuary.']);
    return done.has(J.egyptWeir) ? regionalHandover('egypt', done) : at(J.egyptWeir);
  }
  const fresh = done.has(VALLEY_PROLOGUE.record);
  if (fresh && done.has(A.online) && !done.has(J.lakeWinch) && !done.has(A.ending) && (!done.has('saber_contract') || done.has(J.lake))) return at(done.has(J.lake) ? J.lakeWinch : J.lake);
  if (fresh && kingdomReady(done) && !done.has(J.visitor)) return at(done.has(J.bridge) ? J.visitor : J.bridge);
  if (originalFourReady(done) || (kingdomReady(done) && (fresh ? midwayReady(done) : originalFourReady(done)))) {
    if (!done.has(J.meal)) return at(J.meal);
    if (!done.has(J.cargo)) {
      if (!done.has(J.cargoCall)) return at(J.cargoCall);
      return at(done.has(J.cargoSwitch) || done.has(J.cargoPin) || done.has(J.cargoParked) ? J.cargo : J.cargoSwitch);
    }
    if (!done.has(J.signal)) return at(done.has(J.signalLamp) ? J.signal : J.signalLamp);
    if (originalFourReady(done)) return at(done.has(J.compare) ? J.cutoff : J.compare);
  }
  return null;
}
