import { buildAlphaSettlement } from './settlements/alpha';
import { buildBritainSettlement } from './settlements/britain';
import { buildBlackSailSettlement } from './settlements/blacksail';
import { buildWinterSettlement } from './settlements/winter';
import { buildKyotoSettlement } from './settlements/kyoto';
import { installSettlements } from './settlements/core';
import { mergeParts } from './settlements/merge';
import { createSettlementNpcs } from './settlements/npcs';
import { createCampaignSites } from './campaignSites';
import { createSettlementApproaches } from './settlementApproaches';
import { CAMPAIGN_EPISODES, CAMPAIGN_REGIONS, getCampaignEpisodeState, getCampaignEpisodeGuide, interactCampaignEpisode, chooseCampaignEpisode, type CampaignEpisodeInteraction } from './campaignEpisodes';
import { createCampaignJournal } from './campaignJournal';
import type { RegionId } from './settlements/types';
import { VALLEY_STORY, getValleyStoryState, getValleyStoryGuide, interactValleyStory } from './valleyStory';
import { createValleyStoryScene } from './valleyStoryScene';
import { isEraId, ERA_STORIES, ERA_OPTIONALS, getEraStoryState, getEraStoryGuide, getEraObjective, applyEraMarkerRequirements, getEraPieceRequirements, interactEraStory, getEraProgressReaction } from './eraStories';
import { optionalPinExpired, type OptionalPin } from './optionalNavigation';
import { createEraStoryScene } from './eraStoryScenes';
import { WorldActions } from './worldActions';
import { resolveServantSkillAim } from './skillAim';
import { CONTRACT_SKILLS, type SkillEvent } from './contractSkills';
import { UltimateDirector } from './ultimateDirector';
import { UltimateStage } from './ultimateStage';
import './ultimateDirector.css';
import { FortCannon, FORT_CANNON } from './fortCannon';
import { createTraversalRepairs } from './traversalRepairs';
import { createActionHud } from './actionHud';
import { WorldAudio } from './worldAudio';
import { worldBootFailure } from './bootFailure';
import { createTravelPanel } from './travelPanel';
import { createNarrativePanel } from './narrativePanel';
import { createSafeTravelStops, discoverTravelStops, isTravelStopDiscovered, getTravelBlock, planSafeTravel, TRAVEL_BLOCK_TEXT, type TravelContext } from './safeTravel';
import { CAMPAIGN_CLOSURE, getCampaignClosureGuide, interactCampaignClosure, getCampaignResidentReaction } from './campaignClosure';
import { attachExplorerBlade } from './playerBladeArt';
import { FrameWorkBudget } from './frameWorkBudget';
import { LocalLightPool } from './localLightPool';
import { detachConsumedSourceNodes } from './consumedSourceNodes';
import './actions.css';
import { AdaptiveResolution, targetDpr } from './renderQuality';
import { readResolutionMode, attachRenderSettings } from './renderSettings';
import * as THREE from 'three';
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
import { loadSkinnedCharacter, SkinnedCharacterAnimator } from './skinnedCharacter';
import { attachExplorerRifle } from './weaponArt';
import { ShoulderAim, shoulderArmLength } from './aim';
import { SettingsStore, createSettingsPanel } from '../../shared-client/settings';
import '../../shared-client/settings.css';
import { REGIONS, GRID, GATES, mergeLayouts, boundaryWalls, regionAt } from './regions';
import { BOSSES } from './combat';
import { nearbyElite } from './eliteNavigation';
import { WorldGrid } from './grid';
import { chunkMesh, DistanceCuller, freezeStaticArt, isStaticArtEligible } from './chunk';
import { regionLoader, bakeQuantized } from './glb';
import { KingdomTwilight } from './twilight';
import { FirstContract, SERVANTS, servantByContract, type ServantId } from './contracts';
import { KitCompanion } from './kitCompanion';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ContractServant } from './servant';
import { CHARACTER_KITS } from './characters/catalog';
import { loadCharacterKit, type CharacterKit } from './characters/characterKit';
import { ServantAppearance } from './servantAppearance';
import { createServantPanel } from './servantPanel';
import { WorldCombat } from './combatView';
import { WorldProgress, ARMORY_MARKER, INITIAL_SPAWN_ID, clearStartOverrides } from './progress';
import { createProgressPanel } from './progressPanel';
import { WeaponFinishStore } from './weaponFinishes';
import { createWeaponFinishControl } from './weaponFinishControl';
import { getLanguage, bilingual, localizeText, localizeDom, createLanguageToggle, onLanguageChange } from '../../shared-client/i18n';

const params = new URLSearchParams(location.search);
const requestedFov = Number(params.get('fov'));
const baseFov = THREE.MathUtils.clamp(params.has('fov') && Number.isFinite(requestedFov) ? requestedFov : 75, 40, 110);
// One open world: 幻日谷 + 落日王国 (west seam) + 黑帆尽头 (east pass) + 永冬之城 (north ice seam) +
// 业火京都 (south torii seam). ?region=britain|blacksail|winter|kyoto starts there.
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: params.has('nopost'), preserveDrawingBuffer: params.has('shot') });
disposeRenderer = () => renderer.dispose();
let resolution = readResolutionMode(params);
let observedDeviceDpr = devicePixelRatio;
const adaptiveResolution = new AdaptiveResolution();
let dpr = targetDpr(devicePixelRatio, resolution, lowQ);
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

// post: MSAA → GTAO (high only) → bloom → sun shafts → output.  ?nopost disables, ?q=low keeps bloom only
const composer = params.has('nopost') ? null : new EffectComposer(renderer, new THREE.WebGLRenderTarget(
  innerWidth, innerHeight, { samples: highQ ? 4 : lowQ ? 0 : 2, type: THREE.HalfFloatType }));
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
  // Explicit targets are interpreted as CSS dimensions by EffectComposer.
  composer.setSize(innerWidth, innerHeight);
}
renderer.info.autoReset = false; // count the whole frame, including shadows and post passes
function applyResolution() {
  renderer.setPixelRatio(dpr);
  composer?.setPixelRatio(dpr);
}

addEventListener('resize', () => {
  observedDeviceDpr = devicePixelRatio;
  dpr = targetDpr(devicePixelRatio, resolution, lowQ);
  adaptiveResolution.reset();
  applyResolution();
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
document.title = 'Parhelion · World';
const localLights = new LocalLightPool([
  { p: [182, 6, -60], color: '#7ff6ff', intensity: 60, distance: 26, decay: 1.6 },
  ...(layout.lights ?? []),
]);
scene.add(localLights.root);
addEventListener('pagehide', event => { if (!event.persisted) localLights.dispose(); });

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
  const special = !isStaticArtEligible(m);
  const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const pieces = !special && tris > 4000 ? chunkMesh(m, 64) : [m];
  for (const c of pieces) {
    if (m.userData.outline && !params.has('noline')) addOutline(c);
    if (pieces.length > 1) culler.add(c, DRAW_DIST[m.name] ?? 1e9);
    // Static art transforms do not change; shader foliage sway remains fully active.
    // Never freeze stateful, spinning, bobbing, target or other dynamic gameplay art.
    if (!special) freezeStaticArt(c);
  }
}

// colliders: everything static merged into one BVH; dynamic pieces (door, targets) keep their own
const colliders: Collider[] = [];
const gates: { name: string; opensWhen: string[] }[] = [];
const solids: { name: string; solidWhen: string[] }[] = []; // e.g. the ghost bridge: walkable once it appears
const staticGeos: THREE.BufferGeometry[] = [boundaryWalls()];
const existingPropGeos: THREE.BufferGeometry[] = [];
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
  if (m.name !== 'COL_Terrain') existingPropGeos.push(g);
  if (m.userData.dynamic) colliders.push({ name: m.name, bvh: new MeshBVH(g), enabled: true });
  else staticGeos.push(g);
  if (Array.isArray(m.userData.opensWhen)) gates.push({ name: m.userData.art as string, opensWhen: m.userData.opensWhen as string[] });
  if (Array.isArray(m.userData.solidWhen)) solids.push({ name: m.userData.art as string, solidWhen: m.userData.solidWhen as string[] });
});
// Supplemental chapter buildings share the same authoritative collision BVH as the world.
const grid = new WorldGrid(terrains, GRID.x0, GRID.z0, GRID.span, GRID.cell, '#4f8fa8', GRID.spanZ);
const existingPropGeo = mergeParts(existingPropGeos);
const settlementBlockers = new MeshBVH(existingPropGeo);
const settlements = installSettlements([
  buildAlphaSettlement(), buildBritainSettlement(), buildBlackSailSettlement(), buildWinterSettlement(), buildKyotoSettlement(),
], { grid, blockers: settlementBlockers, layout });
const settlementApproaches = createSettlementApproaches(settlements.placements, { grid, blockers: settlementBlockers, layout });
world.add(settlementApproaches.root); freezeStaticArt(settlementApproaches.root);
addEventListener('pagehide', event => { if (!event.persisted) settlementApproaches.dispose(); });
world.add(settlements.root);
settlements.root.traverse((o) => {
  if (o instanceof THREE.Mesh) o.material = toonMaterial(o.material as THREE.Material);
});
freezeStaticArt(settlements.root);
staticGeos.push(...settlements.collisionGeometries);
const campaignSites = createCampaignSites(settlements.placements);
world.add(campaignSites.root); freezeStaticArt(campaignSites.root);
staticGeos.push(...campaignSites.collisionGeometries);
layout.markers.push(...campaignSites.markers);
const campaignMarkerIds = new Set(campaignSites.markers.map(marker => marker.id));
const settlementNpcs = createSettlementNpcs([...settlements.npcs, ...campaignSites.npcs]);
scene.add(settlementNpcs.group);
addEventListener('pagehide', event => { if (!event.persisted) campaignSites.dispose(); });
// One contextual place per chapter, never one marker per NPC or furniture item.
for (const p of settlements.placements) layout.areas.push({
  id: `${p.id}_living_hub`, name: p.name[0], nameEn: p.name[1], c: [p.position[0],p.position[2]],
  r: Math.hypot(...p.footprint)/2, color: '#c4ced6', tp: [p.entry[0],p.entry[2]+8], region:p.id,
});
const traversalRepairs = createTraversalRepairs(); scene.add(traversalRepairs.root); freezeStaticArt(traversalRepairs.root);
staticGeos.push(...traversalRepairs.collisionGeometries);
addEventListener('pagehide', event => { if (!event.persisted) traversalRepairs.dispose(); });
const staticGeo = mergeParts(staticGeos);
const staticBVH = new MeshBVH(staticGeo);
colliders.unshift({ name: 'static', bvh: staticBVH, enabled: true });
const consumedSourceReceipt = detachConsumedSourceNodes(world, colliders.map(collider => collider.bvh.geometry));

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
const progressStorage = (() => { try { return localStorage; } catch { return undefined; } })();
const worldProgress = new WorldProgress(progressStorage);
const { done, found } = worldProgress;
const weaponFinishStore = new WeaponFinishStore(progressStorage);
let weaponFinishControl: ReturnType<typeof createWeaponFinishControl> | undefined;
const save = () => worldProgress.save();
let actions: WorldActions | undefined;
const fortCannon = new FortCannon();
const audio = new WorldAudio();
const travelStops = createSafeTravelStops(settlements.placements);
let hudRevision = 0;
let travelOpenState = false;
let narrative: ReturnType<typeof createNarrativePanel> | undefined;
let ultimateDirector: UltimateDirector | undefined;
let ultimateStage: UltimateStage | undefined;
let ultimateSource: { identity: ServantId | null; root: THREE.Object3D } | null = null;
let optionalPin: OptionalPin | null = null;
let campaignTrackedRegion: RegionId | null = null;
let campaignJournalOpen = false;
let campaignJournal: ReturnType<typeof createCampaignJournal> | undefined;
const mapBudget = new FrameWorkBudget(30), hudBudget = new FrameWorkBudget(10), statsBudget = new FrameWorkBudget(4);
const eraStoryScenes = settlements.placements.filter(p => isEraId(p.id)).map(p => ({ ...createEraStoryScene(p), region: p.id }));
const eraOptionalIds = new Set(Object.values(ERA_OPTIONALS).map(x => x.id));
for (const site of eraStoryScenes) {
  scene.add(site.group); freezeStaticArt(site.group); colliders.push(...site.colliders);
  for (const marker of site.markers) { layout.markers.push(marker); markers.set(marker.id, marker); }
}
addEventListener('pagehide', event => { if (!event.persisted) for (const site of eraStoryScenes) site.dispose(); });
const alphaResidence = settlements.placements.find(p => p.id === 'alpha');
const valleyStoryScene = alphaResidence ? createValleyStoryScene(alphaResidence) : null;
if (valleyStoryScene) {
  scene.add(valleyStoryScene.group); colliders.push(...valleyStoryScene.colliders);
  for (const marker of valleyStoryScene.markers) { layout.markers.push(marker); markers.set(marker.id, marker); }
}
let appliedValleyStory = '';
function applyValleyStory() {
  if (!valleyStoryScene) return;
  const state = getValleyStoryState(done);
  valleyStoryScene.applyState({ powered: state.powered, shortcutOpen: state.shortcutOpen, resolved: state.stage === 'complete', discovered: state.discovered });
  const signature = `${state.stage}:${state.powered}:${state.discovered}`;
  if (signature !== appliedValleyStory) {
    appliedValleyStory = signature;
    settlementNpcs.requestRelocation(VALLEY_STORY.npc, state.stage === 'complete' ? valleyStoryScene.archivistReturn : valleyStoryScene.archivistInitial);
  }
}
addEventListener('pagehide', event => { if (!event.persisted) valleyStoryScene?.dispose(); });
function valleyGuide() {
  if (!valleyStoryScene || regionAt(player.pos.x, player.pos.z).id !== 'alpha') return null;
  const guide = getValleyStoryGuide(done); if (!guide) return null;
  const point = guide.targetKind === 'npc' ? settlementNpcs.getPosition(guide.targetId) : markers.get(guide.targetId)?.p;
  return point ? { ...guide, p: point } : null;
}
function interactionLabel(marker: Marker) {
  const episode = Object.values(CAMPAIGN_EPISODES).find(value => value.work === marker.id || value.decision === marker.id);
  if (episode) return bilingual(...(episode.work === marker.id ? episode.workLabel : episode.decisionLabel));
  const optional = Object.values(ERA_OPTIONALS).find(x => x.id === marker.id);
  if (optional) return bilingual(...optional.label);
  return marker.id === VALLEY_STORY.discovery ? bilingual('检修侧门面板', 'Maintenance entrance panel') : localizeText(marker.label);
}

