import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { makeGrassField, makeSunShafts, enhanceWater, makeUpdrafts, makeAmbientParticles } from './fx';
import { toonMaterial, addOutline, makeSky, timeUniform } from './look';
import { Player, PLAYER, type Collider } from './player';
import { WorldMap } from './map';
import type { Layout, Marker } from './types';
import { loadLayout } from './load';
import { buildCharacter, CharacterAnimator } from './character';
import { attachExplorerRifle } from './weaponArt';
import { ShoulderAim, shoulderArmLength } from './aim';
import { SettingsStore, createSettingsPanel } from '../../shared-client/settings';
import '../../shared-client/settings.css';
import { REGIONS, GRID, GATES, mergeLayouts, boundaryWalls, regionAt } from './regions';
import { BOSSES } from './combat';
import { WorldGrid } from './grid';
import { chunkMesh, DistanceCuller } from './chunk';
import { regionLoader, bakeQuantized } from './glb';
import { KingdomTwilight } from './twilight';
import { FirstContract } from './contracts';
import { ContractServant } from './servant';
import { ServantAppearance } from './servantAppearance';
import { createServantPanel } from './servantPanel';
import { WorldCombat } from './combatView';
import { bilingual, localizeText, localizeDom, createLanguageToggle, onLanguageChange } from '../../shared-client/i18n';

const params = new URLSearchParams(location.search);
const requestedFov = Number(params.get('fov'));
const baseFov = THREE.MathUtils.clamp(params.has('fov') && Number.isFinite(requestedFov) ? requestedFov : 75, 40, 110);
// One open world: 幻日谷 + 落日王国 (west seam) + 黑帆尽头 (east pass) + 永冬之城 (north ice seam).
// ?region=britain|blacksail|winter starts there.
const startRegion = REGIONS.find((r) => r.id === params.get('region'))?.id ?? 'alpha';
// Quality: ?q=low | med (default) | high. high adds GTAO + 4x MSAA + denser grass.
const quality = (['low', 'med', 'high'] as const).find((q) => q === params.get('q')) ?? 'med';
const lowQ = quality === 'low', highQ = quality === 'high';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let bootFailed = false;
let disposeRenderer = () => {};
const languageToggle = createLanguageToggle();
let refreshWorldLocale = () => {};
let loadingSource = '加载中…';
const setLoading = (source: string) => { loadingSource = source; $('loading').textContent = localizeText(source); };
localizeDom(document.body);
onLanguageChange(() => {
  localizeDom(document.body);
  $('loading').textContent = localizeText(loadingSource);
  refreshWorldLocale();
});

async function boot() {

// ───────────── renderer / scene ─────────────
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: params.has('shot') });
disposeRenderer = () => renderer.dispose();
const maxDpr = Math.min(devicePixelRatio, highQ ? 2 : lowQ ? 1 : 1.25);
let dpr = maxDpr;
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; // keeps anime saturation, unlike ACES
renderer.toneMappingExposure = 0.98;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c4e2f6', 120, 720);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1300);
const sky = makeSky();
scene.add(sky);
const hemisphere = new THREE.HemisphereLight('#d6ecff', '#9aa98a', 1.15);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight('#fff0d2', 2.7);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(lowQ ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const twilight = new KingdomTwilight(sky, sun, hemisphere, scene);
const caveLight = new THREE.PointLight('#7ff6ff', 60, 26, 1.6); // hidden cave glow
caveLight.position.set(182, 6, -60);
scene.add(caveLight);

// post: MSAA → GTAO (high only) → bloom → sun shafts → output.  ?nopost disables, ?q=low keeps bloom only
const composer = params.has('nopost') ? null : new EffectComposer(renderer, new THREE.WebGLRenderTarget(
  innerWidth * dpr, innerHeight * dpr, { samples: highQ ? 4 : lowQ ? 0 : 2, type: THREE.HalfFloatType }));
const shafts = makeSunShafts();
if (composer) {
  composer.addPass(new RenderPass(scene, camera));
  if (highQ) {
    const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 0.6 });
    ao.blendIntensity = 0.75;
    composer.addPass(ao);
  }
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.45, 0.97));
  if (!lowQ) composer.addPass(shafts.pass);
  composer.addPass(new OutputPass());
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
});

// ───────────── load: every region into one scene ─────────────
const loaded = new Map<string, number>();
const progress = (file: string) => (e: ProgressEvent) => {
  if (bootFailed || !e.lengthComputable || !e.total) return;
  loaded.set(file, e.loaded / e.total);
  setLoading(`加载地图… ${Math.round([...loaded.values()].reduce((a, b) => a + b, 0) / REGIONS.length * 100)}%`);
};
const parts = await Promise.all(REGIONS.map(async (def) => {
  const [lay, gltf] = await Promise.all([
    loadLayout(`./assets/${def.file}.layout.json`),
    regionLoader().loadAsync(`./assets/${def.file}.glb`, progress(def.file)),
  ]);
  for (const name of ['ART', 'COLLISION', 'Terrain']) {
    if (!gltf.scene.getObjectByName(name)) throw new Error(bilingual(`地图模型缺少 ${name} 节点`, `Map model is missing the ${name} node`));
  }
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(def.offset[0], 0, def.offset[1]);
  return { def, layout: lay, root: gltf.scene };
}));
const layout = mergeLayouts(parts);
const world = new THREE.Group();
world.name = 'World';
for (const p of parts) world.add(p.root);
scene.add(world);
world.updateMatrixWorld(true);
document.title = 'Parhelion · World Alpha';
for (const l of layout.lights ?? []) {
  const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 1.6);
  pl.position.set(...l.p);
  scene.add(pl);
}

const byName = (n: string) => world.getObjectByName(n) as THREE.Mesh | undefined;
const targets: THREE.Mesh[] = [];
const artMeshes: THREE.Mesh[] = [];
const terrains: THREE.Mesh[] = [];
const spinners: THREE.Mesh[] = [], stateful: THREE.Mesh[] = [], bobbers: THREE.Mesh[] = [];
for (const p of parts) {
  const mk = p.root.getObjectByName('MARKERS');
  if (mk) mk.visible = false;
  p.root.getObjectByName('ART')!.traverse((o) => { if ((o as THREE.Mesh).isMesh) artMeshes.push(o as THREE.Mesh); });
}
// 黑帆尽头's large sea plane covers every region; drop the others so water never doubles up
const waters = artMeshes.filter((m) => m.name === 'Water');
const waterMesh = waters.reduce((a, b) => ((a.geometry.boundingSphere ?? (a.geometry.computeBoundingSphere(), a.geometry.boundingSphere!)).radius >=
  (b.geometry.boundingSphere ?? (b.geometry.computeBoundingSphere(), b.geometry.boundingSphere!)).radius ? a : b));
