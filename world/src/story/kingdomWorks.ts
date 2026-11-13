import { KINGDOM_ROAD, kingdomRoadNext } from './kingdomRoad';
import type { Localized } from '../settlements/types';
import { KINGDOM_GATE as G } from './kingdomGate';
import { VALLEY_PROLOGUE as P } from './valleyPrologue';

export const KINGDOM_WORKS = {
  recall: 'kingdom_works_recall',
  pin: 'kingdom_works_lamp_pin',
  release: 'kingdom_works_lamp_release',
  market: 'kingdom_works_lamp_market',
  abbey: 'kingdom_works_lamp_abbey',
  patrol: 'kingdom_works_patrol',
  secure: 'kingdom_works_patrol_clear',
  lamp: 'kingdom_works_lamp_fixed',
  bell: 'kingdom_works_evening_bell',
  bread: 'kingdom_works_bread_window',
  wheel: 'kingdom_works_waterwheel',
} as const;
export type KingdomWork = typeof KINGDOM_WORKS[keyof typeof KINGDOM_WORKS];
export const KINGDOM_WATCH_ENCOUNTER = 'adventure_kingdom_watch';
const K = KINGDOM_WORKS;

export const KINGDOM_WORK_LABELS: Record<KingdomWork, Localized> = {
  [K.recall]: ['圆桌廊台 · 查看被收回的木梁', 'Round Table gallery · Witness the timber recall'],
  [K.pin]: ['射断吊臂旧索', 'Shoot the old hoist tie'],
  [K.release]: ['街灯吊臂 · 松开旧索', 'Street-lamp hoist · Release the old tie'],
  [K.market]: ['绞盘 · 把灯转向集市大道', 'Winch · Turn the light toward the market road'],
  [K.abbey]: ['绞盘 · 把灯转向修院口', 'Winch · Turn the light toward the abbey entrance'],
  [K.patrol]: ['木工掩体 · 拦住空甲巡卫', 'Carpenters’ shelter · Intercept the empty patrol'],
  [K.secure]: ['巡卫已退', 'Patrol repelled'],
  [K.lamp]: ['新守夜灯 · 固定未刻印的灯座', 'Watch lamp · Fasten the unmarked socket'],
  [K.bell]: ['晚钟 · 拉钟绳', 'Evening bell · Pull the bell rope'],
  [K.bread]: ['面包窗 · 支起窗板', 'Bakery · Prop up the shutter'],
  [K.wheel]: ['水车 · 松开卡住的齿', 'Waterwheel · Free the stuck tooth'],
};
export const KINGDOM_WORK_LINES: Partial<Record<KingdomWork, Localized>> = {
  [K.recall]: ['艾妲：“我今天刚用这根梁搭好棚。看，王室烙印亮了。”梁滑回旧门座，桌上的面包留在原处。她把一根未刻印的木料递给你。', 'Ada: “I put that shelter beam up today. Look at the royal mark.” The timber slides back into the old arch. The bread stays on the table. Ada hands you a piece of unmarked timber.'],
  [K.pin]: ['旧索断开。回绞盘选守夜灯的朝向。', 'The old tie parts. Choose the watch lamp’s direction at the winch.'],
  [K.release]: ['吊臂解开。可以转向集市或修院口。', 'The hoist is free. Turn it toward the market or the abbey.'],
  [K.market]: ['艾妲把灯移到集市大道上方。巡卫仍要封住这里。', 'Ada swings the lamp over the market road. The old patrol still means to shut it.'],
  [K.abbey]: ['艾妲把灯移到修院口上方。巡卫仍要封住这里。', 'Ada swings the lamp over the abbey entrance. The old patrol still means to shut it.'],
  [K.secure]: ['巡卫退下了。现在把守夜灯的灯座固定。', 'The patrol is down. Fasten the watch lamp to its socket.'],
  [K.lamp]: ['旧梁又回到门座，守夜灯还在。罗恩把值班牌挂到灯下。去卡姆兰解除维持封锁的最后一道旧誓。', 'The old timber returns to the arch again. The watch lamp stays. Rowan hangs the watch roster under it. Go to Camlann and end the oath still enforcing the blockade.'],
  [K.bell]: ['钟锤终于敲完。艾妲把时间牌翻到晚班，罗恩走到新灯下接岗。城门内有人开始摆晚饭。', 'The bell completes its stroke. Ada turns the board to the evening watch and Rowan takes his place under the new lamp. Someone inside the gate begins setting out dinner.'],
  [K.bread]: ['窗板稳住了。面包师把第一块热面包搁在窗边。', 'The shutter holds. The baker sets the first piece of warm bread by the window.'],
  [K.wheel]: ['水开始重新推动轮叶。水车的响声回到街上。', 'Water catches the paddles again. The sound of the wheel returns to the street.'],
};

export const kingdomWorksActive = (done: ReadonlySet<string>) =>
  done.has(K.recall) || (done.has(P.room) && !done.has('sun_core'));
const hoistFree = (done: ReadonlySet<string>) => done.has(K.pin) || done.has(K.release);
const pointed = (done: ReadonlySet<string>) => done.has(K.market) || done.has(K.abbey);
export const kingdomWorksEnded = (done: ReadonlySet<string>) => !kingdomWorksActive(done) || done.has(K.bell);

export function kingdomWorkReady(id: KingdomWork, done: ReadonlySet<string>) {
  if (!kingdomWorksActive(done) || !done.has(G.rescued) || done.has(id)) return false;
  if (id === K.bread || id === K.wheel) return true;
  if (id === K.recall) return done.has('hall_brazier_1') && !done.has('sun_core');
  if (id === K.bell) return done.has(K.lamp) && done.has('sun_core') && (!done.has(KINGDOM_ROAD.start) || done.has(KINGDOM_ROAD.finish));
  if (!done.has(K.recall) || done.has('sun_core')) return false;
  if (id === K.pin || id === K.release) return !hoistFree(done);
  if (id === K.market || id === K.abbey) return hoistFree(done) && !pointed(done);
  if (id === K.patrol || id === K.secure) return pointed(done) && !done.has(K.secure);
  return done.has(K.secure);
}

export function kingdomWorksNext(done: ReadonlySet<string>) {
  const road = kingdomRoadNext(done); if (road) return road;
  const id = [K.recall, K.release, K.market, K.patrol, K.lamp, K.bell].find(work => kingdomWorkReady(work, done));
  return id ? { id, text: KINGDOM_WORK_LABELS[id] } : null;
}

export function commitKingdomWork(id: KingdomWork, done: Set<string>) {
  if (id === K.patrol || !kingdomWorkReady(id, done)) return false;
  done.add(id);
  return true;
}