const haloMat = (byName('Tower_Halo')?.material as THREE.MeshBasicMaterial | undefined);
function applyCampaignState() {
  for (const region of CAMPAIGN_REGIONS) {
    const state = getCampaignEpisodeState(region, done);
    campaignSites.applyState(region, { stage: state.visualStage, choice: state.choice ?? undefined });
  }
}
function applyWorldState() {
  hudRevision++;
  applyEraMarkerRequirements(layout.markers, done);
  combat.syncWorldProgress(done);
  for (const entry of layout.objectives) if (isEraId(entry.region)) entry.objective = getEraObjective(entry.region, done, getLanguage() === 'zh' ? 0 : 1);
  for (const site of eraStoryScenes) { if (isEraId(site.region)) { const state = getEraStoryState(site.region, done); site.applyState({ ...state, complete: state.complete || (site.region === 'britain' && state.knightDefeated) }); } }
  applyValleyStory();
  applyCampaignState();
  applyWeaponFinish();
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
  for (const g of solids) { const c = collider(`COL_${g.name}`); if (c) c.enabled = (getEraPieceRequirements(g.name, done) ?? g.solidWhen).every((x) => done.has(x)); }
  if (haloMat) haloMat.color.setScalar(done.has('tower_console') ? 1 : 0.32);
  for (const m of stateful) {
    const sw = getEraPieceRequirements(m.name, done) ?? m.userData.showWhen as string | string[] | undefined;
    const show = sw ? (Array.isArray(sw) ? sw : [sw]).every((x: string) => done.has(x)) : true;
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
// Quest and help panels remember whether they are hidden.
type HudPanel = 'help' | 'objective' | 'minimap' | 'contract-card';
function togglePanel(id: HudPanel, hidden = $(id).style.display !== 'none') {
  $(id).style.display = hidden ? 'none' : '';
  try { localStorage.setItem(`parhelion.world.hide.${id}`, hidden ? '1' : '0'); } catch { /* memory-only */ }
  const box = document.querySelector?.(`[data-hud-panel="${id}"]`) as HTMLInputElement | null;
  if (box) box.checked = !hidden;
}
function toggleGuide() {
  guideOn = !guideOn;
  try { localStorage.setItem('parhelion.guide', guideOn ? 'on' : 'off'); } catch { /* ignore */ }
  toast(guideOn ? '任务指引 开' : '任务指引 关');
}
/** Next objective marker: current region first; another region's goal routes through its gate via 幻日谷. */
const REGION_NAME: Record<string, string> = { alpha: '幻日谷', britain: '落日王国', blacksail: '黑帆尽头', winter: '永冬之城', kyoto: '业火京都' };
function guideTarget(): { p: [number, number, number]; label: string } | null {
  const here = regionAt(player.pos.x, player.pos.z).id;
  if (campaignTrackedRegion) {
    const guide = getCampaignEpisodeGuide(campaignTrackedRegion, done);
    if (!guide) campaignTrackedRegion = null;
    else {
      const label = bilingual(`可选纪事：${CAMPAIGN_EPISODES[campaignTrackedRegion].speaker[0]} · ${settings.label('mainRoute')}返回主线`, `Chronicle: ${CAMPAIGN_EPISODES[campaignTrackedRegion].speaker[1]} · ${settings.label('mainRoute')} for story`);
      if (here !== campaignTrackedRegion) {
        const gate = here === 'alpha' ? GATES[campaignTrackedRegion] : GATES[here];
        if (gate) return { p: gate.p, label };
      } else {
        const p = guide.targetKind === 'npc' ? settlementNpcs.getPosition(guide.targetId) : markers.get(guide.targetId)?.p;
        if (p) return { p, label };
      }
    }
  }
  const intro = valleyGuide();
  if (intro) return { p: intro.p, label: bilingual(...intro.text) };
  const closing = getCampaignClosureGuide(here, done);
  if (closing) { const marker = markers.get(closing.targetId); if (marker) return { p: marker.p, label: bilingual(...closing.text) }; }
  if (optionalPin) {
    if (optionalPinExpired(optionalPin, here, player.pos, done, found)) optionalPin = null;
    else return { p: optionalPin.p, label: bilingual(`可选：${optionalPin.label[0]} · ${settings.label('mainRoute')}返回主线`, `Optional: ${optionalPin.label[1]} · ${settings.label('mainRoute')} for story`) };
  }
  const eraGuide = isEraId(here) ? getEraStoryGuide(here, done) : null;
  if (eraGuide) { const marker = markers.get(eraGuide.targetId); if (marker) return { p: marker.p, label: bilingual(...eraGuide.text) }; }
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
  const intro = valleyGuide();
  if (intro) {
    $('objective').replaceChildren();
    const title = document.createElement('h3'); title.textContent = bilingual(...intro.title);
    const goal = document.createElement('div'); goal.className = 'cur'; goal.textContent = `◇ ${bilingual(...intro.text)}`;
    $('objective').append(title, goal);
    return;
  }
  const region = regionAt(player.pos.x, player.pos.z).id;
  if (isEraId(region) && getEraStoryState(region, done).stage === 'complete') {
    const title = document.createElement('h3'); title.textContent = bilingual(...ERA_STORIES[region].title);
    const complete = document.createElement('div'); complete.className = 'chapter-clear'; complete.textContent = bilingual('✓ 本章异常已解除', '✓ Chapter anomaly resolved');
    const note = document.createElement('div'); note.textContent = bilingual(...ERA_STORIES[region].completeText);
    $('objective').replaceChildren(title, complete, note); return;
  }
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
  const disc = layout.markers.filter((m) => m.type === 'discovery' && regionAt(m.p[0], m.p[2]).id === region);
  $('objective').innerHTML =
    `<h3>${localizeText(objective.name)}</h3>${rows.join('')}` +
    `<div style="margin-top:6px;opacity:.75">${localizeText('隐藏发现')} ${disc.filter((d) => found.has(d.id)).length}/${disc.length}</div>`;
}

let deferredCombatToast: string | null = null;
function combatToast(text: string) {
  if (ultimateDirector?.showing) { deferredCombatToast = text; return; }
  deferredCombatToast = null; toast(text);
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
const shelterStove = markers.get(ERA_OPTIONALS.winter.id);
if (shelterStove) warmSpots.push({ ...shelterStove, radius: 8, requires: [shelterStove.id] });
const cold = { warmth: 100, frozen: false, warned: false, reserve: 0 };
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
  else if (cold.reserve > 0) { cold.reserve = Math.max(0, cold.reserve - dt); if (nearFire) cold.warmth = Math.min(100, cold.warmth + dt * 30); }
  else cold.warmth = nearFire ? Math.min(100, cold.warmth + dt * 30) : Math.max(0, cold.warmth - dt * 2);
  cold.frozen = inWinter && cold.warmth <= 0;
  if (cold.frozen && !cold.warned) toast(bilingual('冻僵了：走不快也跑不动，快去火堆边取暖', 'Frozen stiff: you can barely move. Find a fire to warm up'));
  cold.warned = cold.frozen || (cold.warned && cold.warmth < 30);
  coldHud.hidden = !inWinter;
  if (inWinter) {
    coldHud.querySelector('span')!.textContent = `${bilingual('体温', 'Warmth')} ${Math.ceil(cold.warmth)}%${nearFire ? bilingual(' · 正在取暖', ' · warming up') : cold.reserve > 0 ? bilingual(` · 余温 ${Math.ceil(cold.reserve)}秒`, ` · Stored warmth ${Math.ceil(cold.reserve)}s`) : ''}`;
    (coldHud.querySelector('.combat-fill') as HTMLElement).style.width = `${cold.warmth}%`;
  }
  frost.style.opacity = inWinter ? `${Math.max(0, 1 - cold.warmth / 40) * 0.85}` : '0';
}

// ───────────── player / input ─────────────
const player = new Player(colliders, layout.world.waterLevel);
player.updrafts = layout.updrafts ?? [];
const initialSpawn = markers.get(INITIAL_SPAWN_ID)!;
// URL starts are intentional debug entry points only. Reset always returns to the authored Alpha
// camp, and subsequent defeat respawns in this session must not jump back to the old debug chapter.
let spawn = markers.get(startRegion === 'alpha' ? INITIAL_SPAWN_ID : `${startRegion}_spawn_p1`) ?? initialSpawn;
const spawnAt = (areaId?: string) => {
  actions?.cancel(); fortCannon.cancel(); hudRevision++;
  const a = layout.areas.find((x) => x.id === areaId);
  if (!a) return player.teleport(spawn.p[0], spawn.p[1] + 1, spawn.p[2], 0);
  const y = staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(a.tp[0], 300, a.tp[1]), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 40;
  // face the area's centre
  player.teleport(a.tp[0], y + 0.5, a.tp[1], Math.atan2(-(a.c[0] - a.tp[0]), -(a.c[1] - a.tp[1])));
};
spawnAt(params.get('spawn') ?? undefined);

// explorer character + third-person shoulder camera
setLoading('加载精修角色…');
const rig = await loadSkinnedCharacter({ outlines: !params.has('noline') });
// Hide the parent before asynchronous weapon art attaches: neither loading nor a late model can
// grant ownership or flash an unearned gun on a clean start.
rig.joints.Gun.visible = worldProgress.armed;
scene.add(rig.root);
const rifle = attachExplorerRifle(rig, renderer);
try { await rifle.ready; } catch (error) { rifle.dispose(); rig.dispose(); throw error; }
addEventListener('pagehide', (e) => { if (!e.persisted) { blade.dispose(); rifle.dispose(); rig.dispose(); } });
const blade = attachExplorerBlade(rig);
function applyWeaponFinish() {
  const finish = weaponFinishStore.active(done);
  rifle.setFinish(finish); blade.setFinish(finish); weaponFinishControl?.refresh();
}
applyWeaponFinish();
void blade.ready.catch(error => console.warn('Melee art unavailable', error));
const anim = new SkinnedCharacterAnimator(rig);
anim.reset(worldProgress.armed, player.yaw + Math.PI);
let thirdPerson = !params.has('cam'); // gameplay is TPS; fixed-camera screenshots remain a debug mode
let camDist = 3.6;
const prevPos = player.pos.clone();

let companionRegroupUntil = 0;
const noteCompanionRejoin = () => { companionRegroupUntil = performance.now() + 2000; hudRevision++; };
const contractStorage = progressStorage;
const contract = new FirstContract(done, contractStorage);
const servantAppearance = new ServantAppearance(contractStorage);
const servant = new ContractServant({ scene, renderer, marker: markers.get('saber_contract')!, contract, appearance: servantAppearance, colliders, onRejoin: noteCompanionRejoin,
  target: (position, targetId?: string) => { const hit = combat.allyTarget(position, 3.5, targetId); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
  track: (position, targetId) => { const hit = combat.allyTrack(position, 3.5, targetId); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
  strike: (position, targetId) => { const hit = combat.allyStrike(position, 3.5, 14, targetId); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
  engage: (_player, from) => { const hit = combat.allyEngage(15, from); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
});
// Era servants are visual/animation actors attached to their existing quest
// markers. They lazy-load only near the marker, share the normal scene
// lifecycle, and do not invent new classes or damage rules.
// Once contracted and chosen as the companion, the same actor follows the player (KitCompanion).
const companion = (range: number, damage: number, kind: 'melee' | 'ranged' = 'melee') => new KitCompanion({ colliders, range, damage, onRejoin: noteCompanionRejoin,
  target: (position, r, targetId) => { const hit = combat.allyTarget(position, r, targetId, kind); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
  track: (position, r, targetId) => { const hit = combat.allyTrack(position, r, targetId, kind); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
  strike: (position, r, dmg, targetId) => { const hit = combat.allyStrike(position, r, dmg, targetId, kind); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
  engage: (_player, from) => { const hit = combat.allyEngage(15, from); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x,hit.p.y,hit.p.z) } : null; },
});
const eraActors: Array<{ markerId: string; servant: ServantId; kit: keyof typeof CHARACTER_KITS; follow: KitCompanion; actor?: CharacterKit; loading?: Promise<void>; error?: unknown; retryAt: number; failures: number }> = [
  { markerId: 'blackbeard_meet', servant: 'blackbeard', kit: 'blackbeard', follow: companion(12, 12, 'ranged'), retryAt: 0, failures: 0 },
  { markerId: 'napoleon_meet', servant: 'napoleon', kit: 'napoleonMounted', follow: companion(4.5, 16), retryAt: 0, failures: 0 },
  { markerId: 'musashi_meet', servant: 'musashi', kit: 'musashi', follow: companion(3.5, 9), retryAt: 0, failures: 0 },
];
let eraActorsDisposed = false;
let inspectServant = false;
const servantRoot = () => contract.selected === 'saber' ? servant.root : eraActors.find((e) => e.servant === contract.selected)?.actor?.root;
// Same studio light as Saber's model (scene.environment is unset), so every servant reads equally lit.
let servantEnv: THREE.Texture | undefined;
const servantEnvironment = () => {
  if (!servantEnv) { const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer); servantEnv = pmrem.fromScene(room).texture; room.dispose(); pmrem.dispose(); }
  return servantEnv;
};
// Servant studio reflections follow the scene: daylight keeps the authored strength, dusk/storm/night dim it
// so the hemisphere and sun (already tinted by twilight) dominate, like the player model.
const servantBase = new WeakMap<THREE.Material, number>();
function matchServantLighting() {
  const lum = (c: THREE.Color) => .2126 * c.r + .7152 * c.g + .0722 * c.b;
  const light = lum(sun.color) * sun.intensity + lum(hemisphere.color) * hemisphere.intensity * .6;
  // Valley daytime values from the light setup above, so starting in a dusk region cannot shift the baseline.
  const daylight = lum(new THREE.Color('#fff0d2')) * 2.7 + lum(new THREE.Color('#d6ecff')) * 1.15 * .6;
  const k = THREE.MathUtils.clamp(light / daylight, .25, 1.1);
  const roots = [servant.root, ...eraActors.map((e) => e.actor?.root)];
  for (const root of roots) root?.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const std = m as THREE.MeshStandardMaterial; if (!std.envMap) continue;
      if (!servantBase.has(m)) servantBase.set(m, std.envMapIntensity);
      std.envMapIntensity = servantBase.get(m)! * k * k; // squared: reflections fade faster than direct light
    }
  });
}
const companionEnabled = () => !combat.defeated && !player.flying && !player.swimming && !player.gliding;
const servantName = (id: ServantId | null) => { const s = SERVANTS.find((x) => x.id === id) ?? SERVANTS[0]; return { zh: s.name, en: s.nameEn }; };
function servantStatus() {
  const n = servantName(contract.selected);
  return bilingual(`${n.zh} · ${contract.companionSummoned ? '同行中' : '已收回'}`, `${n.en} · ${contract.companionSummoned ? 'Following' : 'Recalled'}`);
}
function updateEraActors(dt: number) {
  if (eraActorsDisposed) return;
  const now = performance.now();
  for (const entry of eraActors) {
    const marker = markers.get(entry.markerId);
    if (!marker) continue;
    const nearMarker = player.pos.distanceTo(new THREE.Vector3(...marker.p)) < 110;
    const following = contract.isFollowing(entry.servant) && companionEnabled();
    const nearby = nearMarker || following;
    if (nearby && !entry.actor && !entry.loading && now >= entry.retryAt) {
      entry.loading = loadCharacterKit(CHARACTER_KITS[entry.kit], { environment: servantEnvironment(), onEvent: (event) => { if (entry.actor) entry.follow.onEvent(entry.actor, event); } })
        .then((actor) => {
          if (eraActorsDisposed) { actor.dispose(); return; }
          entry.failures = 0; entry.error = undefined;
          entry.actor = actor;
          actor.root.position.fromArray(marker.p);
          actor.root.rotation.y = Math.PI;
          scene.add(actor.root);
        })
        .catch((error) => {
          entry.error = error;
          entry.failures++;
          entry.retryAt = performance.now() + Math.min(30_000, 1_000 * 2 ** Math.min(5, entry.failures - 1));
          console.warn(`Could not load ${entry.kit} servant; retrying with backoff`, error);
        })
        .finally(() => { entry.loading = undefined; });
    }
    if (!entry.actor) continue;
    entry.actor.root.visible = nearby;
    if (following) { entry.follow.update(entry.actor, dt, player.pos, anim.facing - Math.PI, !gameplayActive()); continue; }
    entry.follow.release(entry.actor);
    // Not following: wait at the meeting spot (also after the contract, until chosen).
    entry.actor.root.position.fromArray(marker.p); entry.actor.root.rotation.y = Math.PI;
    entry.actor.update(dt, !nearby || !gameplayActive());
  }
}
const servantPanel = createServantPanel(servant, contract, () => { abortUltimate(); clearInput(); if (document.pointerLockElement) document.exitPointerLock(); });
const contractCard = document.createElement('div');
contractCard.id = 'contract-card'; contractCard.className = 'hud';
Object.assign(contractCard.style, { right: '18px', top: '222px', width: '230px', padding: '12px', borderRadius: '12px',
  background: 'rgba(20,30,52,.85)', color: '#f8eaca', fontSize: '12px', lineHeight: '1.6' });
document.body.append(contractCard);
function renderContract() {
  servantPanel.render();
  const state = contract.selected && contract.selected !== 'saber' ? servantStatus() : servant.status;
  const multi = contract.roster.length > 1 ? bilingual(`\n[${settings.label('switchServant')}] 切换从者（${contract.roster.length} 位已缔约）`, `\n[${settings.label('switchServant')}] Switch servant (${contract.roster.length} contracted)`) : '';
  const hint = contract.anyRecruited ? bilingual(`[${settings.label('summon')}] 召唤／收回 · 协助攻击`, `[${settings.label('summon')}] Summon / recall · Assists in combat`) + multi
    : bilingual('前往圣剑湖，与第一位契约从者会面', 'Visit Sword Lake to meet your first contracted servant');
  const regroup = contract.companionSummoned && performance.now() < companionRegroupUntil ? bilingual('\n已安全归队', '\nSafely regrouped') : '';
  const next = `${state}${regroup}\n${hint}`;
  if (contractCard.textContent !== next) contractCard.textContent = next;
  contractCard.style.whiteSpace = 'pre-line';
}
addEventListener('pagehide', (event) => { if (!event.persisted) {
  eraActorsDisposed = true;
  servantPanel.dispose(); servant.dispose();
  for (const entry of eraActors) entry.actor?.dispose();
} });
function resetProgress() {
  abortUltimate(); clearInput(); deferredCombatToast = null;
  const saved = worldProgress.reset();
  campaignTrackedRegion = null;
  // Reset is a new game, not another debug start on the next reload. Keep all unrelated options
  // and the hash; replaceState changes no page and adds no browser-history entry.
  clearStartOverrides(params);
  const url = new URL(location.href); clearStartOverrides(url.searchParams);
  try { history.replaceState(history.state, '', url.href); } catch { /* Restricted embedding may prohibit URL writes. */ }
  companionRegroupUntil = 0; actions?.reset(); fortCannon.reset(); contract.reset(); combat.reset();
  spawn = initialSpawn;
  player.restartAt(initialSpawn.p[0], initialSpawn.p[1] + 1, initialSpawn.p[2], 0);
  prevPos.copy(player.pos); rig.root.position.copy(player.pos);
  anim.reset(worldProgress.armed, player.yaw + Math.PI);
  inspectServant = false; thirdPerson = true; rig.root.visible = true;
  servant.update(0, player.pos, anim.facing - Math.PI, false, true);
  for (const entry of eraActors) {
    entry.follow.release(entry.actor);
    if (entry.actor) {
      const marker = markers.get(entry.markerId)!;
      entry.actor.root.position.fromArray(marker.p); entry.actor.root.rotation.y = Math.PI;
      entry.actor.root.visible = false;
    }
  }
  cold.warmth = 100; cold.frozen = false; cold.warned = false; cold.reserve = 0; optionalPin = null;
  coldHud.hidden = true; frost.style.opacity = '0';
  acc = 0; camDist = 3.6; currentArea = ''; lastRegion = 'alpha';
  camera.fov = baseFov; camera.updateProjectionMatrix();
  $('crosshair').classList.remove('aiming', 'hit');
  $('movement-mode').textContent = ''; $('prompt').textContent = '';
  applyWorldState(); renderContract();
  toast(saved ? bilingual('进度已重置 · 已空手返回初始营地', 'Progress reset · Returned unarmed to the starting camp')
    : bilingual('已空手返回初始营地；浏览器无法保存重置，刷新可能恢复旧进度', 'Returned unarmed to the starting camp; reset could not be saved, so reloading may restore old progress'));
}
const keys = new Set<string>();
const aim = new ShoulderAim();
const settings = new SettingsStore('world');
let locked = false;
const start = $('start');
// Screenshot mode leaves only the canvas; only a click on the screen restores the HUD.
$('shot-mode').addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.add('shot-mode'); });
let swallowClick = false;
for (const type of ['pointerdown', 'mousedown', 'click'] as const) document.addEventListener(type, (e) => {
  const shooting = document.body?.classList.contains('shot-mode');
  if (!shooting && !(type === 'click' && swallowClick)) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (type === 'click') { swallowClick = false; return; }
  if (type === 'pointerdown') swallowClick = true;
  document.body.classList.remove('shot-mode');
}, true);
const clearInput = () => { keys.clear(); aim.clear(); narrative?.hide(); if (!ultimateDirector?.active) actions?.cancel(); fortCannon.cancel(); hudRevision++; };
const settingsPanel = createSettingsPanel(settings, {
  onOpen() { abortUltimate(); clearInput(); if (document.pointerLockElement) document.exitPointerLock(); },
  onClose() { clearInput(); },
});
$('settings-open').addEventListener('click', (e) => { e.stopPropagation(); settingsPanel.show(); });
// Settings → 界面显示: every hideable HUD panel, remembered on this device (J/H stay as shortcuts).
if (typeof document.querySelector === 'function') {
  const panels: Array<[HudPanel, string]> = [['objective', '显示任务栏'], ['help', '显示帮助'], ['minimap', '显示小地图'], ['contract-card', '显示从者卡片']];
  const group = document.createElement('div'); group.className = 'settings-sliders';
  const title = document.createElement('p'); title.className = 'settings-note'; title.textContent = '界面显示'; group.append(title);
  for (const [id, text] of panels) {
    try { if (localStorage.getItem(`parhelion.world.hide.${id}`) === '1') $(id).style.display = 'none'; } catch { /* ignore */ }
    const label = document.createElement('label'); label.className = 'settings-check';
    const box = document.createElement('input'); box.type = 'checkbox'; box.dataset.hudPanel = id; box.checked = $(id).style.display !== 'none';
    box.addEventListener('change', () => togglePanel(id, !box.checked));
    label.append(box, ` ${text}`); group.append(label);
  }
  document.querySelector('#world-settings .settings-sliders')?.after(group);
  localizeDom(group);
}
const gameplayActive = () => !ultimateDirector?.active && locked && !inspectServant && !travelOpenState && !campaignJournalOpen && !narrative?.open && !settingsPanel.open && document.visibilityState === 'visible' && document.hasFocus() && !$('bigmap').classList.contains('open');
const down = (action: string) => settings.isDown(keys, action);
function renderControlHints() {
  const k = (action: string) => settings.label(action);
  const moves = `${k('forward')}/${k('left')}/${k('back')}/${k('right')}`;
  $('help').textContent = bilingual(
    `${moves} 移动 · ${k('sprint')} 奔跑 · ${k('jump')} 跳／空中滑翔\n${k('fire')} 射击 · ${k('aim')} 按住肩射瞄准 · ${k('interact')} 互动\n${k('melee')} 近战 · ${k('evade')} 闪避 · ${k('skill')} 战技 · ${k('ultimate')} 终结技 · ${k('travel')} 据点旅行\n${k('summon')} 召唤／收回从者 · ${k('switchServant')} 切换从者 · ${k('inspectServant')} 查看从者模型 · ${k('map')} 大地图 · ${k('guide')} 任务指引 · ${k('objectives')} 任务栏 · ${k('help')} 帮助 · ${k('settings')} 设置 · Esc 释放鼠标`,
    `${moves} Move · ${k('sprint')} Sprint · ${k('jump')} Jump / glide in air\n${k('fire')} Fire · ${k('aim')} Hold shoulder aim · ${k('interact')} Interact\n${k('melee')} Melee · ${k('evade')} Evade · ${k('skill')} Skill · ${k('ultimate')} Ultimate · ${k('travel')} Safe travel\n${k('summon')} Summon / recall Servant · ${k('switchServant')} Switch servant · ${k('inspectServant')} View servant model · ${k('map')} World map · ${k('guide')} Quest guide · ${k('objectives')} Quest panel · ${k('help')} Help · ${k('settings')} Settings · Esc Release mouse`);

}
settings.subscribe(() => { clearInput(); renderControlHints(); }); renderControlHints();
const lockError = () => {
  if (locked) return;
  clearInput();
  setLoading('无法锁定鼠标，请再次点击进入（或检查浏览器权限）');
  start.classList.remove('hidden');
};
setLoading('点击进入（ESC 释放鼠标）');
start.addEventListener('click', async (e) => {
  audio.unlock(e);
  if (settingsPanel.open) return;
  try { await canvas.requestPointerLock(); } catch { lockError(); }
});
document.addEventListener('pointerlockerror', lockError);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  clearInput();
  if (!locked) { inspectServant = false; $('bigmap').classList.remove('open'); }
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
function requestProgressReset() {
  clearInput();
  if (document.pointerLockElement) document.exitPointerLock();
  let accepted = false;
  try { accepted = window.confirm(bilingual('确定开始新游戏吗？这会清除大世界任务、契约和发现，并空手回到初始营地。按键、语言和画质设置保留。', 'Start a new game? This clears World quests, contracts and discoveries, returning you unarmed to the starting camp. Controls, language and graphics settings are kept.')); } catch { /* An unavailable confirmation never destroys progress. */ }
  if (accepted) resetProgress();
}
function press(binding: string, repeat = false) {
  const action = settings.action(binding);
  if (!action || !locked || settingsPanel.open || document.visibilityState !== 'visible' || !document.hasFocus()) return;
  if (action === 'interact' && narrative?.open) { if (!repeat) { narrative.advance(); hudRevision++; } return; }
  if (action === 'travel') { if (!repeat) travelPanel.show(); return; }
  if (action === 'settings') { if (!repeat) settingsPanel.show(); return; }
  if (action === 'map') {
    if (!repeat) { clearInput(); $('bigmap').classList.toggle('open'); }
    return;
  }
  if (action === 'inspectServant') {
    if (repeat || combat.defeated || $('bigmap').classList.contains('open')) return;
    clearInput();
    inspectServant = !inspectServant && !!servantRoot()?.visible;
    toast(inspectServant ? bilingual(`查看从者模型 · 再按 ${settings.label('inspectServant')} 返回`, `Servant model view · Press ${settings.label('inspectServant')} to return`) : bilingual('已返回游戏视角', 'Back to gameplay view'));
    return;
  }
  if (!gameplayActive() || combat.defeated) return;
  if (repeat) return;
  if (actions?.press(action)) { hudRevision++; return; }
  keys.add(binding);
  if (action === 'aim') aim.held = true;
  if (action === 'fire') shoot();
  if (action === 'fly') { clearInput(); player.flying = !player.flying; toast(player.flying ? '自由飞行调试 开 · 抬头前进上升，低头前进下降' : '自由飞行调试 关 · 恢复跳跃／滑翔'); }
  if (action === 'collision') { debugCol.visible = !debugCol.visible; toast(debugCol.visible ? '显示碰撞体' : '隐藏碰撞体'); }
  if (action === 'guide') toggleGuide();
  if (action === 'mainRoute') { optionalPin = null; campaignTrackedRegion = null; guideOn = true; hudRevision++; toast(bilingual('已返回主线指引。', 'Main-story guidance restored.')); }
  if (action === 'help') togglePanel('help');
  if (action === 'objectives') togglePanel('objective');
  if (action === 'interact' && !player.flying && !player.gliding && !player.swimming && player.onGround && !interactSettlementNpc()) interact();
  if (action === 'summon') {
    if (contract.toggle()) { const n = servantName(contract.selected); toast(contract.companionSummoned ? bilingual(`${n.zh} 已召唤`, `${n.en} summoned`) : bilingual(`${n.zh} 已收回`, `${n.en} recalled`)); }
    else toast(bilingual('先前往圣剑湖缔结第一份契约', 'Form your first contract at Sword Lake'));
  }
  if (action === 'switchServant') {
    const next = contract.cycle();
    if (next) { const n = servantName(next); toast(bilingual(`切换从者：${n.zh}`, `Servant switched: ${n.en}`)); }
    else toast(bilingual('缔结第二份契约后才能切换从者', 'Contract a second servant to switch'));
  }
  if (action === 'reset' && !down('sprint')) requestProgressReset();
  if (action.startsWith('teleport')) {
    clearInput(); const n = Number(action.slice('teleport'.length));
    const here = layout.areas.filter((a) => a.region === regionAt(player.pos.x, player.pos.z).id);
    if (n >= 1 && n <= here.length) spawnAt(here[n - 1].id);
  }
}
function release(binding: string) { keys.delete(binding); if (settings.action(binding) === 'aim') aim.held = down('aim'); }
addEventListener('keydown', (e) => {
  audio.unlock(e);
  if (e.metaKey || e.ctrlKey || e.altKey) { clearInput(); return; }
  if (narrative?.choosing && settings.action(e.code) !== 'interact' && locked && !settingsPanel.open && document.visibilityState === 'visible' && document.hasFocus()) {
    const index = /^Digit[1-9]$/.test(e.code) ? Number(e.code.slice(5)) - 1 : -1;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || index >= 0) {
      e.preventDefault();
      if (!e.repeat) { if (index >= 0) narrative.selectChoice(index); else narrative.moveChoice(e.code === 'ArrowUp' ? -1 : 1); }
      return;
    }
  }
  if (!settingsPanel.open && locked && settings.action(e.code)) e.preventDefault();
  press(e.code, e.repeat);
});
addEventListener('keyup', (e) => release(e.code));
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('auxclick', (e) => { if (locked || settingsPanel.open) e.preventDefault(); });
addEventListener('mousedown', (e) => { audio.unlock(e); if (!settingsPanel.open && locked) { e.preventDefault(); press(`Mouse${e.button}`); } });
addEventListener('mouseup', (e) => release(`Mouse${e.button}`));
addEventListener('wheel', (e) => {
  if (!gameplayActive()) return;
  e.preventDefault(); const binding = e.deltaY > 0 ? 'WheelDown' : 'WheelUp'; press(binding); release(binding);
}, { passive: false });