for (const w of waters) if (w !== waterMesh) w.parent?.remove(w);
const culler = new DistanceCuller(lowQ ? 90 : 160);
const DRAW_DIST: Record<string, number> = { Bushes: 180, Trees_Leaves: 380, Trees_Trunks: 260, Rocks: 320, Lamps: 240, Glow_Props: 500, Terrain: 760 };
for (const m of artMeshes) {
  if (m.name === 'Water' && m !== waterMesh) continue;
  if (m.name === 'Terrain') terrains.push(m);
  m.material = toonMaterial(m.material as THREE.Material);
  m.receiveShadow = true;
  m.castShadow = !['Terrain', 'Water', 'Waterfall', 'Bushes', 'Glow_Props'].includes(m.name) && (m.material as THREE.Material).name !== 'M_Beam';
  if ((m.material as THREE.Material).name === 'M_Beam') m.receiveShadow = false;
  if (m.name.startsWith('TGT_')) {
    targets.push(m);
    // a target that must be shot from a spot (the fort cannon): that spot is region-local, make it world
    const near = m.userData.near as [number, number] | undefined;
    const part = parts.find((p) => { let o: THREE.Object3D | null = m; while (o && o !== p.root) o = o.parent; return !!o; });
    if (near && part) m.userData.nearWorld = [near[0] + part.def.offset[0], near[1] + part.def.offset[1]];
  }
  // spinning pieces are exported in region space: move their pivot to the mesh origin
  if (m.userData.spin && Array.isArray(m.userData.pivot)) {
    const [px, pz] = m.userData.pivot as [number, number];
    m.geometry.translate(-px, 0, -pz);
    m.position.set(px, 0, pz);
    spinners.push(m);
  }
  if (m.userData.showWhen || m.userData.hideWhen) stateful.push(m);
  if (m.userData.bob) bobbers.push(m);
  const special = m.name === 'Water' || m.name.startsWith('TGT_') || m.userData.spin || m.userData.showWhen || m.userData.hideWhen || m.userData.bob || m.userData.dynamic;
  const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const pieces = !special && tris > 4000 ? chunkMesh(m, 64) : [m];
  for (const c of pieces) {
    if (m.userData.outline && !params.has('noline')) addOutline(c);
    if (pieces.length > 1) culler.add(c, DRAW_DIST[m.name] ?? 1e9);
  }
}

// colliders: everything static merged into one BVH; dynamic pieces (door, targets) keep their own
const colliders: Collider[] = [];
const gates: { name: string; opensWhen: string[] }[] = [];
const solids: { name: string; solidWhen: string[] }[] = []; // e.g. the ghost bridge: walkable once it appears
const staticGeos: THREE.BufferGeometry[] = [boundaryWalls()];
const debugCol = new THREE.Group();
const debugMat = new THREE.MeshBasicMaterial({ color: '#ff3d7f', wireframe: true, transparent: true, opacity: 0.35 });
for (const p of parts) p.root.getObjectByName('COLLISION')!.traverse((o) => {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return;
  m.visible = false;
  let g = new THREE.BufferGeometry().setAttribute('position', m.geometry.attributes.position.clone());
  if (m.geometry.index) g.setIndex(m.geometry.index.clone());
  g.applyMatrix4(m.matrixWorld);
  if (g.index) g = g.toNonIndexed();
  if (m.userData.dynamic) colliders.push({ name: m.name, bvh: new MeshBVH(g), enabled: true });
  else staticGeos.push(g);
  if (Array.isArray(m.userData.opensWhen)) gates.push({ name: m.userData.art as string, opensWhen: m.userData.opensWhen as string[] });
  if (Array.isArray(m.userData.solidWhen)) solids.push({ name: m.userData.art as string, solidWhen: m.userData.solidWhen as string[] });
});
const staticGeo = mergeGeometries(staticGeos);
const staticBVH = new MeshBVH(staticGeo);
colliders.unshift({ name: 'static', bvh: staticBVH, enabled: true });

const grid = new WorldGrid(terrains, GRID.x0, GRID.z0, GRID.span, GRID.cell, '#4f8fa8', GRID.spanZ);
if (!lowQ) enhanceWater(waterMesh.material as THREE.Material, grid, layout.world.waterLevel);
const grass = !lowQ && !params.has('nograss') ? makeGrassField(grid, staticBVH, layout.world.waterLevel, { count: highQ ? 160000 : 80000, size: highQ ? 90 : 68 }) : null;
if (grass) scene.add(grass.mesh);
scene.add(makeUpdrafts(layout.updrafts ?? []));
const ambient = lowQ ? null : makeAmbientParticles(highQ ? 1600 : 900);
if (ambient) scene.add(ambient.points);
debugCol.add(new THREE.Mesh(staticGeo, debugMat));
debugCol.visible = false;
scene.add(debugCol);

const collider = (name: string) => colliders.find((c) => c.name === name);
const markers = new Map<string, Marker>(layout.markers.map((m) => [m.id, m]));
const map = new WorldMap(grid, layout);
const objectiveFor = (x: number, z: number) => layout.objectives.find((o) => o.region === regionAt(x, z).id)!.objective;

// ───────────── progress (local, per browser) ─────────────
const SAVE_KEY = 'parhelion.world.progress.v2';
const done = new Set<string>();
const found = new Set<string>();
// v1 saves were per region; fold them in once (marker ids are unique across regions except spawns)
for (const key of [SAVE_KEY, 'parhelion.world_alpha.progress.v1', 'parhelion.world_coast.progress.v1']) {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? '{}');
    (s.done ?? []).forEach((x: string) => done.add(x));
    (s.found ?? []).forEach((x: string) => found.add(x));
  } catch { /* storage unavailable */ }
}
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ done: [...done], found: [...found] })); } catch { /* ignore */ } };

