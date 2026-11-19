// Shared grenade rules: deterministic ballistic flight with per-axis bounces against the
// map's boxes, blast falloff, and smoke volumes. The Match owns the projectiles; clients only
// render snapshots, so nothing here is predicted.

import { DT, FRAG, GRENADE, SMOKE, type Team, type UtilityId } from './content.ts';
import { groundAt, raycastMap, type ArenaMap, type Vec3 } from './map.ts';
import { quant } from './sim.ts';

export interface Grenade {
  id: number; owner: string; team: Team; kind: UtilityId;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  fuse: number; // frag ticks left, zero while waiting for contact; smoke has no fuse
  rest: boolean;
}
export interface Smoke {
  id: number; owner: string; x: number; y: number; z: number; life: number; delay?:number; box?:{yaw:number;width:number;depth:number;height:number};
  /** How far the cloud reaches along SMOKE.rays even horizontal directions (walls stop it; open sides take the rest), and how tall it may rise. */
  reach?: number[]; top?: number;
  /** A frag blew this open: centre and ticks left. */
  hole?: { x: number; y: number; z: number; life: number };
}

/** Spawn just ahead of the hand, never inside a wall the thrower is touching. */
export function launchGrenade(m: ArenaMap, id: number, owner: string, team: Team, kind: UtilityId, origin: Vec3, dir: Vec3, carry: readonly [number, number]): Grenade {
  const ahead = Math.min(.45, Math.max(0, raycastMap(m, origin, dir, .45) - GRENADE.radius));
  return {
    id, owner, team, kind,
    x: quant(origin[0] + dir[0] * ahead), y: quant(origin[1] + dir[1] * ahead), z: quant(origin[2] + dir[2] * ahead),
    vx: quant(dir[0] * GRENADE.speed + carry[0] * GRENADE.inherit),
    vy: quant(dir[1] * GRENADE.speed + GRENADE.lift),
    vz: quant(dir[2] * GRENADE.speed + carry[1] * GRENADE.inherit),
    fuse: kind === 'frag' ? FRAG.fuse : 0, rest: false,
  };
}

/** One tick of flight. Landed means support this tick, not a past bounce. */
export function stepGrenade(m: ArenaMap, g: Grenade): { loud: boolean; landed: boolean } {
  if (g.rest) return { loud: false, landed: true };
  g.vy -= GRENADE.gravity * DT;
  const r = GRENADE.radius;
  let loud = false;
  // Sweep horizontal axes separately so a wall reflects only its own axis.
  for (const axis of [0, 2] as const) {
    const v = axis === 0 ? g.vx : g.vz, d = v * DT;
    if (Math.abs(d) < 1e-9) continue;
    const s = Math.sign(d), dir: Vec3 = axis === 0 ? [s, 0, 0] : [0, 0, s];
    const hit = raycastMap(m, [g.x, g.y, g.z], dir, Math.abs(d) + r);
    const move = hit === Infinity ? d : s * Math.max(0, hit - r);
    if (axis === 0) g.x += move; else g.z += move;
    if (hit === Infinity) continue;
    loud ||= Math.abs(v) > 2;
    const bounced = -v * GRENADE.restitution;
    if (axis === 0) g.vx = bounced; else g.vz = bounced;
  }
  const b = m.movementBounds;
  if (g.x < b.minX || g.x > b.maxX) { g.x = Math.max(b.minX, Math.min(b.maxX, g.x)); g.vx = -g.vx * GRENADE.restitution; }
  if (g.z < b.minZ || g.z > b.maxZ) { g.z = Math.max(b.minZ, Math.min(b.maxZ, g.z)); g.vz = -g.vz * GRENADE.restitution; }
  // Sweep the bottom onto real support below the centre. Player step-up tolerance
  // would let a grenade snap onto a platform from underneath.
  const dy = g.vy * DT;
  const floor = dy <= 0 ? groundAt(m, g.x, g.z, g.y, 0) : -100;
  const landed = floor > -100 && g.y + dy <= floor + r;
  if (landed) {
    g.y = floor + r; loud ||= g.vy < -2;
    g.vy = -g.vy * GRENADE.restitution; g.vx *= GRENADE.friction; g.vz *= GRENADE.friction;
    if (g.vy < 1.2 && Math.hypot(g.vx, g.vz) < .5) { g.rest = true; g.vx = g.vy = g.vz = 0; }
  } else if (dy > 0) {
    const hit = raycastMap(m, [g.x, g.y, g.z], [0, 1, 0], dy + r);
    g.y += hit === Infinity ? dy : Math.max(0, hit - r);
    if (hit !== Infinity) { loud ||= g.vy > 2; g.vy = -g.vy * GRENADE.restitution; }
  } else g.y += dy;
  g.x = quant(g.x); g.y = quant(g.y); g.z = quant(g.z);
  g.vx = quant(g.vx); g.vy = quant(g.vy); g.vz = quant(g.vz);
  return { loud, landed };
}

