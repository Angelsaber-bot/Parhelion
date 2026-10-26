import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { makeGrassField, makeSunShafts, enhanceWater, makeUpdrafts, makeAmbientParticles } from './fx';
import { toonMaterial, addOutline, makeSky, SUN_DIR, timeUniform } from './look';
import { Player, PLAYER, type Collider } from './player';
import { WorldMap } from './map';
import type { Layout, Marker } from './types';
import { loadLayout } from './load';
import { buildCharacter, CharacterAnimator } from './character';
import { REGIONS, GRID, PASS_POINT, mergeLayouts, boundaryWalls, regionAt } from './regions';
import { WorldGrid } from './grid';
import { chunkMesh, DistanceCuller } from './chunk';

const params = new URLSearchParams(location.search);
// One open world: 幻日谷 + 星落海岸 (east through the mountain pass). ?region=coast starts on the coast.
const startRegion = params.get('region') === 'coast' ? 'coast' : 'alpha';
// Quality: ?q=low | med (default) | high. high adds GTAO + 4x MSAA + denser grass.
const quality = (['low', 'med', 'high'] as const).find((q) => q === params.get('q')) ?? 'med';
const lowQ = quality === 'low', highQ = quality === 'high';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let bootFailed = false;
let disposeRenderer = () => {};

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
scene.add(new THREE.HemisphereLight('#d6ecff', '#9aa98a', 1.15));
const sun = new THREE.DirectionalLight('#fff0d2', 2.7);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(lowQ ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
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
  $('loading').textContent = `加载地图… ${Math.round([...loaded.values()].reduce((a, b) => a + b, 0) / REGIONS.length * 100)}%`;
};
const parts = await Promise.all(REGIONS.map(async (def) => {
  const [lay, gltf] = await Promise.all([
    loadLayout(`./assets/${def.file}.layout.json`),
    new GLTFLoader().loadAsync(`./assets/${def.file}.glb`, progress(def.file)),
  ]);
  for (const name of ['ART', 'COLLISION', 'Terrain']) {
    if (!gltf.scene.getObjectByName(name)) throw new Error(`地图模型缺少 ${name} 节点`);
  }
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
// the coast's large sea plane covers both regions; drop the others so water never doubles up
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
  if (m.name.startsWith('TGT_')) targets.push(m);
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
});
const staticGeo = mergeGeometries(staticGeos);
const staticBVH = new MeshBVH(staticGeo);
colliders.unshift({ name: 'static', bvh: staticBVH, enabled: true });

const grid = new WorldGrid(terrains, GRID.x0, GRID.z0, GRID.span, GRID.cell);
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
const objectiveFor = (x: number) => layout.objectives.find((o) => o.region === regionAt(x).id)!.objective;

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
  const doorOpen = ['ruin_target_1', 'ruin_target_2', 'ruin_target_3'].every((x) => done.has(x));
  const door = byName('Ruin_Door'); if (door) door.visible = !doorOpen;
  const dc = collider('COL_Ruin_Door'); if (dc) dc.enabled = !doorOpen;
  if (haloMat) haloMat.color.setScalar(done.has('tower_console') ? 1 : 0.32);
  for (const m of stateful) {
    const show = m.userData.showWhen ? done.has(m.userData.showWhen as string) : true;
    const hide = m.userData.hideWhen ? done.has(m.userData.hideWhen as string) : false;
    m.visible = show && !hide;
  }
  renderObjective();
}

// ───────────── quest guide (G): waypoint to the next objective, beacon pillar, map marker ─────────────
let guideOn = true;
try { guideOn = localStorage.getItem('parhelion.guide') !== 'off'; } catch { /* storage unavailable */ }
const PASS = PASS_POINT;
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
/** Next objective marker: current region first; the other region's goal routes through the east pass. */
function guideTarget(): { p: [number, number, number]; label: string } | null {
  const here = regionAt(player.pos.x).id;
  const order = [...layout.objectives].sort((a, b) => (a.region === here ? -1 : 0) - (b.region === here ? -1 : 0));
  for (const o of order)
    for (const s of o.objective.steps) {
      const left = s.done.filter((id) => !done.has(id)).map((id) => markers.get(id)!).filter(Boolean);
      if (!left.length) continue;
      if (o.region !== here) return { p: PASS, label: `前往${o.region === 'coast' ? '星落海岸' : '幻日谷'}（东侧山口）` };
      left.sort((a, b) => Math.hypot(a.p[0] - player.pos.x, a.p[2] - player.pos.z) - Math.hypot(b.p[0] - player.pos.x, b.p[2] - player.pos.z));
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
  (el.querySelector('.label') as HTMLElement).textContent = t.label;
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
  const objective = objectiveFor(player.pos.x);
  const steps = objective.steps;
  let current = false;
  const rows = steps.map((s) => {
    const ok = s.done.every((x) => done.has(x));
    let cls = ok ? 'done' : '';
    if (!ok && !current) { cls = 'cur'; current = true; }
    const extra = s.done.length > 1 && !ok ? ` (${s.done.filter((x) => done.has(x)).length}/${s.done.length})` : '';
    return `<div class="${cls}">${ok ? '✓' : '◇'} ${s.text}${extra}</div>`;
  });
  const disc = layout.markers.filter((m) => m.type === 'discovery');
  $('objective').innerHTML =
    `<h3>${objective.name}</h3>${rows.join('')}` +
    `<div style="margin-top:6px;opacity:.75">隐藏发现 ${disc.filter((d) => found.has(d.id)).length}/${disc.length}</div>`;
}

let toastTimer = 0;
function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
}

