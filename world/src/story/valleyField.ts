import type { Localized } from '../settlements/types';

export const VALLEY_FIELD = {
  nightStart: 'journey_night_isolation',
  paperMap: 'journey_night_paper_map',
  dimWatch: 'journey_night_dark_lamp',
  soundDecoy: 'journey_night_falls_decoy',
  nightPatrol: 'journey_night_patrol',
  patrolCleared: 'journey_night_patrol_cleared',
  radioRemove: 'journey_night_remove_receiver',
  countPatch: 'journey_night_patch_count',
  nightBrace: 'journey_night_brace',
  nightDone: 'journey_night_reopened',
  roofSight: 'journey_sky_roof_sight',
  replay: 'journey_alert_cache_replay',
  disconnect: 'journey_alert_bridge_disconnected',
  doorPower: 'journey_local_door_power',
  doorDisconnect: 'journey_local_door_disconnected',
  doorRequest: 'journey_local_door_request',
  doorNear: 'journey_local_door_near',
  doorFar: 'journey_local_door_far',
  doorLoad: 'journey_local_door_load',
  drillStart: 'journey_drill_start',
  drillBeacon: 'journey_drill_return_beacon',
  drillCart: 'journey_drill_help_cart',
  drillObserver: 'journey_drill_help_observer',
  drillDone: 'journey_drill_report',
  towerLow: 'journey_tower_low_approach',
  towerHigh: 'journey_tower_high_approach',
  chair: 'journey_epilogue_chair',
  nextSlip: 'journey_epilogue_next_slip',
} as const;
const F = VALLEY_FIELD;

