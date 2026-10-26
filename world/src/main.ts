import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { toonMaterial, addOutline, makeSky, SUN_DIR, timeUniform } from './look';
import { Player, PLAYER, type Collider } from './player';
import { WorldMap } from './map';
import type { Layout, Marker } from './types';
import { loadLayout } from './load';

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let bootFailed = false;
let disposeRenderer = () => {};

async function boot() {

// ───────────── renderer / scene ─────────────
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: params.has('shot') });
disposeRenderer = () => renderer.dispose();
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; // keeps anime saturation, unlike ACES
renderer.toneMappingExposure = 0.98;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c4e2f6', 120, 720);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
const sky = makeSky();
scene.add(sky);
scene.add(new THREE.HemisphereLight('#d6ecff', '#9aa98a', 1.15));
const sun = new THREE.DirectionalLight('#fff0d2', 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const caveLight = new THREE.PointLight('#7ff6ff', 60, 26, 1.6); // hidden cave glow
caveLight.position.set(182, 6, -60);
scene.add(caveLight);

// post: soft bloom on sun, halo, glowing flowers and water glints (?nopost to disable)
const composer = params.has('nopost') ? null : new EffectComposer(renderer);
if (composer) {
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.45, 0.97));
  composer.addPass(new OutputPass());
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
});

// ───────────── load ─────────────
const [layout, gltf] = await Promise.all([
  loadLayout(),
  new GLTFLoader().loadAsync('./assets/world_alpha.glb', (progress) => {
    if (!bootFailed && progress.lengthComputable && progress.total > 0) $('loading').textContent = `加载地图… ${Math.round(progress.loaded / progress.total * 100)}%`;
  }),
]);
const world = gltf.scene;
for (const name of ['ART', 'COLLISION', 'Terrain']) {
  if (!world.getObjectByName(name)) throw new Error(`地图模型缺少 ${name} 节点`);
}
scene.add(world);
world.updateMatrixWorld(true);

const byName = (n: string) => world.getObjectByName(n) as THREE.Mesh | undefined;
const collisionRoot = byName('COLLISION')!;
const markerRoot = byName('MARKERS');
if (markerRoot) markerRoot.visible = false;

let terrainMesh: THREE.Mesh | null = null;
const targets: THREE.Mesh[] = [];
const artMeshes: THREE.Mesh[] = [];
byName('ART')!.traverse((o) => { if ((o as THREE.Mesh).isMesh) artMeshes.push(o as THREE.Mesh); });
artMeshes.forEach((m) => {
  if (m.name === 'Terrain') terrainMesh = m;
  m.material = toonMaterial(m.material as THREE.Material);
  m.receiveShadow = true;
  m.castShadow = !['Terrain', 'Water', 'Waterfall', 'Bushes', 'Glow_Props'].includes(m.name);
  if (m.userData.outline && !params.has('noline')) addOutline(m);
  if (m.name.startsWith('TGT_')) targets.push(m);
});

// colliders: everything static merged into one BVH; dynamic pieces (door, targets) keep their own
const colliders: Collider[] = [];
const staticGeos: THREE.BufferGeometry[] = [];
const debugCol = new THREE.Group();
const debugMat = new THREE.MeshBasicMaterial({ color: '#ff3d7f', wireframe: true, transparent: true, opacity: 0.35 });
collisionRoot.traverse((o) => {
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
debugCol.add(new THREE.Mesh(staticGeo, debugMat));
debugCol.visible = false;
scene.add(debugCol);

const collider = (name: string) => colliders.find((c) => c.name === name);
const markers = new Map<string, Marker>(layout.markers.map((m) => [m.id, m]));
const map = new WorldMap(terrainMesh!, layout);

// ───────────── progress (local, per browser) ─────────────
const SAVE_KEY = 'parhelion.world_alpha.progress.v1';
const done = new Set<string>();
const found = new Set<string>();
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}');
  (s.done ?? []).forEach((x: string) => done.add(x));
  (s.found ?? []).forEach((x: string) => found.add(x));
} catch { /* storage unavailable */ }
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
  renderObjective();
}