let areaTimer = 0;
let currentArea = '';
function showArea(a: Layout['areas'][number]) {
  const el = $('area');
  (el.querySelector('.zh') as HTMLElement).textContent = a.name;
  (el.querySelector('.en') as HTMLElement).textContent = a.nameEn.toUpperCase();
  el.classList.add('show');
  clearTimeout(areaTimer);
  areaTimer = window.setTimeout(() => el.classList.remove('show'), 2400);
}

// ───────────── player / input ─────────────
const player = new Player(colliders, layout.world.waterLevel);
player.updrafts = layout.updrafts ?? [];
const spawn = markers.get(startRegion === 'coast' ? 'coast_spawn_p1' : 'spawn_p1') ?? markers.get('spawn_p1')!;
const spawnAt = (areaId?: string) => {
  const a = layout.areas.find((x) => x.id === areaId);
  if (!a) return player.teleport(spawn.p[0], spawn.p[1] + 1, spawn.p[2], 0);
  const y = staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(a.tp[0], 300, a.tp[1]), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 40;
  // face the area's centre
  player.teleport(a.tp[0], y + 0.5, a.tp[1], Math.atan2(-(a.c[0] - a.tp[0]), -(a.c[1] - a.tp[1])));
};
spawnAt(params.get('spawn') ?? undefined);

// explorer character + third-person camera (V toggles first person)
const charMat = toonMaterial(Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true }), { name: 'M_Toon' }));
const rig = buildCharacter(charMat);
rig.meshes.forEach((m) => { m.receiveShadow = true; if (!params.has('noline')) addOutline(m, 0.012); });
scene.add(rig.root);
const anim = new CharacterAnimator(rig);
anim.facing = player.yaw + Math.PI;
let thirdPerson = !params.has('fps') && !params.has('cam');
let camDist = 3.6;
const prevPos = player.pos.clone();

