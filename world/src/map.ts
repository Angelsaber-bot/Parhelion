// Minimap + full map, baked from the terrain's own vertex colours so it always matches the GLB.
import * as THREE from 'three';
import type { Layout } from './types';

export class WorldMap {
  base: HTMLCanvasElement;
  size: number;
  half: number;

  constructor(terrain: THREE.Mesh, public layout: Layout) {
    const g = terrain.geometry as THREE.BufferGeometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = g.attributes.color as THREE.BufferAttribute;
    const n = Math.round(Math.sqrt(pos.count));
    this.half = layout.world.half;
    this.size = n;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    const tmp = new THREE.Color();
    const wl = layout.world.waterLevel;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      tmp.setRGB(col.getX(k), col.getY(k), col.getZ(k), THREE.LinearSRGBColorSpace);
      if (y < wl) tmp.set('#5cc6e4');
      const rgb = { r: 0, g: 0, b: 0 };
      tmp.getRGB(rgb, THREE.SRGBColorSpace);
      // simple hillshade from the height gradient
      const i = k % n, j = Math.floor(k / n);
      const hx = pos.getY(Math.min(k + 1, pos.count - 1)) - pos.getY(Math.max(k - 1, 0));
      const hz = j + 1 < n && j > 0 ? pos.getY(k + n) - pos.getY(k - n) : 0;
      const shade = y < wl ? 1 : THREE.MathUtils.clamp(1 + (-hx * 0.6 - hz * 0.6) * 0.06, 0.7, 1.2);
      img.data[k * 4] = Math.min(255, rgb.r * 255 * shade);
      img.data[k * 4 + 1] = Math.min(255, rgb.g * 255 * shade);
      img.data[k * 4 + 2] = Math.min(255, rgb.b * 255 * shade);
      img.data[k * 4 + 3] = 255;
      void i;
    }
    ctx.putImageData(img, 0, 0);
    this.base = c;
  }

  /** world -> base canvas pixel */
  px(x: number) { return ((x + this.half) / (this.half * 2)) * this.size; }

  draw(ctx: CanvasRenderingContext2D, player: THREE.Vector3, yaw: number, opts: { full: boolean; done: Set<string>; found: Set<string> }) {
    const W = ctx.canvas.width;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    let scale: number, ox: number, oz: number;
    if (opts.full) {
      scale = W / this.size; ox = 0; oz = 0;
    } else {
      const view = 70; // metres of world visible across the minimap radius... about 140 m wide
      scale = W / ((view * 2) / (this.half * 2) * this.size);
      ox = this.px(player.x) - W / 2 / scale;
      oz = this.px(player.z) - W / 2 / scale;
    }
    const tx = (x: number) => (this.px(x) - ox) * scale;
    ctx.drawImage(this.base, -ox * scale, -oz * scale, this.size * scale, this.size * scale);

    // area labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const a of this.layout.areas) {
      const x = tx(a.c[0]), y = tx(a.c[1]);
      ctx.font = `700 ${opts.full ? 26 : 18}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = '#1f2a44aa'; ctx.fillStyle = '#fff';
      ctx.strokeText(a.name, x, y - (opts.full ? 22 : 0)); ctx.fillText(a.name, x, y - (opts.full ? 22 : 0));
    }
    // markers
    for (const m of this.layout.markers) {
      const x = tx(m.p[0]), y = tx(m.p[2]);
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
    // player arrow
    const x = tx(player.x), y = tx(player.z);
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1f2a44'; ctx.stroke();
    ctx.restore();
  }
}