const haloMat = (byName('Tower_Halo')?.material as THREE.MeshBasicMaterial | undefined);
function applyWorldState() {
  for (const t of targets) {
    const id = t.userData.target as string;
    const hit = done.has(id);
    t.visible = !hit;
    const c = collider(`COL_${t.name}`); if (c) c.enabled = !hit;
  }
  // doors and gates: a dynamic piece with opensWhen disappears (art + collider) once all ids are done
  for (const g of gates) {
    const open = g.opensWhen.every((x) => done.has(x));
    const art = byName(g.name); if (art) art.visible = !open;
    const c = collider(`COL_${g.name}`); if (c) c.enabled = !open;
  }
  for (const g of solids) { const c = collider(`COL_${g.name}`); if (c) c.enabled = g.solidWhen.every((x) => done.has(x)); }
  if (haloMat) haloMat.color.setScalar(done.has('tower_console') ? 1 : 0.32);
  for (const m of stateful) {
    const sw = m.userData.showWhen as string | string[] | undefined;
    const show = sw ? [sw].flat().every((x) => done.has(x)) : true;
    const hide = m.userData.hideWhen ? done.has(m.userData.hideWhen as string) : false;
    m.visible = show && !hide;
  }
  renderObjective();
}

// ───────────── quest guide (G): waypoint to the next objective, beacon pillar, map marker ─────────────
let guideOn = true;
try { guideOn = localStorage.getItem('parhelion.guide') !== 'off'; } catch { /* storage unavailable */ }
const guideBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.9, 1.4, 70, 16, 1, true).translate(0, 35, 0),
  new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
);
guideBeam.raycast = () => {};
scene.add(guideBeam);
function toggleGuide() {
  guideOn = !guideOn;
  try { localStorage.setItem('parhelion.guide', guideOn ? 'on' : 'off'); } catch { /* ignore */ }
  toast(guideOn ? '任务指引 开' : '任务指引 关');
}
/** Next objective marker: current region first; another region's goal routes through its gate via 幻日谷. */
const REGION_NAME: Record<string, string> = { alpha: '幻日谷', britain: '落日王国', blacksail: '黑帆尽头', winter: '永冬之城' };
function guideTarget(): { p: [number, number, number]; label: string } | null {
  const here = regionAt(player.pos.x, player.pos.z).id;
  const order = [...layout.objectives].sort((a, b) => (a.region === here ? -1 : 0) - (b.region === here ? -1 : 0));
  for (const o of order)
    for (const s of o.objective.steps) {
      const left = s.done.filter((id) => !done.has(id)).map((id) => markers.get(id)!).filter(Boolean);
      if (!left.length) continue;
      if (o.region !== here) {
        // leave through this region's own gate, or from 幻日谷 head for the target region's gate
        const gate = here === 'alpha' ? GATES[o.region] : GATES[here];
        const to = here === 'alpha' ? o.region : 'alpha';
        if (gate) return { p: gate.p, label: bilingual(`前往${REGION_NAME[to] ?? to}（${gate.via}）`, `Travel to ${localizeText(REGION_NAME[to] ?? to)} (${localizeText(gate.via)})`) };
      }
      // markers that can be used now come first (e.g. the dummies before the shard they unlock)
      const ready = (m: Marker) => (m.requires ?? []).every((r) => done.has(r)) ? 0 : 1;
      left.sort((a, b) => ready(a) - ready(b) || Math.hypot(a.p[0] - player.pos.x, a.p[2] - player.pos.z) - Math.hypot(b.p[0] - player.pos.x, b.p[2] - player.pos.z));
      return { p: left[0].p, label: left[0].label };
    }
  return null;
}
const _gv = new THREE.Vector3();
function updateGuide(t: { p: [number, number, number]; label: string } | null, now: number) {
  const el = $('guide');
  guideBeam.visible = !!t;
  el.classList.toggle('on', !!t && !$('bigmap').classList.contains('open'));
  if (!t) return;
  guideBeam.position.set(t.p[0], t.p[1], t.p[2]);
  (guideBeam.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.06 * Math.sin(now / 300);
  const d = Math.hypot(t.p[0] - player.pos.x, t.p[1] - player.pos.y, t.p[2] - player.pos.z);
  (el.querySelector('.dist') as HTMLElement).textContent = `${Math.round(d)} m`;
  (el.querySelector('.label') as HTMLElement).textContent = localizeText(t.label);
  _gv.set(t.p[0], t.p[1] + 2.2, t.p[2]).project(camera);
  const behind = _gv.z > 1;
  let sx = _gv.x, sy = _gv.y;
  if (behind) { sx = -sx; sy = -sy; }
  const m = Math.max(Math.abs(sx), Math.abs(sy));
  const edge = behind || m > 0.92;
  if (edge) { const k = 0.88 / Math.max(m, 1e-3); sx *= k; sy *= k; if (behind && Math.abs(sy) < 0.5) sy = -0.88; }
  el.classList.toggle('edge', edge);
  (el.querySelector('.arrow') as HTMLElement).style.transform = `rotate(${Math.atan2(sx, sy)}rad)`;
  el.style.left = `${(sx * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-sy * 0.5 + 0.5) * innerHeight}px`;
}

function renderObjective() {
  const objective = objectiveFor(player.pos.x, player.pos.z);
  const steps = objective.steps;
  let current = false;
  const rows = steps.map((s) => {
    const ok = s.done.every((x) => done.has(x));
    let cls = ok ? 'done' : '';
    if (!ok && !current) { cls = 'cur'; current = true; }
    const extra = s.done.length > 1 && !ok ? ` (${s.done.filter((x) => done.has(x)).length}/${s.done.length})` : '';
    return `<div class="${cls}">${ok ? '✓' : '◇'} ${localizeText(s.text)}${extra}</div>`;
  });
  const disc = layout.markers.filter((m) => m.type === 'discovery');
  $('objective').innerHTML =
    `<h3>${localizeText(objective.name)}</h3>${rows.join('')}` +
    `<div style="margin-top:6px;opacity:.75">${localizeText('隐藏发现')} ${disc.filter((d) => found.has(d.id)).length}/${disc.length}</div>`;
}

let toastTimer = 0;
function toast(text: string) {
  const el = $('toast');
  el.textContent = localizeText(text);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
}

let areaTimer = 0;
let currentArea = '';
function showArea(a: Layout['areas'][number]) {
  const el = $('area');
  (el.querySelector('.zh') as HTMLElement).textContent = localizeText(a.name);
  (el.querySelector('.en') as HTMLElement).textContent = bilingual(a.nameEn.toUpperCase(), 'PARHELION WORLD');
  el.classList.add('show');
  clearTimeout(areaTimer);
  areaTimer = window.setTimeout(() => el.classList.remove('show'), 2400);
}

// ───────────── cold (永冬之城): warmth drains away from fires until the winter core is lit ─────────────
const warmSpots = layout.markers.filter((m) => /(^|_)warm_/.test(m.id));
const cold = { warmth: 100, frozen: false, warned: false };
const coldHud = document.createElement('div');
coldHud.id = 'world-cold'; coldHud.className = 'combat-hud'; coldHud.hidden = true;
Object.assign(coldHud.style, { bottom: '172px', left: '18px', width: 'min(220px, 38vw)', fontSize: '12px' });
coldHud.innerHTML = '<span></span><div class="combat-track" style="height:6px;margin-top:4px"><div class="combat-fill" style="background:linear-gradient(90deg,#7fb8ff,#e8fbff)"></div></div>';
const frost = document.createElement('div');
Object.assign(frost.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '3', boxShadow: 'inset 0 0 140px #cfeaff', opacity: '0', transition: 'opacity .3s' });
document.body.append(coldHud, frost);
function updateCold(dt: number) {
  const inWinter = regionAt(player.pos.x, player.pos.z).id === 'winter' && !done.has('winter_core');
  const nearFire = warmSpots.some((m) => (m.requires ?? []).every((r) => done.has(r)) &&
    Math.hypot(player.pos.x - m.p[0], player.pos.y - m.p[1], player.pos.z - m.p[2]) < (m.radius ?? 6));
  if (!inWinter || player.flying || !gameplayActive()) cold.warmth = Math.min(100, cold.warmth + dt * (inWinter ? 0 : 40));
  else cold.warmth = nearFire ? Math.min(100, cold.warmth + dt * 30) : Math.max(0, cold.warmth - dt * 2);
  cold.frozen = inWinter && cold.warmth <= 0;
  if (cold.frozen && !cold.warned) toast(bilingual('冻僵了：走不快也跑不动，快去火堆边取暖', 'Frozen stiff: you can barely move. Find a fire to warm up'));
  cold.warned = cold.frozen || (cold.warned && cold.warmth < 30);
  coldHud.hidden = !inWinter;
  if (inWinter) {
    coldHud.querySelector('span')!.textContent = `${bilingual('体温', 'Warmth')} ${Math.ceil(cold.warmth)}%${nearFire ? bilingual(' · 正在取暖', ' · warming up') : ''}`;
    (coldHud.querySelector('.combat-fill') as HTMLElement).style.width = `${cold.warmth}%`;
  }
  frost.style.opacity = inWinter ? `${Math.max(0, 1 - cold.warmth / 40) * 0.85}` : '0';
}

