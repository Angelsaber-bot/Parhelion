import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Marker } from '../core/types';
import type { Collider } from '../player/player';
import { egyptToWorld } from '../map/egyptPlan';
import { mergeParts } from '../settlements/merge';
import { createSettlementNpcs } from '../settlements/npcs';
import { SiteArt } from '../story/campaignSites';
import { EGYPT_GAUGE as G, EGYPT_GAUGE_KEEPER, EGYPT_GAUGE_STEPS, EGYPT_WATER_RECORD } from '../story/egyptGauge';

type Ground = (x: number, z: number, ceiling: number) => number | null;

export function createEgyptGaugeScene(ground: Ground, clear: (p: THREE.Vector3) => boolean) {
  const art = new SiteArt(), root = art.root;
  const stone = '#b69c70', darkStone = '#8b7555', salt = '#ddd5ae', seep = '#4a8c82', silt = '#74634b';
  function placement(lx: number, lz: number, y: number): [number, number, number] | null {
    const [x, z] = egyptToWorld(lx, lz);
    for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
      const floor = ground(x + dx, z + dz, y + 2);
      if (floor !== null && Math.abs(floor - y) <= 2 && clear(new THREE.Vector3(x + dx, floor + .05, z + dz))) return [x + dx, floor, z + dz];
    }
    return null;
  }
  const start = placement(-169, 119, 14), well = placement(-172, 134, 13), keeper = placement(-176, 131, 13);
  if (!start || !well || !keeper) return null;
  const [sx, sy, sz] = start, [wx, wy, wz] = well;
  art.box([sx, sy + .66, sz - .95], [3.3, 1.32, .38], stone, true);
  art.box([sx, sy + 1.29, sz - .95], [3.45, .12, .49], darkStone);
  art.box([sx, sy + .56, sz - .74], [2.5, .09, .035], seep);
  art.box([sx - .79, sy + .78, sz - .72], [.17, .47, .05], seep, false, 'body', [0, 0, -.23]);
  for (let i = 1; i < 6; i++) {
    const t = i / 6, x = THREE.MathUtils.lerp(sx, wx, t) + .8, z = THREE.MathUtils.lerp(sz, wz, t);
    const y = ground(x, z, THREE.MathUtils.lerp(sy, wy, t) + 2);
    if (y !== null) art.box([x, y + .035, z], [.44, .1, .69], i % 2 ? darkStone : seep, false, 'body', [0, .2 * i, 0]);
  }
  // The gauge has a walk-in front and retaining walls on the other three sides.
  const wallZ = wz - 1.48;
  for (const x of [wx - 1.51, wx + 1.51]) {
    art.box([x, wy + .48, wz - .54], [.31, .96, 2.1], stone, true);
    art.box([x, wy + .99, wz - .54], [.43, .12, 2.2], darkStone);
  }
  art.box([wx, wy + .75, wallZ], [3, 1.5, .32], stone, true);
  art.box([wx, wy + 1.53, wallZ], [3.32, .16, .44], darkStone);
  art.box([wx, wy + .28, wallZ + .18], [1.07, .07, .04], silt);
  art.box([wx, wy + .73, wallZ + .18], [1.22, .075, .04], seep);
  art.box([wx, wy + 1.19, wallZ + .18], [1.35, .058, .04], salt);
  for (const x of [wx - .49, wx + .49]) art.box([x, wy + .74, wallZ + .25], [.068, 1.26, .09], '#645138');
  const geometry = mergeParts(art.solids);
  for (const solid of art.solids) solid.dispose();
  const collider: Collider = { name: 'COL_EgyptGaugeRetainingWalls', enabled: true, bvh: new MeshBVH(geometry) };
  art.finish('alpha');
  root.name = 'EgyptSecondWaterMark';

  const floatMaterial = new THREE.MeshStandardMaterial({ color: 0x447d72, metalness: .55, roughness: .4 });
  const pointer = new THREE.Group(); pointer.name = 'EgyptGaugePointer';
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.73, .09, .09), floatMaterial);
  const head = new THREE.Mesh(new THREE.ConeGeometry(.11, .21, 4).rotateZ(-Math.PI / 2), floatMaterial);
  head.position.x = .45; pointer.add(bar, head); root.add(pointer);
  pointer.position.set(wx, wy + .28, wallZ + .3);
  const people = createSettlementNpcs([{ id: 'egypt_gauge_keeper_pahek', role: EGYPT_GAUGE_KEEPER, region: 'alpha', worldRegion: 'egypt',
    position: keeper, yaw: Math.PI / 4, appearance: { coat: 0xd8c297, trim: 0x387c72, accent: 0xb58f4d },
    lines: [['昨晚的浪还没到，我已经听见井里响了。', 'I heard the well ring before the wave arrived last night.']] }]);
  root.add(people.group);
  const markers: Marker[] = EGYPT_GAUGE_STEPS.map((step, i) => {
    const [x, y, z] = [start, well, keeper][i];
    return { id: step.id, label: step.label[0], type: 'interact', p: [x, y + .86, z], radius: 2.1 };
  });

  let seeded = false;
  return {
    root, collider, markers,
    gesture() { people.gesture('egypt_gauge_keeper_pahek'); },
    apply(done: ReadonlySet<string>, dt: number, player: THREE.Vector3, speaking: boolean) {
      root.visible = player.distanceToSquared(pointer.position) < 140 ** 2;
      people.group.visible = done.has(EGYPT_WATER_RECORD);
      people.setSpeaking(speaking ? 'egypt_gauge_keeper_pahek' : null);
      if (root.visible) people.update(dt, player);
      const y = wy + (done.has(G.align) ? .73 : .28);
      pointer.position.y = seeded ? THREE.MathUtils.damp(pointer.position.y, y, 4, dt) : y;
      seeded = true;
    },
    dispose() {
      people.dispose();
      bar.geometry.dispose(); head.geometry.dispose(); floatMaterial.dispose();
      geometry.dispose();
      root.remove(pointer, people.group);
      root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      for (const material of Object.values(art.materials)) material.dispose();
      root.removeFromParent();
    },
  };
}
