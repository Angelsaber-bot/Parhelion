/**
 * Offline diagnostic only: execute the real before/after Canvas draw methods,
 * replay their commands to SVG, then rasterize with sharp. Not a browser/WebGL
 * screenshot. Terrain comes from the shipped GLBs through the real WorldGrid.
 * Run from world/: node --import tsx validation/minimap/render-preview.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { transformSync } from 'esbuild';
import sharp from 'sharp';
import { WorldMap } from '../../src/map';
import { WorldGrid } from '../../src/grid';
import { regionLoader, bakeQuantized } from '../../src/glb';
import { GRID, REGIONS, mergeLayouts } from '../../src/regions';
import { localizeText } from '../../../shared-client/i18n';
import type { Layout } from '../../src/types';

const output = new URL('../../../docs/world-minimap/', import.meta.url);
mkdirSync(output, { recursive: true });
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

class RecordingCanvas {
  width = 380;
  height = 380;
  pixels?: Uint8ClampedArray;
  uri = '';
  elements: string[] = [];
  path = '';
  fillStyle = '#000'; strokeStyle = '#000'; lineWidth = 1; font = '18px system-ui';
  textAlign = 'center'; textBaseline = 'middle'; imageSmoothingEnabled = true;
  transform = '';
  get canvas() { return this; }
  getContext() { return this; }
  createImageData(width: number, height: number) { return { data: new Uint8ClampedArray(width * height * 4) }; }
  putImageData(image: { data: Uint8ClampedArray }) { this.pixels = image.data; }
  save() {} restore() {}
  clearRect() { this.elements = []; this.transform = ''; }
  drawImage(image: RecordingCanvas, x: number, y: number, width: number, height: number) {
    this.elements.push(`<image href="${image.uri}" x="${x}" y="${y}" width="${width}" height="${height}"/>`);
  }
  // Deterministic approximation of browser font metrics; stated in the manifest.
  measureText(text: string) {
    const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 18);
    return { width: [...text].reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? size : size * 0.55), 0) };
  }
  text(text: string, x: number, y: number, stroke: boolean, maxWidth?: number) {
    const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 18);
    const weight = /^(\d+)\s/.exec(this.font)?.[1] ?? '400';
    const naturalWidth = this.measureText(text).width;
    const squeeze = maxWidth && naturalWidth > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
    this.elements.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Noto Sans CJK SC, sans-serif" font-size="${size}" font-weight="${weight}" fill="${stroke ? 'none' : this.fillStyle}" stroke="${stroke ? this.strokeStyle : 'none'}" stroke-width="${this.lineWidth}"${squeeze}>${escape(text)}</text>`);
  }
  strokeText(text: string, x: number, y: number, maxWidth?: number) { this.text(text, x, y, true, maxWidth); }
  fillText(text: string, x: number, y: number, maxWidth?: number) { this.text(text, x, y, false, maxWidth); }
  beginPath() { this.path = ''; }
  moveTo(x: number, y: number) { this.path += `M${x},${y} `; }
  lineTo(x: number, y: number) { this.path += `L${x},${y} `; }
  closePath() { this.path += 'Z '; }
  arc(x: number, y: number, r: number) { this.path += `M${x - r},${y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 `; }
  fill() { this.elements.push(`<path d="${this.path}" fill="${this.fillStyle}" transform="${this.transform}"/>`); }
  stroke() { this.elements.push(`<path d="${this.path}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" transform="${this.transform}"/>`); }
  translate(x: number, y: number) { this.transform += ` translate(${x} ${y})`; }
  rotate(radians: number) { this.transform += ` rotate(${radians * 180 / Math.PI})`; }
  svg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="380"><defs><clipPath id="viewport"><circle cx="190" cy="190" r="187"/></clipPath></defs><g clip-path="url(#viewport)">${this.elements.join('')}</g><circle cx="190" cy="190" r="187" fill="none" stroke="#fff" stroke-width="6"/></svg>`;
  }
}

const documentStub = { documentElement: {}, createElement: () => new RecordingCanvas() };
Object.assign(globalThis, { document: documentStub });
Object.defineProperty(performance, 'now', { value: () => 0 });
const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const oldSource = execFileSync('git', ['show', `${baseCommit}:world/src/map.ts`], { encoding: 'utf8' });
const compiled = transformSync(oldSource, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
const legacyModule: { exports: Record<string, unknown> } = { exports: {} };
runInNewContext(compiled, { module: legacyModule, exports: legacyModule.exports, require: (name: string) => {
  if (name === 'three') return THREE;
  if (name === '../../shared-client/i18n') return { localizeText };
  throw new Error(`Unexpected baseline import: ${name}`);
}, document: documentStub, performance: { now: () => 0 } });
const LegacyWorldMap = legacyModule.exports.WorldMap as typeof WorldMap;

const terrains: THREE.Mesh[] = [];
const parts = [];
for (const def of REGIONS) {
  const bytes = readFileSync(new URL(`../../public/assets/${def.file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(def.offset[0], 0, def.offset[1]);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => { if ((object as THREE.Mesh).isMesh && object.name === 'Terrain') terrains.push(object as THREE.Mesh); });
  parts.push({ def, layout: JSON.parse(readFileSync(new URL(`../../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout });
}
const layout = mergeLayouts(parts);
const grid = new WorldGrid(terrains, GRID.x0, GRID.z0, GRID.span, GRID.cell, '#4f8fa8', GRID.spanZ);
const current = new WorldMap(grid, layout);
const base = current.base as unknown as RecordingCanvas;
base.uri = `data:image/png;base64,${(await sharp(Buffer.from(base.pixels!), { raw: { width: base.width, height: base.height, channels: 4 } }).png().toBuffer()).toString('base64')}`;
const before = Object.assign(Object.create(LegacyWorldMap.prototype) as WorldMap,
  { size: current.size, sizeZ: current.sizeZ, half: current.half, halfZ: current.halfZ, x0: current.x0, z0: current.z0, base: current.base, layout });
const scenes = [
  { id: 'hub', title: '总部密集区域 / Dense headquarters', player: [-112, 246], target: [-65, 250] },
  { id: 'entrance', title: '章节入口 / Chapter entrance', player: [325, 30], target: [455, 45] },
  { id: 'distant-target', title: '远处任务保留方向 / Distant quest bearing', player: [3, 159], target: [0, -150.5] },
];
for (const scene of scenes) {
  const oldFull = new RecordingCanvas(), newFull = new RecordingCanvas();
  const options = { full: true, done: new Set(['hq_terminal']), found: new Set(['secret_pillar']), target: scene.target as [number, number] };
  const position = new THREE.Vector3(scene.player[0], 0, scene.player[1]);
  before.draw(oldFull as unknown as CanvasRenderingContext2D, position, 0.45, options);
  current.draw(newFull as unknown as CanvasRenderingContext2D, position, 0.45, options);
  assert.deepEqual(newFull.elements, oldFull.elements, `${scene.id}: full-map commands must remain byte-for-byte identical`);
}
const composition: sharp.OverlayOptions[] = [];
for (const [index, scene] of scenes.entries()) {
  for (const [column, [label, renderer]] of [['before', before], ['after', current]].entries()) {
    const ctx = new RecordingCanvas();
    renderer.draw(ctx as unknown as CanvasRenderingContext2D, new THREE.Vector3(scene.player[0], 0, scene.player[1]), 0.45,
      { full: false, done: new Set(), found: new Set(layout.markers.filter((m) => m.type === 'discovery').map((m) => m.id)), target: scene.target as [number, number],
        // Deliberate dense live-enemy diagnostic input, not claimed gameplay positions.
        enemies: Array.from({ length: 16 }, (_, n) => ({ boss: n === 0, p: { x: scene.player[0] + Math.cos(n * 1.3) * (20 + n), z: scene.player[1] + Math.sin(n * 1.3) * (20 + n) } })) });
    const svg = ctx.svg(), png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(new URL(`${scene.id}-${label}.png`, output), png);
    composition.push({ input: png, left: 55 + column * 450, top: 180 + index * 440 });
  }
}
const headings = `<svg xmlns="http://www.w3.org/2000/svg" width="940" height="1520"><rect width="940" height="1520" fill="#111923"/><g fill="#e6edf5" font-family="Noto Sans CJK SC, sans-serif"><text x="40" y="50" font-size="27" font-weight="700">World 小地图 · 关键点位精简</text><text x="40" y="82" font-size="15" fill="#b6c2ce">OFFLINE CANVAS-COMMAND REPLAY · real renderer + GLB terrain · not a browser screenshot</text><text x="55" y="126" font-size="21">修改前 / Before</text><text x="505" y="126" font-size="21">修改后 / After</text>${scenes.map((scene, i) => `<text x="40" y="${164 + i * 440}" font-size="18">${scene.title}</text>`).join('')}<text x="40" y="1490" font-size="14" fill="#b6c2ce">White: player · Gold: current quest · Muted symbols: nearby travel / entrance · Synthetic enemies stress density</text></g></svg>`;
await sharp(Buffer.from(headings)).composite(composition).png().toFile(new URL('comparison.png', output).pathname);
writeFileSync(new URL('manifest.json', output), JSON.stringify({
  method: 'Real WorldMap.draw command capture, SVG replay and sharp rasterization; not browser/WebGL validation',
  baselineCommit: baseCommit, currentFiles: ['world/src/map.ts', 'world/src/minimapMarkers.ts'],
  sourceSha256: Object.fromEntries(['src/map.ts', 'src/minimapMarkers.ts', 'validation/minimap-markers.test.ts', 'validation/regression.test.ts', 'validation/minimap/render-preview.ts']
    .map((file) => [`world/${file}`, createHash('sha256').update(readFileSync(new URL(`../../${file}`, import.meta.url))).digest('hex')])),
  terrain: 'Real merged WorldGrid from all five shipped GLBs', scenes,
  fullMapRegression: 'Before/after full-map SVG commands exactly equal in all three scene fixtures',
  caveats: ['Approximate deterministic text metrics; font rasterization can differ from browser', '16 synthetic live enemies per scene for density stress, not claimed gameplay positions', 'Pulse frozen at performance.now() = 0', 'Circle and border reproduce existing CSS'],
}, null, 2));
console.log(new URL('comparison.png', output).pathname);
