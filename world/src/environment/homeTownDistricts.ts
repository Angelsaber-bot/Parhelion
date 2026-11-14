import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { HOME_BUILDINGS, HOME_ROUTES } from '../map/homePlan';
import type { RegionId } from '../settlements/types';

type V3 = [number, number, number];
/** 归灯镇 districts from the Valley/Town design that the town did not have yet, with real collision:
 * T03 workshop and test range, T04 broadcast and archive, T05 lower-levee cargo shed and water wheel,
 * T07 rooftop walk (stair, laundry deck, two reliable jumps, stargazing post, backup signal line),
 * T08 old outstation and the south public slope; plus street lamps and rooftop water tanks, the town's
 * unifying materials (old concrete, metal roofs, timber patches). Lots were checked flat and clear. */
export function createHomeTownDistricts(ground: (x: number, z: number) => number, roofTop: (x: number, z: number) => number | null) {
  const root = new THREE.Group(); root.name = 'HomewardTownDistricts';
  const colliders: Collider[] = [];
  const concrete = '#a7a39a', concreteDark = '#7d7a72', metal = '#6f7c80', rust = '#8a5a3e', timber = '#8d7150', darkTimber = '#5b4632', canvas = '#d6c9a8', glass = '#9fc6cf', warm = '#ffd98a';
  const W = (x: number, z: number) => x + 720; // local → world x (home offset)
  function finish(a: SiteArt, name: string) {
    a.finish('home' as RegionId); a.root.name = name; root.add(a.root);
    if (!a.solids.length) return;
    const geometry = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    colliders.push({ name: `COL_${name}`, enabled: true, bvh: new MeshBVH(geometry) });
  }
  /** A walled room with real door gaps on the given sides; roof is visual so ground queries skip it. */
  function room(a: SiteArt, cx: number, cz: number, w: number, d: number, h: number, wall: string, doors: Partial<Record<'n' | 's' | 'e' | 'w', number>>) {
    const y = ground(W(cx, cz), cz);
    const side = (x0: number, z0: number, x1: number, z1: number, gap?: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), along = x1 !== x0;
      const seg = (a0: number, a1: number) => { if (a1 - a0 < .05) return; const m = (a0 + a1) / 2; a.box(along ? [W(x0 + m, z0), y + h / 2, z0] : [W(x0, z0), y + h / 2, z0 + m], along ? [a1 - a0, h, .22] : [.22, h, a1 - a0], wall, true); };
      if (gap === undefined) seg(0, len); else { seg(0, len / 2 + gap - .8); seg(len / 2 + gap + .8, len); a.box(along ? [W(x0 + len / 2 + gap, z0), y + h - .25, z0] : [W(x0, z0), y + h - .25, z0 + len / 2 + gap], along ? [1.8, .5, .3] : [.3, .5, 1.8], concreteDark); }
    };
    side(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, doors.n); side(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, doors.s);
    side(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, doors.w); side(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, doors.e);
    a.box([W(cx, cz), y + h + .12, cz], [w + .8, .24, d + .8], metal);
    return y;
  }

  // T03 工坊与试射院: open workshop shed, shared weapon bench, two short lanes, hoist test frame.
  { const a = new SiteArt(), y = ground(W(104, -95), -95);
    for (const [x, z] of [[100, -101], [108, -101], [100, -89], [108, -89]]) a.box([W(x, z), y + 1.8, z], [.3, 3.6, .3], darkTimber, true);
    a.box([W(104, -95), y + 3.75, -95], [10, .2, 14], metal);
    a.box([W(104, -97), y + .5, -97], [4.2, 1, 1.1], timber, true); a.box([W(104, -97), y + 1.04, -97], [4.4, .08, 1.3], concreteDark);
    a.box([W(102.6, -97), y + 1.2, -97], [1.1, .3, .25], metal); a.box([W(105.2, -97), y + 1.18, -97.2], [.7, .25, .5], rust);
    for (const lane of [112, 116.5]) { for (const z of [-102, -88]) a.box([W(lane, z), y + .2, z], [3.6, .4, .3], concrete, true);
      a.box([W(lane, -102.6), y + 1.4, -102.6], [1.6, 1.6, .15], canvas); a.box([W(lane, -102.5), y + 1.4, -102.5], [.5, .5, .05], rust); }
    for (const x of [120.5, 123.5]) a.beam([W(x, -92), y, -92], [W(122, -92), y + 4, -92], .18, darkTimber);
    a.box([W(122, -92), y + 2.3, -92], [.9, .9, .9], metal); a.beam([W(122, -92), y + 4, -92], [W(122, -92), y + 2.8, -92], .03, '#cfc6ad');
    finish(a, 'HomeWorkshopRange'); }

  // T04 广播与档案: a broadcast room with a door on the square side, record wall, map table, calibration rig.
  { const a = new SiteArt(), y = room(a, -195, 15, 12, 10, 3.2, concrete, { e: 0 });
    a.box([W(-200.7, 15), y + 1.6, 15], [.12, 2, 7], '#d8ccae'); for (let i = 0; i < 6; i++) a.box([W(-200.6, 12.5 + i), y + 1.4 + (i % 2) * .5, 12.5 + i], [.03, .5, .4], i % 2 ? '#e8dfc8' : '#c9a25a');
    a.box([W(-194, 17), y + .45, 17], [2.4, .9, 1.4], timber, true); a.box([W(-194, 17), y + .92, 17], [2.2, .03, 1.2], '#e8dfc8');
    a.box([W(-193, 11.5), y + .6, 11.5], [1.2, 1.2, .8], metal, true); a.cyl([W(-193, 11.5), y + 1.3, 11.9], .25, .06, glass, false, 'glow', [Math.PI / 2, 0, 0]);
    a.box([W(-197, 18), y + 6, 18], [.18, 12, .18], metal); for (const h of [8, 10, 11.5]) a.box([W(-197, 18), y + h, 18], [2.6 - h / 6, .08, .08], metal);
    a.box([W(-197, 18), y + 12.1, 18], [.3, .3, .3], '#ff6b5b', false, 'glow');
    finish(a, 'HomeBroadcastArchive'); }

  // T05 下堤货栈: open public cargo shed on the lower levee, loading ramp and a working water wheel.
  { const a = new SiteArt(), y = ground(W(225, 139), 139);
    for (const [x, z] of [[218, 134], [232, 134], [218, 144], [232, 144], [225, 134], [225, 144]]) a.box([W(x, z), y + 2, z], [.3, 4, .3], darkTimber, true);
    a.box([W(225, 139), y + 4.1, 139], [16, .2, 12], rust, false, 'body', [.06, 0, 0]);
    for (const [x, z, s] of [[220, 137, 1.1], [221.4, 137, .9], [228, 141, 1.2], [229.5, 141.5, .8]] as const) a.box([W(x, z), y + s / 2, z], [s, s, s], timber, true);
    a.box([W(225, 146.5), y + .3, 146.5], [4, .6, 2], concreteDark, true, 'body', [-.12, 0, 0]);
    const wheel: V3 = [W(235, 139), y + 2.4, 139];
    a.ring(wheel, 2.2, .14, darkTimber, 'body', [0, Math.PI / 2, 0]);
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; a.box([wheel[0], wheel[1] + Math.sin(t) * 1.6, wheel[2] + Math.cos(t) * 1.6], [.8, .14, .5], timber, false, 'body', [t, 0, 0]); }
    a.box([wheel[0] - 1.2, wheel[1], wheel[2]], [2.4, .2, .2], metal);
    finish(a, 'HomeLeveeCargo'); }

  // T07 屋顶步道: stair → laundry deck → two reliable 1.2 m jumps → stargazing post; backup signal line.
  { const a = new SiteArt(), base = ground(W(-102, 176), 176), deckY = base + 3.2;
    // 14 risers of ~0.24 m, measured from the ground at the stair foot, land flush on the first deck's top.
    { const n = 14, x0 = -100 - n * .45, foot = ground(W(x0, 176), 176), bottom = Math.min(foot, base) - .2;
      for (let i = 0; i < n; i++) { const top = foot + (i + 1) * (deckY - foot) / n; a.box([W(x0 + .225 + i * .45, 176), (bottom + top) / 2, 176], [.45, top - bottom, 1.4], concrete, true); } }
    const deck = (x0: number, x1: number, rails = true) => { const cx = (x0 + x1) / 2, len = x1 - x0;
      a.box([W(cx, 176), deckY - .125, 176], [len, .25, 5], timber, true);
      for (const x of [x0 + .3, x1 - .3]) for (const z of [173.8, 178.2]) a.box([W(x, z), (deckY + base) / 2, z], [.25, deckY - base, .25], darkTimber, true);
      if (rails) a.box([W(cx, 173.5), deckY + .55, 173.5], [len, .08, .08], darkTimber, true); };
    deck(-100, -90); deck(-88.8, -82); deck(-80.8, -72);
    // The stargazing deck ends in a rail rather than a 3 m drop.
    for (const y of [.55, 1.05]) a.box([W(-72.15, 176), deckY + y, 176], [.08, .08, 4.6], darkTimber, true);
    a.box([W(-72.15, 176), deckY + .55, 176], [.12, 1.1, .12], darkTimber, true);
    for (const x of [-98, -94]) a.beam([W(x, 174.2), deckY + 2, 174.2], [W(x + 4, 177.8), deckY + 2, 177.8], .015, '#e8e0cf');
    for (const [x, c] of [[-97, '#b0c8d8'], [-95.5, '#d8b0a0'], [-93.5, '#e0d8b8']] as const) a.box([W(x, 176), deckY + 1.55, 176], [.8, .9, .04], c);
    for (const x of [-98, -94]) a.box([W(x, 174.2), deckY + 1.1, 174.2], [.08, 2, .08], darkTimber);
    a.box([W(-76, 176), deckY + 1, 176], [.12, 1.6, .12], metal); a.cyl([W(-76, 176.4), deckY + 1.85, 176.4], .14, 1.1, metal, false, 'metal', [Math.PI / 3, 0, 0]);
    a.box([W(-74, 177), deckY + .45, 177], [1.8, .12, .5], timber, true);
    a.box([W(-72.5, 174), deckY + 3, 174], [.12, 6, .12], metal); a.beam([W(-72.5, 174), deckY + 5.8, 174], [W(-104, 172), base + 6, 172], .02, '#2a2a2a');
    finish(a, 'HomeRooftopWalk'); }

  // T08 外站与南坡: the old outstation platform with a shelter and a sealed protocol box; south slope seating.
  { const a = new SiteArt(), y = ground(W(60, -235), -235);
    a.box([W(60, -235), y + .3, -235], [22, .6, 6], concrete, true);
    for (let i = 0; i < 3; i++) a.box([W(48.4 + i * .5, -235), y + .1 + i * .2, -235], [.5, .2 + i * .4, 3], concreteDark, true);
    for (const x of [54, 60, 66]) a.box([W(x, -237), y + 2, -237], [.25, 3.4, .25], metal, true);
    a.box([W(60, -236), y + 3.75, -236], [16, .15, 3.6], metal, false, 'body', [-.08, 0, 0]);
    a.box([W(56, -233), y + 1.6, -233], [2, 1.2, .1], timber); a.box([W(56, -232.94), y + 1.65, -232.94], [1.8, 1, .02], '#e8dfc8');
    a.box([W(64, -233.5), y + 1.05, -233.5], [.9, .9, .6], rust, true); a.box([W(64, -233.18), y + 1.05, -233.18], [.5, .1, .02], '#c0452f');
    a.box([W(60, -236.8), y + 1.05, -236.8], [3, .14, .5], timber, true);
    finish(a, 'HomeOutstation');
    const s = new SiteArt(), sy = ground(W(-63, 193), 193);
    for (let i = 0; i < 3; i++) s.box([W(-63, 190 + i * 2.2), sy + .2 + i * .25, 190 + i * 2.2], [14, .4, 1.4], concrete, true);
    for (const x of [-68, -58]) s.box([W(x, 196), sy + .45, 196], [3, .12, .5], timber, true);
    finish(s, 'HomeSouthSlope'); }

  // T10 公馆餐厅陈设: the shared dining hall at the lodge's south end had bare 5 m walls. Wainscoting,
  // framed pictures, warm sconces, lamps over both tables, rugs and corner plants (visual only).
  { const a = new SiteArt(), fy = 16.12, L = (x: number, z: number) => W(-35 + x, -40 + z), at = (x: number, y: number, z: number): V3 => [L(x, z), fy + y, -40 + z];
    const wood = '#8d6a4a', rail = '#5e4430', frameGold = '#b08a4a';
    for (const side of [-1, 1]) {
      const x = side * 18.84; a.box(at(x, .55, 16.5), [.06, 1.1, 16.6], wood); a.box(at(x - side * .03, 1.14, 16.5), [.1, .08, 16.6], rail);
      // Two small landscapes per wall: sky, a far hill line, the near field and a sun (or moon).
      for (const [z, sky, hill, field, orb] of [[18.5, '#9cc3dc', '#6f8f86', '#9aa86a', '#fff1c4'], [22.2, '#d9a184', '#7d6a8a', '#8a6f4f', '#ffe08a']] as const) {
        const d = (k: number) => x - side * (.05 + k * .006);
        a.box(at(x - side * .02, 2.75, z), [.06, 1.3, 1.7], frameGold);
        a.box(at(d(0), 2.86, z), [.03, .86, 1.48], sky); a.box(at(d(1), 2.5, z + .2), [.03, .3, 1.1], hill); a.box(at(d(2), 2.34, z), [.03, .3, 1.48], field);
        a.box(at(d(3), 3.0, z - .4), [.03, .18, .18], orb);
      }
      for (const z of [10, 16, 24]) { a.box(at(x - side * .1, 2.2, z), [.18, .28, .18], rail); a.box(at(x - side * .16, 2.42, z), [.2, .22, .2], '#ffd28a', false, 'glow'); }
    }
    for (const [x0, x1] of [[-18.6, -2.4], [2.4, 18.6]]) { const cx = (x0 + x1) / 2, len = x1 - x0; a.box(at(cx, .55, 24.84), [len, 1.1, .06], wood); a.box(at(cx, 1.14, 24.81), [len, .08, .1], rail); }
    for (const x of [-12, 11]) {
      a.box(at(x, .125, 19), [6.2, .01, 4.2], x < 0 ? '#7a3f3a' : '#3f5a7a'); a.box(at(x, .132, 19), [5.6, .01, 3.6], x < 0 ? '#c99b6a' : '#b7c3cf');
      a.box(at(x, 4.35, 19), [.03, 1.1, .03], rail); a.cyl(at(x, 3.7, 19), .42, .32, rail); a.cyl(at(x, 3.48, 19), .3, .14, '#ffe0a3', false, 'glow');
    }
    for (const [x, z] of [[-17.9, 23.9], [17.9, 23.9], [-17.9, 9]]) { a.cyl(at(x, .35, z), .38, .7, '#a7643e'); a.cyl(at(x, 1.05, z), .55, .8, '#5f8a52'); a.cyl(at(x, 1.6, z), .35, .5, '#6f9d5d'); }
    finish(a, 'HomeLodgeDiningDressing'); }

  // Street lamps beside every town route (offset off the walking width) and rooftop water tanks.
  { const lamps = new SiteArt();
    for (const r of HOME_ROUTES) { const half = (r.kind === 'main' ? 7 : 5) / 2 + 1.3;
      for (let i = 1; i < r.points.length; i++) { const p0 = r.points[i - 1], p1 = r.points[i], len = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
        for (let t = 11; t < len; t += 22) { const k = t / len, x = p0[0] + (p1[0] - p0[0]) * k, z = p0[2] + (p1[2] - p0[2]) * k, nx = -(p1[2] - p0[2]) / len, nz = (p1[0] - p0[0]) / len;
          const lx = x + nx * half, lz = z + nz * half, wy = ground(W(lx, lz), lz);
          lamps.box([W(lx, lz), wy + 2.1, lz], [.14, 4.2, .14], metal); lamps.box([W(lx, lz), wy + 4.25, lz], [.5, .14, .5], metal); lamps.box([W(lx, lz), wy + 4.05, lz], [.3, .3, .3], warm, false, 'glow'); } } }
    for (const b of HOME_BUILDINGS) { if (b.kind === 'lodge') continue;
      const ox = b.p[0] - Math.sin(b.yaw) * b.d * .2, oz = b.p[2] - Math.cos(b.yaw) * b.d * .2, top = roofTop(W(ox, oz), oz); if (top === null) continue;
      lamps.cyl([W(ox, oz), top + .9, oz], .7, 1.2, b.kind === 'home' ? '#8a8578' : metal); lamps.box([W(ox, oz), top + .15, oz], [1.6, .3, 1.6], darkTimber); }
    finish(lamps, 'HomeStreetLampsAndTanks'); }

  return { root, colliders, update(viewer: THREE.Vector3) { root.visible = Math.abs(viewer.x - 760) < 360 && Math.abs(viewer.z) < 340; },
    dispose() { colliders.forEach(c => c.enabled = false); root.removeFromParent(); } };
}
