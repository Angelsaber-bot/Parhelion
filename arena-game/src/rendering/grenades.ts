/** Grenade presentation: in-flight models with a fuse light, a ground warning ring for
 * frags about to go off, volumetric-looking smoke clouds, and the blast itself. Pure
 * cosmetics driven by authoritative snapshots; nothing here changes damage or timing. */
import * as THREE from 'three';
import { FRAG, GRENADE, SMOKE, TICK_HZ } from '../../shared/content.ts';
import type { Grenade, Smoke } from '../../shared/grenade.ts';
import { smokeCentre } from '../../shared/grenade.ts';

function softTexture(inner: string, outer: string) {
  const size = 64, canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas?.getContext) return new THREE.Texture();
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c?.createRadialGradient) return new THREE.Texture();
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(.55, outer); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function fragModel() {
  const g = new THREE.Group(); g.name = 'Frag grenade';
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(GRENADE.radius, 1), new THREE.MeshStandardMaterial({ color: 0x3f5a3c, roughness: .55, metalness: .35, flatShading: true }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, .05, 10), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: .9, roughness: .3 }));
  cap.position.y = GRENADE.radius + .01;
  const lever = new THREE.Mesh(new THREE.BoxGeometry(.018, .11, .022), cap.material); lever.position.set(.045, .03, 0); lever.rotation.z = -.35;
  const light = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true }));
  light.position.y = GRENADE.radius + .045; light.name = 'fuse';
  g.add(body, cap, lever, light); return g;
}
function smokeModel() {
  const g = new THREE.Group(); g.name = 'Smoke grenade';
  const can = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .2, 14), new THREE.MeshStandardMaterial({ color: 0x8c98a6, roughness: .45, metalness: .5 }));
  can.rotation.z = Math.PI / 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.062, .062, .05, 14), new THREE.MeshBasicMaterial({ color: 0x7fd7ff }));
  band.rotation.z = Math.PI / 2;
  const light = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7fd7ff, transparent: true }));
  light.position.x = .11; light.name = 'fuse';
  g.add(can, band, light); return g;
}

type Cloud = { group: THREE.Group; puffs: { sprite: THREE.Sprite; base: THREE.Vector3; phase: number; size: number }[]; seen: number };
type Blast = { flash: THREE.Sprite; ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; puffs: THREE.Sprite[]; life: number };
const PUFFS = 30, BLAST_LIFE = 1.1;

export class GrenadeView {
  private live = new Map<number, { model: THREE.Group; warn: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; kind: Grenade['kind'] }>();
  private clouds = new Map<number, Cloud>();
  private blasts: Blast[] = [];
  private smokeTex = softTexture('rgba(235,240,245,1)', 'rgba(200,208,218,.7)');
  private fireTex = softTexture('rgba(255,250,220,1)', 'rgba(255,150,60,.8)');
  private time = 0;
  constructor(private parent: THREE.Object3D) {}

