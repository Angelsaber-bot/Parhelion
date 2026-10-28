/**
 * Offline diagnostic only: execute the real before/after Canvas draw methods,
 * replay their commands to SVG, then rasterize with sharp. Not a browser/WebGL
 * screenshot. Terrain comes from the shipped GLBs through the real WorldGrid.
 * Run from world/: node --import tsx validation/full-map/render-preview.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { transformSync } from 'esbuild';
import sharp from 'sharp';
import { WorldMap } from '../../src/map';
import { WorldGrid } from '../../src/grid';
import { regionLoader, bakeQuantized } from '../../src/glb';
import { GRID, REGIONS, mergeLayouts } from '../../src/regions';
import * as miniRules from '../../src/minimapMarkers';
import * as regionRules from '../../src/regions';
import { localizeText, setLanguage } from '../../../shared-client/i18n';
import type { Layout } from '../../src/types';

const output = new URL('../../../docs/world-full-map/', import.meta.url);
mkdirSync(output, { recursive: true });
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

class RecordingCanvas {
  width = 1200;
  height = 1200;
  clientWidth = 720;
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
    const size = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 18);
    return { width: [...text].reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? size : size * 0.55), 0) };
  }
  text(text: string, x: number, y: number, stroke: boolean, maxWidth?: number) {
    const size = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 18);
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
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.clientWidth}" height="${this.clientWidth}" viewBox="0 0 ${this.width} ${this.height}">${this.elements.join('')}</svg>`;
  }
}

const documentStub = { documentElement: {}, createElement: () => new RecordingCanvas() };
Object.assign(globalThis, { document: documentStub });
Object.defineProperty(performance, 'now', { value: () => 0 });
const baseCommit = '5c90ffa421b33163f8248db55c15e9ebf7ead428';
const oldSource = readFileSync(new URL('../map-qa/5c90ffa-map.ts.txt', import.meta.url), 'utf8');
const compiled = transformSync(oldSource, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
const legacyModule: { exports: Record<string, unknown> } = { exports: {} };
runInNewContext(compiled, { module: legacyModule, exports: legacyModule.exports, require: (name: string) => {
  if (name === 'three') return THREE;
  if (name === '../../shared-client/i18n') return { localizeText };
  if (name === './minimapMarkers') return miniRules;
  if (name === './regions') return regionRules;
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
const target = layout.markers.find(m => m.id === 'hq_terminal')!.p;
const scenes = [
  { id: 'initial-quest', title: '新开局 · 当前任务 / Initial quest', player: [3, 159], target: [target[0], target[2]], width: 720, language: 'zh' as const, unlocked: false },
  { id: 'compact', title: '320 CSS px · 1200 backing', player: [3, 159], target: [target[0], target[2]], width: 320, language: 'en' as const, unlocked: false },
  { id: 'arrived', title: 'Unlocked / arrived at quest', player: [360, 30], target: [360, 30], width: 720, language: 'en' as const, unlocked: true },
];
const composition: sharp.OverlayOptions[] = [];
const counts: unknown[] = [];
for (const scene of scenes) {
  setLanguage(scene.language);
  for (const [column, [label, renderer]] of [['before', before], ['after', current]].entries()) {
    const ctx = new RecordingCanvas(); ctx.clientWidth = scene.width;
    renderer.draw(ctx as unknown as CanvasRenderingContext2D, new THREE.Vector3(scene.player[0], 0, scene.player[1]), .45,
      { full: true, done: new Set(scene.unlocked ? ['summon_circle'] : []), found: new Set(), target: scene.target as [number, number] });
    const png = await sharp(Buffer.from(ctx.svg())).png().toBuffer();
    writeFileSync(new URL(`${scene.id}-${label}.png`, output), png);
    if (scene.id === 'initial-quest') composition.push({ input: png, left: 20 + column * 740, top: 140 });
    counts.push({ scene: scene.id, version: label, textDraws: ctx.elements.filter(e => e.startsWith('<text') && !e.includes('fill="none"')).length,
      filledPaths: ctx.elements.filter(e => e.startsWith('<path') && !e.includes('fill="none"')).length });
  }
}
const headings = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="920"><rect width="1500" height="920" fill="#111923"/><g fill="#e6edf5" font-family="Noto Sans CJK SC, sans-serif"><text x="20" y="40" font-size="27" font-weight="700">M 完整地图 · 只保留导航关键点位</text><text x="20" y="72" font-size="15" fill="#b6c2ce">OFFLINE CANVAS-COMMAND REPLAY · actual renderer + unchanged five-region GLB terrain · not browser validation</text><text x="20" y="117" font-size="21">修改前 / Before</text><text x="760" y="117" font-size="21">修改后 / After</text><text x="20" y="895" font-size="16" fill="#b6c2ce">White: player · Gold: active quest · Muted: existing travel / chapter entrances · Crossbar: chapter still locked</text></g></svg>`;
await sharp(Buffer.from(headings)).composite(composition).png().toFile(new URL('comparison.png', output).pathname);
writeFileSync(new URL('manifest.json', output), JSON.stringify({
  method: 'Real WorldMap.draw commands replayed to SVG and rasterized with sharp; not browser/WebGL validation',
  baselineCommit: baseCommit, currentFiles: ['world/src/map.ts', 'world/src/fullMapPresentation.ts', 'world/index.html'],
  sourceSha256: Object.fromEntries(['src/map.ts', 'src/fullMapPresentation.ts', 'validation/full-map-qa.test.ts', 'validation/full-map/render-preview.ts']
    .map(file => [`world/${file}`, createHash('sha256').update(readFileSync(new URL(`../../${file}`, import.meta.url))).digest('hex')])),
  terrain: 'Unchanged real merged WorldGrid from all five shipped GLBs', scenes, counts,
  caveats: ['Deterministic approximate text metrics; browser glyph metrics can differ', 'No synthetic enemy input; includes actual authored static markers', 'Pulse frozen at performance.now() = 0', 'HUD stacking is source-checked, not browser-validated'],
}, null, 2));
console.log(new URL('comparison.png', output).pathname);
