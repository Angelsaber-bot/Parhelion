import * as THREE from 'three';
import type { PlacedNpcSocket } from '../settlements/types';
import { residentWalkRig } from '../settlements/residentWalk';
import { EGYPT_OFFSET as QIN_OFFSET, egyptToWorld as qinToWorld } from './egyptPlan';

// Authored in the region's own frame, which stands turned half a circle in the world.
const world = (p: readonly [number, number, number]): [number, number, number] => { const [x, z] = qinToWorld(p[0], p[2]); return [x, p[1], z]; };
const worldYaw = (yaw: number) => yaw + Math.PI;
type Line = readonly [string, string];
interface QinResident { id: string; role: readonly [string, string]; p: readonly [number, number, number]; yaw: number; coat: number; trim: number; carry?: 'sack' | 'net' | 'bellrope'; lines: readonly Line[] }
/** People of the oasis, river and temple; each one points to a different road or the light. */
export const EGYPT_RESIDENTS: readonly QinResident[] = [
  { id: 'egypt_caravan_master', role: ['商队首领 · 绿洲', 'Caravan master · oasis'], p: [-152, 14, 118], yaw: -2.2, coat: 0xe6dcc2, trim: 0x2f5f8f,
    lines: [['商队从京都那边的古道进来，在泉湖歇脚。往西顺着河岸走到码头，再沿狮身像大道就到神殿。', 'Caravans come in on the old road from Kyoto and rest by the spring. Follow the bank west to the quay, then the sphinx avenue to the temple.'], ['往南的路进裂日峡谷，能从神殿东门绕进去。', 'The road south enters the Sunrift Canyon and reaches the temple by its east gate.']] },
  { id: 'egypt_water_seller', role: ['卖水人', 'Water seller'], p: [-180, 14, 124], yaw: 1.4, coat: 0x8a6a46, trim: 0xd8a94a, carry: 'sack',
    lines: [['泉水甜，河水浑。进峡谷前多带一囊。', 'The spring is sweet, the river muddy. Take an extra skin before the canyon.']] },
  { id: 'egypt_boatman', role: ['船夫 · 日河码头', 'Boatman · Sun River quay'], p: [-24, 10, 142], yaw: 2.9, coat: 0x6b4a2f, trim: 0xece2c6, carry: 'net',
    lines: [['量水尺上的刻度是每年洪水到的地方。今年水落得早。', 'The marks on the nilometer show each year\'s flood. This year the water fell early.'], ['上岸往西南走，两排羊首狮身像会把你领到巨像庭院。', 'Go south-west from the landing; two rows of ram sphinxes lead you to the Court of Colossi.']] },
  { id: 'egypt_scribe', role: ['书吏 · 巨像庭院', 'Scribe · Court of Colossi'], p: [70, 24, 30], yaw: 2.2, coat: 0xefe4c8, trim: 0x24477a,
    lines: [['两尊坐像守着坡道。神殿中庭西边有面金盘，日光从那里出来。', 'The two seated kings guard the ramp. In the temple court a golden disc to the west lets the sunlight out.']] },
  { id: 'egypt_priest', role: ['日神祭司', 'Priest of the Sun'], p: [72, 30, -104], yaw: Math.PI / 2, coat: 0xf2ead2, trim: 0xdba93a,
    lines: [['光只走直路，只从铜镜亮的那一面折回。三面镜子摆对了，光就会穿过多柱厅照到圣所的日轮。', 'Light keeps to straight lines and turns back only from a mirror\'s bright face. Set the three right and it crosses the hall to the sun disc in the sanctuary.'], ['日轮亮了，后面的石门才会让路。', 'When the disc blazes, the stone door behind it gives way.']] },
  { id: 'egypt_roof_watcher', role: ['观星祭司', 'Star-watching priest'], p: [48, 40, -140], yaw: Math.PI, coat: 0x24477a, trim: 0xdba93a,
    lines: [['从中庭东侧的阶梯能上屋顶。夜里在这里看星，白天守着祭坛的火。', 'The stair on the east of the court leads up here. By night we watch the stars; by day we tend the altar fire.']] },
  { id: 'egypt_tomb_mason', role: ['石匠 · 峡谷崖墓', 'Mason · canyon tombs'], p: [-86, 20.3, -110], yaw: .4, coat: 0xa9784a, trim: 0x6b4a2f,
    lines: [['崖墓的门楣是从山里直接凿出来的。往西上坡，峡谷会把你送上台地。', 'These lintels were cut straight from the cliff. Climb west and the canyon brings you onto the plateau.']] },
  { id: 'egypt_pyramid_guard', role: ['金字塔守卫', 'Pyramid guard'], p: [150, 36.5, -172], yaw: -.8, coat: 0xd8b77a, trim: 0xa8432f,
    lines: [['金字塔的封顶石是鎏金的，日出时整座塔都亮。从神殿西边的堤道过来最近。', 'The capstone is gilded; at dawn the whole pyramid shines. The causeway from the temple\'s west side is the shortest way.']] },
  { id: 'egypt_cliff_priestess', role: ['女祭司 · 崖壁祭庙', 'Priestess · Temple of the Cliff'], p: [189, 26, -60], yaw: Math.PI / 2, coat: 0xf2ead2, trim: 0x3fa2a0,
    lines: [['柱廊墙上画的是去香料之国的船队，回程带了没药树，就种在下面前庭的圆坑里。', 'The portico walls show the fleet that sailed to the land of incense; it brought myrrh trees home, planted in the round pits of the forecourt below.'], ['圣所是凿进日峰里的。日出时，光会顺着坡道一直照到里面的神像。', 'The sanctuary is cut into the peak. At sunrise the light runs up the ramps and reaches the god inside.']] },
  { id: 'egypt_lake_priest', role: ['净身祭司 · 圣湖', 'Priest of purification · sacred lake'], p: [133, 30, -108], yaw: Math.PI / 2, coat: 0xefe4c8, trim: 0x24477a,
    lines: [['进神殿之前先在圣湖里净身。绕圣甲虫走一圈，许的愿才算数。', 'Wash in the sacred lake before entering the temple. Walk once round the scarab and your wish is counted.']] },
  { id: 'egypt_village_foreman', role: ['工匠工头 · 工匠村', 'Foreman · workmen\'s village'], p: [-70, 16, 14], yaw: -Math.PI / 2, coat: 0xa9784a, trim: 0xd8a94a,
    lines: [['我们给法老修墓，自己的墓修在村外坡上，也是小金字塔。', 'We build the pharaoh\'s tombs; our own are on the slope outside the village, little pyramids too.'], ['顺着峡谷往上走，还没到崖墓，左手边有条石道上台地，通到采石场。', 'Walk up the canyon; before the rock tombs a stone road on your left climbs onto the plateau to the quarry.']] },
  { id: 'egypt_quarry_overseer', role: ['采石监工', 'Quarry overseer'], p: [-170, 28, -146], yaw: -2.4, coat: 0xd8b77a, trim: 0xa8432f,
    lines: [['那根方尖碑凿到一半就裂了，只好留在坑里。上面的线是我们量长度画的。', 'That obelisk cracked halfway through the cutting, so it stays in the pit. The lines on it are where we measured its length.'], ['黑石球是用来砸花岗岩的，砸一天也就下去指甲那么深。', 'The black balls are for pounding granite; a day\'s work takes it down a fingernail.']] },
  { id: 'egypt_camp_elder', role: ['商队老人 · 营地', 'Caravan elder · camp'], p: [-208, 15, 22], yaw: 2.8, coat: 0x6b4a2f, trim: 0xece2c6,
    lines: [['往西穿过整片沙海，有一双没身子的巨腿立在石座上。座上的字说，看看我的功业吧——现在只剩沙子。', 'Cross the whole sand sea to the west: two vast legs without a body stand on a pedestal. Its words say look upon my works; now there is only sand.']] },
  { id: 'egypt_courier', role: ['商队骆驼夫', 'Camel driver'], p: [-158, 14, 111.5], yaw: 1.3, coat: 0xc49a64, trim: 0xa8432f, carry: 'sack',
    lines: [['从码头回来，骆驼还要喝水。', 'Back from the quay; the camels still need water.']] },
];

