import type { Localized } from '../settlements/types';

export const FIFTH_ROAD = {
  map: 'valley_fifth_map', trace: 'valley_fifth_trace', lock: 'valley_fifth_lock', gate: 'valley_fifth_gate',
} as const;
export const WATERWORKS = {
  gauge: 'valley_water_gauge', seal: 'valley_water_seal', fill: 'valley_water_fill', divert: 'valley_water_divert',
  drain: 'valley_water_drain', foundation: 'valley_water_foundation', restore: 'valley_water_restore', low: 'valley_water_low',
} as const;
export const REPLAY_TEST = {
  desk: 'valley_replay_desk', plate: 'valley_replay_plate', bell: 'valley_replay_bell',
  cache: 'valley_replay_cache', compare: 'valley_replay_compare',
} as const;

type Step = { id: string; label: Localized; result: Localized; requires: readonly string[] };
type Investigation = { id: string; title: Localized; steps: readonly Step[] };
const step = (id: string, label: Localized, result: Localized, ...requires: string[]): Step => ({ id, label, result, requires });
const R = FIFTH_ROAD, W = WATERWORKS, B = REPLAY_TEST;

export const VALLEY_INVESTIGATIONS: readonly Investigation[] = [
  { id: 'fifth-road', title: ['总图里没有的第五条归路', 'The Fifth Road Home'], steps: [
    step(R.map, ['前哨旧图 · 查看第五个钉孔', 'Old outpost map · Inspect the fifth nail hole'],
      ['图上只有四条路，框边却留着第五个箭头的钉孔。潮湿的靴印从墙边通向溪底。', 'The map shows four ways out. A fifth arrow once hung at its edge. Fresh bootprints lead down to the stream.']),
    step(R.trace, ['溪底维修线 · 找到隐蔽检修口', 'Stream service line · Find the hidden access'],
      ['水渠从藤蔓后穿过去。入口是普通锈锁，近战能敲开；从里面才能拉开后院的单向门。', 'The channel continues behind the vines. Break the ordinary rusted lock with your blade. The yard gate opens from the inside.'], R.map),
    step(R.lock, ['检修口 · 近战打碎锈锁', 'Service opening · Break the rusty lock with melee'],
      ['锈锁落在石头上。穿过干渠，到另一端抬起门闩。', 'The lock drops on the stones. Follow the dry channel and lift the latch at the other end.'], R.trace),
    step(R.gate, ['前哨后门 · 从里面抬闩', 'Outpost back gate · Lift the latch from inside'],
      ['两端打通了。旧路牌多出一条归路，桥下的观察位也能用了。', 'Both ends are open. The old sign gains a fifth route, and the lookout below the bridge is accessible.'], R.lock),
  ] },
  { id: 'borrow-river', title: ['借一条河', 'Borrow a River'], steps: [
    step(W.gauge, ['镜湖水尺 · 对照取水最低线', 'Mirror Lake gauge · Check the intake minimum'],
      ['湖水低到这道线，取水轮就会停。沿旧渠往高处走，采场还有一个蓄水槽。', 'Below this line the town wheel stops. Follow the old channel uphill to the quarry reservoir.']),
    step(W.seal, ['旧支渠 · 关闭漏水检修板', 'Old branch · Close the leaking service flap'],
      ['回流被堵住了。把上游来水引进槽里，观察浮标。', 'The backflow stops. Feed the reservoir and watch its float.'], W.gauge),
    step(W.fill, ['采场蓄水槽 · 打开来水阀', 'Quarry reservoir · Open the inlet'],
      ['上游水开始进槽。浮标到刻线后，就能给镇上送水。', 'Water enters the reservoir. Once the float reaches the mark, the old channel can supply the town.'], W.seal),
    step(W.divert, ['通镇闸 · 切到备用水路', 'Town sluice · Switch to the backup channel'],
      ['备用渠接上了。水轮还在转，可以去湖岸降低局部水位。', 'The backup channel is connected. The wheel still turns. You can lower the maintenance basin now.'], W.fill),
    step(W.drain, ['湖岸泄水闸 · 露出旧基础', 'Lakeside drain · Expose the old foundations'],
      ['检修池水位下降，石阶和水运站基础露了出来。', 'The maintenance pool drops, exposing the stone stairs and freight station foundations.'], W.divert),
    step(W.foundation, ['旧水运站 · 检查承台刻痕', 'Old freight station · Inspect the platform markings'],
      ['承台比观测设备更早。这里以前就是水运站。许青把安全步道的标记留给后来人。', 'The platform predates the Observatory. It was a freight station. Xu Qing leaves markers for everyone using the new walkway.'], W.drain),
  ] },
  { id: 'not-live', title: ['这不是现场直播', 'This Is Not Live'], steps: [
    step(B.desk, ['广播室 · 对照屏幕和窗口', 'Broadcast room · Compare screen and window'],
      ['屏幕标着“当前”，但窗外的人刚走过，屏幕上一个也没有。翻板和铃可以各自做一次测试。', 'The screen says CURRENT, yet it missed the person who just passed the window. Test the plate and bell independently.']),
    step(B.plate, ['现实窗口 · 翻转校准板', 'Real window · Flip the calibration plate'],
      ['窗口里的斜纹翻了面，屏幕的斜纹没有动。', 'The diagonal marks flip in the window. The marks on screen do not move.'], B.desk),
    step(B.bell, ['现实窗口 · 拉测试铃', 'Real window · Pull the test bell'],
      ['铃声把窗外的鸟惊散了。屏幕上的鸟仍沿原来的轨迹飞。', 'The real bell scatters the birds. The birds on screen stay on their old track.'], B.desk),
    step(B.cache, ['广播机柜背面 · 接通本地缓存', 'Behind the broadcast rack · Open the local cache'],
      ['接线回到一个本地录播匣。最后有效时间仍停在 18:39，执行终端却一直把循环当成新的输入。', 'The cable ends at a local recording. Its last valid time is 18:39, but the enforcement terminal treats each loop as fresh input.'], B.plate, B.bell),
    step(B.compare, ['工坊日志 · 对齐录播与闸门时间', 'Workshop log · Match the cache to the gate times'],
      ['旧画面先被标成当前，旧命令才关门。事故有可核对的因果，还没有证据能确定是谁故意做的。', 'The old image was marked current before the old order shut the gate. That explains the sequence. It does not establish anyone’s intent.'], B.cache),
  ] },
];

export const VALLEY_INVESTIGATION_STEPS = new Map(VALLEY_INVESTIGATIONS.flatMap(chain => chain.steps.map(item => [item.id, item] as const)));
export const VALLEY_WATER_RESTORE: Localized = ['湖岸泄水闸 · 恢复正常水位', 'Lakeside drain · Restore normal water'];
export function valleyInvestigationReady(id: string, done: ReadonlySet<string>) {
  if (id === B.plate || id === B.bell) return done.has(B.desk);
  if (id === W.restore) return done.has(W.foundation) && done.has(W.low);
  if (id === W.drain) return done.has(W.divert) && !done.has(W.low);
  if (id === W.foundation && !done.has(W.low)) return false;
  const item = VALLEY_INVESTIGATION_STEPS.get(id);
  return !!item && !done.has(id) && item.requires.every(flag => done.has(flag));
}
