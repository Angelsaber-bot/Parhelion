import * as THREE from 'three';
import type { PlacedNpcSocket } from '../settlements/types';
import { residentWalkRig } from '../settlements/residentWalk';
import { QIN_OFFSET, qinToWorld } from './qinPlan';

// Authored in the region's own frame, which stands turned half a circle in the world.
const world = (p: readonly [number, number, number]): [number, number, number] => { const [x, z] = qinToWorld(p[0], p[2]); return [x, p[1], z]; };
const worldYaw = (yaw: number) => yaw + Math.PI;
type Line = readonly [string, string];
interface QinResident { id: string; role: readonly [string, string]; p: readonly [number, number, number]; yaw: number; coat: number; trim: number; carry?: 'sack' | 'net' | 'bellrope'; lines: readonly Line[] }
/** People of the Lishan town and palace; each one points to a different way up or down the mountain. */
export const QIN_RESIDENTS: readonly QinResident[] = [
  { id: 'qin_post_master', role: ['驿丞 · 骊山驿', 'Post master · Lishan relay'], p: [-176, 22, 106], yaw: -Math.PI / 2, coat: 0x2e2c2b, trim: 0xa63a2c,
    lines: [['驿道往西过骊水关，再顺山肩盘上去就是宫门。车马走正门，脚夫常走水渠边的检修步道。', 'The post road runs west through the Li River Pass and winds up the shoulder to the palace gate. Carts take the gate; porters prefer the aqueduct walk.'], ['往南上山脊有四座烽燧，走到头就是宫城的观阙。', 'South over the ridge there are four beacon towers; at the end of the crest path is the palace watch tower.']] },
  { id: 'qin_potter', role: ['陶工 · 龙窑', 'Potter · dragon kilns'], p: [-208, 24, 63], yaw: 2.6, coat: 0x7f6249, trim: 0xc9b991,
    lines: [['窑火要一节一节往上赶，投柴孔亮的那一段就是正在烧的。', 'The fire is driven up the kiln one chamber at a time; the glowing stoke holes mark the chamber now firing.'], ['宫里要的瓦当和俑都从这里出窑，再用车送进山里。', 'The palace tile ends and the figures leave these kilns, then go by cart into the mountain.']] },
  { id: 'qin_bronzesmith', role: ['铜匠 · 铸造棚', 'Bronzesmith · foundry shed'], p: [-123, 22.6, 115], yaw: Math.PI, coat: 0x5f4a3a, trim: 0x5f7c66, carry: 'sack',
    lines: [['山腹里的大炉一直没熄。下面的人说，铜汁沿着槽走，俑就跟着轨道走。', 'The great furnaces inside the mountain have never gone out. Down there the bronze runs in channels and the figures run on rails.'], ['石料场的检修道直通军阵，可阵里的兵俑只听军令台的。', 'The quarry maintenance tunnel leads straight to the garrison, but the ranks there obey only the command posts.']] },
  { id: 'qin_archivist', role: ['简牍吏', 'Archivist of slips'], p: [-205, 22, 129], yaw: -2.5, coat: 0x3c4a5a, trim: 0xc9a25a,
    lines: [['守陵阵封西列，让道阵封东列，斜井的铜闸只在让道阵时升起。账上都写着。', 'Guard order seals the west row, open order seals the east, and the shaft gate rises only under open order. It is all in the ledgers.'], ['三座军令台分在西、中、东三区，无论阵怎么转，总有一座够得着。', 'There are three command posts, west, middle and east; however the ranks turn, one is always within reach.']] },
  { id: 'qin_quarryman', role: ['石匠 · 南坡石料场', 'Quarryman · south slope'], p: [-134, 28, -47], yaw: .8, coat: 0x8a8a7e, trim: 0x6c6e69,
    lines: [['洞口那道门通检修道，平的，一直走就进军阵东区。', 'That gate is the maintenance tunnel. It is level all the way into the east of the garrison.'], ['从这儿回镇里，跟着水渠岔道下去就行。', 'To get back to town, follow the branch path down to the aqueduct.']] },
  { id: 'qin_pass_officer', role: ['关吏 · 骊水关', 'Pass officer · Li River'], p: [-60, 28.6, 90.5], yaw: Math.PI, coat: 0x26262a, trim: 0xa63a2c,
    lines: [['过关验符。往前是宫城的山道，盘两道弯就到宫门。', 'Show your tally. Beyond lies the palace road; two bends up and you reach the gate.'], ['关墙顺着两边山坡爬上去，敌楼里能看见整条河谷。', 'The pass walls climb both slopes; from the watch towers you can see the whole valley.']] },
  { id: 'qin_palace_guard', role: ['宫门卫', 'Palace gate guard'], p: [33, 57.6, 94], yaw: Math.PI / 2, coat: 0x1f1d1c, trim: 0xc0452f,
    lines: [['入门直走是外朝，上龙尾道就是前殿。殿后的山屏里开着通往地下的斜道。', 'Straight in is the outer court; up the dragon-tail ramp is the front hall. Behind it, the mountain screen opens on the incline down.']] },
  { id: 'qin_water_keeper', role: ['水工 · 输水渠', 'Water keeper · aqueduct'], p: [-114, 30, 22], yaw: -1.9, coat: 0x4f6878, trim: 0xb8823f,
    lines: [['渠水从宫城蓄水池流下来，一路跌水。顺着渠边步道往上，就从东侧水门进了宫。', 'The channel falls step by step from the palace cistern. Walk up beside it and you enter the palace by the east water gate.'], ['往南的岔道通石料场。', 'The branch south leads to the quarry.']] },
  { id: 'qin_tomb_keeper', role: ['守陵人', 'Keeper of the mound'], p: [47, 70, -34], yaw: Math.PI, coat: 0x2b2a2e, trim: 0x8a8a7e,
    lines: [['斜道下去是铸造层，炉火照得见路。再往下，兵俑不认人，只认军令。', 'The incline leads down to the foundry; the furnaces light the way. Further down the figures know no one, only the order.'], ['最深处的王城，星图在头上，水银在脚下。别站在转台上下令。', 'In the deepest city the stars are overhead and the mercury underfoot. Never give an order while standing on a turntable.']] },
  { id: 'qin_courier', role: ['驿卒', 'Relay courier'], p: [-178, 22.1, 95], yaw: 1.3, coat: 0x2e2c2b, trim: 0xb8823f, carry: 'sack',
    lines: [['从关上下来，信要在日落前进驿。', 'Down from the pass; the dispatches must reach the relay before sunset.']] },
];