// ───────────── player / input ─────────────
const player = new Player(colliders, layout.world.waterLevel);
player.updrafts = layout.updrafts ?? [];
const spawn = markers.get(startRegion === 'alpha' ? 'spawn_p1' : `${startRegion}_spawn_p1`) ?? markers.get('spawn_p1')!;
const spawnAt = (areaId?: string) => {
  const a = layout.areas.find((x) => x.id === areaId);
  if (!a) return player.teleport(spawn.p[0], spawn.p[1] + 1, spawn.p[2], 0);
  const y = staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(a.tp[0], 300, a.tp[1]), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 40;
  // face the area's centre
  player.teleport(a.tp[0], y + 0.5, a.tp[1], Math.atan2(-(a.c[0] - a.tp[0]), -(a.c[1] - a.tp[1])));
};
spawnAt(params.get('spawn') ?? undefined);

// explorer character + third-person shoulder camera
const charMat = toonMaterial(Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true }), { name: 'M_Toon' }));
const rig = buildCharacter(charMat);
rig.meshes.forEach((m) => { m.receiveShadow = true; if (!params.has('noline')) addOutline(m, 0.012); });
scene.add(rig.root);
const rifle = attachExplorerRifle(rig, renderer);
addEventListener('pagehide', (e) => { if (!e.persisted) rifle.dispose(); });
const anim = new CharacterAnimator(rig);
anim.facing = player.yaw + Math.PI;
const thirdPerson = !params.has('cam'); // gameplay is TPS; fixed-camera screenshots remain a debug mode
let camDist = 3.6;
const prevPos = player.pos.clone();