  /** `since` = seconds elapsed after the snapshot these states came from (for smooth flight). */
  sync(grenades: readonly Grenade[], smokes: readonly Smoke[], since: number) {
    const t = Math.max(0, Math.min(.12, since)), seen = new Set<number>();
    for (const g of grenades) {
      seen.add(g.id);
      let v = this.live.get(g.id);
      if (!v) {
        const model = g.kind === 'frag' ? fragModel() : smokeModel();
        const warn = new THREE.Mesh(new THREE.RingGeometry(FRAG.radius - .14, FRAG.radius, 64), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        warn.rotation.x = -Math.PI / 2; warn.name = 'Frag warning ring'; warn.raycast = () => {};
        // A faint fill makes the whole danger area readable, not just its edge.
        const fill = new THREE.Mesh(new THREE.CircleGeometry(FRAG.radius - .14, 48), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: .07, depthWrite: false, side: THREE.DoubleSide }));
        fill.raycast = () => {}; warn.add(fill);
        v = { model, warn, kind: g.kind }; this.live.set(g.id, v); this.parent.add(model); if (g.kind === 'frag') this.parent.add(warn);
      }
      const x = g.x + (g.rest ? 0 : g.vx * t), y = g.y + (g.rest ? 0 : g.vy * t - .5 * GRENADE.gravity * t * t), z = g.z + (g.rest ? 0 : g.vz * t);
      v.model.position.set(x, y, z);
      if (!g.rest) { v.model.rotation.x += Math.hypot(g.vx, g.vz) * .02; v.model.rotation.z += .15; }
      const left = Math.max(0, g.fuse / TICK_HZ - t), fuse = v.model.getObjectByName('fuse') as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
      // The fuse light blinks faster as the frag runs down.
      if (fuse) fuse.material.opacity = g.kind === 'frag' ? (Math.sin(this.time * (8 + 30 * (1 - left / (FRAG.fuse / TICK_HZ)))) > 0 ? 1 : .15) : .9;
      if (g.kind === 'frag') {
        const urgent = left < 1.2 || g.rest;
        v.warn.visible = urgent; v.warn.position.set(x, y - GRENADE.radius + .03, z);
        v.warn.material.opacity = urgent ? .25 + .3 * Math.abs(Math.sin(this.time * 10)) : 0;
      }
    }
    for (const [id, v] of this.live) if (!seen.has(id)) { this.drop(v.model); this.drop(v.warn); this.live.delete(id); }
    const clouds = new Set<number>();
    for (const s of smokes) {
      clouds.add(s.id);
      let c = this.clouds.get(s.id);
      if (!c) c = this.makeCloud(s);
      const age = (SMOKE.life - s.life) / TICK_HZ, fadeIn = Math.min(1, age / .7), fadeOut = Math.min(1, s.life / (1.5 * TICK_HZ)), k = fadeIn * fadeOut;
      for (const p of c.puffs) {
        p.sprite.position.copy(p.base).multiplyScalar(.45 + .55 * fadeIn).add(new THREE.Vector3(...smokeCentre(s)));
        p.sprite.position.y += Math.sin(this.time * .4 + p.phase) * .12 + age * .02;
        const size = p.size * (.6 + .4 * fadeIn); p.sprite.scale.set(size, size, 1);
        p.sprite.material.opacity = .78 * k; p.sprite.material.rotation = p.phase + this.time * .05;
      }
    }
    for (const [id, c] of this.clouds) if (!clouds.has(id)) { for (const p of c.puffs) { p.sprite.material.dispose(); } this.drop(c.group, false); this.clouds.delete(id); }
  }
  private makeCloud(s: Smoke): Cloud {
    const group = new THREE.Group(); group.name = 'Smoke cloud';
    const puffs: Cloud['puffs'] = [];
    for (let i = 0; i < PUFFS; i++) {
      // Golden-spiral sphere points, flattened at the bottom like a settled cloud.
      const z = 1 - (i + .5) / PUFFS * 2, r = Math.sqrt(1 - z * z), a = i * 2.399963;
      const base = new THREE.Vector3(Math.cos(a) * r, z * .75, Math.sin(a) * r).multiplyScalar(SMOKE.radius * (.55 + .35 * ((i * .618) % 1)));
      // Low puffs sit higher and smaller, so no billboard is cut flat by the floor.
      if (base.y < -.35) base.y = -.35 + base.y * .08;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xc9d1db, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.raycast = () => {}; sprite.renderOrder = 4;
      group.add(sprite); puffs.push({ sprite, base, phase: i * 1.7, size: (2.6 + 1.4 * ((i * .37) % 1)) * (base.y < 0 ? .72 : 1) });
    }
    const c = { group, puffs, seen: 0 }; this.clouds.set(s.id, c); this.parent.add(group); return c;
  }

  /** Frag detonation: a white-hot flash, a shockwave the size of the damage radius, rising smoke. */
  blast(at: readonly [number, number, number]) {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fireTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    flash.position.set(at[0], at[1] + 1.1, at[2]); flash.raycast = () => {}; flash.renderOrder = 5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(at[0], at[1] + .05, at[2]); ring.raycast = () => {};
    const puffs = Array.from({ length: 8 }, (_, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: 0x6d6a66, transparent: true, depthWrite: false }));
      const a = i / 8 * Math.PI * 2; s.position.set(at[0] + Math.cos(a) * .5, at[1] + .4, at[2] + Math.sin(a) * .5); s.raycast = () => {}; return s;
    });
    this.parent.add(flash, ring, ...puffs); this.blasts.push({ flash, ring, puffs, life: BLAST_LIFE });
  }

  update(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) return;
    this.time += dt;
    for (const b of this.blasts) {
      b.life -= dt; const t = BLAST_LIFE - b.life;
      const f = Math.max(0, 1 - t / .22); b.flash.scale.setScalar(2 + 5 * Math.min(1, t / .08)); b.flash.material.opacity = Math.min(1, f * 1.4);
      const w = Math.min(1, t / .35); b.ring.scale.setScalar(.3 + w * FRAG.radius); b.ring.material.opacity = (1 - w) * .8;
      for (const [i, p] of b.puffs.entries()) { p.position.y += dt * (.8 + i * .05); const s = 1 + t * 3.2; p.scale.set(s, s, 1); p.material.opacity = Math.max(0, .7 * (1 - t / BLAST_LIFE)); }
    }
    for (const b of this.blasts.filter(b => b.life <= 0)) { for (const o of [b.flash, b.ring, ...b.puffs]) this.drop(o); }
    this.blasts = this.blasts.filter(b => b.life > 0);
  }
  clear() {
    for (const v of this.live.values()) { this.drop(v.model); this.drop(v.warn); } this.live.clear();
    for (const c of this.clouds.values()) { for (const p of c.puffs) p.sprite.material.dispose(); this.drop(c.group, false); } this.clouds.clear();
    for (const b of this.blasts) for (const o of [b.flash, b.ring, ...b.puffs]) this.drop(o); this.blasts = [];
  }
  dispose() { this.clear(); this.smokeTex.dispose(); this.fireTex.dispose(); }
  get counts() { return { grenades: this.live.size, clouds: this.clouds.size, blasts: this.blasts.length }; }
  private drop(o: THREE.Object3D, deep = true) {
    o.removeFromParent();
    if (deep) o.traverse((n) => { const m = n as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (mat) for (const x of Array.isArray(mat) ? mat : [mat]) x.dispose(); });
  }
}
