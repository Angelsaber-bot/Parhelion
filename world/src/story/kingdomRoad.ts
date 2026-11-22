import type { Localized } from '../settlements/types';

export const KINGDOM_ROAD = {
  front: 'kingdom_road_front', side: 'kingdom_road_side',
  start: 'kingdom_road_committed', finish: 'kingdom_road_finished',
} as const;
export const KINGDOM_ROAD_LABELS: Record<string, Localized> = {
  [KINGDOM_ROAD.front]: ['工程台 · 准备正门车桥', 'Works table · Prepare the main cart bridge'],
  [KINGDOM_ROAD.side]: ['工程台 · 准备修院侧路', 'Works table · Prepare the abbey passage'],
  [KINGDOM_ROAD.start]: ['门座施工令 · 锁定方案并前往卡姆兰', 'Gate works order · Commit the plan and advance to Camlann'],
  [KINGDOM_ROAD.finish]: ['开路绞柄 · 完成选定的永久工程', 'Road handle · Complete the selected permanent works'],
};
export const KINGDOM_ROAD_LINES: Record<string, Localized> = {
  [KINGDOM_ROAD.front]: ['已将外闸升到准备位。解开旧誓后，闸板将成为八米车桥，绞盘无法复原；罗恩改在桥外巡守。修院外桥与集会台保留。启动前仍可改选修院侧路。', 'The outer gate is in its ready position. After the oath breaks, its eight-metre cart bridge will sacrifice the winch; Rowan will patrol outside. The abbey bridge and meeting deck stay. You may change plans before committing.'],
  [KINGDOM_ROAD.side]: ['引水堤检修口已开启。解开旧誓后，修院外桥的一段将用来固定侧路，集会迁到下城。正门防御保留，货车在外侧换装。启动前仍可改选正门车桥。', 'The aqueduct service opening is ready. After the oath breaks, a section of the abbey bridge will secure this passage; meetings move to the lower street. The main defenses stay, and carts transfer loads outside. You may change plans before committing.'],
  [KINGDOM_ROAD.start]: ['艾妲把施工令交给两班工人。你先去卡姆兰解开旧誓；回来亲手动绞柄，工人才会放下闸板或拆走桥梁。', 'Ada sends the signed order to both crews. Break the oath at Camlann first. They will lower the gate or take down the bridge only when you return and turn the handle.'],
  [KINGDOM_ROAD.finish]: ['新路固定了。沿桥看实际的护栏、换装位与守夜点，再回到晚钟绳旁。', 'The new road is secured. Inspect its rails, loading area and watch posts, then return to the evening bell.'],
};
export function kingdomRoadChoice(done: ReadonlySet<string>) {
  return done.has(KINGDOM_ROAD.front) ? 'front' : done.has(KINGDOM_ROAD.side) ? 'side' : null;
}
export function kingdomRoadReady(id: string, done: ReadonlySet<string>) {
  if (!done.has('kingdom_works_lamp_fixed')) return false;
  if (done.has(KINGDOM_ROAD.finish)) return false;
  if (id === KINGDOM_ROAD.front || id === KINGDOM_ROAD.side) return !done.has(KINGDOM_ROAD.start) && !done.has(id);
  if (id === KINGDOM_ROAD.start) return !done.has(id) && kingdomRoadChoice(done) !== null;
  if (id === KINGDOM_ROAD.finish) return done.has(KINGDOM_ROAD.start) && done.has('sun_core');
  return false;
}
/** Mutations are transactional: callers can roll back the whole set on failed persistence. */
export function commitKingdomRoad(id: string, done: Set<string>) {
  if (!kingdomRoadReady(id, done)) return false;
  if (id === KINGDOM_ROAD.front || id === KINGDOM_ROAD.side) {
    done.delete(KINGDOM_ROAD.front); done.delete(KINGDOM_ROAD.side);
  }
  done.add(id); return true;
}
export function kingdomRoadNext(done: ReadonlySet<string>) {
  if (!done.has('kingdom_works_lamp_fixed') || done.has(KINGDOM_ROAD.finish)) return null;
  // Completed old saves can retain their original evening-bell closure.
  if (done.has('sun_core') && !kingdomRoadChoice(done)) return null;
  const choice = kingdomRoadChoice(done);
  if (!choice) return { id: KINGDOM_ROAD.front, text: ['工程台 · 选正门车桥或修院侧路；可先查看两份方案', 'Works tables · Inspect the cart bridge and abbey passage plans before choosing'] as Localized };
  if (!done.has(KINGDOM_ROAD.start)) return { id: KINGDOM_ROAD.start, text: KINGDOM_ROAD_LABELS[KINGDOM_ROAD.start] };
  if (!done.has('sun_core')) return null;
  const text: Localized = choice === 'front'
    ? ['外闸架 · 到罗恩的绞盘旁放下闸板，铺成车桥', 'Outer gate frame · Lower the shutter at Rowan’s winch to lay the cart bridge']
    : ['修院外桥 · 到近岸的棘轮旁拆走中段，送去加固侧路', 'Abbey bridge · Release the near-bank ratchet to donate the span to the side road'];
  return { id: KINGDOM_ROAD.finish, text };
}