// ───────────── shooting (hitscan + visible bounded projectiles) ─────────────
const combat = new WorldCombat({ scene, colliders, layout, done, toast: combatToast, groundHeight: (x, z) => grid.sampleHeight(x, z),
  onVictory(core) { done.add(core); save(); applyWorldState(); },
  onDamage(hit) { actions?.recordDamage(hit); audio.contact(); },
  onHurt() { audio.hurt(); },
  onKill(id) { audio.kill(); if (id === 'elite_oath_knight') { if (optionalPin?.kind === 'trial') { optionalPin = null; hudRevision++; } save(); applyWorldState(); } },
  onPlayerDefeated() { spawnAt(); clearInput(); toast(bilingual('已回到安全地点 · 任务进度保留', 'Returned to safety · Quest progress kept')); },
});
addEventListener('pagehide', (event) => { if (!event.persisted) combat.dispose(); });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let reducedOverride: boolean | null = null;
try { const stored=localStorage.getItem('parhelion-world-reduced-effects'); if(stored==='1'||stored==='0')reducedOverride=stored==='1'; } catch { /* use system preference */ }
const reducedEffects = () => reducedOverride ?? reducedMotion.matches;
const actionClockActive = () => gameplayActive() || (!!ultimateDirector?.releasing && document.visibilityState === 'visible' && document.hasFocus() && !settingsPanel.open && !servantPanel.open);
actions = new WorldActions({ scene,
  context: () => ({ clockRunning: actionClockActive() && !combat.defeated, enabled: actionClockActive() && !fortCannon.mounted && !inspectServant && !combat.defeated && !player.flying && !player.swimming && !player.gliding,
    grounded: player.onGround, armed: worldProgress.armed, bladeReady: blade.loaded, bladeFailed: blade.root.userData.artState === 'error', position: player.pos, yaw: player.yaw,
    moveX: Number(down('right')) - Number(down('left')), moveZ: Number(down('forward')) - Number(down('back')),
    identity: contract.companionSummoned ? contract.selected : null }),
  strike: (strike, source) => combat.applyStrike(strike, source),
  defense: value => combat.setDefense(value), toast, reducedEffects, bladeOrigin: () => blade.root.getWorldPosition(new THREE.Vector3()), bladeDirection: () => blade.root.getWorldDirection(new THREE.Vector3()),
  cue: kind => audio[kind](), skillEvent: event => { audio.skillEvent(event); if (event.type === 'strike' && event.slot === 'ultimate') ultimateDirector?.notifyStrike(); },
  onCast: event => { actionHud.announce(event); beginUltimate(event); },
  contactPoint: id => { const enemy = combat.state.enemies.find(e => e.id === id); return enemy ? { ...enemy.p } : null; },
  resolveAim: (identity, slot) => {
    const root = identity === 'saber' ? servant.root : eraActors.find(e => e.servant === identity)?.actor?.root;
    if (!root?.visible || root.position.distanceTo(player.pos) >= 16) return null;
    const range = Math.max(...CONTRACT_SKILLS[identity][slot].pulses.map(pulse => pulse.range));
    return resolveServantSkillAim({ player: player.pos, caster: root.position, viewOrigin: camera.position, viewDirection: camera.getWorldDirection(new THREE.Vector3()), range, enemies: combat.state.enemies, terrain: combat.geometry.terrain });
  },
  startPose: (identity, command) => {
    if (identity === 'saber') return servant.root.visible && servant.root.position.distanceTo(player.pos) < 16 && servant.startSkillPose(command);
    const entry = eraActors.find(e => e.servant === identity);
    return !!entry?.actor?.root.visible && entry.actor.root.position.distanceTo(player.pos) < 16 && entry.follow.startSkillPose(entry.actor, command, player.pos, player.yaw);
  },
  cancelPoses: () => { servant.cancelSkillPose(); for (const entry of eraActors) entry.follow.cancelSkillPose(entry.actor); },
});
ultimateStage = new UltimateStage();
ultimateDirector = new UltimateDirector({ cutInUrls: {
  saber: new URL('../assets/cinematics/saber-cut-in-v2.webp', import.meta.url).href,
  blackbeard: new URL('../assets/cinematics/blackbeard-cut-in-v2.webp', import.meta.url).href,
  napoleon: new URL('../assets/cinematics/napoleon-cut-in-v2.webp', import.meta.url).href,
  musashi: new URL('../assets/cinematics/musashi-cut-in-v2.webp', import.meta.url).href,
}, reducedEffects, onEnd: () => { audio.cinematicFrame(null); ultimateStage?.end(); ultimateSource = null; hudRevision++; } });
document.querySelector('#world-settings .settings-sliders')?.after(ultimateDirector.settingsControl);
function presentationModel(identity: ServantId | null): THREE.Object3D | null {
  return identity === null ? rig.model : identity === 'saber' ? servant.presentationModel : eraActors.find(entry => entry.servant === identity)?.actor?.model ?? null;
}
function beginUltimate(event: Extract<SkillEvent, { type: 'cast' }>) {
  if (event.slot !== 'ultimate' || !ultimateDirector || !ultimateStage || ultimateDirector.active) return;
  const model = presentationModel(event.identity); if (!model) return;
  keys.clear(); aim.clear();
  ultimateSource = { identity: event.identity, root: model };
  if (!ultimateDirector.begin(event.identity ?? 'player')) { ultimateSource = null; return; }
  const clips = event.identity === 'saber' ? servant.presentationClips : event.identity ? eraActors.find(entry => entry.servant === event.identity)?.actor?.presentationClips : [];
  if (ultimateDirector.showing) {
    try { ultimateStage.begin({ identity: event.identity ?? 'player', sourceRoot: model, clips, reducedEffects: reducedEffects() || ultimateDirector.frame?.reduced }); }
    catch (error) { ultimateStage.end(); ultimateDirector.skip(); console.warn('Ultimate stage unavailable; continuing the original cast without close-up.', error); }
  }
  hudRevision++;
}
function abortUltimate() { ultimateDirector?.abort(); ultimateStage?.end(); ultimateSource = null; actions?.cancel(); }
/** Presentation never owns damage. Only the original accepted action and actor
 * advance here; all other world clocks stay frozen in Full, Short and Off. */
