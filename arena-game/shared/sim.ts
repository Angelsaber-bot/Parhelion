// Shared deterministic player rules: applyInput(map, state, input) -> events.
// Runs identically on the server (authoritative) and on the client (prediction + replay).
// Anything that needs other players (hit resolution, shields in the world) is returned as an
// event and handled by Match on the server.

import { CHARACTERS, CROUCH, DASH, DT, MELEE_MOVE, MOVE, SHIELD, WEAPONS, loadoutWeapon, validateLoadout, type Loadout, type Team } from './content.ts';
import { blockedAt, ceilingAt, constrainToBounds, groundAt, recover, type ArenaMap, type Vec3 } from './map.ts';

export const BTN = { FIRE: 1, JUMP: 2, DASH: 4, SHIELD: 8, RELOAD: 16, CROUCH: 32 } as const;

export interface Input {
  seq: number;
  mx: number; // strafe -1..1 (+right)
  mz: number; // forward -1..1 (+forward)
  yaw: number;
  pitch: number;
  buttons: number;
  weapon: number; // selected loadout slot 0..2; never a catalog ID
  view: number; // server tick of the remote frame the client was showing (lag compensation)
}

export interface PlayerState {
  id: string;
  team: Team;
  char: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number;
  hp: number;
  alive: boolean;
  grounded: boolean;
  crouched: boolean; // authoritative stance; remains true while standing would hit a ceiling
  weapon: number; // actual WEAPONS catalog index for rendering and damage
  weaponSlot: number;
  loadout: Loadout;
  meleeWindup: number;
  meleeYaw: number; meleePitch: number;
  ammo: number[];
  reload: number; // ticks left
  fireCd: number;
  dashCd: number;
  dashT: number;
  dashX: number; dashZ: number;
  shieldCd: number;
  prevButtons: number;
  lastSeq: number;
}

export type SimEvent =
  | { type: 'fire'; weapon: number; origin: Vec3; dirs: Vec3[]; view: number; seq: number }
  | { type: 'meleeStart'; weapon: number; yaw: number; pitch: number }
  | { type: 'meleeStrike'; weapon: number; origin: Vec3; dir: Vec3 }
  | { type: 'shield'; x: number; y: number; z: number; yaw: number }
  | { type: 'dash' }
  | { type: 'reload' }
  | { type: 'jump' }
  | { type: 'land' };

const Q = 4096;
export const quant = (v: number) => Math.round(v * Q) / Q;
export const quantAngle = (v: number) => Math.round(v * 10000) / 10000;

export function newPlayer(id: string, team: Team, char: number, choice?: Loadout): PlayerState {
  const loadout = validateLoadout(choice);
  return {
    id, team, char,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
    hp: CHARACTERS[char].hp, alive: false, grounded: true, crouched: false,
    weapon: loadoutWeapon(loadout, 0), weaponSlot: 0, loadout, meleeWindup: 0, meleeYaw: 0, meleePitch: 0, ammo: WEAPONS.map((w) => w.mag), reload: 0, fireCd: 0,
    dashCd: 0, dashT: 0, dashX: 0, dashZ: 0, shieldCd: 0, prevButtons: 0, lastSeq: -1,
  };
}

export function playerHeight(m: ArenaMap, p: Pick<PlayerState, 'crouched'>): number {
  return p.crouched ? Math.min(m.height, CROUCH.height) : m.height;
}
export function playerEye(m: ArenaMap, p: Pick<PlayerState, 'crouched'>): number {
  return p.crouched ? Math.min(m.eye, CROUCH.eye) : m.eye;
}

export function clonePlayer(p: PlayerState): PlayerState {
  return { ...p, ammo: p.ammo.slice(), loadout: [...p.loadout] };
}

/** Forward unit vector for yaw (Three.js camera convention: yaw 0 looks down -Z). */
export function forward(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)];
}

