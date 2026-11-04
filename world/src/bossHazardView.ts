/**
 * Ground telegraphs for era-boss arena hazards: a bright edge from the first frame, a fill that
 * thickens and pulses faster as the burst nears, then a short flash. Decals are draped over the
 * actual ground (one downward ray per vertex) so slopes and steps never swallow a warning.
 */
import * as THREE from 'three';
import { BOSS_HAZARDS, type Hazard } from './bossHazards';

type Point3 = { x: number; y: number; z: number };
interface Surface { cast(origin: Point3, direction: Point3, max: number): { point: Point3 } | null }
interface Telegraph { hazard: Hazard; root: THREE.Group; fill: THREE.MeshBasicMaterial; edge: THREE.MeshBasicMaterial; age: number; burst: number }

const DOWN = { x: 0, y: -1, z: 0 };
const LIFT = .07;

export class BossHazardView {
  private readonly live = new Map<number, Telegraph>();
  constructor(private readonly group: THREE.Group, private readonly surface: Surface) {}

  add(h: Hazard) {
    const color = new THREE.Color(BOSS_HAZARDS[h.boss]?.color ?? '#ff6a4a');
    const material = (opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const fill = material(.12), edge = material(.9);
    const root = new THREE.Group(); root.name = `BossHazard_${h.id}`; root.renderOrder = 3;
    const shapes: [THREE.BufferGeometry, THREE.MeshBasicMaterial][] = [];
    if (h.shape === 'circle') {
      shapes.push([new THREE.RingGeometry(.001, h.r, 40, 4), fill], [new THREE.RingGeometry(h.r - .16, h.r, 48, 1), edge]);
    } else if (h.shape === 'ring') {
      shapes.push([new THREE.RingGeometry(h.inner, h.r, 48, 4), fill], [new THREE.RingGeometry(h.r - .16, h.r, 56, 1), edge], [new THREE.RingGeometry(h.inner, h.inner + .16, 40, 1), edge]);
    } else {
      shapes.push([new THREE.PlaneGeometry(h.length, h.width, 30, 3), fill]);
      for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(h.length, .16, 40, 1); g.translate(0, s * (h.width / 2 - .08), 0); shapes.push([g, edge]); }
    }
    const angle = h.shape === 'strip' ? Math.atan2(-h.dir[1], h.dir[0]) : 0, cos = Math.cos(angle), sin = Math.sin(angle);
    for (const [geometry, mat] of shapes) {
      // flat in XZ around the hazard centre, then draped vertex by vertex
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i), lz = -pos.getY(i);
        const x = h.at.x + lx * cos + lz * sin, z = h.at.z - lx * sin + lz * cos;
        // follow steps and slopes, never climb onto eaves, lanterns or roofs
        const hit = this.surface.cast({ x, y: h.at.y + 1.4, z }, DOWN, 4), y = hit && hit.point.y < h.at.y + 1.2 ? hit.point.y : h.at.y;
        pos.setXYZ(i, x, y + LIFT, z);
      }
      pos.needsUpdate = true; geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, mat); mesh.renderOrder = 3; mesh.frustumCulled = false; root.add(mesh);
    }
    this.group.add(root);
    this.live.set(h.id, { hazard: h, root, fill, edge, age: 0, burst: -1 });
  }

  burst(id: number) { const t = this.live.get(id); if (t) t.burst = 0; }

  update(dt: number) {
    for (const [id, t] of this.live) {
      if (t.burst >= 0) {
        t.burst += dt;
        const k = Math.min(1, t.burst / .35);
        t.fill.opacity = .75 * (1 - k); t.edge.opacity = 1 - k;
        t.fill.color.lerp(WHITE, .25);
        if (k >= 1) this.remove(id);
        continue;
      }
      t.age += dt;
      const p = Math.min(1, t.age / t.hazard.delay), pulse = .5 + .5 * Math.sin(t.age * (6 + p * 18));
      t.fill.opacity = .1 + p * .32 + pulse * .06 * p;
      t.edge.opacity = .65 + pulse * .35;
    }
  }

  clear() { for (const id of [...this.live.keys()]) this.remove(id); }

  get count() { return this.live.size; }

  private remove(id: number) {
    const t = this.live.get(id); if (!t) return;
    this.live.delete(id); t.root.removeFromParent();
    t.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    t.fill.dispose(); t.edge.dispose();
  }
}
const WHITE = new THREE.Color('#ffffff');