function frameUltimate(dt: number): boolean {
  if (!ultimateDirector?.active || !ultimateStage || !ultimateSource || !actions) return false;
  const identity = contract.companionSummoned ? contract.selected : null;
  if (combat.defeated || identity !== ultimateSource.identity || presentationModel(identity) !== ultimateSource.root) { abortUltimate(); return false; }
  const suspended = document.visibilityState !== 'visible' || !document.hasFocus() || settingsPanel.open || servantPanel.open;
  keys.clear(); aim.clear(); acc = 0; prevPos.copy(player.pos);
  audio.setActive(!suspended);
  ultimateDirector.tick(dt, suspended);
  if (!suspended && ultimateDirector.releasing) {
    // Establish the facade's playable context without advancing enemy AI/HP clocks.
    combat.present(0, player.pos, true, camera);
    let remaining = Math.max(0, Math.min(.1, dt));
    while (remaining > 1e-9 && actions.skills.casting && ultimateDirector.releasing) {
      const step = Math.min(STEP, remaining); remaining -= step;
      actions.update(step);
      if (identity === 'saber') servant.update(step, player.pos, player.yaw, true, false);
      else if (identity) { const entry = eraActors.find(value => value.servant === identity); if (entry?.actor) entry.follow.update(entry.actor, step, player.pos, anim.facing - Math.PI, false); }
      actions.flush();
    }
    actions.present(dt);
    if (!actions.skills.casting) ultimateDirector.complete();
  }
  const state = ultimateDirector.frame;
  if (state && ultimateSource && ultimateDirector.showing && ultimateStage.isActive) {
    audio.cinematicFrame(state);
    ultimateStage.update({ ...state, reduced: state.reduced || reducedEffects(), sourceRoot: ultimateSource.root });
    try { ultimateStage.render(renderer, innerWidth / Math.max(1, innerHeight)); }
    catch (error) { ultimateStage.end(); ultimateDirector.skip(); console.warn('Ultimate renderer failed; continuing the cast in the world.', error); renderer.render(scene, camera); }
  } else { audio.cinematicFrame(null); combat.present(0, player.pos, !suspended, camera); renderer.render(scene, camera); }
  actionHud.update(actions, !ultimateDirector.showing); renderContract();
  return true;
}
addEventListener('pagehide', event => { if (!event.persisted) { abortUltimate(); ultimateDirector?.dispose(); ultimateStage?.dispose(); } });
narrative = createNarrativePanel(() => settings.label('interact'));
function speakDialogue(line: [string,string], speaker: [string,string] = ['交谈','Conversation']) {
  clearInput(); narrative!.show(line,speaker); hudRevision++; audio.interaction();
}
const actionHud = createActionHud(action => settings.label(action));
weaponFinishControl = createWeaponFinishControl(weaponFinishStore, done, () => applyWeaponFinish());
document.querySelector('#world-settings .settings-sliders')?.after(weaponFinishControl.root);
addEventListener('pagehide', event => { if (!event.persisted) weaponFinishControl?.dispose(); });
const progressPanel = createProgressPanel(worldProgress, () => { abortUltimate(); clearInput(); location.reload(); });
document.querySelector('#world-settings .settings-sliders')?.after(progressPanel.root);
addEventListener('pagehide', event => { if (!event.persisted) progressPanel.dispose(); });
const audioGroup=document.createElement('div');audioGroup.className='settings-sliders';
const volumeLabel=document.createElement('label'),volumeText=document.createElement('span'),volume=document.createElement('input');
volume.type='range';volume.min='0';volume.max='1';volume.step='.05';volume.value=String(audio.volume);volume.id='world-audio-volume';volumeLabel.append(volumeText,volume);
const muteLabel=document.createElement('label'),muteText=document.createElement('span'),mute=document.createElement('input');mute.type='checkbox';mute.checked=audio.muted;mute.id='world-audio-muted';muteLabel.append(muteText,mute);
const fxLabel=document.createElement('label'),fxText=document.createElement('span'),fxToggle=document.createElement('input');fxToggle.type='checkbox';fxToggle.id='world-reduced-effects';fxToggle.checked=reducedEffects();fxLabel.append(fxText,fxToggle);
fxToggle.onchange=()=>{reducedOverride=fxToggle.checked;try{localStorage.setItem('parhelion-world-reduced-effects',reducedOverride?'1':'0');}catch{/* session preference only */}};
const renderAudioSettings=()=>{fxText.textContent=bilingual('降低技能闪光','Reduce ability flashes');volumeText.textContent=bilingual('战斗音效音量','Combat sound volume');muteText.textContent=bilingual('静音音效','Mute sound effects');};
volume.oninput=()=>audio.setVolume(Number(volume.value));mute.onchange=()=>audio.setMuted(mute.checked);
audioGroup.append(volumeLabel,muteLabel,fxLabel);document.querySelector('#world-settings .settings-sliders')?.after(audioGroup);renderAudioSettings();onLanguageChange(renderAudioSettings);
addEventListener('pagehide', event => { if (!event.persisted) { actions?.dispose(); actionHud.dispose(); } });
function travelContext(): TravelContext {
  const threatened = combat.state.enemies.some(e => e.active && !e.pacified && e.mode !== 'dead' && Math.hypot(e.p.x-player.pos.x,e.p.z-player.pos.z)<28);
  return { sessionReady: true, defeated: combat.defeated, combatActive: combat.bossStarted, threatened, quietSeconds: combat.state.quietFor,
    flying: player.flying, gliding: player.gliding, swimming: player.swimming, onGround: player.onGround,
    mounted: fortCannon.mounted, actionActive: !!(actions?.skills.casting || actions?.melee.active || actions?.evade.active) };
}
function executeSafeTravel(id: string) {
  if (ultimateDirector?.active) { toast(bilingual('终结技释放期间不能旅行。', 'Travel is unavailable during an ultimate.')); return false; }
  const plan = planSafeTravel(id, travelStops, done, found, travelContext());
  if (!plan.ok) { toast(bilingual(...TRAVEL_BLOCK_TEXT[plan.reason])); return false; }
  const [x, y, z] = plan.position, landing = combat.geometry.ground(x,z,y+2);
  if (!landing || Math.abs(landing.point.y-y)>1 || !combat.geometry.clear(landing.point,.38,1.8)) { toast(bilingual('据点落点暂不可用，已取消传送。','The arrival point is not clear; travel canceled.')); return false; }
  clearInput(); optionalPin = null;
  player.teleport(x,landing.point.y+.25,z,plan.yaw); prevPos.copy(player.pos); rig.root.position.copy(player.pos);
  anim.reset(worldProgress.armed,player.yaw+Math.PI); camDist=3.6; acc=0; inspectServant=false;
  spawn={id,type:'spawn',p:[x,landing.point.y,z],label:'营地'};
  hudRevision++; toast(bilingual('已抵达安全据点，进度与当前生命保留。','Arrived at a safe settlement. Progress and current health retained.'));
  return true;
}
const travelPanel = createTravelPanel({
  entries: () => travelStops.map(stop => { const reason=getTravelBlock(stop.id,travelStops,done,found,travelContext()); return {id:stop.id,name:stop.name,discovered:isTravelStopDiscovered(stop,done,found),blocked:reason?TRAVEL_BLOCK_TEXT[reason]:null}; }),
  travel: executeSafeTravel,
  onOpen: () => {
    if (campaignJournalOpen) return false;
    const context=travelContext();
    if(context.mounted||context.actionActive){toast(bilingual(...TRAVEL_BLOCK_TEXT.busy));return false;}
    travelOpenState=true;clearInput();if(document.pointerLockElement)document.exitPointerLock();return true;
  },
  onClose: () => { travelOpenState=false;clearInput(); },
});
const travelOpen=document.createElement('button'); travelOpen.type='button';travelOpen.id='world-travel-open';
const renderTravelButton=()=>{travelOpen.textContent=bilingual(`安全据点旅行 · ${settings.label('travel')}`,`Safe settlement travel · ${settings.label('travel')}`);};
renderTravelButton();onLanguageChange(()=>{renderTravelButton();travelPanel.refresh();});
travelOpen.addEventListener('click',event=>{event.stopPropagation();travelPanel.show();}); start.append(travelOpen);
addEventListener('pagehide',event=>{if(!event.persisted){audio.dispose();narrative?.dispose();travelPanel.dispose();travelOpen.remove();}});
const campaignTrackingBlocked = (region: RegionId): [string, string] | null => region !== regionAt(player.pos.x, player.pos.z).id && !done.has('summon_circle')
  ? ['先沿主线稳定召唤阵，开启通往其他年代的道路。', 'Stabilize the summoning circle on the main route to open roads to other eras.'] : null;
