import * as THREE from 'three';
import type { PlacedNpcSocket } from '../settlements/types';
import { residentWalkRig } from '../settlements/residentWalk';
import { EGYPT_OFFSET as QIN_OFFSET } from './egyptPlan';

const world = (p: readonly [number, number, number]): [number, number, number] => [p[0] + QIN_OFFSET[0], p[1], p[2] + QIN_OFFSET[1]];
type Line = readonly [string, string];
interface QinResident { id: string; role: readonly [string, string]; p: readonly [number, number, number]; yaw: number; coat: number; trim: number; carry?: 'sack' | 'net' | 'bellrope'; lines: readonly Line[] }
/** People of the oasis, river and temple; each one points to a different road or the light. */
export const EGYPT_RESIDENTS: readonly QinResident[] = [
  { id: 'egypt_caravan_master', role: ['商队首领 · 绿洲', 'Caravan master · oasis'], p: [-152, 14, 118], yaw: -2.2, coat: 0xe6dcc2, trim: 0x2f5f8f,
    lines: [['商队从京都那边的古道进来，在泉湖歇脚。往东顺着河岸走到码头，再沿狮身像大道就到神殿。', 'Caravans come in on the old road from Kyoto and rest by the spring. Follow the bank east to the quay, then the sphinx avenue to the temple.'], ['往北的路进裂日峡谷，能从神殿西门绕进去。', 'The road north enters the Sunrift Canyon and reaches the temple by its west gate.']] },
  { id: 'egypt_water_seller', role: ['卖水人', 'Water seller'], p: [-180, 14, 124], yaw: 1.4, coat: 0x8a6a46, trim: 0xd8a94a, carry: 'sack',
    lines: [['泉水甜，河水浑。进峡谷前多带一囊。', 'The spring is sweet, the river muddy. Take an extra skin before the canyon.']] },
  { id: 'egypt_boatman', role: ['船夫 · 日河码头', 'Boatman · Sun River quay'], p: [-24, 10, 142], yaw: 2.9, coat: 0x6b4a2f, trim: 0xece2c6, carry: 'net',
    lines: [['量水尺上的刻度是每年洪水到的地方。今年水落得早。', 'The marks on the nilometer show each year\'s flood. This year the water fell early.'], ['上岸往东北走，两排羊首狮身像会把你领到巨像庭院。', 'Go north-east from the landing; two rows of ram sphinxes lead you to the Court of Colossi.']] },
  { id: 'egypt_scribe', role: ['书吏 · 巨像庭院', 'Scribe · Court of Colossi'], p: [70, 24, 30], yaw: 2.2, coat: 0xefe4c8, trim: 0x24477a,
    lines: [['两尊坐像守着坡道。神殿中庭东边有面金盘，日光从那里出来。', 'The two seated kings guard the ramp. In the temple court a golden disc to the east lets the sunlight out.']] },
  { id: 'egypt_priest', role: ['日神祭司', 'Priest of the Sun'], p: [72, 30, -104], yaw: Math.PI / 2, coat: 0xf2ead2, trim: 0xdba93a,
    lines: [['光只走直路，只从铜镜亮的那一面折回。三面镜子摆对了，光就会穿过多柱厅照到圣所的日轮。', 'Light keeps to straight lines and turns back only from a mirror\'s bright face. Set the three right and it crosses the hall to the sun disc in the sanctuary.'], ['日轮亮了，后面的石门才会让路。', 'When the disc blazes, the stone door behind it gives way.']] },
  { id: 'egypt_roof_watcher', role: ['观星祭司', 'Star-watching priest'], p: [48, 40, -140], yaw: Math.PI, coat: 0x24477a, trim: 0xdba93a,
    lines: [['从中庭西侧的阶梯能上屋顶。夜里在这里看星，白天守着祭坛的火。', 'The stair on the west of the court leads up here. By night we watch the stars; by day we tend the altar fire.']] },
  { id: 'egypt_tomb_mason', role: ['石匠 · 峡谷崖墓', 'Mason · canyon tombs'], p: [-86, 20.3, -110], yaw: .4, coat: 0xa9784a, trim: 0x6b4a2f,
    lines: [['崖墓的门楣是从山里直接凿出来的。往东上坡，峡谷会把你送上台地。', 'These lintels were cut straight from the cliff. Climb east and the canyon brings you onto the plateau.']] },
  { id: 'egypt_pyramid_guard', role: ['金字塔守卫', 'Pyramid guard'], p: [150, 36.5, -172], yaw: -.8, coat: 0xd8b77a, trim: 0xa8432f,
    lines: [['金字塔的封顶石是鎏金的，日出时整座塔都亮。从神殿东边的堤道过来最近。', 'The capstone is gilded; at dawn the whole pyramid shines. The causeway from the temple\'s east side is the shortest way.']] },
  { id: 'egypt_courier', role: ['商队骆驼夫', 'Camel driver'], p: [-158, 14, 111.5], yaw: 1.3, coat: 0xc49a64, trim: 0xa8432f, carry: 'sack',
    lines: [['从码头回来，骆驼还要喝水。', 'Back from the quay; the camels still need water.']] },
];

export function egyptResidentSockets(): PlacedNpcSocket[] {
  return EGYPT_RESIDENTS.map(s => ({ id: s.id, role: [...s.role], position: world(s.p), yaw: s.yaw, region: 'britain', worldRegion: 'egypt', appearance: { coat: s.coat, trim: s.trim, accent: 0xbba05e, ...(s.carry ? { carry: s.carry } : {}) }, lines: s.lines.map(l => [...l]) }));
}

type ResidentHost = { group: THREE.Group; getPosition(id: string): [number, number, number] | null; pose(id: string, p: [number, number, number], yaw: number): boolean };
/** Residents settle on real collision; the camel driver walks the bank between town and quay. */
export function createEgyptResidentLife(host: ResidentHost, ground: (x: number, z: number, ceiling: number) => number | null) {
  const patrols = [{ id: 'egypt_courier', speed: 1.1, path: [[-158, 14, 111.5], [-130, 13.2, 117.6], [-100, 12.3, 124], [-62, 11.1, 132.4]] as [number, number, number][] }];
  const walkers = patrols.map(p => { const root = host.group.getObjectByName(`Resident_${p.id}`)!; return { ...p, root, rig: residentWalkRig(root), index: 0, direction: 1, phase: 0, startY: root.position.y }; });
  for (const s of EGYPT_RESIDENTS) { const p = host.getPosition(s.id); if (!p) continue; const y = ground(p[0], p[2], p[1] + 2); if (y !== null && Math.abs(y - p[1]) < 3) host.pose(s.id, [p[0], y + .02, p[2]], s.yaw); const root = host.group.getObjectByName(`Resident_${s.id}`); if (root) root.userData.region = 'egypt'; }
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