export function qinResidentSockets(): PlacedNpcSocket[] {
  return QIN_RESIDENTS.map(s => ({ id: s.id, role: [...s.role], position: world(s.p), yaw: worldYaw(s.yaw), region: 'britain', worldRegion: 'qin', appearance: { coat: s.coat, trim: s.trim, accent: 0xbba05e, ...(s.carry ? { carry: s.carry } : {}) }, lines: s.lines.map(l => [...l]) }));
}

type ResidentHost = { group: THREE.Group; getPosition(id: string): [number, number, number] | null; pose(id: string, p: [number, number, number], yaw: number): boolean };
/** Residents settle on real collision; the courier walks the post road between town and pass. */
export function createQinResidentLife(host: ResidentHost, ground: (x: number, z: number, ceiling: number) => number | null) {
  const patrols = [{ id: 'qin_courier', speed: 1.15, path: [[-178, 22.1, 95], [-140, 23.1, 83], [-104, 25.1, 77.5], [-80, 26.5, 79]] as [number, number, number][] }];
  const walkers = patrols.map(p => { const root = host.group.getObjectByName(`Resident_${p.id}`)!; return { ...p, root, rig: residentWalkRig(root), index: 0, direction: 1, phase: 0, startY: root.position.y }; });
  for (const s of QIN_RESIDENTS) { const p = host.getPosition(s.id); if (!p) continue; const y = ground(p[0], p[2], p[1] + 2); if (y !== null && Math.abs(y - p[1]) < 3) host.pose(s.id, [p[0], y + .02, p[2]], worldYaw(s.yaw)); const root = host.group.getObjectByName(`Resident_${s.id}`); if (root) root.userData.region = 'qin'; }
  let disposed = false;
  return {
    update(dt: number, player: THREE.Vector3, speaking: string | null, ready: boolean) {
      if (disposed || !ready || Math.hypot(player.x - QIN_OFFSET[0], player.z - QIN_OFFSET[1]) > 500) return;
      dt = Number.isFinite(dt) ? Math.min(.05, Math.max(0, dt)) : 0;
      for (const p of walkers) {
        const at = host.getPosition(p.id)!; if (Math.hypot(at[0] - player.x, at[2] - player.z) > 95) continue;
        const paused = speaking === p.id || Math.hypot(at[0] - player.x, at[2] - player.z) < 3;
        let yaw = p.root.rotation.y;
        if (dt > 0 && !paused) {
          let next = p.index + p.direction; if (next >= p.path.length || next < 0) { p.direction *= -1; next = p.index + p.direction; }
          const goal = world(p.path[next]), dx = goal[0] - at[0], dz = goal[2] - at[2], distance = Math.hypot(dx, dz), move = Math.min(distance, dt * p.speed);
          if (distance < .08) { p.index = next; continue; }
          const x = at[0] + dx / distance * move, z = at[2] + dz / distance * move, y = ground(x, z, at[1] + 1.5);
          if (y !== null && Math.abs(y - at[1]) < .55) { yaw = Math.atan2(dx, dz); host.pose(p.id, [x, y + .02, z], yaw); p.phase += move * 5; }
        }
        const position = host.getPosition(p.id)!; p.root.rotation.y = yaw; p.rig.update(p.phase, !paused && dt > 0, position[1] - p.startY);
      }
    },
    dispose() { disposed = true; },
  };
}