const contractStorage = (() => { try { return localStorage; } catch { return undefined; } })();
const contract = new FirstContract(done, contractStorage);
const servantAppearance = new ServantAppearance(contractStorage);
const servant = new ContractServant({ scene, renderer, marker: markers.get('saber_contract')!, contract, appearance: servantAppearance, colliders,
  target: (position) => { const hit = combat.allyTarget(position); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
  strike: (position, targetId) => { const hit = combat.allyStrike(position, 3.5, 14, targetId); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
});
const servantPanel = createServantPanel(servant, contract, () => { clearInput(); if (document.pointerLockElement) document.exitPointerLock(); });
const contractCard = document.createElement('div');
contractCard.id = 'contract-card'; contractCard.className = 'hud';
Object.assign(contractCard.style, { right: '18px', top: '222px', width: '230px', padding: '12px', borderRadius: '12px',
  background: 'rgba(20,30,52,.85)', color: '#f8eaca', fontSize: '12px', lineHeight: '1.6' });
document.body.append(contractCard);
function renderContract() {
  servantPanel.render();
  const state = servant.status;
  const hint = contract.recruited ? bilingual(`[${settings.label('summon')}] 召唤／收回 · 近身协助攻击`, `[${settings.label('summon')}] Summon / recall · Close-range assistance`)
    : bilingual('前往圣剑湖，与第一位契约从者会面', 'Visit Sword Lake to meet your first contracted servant');
  const next = `${state}\n${hint}`;
  if (contractCard.textContent !== next) contractCard.textContent = next;
  contractCard.style.whiteSpace = 'pre-line';
}
addEventListener('pagehide', (event) => { if (!event.persisted) { servantPanel.dispose(); servant.dispose(); } });
function resetProgress() {
  done.clear(); found.clear(); contract.reset(); combat.reset(); save(); applyWorldState();
}
const keys = new Set<string>();
const aim = new ShoulderAim();
const settings = new SettingsStore('world');
let locked = false;
const start = $('start');
const clearInput = () => { keys.clear(); aim.clear(); };
const settingsPanel = createSettingsPanel(settings, {
  onOpen() { clearInput(); if (document.pointerLockElement) document.exitPointerLock(); },
  onClose() { clearInput(); },
});
$('settings-open').addEventListener('click', (e) => { e.stopPropagation(); settingsPanel.show(); });
const gameplayActive = () => locked && !settingsPanel.open && document.visibilityState === 'visible' && document.hasFocus() && !$('bigmap').classList.contains('open');
const down = (action: string) => settings.isDown(keys, action);
function renderControlHints() {
  const k = (action: string) => settings.label(action);
  const moves = `${k('forward')}/${k('left')}/${k('back')}/${k('right')}`;
  const teleports = [1,2,3,4,5,6,7].map((n) => k(`teleport${n}`)).join('/');
  $('help').textContent = bilingual(
    `${moves} 移动 · ${k('sprint')} 奔跑 · ${k('jump')} 跳／空中滑翔\n${k('fire')} 射击 · ${k('aim')} 按住肩射瞄准 · ${k('interact')} 互动\n${k('summon')} 召唤／收回从者 · ${k('map')} 大地图 · ${k('guide')} 任务指引 · ${k('help')} 帮助 · ${k('settings')} 设置 · Esc 释放鼠标\n${k('fly')} 自由飞行调试（随镜头俯仰升降） · ${k('collision')} 碰撞体 · ${teleports} 调试传送 · ${k('reset')} 重置进度`,
    `${moves} Move · ${k('sprint')} Sprint · ${k('jump')} Jump / glide in air\n${k('fire')} Fire · ${k('aim')} Hold shoulder aim · ${k('interact')} Interact\n${k('summon')} Summon / recall Servant · ${k('map')} World map · ${k('guide')} Quest guide · ${k('help')} Help · ${k('settings')} Settings · Esc Release mouse\n${k('fly')} Free-flight test (camera pitch controls altitude) · ${k('collision')} Colliders · ${teleports} Debug teleport · ${k('reset')} Reset progress`);

}
settings.subscribe(() => { clearInput(); renderControlHints(); }); renderControlHints();
const lockError = () => {
  if (locked) return;
  clearInput();
  setLoading('无法锁定鼠标，请再次点击进入（或检查浏览器权限）');
  start.classList.remove('hidden');
};
setLoading('点击进入（ESC 释放鼠标）');
start.addEventListener('click', async () => {
  if (settingsPanel.open) return;
  try { await canvas.requestPointerLock(); } catch { lockError(); }
});
document.addEventListener('pointerlockerror', lockError);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  clearInput();
  if (!locked) $('bigmap').classList.remove('open');
  else setLoading('点击进入（ESC 释放鼠标）');
  start.classList.toggle('hidden', locked);
  $('settings-open').classList.toggle('hidden', locked);
  languageToggle.hidden = locked;
});
document.addEventListener('mousemove', (e) => {
  if (!gameplayActive()) return;
  const sensitivity = .0022 * settings.value.sensitivity * (1 + (settings.value.adsSensitivity - 1) * aim.value);
  player.yaw -= e.movementX * sensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * sensitivity * (settings.value.invertY ? -1 : 1), -1.5, 1.5);
});
function press(binding: string, repeat = false) {
  const action = settings.action(binding);
  if (!action || !locked || settingsPanel.open || document.visibilityState !== 'visible' || !document.hasFocus()) return;
  if (action === 'settings') { if (!repeat) settingsPanel.show(); return; }
  if (action === 'map') {
    if (!repeat) { clearInput(); $('bigmap').classList.toggle('open'); }
    return;
  }
  if (!gameplayActive() || combat.defeated) return;
  if (repeat) return;
  keys.add(binding);
  if (action === 'aim') aim.held = true;
  if (action === 'fire') shoot();
  if (action === 'fly') { clearInput(); player.flying = !player.flying; toast(player.flying ? '自由飞行调试 开 · 抬头前进上升，低头前进下降' : '自由飞行调试 关 · 恢复跳跃／滑翔'); }
  if (action === 'collision') { debugCol.visible = !debugCol.visible; toast(debugCol.visible ? '显示碰撞体' : '隐藏碰撞体'); }
  if (action === 'guide') toggleGuide();
  if (action === 'help') $('help').style.display = $('help').style.display === 'none' ? '' : 'none';
  if (action === 'interact' && !player.flying) interact();
  if (action === 'summon') {
    if (contract.toggle()) toast(contract.summoned ? bilingual('Saber 已召唤', 'Saber summoned') : bilingual('Saber 已收回', 'Saber recalled'));
    else toast(bilingual('先前往圣剑湖缔结第一份契约', 'Form your first contract at Sword Lake'));
  }
  if (action === 'reset' && !down('sprint')) { resetProgress(); toast('进度已重置'); }
  if (action.startsWith('teleport')) {
    clearInput(); const n = Number(action.slice('teleport'.length));
    const here = layout.areas.filter((a) => a.region === regionAt(player.pos.x, player.pos.z).id);
    if (n >= 1 && n <= here.length) spawnAt(here[n - 1].id);
  }
}
function release(binding: string) { keys.delete(binding); if (settings.action(binding) === 'aim') aim.held = down('aim'); }
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) { clearInput(); return; }
  if (!settingsPanel.open && locked && settings.action(e.code)) e.preventDefault();
  press(e.code, e.repeat);
});
addEventListener('keyup', (e) => release(e.code));
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('auxclick', (e) => { if (locked || settingsPanel.open) e.preventDefault(); });
addEventListener('mousedown', (e) => { if (!settingsPanel.open && locked) { e.preventDefault(); press(`Mouse${e.button}`); } });
addEventListener('mouseup', (e) => release(`Mouse${e.button}`));
addEventListener('wheel', (e) => {
  if (!gameplayActive()) return;
  e.preventDefault(); const binding = e.deltaY > 0 ? 'WheelDown' : 'WheelUp'; press(binding); release(binding);
}, { passive: false });