/** True when a blast this far away reaches you (it is then lethal to enemies). */
export function fragReaches(distance: number): boolean { return distance >= 0 && distance <= FRAG.radius; }

/** Where the billboard fallback centres a cloud: low in the dome, above where the can landed. */
export const smokeCentre = (s: Smoke): Vec3 => [s.x, s.y + SMOKE.height * .4, s.z];
/** Settled shape of a new cloud: walls stop it in each direction, and what they take spills into the open sides,
 * keeping roughly the same floor area, the way a real cloud fills a corridor instead of seeping through stone. */
export function settleSmoke(m: ArenaMap, s: Smoke): Smoke {
  // Every collider counts, including invisible "air walls" around buildings, and so does the map's outer boundary.
  // Each direction is probed at three heights and three side offsets and keeps the most open: smoke spills over
  // low cover and past a thin pillar, but a real wall (or an air wall) stops it at every height.
  const n = SMOKE.rays, far = SMOKE.radius * SMOKE.stretch, b = m.movementBounds, walls: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const edge = Math.min(dx > 1e-6 ? (b.maxX - s.x) / dx : dx < -1e-6 ? (b.minX - s.x) / dx : Infinity, dz > 1e-6 ? (b.maxZ - s.z) / dz : dz < -1e-6 ? (b.minZ - s.z) / dz : Infinity);
    let open = 0;
    for (const h of [.4, 1.6, 2.8]) for (const side of [-.6, 0, .6]) {
      const d = raycastMap(m, [s.x - dz * side, s.y + h, s.z + dx * side], [dx, 0, dz], far);
      open = Math.max(open, Number.isFinite(d) ? d + .25 : far);
    }
    walls.push(Math.max(.6, Math.min(open, Math.max(0, edge) + .25)));
  }
  const area = (r: number[]) => r.reduce((sum, v) => sum + v * v, 0);
  let reach = walls.map(w => Math.min(w, SMOKE.radius));
  for (let k = 0; k < 6; k++) { const scale = Math.sqrt(n * SMOKE.radius ** 2 / Math.max(1e-6, area(reach))); if (scale < 1.005) break; reach = walls.map((w, i) => Math.min(w, reach[i] * scale, far)); }
  const ceiling = raycastMap(m, [s.x, s.y + 1, s.z], [0, 1, 0], SMOKE.height);
  return { ...s, reach: reach.map(quant), top: quant(Number.isFinite(ceiling) ? Math.max(1.9, ceiling + .9) : SMOKE.height) };
}
/** Size of the cloud over its life: it blooms from 40% in SMOKE.bloom ticks and sinks a little as it thins. */
export function smokeScale(s: Smoke): number {
  if (s.life <= 0 || (s.delay ?? 0) > 0) return 0;
  const age = Math.max(0, SMOKE.life - s.life), grow = Math.min(1, age / SMOKE.bloom), ease = 1 - (1 - grow) ** 3;
  return (.4 + .6 * ease) * (s.life < SMOKE.fade ? .7 + .3 * s.life / SMOKE.fade : 1);
}
/** Radius of a frag-blown hole: wide open for SMOKE.hole.open ticks, then the smoke rolls back in. */
export function smokeHoleRadius(h: Smoke['hole']): number {
  if (!h || h.life <= 0) return 0;
  const closing = SMOKE.hole.life - SMOKE.hole.open;
  return SMOKE.hole.radius * Math.min(1, h.life / closing);
}
/** The cloud's profile: steep sides and a rounded top (between a cylinder and a dome); the shader uses the same. */
export const smokeShape = (horizontal: number, vertical: number) => { const h2 = horizontal * horizontal; return .6 * h2 * h2 + .4 * h2 + vertical * vertical; };
function reachAt(s: Smoke, dx: number, dz: number): number {
  const r = s.reach; if (!r?.length) return SMOKE.radius;
  const f = ((Math.atan2(dz, dx) / (Math.PI * 2)) % 1 + 1) % 1 * r.length, i = Math.floor(f) % r.length, j = (i + 1) % r.length, t = f - Math.floor(f);
  return r[i] + (r[j] - r[i]) * t;
}
/** Inside the gameplay volume: the dome (per-direction reach, its height), minus a blown hole. Sight returns
 * SMOKE.clear ticks before the cloud is gone. */