campaignJournal = createCampaignJournal({
  done: () => done,
  onOpen: () => {
    if (travelOpenState || settingsPanel.open || servantPanel.open || ultimateDirector?.active || fortCannon.mounted || actions?.skills.casting || actions?.melee.active || actions?.evade.active) return false;
    campaignJournalOpen = true; clearInput(); if (document.pointerLockElement) document.exitPointerLock(); return true;
  },
  onClose: () => { campaignJournalOpen = false; clearInput(); },
  trackingBlocked: campaignTrackingBlocked,
  pin: region => { if (campaignTrackingBlocked(region) || !getCampaignEpisodeGuide(region, done)) return false; campaignTrackedRegion = region; optionalPin = null; guideOn = true; hudRevision++; return true; },
  restoreMain: () => { campaignTrackedRegion = null; optionalPin = null; guideOn = true; hudRevision++; },
});
const journalOpen = document.createElement('button'); journalOpen.type = 'button'; journalOpen.id = 'world-campaign-journal-open';
const renderJournalButton = () => { journalOpen.textContent = bilingual('归路纪事 · 现场故事与进度', 'Way Home Chronicles · Stories and progress'); };
renderJournalButton(); const unsubscribeJournalButton = onLanguageChange(renderJournalButton);
journalOpen.addEventListener('click', event => { event.stopPropagation(); campaignJournal?.show(); }); start.append(journalOpen);
addEventListener('pagehide', event => { if (!event.persisted) { campaignJournal?.dispose(); journalOpen.remove(); unsubscribeJournalButton(); } });
const ray = new THREE.Raycaster();
function shootCannon() {
  if (!gameplayActive() || player.flying || combat.defeated || !fortCannon.mounted || fortCannon.reload > 0) return;
  const origin = camera.position.clone(), look = camera.getWorldDirection(new THREE.Vector3());
  const targetCollider = (c: Collider) => c.name.startsWith('COL_TGT_');
  ray.set(origin, look); ray.far = FORT_CANNON.range;
  const wall = combat.geometry.cast(origin, look, FORT_CANNON.range, targetCollider);
  const target = ray.intersectObjects(targets.filter(t => t.visible), false)[0];
  const validTarget = target && target.distance <= (wall?.distance ?? Infinity) + .04 ? target : undefined;
  const enemy = combat.raycast(origin, look, Math.min(wall?.distance ?? FORT_CANNON.range, validTarget?.distance ?? Infinity));
  const point = enemy ? new THREE.Vector3(enemy.point.x, enemy.point.y, enemy.point.z)
    : validTarget ? validTarget.point.clone() : wall ? wall.point.clone() : origin.clone().addScaledVector(look, FORT_CANNON.range - 10);
  if (!fortCannon.canAim(point)) return;
  const muzzle = new THREE.Vector3(FORT_CANNON.muzzle.x, FORT_CANNON.muzzle.y, FORT_CANNON.muzzle.z);
  const path = point.clone().sub(muzzle), blocked = combat.geometry.cast(muzzle, path, Math.max(0,path.length()-.15), targetCollider);
  if (!fortCannon.fire(point)) return;
  if (blocked) point.copy(blocked.point);
  else if (enemy) combat.damageEnemy(enemy.id, 110, { source: 'skill', origin: muzzle });
  else if (validTarget) {
    const id = validTarget.object.userData.target as string;
    const required = validTarget.object.userData.needs as string | undefined;
    if (id && (!required || done.has(required))) { done.add(id); save(); applyWorldState(); const reaction = getEraProgressReaction(id, done); if (reaction) toast(bilingual(...reaction)); }
  }
  combat.shot(muzzle, point, !!(blocked || enemy || validTarget)); audio.cannon();
  hudRevision++;
}
function shoot() {
  if (fortCannon.mounted) { shootCannon(); return; }
  if (!worldProgress.armed || !gameplayActive() || inspectServant || player.flying || actions?.melee.active || (actions?.skills.casting && actions.skills.selected === null) || actions?.evade.active || !combat.canShoot()) return;
  const targetCollider = (c: Collider) => c.name.startsWith('COL_TGT_');
  const origin = camera.position.clone();
  const look = camera.getWorldDirection(new THREE.Vector3());
  // An input-event shot can precede RAF or follow stationary free-look. Match the actual camera
  // ray synchronously (heading AND pitch), not stale locomotion facing or a back-slung gun.
  anim.prepareShot(look);
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
  } else if (questHit && questHit.object.userData.needs === FORT_CANNON.marker) {
    toast(bilingual(`幽灵艇需要要塞炮：到炮位按 ${settings.label('interact')} 操作，再开火。`, 'Ghost boats need the fort cannon: interact at the station, then fire.'));
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
    else if (group === 'kikyo_banner') toast(n === 3 ? '三面桔梗大旗全部烧毁：明智本阵里亮起了京之碎片' : `桔梗大旗烧毁 ${n}/3`);
    else if (group === 'frost_seal') toast(n === 3 ? '三枚冰封印全部碎裂：峡谷里的冰墙崩塌了' : `冰封印击碎 ${n}/3`);
    else if (group === 'ghost_boat') toast(n === 3 ? '幽灵小艇全部击沉：火药库里亮起了海之碎片' : `炮击命中 幽灵小艇 ${n}/3`);
    else toast(n === 3 ? '机关解除：神龛之门打开了' : `机关靶命中 ${n}/3`);
    save(); applyWorldState();
    const reaction = getEraProgressReaction(id, done); if (reaction) toast(bilingual(...reaction));
    combat.flashHitMarker(.14);
  }
  combat.shot(blockedMount ? shoulder : muzzle,point,hitSomething); audio.shot();
}