// ───────────── shooting (hitscan + visible bounded projectiles) ─────────────
const combat = new WorldCombat({ scene, colliders, layout, done, toast,
  onVictory(core) { done.add(core); save(); applyWorldState(); },
  onPlayerDefeated() { spawnAt(); clearInput(); toast(bilingual('已回到安全地点 · 任务进度保留', 'Returned to safety · Quest progress kept')); },
});
addEventListener('pagehide', (event) => { if (!event.persisted) combat.dispose(); });
const ray = new THREE.Raycaster();
function shoot() {
  if (!gameplayActive() || player.flying || !combat.canShoot()) return;
  const targetCollider = (c: Collider) => c.name.startsWith('COL_TGT_');
  const origin = camera.position.clone();
  const look = camera.getWorldDirection(new THREE.Vector3());
  ray.set(origin, look); ray.far = 150;
  // Target meshes have matching dynamic colliders for movement/LOS, but a
  // target hit must not be reclassified as a wall during the muzzle check.
  const wall = combat.geometry.cast(origin,look,150,targetCollider);
  const wallDist = wall?.distance ?? 150;
  const target = ray.intersectObjects(targets.filter((t) => t.visible), false)[0];
  const questHit = target && target.distance <= wallDist + .04 ? target : undefined;
  const enemy = combat.raycast(origin,look,Math.min(wallDist,questHit?.distance ?? 150));
  let point = enemy ? new THREE.Vector3(enemy.point.x,enemy.point.y,enemy.point.z)
    : questHit ? questHit.point.clone() : wall ? wall.point.clone() : origin.clone().addScaledVector(look,150);
  rig.root.updateMatrixWorld(true);
  const muzzle = rifle.muzzleWorld();
  // Shoulder-camera aim selects the target, but the actual bullet must have a clear muzzle path.
  const shoulder = player.pos.clone().add(new THREE.Vector3(0,1.3,0));
  const toMuzzle = muzzle.clone().sub(shoulder);
  const blockedMount = combat.geometry.cast(shoulder,toMuzzle,toMuzzle.length(),targetCollider);
  const shotDirection = point.clone().sub(muzzle), shotDistance = shotDirection.length();
  const blocked = combat.geometry.cast(muzzle,shotDirection,Math.max(0,shotDistance - .06),targetCollider);
  let hitSomething = !!(wall || questHit || enemy);
  if (blockedMount || blocked) {
    point = (blockedMount ?? blocked)!.point.clone(); hitSomething = true;
  } else if (enemy) {
    combat.damageEnemy(enemy.id);
  } else if (questHit && questHit.object.userData.needs && !done.has(questHit.object.userData.needs as string)) {
    toast(bilingual('子弹打不了那么远 · 先去装填要塞大炮', 'Bullets cannot reach that far · Load the fort cannon first'));
  } else if (questHit && questHit.object.userData.nearWorld &&
    Math.hypot(player.pos.x - (questHit.object.userData.nearWorld as number[])[0], player.pos.z - (questHit.object.userData.nearWorld as number[])[1]) > (questHit.object.userData.nearR as number ?? 8)) {
    toast(bilingual('回到炮位，用大炮瞄准幽灵小艇', 'Return to the gun deck and aim the cannon at the ghost boats'));
  } else if (questHit) {
    const id = questHit.object.userData.target as string;
    done.add(id);
    const group = id.replace(/_\d+$/, '');
    const n = [1, 2, 3].filter((k) => done.has(`${group}_${k}`)).length;
    if (group === 'range_target') toast(n === 3 ? '射击练习完成' : `练习靶命中 ${n}/3`);
    else if (group === 'camp_dummy') toast(n === 3 ? '试炼完成：营帐里出现了王之碎片' : `试炼木人 ${n}/3`);
    else if (group === 'frost_seal') toast(n === 3 ? '三枚冰封印全部碎裂：峡谷里的冰墙崩塌了' : `冰封印击碎 ${n}/3`);
    else if (group === 'ghost_boat') toast(n === 3 ? '幽灵小艇全部击沉：火药库里亮起了海之碎片' : `炮击命中 幽灵小艇 ${n}/3`);
    else toast(n === 3 ? '机关解除：神龛之门打开了' : `机关靶命中 ${n}/3`);
    save(); applyWorldState();
    $('crosshair').classList.add('hit'); setTimeout(() => $('crosshair').classList.remove('hit'),140);
  }
  combat.shot(blockedMount ? shoulder : muzzle,point,hitSomething);
}