type FieldAction = { id: string; label: Localized; text: Localized; result: Localized; after?: readonly string[] };
const field = (id: string, label: Localized, text: Localized, result: Localized, after?: readonly string[]): FieldAction => ({ id, label, text, result, after });
export const VALLEY_FIELD_ACTIONS = [
  field(F.nightStart, ['夜间试验 · 切开执行线', 'Night trial · Isolate command'], ['在外站启动试验，保留天气预警，切开命令线。', 'Start the local trial at the outpost. Keep weather alerts and isolate command.'], ['自动路牌失去同步。去回声林核对手绘路线，沿纸图继续。', 'The automatic signs have lost sync. Check the paper route in Echo Wood and follow it.']),
  field(F.paperMap, ['回声林 · 核验纸图', 'Echo Wood · Verify paper map'], ['在回声林核验纸图上的下堤路线。', 'Verify the lower route on the paper map in Echo Wood.'], ['纸图标出了雾瀑侧坡和接点。可熄观察灯或放响水板。', 'The map marks the waterfall flank and junction. Dim the watchlamp or sound the waterboard.'], [F.nightStart]),
  field(F.dimWatch, ['雾瀑 · 熄观察灯', 'Mist Falls · Dim the watchlamp'], ['熄掉观察灯，让远处枪手失去联络。也可用水板把他们引到侧坡。', 'Dim the watchlamp to break the gunner’s contact, or use the waterboard to draw the patrol onto the slope.'], ['观察灯熄灭。警戒枪手没有收到集合信号。', 'The watchlamp goes dark. The gunner misses the rally signal.'], [F.paperMap]),
  field(F.soundDecoy, ['雾瀑 · 敲响水板', 'Mist Falls · Sound the waterboard'], ['敲响水板，把巡卫的注意力引向侧坡。', 'Sound the waterboard to draw the patrol toward the flank.'], ['水声传到侧坡。支援巡卫改变了进场方向。', 'The waterboard echoes from the flank. Reinforcements change their approach.'], [F.paperMap]),
  field(F.nightPatrol, ['旧前哨 · 接点受阻', 'Old Outpost · Junction blocked'], ['到旧前哨接点拦下巡护官 07。桥下还有一名工人。', 'Stop Patrol Officer 07 at the old outpost junction. One worker is still below the bridge.'], ['07 正尝试恢复远程封路。先打断接点的武装。', '07 is restoring the remote lock. Stop the armed patrol at the junction.']),
  field(F.radioRemove, ['拆下远程接收器', 'Remove the remote receiver'], ['拆下 07 的远程接收器，或把真实人员计数接入救援口。', 'Remove 07’s remote receiver, or feed the verified headcount to its rescue port.'], ['07 停机，闸门切回本地控制。', '07 powers down. The gate switches to local control.'], [F.patrolCleared]),
  field(F.countPatch, ['把人员计数接入救援口', 'Feed the headcount to the rescue port'], ['把现场人数接到 07 的本地救援口。', 'Feed the verified headcount to 07’s local rescue port.'], ['本地计数更新。07 重新评估现场，为最后一人打开通路。', 'The local count updates. 07 reassesses the scene and lets the last worker through.'], [F.patrolCleared]),
  field(F.nightBrace, ['回望桥 · 固定棘爪', 'Lookback Bridge · Brace the crossing'], ['沿通路到回望桥，与许青扣上机械棘爪。', 'Follow the route to Lookback Bridge and set the mechanical brace with Xu Qing.'], ['棘爪固定。顾桥用天气预警叫停了棚顶施工，最后一名工人沿新通路撤出。', 'The brace is set. Gu Qiao stops work on the roof after a weather alert. The last worker takes the open route.']),
  field(F.nightDone, ['回望桥 · 登记人员到齐', 'Lookback Bridge · Check the headcount'], ['等桥下工人走到安全线，核对名单。', 'Wait for the worker to reach the safe line and check the roster.'], ['人员到齐。旧外站雨棚受损，补给先移到广场，下一班由居民轮值。', 'Everyone is clear. The old outpost awning is damaged. Supplies move to the square for the next local shift.'], [F.nightBrace]),
  field(F.roofSight, ['屋顶仪器 · 近远参照', 'Roof instrument · Compare bearings'], ['对照两座固定山峰，记录校准片的视差。', 'Use the two fixed peaks to record parallax on the calibration plate.'], ['近片移动，远方山峰仍对齐。带着结果去镜湖北岸复核。', 'The near plate shifts while the far peaks stay aligned. Take the result to Mirror Lake for a second reading.']),
  field(F.replay, ['塔外缓存 · 重放告警', 'Tower cache · Replay the alert'], ['重放塔外缓存，比对预测时刻、原录音与现场记录。', 'Replay the tower cache and compare the forecast time, recording, and field report.'], ['缓存标的是预测 18:42。公共电台提前转发了顾桥旧演练中的告警录音。', 'The cache marks 18:42 as a forecast. The public radio forwarded Gu Qiao’s old drill recording early.']),
  field(F.disconnect, ['诊断台 · 断开旧转播', 'Diagnostic station · Disconnect the old relay'], ['切断诊断缓存通向公共电台的桥接。', 'Disconnect the bridge from diagnostic cache to the public radio.'], ['诊断端仍在播放，手台停止回放。公共求救频道保持可用。', 'The diagnostic terminal keeps playing. The handheld falls quiet and the emergency channel stays open.'], [F.replay]),
  field(F.doorPower, ['外站 · 检查本地门电源', 'Outpost · Check local gate power'], ['在外站接通本地门电源，查看机械锁。', 'Connect the local gate power and check the mechanical lock.'], ['本地电源稳定。先切开命令输入，再测试中央闭门请求。', 'Local power is stable. Isolate command input before testing a central close request.']),
  field(F.doorDisconnect, ['切断门的远程命令线', 'Disconnect the gate’s command line'], ['切开命令线，保留本地电源。', 'Isolate the command line and keep local power.'], ['命令线已断，本地门仍有供电。', 'The command line is isolated and the gate still has power.'], [F.doorPower]),
  field(F.doorRequest, ['发出中央闭门请求', 'Send a central close request'], ['发出一次中央关门请求，查看门的实际响应。', 'Send one central close request and watch the gate’s actual response.'], ['请求亮起，门没有动作。许青从近侧使用本地锁。', 'The request lamp lights. The gate stays put. Xu Qing can use the near-side lock.'], [F.doorDisconnect]),
  field(F.doorNear, ['从近侧开门', 'Open from the near side'], ['打开近侧机械锁，亲自穿过门。', 'Release the near-side mechanical lock and walk through the gate.'], ['近侧打开了门。到另一侧验证手柄。', 'The near-side lock opens the gate. Test the handle on the other side.'], [F.doorRequest]),
  field(F.doorFar, ['从远侧合门', 'Close from the far side'], ['从门的另一侧操作手柄，让许青验证两边都能控制。', 'Use the handle on the other side so Xu Qing can verify both controls.'], ['远侧也能合门。按承重刻线固定横梁，做最后一次测试。', 'The far side can close the gate too. Set the crossbeam on the load marks for the final test.'], [F.doorNear]),
  field(F.doorLoad, ['按刻线固定横梁', 'Set the crossbeam on the load marks'], ['核对承重刻线，让许青在自己的权限下做载荷测试。', 'Check the load marks and let Xu Qing test under her own authority.'], ['许青独立完成载荷测试，顾桥签下交接记录。门由两侧本地维护。', 'Xu Qing completes the load test on her own authority. Gu Qiao signs the handover. Both sides can maintain the gate.'], [F.doorFar]),
  field(F.drillStart, ['生活馆 · 开始换班演练', 'Residence · Begin the shift drill'], ['查看孟槐、阿舟和接应队已经排好的班表。', 'Read the shift plan Meng Huai, Azhou and the relief crew prepared.'], ['班次已排好。你作为远端外勤，去林线挂回程信标。', 'The shifts are assigned. Hang the return beacon on the forest route as the field runner.']),
  field(F.drillBeacon, ['林线 · 挂回程信标', 'Forest route · Hang the return beacon'], ['去林线挂上回程信标，收听地面的演练消息。', 'Hang the return beacon on the forest route and listen to the drill.'], ['货车偏载，观测员的线路也断了。你可协助其一，地面班组接手另一处。', 'The cart is off balance and the observer has lost contact. Help either one and the crew handles the other.'], [F.drillStart]),
  field(F.drillCart, ['协助货车改道', 'Help reroute the cart'], ['协助货车进安全支线，或去接回观测员。', 'Help the cart into the safe siding, or meet the observer.'], ['货车进了支线。阿舟已带观测员往集合点走。', 'The cart takes the siding. Azhou is leading the observer to the rally point.'], [F.drillBeacon]),
  field(F.drillObserver, ['接回最后的观测员', 'Meet the last observer'], ['接观测员回到核验过的安全路。', 'Meet the observer on the verified safe route.'], ['观测员已接上。许青把货车移到了安全支线。', 'The observer is with you. Xu Qing has moved the cart onto the safe siding.'], [F.drillBeacon]),
  field(F.drillDone, ['广场 · 核对演练结果', 'Square · Verify the drill'], ['到广场核对货车与观测员是否都已到达。', 'Verify that the cart and observer both reached the square.'], ['两边都已到达。地面班组确认可独立值守，你可以准备登塔。', 'Both reached the square. The ground crew can hold the shift on its own. You can prepare to climb.']),
  field(F.towerLow, ['雾瀑维护线 · 塔脚接近', 'Falls maintenance · Tower approach'], ['经低路核对维护线，或从采场高路查探接驳台。', 'Verify the low maintenance path or scout the cradle from the upper quarry route.'], ['低路检查完毕。接近塔脚时，沿维护侧线绕过外侧视野。', 'Low route verified. Take the maintenance flank as you approach the tower.']),
  field(F.towerHigh, ['采场高路 · 塔外测线', 'Upper quarry · Tower survey'], ['从高路标出发射器的射线。', 'Mark the transmitter’s firing lane from the upper road.'], ['高路已标记。守门者与接驳架的位置从这里看得清楚。', 'Upper route marked. The Warden and boarding cradle are visible from here.']),
  field(F.chair, ['搬椅子到灯下', 'Move the chair under the light'], ['在生活馆帮孟槐把椅子搬到灯下。', 'Help Meng Huai move the chair under the light at the residence.'], ['椅子靠到桌边。阿舟在清点下一趟外勤要带的东西。', 'The chair is by the table. Azhou is counting what to take on the next trip.']),
  field(F.nextSlip, ['在新任务单写下目的地', 'Write a destination on the new slip'], ['把旧单收进柜子，在新单写下目的地。', 'File the old slip and write a destination on the new one.'], ['明天的目的地写好了。今天还可以坐一会儿。', 'Tomorrow’s destination is written down. There’s still time to sit today.'], [F.chair]),
] as const;

export const VALLEY_FIELD_BY_ID = new Map(VALLEY_FIELD_ACTIONS.map(action => [action.id, action]));
export const VALLEY_NIGHT_ENCOUNTER = 'adventure_valley_07';
export const nightTacticReady = (done: ReadonlySet<string>) => done.has(F.dimWatch) || done.has(F.soundDecoy);
export const nightAuthorityOpen = (done: ReadonlySet<string>) => done.has(F.radioRemove) || done.has(F.countPatch);
export const towerApproachVerified = (done: ReadonlySet<string>) => done.has(F.towerLow) || done.has(F.towerHigh);
