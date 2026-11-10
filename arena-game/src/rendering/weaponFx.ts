import * as THREE from 'three';
import type { ArenaMap, Vec3 } from '../../shared/map.ts';
import { flashTexture, markTexture } from './fxShapes.ts';
import { SWING_STYLES, TRACER_STYLES, type FlashShape, type MarkShape, type SwingStyle, type TracerStyle } from '../cosmetics/signatureFx.ts';

/** Weapon presentation that the plain spark pool cannot draw well: travelling tracer streaks,
 * star-shaped muzzle flashes, bullet holes with a dust puff, and melee swing arcs. Purely
 * cosmetic and pooled: nothing here allocates per frame or ever touches the simulation. */
export const WEAPON_FX_BUDGET = {
  high: { streaks: 48, flashes: 16, puffs: 48, decals: 48, arcs: 8 },
  low: { streaks: 24, flashes: 8, puffs: 24, decals: 24, arcs: 4 },
} as const;

/** Visual travel of a bullet. Real muzzle velocities would cross a room in one frame, so the
 * streak is slowed to stay readable for a few frames, never longer than ~0.14 s. */
export function streakTiming(distance: number, speed: number) {
  const travel = Math.min(.14, Math.max(.035, distance / speed));
  return { travel, fade: .06 };
}