// ───────────── interaction / discovery ─────────────
function nearestInteract(): Marker | null {
  let best: Marker | null = null, bd = Infinity;
  for (const m of layout.markers) {
    if (m.type !== 'interact') continue;
    const d = Math.hypot(player.pos.x - m.p[0], player.pos.y - m.p[1], player.pos.z - m.p[2]);
    if (d < (m.radius ?? 3) && d < bd) { bd = d; best = m; }
  }
  return best;
}
function interact() {
  const m = nearestInteract();
  if (!m) return;
  if (done.has(m.id)) return toast(bilingual(`${m.label}：已启动`, `${localizeText(m.label)}: activated`));
  const missing = (m.requires ?? []).filter((r) => !done.has(r));
  if (missing.length) return toast(bilingual(`${m.label}：还需要 ${missing.map((r) => markers.get(r)?.label ?? r).join('、')}`, `${localizeText(m.label)}: requires ${missing.map((r) => localizeText(markers.get(r)?.label ?? '尚未完成的任务')).join(', ')}`));
  if (BOSSES.some((b) => b.core === m.id)) {
    if (!combat.beginBoss(m.id)) toast(bilingual('挑战正在进行 · 射击核心并闪避预警', 'Challenge active · Shoot the core and dodge the tells'));
    return;
  }
  done.add(m.id);
  if (m.id === 'saber_contract') contract.recruit();
  save(); applyWorldState();
  const msg: Record<string, string> = {
    tower_console: '幻日塔重启！光环点亮了整个山谷，三处时层断面同时显现',
    hq_terminal: '调查员身份已登记：世界地图与历史档案已开放',
    armory_rack: '领取 Lumen AR 与弹药，去靶场试试手感',
    seam_west: '西部时层：约 537 年的不列颠，黄昏永远不会结束',
    seam_north: '北方冰海：1812 年的冬天没有尽头',
    seam_east: '东部山口：海风里混着 1718 年的火药味',
    blackbeard_meet: '「哈！又一个被冷灯招来的旱鸭子。」黑胡子答应：点亮海之核，就跟你签约',
    fort_cannon: '大炮装填完毕：站在炮位上，射击海面上的幽灵小艇',
    sea_core: '海之核重新燃起，冷灯熄灭了。风暴正在散去……',
    napoleon_meet: '「你也是被这场冬天困住的人吗？」拿破仑答应：点亮冬之核，就和你签约',
    winter_core: '冬之核重新燃起。雪停了，莫斯科上空第一次看见太阳……',
    napoleon_contract: '契约成立。「不可能？这个词只在傻瓜的字典里。」拿破仑成为你的从者',
    blackbeard_contract: '契约成立。「这片海以后归我们俩了，御主。」黑胡子成为你的从者',
    summon_circle: '召唤阵稳定了。三处时层断面都已打开：西去落日王国，东去黑帆尽头，北去永冬之城',
    saber_contract: '契约成立。「我问你，你就是我的御主吗？」Saber 加入了队伍',
    sun_core: '落日之核重新燃起。永恒的黄昏开始退去……',
    temple_altar: '星辉祭坛亮起，一道光柱直冲云霄',
    lighthouse_lamp: '守望灯塔重新点亮，光束扫过整片海岸',
  };
  if (m.id.startsWith('hall_brazier_')) {
    const n = [1, 2, 3].filter((k) => done.has(`hall_brazier_${k}`)).length;
    return toast(n === 3 ? '三个火盆都燃起来了：圆桌中央浮现出王之碎片' : `火盆点燃 ${n}/3`);
  }
  if (m.id.startsWith('beacon_')) {
    const n = [1, 2, 3].filter((k) => done.has(`beacon_${k}`)).length;
    return toast(n === 3 ? '三座烽火都燃起来了：鹰旗冢上亮起了冬之碎片' : `烽火点燃 ${n}/3 · 火堆旁可以取暖`);
  }
  if (m.id.startsWith('map_piece_')) {
    const n = [1, 2, 3].filter((k) => done.has(`map_piece_${k}`)).length;
    return toast(n === 3 ? '藏宝图拼好了：骷髅礁上的 X 标记亮了起来' : `藏宝图残片 ${n}/3`);
  }
  toast(msg[m.id] ?? (m.id.startsWith('shard_') ? `获得 ${m.label}` : `${m.label} 已启动`));
}
function checkDiscoveries() {
  for (const m of layout.markers) {
    if (m.type !== 'discovery' || found.has(m.id)) continue;
    if (Math.hypot(player.pos.x - m.p[0], player.pos.y - m.p[1], player.pos.z - m.p[2]) < (m.radius ?? 3)) {
      found.add(m.id); save(); renderObjective();
      toast(`发现：${m.label}${m.note ? `（${m.note}）` : ''}`);
    }
  }
}

// ───────────── loop ─────────────
const mini = $<HTMLCanvasElement>('minimap').getContext('2d')!;
const big = ($('bigmap').querySelector('canvas') as HTMLCanvasElement).getContext('2d')!;
const stats = $('stats');
const eye = new THREE.Vector3();
let last = performance.now(), acc = 0, frames = 0, fpsT = 0, fps = 0;
const STEP = 1 / 120;
let lastRegion = '', dynT = 0, dynFrames = 0;