function inCloud(s: Smoke, k: number, p: readonly number[]): boolean {
  const dx = p[0] - s.x, dy = p[1] - s.y, dz = p[2] - s.z;
  if (dy < -.3) return false;
  const R = reachAt(s, dx, dz) * k, H = (s.top ?? SMOKE.height) * k, h = Math.hypot(dx, dz);
  if (smokeShape(h / R, Math.max(0, dy) / H) >= 1) return false;
  const hole = smokeHoleRadius(s.hole);
  return !(hole > 0 && (p[0] - s.hole!.x) ** 2 + (p[1] - s.hole!.y) ** 2 + (p[2] - s.hole!.z) ** 2 < hole * hole);
}
const live = (s: Smoke) => s.life > SMOKE.clear && (s.delay ?? 0) <= 0;
export function insideSmoke(smokes: readonly Smoke[], p: readonly number[]): boolean {
  for (const s of smokes) { if (!live(s)) continue; if(s.box){const a=smokeLocal(s,p);if(Math.abs(a[0])<=s.box.width/2&&a[1]>=0&&a[1]<=s.box.height&&Math.abs(a[2])<=s.box.depth/2)return true;continue;} if (inCloud(s, smokeScale(s), p)) return true; }
  return false;
}
/** True when the segment a→b passes through any live smoke volume (vision; bullets only lose damage). */
export function smokeBlocks(smokes: readonly Smoke[], a: Vec3, b: Vec3): boolean {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], len = Math.sqrt(len2);
  for (const s of smokes) {
    if (!live(s)) continue;
    if(s.box){const aa=smokeLocal(s,a),bb=smokeLocal(s,b);let lo=0,hi=1;const mins=[-s.box.width/2,0,-s.box.depth/2],maxs=[s.box.width/2,s.box.height,s.box.depth/2];for(let i=0;i<3;i++){const delta=bb[i]-aa[i];if(Math.abs(delta)<1e-9){if(aa[i]<mins[i]||aa[i]>maxs[i]){hi=-1;break;}}else{const x=(mins[i]-aa[i])/delta,y=(maxs[i]-aa[i])/delta;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}}if(lo<=hi)return true;continue;}
    // Bounding sphere first, then sample the part of the sight line inside it every 0.2 m.
    const k = smokeScale(s), bound = Math.max(SMOKE.radius * SMOKE.stretch, s.top ?? SMOKE.height) * k, c: Vec3 = [s.x, s.y, s.z];
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / len2)) : 0;
    const q: Vec3 = [a[0] + d[0] * t - c[0], a[1] + d[1] * t - c[1], a[2] + d[2] * t - c[2]], miss2 = q[0] * q[0] + q[1] * q[1] + q[2] * q[2];
    if (miss2 >= bound * bound) continue;
    if (len < 1e-6) { if (inCloud(s, k, a)) return true; continue; }
    const half = Math.sqrt(bound * bound - miss2) / len, from = Math.max(0, t - half), to = Math.min(1, t + half), steps = Math.max(1, Math.ceil((to - from) * len / .2));
    for (let i = 0; i <= steps; i++) { const u = from + (to - from) * i / steps; if (inCloud(s, k, [a[0] + d[0] * u, a[1] + d[1] * u, a[2] + d[2] * u])) return true; }
  }
  return false;
}

/** A close silhouette can show across a thin edge, but a long ray or a thick bank stays opaque. */
export function smokeAllowsGlimpse(smokes: readonly Smoke[], a: Vec3, b: Vec3): boolean {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const distance = Math.hypot(dx, dy, dz);
  if (distance > 8 || !smokeBlocks(smokes, a, b)) return false;
  const steps = Math.max(1, Math.ceil(distance / .18));
  let inside = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + .5) / steps;
    if (insideSmoke(smokes, [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t]) && ++inside * distance / steps > .75) return false;
  }
  return true;
}
function smokeLocal(s:Smoke,p:readonly number[]):Vec3{const yaw=s.box!.yaw,x=p[0]-s.x,z=p[2]-s.z;return [x*Math.cos(yaw)-z*Math.sin(yaw),p[1]-s.y,x*Math.sin(yaw)+z*Math.cos(yaw)];}