// ───────────── interaction / discovery ─────────────
function nearestInteract(): Marker | null {
  let best: Marker | null = null, bd = Infinity;
  for (const m of layout.markers) {
    if (m.type !== 'interact') continue;
    const d = Math.hypot(player.pos.x - m.p[0], player.pos.y - m.p[1], player.pos.z - m.p[2]);
    if (d < (m.radius ?? 3) && d < bd && ((m.id !== VALLEY_STORY.discovery && !eraOptionalIds.has(m.id) && !campaignMarkerIds.has(m.id)) || canReachValleyPanel(m))) { bd = d; best = m; }
  }
  return best;
}
function canReachValleyPanel(marker: Marker) {
  const from = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
  const direction = new THREE.Vector3(...marker.p).sub(from), distance = direction.length();
  return distance <= .05 || !combat.geometry.cast(from, direction, Math.max(0, distance - .08));
}
function nearbySettlementNpc() {
  const npc = settlementNpcs.nearest(player.pos);
  if (!npc) return null;
  const from = player.pos.clone().add(new THREE.Vector3(0,1.2,0));
  const to = new THREE.Vector3(...npc.position).add(new THREE.Vector3(0,1.2,0));
  const delta = to.sub(from), distance = delta.length();
  if (distance > .05 && combat.geometry.cast(from, delta, Math.max(0,distance-.25))) return null;
  return npc;
}
function interactSettlementNpc() {
  const m = nearestInteract();
  const npc = nearbySettlementNpc();
  // Quest targets retain priority whenever nearer; dialog never marks quest progress complete.
  if (npc && (!m || player.pos.distanceTo(new THREE.Vector3(...npc.position)) < player.pos.distanceTo(new THREE.Vector3(...m.p)))) {
    if (handleCampaignInteraction(npc.id)) return true;
    const closing = getCampaignResidentReaction(npc.id, done); if (closing) { speakDialogue(closing, npc.role); return true; }
    if (handleValleyInteraction(npc.id,npc.role) || handleEraInteraction(npc.id,npc.role)) return true;
    const line = settlementNpcs.interact(npc.id);
    if (line) speakDialogue(line, npc.role);
    return true;
  }
  return false;
}
function handleValleyInteraction(id: string, speaker: [string,string] = ['现场记录','Field notes']) {
  const result = interactValleyStory(id, done); if (!result.handled) return false;
  if (id === VALLEY_STORY.npc) settlementNpcs.gesture(id);
  let saved = true;
  if (result.changed) { saved = save(); applyWorldState(); }
  if (result.dialogue) speakDialogue([result.dialogue[0]+(saved?'':'（本次进度暂未保存。）'),result.dialogue[1]+(saved?'':' (Progress could not be saved.)')],speaker);
  return true;
}
function handleEraInteraction(id: string, speaker: [string,string] = ['现场记录','Field notes']) {
  const result = interactEraStory(id, done, found); if (!result.handled) return false;
  let changed = result.changed;
  if (result.reward) {
    const reward = result.reward;
    if (reward.kind === 'warmth') { cold.reserve = reward.seconds; cold.warmth = Math.max(cold.warmth, 70); }
    else if (reward.kind === 'quiet-route') optionalPin = { kind: 'quiet-route', p: reward.position, label: reward.label, region: reward.region };
    else if (reward.kind === 'clue') { const marker = markers.get(reward.targetId); if (marker) optionalPin = { kind: 'clue', p: marker.p, label: reward.label, region: reward.region, targetId: marker.id }; }
    else if (reward.kind === 'trial') {
      combat.startOptionalTrial(reward.enemyId);
      const knight = combat.state.enemies.find(e => e.id === reward.enemyId);
      if (knight) optionalPin = { kind: 'trial', p: [knight.home.x,knight.home.y,knight.home.z], label: reward.label, region: reward.region };
    }
    hudRevision++;
  }
  const saved = !changed || save();
  if (changed) applyWorldState();
  if (result.dialogue) speakDialogue([result.dialogue[0]+(saved?'':'（本次进度暂未保存。）'),result.dialogue[1]+(saved?'':' (Progress could not be saved.)')],speaker);
  return true;
}
function campaignInteractionReachable(id: string) {
  if (!locked || settingsPanel.open || travelOpenState || document.visibilityState !== 'visible' || !document.hasFocus() || combat.defeated || player.flying || player.swimming || player.gliding || !player.onGround) return false;
  if (campaignMarkerIds.has(id)) {
    const marker = markers.get(id)!;
    return player.pos.distanceTo(new THREE.Vector3(...marker.p)) < (marker.radius ?? 3) && canReachValleyPanel(marker);
  }
  return nearbySettlementNpc()?.id === id;
}
function presentCampaignInteraction(result: CampaignEpisodeInteraction, origin: string) {
  if (!result.handled) return false;
  const saved = !result.changed || save();
  if (result.changed) applyWorldState();
  if (!result.dialogue) return true;
  const line: [string, string] = [result.dialogue[0] + (saved ? '' : '（本次进度暂未保存。）'), result.dialogue[1] + (saved ? '' : ' (Progress could not be saved.)')];
  const speaker: [string, string] = result.speaker ?? ['现场记录', 'Field notes'];
  if (result.choices?.length && result.state) {
    const region = result.state.region;
    clearInput(); hudRevision++; audio.interaction();
    narrative!.showChoices(line, speaker, result.choices, choice => {
      // A dialogue can outlive the position/state at which it was opened.
      if (!campaignInteractionReachable(origin)) { clearInput(); toast(bilingual('请回到现场后重新查看。', 'Return to the site and inspect it again.')); return; }
      presentCampaignInteraction(chooseCampaignEpisode(region, choice, done), origin);
    });
  } else speakDialogue(line, speaker);
  return true;
}
function handleCampaignInteraction(id: string) {
  const result = interactCampaignEpisode(id, done);
  if (result.handled) settlementNpcs.gesture(id);
  return presentCampaignInteraction(result, id);
}
function interact() {
  const m = nearestInteract();
  if (!m) return;
  if (campaignMarkerIds.has(m.id)) { if (canReachValleyPanel(m)) handleCampaignInteraction(m.id); return; }
  const closing = interactCampaignClosure(m.id, done);
  if (closing.handled) { if(closing.changed){save();applyWorldState();} if(closing.dialogue)speakDialogue(closing.dialogue,['观测记录','Observation record']); return; }
  audio.interaction();
  if (m.id === VALLEY_STORY.discovery) {
    // The physical panel must be reachable, not usable through a wall or a closed gate.
    if (!canReachValleyPanel(m)) return;
    handleValleyInteraction(m.id); return;
  }
  if (m.id === FORT_CANNON.marker && done.has(m.id)) {
    const mounted = fortCannon.toggle(player.pos, true); actions?.cancel();
    toast(mounted ? bilingual(`已操作要塞炮 · ${settings.label('fire')} 开火，${settings.label('interact')} 离开；装填1.3秒。`, `Fort cannon mounted · ${settings.label('fire')} fires, ${settings.label('interact')} leaves; 1.3s reload.`) : bilingual('已离开炮位。', 'Cannon released.')); return;
  }
  if (eraOptionalIds.has(m.id)) { if (canReachValleyPanel(m)) handleEraInteraction(m.id); return; }
  const bossCore = BOSSES.some((b) => b.core === m.id);
  if (done.has(m.id) && !bossCore) return toast(bilingual(`${m.label}：已启动`, `${localizeText(m.label)}: activated`));
  const missing = done.has(m.id) && bossCore ? [] : (m.requires ?? []).filter((r) => !done.has(r));
  if (missing.length) return toast(bilingual(`${m.label}：还需要 ${missing.map((r) => markers.get(r)?.label ?? r).join('、')}`, `${localizeText(m.label)}: requires ${missing.map((r) => localizeText(markers.get(r)?.label ?? '尚未完成的任务')).join(', ')}`));
  if (bossCore) {
    if (!combat.beginBoss(m.id)) toast(bilingual('挑战正在进行 · 射击核心并闪避预警', 'Challenge active · Shoot the core and dodge the tells'));
    return;
  }
  done.add(m.id);
  if (m.id === FORT_CANNON.marker) { actions?.cancel(); fortCannon.toggle(player.pos, true); }
  if (m.id === ARMORY_MARKER) {
    // An old held trigger/ADS must not silently activate when the weapon is first collected.
    clearInput();
    anim.update(0, { speed: 0, onGround: player.onGround, swimming: player.swimming, vy: player.vel.y,
      moveYaw: null, gliding: player.gliding, armed: worldProgress.armed, aim: 0, firing: false, pitch: player.pitch });
  }
  if (servantByContract(m.id)) contract.recruit(m.id);
  save(); applyWorldState();
  const msg: Record<string, string> = {
    tower_console: '幻日塔重启！光环点亮了整个山谷，四处时层断面同时显现',
    hq_terminal: '调查员身份已登记：世界地图与历史档案已开放',
    seam_west: '西部时层：约 537 年的不列颠，黄昏永远不会结束',
    seam_north: '北方冰海：1812 年的冬天没有尽头',
    seam_east: '东部山口：海风里混着 1718 年的火药味',
    seam_south: '南方鸟居：鸟居那头的京都正在燃烧，1582 年的那一夜',
    blackbeard_meet: '「哈！又一个被冷灯招来的旱鸭子。」黑胡子答应：点亮海之核，就跟你签约',
    fort_cannon: bilingual(`大炮已装填：${settings.label('fire')} 炮击幽灵艇，1.3秒装填；${settings.label('interact')} 离开炮位。`, `Cannon loaded: ${settings.label('fire')} fires at ghost boats, 1.3s reload; ${settings.label('interact')} leaves.`),
    sea_core: '海之核重新燃起，冷灯熄灭了。风暴正在散去……',
    napoleon_meet: '「你也是被这场冬天困住的人吗？」拿破仑答应：点亮冬之核，就和你签约',
    winter_core: '冬之核重新燃起。雪停了，莫斯科上空第一次看见太阳……',
    napoleon_contract: '契约成立。「不可能？这个词只在傻瓜的字典里。」拿破仑成为你的从者',
    blackbeard_contract: '契约成立。「这片海以后归我们俩了，御主。」黑胡子成为你的从者',
    summon_circle: '召唤阵稳定了。四处时层断面都已打开：西去落日王国，东去黑帆尽头，北去永冬之城，南去业火京都',
    musashi_meet: '「在下宫本武藏。这把火里有个值得一战的对手。」武藏答应：点亮京之核，就和你签约',
    fire_core: '京之核重新燃起，本能寺的业火熄灭了。天快亮了……',
    musashi_contract: '契约成立。「千日之锻为锻，万日之炼为炼。」宫本武藏成为你的从者',
    saber_contract: '契约成立。「我问你，你就是我的御主吗？」Saber 加入了队伍',
    sun_core: '落日之核重新燃起。永恒的黄昏开始退去……',
    temple_altar: '星辉祭坛亮起，一道光柱直冲云霄',
    lighthouse_lamp: '守望灯塔重新点亮，光束扫过整片海岸',
  };
  const eraReaction = getEraProgressReaction(m.id, done);
  if (eraReaction) return toast(bilingual(...eraReaction));
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
  if (m.id === ARMORY_MARKER) return speakDialogue([
    `步枪与短刃已领取。连射8发后会短暂散热，停火也能冷却。\n${settings.label('fire')} 射击 · ${settings.label('melee')} 近战连击 · ${settings.label('evade')} 闪避。靶场就在前方。`,
    `Rifle and blade acquired. Eight continuous shots trigger a short automatic vent; resting the trigger also cools the rifle.\n${settings.label('fire')} Fire · ${settings.label('melee')} Melee combo · ${settings.label('evade')} Evade. The range is just ahead.`,
  ], ['领取装备','Equipment acquired']);
  if (m.id === VALLEY_STORY.terminal) return toast(bilingual('观测终端已接通，生活馆门廊的导引灯亮了。回去看看记录员吧。', 'The Observatory terminal is online. The residence path lights are on; check back with the archivist.'));
  toast(m.id === ARMORY_MARKER ? bilingual('已领取曙光 AR 与弹药，去靶场试试手感', 'Dawn AR and ammunition acquired · Try the firing range')
    : msg[m.id] ?? (m.id.startsWith('shard_') ? `获得 ${m.label}` : `${m.label} 已启动`));
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

attachRenderSettings(resolution, quality, (mode) => {
  resolution = mode; adaptiveResolution.reset();
  dpr = targetDpr(devicePixelRatio, resolution, lowQ); applyResolution();
});

// ───────────── loop ─────────────
const mini = $<HTMLCanvasElement>('minimap').getContext('2d')!;
const big = ($('bigmap').querySelector('canvas') as HTMLCanvasElement).getContext('2d')!;
const stats = $('stats');
const eye = new THREE.Vector3();
let last = performance.now(), acc = 0, frames = 0, fpsT = 0, fps = 0;
const STEP = 1 / 120;
let lastRegion = '';

// screenshot / fixed-camera mode: ?cam=x,y,z,yawDeg,pitchDeg&clean
const camParam = params.get('cam')?.split(',').map(Number);
if (camParam) { player.flying = true; player.teleport(camParam[0], camParam[1] - PLAYER.eye, camParam[2], THREE.MathUtils.degToRad(camParam[3] ?? 0)); player.pitch = THREE.MathUtils.degToRad(camParam[4] ?? 0); }
if (params.has('clean')) document.body.classList.add('clean');
if (params.has('nofog')) scene.fog = null;
if (params.has('lit')) done.add('tower_console');
camera.fov = baseFov; camera.updateProjectionMatrix();
applyWorldState();

function frame(now: number) {
  // Some browsers change DPR on monitor moves without a CSS resize event.
  if (observedDeviceDpr !== devicePixelRatio) {
    observedDeviceDpr = devicePixelRatio;
    adaptiveResolution.reset();
    dpr = targetDpr(devicePixelRatio, resolution, lowQ); applyResolution();
  }
  const frameSeconds = (now - last) / 1000;
  const dt = Math.min(0.1, frameSeconds);
  last = now;
  if (frameUltimate(dt)) { requestAnimationFrame(frame); return; }
  if (deferredCombatToast && gameplayActive()) { const message = deferredCombatToast; deferredCombatToast = null; toast(message); }
  acc += dt;
  if (!gameplayActive()) { keys.clear(); aim.clear(); }
  audio.setActive(gameplayActive() || (!!narrative?.open && locked && document.visibilityState === 'visible' && document.hasFocus()));
  fortCannon.update(dt, player.pos, gameplayActive() && !combat.defeated && !player.flying);
  const input = {
    x: combat.defeated ? 0 : Number(down('right')) - Number(down('left')),
    z: combat.defeated ? 0 : Number(down('forward')) - Number(down('back')),
    jump: !combat.defeated && down('jump'),
    sprint: !combat.defeated && down('sprint'),
    evade: undefined as {x:number;z:number;strength:number}|undefined,
  };
  if (cold.frozen) { input.x *= 0.55; input.z *= 0.55; input.sprint = false; }
  while (acc + 1e-9 >= STEP) {
    const active = gameplayActive() && !player.flying && !combat.defeated;
    if (combat.defeated) { input.x = input.z = 0; input.jump = input.sprint = false; }
    input.evade = active && actions?.evade.active ? { x: actions.evade.x, z: actions.evade.z, strength: Math.min(actions.evade.remaining, STEP) / STEP } : undefined;
    combat.setDefense({ guard: active && actions?.skills.guarding ? .55 : 1, invulnerable: !!(active && actions && actions.evade.remaining > .10) });
    player.step(STEP, input);
    combat.simulate(STEP, player.pos, gameplayActive() && !player.flying);
    actions?.update(STEP);
    acc = Math.max(0, acc - STEP);
  }

  const canAim = worldProgress.armed && gameplayActive() && !player.swimming && !player.gliding && !player.flying;
  if (!canAim) for (const binding of settings.bindingsFor('aim')) keys.delete(binding);
  const ads = aim.step(dt, canAim);
  $('movement-mode').textContent = player.flying ? bilingual(`自由飞行调试 · ${settings.label('fly')} 退出`, `Free-flight test · ${settings.label('fly')} Exit`)
    : player.swimming ? bilingual(`游泳 · ${settings.label('jump')} 出水`, `Swimming · ${settings.label('jump')} Leave water`)
    : player.gliding ? bilingual(`滑翔 · ${settings.label('jump')} 收翼 · 上升气流可抬升`, `Gliding · ${settings.label('jump')} Fold glider · Updrafts provide lift`)
    : '';
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
  anim.update(dt, { speed: Math.min(hs, 12), onGround: player.onGround, swimming: player.swimming, vy: player.vel.y, moveYaw: ads > 0.05 ? player.yaw + Math.PI : wx || wz ? Math.atan2(wx, wz) : null, gliding: player.gliding, armed: worldProgress.armed, aim: ads, pitch: player.pitch, firing: worldProgress.armed && down('fire') && !actions?.melee.active && !(actions?.skills.casting && actions.skills.selected === null), lookYaw: player.yaw + Math.PI, melee: actions?.melee.active ? { phase: actions.melee.phase, combo: actions.melee.combo, yaw: actions.melee.yaw } : undefined });
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
  // Full-body servant viewer: slow orbit in front of the active companion.
  const viewRoot = inspectServant ? servantRoot() : undefined;
  if (viewRoot?.visible) {
    const big = contract.selected === 'napoleon', angle = viewRoot.rotation.y + performance.now() / 4000;
    const focus = viewRoot.position.clone().add(new THREE.Vector3(0, big ? 1.3 : .95, 0));
    camera.position.copy(focus).add(new THREE.Vector3(Math.sin(angle) * (big ? 5.5 : 3.6), .35, Math.cos(angle) * (big ? 5.5 : 3.6)));
    camera.lookAt(focus);
  } else inspectServant = false;
  combat.present(dt, player.pos, gameplayActive() && !player.flying, camera);
  const elite = gameplayActive() && !combat.defeated && !combat.bossStarted ? nearbyElite(combat.state.enemies, player.pos) : null;
  $('elite-hint').textContent = elite ? bilingual(`附近精英：${elite.name[0]} · ${elite.direction[0]} · ${Math.round(elite.distance)} 米`, `Nearby elite: ${elite.name[1]} · ${elite.direction[1]} · ${Math.round(elite.distance)} m`) : '';
  if (down('fire')) shoot();
  servant.update(dt, player.pos, anim.facing - Math.PI, companionEnabled(), !gameplayActive());
  updateEraActors(dt);
  actions?.flush(); actions?.present(dt); blade.update(!!actions?.melee.active);
  if (hudBudget.due(now, {active: true, revision: hudRevision})) { renderContract(); actionHud.update(actions!, gameplayActive() && !inspectServant); }
  settlements.update(player.pos);
  settlementApproaches.update(player.pos);
  campaignSites.update(player.pos);
  for (const site of eraStoryScenes) site.updateVisibility(player.pos);
  settlementNpcs.update(gameplayActive() || narrative?.open ? dt : 0, player.pos);
  sky.position.copy(eye);
  twilight.update(dt, player.pos.x, done.has('sun_core'), done.has('sea_core'), player.pos.z, done.has('winter_core'), done.has('fire_core'));
  matchServantLighting();
  updateCold(dt);
  sun.position.copy(eye).addScaledVector(twilight.direction, 200);
  sun.target.position.copy(eye);

  if (haloMat && done.has('tower_console')) haloMat.color.setScalar(0.85 + Math.sin(now / 400) * 0.15);
  for (const m of spinners) m.rotation.y += (m.userData.spin as number) * dt;
  for (const m of bobbers) m.position.y = Math.sin(now / 600) * 0.25;


  checkDiscoveries();
  if (gameplayActive() && discoverTravelStops(travelStops,player.pos.toArray(),travelContext(),found).length) { save(); hudRevision++; toast(bilingual(`已登记安全据点 · ${settings.label('travel')} 打开快速旅行。`,`Safe settlement registered · ${settings.label('travel')} opens fast travel.`)); }
  const area = layout.areas.find((a) => Math.hypot(player.pos.x - a.c[0], player.pos.z - a.c[1]) < a.r);
  if (area && area.id !== currentArea) showArea(area);
  currentArea = area?.id ?? '';
  const it = nearestInteract();
  const nearbyNpc = gameplayActive() && !player.flying ? nearbySettlementNpc() : null;
  const npcPrompt = !fortCannon.mounted && nearbyNpc && (!it || player.pos.distanceTo(new THREE.Vector3(...nearbyNpc.position)) < player.pos.distanceTo(new THREE.Vector3(...it.p)));
  $('prompt').textContent = fortCannon.mounted ? bilingual(`[${settings.label('fire')}] 炮击 · ${fortCannon.reload > 0 ? `装填 ${fortCannon.reload.toFixed(1)} 秒` : '就绪'} · [${settings.label('interact')}] 离开炮位`, `[${settings.label('fire')}] Cannon · ${fortCannon.reload > 0 ? `Reload ${fortCannon.reload.toFixed(1)}s` : 'Ready'} · [${settings.label('interact')}] Leave`) : npcPrompt ? bilingual(`[${settings.label('interact')}] 与${nearbyNpc.role[0]}交谈`, `[${settings.label('interact')}] Talk to ${nearbyNpc.role[1]}`) :
    !gameplayActive() ? '' : !player.flying && it && (!done.has(it.id) || eraOptionalIds.has(it.id) || it.id === FORT_CANNON.marker || (it.id === CAMPAIGN_CLOSURE.terminal && !!getCampaignClosureGuide('alpha',done)) || BOSSES.some(b => b.core === it.id)) ?
      `[${settings.label('interact')}] ${done.has(it.id) && BOSSES.some(b => b.core === it.id) ? bilingual('再次挑战 Boss（不重复领取首通奖励）', 'Rechallenge Boss (no repeat first-clear reward)') : interactionLabel(it)}` :
    player.inUpdraft && player.onGround ? bilingual(`[${settings.label('jump')}] 跳入上升气流`, `[${settings.label('jump')}] Jump into the updraft`) : '';

  const nowRegion = regionAt(player.pos.x, player.pos.z).id;
  if (nowRegion !== lastRegion) { lastRegion = nowRegion; renderObjective(); }
  culler.update(eye, lowQ ? 0.7 : 1);
  const nextDpr = adaptiveResolution.sample(frameSeconds, dpr, targetDpr(devicePixelRatio, resolution, lowQ),
    resolution === 'adaptive' && !params.has('shot') && document.visibilityState === 'visible' && document.hasFocus());
  if (nextDpr !== dpr) { dpr = nextDpr; applyResolution(); }
  const tgt = guideOn ? guideTarget() : null;
  updateGuide(tgt, now);
  const mt: [number, number] | null = tgt ? [tgt.p[0], tgt.p[2]] : null;
  if (mapBudget.due(now, { active: true, revision: hudRevision })) {
    map.draw(mini, player.pos, player.yaw, { full: false, done, found, target: mt });
    if ($('bigmap').classList.contains('open')) map.draw(big, player.pos, player.yaw, { full: true, done, found, target: mt });
  } // big map stays readable: no monster dots

  timeUniform.value = now / 1000;
  localLights.update(camera.position, dt);
  shafts.update(camera, twilight.direction);
  grass?.update(camera.position);
  ambient?.update(camera.position);
  renderer.info.reset();
  if (composer) composer.render(); else renderer.render(scene, camera);
  frames++; fpsT += frameSeconds;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const info = renderer.info.render;
  if (statsBudget.due(now, { active: true, revision: hudRevision })) stats.textContent = bilingual(`${fps} 帧/秒 · ${dpr.toFixed(2)}× DPR · ${info.calls} 绘制 · ${Math.round(info.triangles / 1000)}k 三角形\n`, `${fps} fps · ${dpr.toFixed(2)}× DPR · ${info.calls} draws · ${Math.round(info.triangles / 1000)}k tris\n`) +
    `x ${player.pos.x.toFixed(1)}  y ${player.pos.y.toFixed(1)}  z ${player.pos.z.toFixed(1)}${player.flying ? bilingual(' · 飞行', ' · fly') : ''}${player.gliding ? bilingual(' · 滑翔', ' · glide') : ''}${player.swimming ? bilingual(' · 游泳', ' · swim') : ''}`;
  requestAnimationFrame(frame);
}
refreshWorldLocale = () => {
  hudRevision++; applyWorldState(); renderControlHints(); renderContract();
  const area = layout.areas.find((a) => a.id === currentArea);
  if (area) { $('area').querySelector('.zh')!.textContent = localizeText(area.name); $('area').querySelector('.en')!.textContent = bilingual(area.nameEn.toUpperCase(), 'PARHELION WORLD'); }
  // Transient combat/toast messages expire rather than retain a previous language.
  $('toast').classList.remove('show');
};
requestAnimationFrame(frame);
const ground = (x: number, z: number) =>
  staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 0;
// debug/test hook
(window as any).__world = { renderer, rig, anim, aim, settings, settingsPanel, thirdPerson, player, scene, camera, layout, done, found, colliders, ground, contract, servant, combat, actions, ultimateDirector, ultimateStage, travelStops, travelPanel, executeSafeTravel, audio, eraStoryScenes, campaignSites, campaignJournal, narrative, localLights, consumedSourceReceipt, worldProgress, weaponFinishStore, weaponFinishControl, rifle, blade, valleyStory: { state: () => getValleyStoryState(done), scene: valleyStoryScene }, ready: true };
}

void boot().catch((error: unknown) => {
  bootFailed = true;
  console.error('World boot failed', error);
  disposeRenderer();
  const message = error instanceof Error ? error.message : String(error);
  const failure = worldBootFailure(message);
  setLoading(bilingual(...failure));
  onLanguageChange(() => setLoading(bilingual(...failure)));
  $('help').textContent = ''; $('settings-open').hidden = true; $('shot-mode').hidden = true;
  $('start').classList.remove('hidden');
  const retry = document.createElement('button');
  retry.id = 'retry';
  retry.type = 'button';
  retry.textContent = localizeText('重新加载');
  onLanguageChange(() => { retry.textContent = localizeText('重新加载'); });
  retry.addEventListener('click', (event) => { event.stopPropagation(); location.reload(); });
  $('start').append(retry);
});
