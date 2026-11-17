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

/** An irregular, cloudy puff (white, tinted per sprite): overlapping soft blobs instead of one perfect disc,
 * so a crowd of puffs reads as billowing smoke and not as a stack of round stickers. */
export function puffTexture(seed: number, core = 1) {
  const size = 128, canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas?.getContext) return new THREE.Texture();
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c?.createRadialGradient) return new THREE.Texture();
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * size * .2, r = size * (.16 + rnd() * .2);
    const x = size / 2 + Math.cos(a) * d, y = size / 2 + Math.sin(a) * d;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${(.22 + rnd() * .2) * core})`); g.addColorStop(.6, `rgba(255,255,255,${.08 * core})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, size, size);
  }
  // Fade the square's corners and edge completely so no sprite outline ever shows.
  c.globalCompositeOperation = 'destination-in';
  const mask = c.createRadialGradient(size / 2, size / 2, size * .2, size / 2, size / 2, size / 2);
  mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = mask; c.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function fragModel() {
  const g = new THREE.Group(); g.name = 'Frag grenade';
  const olive = new THREE.MeshStandardMaterial({ color: 0x4b5638, roughness: .62, metalness: .18 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: .38, metalness: .85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2f3328, roughness: .7, metalness: .3 });
  // Slightly egg-shaped steel body with a moulded seam and a stencilled band.
  const body = new THREE.Mesh(new THREE.SphereGeometry(GRENADE.radius, 20, 14), olive); body.scale.set(1, 1.12, 1);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(GRENADE.radius * 1.002, .004, 6, 28), dark); seam.rotation.x = Math.PI / 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(GRENADE.radius * .985, GRENADE.radius * .985, .012, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xc8a43a, roughness: .7, side: THREE.DoubleSide }));
  band.position.y = GRENADE.radius * .42;
  // Fuse assembly on top: threaded collar, body and the striker that flipped when the spoon came away.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.026, .03, .02, 12), steel); collar.position.y = GRENADE.radius * 1.1;
  const fuseBody = new THREE.Mesh(new THREE.CylinderGeometry(.021, .024, .034, 12), steel); fuseBody.position.y = GRENADE.radius * 1.1 + .026;
  const striker = new THREE.Mesh(new THREE.BoxGeometry(.012, .03, .012), dark); striker.position.set(.018, GRENADE.radius * 1.1 + .046, 0); striker.rotation.z = -.9;
  // The burning delay element: a tiny ember, not a lamp.
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.007, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffa04a, transparent: true }));
  ember.position.y = GRENADE.radius * 1.1 + .046; ember.name = 'fuse';
  g.add(body, seam, band, collar, fuseBody, striker, ember); return g;
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
type Puff = { sprite: THREE.Sprite; v: THREE.Vector3; grow: number; fade: number; start: number; size: number; life: number; max: number };
type Chunk = { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; floor: number; life: number };
type Blast = { flash: THREE.Sprite; fire: Puff[]; smoke: Puff[]; dust: Puff[]; chunks: Chunk[]; scorch: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; life: number; t: number };
const PUFFS = 44, BLAST_LIFE = 5.5, SCORCH_LIFE = 9, TRAIL_EVERY = .045;
/** Deterministic jitter so replays and tests see the same blast. */
const jitter = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };

export class GrenadeView {
  private live = new Map<number, { model: THREE.Group; warn: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; kind: Grenade['kind'] }>();
  private clouds = new Map<number, Cloud>();
  private curtains = new Map<number, THREE.Mesh>();
  private blasts: Blast[] = [];
  private smokeTex = softTexture('rgba(235,240,245,1)', 'rgba(200,208,218,.7)');
  private fireTex = softTexture('rgba(255,250,220,1)', 'rgba(255,150,60,.8)');
  private flameTex = puffTexture(97, 1.9);
  private sootTex = puffTexture(41, 1.6);
  private dustTex = puffTexture(173, 1.2);
  private scorchTex = puffTexture(311, 2.6);
  private chunkGeo = new THREE.BoxGeometry(1, 1, 1);
  private chunkMat = new THREE.MeshStandardMaterial({ color: 0x3a362f, roughness: .9 });
  private trail: Puff[] = [];
  private trailClock = new Map<number, number>();
  private scorches: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; life: number }[] = [];
  private time = 0;
  constructor(private parent: THREE.Object3D, private volumeSmoke = false) {}

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
      if (fuse) fuse.material.opacity = g.kind === 'frag' ? .55 + .45 * Math.abs(Math.sin(this.time * (9 + 26 * (1 - left / (FRAG.fuse / TICK_HZ))))) : .9;
      // The delay element smokes: a thin grey thread behind the grenade (a puff every few centimetres of time).
      if (g.kind === 'frag') { const last = this.trailClock.get(g.id) ?? -Infinity; if (this.time - last >= TRAIL_EVERY) { this.trailClock.set(g.id, this.time); this.puff(this.trail, this.sootTex, 0xb9b4ad, [x, y + GRENADE.radius * 1.15, z], [0, .35, 0], .07, .55, .9, .35); } }
      if (g.kind === 'frag') {
        const urgent = left < 1.2 || g.rest;
        v.warn.visible = urgent; v.warn.position.set(x, y - GRENADE.radius + .03, z);
        v.warn.material.opacity = urgent ? .25 + .3 * Math.abs(Math.sin(this.time * 10)) : 0;
      }
    }
    for (const [id, v] of this.live) if (!seen.has(id)) { this.drop(v.model); this.drop(v.warn); this.live.delete(id); this.trailClock.delete(id); }
    const clouds = new Set<number>(), curtains=new Set<number>();
    for (const s of smokes) {
      // The gameplay camera uses continuous depth-clipped volumes. The standalone
      // loadout preview retains its lightweight billboards and curtain demonstration.
      if (this.volumeSmoke && (s.delay ?? 0) <= 0) continue;
      if(s.box){
        curtains.add(s.id);let curtain=this.curtains.get(s.id);
        if(!curtain){curtain=new THREE.Mesh(new THREE.BoxGeometry(s.box.width,s.box.height,s.box.depth),new THREE.ShaderMaterial({uniforms:{time:{value:0},warmup:{value:0}},vertexShader:'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;uniform float time;uniform float warmup;void main(){float n=sin(vP.x*8.+time)*sin(vP.y*7.-time*.7)+sin(vP.z*13.+vP.y*4.+time*.5);vec3 c=mix(vec3(.27,.33,.39),vec3(.57,.62,.65),.5+n*.12);gl_FragColor=vec4(c,warmup);}',transparent:true,depthWrite:false,side:THREE.DoubleSide}));curtain.name='Black sail smoke volume';this.parent.add(curtain);this.curtains.set(s.id,curtain);}
        curtain.position.set(s.x,s.y+s.box.height/2,s.z);curtain.rotation.y=s.box.yaw;
        const material=curtain.material as THREE.ShaderMaterial;material.uniforms.time.value=this.time;material.uniforms.warmup.value=(s.delay??0)>0?.15:1;
        continue;
      }
      clouds.add(s.id);
      let c = this.clouds.get(s.id);
      if (!c) c = this.makeCloud(s);
      const age = (SMOKE.life - s.life) / TICK_HZ, fadeIn = Math.min(1, age / .7), fadeOut = Math.min(1, s.life / (1.5 * TICK_HZ)), k = fadeIn * fadeOut;
      for (const p of c.puffs) {
        p.sprite.position.copy(p.base).multiplyScalar(.45 + .55 * fadeIn).add(new THREE.Vector3(...smokeCentre(s)));
        p.sprite.position.y += Math.sin(this.time * .4 + p.phase) * .12 + age * .02;
        const size = p.size * (.6 + .4 * fadeIn); p.sprite.scale.set(size, size, 1);
        p.sprite.material.opacity = .93 * k; p.sprite.material.rotation = p.phase + this.time * .05;
      }
    }
    for(const [id,c] of this.curtains)if(!curtains.has(id)){this.drop(c);this.curtains.delete(id);}
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
      group.add(sprite); puffs.push({ sprite, base, phase: i * 1.7, size: (3.3 + 1.8 * ((i * .37) % 1)) * (base.y < 0 ? .72 : 1) });
    }
    const c = { group, puffs, seen: 0 }; this.clouds.set(s.id, c); this.parent.add(group); return c;
  }

  private puff(list: Puff[], map: THREE.Texture, color: number, at: readonly number[], v: readonly number[], size: number, grow: number, life: number, opacity: number, additive = false) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, rotation: jitter(list.length + at[0] * 7.1) * 6.28 }));
    sprite.position.set(at[0], at[1], at[2]); sprite.scale.setScalar(size); sprite.raycast = () => {}; sprite.renderOrder = additive ? 6 : 5;
    this.parent.add(sprite); const p = { sprite, v: new THREE.Vector3(v[0], v[1], v[2]), grow, fade: opacity, start: size, size, life, max: life }; list.push(p); return p;
  }

  /** Frag detonation: a short white flash (no dynamic light: adding one would recompile every lit material), a fireball that turns to soot, a column of dark smoke,
   * a ground-hugging dust ring, flying debris and a scorch mark that stays a while. Cosmetic only. */
  blast(at: readonly [number, number, number]) {
    const [x, y, z] = at, seed = Math.abs(x * 3.1 + z * 1.7);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fireTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    flash.position.set(x, y + 1, z); flash.raycast = () => {}; flash.renderOrder = 7;
    const fire: Puff[] = [], smoke: Puff[] = [], dust: Puff[] = [], chunks: Chunk[] = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + jitter(seed + i), r = .15 + jitter(seed + i * 3) * .35;
      this.puff(fire, this.flameTex, 0xffc078, [x + Math.cos(a) * r, y + .25 + jitter(seed - i) * .5, z + Math.sin(a) * r], [Math.cos(a) * 2.2, 1.2 + jitter(seed + i * 5) * 1.6, Math.sin(a) * 2.2], .8, 5.5, .32 + jitter(seed * i) * .12, 1, true); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + jitter(seed + i * 7), r = .2 + jitter(seed + i) * .6, up = i < 6 ? 2.4 + jitter(seed + i * 11) * 1.4 : .9 + jitter(seed + i * 13) * .9;
      this.puff(smoke, this.sootTex, i < 6 ? 0x5e5852 : 0x86807a, [x + Math.cos(a) * r, y + .5 + i * .06, z + Math.sin(a) * r], [Math.cos(a) * (1 + jitter(seed + i * 17)), up, Math.sin(a) * (1 + jitter(seed + i * 19))], 1.5, 2.4, 3.6 + jitter(seed + i * 23) * 1.8, .9); }
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + jitter(seed + i * 29) * .4;
      this.puff(dust, this.dustTex, 0xb8a687, [x + Math.cos(a) * .4, y + .25, z + Math.sin(a) * .4], [Math.cos(a) * (FRAG.radius * 1.9), .35, Math.sin(a) * (FRAG.radius * 1.9)], .7, 2.2, 1.6 + jitter(seed + i) * .6, .55); }
    for (let i = 0; i < 18; i++) { const a = jitter(seed + i * 31) * 6.283, s = 4 + jitter(seed + i * 37) * 9, up = 3 + jitter(seed + i * 41) * 7;
      const mesh = new THREE.Mesh(this.chunkGeo, this.chunkMat); const k = .03 + jitter(seed + i * 43) * .05; mesh.scale.set(k, k * (.6 + jitter(seed + i) * .8), k); mesh.position.set(x, y + .15, z); mesh.raycast = () => {}; this.parent.add(mesh);
      chunks.push({ mesh, v: new THREE.Vector3(Math.cos(a) * s, up, Math.sin(a) * s), spin: new THREE.Vector3(jitter(i) * 20, jitter(i + 1) * 20, jitter(i + 2) * 20), floor: y, life: 1.8 }); }
    const scorch = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: this.scorchTex, color: 0x15110d, transparent: true, depthWrite: false, opacity: .85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    scorch.rotation.x = -Math.PI / 2; scorch.rotation.z = jitter(seed) * 6.283; scorch.position.set(x, y + .02, z); scorch.raycast = () => {}; scorch.renderOrder = 1;
    this.parent.add(flash, scorch); this.scorches.push({ mesh: scorch, life: SCORCH_LIFE });
    this.blasts.push({ flash, fire, smoke, dust, chunks, scorch, life: BLAST_LIFE, t: 0 });
  }

  private agePuffs(list: Puff[], dt: number, drag: number, rise: number) {
    for (const p of list) {
      p.life -= dt; const k = 1 - Math.max(0, p.life) / p.max;
      p.v.multiplyScalar(Math.max(0, 1 - drag * dt)); p.v.y += rise * dt; p.sprite.position.addScaledVector(p.v, dt);
      p.size = p.start * (1 + p.grow * (1 - (1 - k) * (1 - k))); p.sprite.scale.setScalar(p.size);
      // Swell in quickly, thin away slowly.
      p.sprite.material.opacity = p.fade * Math.min(1, k / .08) * Math.pow(1 - k, 1.4);
    }
    for (const p of list) if (p.life <= 0) this.drop(p.sprite);
    return list.filter(p => p.life > 0);
  }

  update(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) return;
    this.time += dt;
    for (const b of this.blasts) {
      b.life -= dt; b.t += dt; const t = b.t;
      const f = Math.max(0, 1 - t / .09); b.flash.scale.setScalar(1 + 2.2 * Math.min(1, t / .03)); b.flash.material.opacity = f; b.flash.visible = f > 0;
      b.fire = this.agePuffs(b.fire, dt, 5, .8);
      // Fireball puffs darken into soot as they cool.
      for (const p of b.fire) p.sprite.material.color.setRGB(1, Math.max(.35, 1 - t * 2.2), Math.max(.2, 1 - t * 3.5));
      b.smoke = this.agePuffs(b.smoke, dt, 1.6, .35);
      b.dust = this.agePuffs(b.dust, dt, 3.4, -.15);
      for (const c of b.chunks) {
        c.life -= dt; c.v.y -= 22 * dt; c.mesh.position.addScaledVector(c.v, dt); c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt;
        if (c.mesh.position.y < c.floor + .03) { c.mesh.position.y = c.floor + .03; c.v.y *= -.25; c.v.x *= .5; c.v.z *= .5; c.spin.multiplyScalar(.5); }
        if (c.life <= 0) c.mesh.removeFromParent();
      }
      b.chunks = b.chunks.filter(c => c.life > 0);
    }
    for (const b of this.blasts.filter(b => b.life <= 0)) this.dropBlast(b);
    this.blasts = this.blasts.filter(b => b.life > 0);
    this.trail = this.agePuffs(this.trail, dt, 1.2, .25);
    for (const s of this.scorches) { s.life -= dt; s.mesh.material.opacity = .85 * Math.min(1, s.life / 3); }
    for (const s of this.scorches.filter(s => s.life <= 0)) this.drop(s.mesh);
    this.scorches = this.scorches.filter(s => s.life > 0);
  }
  private dropBlast(b: Blast) {
    this.drop(b.flash);
    for (const p of [...b.fire, ...b.smoke, ...b.dust]) this.drop(p.sprite);
    for (const c of b.chunks) c.mesh.removeFromParent();
  }
  clear() {
    for(const c of this.curtains.values())this.drop(c);this.curtains.clear();
    for (const v of this.live.values()) { this.drop(v.model); this.drop(v.warn); } this.live.clear();
    for (const c of this.clouds.values()) { for (const p of c.puffs) p.sprite.material.dispose(); this.drop(c.group, false); } this.clouds.clear();
    for (const b of this.blasts) this.dropBlast(b); this.blasts = [];
    for (const p of this.trail) this.drop(p.sprite); this.trail = []; this.trailClock.clear();
    for (const s of this.scorches) this.drop(s.mesh); this.scorches = [];
  }
  dispose() { this.clear(); for (const t of [this.smokeTex, this.fireTex, this.flameTex, this.sootTex, this.dustTex, this.scorchTex]) t.dispose(); this.chunkGeo.dispose(); this.chunkMat.dispose(); }
  get counts() { return { grenades: this.live.size, clouds: this.clouds.size, blasts: this.blasts.length }; }
  private drop(o: THREE.Object3D, deep = true) {
    o.removeFromParent();
    if (deep) o.traverse((n) => { const m = n as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (mat) for (const x of Array.isArray(mat) ? mat : [mat]) x.dispose(); });
  }
}