function renderObjective() {
  const steps = layout.objective.steps;
  let current = false;
  const rows = steps.map((s) => {
    const ok = s.done.every((x) => done.has(x));
    let cls = ok ? 'done' : '';
    if (!ok && !current) { cls = 'cur'; current = true; }
    const extra = s.id === 'ruin_targets' && !ok ? ` (${s.done.filter((x) => done.has(x)).length}/3)` : '';
    return `<div class="${cls}">${ok ? '✓' : '◇'} ${s.text}${extra}</div>`;
  });
  const disc = layout.markers.filter((m) => m.type === 'discovery');
  $('objective').innerHTML =
    `<h3>${layout.objective.name}</h3>${rows.join('')}` +
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
const spawn = markers.get('spawn_p1')!;
const spawnAt = (areaId?: string) => {
  const a = layout.areas.find((x) => x.id === areaId);
  if (!a) return player.teleport(spawn.p[0], spawn.p[1] + 1, spawn.p[2], 0);
  const y = staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(a.tp[0], 300, a.tp[1]), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 40;
  // face the area's centre
  player.teleport(a.tp[0], y + 0.5, a.tp[1], Math.atan2(-(a.c[0] - a.tp[0]), -(a.c[1] - a.tp[1])));
};
spawnAt(params.get('spawn') ?? undefined);

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
  if (e.code === 'KeyH') $('help').style.display = $('help').style.display === 'none' ? '' : 'none';
  if (e.code === 'KeyE' && !player.flying) interact();
  if (e.code === 'KeyR' && e.shiftKey === false) { done.clear(); found.clear(); save(); applyWorldState(); toast('进度已重置'); }
  const n = Number(e.key);
  if (n >= 1 && n <= layout.areas.length) spawnAt(layout.areas[n - 1].id);
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
  const origin = player.eyePos(new THREE.Vector3());
  const look = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
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
    const n = ['ruin_target_1', 'ruin_target_2', 'ruin_target_3'].filter((x) => done.has(x)).length;
    toast(n === 3 ? '机关解除：神龛之门打开了' : `机关靶命中 ${n}/3`);
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
  toast(m.id === 'tower_console' ? '幻日塔重启！光环点亮了整个山谷' : `${m.label} 已启动`);
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
  camera.position.copy(eye);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  sky.position.copy(eye);
  sun.position.copy(eye).addScaledVector(SUN_DIR, 200);
  sun.target.position.copy(eye);

  if (haloMat && done.has('tower_console')) haloMat.color.setScalar(0.85 + Math.sin(now / 400) * 0.15);
  for (let i = sparks.length - 1; i >= 0; i--) {
    sparks[i].t -= dt;
    if (sparks[i].t <= 0) { scene.remove(sparks[i].m); sparks.splice(i, 1); }
  }

  checkDiscoveries();
  const area = layout.areas.find((a) => Math.hypot(player.pos.x - a.c[0], player.pos.z - a.c[1]) < a.r);
  if (area && area.id !== currentArea) showArea(area);
  currentArea = area?.id ?? '';
  const it = nearestInteract();
  $('prompt').textContent = it && !done.has(it.id) ? `[E] ${it.label}` : '';

  map.draw(mini, player.pos, player.yaw, { full: false, done, found });
  if ($('bigmap').classList.contains('open')) map.draw(big, player.pos, player.yaw, { full: true, done, found });

  timeUniform.value = now / 1000;
  if (composer) composer.render(); else renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const info = renderer.info.render;
  stats.textContent = `${fps} fps · ${info.calls} draws · ${Math.round(info.triangles / 1000)}k tris\n` +
    `x ${player.pos.x.toFixed(1)}  y ${player.pos.y.toFixed(1)}  z ${player.pos.z.toFixed(1)}${player.flying ? ' · fly' : ''}${player.swimming ? ' · swim' : ''}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const ground = (x: number, z: number) =>
  staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 0;
// debug/test hook
(window as any).__world = { player, scene, camera, layout, done, found, colliders, ground, ready: true };
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
