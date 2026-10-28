// Minimap + full map, baked from the terrain's own vertex colours so it always matches the GLB.
import * as THREE from 'three';
import { localizeText } from '../../shared-client/i18n';
import type { Layout } from './types';
import type { WorldGrid } from './grid';
import { GATES } from './regions';
import { collectMinimapLandmarks, minimapArea, MINIMAP_COLORS, MINIMAP_VIEW_RADIUS, projectMinimapTarget, selectMinimapLandmarks, type MapBox, type MinimapLandmark } from './minimapMarkers';

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
  private minimapLandmarks?: MinimapLandmark[];

  constructor(grid: WorldGrid, public layout: Layout) {
    const n = grid.nx, nz = grid.nz;
    this.size = n;
    this.sizeZ = nz;
    this.half = grid.span / 2;
    this.halfZ = grid.spanZ / 2;
    this.x0 = grid.x0;
    this.z0 = grid.z0;
    this.minimapLandmarks = collectMinimapLandmarks(layout.areas, GATES);
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
      const view = MINIMAP_VIEW_RADIUS; // metres across the radius; about 140 m wide
      scale = W / ((view * 2) / (this.half * 2) * this.size);
      ox = this.px(player.x) - W / 2 / scale;
      oz = this.pz(player.z) - W / 2 / scale;
    }
    const tx = (x: number) => (this.px(x) - ox) * scale;
    const tz = (z: number) => (this.pz(z) - oz) * scale;
    ctx.drawImage(this.base, -ox * scale, -oz * scale, this.size * scale, (this.sizeZ ?? this.size) * scale);

    const target = opts.target ? { x: tx(opts.target[0]), y: tz(opts.target[1]) } : null;
    const miniTarget = target && !opts.full ? projectMinimapTarget(target, W) : null;

    // The full map retains its complete exploration information. The small map
    // intentionally never reads ordinary interaction/discovery/spawn/enemy markers.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (opts.full) {
      // Skip any label whose box would overlap one already drawn, so dense hubs stay readable.
      const boxes: Array<[number, number, number, number]> = [];
      for (const a of this.layout.areas) {
        const x = tx(a.c[0]), y = tz(a.c[1]) - 22;
        ctx.font = '700 23px system-ui, sans-serif';
        const label = localizeText(a.name), w = (ctx.measureText?.(label).width ?? label.length * 23) + 6, h = 26;
        const box: [number, number, number, number] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
        if (boxes.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
        boxes.push(box);
        ctx.lineWidth = 5; ctx.strokeStyle = '#141c30dd'; ctx.fillStyle = '#fff';
        ctx.strokeText(label, x, y); ctx.fillText(label, x, y);
      }
      // live monsters (bosses larger)
      for (const e of opts.enemies ?? []) {
        ctx.beginPath(); ctx.arc(tx(e.p.x), tz(e.p.z), e.boss ? 9 : 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3b4e'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a0b10'; ctx.stroke();
      }
      // markers
      for (const m of this.layout.markers) {
        const x = tx(m.p[0]), y = tz(m.p[2]);
        let color = '';
        if (m.type === 'interact') color = opts.done.has(m.id) ? '#7ad18a' : '#ffb547';
        else if (m.type === 'discovery') color = opts.found.has(m.id) ? '#c9a2ff' : '#ffffff55';
        else if (m.type === 'spawn') color = '#5fe7f2';
        else if (m.type === 'enemy') color = '#ff5d6c';
        else continue;
        ctx.beginPath();
        ctx.arc(x, y, m.type === 'interact' ? 9 : 5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#1f2a44'; ctx.stroke();
      }
    } else {
      const area = minimapArea(this.layout.areas, player.x, player.z);
      let labelBox: MapBox | undefined;
      if (area) {
        const label = localizeText(area.name), y = W * 0.17;
        ctx.font = '600 18px system-ui, sans-serif';
        const width = Math.min(W * 0.62, ctx.measureText?.(label).width ?? label.length * 18);
        const box: MapBox = [W / 2 - width / 2 - 6, y - 14, W / 2 + width / 2 + 6, y + 14];
        // The active objective has priority even over the contextual label.
        if (!miniTarget || miniTarget.x + 18 < box[0] || miniTarget.x - 18 > box[2] || miniTarget.y + 18 < box[1] || miniTarget.y - 18 > box[3]) {
          labelBox = box;
          ctx.lineWidth = 4; ctx.strokeStyle = '#141c30dd'; ctx.fillStyle = MINIMAP_COLORS.landmark;
          ctx.strokeText(label, W / 2, y, W * 0.62); ctx.fillText(label, W / 2, y, W * 0.62);
        }
      }
      this.minimapLandmarks ??= collectMinimapLandmarks(this.layout.areas, GATES);
      const landmarks = selectMinimapLandmarks(this.minimapLandmarks, ([x, z]) => ({ x: tx(x), y: tz(z) }), W, miniTarget, labelBox);
      for (const point of landmarks) {
        const { x, y } = point;
        ctx.beginPath();
        if (point.kind === 'entrance') {
          // Doorway: a chapter route, not a newly invented teleport interaction.
          ctx.moveTo(x - 7, y + 8); ctx.lineTo(x - 7, y - 7); ctx.lineTo(x + 7, y - 7); ctx.lineTo(x + 7, y + 8);
        } else {
          // Hollow waystone: an existing regional travel destination.
          ctx.moveTo(x, y - 8); ctx.lineTo(x + 7, y - 4); ctx.lineTo(x + 7, y + 4);
          ctx.lineTo(x, y + 8); ctx.lineTo(x - 7, y + 4); ctx.lineTo(x - 7, y - 4); ctx.closePath();
        }
        ctx.lineWidth = 6; ctx.strokeStyle = MINIMAP_COLORS.outline; ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = MINIMAP_COLORS.landmark; ctx.stroke();
      }
    }
    // quest guide target: pulsing gold diamond
    if (target) {
      const { x: gx, y: gy } = miniTarget ?? target;
      // Leave a gold outline visible around the player when arriving at the target.
      const nearPlayer = !opts.full && Math.hypot(gx - W / 2, gy - W / 2) < 24;
      const r = (opts.full ? 13 : nearPlayer ? 20 : 10) * (1 + 0.15 * Math.sin(performance.now() / 220));
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