/** Canvas textures, made once. A stubbed or missing canvas falls back to an empty texture. */
function canvasTexture(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  try {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); if (!g) return new THREE.Texture();
    paint(g, size); return new THREE.CanvasTexture(c);
  } catch { return new THREE.Texture(); }
}
let puffTex: THREE.Texture | null = null;
/** The stock star-shaped muzzle flash (finishes have their own shapes, see fxShapes). */
export const muzzleFlashTexture = () => flashTexture('star');
/** Soft, lumpy smoke/dust ball (normal blending, so it can darken as well as lighten). */
export function puffTexture() {
  return puffTex ??= canvasTexture(64, (g, s) => {
    const m = s / 2;
    for (const [x, y, r, a] of [[0, 0, .9, .5], [-.3, .15, .55, .35], [.32, -.1, .5, .35], [.05, -.35, .45, .3], [-.1, .35, .5, .3]] as const) {
      const grad = g.createRadialGradient(m + x * m * .5, m + y * m * .5, 0, m + x * m * .5, m + y * m * .5, r * m * .7);
      grad.addColorStop(0, `rgba(255,255,255,${a})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, s, s);
    }
  });
}
/** Stock bullet hole. */
export const bulletHoleTexture = () => markTexture('hole');

/** Surface normal at a ray's hit point on the map's boxes and ramps; -dir when unknown. */
export function surfaceNormal(map: ArenaMap, at: Vec3, dir: Vec3): Vec3 {
  const eps = .04;
  let best: Vec3 | null = null, bestD = Infinity;
  for (const s of map.solids) {
    if (at[0] < s.minX - eps || at[0] > s.maxX + eps || at[1] < s.minY - eps || at[1] > s.maxY + eps || at[2] < s.minZ - eps || at[2] > s.maxZ + eps) continue;
    if (s.ramp) {
      const h = s.maxY - s.minY, g = (h / 2) * s.lowAt / s.half, n: Vec3 = s.axisX ? [g, 1, 0] : [0, 1, g];
      const k = s.minY + h / 2 + g * s.centre, len = Math.hypot(...n), d = Math.abs((n[0] * at[0] + n[1] * at[1] + n[2] * at[2] - k) / len);
      if (d < bestD) { bestD = d; best = [n[0] / len, n[1] / len, n[2] / len]; }
    }
    const faces: [number, Vec3][] = [[Math.abs(at[0] - s.minX), [-1, 0, 0]], [Math.abs(at[0] - s.maxX), [1, 0, 0]], [Math.abs(at[1] - s.minY), [0, -1, 0]],
      [Math.abs(at[1] - s.maxY), [0, 1, 0]], [Math.abs(at[2] - s.minZ), [0, 0, -1]], [Math.abs(at[2] - s.maxZ), [0, 0, 1]]];
    for (const [d, n] of faces) if (d < bestD && n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] < 0) { bestD = d; best = n; }
  }
  if (best && bestD < eps * 2) return best;
  const len = Math.hypot(...dir) || 1; return [-dir[0] / len, -dir[1] / len, -dir[2] / len];
}

type Life = { life: number; max: number; order: number };
type Streak = Life & { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; from: THREE.Vector3; dir: THREE.Vector3; dist: number; travel: number; length: number; skip: number; base: number };
type Flash = Life & { sprite: THREE.Sprite; core: THREE.Sprite; size: number };
type Puff = Life & { sprite: THREE.Sprite; size: number; grow: number; rise: number; drift: THREE.Vector3; alpha: number };
type Decal = Life & { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> };
type Arc = Life & { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> };

const STREAK_VERT = `
uniform vec3 uTail; uniform vec3 uHead; uniform float uWidth; uniform float uStyle; uniform float uSeed; uniform float uTime;
varying vec2 vUv; varying float vM;
float h1(float n){ return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453); }
void main(){
  vec3 p = mix(uTail, uHead, position.y);
  vec3 axis = uHead - uTail; float len = length(axis); axis = len > 1e-5 ? axis / len : vec3(0., 0., -1.);
  vec3 toCam = cameraPosition - p; float dist = length(toCam);
  vec3 side = cross(axis, toCam / max(dist, 1e-4)); side = length(side) > 1e-4 ? normalize(side) : vec3(1., 0., 0.);
  // Never thinner than ~1.5 px, so a distant tracer does not shimmer away.
  float base = max(uWidth, dist * .0016);
  float widen = uStyle == 1. ? 2.4 : uStyle == 4. ? 2.1 : uStyle == 2. ? 1.7 : uStyle == 5. ? 1.4 : 1.;
  float shape = uStyle == 5. ? mix(.12, 1., pow(position.y, 1.5)) : uStyle == 4. ? mix(.6, 1., position.y) : mix(.3, 1., position.y);
  float m = position.y * len, disp = 0.;
  if (uStyle == 7.) disp = sin(m * 2.4 + uSeed * 6.28) * base * 2.4 * position.y;                       // wave
  if (uStyle == 3.) disp = (h1(floor(position.y * 24. + .5) + floor(uTime * 30.) * 7.) - .5) * base * 7.   // bolt
                       * step(.03, position.y) * step(position.y, .97);
  p += side * (position.x * base * widen * shape + disp);
  vUv = position.xy; vM = m;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`;
const STREAK_FRAG = `
uniform vec3 uColor; uniform vec3 uColor2; uniform float uOpacity; uniform float uStyle; uniform float uSeed;
varying vec2 vUv; varying float vM;
void main(){
  float x = vUv.x, y = vUv.y, across = 1. - abs(x);
  float body = across * across * smoothstep(0., .85, y);
  float core = smoothstep(.6, 1., across) * smoothstep(.3, 1., y);
  if (uStyle == 1.) {        // helix: two strands twisting round the line of fire
    float s = sin(vM * 4. + uSeed * 6.28) * .62, a = smoothstep(.24, 0., abs(x - s)), b = smoothstep(.24, 0., abs(x + s));
    body = max(a, b) * smoothstep(0., .5, y) + .2 * across * across * y; core = max(a, b) * .55 * y;
  } else if (uStyle == 2.) { // beads: a string of glowing drops
    float d = length(vec2((fract(vM * 1.4 - uSeed) - .5) * 1.6, x));
    body = smoothstep(.75, .35, d) * smoothstep(0., .4, y) + .12 * across * y; core = smoothstep(.4, .1, d) * y;
  } else if (uStyle == 3.) { // bolt: a hard white filament
    body = smoothstep(.1, .7, across) * smoothstep(0., .25, y); core = smoothstep(.5, .9, across);
  } else if (uStyle == 4.) { // ribbon: a wide soft band, colour running head to tail
    body = smoothstep(0., .9, across) * .72 * smoothstep(0., .5, y); core = smoothstep(.8, 1., across) * .45 * y;
  } else if (uStyle == 5.) { // comet: a round hot head and a long thinning tail
    body = across * across * pow(y, 2.); core = smoothstep(.45, 1., across) * smoothstep(.75, 1., y);
  } else if (uStyle == 6.) { // dash: separate slugs
    float on = step(.42, fract(vM * .9 - uSeed)); body *= on; core *= on;
  }
  vec3 col = mix(uColor2, uColor, smoothstep(0., 1., y));
  // Normal blending with a coloured body and a white-hot core: it reads on snow and white
  // concrete as well as in the dark, where additive light would wash out.
  gl_FragColor = vec4(mix(col, vec3(1.), core * .7), min(1., body * 1.25) * uOpacity);
}`;
/** Swing-ribbon styles, shared by remote arcs and your own viewmodel trail.
 *  u runs along the swing (0 oldest, 1 newest), v from the heel/inner edge (0) to the blade path (1). */
export const SWING_GLSL = `
float swingMask(float u, float v, float style, float t){
  if (style == 1.) { float d = length(vec2((fract(u * 9.) - .5) * 1.4, (v - .62) * 1.9)); return smoothstep(.62, .35, d); }       // petals
  if (style == 2.) { float n = sin(u * 37. + t * 14.) * .5 + sin(u * 71. - t * 23.) * .3 + sin(u * 13. + t * 7.) * .2;           // flame
                     return step(v, .7 + .24 * n) * (.55 + .45 * v); }
  if (style == 3.) { float tooth = abs(fract(u * 14.) * 2. - 1.); return step(v, .58 + .4 * tooth); }                              // frost
  if (style == 4.) { float zz = abs(fract(u * 18. + floor(t * 30.) * .37) * 2. - 1.) * .18;                                         // bolt
                     return smoothstep(.07, 0., abs(v - (.76 + zz))) * 1.4 + .12 * step(.5, v); }
  if (style == 5.) { float h = fract(sin(floor(v * 22.) * 91.7) * 43758.5); return mix(.2, 1., step(.35, h)) * smoothstep(0., .3, u * (1. + h)); } // ink
  if (style == 6.) { return step(v, .8 + .2 * step(.5, fract(u * 16.))); }                                                          // cog
  if (style == 7.) { return step(v, .76 + .2 * sin(u * 28. - t * 8.)); }                                                             // wave
  return 1. - smoothstep(.92, 1., v);                                                                                                 // crescent
}`;
const ARC_VERT = `
uniform float uSpan; uniform float uRadius; uniform float uReach; uniform float uLift;
varying vec2 vUv;
void main(){
  vUv = uv;
  // A curved slash hung in the air in front of the attacker, facing out along their swing, so
  // the player being swung at sees its full face. Its ends curl back toward the attacker.
  float a = (uv.x - .5) * uSpan, r = mix(.6, 1., uv.y) * uRadius;
  vec3 p = vec3(sin(a) * r, cos(a) * r - uRadius * uLift, -uReach + (1. - cos(a)) * uRadius * .45);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const ARC_FRAG = `
uniform vec3 uColor; uniform vec3 uColor2; uniform float uProgress; uniform float uOpacity; uniform float uStyle;
varying vec2 vUv;
${SWING_GLSL}
void main(){
  float lead = uProgress, trail = lead - .55;
  if (vUv.x > lead) discard;
  float along = smoothstep(trail, lead, vUv.x);
  float mask = swingMask(vUv.x, vUv.y, uStyle, uProgress);
  float hot = smoothstep(.75, .97, vUv.y) * along;
  vec3 col = mix(uColor2, uColor, smoothstep(.2, .9, vUv.y));
  gl_FragColor = vec4(mix(col, vec3(1.), hot * .5), min(1., along * smoothstep(0., 1., vUv.y) * mask * 1.3) * uOpacity * .88);
}`;
/** Trail length multipliers: comets and ribbons stream further behind the head. */
const STREAK_LENGTH: Record<TracerStyle, number> = { slug: 1, helix: 1.3, beads: 1.6, bolt: 1.6, ribbon: 1.4, comet: 2.2, dash: 1.8, wave: 1.3 };
export interface StreakLook { style?: TracerStyle; tail?: number }
export type SwingMode = 'slash' | 'chop' | 'thrust';

export class WeaponFx {
  private streaks: Streak[] = [];
  private flashes: Flash[] = [];
  private puffs: Puff[] = [];
  private decals: Decal[] = [];
  private arcs: Arc[] = [];
  private sequence = 0;
  private disposed = false;
  private streakGeo: THREE.BufferGeometry;
  private arcGeo: THREE.BufferGeometry;
  private decalGeo = new THREE.PlaneGeometry(1, 1);
  readonly budget: { readonly streaks: number; readonly flashes: number; readonly puffs: number; readonly decals: number; readonly arcs: number };
  constructor(private parent: THREE.Object3D, quality: 'high' | 'low' = 'high') {
    this.budget = WEAPON_FX_BUDGET[quality];
    this.streakGeo = new THREE.BufferGeometry();
    // 24 segments along the shot, so wave and bolt styles can bend it.
    const sp: number[] = [], si: number[] = [];
    for (let i = 0; i <= 24; i++) { sp.push(-1, i / 24, 0, 1, i / 24, 0); if (i) si.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2); }
    this.streakGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); this.streakGeo.setIndex(si);
    // A crescent ribbon: u along the sweep, v from inner radius to outer (the blade path).
    const seg = 24, pos: number[] = [], uv: number[] = [], index: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, a = (u - .5);
      for (const v of [0, 1]) { const r = .55 + .45 * v; pos.push(Math.sin(a) * r, 0, -Math.cos(a) * r); uv.push(u, v); }
      if (i) index.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, i * 2, i * 2 + 1, (i - 1) * 2 + 1);
    }
    this.arcGeo = new THREE.BufferGeometry();
    this.arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); this.arcGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); this.arcGeo.setIndex(index);
  }
  private acquire<T extends Life>(slots: T[], cap: number, create: () => T): T {
    let slot = slots.find((s) => s.life <= 0);
    if (!slot && slots.length < cap) { slot = create(); slots.push(slot); }
    if (!slot) slot = slots.reduce((a, b) => (b.order < a.order ? b : a));
    slot.order = ++this.sequence; return slot;
  }

  /** A glowing slug that flies from the muzzle to the hit, thick hot head and thin fading tail.
   *  `skip` keeps the first metres empty (your own shot while aiming down the sights). */
  streak(from: Vec3, to: Vec3, color: number, width = .022, speed = 420, opacity = 1, skip = 0, look: StreakLook = {}) {
    if (this.disposed || ![...from, ...to, width, speed, opacity].every(Number.isFinite)) return;
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), dist = dir.length();
    if (dist < .3) return; dir.divideScalar(dist);
    const slot = this.acquire(this.streaks, this.budget.streaks, () => {
      const material = new THREE.ShaderMaterial({
        uniforms: { uTail: { value: new THREE.Vector3() }, uHead: { value: new THREE.Vector3() }, uWidth: { value: .02 }, uColor: { value: new THREE.Color() }, uColor2: { value: new THREE.Color() }, uOpacity: { value: 1 }, uStyle: { value: 0 }, uSeed: { value: 0 }, uTime: { value: 0 } },
        vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.streakGeo, material); mesh.frustumCulled = false; mesh.name = 'Arena tracer streak'; mesh.renderOrder = 2;
      return { mesh, life: 0, max: 0, order: 0, from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, travel: 0, length: 0, skip: 0, base: 1 };
    });
    const { travel, fade } = streakTiming(dist, speed);
    slot.from.set(...from); slot.dir.copy(dir); slot.dist = dist; slot.travel = travel; slot.skip = Math.min(skip, dist * .5);
    const style = look.style ?? 'slug';
    slot.length = Math.min(dist * .6, Math.max(1.5, dist / travel * .018) * STREAK_LENGTH[style]);
    slot.life = slot.max = travel + fade;
    const u = slot.mesh.material.uniforms; u.uColor.value.setHex(color); u.uColor2.value.setHex(look.tail ?? color); u.uWidth.value = width; u.uOpacity.value = slot.base = opacity;
    u.uStyle.value = TRACER_STYLES.indexOf(style); u.uSeed.value = Math.random(); u.uTime.value = 0;
    this.placeStreak(slot); this.parent.add(slot.mesh);
  }
  private placeStreak(s: Streak) {
    const age = s.max - s.life, head = Math.min(s.dist, Math.max(s.skip, age / s.travel * s.dist)), tail = Math.max(s.skip, head - s.length);
    const u = s.mesh.material.uniforms;
    // After arrival the tail catches up with the head, so the streak shrinks into the impact.
    const tailAfter = age > s.travel ? Math.min(head, tail + (age - s.travel) / (s.max - s.travel) * s.length) : tail;
    u.uTail.value.copy(s.from).addScaledVector(s.dir, tailAfter); u.uHead.value.copy(s.from).addScaledVector(s.dir, head);
  }

  /** World-space muzzle flash (other players' guns): a star that pops and shrinks in two frames. */
  flash(at: Vec3, color: number, size = .32, shape: FlashShape = 'star', life = .055) {
    if (this.disposed || !at.every(Number.isFinite)) return;
    const slot = this.acquire(this.flashes, this.budget.flashes, () => {
      // A coloured star (normal blending, visible on bright walls) around an additive white-hot core.
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleFlashTexture(), depthWrite: false, transparent: true }));
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleFlashTexture(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      core.scale.setScalar(.45); sprite.add(core);
      sprite.name = 'Arena muzzle flash'; return { sprite, core, life: 0, max: 0, order: 0, size: 0 };
    });
    slot.sprite.position.set(...at); slot.sprite.material.color.setHex(color); slot.sprite.material.rotation = Math.random() * Math.PI;
    slot.size = size * (.85 + Math.random() * .3); slot.sprite.scale.setScalar(slot.size); slot.sprite.material.opacity = 1; slot.core.material.opacity = 1; slot.core.material.rotation = -slot.sprite.material.rotation;
    const map = flashTexture(shape); slot.sprite.material.map = map; slot.core.material.map = map;
    slot.life = slot.max = life; this.parent.add(slot.sprite);
  }

  /** Smoke or dust: normal-blended, grows, rises and thins out. */
  puff(at: Vec3, color: number, size: number, life: number, alpha = .5, drift: Vec3 = [0, 0, 0], rise = .4) {
    if (this.disposed || !at.every(Number.isFinite) || !(life > 0)) return;
    const slot = this.acquire(this.puffs, this.budget.puffs, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), depthWrite: false, transparent: true }));
      sprite.name = 'Arena dust puff'; return { sprite, life: 0, max: 0, order: 0, size: 0, grow: 0, rise: 0, drift: new THREE.Vector3(), alpha: 0 };
    });
    slot.sprite.position.set(...at); slot.sprite.material.color.setHex(color); slot.sprite.material.rotation = Math.random() * Math.PI * 2;
    slot.size = size * .5; slot.grow = size * 1.6 / life; slot.rise = rise; slot.drift.set(...drift); slot.alpha = alpha;
    slot.sprite.scale.setScalar(slot.size); slot.sprite.material.opacity = alpha; slot.life = slot.max = life; this.parent.add(slot.sprite);
  }

  /** Bullet hole on a wall/floor, flush with the surface; it lingers, then fades. */
  decal(at: Vec3, normal: Vec3, size = .17, life = 8, shape: MarkShape = 'hole', tint = 0xffffff) {
    if (this.disposed || !at.every(Number.isFinite) || !normal.every(Number.isFinite)) return;
    const slot = this.acquire(this.decals, this.budget.decals, () => {
      const mesh = new THREE.Mesh(this.decalGeo, new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      mesh.name = 'Arena bullet hole'; mesh.renderOrder = 1; return { mesh, life: 0, max: 0, order: 0 };
    });
    const n = new THREE.Vector3(...normal).normalize();
    slot.mesh.position.set(at[0] + n.x * .006, at[1] + n.y * .006, at[2] + n.z * .006);
    slot.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); slot.mesh.rotateZ(Math.random() * Math.PI * 2);
    slot.mesh.material.map = markTexture(shape); slot.mesh.material.color.setHex(tint);
    slot.mesh.scale.setScalar(size * (shape === 'hole' ? 1 : 1.5) * (.85 + Math.random() * .3)); slot.mesh.material.opacity = .9;
    slot.life = slot.max = life; this.parent.add(slot.mesh);
  }

  /** A crescent swept by another player's melee swing, centred on their chest, toward the target.
   *  `span` is the sweep in radians; `vertical` turns it into an overhead chop (hammer). */
  arc(centre: Vec3, toward: Vec3, color: number, radius: number, span: number, mode: SwingMode = 'slash', life = .2, style: SwingStyle = 'crescent', tail?: number) {
    if (this.disposed || ![...centre, ...toward, radius, span].every(Number.isFinite)) return;
    const slot = this.acquire(this.arcs, this.budget.arcs, () => {
      const material = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uColor2: { value: new THREE.Color() }, uProgress: { value: 0 }, uOpacity: { value: 1 }, uSpan: { value: 1 }, uRadius: { value: 1 }, uReach: { value: 1 }, uLift: { value: .55 }, uStyle: { value: 0 } },
        vertexShader: ARC_VERT, fragmentShader: ARC_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.arcGeo, material); mesh.name = 'Arena melee arc'; mesh.frustumCulled = false; return { mesh, life: 0, max: 0, order: 0 };
    });
    const f = new THREE.Vector3(toward[0] - centre[0], mode === 'chop' ? 0 : toward[1] - centre[1], toward[2] - centre[2]);
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1); f.normalize();
    const m = slot.mesh; m.position.set(...centre);
    // Local -Z is the swing's direction. A slash is a diagonal arch, a chop an upside-down arch
    // driven down, a thrust a small pierce ring at the tip.
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), f);
    if (mode === 'chop') m.rotateZ(Math.PI + (Math.random() - .5) * .3);
    else if (mode === 'thrust') m.rotateZ(Math.random() * Math.PI * 2);
    else m.rotateZ((Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .4));
    const u = m.material.uniforms;
    u.uSpan.value = span; u.uRadius.value = radius; u.uReach.value = mode === 'thrust' ? radius * 2.2 : radius * .75; u.uLift.value = mode === 'thrust' ? 0 : .55;
    m.material.uniforms.uColor.value.setHex(color); m.material.uniforms.uColor2.value.setHex(tail ?? color); m.material.uniforms.uStyle.value = SWING_STYLES.indexOf(style); m.material.uniforms.uProgress.value = 0; m.material.uniforms.uOpacity.value = 1;
    slot.life = slot.max = life; this.parent.add(m);
  }

  update(dt: number) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    for (const s of this.streaks) if (s.life > 0) {
      s.life -= dt; if (s.life <= 0) { s.mesh.removeFromParent(); continue; }
      this.placeStreak(s);
      const age = s.max - s.life; s.mesh.material.uniforms.uOpacity.value = s.base * (age > s.travel ? Math.max(0, s.life / (s.max - s.travel)) : 1);
      s.mesh.material.uniforms.uTime.value = age;
    }
    for (const f of this.flashes) if (f.life > 0) {
      f.life -= dt; if (f.life <= 0) { f.sprite.removeFromParent(); continue; }
      const k = f.life / f.max; f.sprite.material.opacity = Math.min(1, k * 1.4); f.core.material.opacity = k; f.sprite.scale.setScalar(f.size * (.7 + .3 * k));
    }
    for (const p of this.puffs) if (p.life > 0) {
      p.life -= dt; if (p.life <= 0) { p.sprite.removeFromParent(); continue; }
      const k = p.life / p.max; p.size += p.grow * dt * k; p.sprite.scale.setScalar(p.size);
      p.sprite.position.y += p.rise * dt * k; p.sprite.position.addScaledVector(p.drift, dt * k);
      p.sprite.material.opacity = p.alpha * Math.min(1, k * 1.6) * Math.min(1, (1 - k) * 8 + .3);
    }
    for (const d of this.decals) if (d.life > 0) {
      d.life -= dt; if (d.life <= 0) { d.mesh.removeFromParent(); continue; }
      d.mesh.material.opacity = .9 * Math.min(1, d.life / 1.5);
    }
    for (const a of this.arcs) if (a.life > 0) {
      a.life -= dt; if (a.life <= 0) { a.mesh.removeFromParent(); continue; }
      const k = 1 - a.life / a.max, u = a.mesh.material.uniforms;
      u.uProgress.value = Math.min(1.55, k * 2.6); u.uOpacity.value = Math.min(1, (1 - k) * 2.2);
    }
  }
  clear() {
    for (const list of [this.streaks, this.flashes, this.puffs, this.decals, this.arcs] as Life[][]) for (const s of list) s.life = 0;
    for (const s of this.streaks) s.mesh.removeFromParent();
    for (const s of this.flashes) s.sprite.removeFromParent();
    for (const s of this.puffs) s.sprite.removeFromParent();
    for (const s of this.decals) s.mesh.removeFromParent();
    for (const s of this.arcs) s.mesh.removeFromParent();
  }
  get inventory() {
    const n = (l: Life[]) => l.filter((s) => s.life > 0).length;
    return { streaks: n(this.streaks), flashes: n(this.flashes), puffs: n(this.puffs), decals: n(this.decals), arcs: n(this.arcs), disposed: this.disposed };
  }
  dispose() {
    if (this.disposed) return; this.clear(); this.disposed = true;
    for (const s of this.streaks) s.mesh.material.dispose();
    for (const s of this.flashes) { s.sprite.material.dispose(); s.core.material.dispose(); }
    for (const s of this.puffs) s.sprite.material.dispose();
    for (const s of this.decals) s.mesh.material.dispose();
    for (const s of this.arcs) s.mesh.material.dispose();
    this.streakGeo.dispose(); this.arcGeo.dispose(); this.decalGeo.dispose();
    this.streaks.length = this.flashes.length = this.puffs.length = this.decals.length = this.arcs.length = 0;
  }
}
