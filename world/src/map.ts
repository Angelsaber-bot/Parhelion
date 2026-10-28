// Minimap + full map, baked from the terrain's own vertex colours so it always matches the GLB.
import * as THREE from 'three';
import { localizeText } from '../../shared-client/i18n';
import type { Layout } from './types';
import type { WorldGrid } from './grid';

export class WorldMap {
  base: HTMLCanvasElement;
  size: number;
  half: number;
  /** rectangular grids: cells and half-span along z (default: same as x) */
  sizeZ?: number;
  halfZ?: number;
  /** grid origin; defaults to a square centred on the origin of `half` */
  x0?: number;
  z0?: number;

  constructor(grid: WorldGrid, public layout: Layout) {
    const n = grid.nx, nz = grid.nz;
    this.size = n;
    this.sizeZ = nz;
    this.half = grid.span / 2;
    this.halfZ = grid.spanZ / 2;
    this.x0 = grid.x0;
    this.z0 = grid.z0;
    const c = document.createElement('canvas');
    c.width = n; c.height = nz;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(n, nz);
    const tmp = new THREE.Color();
    const wl = layout.world.waterLevel;
    const H = grid.h;
    for (let k = 0; k < n * nz; k++) {
      const y = H[k];
      tmp.setRGB(grid.col[k * 3], grid.col[k * 3 + 1], grid.col[k * 3 + 2], THREE.LinearSRGBColorSpace);
      if (y < wl) tmp.set(y < wl - 4 ? '#3fa9d6' : '#5cc6e4');
      const rgb = { r: 0, g: 0, b: 0 };
      tmp.getRGB(rgb, THREE.SRGBColorSpace);
      // simple hillshade from the height gradient
      const i = k % n, j = Math.floor(k / n);
      const hx = i > 0 && i < n - 1 ? H[k + 1] - H[k - 1] : 0;
      const hz = j + 1 < nz && j > 0 ? H[k + n] - H[k - n] : 0;
      const shade = y < wl ? 1 : THREE.MathUtils.clamp(1 + (-hx * 0.6 - hz * 0.6) * 0.06, 0.7, 1.2);
      img.data[k * 4] = Math.min(255, rgb.r * 255 * shade);
      img.data[k * 4 + 1] = Math.min(255, rgb.g * 255 * shade);
      img.data[k * 4 + 2] = Math.min(255, rgb.b * 255 * shade);
      img.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.base = c;
  }

  /** world -> base canvas pixel */
  px(x: number) { return ((x - (this.x0 ?? -this.half)) / (this.half * 2)) * this.size; }
  pz(z: number) { const hz = this.halfZ ?? this.half; return ((z - (this.z0 ?? -hz)) / (hz * 2)) * (this.sizeZ ?? this.size); }

  draw(ctx: CanvasRenderingContext2D, player: THREE.Vector3, yaw: number, opts: { full: boolean; done: Set<string>; found: Set<string>; target?: [number, number] | null; enemies?: ReadonlyArray<{ p: { x: number; z: number }; boss: boolean }> }) {
    const W = ctx.canvas.width;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    let scale: number, ox: number, oz: number;
    if (opts.full) {
      // fit the longer axis, centre the shorter one
      const sz = this.sizeZ ?? this.size, m = Math.max(this.size, sz);
      scale = W / m; ox = -(m - this.size) / 2; oz = -(m - sz) / 2;
    } else {
      const view = 70; // metres of world visible across the minimap radius... about 140 m wide
      scale = W / ((view * 2) / (this.half * 2) * this.size);
      ox = this.px(player.x) - W / 2 / scale;
      oz = this.pz(player.z) - W / 2 / scale;
    }
    const tx = (x: number) => (this.px(x) - ox) * scale;
    const tz = (z: number) => (this.pz(z) - oz) * scale;
    ctx.drawImage(this.base, -ox * scale, -oz * scale, this.size * scale, (this.sizeZ ?? this.size) * scale);

    // area labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const a of this.layout.areas) {
      const x = tx(a.c[0]), y = tz(a.c[1]);
      ctx.font = `700 ${opts.full ? 26 : 18}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = '#1f2a44aa'; ctx.fillStyle = '#fff';
      const label = localizeText(a.name);
      ctx.strokeText(label, x, y - (opts.full ? 22 : 0)); ctx.fillText(label, x, y - (opts.full ? 22 : 0));
    }
    // live monsters (bosses larger)
    for (const e of opts.enemies ?? []) {
      ctx.beginPath(); ctx.arc(tx(e.p.x), tz(e.p.z), e.boss ? (opts.full ? 9 : 7) : (opts.full ? 4 : 3.5), 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b4e'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a0b10'; ctx.stroke();
    }
    // markers
    for (const m of this.layout.markers) {
      const x = tx(m.p[0]), y = tz(m.p[2]);
      let color = '';
      if (m.type === 'interact') color = opts.done.has(m.id) ? '#7ad18a' : '#ffb547';
      else if (m.type === 'discovery') { if (!opts.found.has(m.id) && !opts.full) continue; color = opts.found.has(m.id) ? '#c9a2ff' : '#ffffff55'; }
      else if (m.type === 'spawn') color = '#5fe7f2';
      else if (m.type === 'enemy' && opts.full) color = '#ff5d6c';
      else continue;
      ctx.beginPath();
      ctx.arc(x, y, m.type === 'interact' ? 9 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#1f2a44'; ctx.stroke();
    }
    // quest guide target: pulsing gold diamond
    if (opts.target) {
      const gx = tx(opts.target[0]), gy = tz(opts.target[1]), r = (opts.full ? 13 : 10) * (1 + 0.15 * Math.sin(performance.now() / 220));
      ctx.beginPath();
      ctx.moveTo(gx, gy - r); ctx.lineTo(gx + r * 0.75, gy); ctx.lineTo(gx, gy + r); ctx.lineTo(gx - r * 0.75, gy); ctx.closePath();
      ctx.fillStyle = '#ffd76a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1f2a44'; ctx.stroke();
    }
    // player arrow
    const x = tx(player.x), y = tz(player.z);
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1f2a44'; ctx.stroke();
    ctx.restore();
  }
}