export function egyptResidentSockets(): PlacedNpcSocket[] {
  return EGYPT_RESIDENTS.map(s => ({ id: s.id, role: [...s.role], position: world(s.p), yaw: worldYaw(s.yaw), region: 'britain', worldRegion: 'egypt', appearance: { coat: s.coat, trim: s.trim, accent: 0xbba05e, ...(s.carry ? { carry: s.carry } : {}) }, lines: s.lines.map(l => [...l]) }));
}

type ResidentHost = { group: THREE.Group; getPosition(id: string): [number, number, number] | null; pose(id: string, p: [number, number, number], yaw: number): boolean };
/** Residents settle on real collision; the camel driver walks the bank between town and quay. */
export function createEgyptResidentLife(host: ResidentHost, ground: (x: number, z: number, ceiling: number) => number | null) {
  const patrols = [{ id: 'egypt_courier', speed: 1.1, path: [[-158, 14, 111.5], [-130, 13.2, 117.6], [-100, 12.3, 124], [-62, 11.1, 132.4]] as [number, number, number][] }];
  const walkers = patrols.map(p => { const root = host.group.getObjectByName(`Resident_${p.id}`)!; return { ...p, root, rig: residentWalkRig(root), index: 0, direction: 1, phase: 0, startY: root.position.y }; });
  for (const s of EGYPT_RESIDENTS) { const p = host.getPosition(s.id); if (!p) continue; const y = ground(p[0], p[2], p[1] + 2); if (y !== null && Math.abs(y - p[1]) < 3) host.pose(s.id, [p[0], y + .02, p[2]], worldYaw(s.yaw)); const root = host.group.getObjectByName(`Resident_${s.id}`); if (root) root.userData.region = 'egypt'; }
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