export function aimDir(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

/** Deterministic per-shot hash in [0,1), so spread is identical on client and server. */
function hash01(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function spreadDirs(p: PlayerState, seq: number, wi: number, moving: boolean): Vec3[] {
  const w = WEAPONS[wi];
  const cone = w.spread + (moving || !p.grounded ? w.spreadMove : 0);
  const base = aimDir(p.yaw, p.pitch);
  // basis perpendicular to the aim direction
  const right: Vec3 = [Math.cos(p.yaw), 0, -Math.sin(p.yaw)];
  const up: Vec3 = [
    base[1] * right[2] - base[2] * right[1],
    base[2] * right[0] - base[0] * right[2],
    base[0] * right[1] - base[1] * right[0],
  ];
  const dirs: Vec3[] = [];
  for (let i = 0; i < w.pellets; i++) {
    let ox = 0, oy = 0;
    if (cone > 0) {
      // shotgun: fixed ring pattern with a little jitter; others: uniform disc
      let r: number, a: number;
      if (w.pellets > 1) {
        r = i === 0 ? 0 : cone * (i <= 4 ? 0.5 : 1) * (0.85 + 0.3 * hash01(seq, i));
        a = (i % 4) * (Math.PI / 2) + (i > 4 ? Math.PI / 4 : 0) + 0.3 * hash01(seq, i + 31);
      } else {
        r = cone * Math.sqrt(hash01(seq, i + 7));
        a = 2 * Math.PI * hash01(seq, i + 13);
      }
      ox = Math.cos(a) * r; oy = Math.sin(a) * r;
    }
    const d: Vec3 = [
      base[0] + right[0] * ox + up[0] * oy,
      base[1] + right[1] * ox + up[1] * oy,
      base[2] + right[2] * ox + up[2] * oy,
    ];
    const l = Math.hypot(d[0], d[1], d[2]);
    dirs.push([d[0] / l, d[1] / l, d[2] / l]);
  }
  return dirs;
}

/** Test both the current capsule and the height of an automatic step beneath a low ceiling. */
function canSlideTo(m: ArenaMap, p: PlayerState, x: number, z: number): boolean {
  const height = playerHeight(m, p);
  if (blockedAt(m, x, z, p.y, height)) return false;
  if (p.grounded && p.vy <= 0) {
    const ground = groundAt(m, x, z, p.y);
    if (ground > p.y && blockedAt(m, x, z, ground, height)) return false;
  }
  return true;
}

/** Move horizontally by (dx,dz) with axis-separated sliding, stepping onto low ledges and ramps. */
function slide(m: ArenaMap, p: PlayerState, dx: number, dz: number): void {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MOVE.substep));
  const sx = dx / n, sz = dz / n;
  for (let i = 0; i < n; i++) {
    if (sx !== 0) {
      const x = Math.max(m.movementBounds.minX, Math.min(m.movementBounds.maxX, p.x + sx));
      if (x !== p.x + sx) p.vx = 0;
      if (canSlideTo(m, p, x, p.z)) { p.x = x; snapToStep(m, p); } else p.vx = 0;
    }
    if (sz !== 0) {
      const z = Math.max(m.movementBounds.minZ, Math.min(m.movementBounds.maxZ, p.z + sz));
      if (z !== p.z + sz) p.vz = 0;
      if (canSlideTo(m, p, p.x, z)) { p.z = z; snapToStep(m, p); } else p.vz = 0;
    }
  }
}

function snapToStep(m: ArenaMap, p: PlayerState): void {
  if (p.vy > 0) return;
  const g = groundAt(m, p.x, p.z, p.y);
  // walk up steps / ramps, and stay glued when walking down a ramp
  if (g > p.y - 0.3 && p.grounded) { p.y = g; p.vy = 0; }
}

/** Positions of living enemies, used only to stop a melee lunge at contact instead of passing through. */
export type Foe = { x: number; y: number; z: number };
function lungeBlocked(p: PlayerState, fx: number, fz: number, foes: readonly Foe[]): boolean {
  const stop = Math.min(1.6, WEAPONS[p.weapon].range * .55);
  return foes.some((f) => {
    const dx = f.x - p.x, dz = f.z - p.z;
    return Math.abs(f.y - p.y) < 2 && Math.hypot(dx, dz) < stop && dx * fx + dz * fz > -.2;
  });
}