// screenshot / fixed-camera mode: ?cam=x,y,z,yawDeg,pitchDeg&clean
const camParam = params.get('cam')?.split(',').map(Number);
if (camParam) { player.flying = true; player.teleport(camParam[0], camParam[1] - PLAYER.eye, camParam[2], THREE.MathUtils.degToRad(camParam[3] ?? 0)); player.pitch = THREE.MathUtils.degToRad(camParam[4] ?? 0); }
if (params.has('clean')) document.body.classList.add('clean');
if (params.has('nofog')) scene.fog = null;
if (params.has('lit')) done.add('tower_console');
camera.fov = baseFov; camera.updateProjectionMatrix();
applyWorldState();

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  if (!gameplayActive()) { keys.clear(); aim.clear(); }
  const input = {
    x: combat.defeated ? 0 : Number(down('right')) - Number(down('left')),
    z: combat.defeated ? 0 : Number(down('forward')) - Number(down('back')),
    jump: !combat.defeated && down('jump'),
    sprint: !combat.defeated && down('sprint'),
  };
  if (cold.frozen) { input.x *= 0.55; input.z *= 0.55; input.sprint = false; }
  while (acc >= STEP) { player.step(STEP, input); acc -= STEP; }

  const canAim = gameplayActive() && !player.swimming && !player.gliding && !player.flying;
  if (!canAim) for (const binding of settings.bindingsFor('aim')) keys.delete(binding);
  const ads = aim.step(dt, canAim);
  $('movement-mode').textContent = player.flying ? bilingual(`自由飞行调试 · ${settings.label('fly')} 退出`, `Free-flight test · ${settings.label('fly')} Exit`)
    : player.swimming ? bilingual(`游泳 · ${settings.label('jump')} 出水`, `Swimming · ${settings.label('jump')} Leave water`)
    : player.gliding ? bilingual(`滑翔 · ${settings.label('jump')} 收翼 · 上升气流可抬升`, `Gliding · ${settings.label('jump')} Fold glider · Updrafts provide lift`)
    : bilingual(`探索 · ${settings.label('jump')} 跳跃／空中展开滑翔翼`, `Exploring · ${settings.label('jump')} Jump / deploy glider in air`);
  const fov = baseFov + (Math.max(30, baseFov * 2 / 3) - baseFov) * ads;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  $('crosshair').classList.toggle('aiming', ads > 0.7);
  player.eyePos(eye);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  // character: face the movement direction, animate from actual displacement
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const wx = fx * input.z + rx * input.x, wz = fz * input.z + rz * input.x;
  const hs = dt > 0 ? Math.hypot(player.pos.x - prevPos.x, player.pos.z - prevPos.z) / dt : 0;
  prevPos.copy(player.pos);
  rig.root.position.copy(player.pos);
  rig.root.visible = thirdPerson;
  anim.update(dt, { speed: Math.min(hs, 12), onGround: player.onGround, swimming: player.swimming, vy: player.vel.y, moveYaw: ads > 0.05 ? player.yaw + Math.PI : wx || wz ? Math.atan2(wx, wz) : null, gliding: player.gliding, aim: ads, pitch: player.pitch });
  if (thirdPerson) {
    // over-the-shoulder spring arm that pulls in when terrain/walls are in the way
    const look = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const pivot = new THREE.Vector3(player.pos.x + rx * 0.45, player.pos.y + 1.55, player.pos.z + rz * 0.45);
    // keep the pivot under any ceiling (gallery floors, arches) so the arm never starts inside geometry
    const up = staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(player.pos.x, player.pos.y + 1.0, player.pos.z), new THREE.Vector3(0, 1, 0)), THREE.DoubleSide);
    if (up && up.distance < 0.85) pivot.y = Math.max(player.pos.y + 0.9, up.point.y - 0.3);
    // The shoulder offset itself must not start on the other side of a nearby wall.
    const origin = new THREE.Vector3(player.pos.x, pivot.y, player.pos.z);
    const side = pivot.clone().sub(origin), sideLength = side.length();
    const sideHit = staticBVH.raycastFirst(new THREE.Ray(origin, side.clone().normalize()), THREE.DoubleSide);
    if (sideHit && sideHit.distance < sideLength + 0.15) pivot.copy(origin).addScaledVector(side.normalize(), Math.max(0, sideHit.distance - 0.15));
    const back = look.clone().negate();
    const hit = staticBVH.raycastFirst(new THREE.Ray(pivot, back), THREE.DoubleSide);
    const want = shoulderArmLength(ads, player.gliding, hit?.distance);
    camDist = want < camDist ? want : THREE.MathUtils.damp(camDist, want, 6, dt);
    camera.position.copy(pivot).addScaledVector(back, camDist);
    eye.copy(camera.position);
  } else camera.position.copy(eye);
  combat.update(dt, player.pos, gameplayActive() && !player.flying, camera);
  if (down('fire')) shoot();
  servant.update(dt, player.pos, player.yaw, !combat.defeated && !player.flying && !player.swimming && !player.gliding, !gameplayActive());
  renderContract();
  sky.position.copy(eye);
  twilight.update(dt, player.pos.x, done.has('sun_core'), done.has('sea_core'), player.pos.z, done.has('winter_core'));
  updateCold(dt);
  sun.position.copy(eye).addScaledVector(twilight.direction, 200);
  sun.target.position.copy(eye);

  if (haloMat && done.has('tower_console')) haloMat.color.setScalar(0.85 + Math.sin(now / 400) * 0.15);
  for (const m of spinners) m.rotation.y += (m.userData.spin as number) * dt;
  for (const m of bobbers) m.position.y = Math.sin(now / 600) * 0.25;


  checkDiscoveries();
  const area = layout.areas.find((a) => Math.hypot(player.pos.x - a.c[0], player.pos.z - a.c[1]) < a.r);
  if (area && area.id !== currentArea) showArea(area);
  currentArea = area?.id ?? '';
  const it = nearestInteract();
  $('prompt').textContent = !player.flying && it && !done.has(it.id) ? `[${settings.label('interact')}] ${localizeText(it.label)}` :
    player.inUpdraft && player.onGround ? bilingual(`[${settings.label('jump')}] 跳入上升气流`, `[${settings.label('jump')}] Jump into the updraft`) : '';

  const nowRegion = regionAt(player.pos.x, player.pos.z).id;
  if (nowRegion !== lastRegion) { lastRegion = nowRegion; renderObjective(); }
  culler.update(eye, lowQ ? 0.7 : 1);
  // dynamic resolution: trade pixels for frame rate, recover when there is headroom
  dynT += dt; dynFrames++;
  if (dynT > 1 && composer && !params.has('shot')) {
    const f = dynFrames / dynT;
    const next = f < 48 ? Math.max(0.6, dpr - 0.1) : f > 58 ? Math.min(maxDpr, dpr + 0.05) : dpr;
    if (Math.abs(next - dpr) > 0.01) { dpr = next; renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); }
    dynT = 0; dynFrames = 0;
  }
  const tgt = guideOn ? guideTarget() : null;
  updateGuide(tgt, now);
  const mt: [number, number] | null = tgt ? [tgt.p[0], tgt.p[2]] : null;
  map.draw(mini, player.pos, player.yaw, { full: false, done, found, target: mt });
  if ($('bigmap').classList.contains('open')) map.draw(big, player.pos, player.yaw, { full: true, done, found, target: mt });

  timeUniform.value = now / 1000;
  shafts.update(camera, twilight.direction);
  grass?.update(camera.position);
  ambient?.update(camera.position);
  if (composer) composer.render(); else renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const info = renderer.info.render;
  stats.textContent = bilingual(`${fps} 帧/秒 · ${info.calls} 绘制 · ${Math.round(info.triangles / 1000)}k 三角形\n`, `${fps} fps · ${info.calls} draws · ${Math.round(info.triangles / 1000)}k tris\n`) +
    `x ${player.pos.x.toFixed(1)}  y ${player.pos.y.toFixed(1)}  z ${player.pos.z.toFixed(1)}${player.flying ? bilingual(' · 飞行', ' · fly') : ''}${player.gliding ? bilingual(' · 滑翔', ' · glide') : ''}${player.swimming ? bilingual(' · 游泳', ' · swim') : ''}`;
  requestAnimationFrame(frame);
}
refreshWorldLocale = () => {
  renderObjective(); renderControlHints(); renderContract();
  const area = layout.areas.find((a) => a.id === currentArea);
  if (area) { $('area').querySelector('.zh')!.textContent = localizeText(area.name); $('area').querySelector('.en')!.textContent = bilingual(area.nameEn.toUpperCase(), 'PARHELION WORLD'); }
  // Transient combat/toast messages expire rather than retain a previous language.
  $('toast').classList.remove('show');
};
requestAnimationFrame(frame);
const ground = (x: number, z: number) =>
  staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 0;
// debug/test hook
(window as any).__world = { renderer, rig, anim, aim, settings, settingsPanel, thirdPerson, player, scene, camera, layout, done, found, colliders, ground, contract, servant, combat, ready: true };
}

void boot().catch((error: unknown) => {
  bootFailed = true;
  disposeRenderer();
  const message = error instanceof Error ? error.message : String(error);
  setLoading(`地图加载失败：${message}。请检查网络后重试。`);
  $('start').classList.remove('hidden');
  const retry = document.createElement('button');
  retry.id = 'retry';
  retry.type = 'button';
  retry.textContent = localizeText('重新加载');
  onLanguageChange(() => { retry.textContent = localizeText('重新加载'); });
  retry.addEventListener('click', (event) => { event.stopPropagation(); location.reload(); });
  $('start').append(retry);
});