const keys = new Set<string>();
let locked = false;
const start = $('start');
const gameplayActive = () => locked && document.visibilityState === 'visible' && document.hasFocus() && !$('bigmap').classList.contains('open');
const lockError = () => {
  if (locked) return;
  keys.clear();
  $('loading').textContent = '无法锁定鼠标，请再次点击进入（或检查浏览器权限）';
  start.classList.remove('hidden');
};
$('loading').textContent = '点击进入（ESC 释放鼠标）';
start.addEventListener('click', async () => {
  try { await canvas.requestPointerLock(); } catch { lockError(); }
});
document.addEventListener('pointerlockerror', lockError);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  keys.clear(); // never carry input across entering/leaving pointer lock
  if (!locked) $('bigmap').classList.remove('open');
  else $('loading').textContent = '点击进入（ESC 释放鼠标）';
  start.classList.toggle('hidden', locked);
});
document.addEventListener('mousemove', (e) => {
  if (!gameplayActive()) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.5, 1.5);
});
addEventListener('keydown', (e) => {
  // macOS swallows keyups while Cmd is held (Cmd+Tab etc.), which used to leave a key stuck down
  if (e.metaKey || e.ctrlKey || e.altKey) { keys.clear(); return; }
  if (!locked || document.visibilityState !== 'visible' || !document.hasFocus()) return;
  // The map is a modal view: it cannot also move, shoot, interact or reset progress.
  if (e.code === 'KeyM') {
    e.preventDefault();
    if (!e.repeat) { keys.clear(); $('bigmap').classList.toggle('open'); }
    return;
  }
  if (!gameplayActive()) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyF') { player.flying = !player.flying; toast(player.flying ? '飞行模式 开' : '飞行模式 关'); }
  if (e.code === 'KeyC') { debugCol.visible = !debugCol.visible; toast(debugCol.visible ? '显示碰撞体' : '隐藏碰撞体'); }
  if (e.code === 'KeyV') { thirdPerson = !thirdPerson; toast(thirdPerson ? '第三人称' : '第一人称'); }
  if (e.code === 'KeyG') toggleGuide();
  if (e.code === 'KeyH') $('help').style.display = $('help').style.display === 'none' ? '' : 'none';
  if (e.code === 'KeyE' && !player.flying) interact();
  if (e.code === 'KeyR' && e.shiftKey === false) { done.clear(); found.clear(); save(); applyWorldState(); toast('进度已重置'); }
  const n = Number(e.key);
  const here = layout.areas.filter((a) => a.region === regionAt(player.pos.x).id);
  if (n >= 1 && n <= here.length) spawnAt(here[n - 1].id);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => keys.clear());
addEventListener('contextmenu', (e) => e.preventDefault());

// ───────────── shooting (hitscan) ─────────────
const ray = new THREE.Raycaster();
const sparks: { m: THREE.Mesh; t: number }[] = [];
const sparkGeo = new THREE.IcosahedronGeometry(0.12, 0);
const sparkMat = new THREE.MeshBasicMaterial({ color: '#fff3a0' });
canvas.addEventListener('mousedown', (e) => {
  if (!gameplayActive() || e.button !== 0) return;
  const origin = camera.position.clone();
  const look = camera.getWorldDirection(new THREE.Vector3());
  ray.set(origin, look);
  ray.far = 150;
  const wall = staticBVH.raycastFirst(ray.ray, THREE.DoubleSide);
  const wallDist = wall && wall.distance < 150 ? wall.distance : Infinity;
  const hit = ray.intersectObjects(targets.filter((t) => t.visible), false)[0];
  let point: THREE.Vector3 | null = wall && wallDist < Infinity ? wall.point : null;
  if (hit && hit.distance < wallDist) {
    point = hit.point;
    const id = hit.object.userData.target as string;
    done.add(id);
    const group = id.replace(/_\d+$/, '');
    const n = [1, 2, 3].filter((k) => done.has(`${group}_${k}`)).length;
    if (group === 'range_target') toast(n === 3 ? '射击练习完成' : `练习靶命中 ${n}/3`);
    else toast(n === 3 ? '机关解除：神龛之门打开了' : `机关靶命中 ${n}/3`);
    save(); applyWorldState();
    $('crosshair').classList.add('hit');
    setTimeout(() => $('crosshair').classList.remove('hit'), 140);
  }
  if (point) {
    const s = new THREE.Mesh(sparkGeo, sparkMat);
    s.position.copy(point);
    scene.add(s);
    sparks.push({ m: s, t: 0.25 });
  }
});

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
  if (done.has(m.id)) return toast(`${m.label}：已启动`);
  const missing = (m.requires ?? []).filter((r) => !done.has(r));
  if (missing.length) return toast(`${m.label}：还需要 ${missing.map((r) => markers.get(r)?.label ?? r).join('、')}`);
  done.add(m.id);
  save(); applyWorldState();
  const msg: Record<string, string> = {
    tower_console: '幻日塔重启！光环点亮了整个山谷，三处时层断面同时显现',
    hq_terminal: '调查员身份已登记：世界地图与历史档案已开放',
    armory_rack: '领取 Lumen AR 与弹药，去靶场试试手感',
    seam_west: '西部时层：约 537 年的不列颠，黄昏永远不会结束',
    seam_north: '北方冰海：1812 年的冬天没有尽头',
    seam_east: '东部山口：海风里混着 1718 年的火药味',
    summon_circle: '召唤阵稳定了。落日王国的入口正在开启（制作中）',
    temple_altar: '星辉祭坛亮起，一道光柱直冲云霄',
    lighthouse_lamp: '守望灯塔重新点亮，光束扫过整片海岸',
  };
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
if (params.has('fov')) { camera.fov = Number(params.get('fov')); camera.updateProjectionMatrix(); }
applyWorldState();

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  if (!gameplayActive()) keys.clear();
  const input = {
    x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    z: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
    jump: keys.has('Space'),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    up: (keys.has('KeyE') && player.flying ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0),
  };
  while (acc >= STEP) { player.step(STEP, input); acc -= STEP; }

  player.eyePos(eye);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  // character: face the movement direction, animate from actual displacement
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const wx = fx * input.z + rx * input.x, wz = fz * input.z + rz * input.x;
  const hs = dt > 0 ? Math.hypot(player.pos.x - prevPos.x, player.pos.z - prevPos.z) / dt : 0;
  prevPos.copy(player.pos);
  rig.root.position.copy(player.pos);
  rig.root.visible = thirdPerson;
  anim.update(dt, { speed: Math.min(hs, 12), onGround: player.onGround, swimming: player.swimming, vy: player.vel.y, moveYaw: wx || wz ? Math.atan2(wx, wz) : null, gliding: player.gliding });
  if (thirdPerson) {
    // over-the-shoulder spring arm that pulls in when terrain/walls are in the way
    const look = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const pivot = new THREE.Vector3(player.pos.x + rx * 0.45, player.pos.y + 1.55, player.pos.z + rz * 0.45);
    // keep the pivot under any ceiling (gallery floors, arches) so the arm never starts inside geometry
    const up = staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(player.pos.x, player.pos.y + 1.0, player.pos.z), new THREE.Vector3(0, 1, 0)), THREE.DoubleSide);
    if (up && up.distance < 0.85) pivot.y = Math.max(player.pos.y + 0.9, up.point.y - 0.3);
    const back = look.clone().negate();
    const hit = staticBVH.raycastFirst(new THREE.Ray(pivot, back), THREE.DoubleSide);
    const armLen = player.gliding ? 5.2 : 3.6;
    const want = Math.min(armLen, hit ? Math.max(0.4, hit.distance - 0.3) : armLen);
    camDist = want < camDist ? want : THREE.MathUtils.damp(camDist, want, 6, dt);
    camera.position.copy(pivot).addScaledVector(back, camDist);
    eye.copy(camera.position);
  } else camera.position.copy(eye);
  sky.position.copy(eye);
  sun.position.copy(eye).addScaledVector(SUN_DIR, 200);
  sun.target.position.copy(eye);

  if (haloMat && done.has('tower_console')) haloMat.color.setScalar(0.85 + Math.sin(now / 400) * 0.15);
  for (const m of spinners) m.rotation.y += (m.userData.spin as number) * dt;
  for (const m of bobbers) m.position.y = Math.sin(now / 600) * 0.25;
  for (let i = sparks.length - 1; i >= 0; i--) {
    sparks[i].t -= dt;
    if (sparks[i].t <= 0) { scene.remove(sparks[i].m); sparks.splice(i, 1); }
  }

  checkDiscoveries();
  const area = layout.areas.find((a) => Math.hypot(player.pos.x - a.c[0], player.pos.z - a.c[1]) < a.r);
  if (area && area.id !== currentArea) showArea(area);
  currentArea = area?.id ?? '';
  const it = nearestInteract();
  $('prompt').textContent = it && !done.has(it.id) ? `[E] ${it.label}` :
    player.inUpdraft && player.onGround ? '[Space] 跳入上升气流' : '';

  if (regionAt(player.pos.x).id !== lastRegion) { lastRegion = regionAt(player.pos.x).id; renderObjective(); }
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
  shafts.update(camera, SUN_DIR);
  grass?.update(camera.position);
  ambient?.update(camera.position);
  if (composer) composer.render(); else renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const info = renderer.info.render;
  stats.textContent = `${fps} fps · ${info.calls} draws · ${Math.round(info.triangles / 1000)}k tris\n` +
    `x ${player.pos.x.toFixed(1)}  y ${player.pos.y.toFixed(1)}  z ${player.pos.z.toFixed(1)}${player.flying ? ' · fly' : ''}${player.gliding ? ' · glide' : ''}${player.swimming ? ' · swim' : ''}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const ground = (x: number, z: number) =>
  staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 0;
// debug/test hook
(window as any).__world = { renderer, rig, anim, setThirdPerson: (v: boolean) => { thirdPerson = v; }, player, scene, camera, layout, done, found, colliders, ground, ready: true };
}

void boot().catch((error: unknown) => {
  bootFailed = true;
  disposeRenderer();
  const message = error instanceof Error ? error.message : String(error);
  $('loading').textContent = `地图加载失败：${message}。请检查网络后重试。`;
  $('start').classList.remove('hidden');
  const retry = document.createElement('button');
  retry.id = 'retry';
  retry.type = 'button';
  retry.textContent = '重新加载';
  retry.addEventListener('click', (event) => { event.stopPropagation(); location.reload(); });
  $('start').append(retry);
});