export function applyInput(m: ArenaMap, p: PlayerState, inp: Input, foes: readonly Foe[] = []): SimEvent[] {
  const events: SimEvent[] = [];
  if (inp.seq <= p.lastSeq) return events;
  p.lastSeq = inp.seq;
  p.yaw = inp.yaw;
  p.pitch = Math.max(-1.45, Math.min(1.45, inp.pitch));
  const pressed = inp.buttons & ~p.prevButtons;
  p.prevButtons = inp.buttons;

  if (p.fireCd > 0) p.fireCd--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.shieldCd > 0) p.shieldCd--;
  if (!p.alive) { p.meleeWindup = 0; return events; }

  // --- movement ---
  const wantsCrouch = !!(inp.buttons & BTN.CROUCH);
  if (wantsCrouch) p.crouched = true;
  else if (p.crouched && !blockedAt(m, p.x, p.z, p.y, m.height)) p.crouched = false;
  // Full dash speed cannot be carried into the short collision stance.
  if (p.crouched) p.dashT = 0;
  const height = playerHeight(m, p);
  const char = CHARACTERS[p.char];
  const speed = char.speed * (p.crouched ? CROUCH.speedMultiplier : 1)
    * (WEAPONS[p.weapon]?.kind === 'melee' ? MELEE_MOVE.speedMultiplier : 1);
  let mx = Math.max(-1, Math.min(1, inp.mx)), mz = Math.max(-1, Math.min(1, inp.mz));
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const [fx, fz] = forward(p.yaw);
  const wishX = (fx * mz + -fz * mx) * speed; // right = (cos yaw, -sin yaw) = (-fz, fx)
  const wishZ = (fz * mz + fx * mx) * speed;
  const moving = len > 0.01;

  if (pressed & BTN.DASH && p.dashCd === 0 && !p.crouched) {
    let dx = wishX, dz = wishZ;
    if (!moving) { dx = fx; dz = fz; }
    const l = Math.hypot(dx, dz);
    p.dashX = dx / l; p.dashZ = dz / l;
    p.dashT = DASH.ticks;
    p.dashCd = DASH.cooldown;
    events.push({ type: 'dash' });
  }

  if (p.dashT > 0) {
    p.dashT--;
    p.vx = p.dashX * DASH.speed;
    p.vz = p.dashZ * DASH.speed;
    if (p.vy < 0) p.vy = 0; // dashes stay level in the air
    if (p.dashT === 0) { p.vx = wishX; p.vz = wishZ; }
  } else if (p.meleeWindup > 0 && WEAPONS[p.weapon]?.lunge && !p.crouched && !lungeBlocked(p, fx, fz, foes)) {
    // Melee lunge: committed forward drive along the current view, so turning steers it.
    const lunge = WEAPONS[p.weapon].lunge!;
    p.vx = fx * lunge + wishX * .3; p.vz = fz * lunge + wishZ * .3;
  } else if (p.grounded) {
    p.vx = wishX; p.vz = wishZ;
  } else {
    const k = Math.min(1, MOVE.airControl * DT);
    p.vx += (wishX - p.vx) * k;
    p.vz += (wishZ - p.vz) * k;
  }

  if (p.crouched) {
    const horizontal = Math.hypot(p.vx, p.vz);
    if (horizontal > speed) { p.vx *= speed / horizontal; p.vz *= speed / horizontal; }
  }

  if (pressed & BTN.JUMP && p.grounded) {
    p.vy = MOVE.jump;
    p.grounded = false;
    events.push({ type: 'jump' });
  }

  recover(m, p, height);
  constrainToBounds(m, p);
  slide(m, p, p.vx * DT, p.vz * DT);

  if (p.dashT === 0 || p.vy > 0) p.vy -= MOVE.gravity * DT;
  let ny = p.y + p.vy * DT;
  if (p.vy > 0) {
    const c = ceilingAt(m, p.x, p.z, p.y, height);
    if (ny + height > c) { ny = c - height; p.vy = 0; }
  }
  const g = groundAt(m, p.x, p.z, Math.max(p.y, ny));
  const wasGrounded = p.grounded;
  if (ny <= g) {
    ny = g; p.vy = 0; p.grounded = true;
    if (!wasGrounded) events.push({ type: 'land' });
  } else {
    p.grounded = false;
  }
  p.y = ny;
  recover(m, p, height);
  constrainToBounds(m, p);

  // --- abilities ---
  if (pressed & BTN.SHIELD && p.shieldCd === 0) {
    p.shieldCd = SHIELD.cooldown;
    events.push({
      type: 'shield',
      x: quant(p.x + fx * SHIELD.distance), y: quant(p.y), z: quant(p.z + fz * SHIELD.distance), yaw: p.yaw,
    });
  }

  // --- weapons: input selects a slot, only the server-approved loadout resolves to an ID ---
  const slot = Number.isInteger(inp.weapon) && inp.weapon >= 0 && inp.weapon < 3 ? inp.weapon : p.weaponSlot;
  const wi = loadoutWeapon(p.loadout, slot);
  if (wi !== p.weapon || slot !== p.weaponSlot) {
    p.weapon = wi; p.weaponSlot = slot;
    p.reload = 0; p.meleeWindup = 0;
    p.fireCd = Math.max(p.fireCd, 15); // 0.25 s swap; never resets an existing attack cooldown
  }
  const w = WEAPONS[p.weapon];
  if (w.kind === 'melee') {
    p.reload = 0;
    if (p.meleeWindup > 0) {
      if (--p.meleeWindup === 0) events.push({ type: 'meleeStrike', weapon: p.weapon,
        origin: [p.x, p.y + playerEye(m, p), p.z], dir: aimDir(p.yaw, p.pitch) });
    } else if (pressed & BTN.FIRE && p.fireCd === 0) {
      p.fireCd = w.interval; p.meleeWindup = w.windup!;
      p.meleeYaw = p.yaw; p.meleePitch = p.pitch;
      events.push({ type: 'meleeStart', weapon: p.weapon, yaw: p.meleeYaw, pitch: p.meleePitch });
    }
  } else if (p.reload > 0) {
    p.reload--;
    if (p.reload === 0) p.ammo[p.weapon] = w.mag;
  } else if ((pressed & BTN.RELOAD && p.ammo[p.weapon] < w.mag) || p.ammo[p.weapon] === 0) {
    p.reload = w.reload;
    events.push({ type: 'reload' });
  } else if (inp.buttons & BTN.FIRE && p.fireCd === 0 && (w.auto || pressed & BTN.FIRE)) {
    p.ammo[p.weapon]--;
    p.fireCd = w.interval;
    events.push({
      type: 'fire', weapon: p.weapon, seq: inp.seq, view: inp.view,
      origin: [p.x, p.y + playerEye(m, p), p.z],
      dirs: spreadDirs(p, inp.seq, p.weapon, moving),
    });
  }

  p.x = quant(p.x); p.y = quant(p.y); p.z = quant(p.z);
  p.vx = quant(p.vx); p.vy = quant(p.vy); p.vz = quant(p.vz);
  return events;
}
