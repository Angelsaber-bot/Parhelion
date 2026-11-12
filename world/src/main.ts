import { createFieldSideSites } from './environment/fieldSideSites';
import { FIELD_SIDE_STEPS, FIELD_SERVICE_LABELS, ROYAL_BOAT as RB, ICE_BELL as IB, EGYPT_SEEDS as ES, ORLEANS_SOUP as OS, QIN_QUIET_ROOM as QR, SKY_MAINTENANCE as SM, VALLEY_RADIO as VR, fieldSideReady } from './story/fieldSideStories';
import { createOrleansShadowPlay, createQinCrookedEffigy } from './environment/realmCulturalScenes';
import { CROOKED_EFFIGY as CE, CULTURAL_STEPS, SHADOW_PLAY as SP, culturalStepReady } from './story/realmCulturalStories';
import { createEgyptGaugeScene } from './environment/egyptGaugeScene';
import { EGYPT_GAUGE as G, EGYPT_GAUGE_BY_ID, EGYPT_GAUGE_CHOICES, EGYPT_GAUGE_KEEPER, EGYPT_GAUGE_TITLE, egyptGaugeNext, type EgyptGaugeAction } from './story/egyptGauge';
import {orleansResidentSockets,createOrleansResidentLife} from './map/orleansResidents';
import {qinResidentSockets,createQinResidentLife} from './map/qinResidents';
import {egyptResidentSockets,createEgyptResidentLife} from './map/egyptResidents';
import { createEgyptAtmosphere } from './environment/egyptAtmosphere';
import {ORLEANS_WORK_ACTIONS} from './map/orleansWorks';
import {createOrleansWorksScene} from './environment/orleansWorksScene';
import {createOrleansOutskirtsScene} from './environment/orleansOutskirtsScene';
import {createOrleansAtmosphere} from './environment/orleansAtmosphere';
import {createOrleansWorksRuntime} from './story/orleansWorks';
import { isCampaignRegion, isExpansionRegion, type WorldRegionId } from './core/regionIdentity';
import { EXPANSION_PLANS, EXPANSION_GRASS_CLEARANCE, ORLEANS_PAVED_COURTS } from './map/worldPlan';
import {HOME_BUILDINGS,HOME_ROUTES,HOME_SITES,HOME_ACTIONS} from './map/homePlan';
import {createHomeTown,homeResidentSockets,homeSaberReady} from './story/homeTown';
import {HOME_CIVIC_ACTIONS} from './map/homeActivities';
import {createHomeResidentLife} from './map/homeResidents';
import { weaponDryFireHint } from './weapons/weaponReadiness';
import { createParallaxGarden, PARALLAX_CLEARANCE } from './environment/parallaxGarden';
import { createQinArmyOrder, qinTurnBlocked, toggleQinOrder, QIN_ORDER_MARKERS } from './environment/qinArmyOrder';
import { createQinAtmosphere } from './environment/qinAtmosphere';
import { createQinLift, QIN_LIFT_MARKERS } from './environment/qinLift';
import { createQinSentinels } from './environment/qinSentinels';
import { createEgyptSunMirrors, turnEgyptMirror, EGYPT_MIRROR_MARKERS } from './environment/egyptSunMirrors';
import { EGYPT_MIRRORS } from './map/egyptPlan';
import { PARALLAX, PARALLAX_LABELS, PARALLAX_INTRO, PARALLAX_ENDING, recordParallaxView, concludeParallax, beginParallaxExperiment, turnParallaxRing, parallaxAligned } from './story/parallaxSurvey';
import {installWorldInterface} from './ui/worldInterface';
import {JOURNEY_DRAMA,dramaActive,journeyScene,confirmJourneyScene,journeyEnding} from './story/journeyDrama';
import {createResidentEventRuntime,createResidentEventScene} from './story/residentEvents';
import {RESIDENT_ACTIONS,getResidentWorkGuide} from './story/residentEventRules';
import {makeCombatTerrain} from './combat/combatTerrain';
import {LocalCavalrySupport} from './companions/localCavalrySupport';
import {createFlagshipInterior} from './environment/flagshipInterior';
import {RegionVisualStreaming,streamedOutlineDistance} from './map/regionVisualStreaming';
import {carveCoreRing} from './exploration/bossArenas';
import { FarPropCuller } from './rendering/farPropCuller';
import {ADVENTURE,adventureActive,adventureTravelOpen,getCurrentAdventureGuide} from './story/openWorldCampaign';
import {createAdventureSites} from './story/adventureSites';
import { createKingdomWorksScene } from './environment/kingdomWorksScene';
import { KINGDOM_WORKS as KW, KINGDOM_WATCH_ENCOUNTER, KINGDOM_WORK_LABELS, KINGDOM_WORK_LINES, commitKingdomWork, kingdomWorkReady, type KingdomWork } from './story/kingdomWorks';
import { harborReliefRequired } from './story/harborRelief';
import { KYOTO_WITNESS, kyotoWitnessActionReady, type KyotoWitnessAction } from './story/kyotoWitness';
import { SKY_SHUTTER_FLAGS, SKY_SUPPORT, SKY_SUPPORTERS, skySupportFlag, type SkySupporter } from './story/skySupport';
import {createExploration} from './exploration/runtime';
import {createAmbientLife} from './environment/ambientLife';
import {createFieldHerbs} from './environment/fieldHerbs';
import {drawExplorationIcons} from './exploration/mapIcons';
import { HIT_STOP, hitStopSeconds } from './combat/hitStop';
import {glideLevel as explorationGlideLevel, glideScale as explorationGlideScale} from './exploration/catalog';
import {createAdventureRuntime} from './story/adventureRuntime';
import { WORLD_RIFLE } from './core/worldBalance';
import { KINGDOM_GATE, createKingdomGateRuntime, gateEncounter, isKingdomGateOpen } from './story/kingdomGate';
import { createKingdomGateScene, gateEscortPosition } from './environment/kingdomGateScene';
import { createArenaTrainingPanel } from './ui/arenaTrainingPanel';
import { createCompactRelaySites } from './story/compactRelaySites';
import { createCompactRelayRuntime } from './story/compactRelayRuntime';
import { COMPACT_RELAY, getCompactRelayGuide } from './story/compactRelayCampaign';
import { getCompactRelayEncounterSpec } from './story/compactRelayEncounter';
import { createQuestGuideCatalog, type QuestEntry, type QuestGuide } from './story/questGuideCatalog';
import { createQuestJournal } from './ui/questJournal';
import { buildAlphaSettlement } from './settlements/alpha';
import { buildBritainSettlement } from './settlements/britain';
import { buildBlackSailSettlement } from './settlements/blacksail';
import { buildWinterSettlement } from './settlements/winter';
import { buildKyotoSettlement } from './settlements/kyoto';
import { installSettlements } from './settlements/core';
import { mergeParts } from './settlements/merge';
import { createSettlementNpcs } from './settlements/npcs';
import { createCampaignSites } from './story/campaignSites';
import { createSettlementApproaches } from './map/settlementApproaches';
import { createFalseDawnSites } from './story/falseDawnSites';
import { getFalseDawnState, getFalseDawnGuide, getFalseDawnMarkerLabel, getFalseDawnCompanionReaction, getFalseDawnObjective } from './story/falseDawnCampaign';
import { createFalseDawnRuntime } from './story/falseDawnRuntime';
import { getFalseDawnEncounterSpec, FALSE_DAWN_START_HINTS } from './story/falseDawnEncounterCatalog';
import { resolveTrackedStoryPoint, trackedStoryRouteBlocked } from './story/trackedStoryNavigation';
import { CAMPAIGN_EPISODES, CAMPAIGN_REGIONS, getCampaignEpisodeState, getCampaignEpisodeGuide, getCampaignEpisodeObjective, interactCampaignEpisode, chooseCampaignEpisode, type CampaignEpisodeInteraction } from './story/campaignEpisodes';
import { createCampaignJournal } from './ui/campaignJournal';
import { createTrackedStoryHud } from './ui/trackedStoryHud';
import type { RegionId } from './settlements/types';
import { VALLEY_STORY, getValleyStoryState, getValleyStoryGuide, interactValleyStory } from './story/valleyStory';
import { createValleyStoryScene } from './environment/valleyStoryScene';
import { createValleyPrologueScene } from './environment/valleyPrologueScene';
import { createWorldJourneySites } from './environment/worldJourneySites';
import { createValleyFieldScene } from './environment/valleyFieldScene';
import { VALLEY_FIELD as F, VALLEY_FIELD_BY_ID, VALLEY_NIGHT_ENCOUNTER } from './story/valleyField';
import type { StoryEncounterActor, StoryEncounterSpec } from './story/storyEncounters';
import { createRealmClimaxSites } from './environment/realmClimaxSites';
import { climaxMarker, createRealmClimax, REALM_CLIMAX_IDS, REALM_CLIMAXES, type ClimaxStation, type RealmClimaxId } from './story/realmClimaxes';
import { createSkyCrownScene, insideSkyCrown, SKY_CHECKPOINT, SKY_CROWN_RECOVERY, SKY_LANDING } from './environment/skyCrownScene';
import { SKY_DOWN_LANDING, SKY_DOWN_LIFT, SKY_HALL_CHECKPOINT, SKY_THROAT_CHECKPOINT, SKY_UP_LANDING, SKY_UP_LIFT } from './environment/skyCrownApproach';
import { createHelionFight } from './story/helionFight';
import { commitJourneyStep, JOURNEY, JOURNEY_DISPATCH, journeyClimaxReady, journeyDestinations, journeyEnabled, journeyStepById, journeyStepReady, journeyTowerReady, legacySkyApproach, REALM_HANDOVER, SKY_MARKERS, SKY_PHASE_LABELS, skyPhase, worldJourneyGuide } from './story/worldJourney';
import { advanceValleyPrologue, PROLOGUE_LABELS, VALLEY_PROLOGUE, VALLEY_RESCUE_ENCOUNTER, VALLEY_SURVEY_HEIGHT, valleyPrologueGuide, valleyPrologueStage } from './story/valleyPrologue';
import { isEraId, ERA_STORIES, ERA_OPTIONALS, getEraStoryState, getEraStoryGuide, getEraObjective, applyEraMarkerRequirements, getEraPieceRequirements, interactEraStory, getEraProgressReaction } from './story/eraStories';
import { optionalPinExpired, type OptionalPin } from './story/optionalNavigation';
import { createEraStoryScene } from './story/eraStoryScenes';
import { WorldActions } from './combat/worldActions';
import { resolveServantSkillAim, trackServantSkillTarget } from './combat/skillAim';
import { CONTRACT_SKILLS, type SkillEvent } from './companions/contractSkills';
import { UltimateDirector } from './cinematics/ultimateDirector';
import { UltimateStage } from './cinematics/ultimateStage';
import './cinematics/ultimateDirector.css';
import { FortCannon, FORT_CANNON } from './environment/fortCannon';
import { createTraversalRepairs } from './map/traversalRepairs';
import { createActionHud } from './ui/actionHud';
import { WorldAudio } from './rendering/worldAudio';
import { worldBootFailure } from './core/bootFailure';
import { createTravelPanel } from './ui/travelPanel';
import { createNarrativePanel } from './ui/narrativePanel';
import { createSafeTravelStops, discoverTravelStops, isTravelStopDiscovered, getTravelBlock, getTravelSafetyBlock, planSafeTravel, TRAVEL_BLOCK_TEXT, type TravelContext } from './story/safeTravel';
import { CAMPAIGN_CLOSURE, getCampaignClosureGuide, interactCampaignClosure, getCampaignResidentReaction } from './story/campaignClosure';
import { attachExplorerBlade } from './weapons/playerBladeArt';
import { FrameWorkBudget } from './rendering/frameWorkBudget';
import { LocalLightPool } from './rendering/localLightPool';
import { detachConsumedSourceNodes } from './rendering/consumedSourceNodes';
import './ui/actions.css';
import { AdaptiveResolution, targetDpr } from './rendering/renderQuality';
import { readResolutionMode, attachRenderSettings } from './rendering/renderSettings';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { makeGrassField, makeSunShafts, enhanceWater, makeUpdrafts } from './rendering/fx';
import { settlementGrassClearance } from './map/grassClearance';
import {createArmoryWorkshop,ARMORY_WORKSHOP} from './story/armoryWorkshop';
import { makeRegionWeather } from './map/regionWeather';
import { toonMaterial, addOutline, makeSky, timeUniform, cloudShadowUniform } from './rendering/look';
import { Player, PLAYER, type Collider } from './player/player';
import { WorldMap } from './map/map';
import type { Layout, Marker } from './core/types';
import { loadLayout } from './core/load';
import { loadSkinnedCharacter, SkinnedCharacterAnimator } from './player/skinnedCharacter';
import { PlayerTerrainSupport } from './player/playerTerrainSupport';
import { attachExplorerRifle } from './weapons/weaponArt';
import { WORLD_GUNS, DEFAULT_GUN, nextGunUnlock, GUN_STORE_KEY, worldGun, gunUnlocked, unlockedGuns, cycleGun, equippedGun, type WorldGunId, WORLD_MELEE, DEFAULT_MELEE, MELEE_STORE_KEY, worldMelee, meleeUnlocked, unlockedMelee, cycleMelee, equippedMelee, type WorldMeleeId } from './weapons/worldArsenal';
import { ShoulderAim, shoulderArmLength } from './player/aim';
import { SettingsStore, createSettingsPanel } from '../../shared-client/settings';
import '../../shared-client/settings.css';
import './ui/worldInterface.css';
import { REGIONS, GRID, GATES, mergeLayouts, boundaryWalls, regionAt, placeRegion, regionToWorld } from './map/regions';
import { BOSSES, PERFECT_EVADE } from './combat/combat';
import { nearbyElite } from './combat/eliteNavigation';
import { WorldGrid } from './map/grid';
import { chunkMesh, DistanceCuller, freezeStaticArt, isStaticArtEligible } from './rendering/chunk';
import { regionLoader, bakeQuantized } from './rendering/glb';
import { KingdomTwilight } from './map/twilight';
import { COMPANIONS, FirstContract, SERVANTS, servantByContract, type CompanionId, type ServantId } from './companions/contracts';
import { KitCompanion } from './companions/kitCompanion';
import { medicineCartPathClear } from './story/medicineCartNavigation';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ContractServant } from './companions/servant';
import { CHARACTER_KITS, isModelCompanionId } from './characters/catalog';
import { loadCharacterKit, type CharacterKit } from './characters/characterKit';
import { ServantAppearance } from './companions/servantAppearance';
import { companionStatus, createServantPanel } from './ui/servantPanel';
import { ModelCompanion } from './companions/modelCompanion';
import { MODEL_CLAIM_POINTS } from './companions/modelClaimPoints';
import { WorldCombat } from './combat/combatView';
import { WorldGraphicsRecovery } from './rendering/graphicsRecovery';
import { WorldProgress, ARMORY_MARKER, INITIAL_SPAWN_ID, clearStartOverrides } from './core/progress';
import { createProgressPanel } from './ui/progressPanel';
import { WeaponFinishStore } from './weapons/weaponFinishes';
import { WorldCoop } from './coop/worldCoop';
import { createCoopPanel } from './coop/coopPanel';
import { normalizeRoomCode, type PlayerWireState } from './coop/coopProtocol';
import { createWeaponFinishControl } from './weapons/weaponFinishControl';
import { PointLightCensus } from './rendering/pointLightCensus';
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
cloudShadowUniform.value = lowQ ? 0 : 1;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let bootFailed = false, worldExited = false;
let frameClockInvalid = true;
const invalidateFrameClock = () => { frameClockInvalid = true; };
let graphicsRecovery: WorldGraphicsRecovery | undefined;
let suspendForGraphics = () => {};
addEventListener('pagehide', event => { if (!event.persisted) { worldExited = true; graphicsRecovery?.dispose(); if (document.pointerLockElement) document.exitPointerLock(); } });
let disposeRenderer = () => {};
const languageToggle = createLanguageToggle();
let refreshWorldLocale = () => {};
let loadingSource = '加载中…';
const renderLoading = () => {
  $('loading').hidden=loadingSource==='点击进入（ESC 释放鼠标）'&&!bootFailed&&!graphicsRecovery?.blocked;
  $('loading').textContent = !bootFailed && graphicsRecovery?.state === 'lost'
    ? bilingual('图形上下文暂时不可用，世界已暂停。等待浏览器恢复；任务存档不会被清空。', 'Graphics context unavailable. World simulation is paused while the browser attempts recovery; quest saves are not cleared.')
    : !bootFailed && graphicsRecovery?.state === 'awaiting-resume'
      ? bilingual('浏览器已报告图形上下文恢复。点击重新进入；关闭其他窗口后再继续。', 'The browser reports graphics restoration. Close other panels, then click to resume.')
      : localizeText(loadingSource);
};
const setLoading = (source: string) => { loadingSource = source; renderLoading(); };
localizeDom(document.body);
onLanguageChange(() => {
  localizeDom(document.body);
  renderLoading();
  refreshWorldLocale();
});

async function boot() {

// ───────────── renderer / scene ─────────────
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: params.has('nopost'), preserveDrawingBuffer: params.has('shot') });
// Shipped builds never read shader logs: that read forces each new program to finish compiling on the spot
// (a visible hitch the first time an era, effect or enemy appears). Dev builds keep the checks.
if (import.meta.env?.PROD) renderer.debug.checkShaderErrors = false;
disposeRenderer = () => renderer.dispose();
graphicsRecovery = new WorldGraphicsRecovery(canvas, () => suspendForGraphics(), () => {
  invalidateFrameClock();
  if (worldExited || bootFailed) return;
  renderLoading(); $('start').classList.remove('hidden');
});
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
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
const shadowCenter = new THREE.Vector3(), lastShadowCenter = new THREE.Vector3(), shadowBasis = new THREE.Matrix4(), shadowInverse = new THREE.Matrix4();
let shadowTick = 0;
const farProps = new FarPropCuller(), lastFarEye = new THREE.Vector3();
let cameraKick = 0; const camRight = new THREE.Vector3();
/** 0..1 view kick; reduced effects turns it off. Bigger melee weapons and finishers kick harder. */
function kickCamera(amount: number) { if (!reducedEffects()) cameraKick = Math.max(cameraKick, Math.min(1, amount)); }
function meleeKick() { const id = actions?.melee.style.id, combo = actions?.melee.combo ?? 0; return (id === 'hammer' ? .75 : id === 'polearm' ? .45 : .35) + (combo === 2 ? .25 : 0); }
const ORIGIN = new THREE.Vector3(), UNIT_Y = new THREE.Vector3(0, 1, 0), UNIT_Z = new THREE.Vector3(0, 0, 1);
const SHADOW_TEXEL = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
function snapShadowCenter(at: THREE.Vector3, toSun: THREE.Vector3, out: THREE.Vector3) {
  shadowBasis.lookAt(toSun, ORIGIN, Math.abs(toSun.y) > .99 ? UNIT_Z : UNIT_Y);
  shadowInverse.copy(shadowBasis).transpose();
  out.copy(at).applyMatrix4(shadowInverse);
  out.x = Math.round(out.x / SHADOW_TEXEL) * SHADOW_TEXEL; out.y = Math.round(out.y / SHADOW_TEXEL) * SHADOW_TEXEL;
  return out.applyMatrix4(shadowBasis);
}
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
/** Compiles `root`'s shaders in parallel, for the target they are really drawn into: with post-processing
 * the scene renders into the composer's linear, untonemapped buffer, and a program compiled for the
 * screen would not match (and would be compiled again on the frame the art first appears). */
function warmShaders(root: THREE.Object3D): Promise<unknown> | void {
  if (typeof renderer.compileAsync !== 'function') return;
  const previous = renderer.getRenderTarget();
  if (composer) renderer.setRenderTarget(composer.readBuffer);
  try { return renderer.compileAsync(root, camera, scene); } finally { renderer.setRenderTarget(previous); }
}
function applyResolution() {
  if (graphicsRecovery?.blocked || worldExited || bootFailed) return;
  renderer.setPixelRatio(dpr);
  composer?.setPixelRatio(dpr);
}

addEventListener('resize', () => {
  if (bootFailed || worldExited || graphicsRecovery?.blocked) return;
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
    regionLoader().loadAsync(`./assets/${def.file}.core.glb`, progress(def.file)),
  ]);
  for (const name of ['ART', 'COLLISION', 'Terrain']) {
    if (!gltf.scene.getObjectByName(name)) throw new Error(bilingual(`地图模型缺少 ${name} 节点`, `Map model is missing the ${name} node`));
  }
  bakeQuantized(gltf.scene);
  placeRegion(gltf.scene, def);
  return { def, layout: lay, root: gltf.scene };
}));
if (worldExited || !(await graphicsRecovery.whenContextAvailable())) return;
const layout = mergeLayouts(parts);
const world = new THREE.Group();
world.name = 'World';
for (const p of parts) world.add(p.root);
scene.add(world);
world.updateMatrixWorld(true);
const streamStatus=document.createElement('div');streamStatus.id='world-region-loading';Object.assign(streamStatus.style,{position:'fixed',top:'18px',left:'50%',transform:'translateX(-50%)',padding:'8px 12px',background:'#172e3de8',color:'#edf5e8',borderRadius:'6px',zIndex:'30'});streamStatus.hidden=true;const streamText=document.createElement('span'),streamRetry=document.createElement('button');streamRetry.textContent=bilingual('重试地区加载','Retry region loading');streamRetry.hidden=true;streamStatus.append(streamText,streamRetry);document.body.append(streamStatus);let streamFailure='';
const regionVisuals=new RegionVisualStreaming({parent:world,warm:root=>warmShaders(root),uploadBudget:(lowQ?3:6)*1048576,carve:carveCoreRing,eager:params.has('eager'),outlines:!params.has('noline'),lowQuality:lowQ,status:(id,error)=>{streamFailure=error?id:'';streamStatus.hidden=!id;streamText.textContent=error?bilingual('地区画面暂时未能加载，道路与进度已保留。','Region art could not load; routes and progress are retained.'):bilingual('正在载入前方地区…','Loading the region ahead…');streamRetry.hidden=!error;}});streamRetry.onclick=e=>{e.stopPropagation();if(streamFailure)void regionVisuals.retry(streamFailure);};
addEventListener('pagehide',e=>{if(!e.persisted){regionVisuals.dispose();streamStatus.remove();}});
const initialVisualRegion=params.get('region')??'alpha';if(params.has('eager'))await Promise.all(REGIONS.map(r=>regionVisuals.ensure(r.id)));else if(!(await regionVisuals.ensure(REGIONS.some(r=>r.id===initialVisualRegion)?initialVisualRegion:'alpha')))throw Error(bilingual('起始地区画面加载失败，请重新载入。','Starting region art failed to load; reload to retry.'));
document.title = 'Parhelion · World';
// Every lit fragment loops over every point light, so the pool size is a direct per-pixel cost.
const localLights = new LocalLightPool([
  { p: [182, 6, -60], color: '#7ff6ff', intensity: 60, distance: 26, decay: 1.6 },
  ...(layout.lights ?? []),
], lowQ ? 3 : highQ ? 8 : 5);
scene.add(localLights.root);
const lightCensus = new PointLightCensus(scene, new Set(localLights.lights));
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
// Reuse conversion only for the same immutable authored source material.
// Stateful, translucent and named interactive surfaces keep private materials.
const staticMaterialCache = new WeakMap<THREE.Material, THREE.Material>();
for (const m of artMeshes) {
  if (m.name === 'Water' && m !== waterMesh) continue;
  if (m.name === 'Terrain') terrains.push(m);
  const sourceMaterial = m.material as THREE.Material;
  const shareMaterial = isStaticArtEligible(m) && !/halo|gate|door|core|beam|target|water/i.test(m.name)
    && !Array.isArray(m.material) && !sourceMaterial.transparent && sourceMaterial.opacity === 1
    && sourceMaterial.blending === THREE.NormalBlending && !/Water|Beam|Halo|Target|Emissive/.test(sourceMaterial.name);
  const cachedMaterial = shareMaterial ? staticMaterialCache.get(sourceMaterial) : undefined;
  m.material = cachedMaterial ?? toonMaterial(sourceMaterial);
  if (shareMaterial && !cachedMaterial) staticMaterialCache.set(sourceMaterial, m.material);
  m.receiveShadow = true;
  m.castShadow = !['Terrain', 'Water', 'Waterfall', 'Bushes', 'Glow_Props'].includes(m.name) && (m.material as THREE.Material).name !== 'M_Beam';
  if ((m.material as THREE.Material).name === 'M_Beam') m.receiveShadow = false;
  if (m.name.startsWith('TGT_')) {
    targets.push(m);
    // a target that must be shot from a spot (the fort cannon): that spot is region-local, make it world
    const near = m.userData.near as [number, number] | undefined;
    const part = parts.find((p) => { let o: THREE.Object3D | null = m; while (o && o !== p.root) o = o.parent; return !!o; });
    if (near && part) m.userData.nearWorld = regionToWorld(part.def, near[0], near[1]);
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
  // Terrain is the largest draw-call source at distance (one draw per 64 m cell out to the fog);
  // 128 m cells cut it to a quarter while frustum culling stays effective. Props keep 64 m cells.
  const pieces = !special && tris > 4000 ? chunkMesh(m, m.name === 'Terrain' ? 128 : 64) : [m];
  for (const c of pieces) {
    if (m.userData.outline && !params.has('noline')) addOutline(c);
    if (pieces.length > 1) culler.add(c, DRAW_DIST[m.name] ?? 1e9, streamedOutlineDistance(m.name));
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
const falseDawnSites = createFalseDawnSites((x, z) => grid.sampleHeight(x, z), { nearStructureShadows: !lowQ });
world.add(falseDawnSites.root); freezeStaticArt(falseDawnSites.root);
staticGeos.push(...falseDawnSites.collisionGeometries); layout.markers.push(...falseDawnSites.markers);
const falseDawnMarkerIds = new Set(falseDawnSites.markers.map(marker => marker.id));
addEventListener('pagehide', event => { if (!event.persisted) falseDawnSites.dispose(); });
const kingdomGateScene = createKingdomGateScene((x,z)=>grid.sampleHeight(x,z)??34);
world.add(kingdomGateScene.root);
staticGeos.push(...kingdomGateScene.collisionGeometries);
colliders.push(kingdomGateScene.collider);
layout.markers.push(...kingdomGateScene.markers);
targets.push(kingdomGateScene.latch);
const kingdomGateMarkerIds = new Set(kingdomGateScene.markers.map(m=>m.id));
let kingdomGateRuntime: ReturnType<typeof createKingdomGateRuntime> | undefined;
addEventListener('pagehide', e=>{if(!e.persisted)kingdomGateScene.dispose();});
const compactRelaySites = createCompactRelaySites((x, z) => grid.sampleHeight(x, z));
world.add(compactRelaySites.root); freezeStaticArt(compactRelaySites.root);
staticGeos.push(...compactRelaySites.collisionGeometries); layout.markers.push(...compactRelaySites.markers);
const compactRelayMarkerIds = new Set(compactRelaySites.markers.map(marker => marker.id));
addEventListener('pagehide', event => { if (!event.persisted) compactRelaySites.dispose(); });
const armoryWorkshop=createArmoryWorkshop();
world.add(armoryWorkshop.root);
armoryWorkshop.root.traverse(o=>{if(o instanceof THREE.Mesh){o.material=toonMaterial(o.material as THREE.Material);o.geometry.computeBoundingSphere();culler.add(o,180,0);}});
freezeStaticArt(armoryWorkshop.root);
addEventListener('pagehide',event=>{if(!event.persisted)armoryWorkshop.dispose();});
const alphaResidence = settlements.placements.find(p => p.id === 'alpha');
const valleyPrologueScene = alphaResidence ? createValleyPrologueScene(alphaResidence, (x, z) => grid.sampleHeight(x, z)) : null;
if (valleyPrologueScene) {
  scene.add(valleyPrologueScene.root);
  colliders.push(...valleyPrologueScene.colliders);
  layout.markers.push(...valleyPrologueScene.markers);
  targets.push(...valleyPrologueScene.targets);
}
const settlementNpcs = createSettlementNpcs([...settlements.npcs, ...campaignSites.npcs, ...orleansResidentSockets(), ...qinResidentSockets(), ...egyptResidentSockets(), ...homeResidentSockets(), ...(valleyPrologueScene?.npcs ?? [])]);
addEventListener('pagehide', event => { if (!event.persisted) valleyPrologueScene?.dispose(); });
addEventListener('pagehide', event => { if (!event.persisted) settlementNpcs.dispose(); });
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
const parallaxGarden = createParallaxGarden((x,z)=>grid.sampleHeight(x,z));
world.add(parallaxGarden.root);
staticGeos.push(...parallaxGarden.collisionGeometries); layout.markers.push(...parallaxGarden.markers);
const parallaxMarkerIds = new Set(parallaxGarden.markers.map(m=>m.id));
layout.areas.push({id:'parallax_garden',name:'视差庭院',nameEn:'Parallax Garden',c:[-118,276],r:10,color:'#ddc28c',tp:[-118,284],region:'alpha'});
addEventListener('pagehide',event=>{if(!event.persisted)parallaxGarden.dispose();});
// 秦地军令机关: turntable ranks and the deep-shaft gate under Mount Li.
const qinArmyOrder = createQinArmyOrder(m => toonMaterial(m));
world.add(qinArmyOrder.root); colliders.push(...qinArmyOrder.colliders); layout.markers.push(...qinArmyOrder.markers);
const qinOrderMarkerIds = new Set<string>(QIN_ORDER_MARKERS);
addEventListener('pagehide',event=>{if(!event.persisted)qinArmyOrder.dispose();});
const qinAtmosphere = createQinAtmosphere(); world.add(qinAtmosphere.root);
const qinLift = createQinLift(m => toonMaterial(m)); world.add(qinLift.root); colliders.push(...qinLift.colliders); layout.markers.push(...qinLift.markers);
const qinLiftMarkerIds = new Set<string>(QIN_LIFT_MARKERS);
const qinSentinels = createQinSentinels(m => toonMaterial(m)); world.add(qinSentinels.root);
addEventListener('pagehide',event=>{if(!event.persisted)qinSentinels.dispose();});
// 古埃及引光机关: turning mirrors lead sunlight to the sanctuary's sun disc.
const egyptMirrors = createEgyptSunMirrors(m => toonMaterial(m)); world.add(egyptMirrors.root); colliders.push(...egyptMirrors.colliders); layout.markers.push(...egyptMirrors.markers);
const egyptMirrorMarkerIds = new Set<string>(EGYPT_MIRROR_MARKERS);
const egyptAtmosphere = createEgyptAtmosphere(); world.add(egyptAtmosphere.root);
addEventListener('pagehide',event=>{if(!event.persisted)egyptAtmosphere.dispose();});
addEventListener('pagehide',event=>{if(!event.persisted)egyptMirrors.dispose();});
addEventListener('pagehide',event=>{if(!event.persisted)qinLift.dispose();});
addEventListener('pagehide',event=>{if(!event.persisted)qinAtmosphere.dispose();});
const staticGeo = mergeParts(staticGeos);
const staticBVH = new MeshBVH(staticGeo);
colliders.unshift({ name: 'static', bvh: staticBVH, enabled: true });
const flagshipInterior=createFlagshipInterior();world.add(flagshipInterior.root);colliders.push(...flagshipInterior.colliders);layout.markers.push(...flagshipInterior.markers);
addEventListener('pagehide',e=>{if(!e.persisted)flagshipInterior.dispose();});
const adventureSites=createAdventureSites((x,z,ceiling=300)=>{const ray=new THREE.Ray(new THREE.Vector3(x,ceiling,z),new THREE.Vector3(0,-1,0));let y:number|null=null;for(const c of colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&(y===null||hit.point.y>y))y=hit.point.y;}return y;});
world.add(adventureSites.root);colliders.push(...adventureSites.colliders);layout.markers.push(...adventureSites.markers);targets.push(...adventureSites.targets);
const recordAction=adventureSites.actions.get('adventure_harbor_records')!;recordAction.p=[...flagshipInterior.recordStand];const recordMarker=adventureSites.markers.find(m=>m.id===recordAction.id)!;recordMarker.p=[recordAction.p[0],recordAction.p[1]+.9,recordAction.p[2]];
const alarmMarker=flagshipInterior.markers[0];adventureSites.actions.set(alarmMarker.id,{id:alarmMarker.id,region:'blacksail',label:['船腹警报断路器','Hold alarm breaker'],p:[alarmMarker.p[0],alarmMarker.p[1]-.9,alarmMarker.p[2]],seconds:2,flag:'adventure_harbor_alarm_disabled'});
const adventureMarkerIds=new Set([...adventureSites.markers,...flagshipInterior.markers].map(m=>m.id));
let adventureRuntime:ReturnType<typeof createAdventureRuntime>|undefined;
let cavalrySupport:LocalCavalrySupport|undefined;
let residentEventRuntime:ReturnType<typeof createResidentEventRuntime>|undefined;
addEventListener('pagehide',event=>{if(!event.persisted)adventureSites.dispose();});
const residentQueries=makeCombatTerrain(colliders,layout);
const kingdomHearth = layout.markers.find(marker => marker.id === 'hall_brazier_1');
const kingdomWorksScene = kingdomHearth ? createKingdomWorksScene(kingdomHearth.p,
  (x, z, ceiling) => residentQueries.ground(x, z, ceiling)?.point.y ?? null,
  p => residentQueries.clear(p, .38, 1.8)) : null;
const kingdomWorkMarkers = new Set(kingdomWorksScene?.markers.map(marker => marker.id));
if (kingdomWorksScene) {
  world.add(kingdomWorksScene.root); layout.markers.push(...kingdomWorksScene.markers); targets.push(kingdomWorksScene.target);
  addEventListener('pagehide', event => { if (!event.persisted) kingdomWorksScene.dispose(); });
}
const worldJourneySites = alphaResidence ? createWorldJourneySites(alphaResidence, (x, z, ceiling) => residentQueries.ground(x, z, ceiling)?.point.y ?? null, p => residentQueries.clear(p, .38, 1.8)) : null;
const valleyFieldScene = alphaResidence ? createValleyFieldScene(alphaResidence, (x, z, ceiling) => residentQueries.ground(x, z, ceiling)?.point.y ?? null, p => residentQueries.clear(p, .38, 1.8)) : null;
const skyCrown = createSkyCrownScene();
const worldJourneyMarkerIds = new Set<string>();
for (const site of [worldJourneySites, skyCrown]) {
  if (!site) continue;
  scene.add(site.root); colliders.push(...site.colliders); targets.push(...site.targets);
  layout.markers.push(...site.markers);
  site.markers.forEach(marker => worldJourneyMarkerIds.add(marker.id));
}
if (valleyFieldScene) {
  scene.add(valleyFieldScene.root); colliders.push(...valleyFieldScene.colliders); layout.markers.push(...valleyFieldScene.markers);
  valleyFieldScene.markers.forEach(marker => worldJourneyMarkerIds.add(marker.id));
  addEventListener('pagehide', event => { if (!event.persisted) valleyFieldScene.dispose(); });
}
addEventListener('pagehide', event => { if (!event.persisted) { worldJourneySites?.dispose(); skyCrown.dispose(); } });
const orleansWorksScene=createOrleansWorksScene((x,z,ceiling)=>residentQueries.ground(x,z,ceiling)?.point.y??null);
world.add(orleansWorksScene.root);colliders.push(orleansWorksScene.collider);layout.markers.push(...orleansWorksScene.markers);
const orleansWorksMarkerIds=new Set(orleansWorksScene.markers.map(m=>m.id));
const realmClimaxSites = worldJourneySites ? createRealmClimaxSites({
  egypt: worldJourneySites.markers.find(m => m.id === REALM_HANDOVER.egypt)!,
  orleans: worldJourneySites.markers.find(m => m.id === REALM_HANDOVER.orleans)!,
  qin: worldJourneySites.markers.find(m => m.id === REALM_HANDOVER.qin)!,
}, (x, z, ceiling) => residentQueries.ground(x, z, ceiling)?.point.y ?? null,
p => residentQueries.clear(p, .38, 1.8), (a, b) => {
  const delta = b.clone().sub(a);
  return !residentQueries.cast(a, delta, Math.max(0, delta.length() - .1));
}) : null;
const realmStationByMarker = new Map<string, { region: RealmClimaxId; station: ClimaxStation | 'start' }>();
if (realmClimaxSites) {
  scene.add(realmClimaxSites.root); layout.markers.push(...realmClimaxSites.markers); targets.push(...realmClimaxSites.targets);
  for (const region of REALM_CLIMAX_IDS) for (const station of ['start', 'west', 'east'] as const) {
    const id = climaxMarker(region, station);
    realmStationByMarker.set(id, { region, station }); worldJourneyMarkerIds.add(id);
  }
  addEventListener('pagehide', event => { if (!event.persisted) realmClimaxSites.dispose(); });
}
const egyptGaugeScene = createEgyptGaugeScene((x, z, ceiling) => residentQueries.ground(x, z, ceiling)?.point.y ?? null,
  p => residentQueries.clear(p, .38, 1.8));
if (egyptGaugeScene) {
  world.add(egyptGaugeScene.root); colliders.push(egyptGaugeScene.collider); layout.markers.push(...egyptGaugeScene.markers);
  egyptGaugeScene.markers.forEach(marker => worldJourneyMarkerIds.add(marker.id));
  addEventListener('pagehide', event => { if (!event.persisted) egyptGaugeScene.dispose(); });
}
let gaugeKeeperSpeaking = false;
const culturalGround = (x: number, z: number, ceiling: number) => residentQueries.ground(x, z, ceiling)?.point.y ?? null;
const culturalClear = (p: THREE.Vector3) => residentQueries.clear(p, .38, 1.8);
const orleansShadowPlay = createOrleansShadowPlay(culturalGround, culturalClear);
const qinCrookedEffigy = createQinCrookedEffigy(culturalGround, culturalClear);
for (const site of [orleansShadowPlay, qinCrookedEffigy]) {
  if (!site) continue;
  world.add(site.root); colliders.push(site.collider); layout.markers.push(...site.markers);
  site.markers.forEach(marker => worldJourneyMarkerIds.add(marker.id));
  addEventListener('pagehide', event => { if (!event.persisted) site.dispose(); });
}
const fieldSideSites = alphaResidence ? createFieldSideSites(layout.markers, alphaResidence.position, layout.world.waterLevel,
  culturalGround, culturalClear) : null;
if (fieldSideSites) {
  world.add(fieldSideSites.root);
  colliders.push(...fieldSideSites.colliders);
  targets.push(...fieldSideSites.targets);
  layout.markers.push(...fieldSideSites.markers);
  fieldSideSites.markers.forEach(marker => worldJourneyMarkerIds.add(marker.id));
  addEventListener('pagehide', event => { if (!event.persisted) fieldSideSites.dispose(); });
}
let shadowPlayCue: { afterSiege: boolean; swallowtail: boolean } | null = null;
let qinPotterSpeaking = false;

let activeRealmClimax: ReturnType<typeof createRealmClimax> | null = null;
// 奥尔良外圈: the mill wheel, the windmill sails and the region's own air.
const orleansOutskirts=createOrleansOutskirtsScene();world.add(orleansOutskirts.root);
const orleansAtmosphere=createOrleansAtmosphere();world.add(orleansAtmosphere.root);
addEventListener('pagehide',e=>{if(!e.persisted){orleansOutskirts.dispose();orleansAtmosphere.dispose();}});
let orleansWorksRuntime:ReturnType<typeof createOrleansWorksRuntime>|undefined;
addEventListener('pagehide',e=>{if(!e.persisted){orleansWorksRuntime?.dispose();orleansWorksScene.dispose();}});
const orleansResidentLife=createOrleansResidentLife(settlementNpcs,(x,z,ceiling)=>residentQueries.ground(x,z,ceiling)?.point.y??null);
addEventListener('pagehide',e=>{if(!e.persisted)orleansResidentLife.dispose();});
const qinResidentLife=createQinResidentLife(settlementNpcs,(x,z,ceiling)=>residentQueries.ground(x,z,ceiling)?.point.y??null);
addEventListener('pagehide',e=>{if(!e.persisted)qinResidentLife.dispose();});
const egyptResidentLife=createEgyptResidentLife(settlementNpcs,(x,z,ceiling)=>residentQueries.ground(x,z,ceiling)?.point.y??null);
const homeResidentLife=createHomeResidentLife(settlementNpcs,colliders);
addEventListener('pagehide',e=>{if(!e.persisted)homeResidentLife.dispose();});
addEventListener('pagehide',e=>{if(!e.persisted)egyptResidentLife.dispose();});
const residentEventScene=createResidentEventScene(campaignSites.markers,(x,z,ceiling=300)=>residentQueries.ground(x,z,ceiling)?.point.y??null,p=>residentQueries.clear(p,.38,1.8));
world.add(residentEventScene.root);layout.markers.push(...residentEventScene.markers);const residentEventMarkerIds=new Set(residentEventScene.markers.map(m=>m.id));
addEventListener('pagehide',e=>{if(!e.persisted)residentEventScene.dispose();});
// Merged BVHs own copied buffers. Release construction-only arrays without
// disposing source geometry that other authored systems may still reference.
staticGeos.length = 0; existingPropGeos.length = 0;
const consumedSourceReceipt = detachConsumedSourceNodes(world, colliders.map(collider => collider.bvh.geometry));

if (!lowQ) enhanceWater(waterMesh.material as THREE.Material, grid, layout.world.waterLevel);
const homeGrassRoutes=HOME_ROUTES.map(r=>({region:'alpha' as const,length:0,points:r.points.map(p=>[p[0]+720,p[1],p[2]] as [number,number,number])}));
const homeGrassBuildings=HOME_BUILDINGS.map(h=>[h.p[0]+720-h.w/2-1,h.p[2]-h.d/2-1,h.p[0]+720+h.w/2+1,h.p[2]+h.d/2+1] as const);
const homeGrassCourts=HOME_SITES.filter(s=>['square','garden','practice','park'].includes(s.id)).map(s=>[s.position[0]+720,s.position[2],s.radius,s.radius] as const);
const grass = !lowQ && !params.has('nograss') ? makeGrassField(grid, settlementBlockers, layout.world.waterLevel, { count: highQ ? 160000 : 80000, size: highQ ? 90 : 68, excluded: settlementGrassClearance(grid, settlements.placements, [...settlementApproaches.routes,kingdomGateScene.walkway,...homeGrassRoutes],[...ARMORY_WORKSHOP.clearance, ...PARALLAX_CLEARANCE, ...EXPANSION_GRASS_CLEARANCE,...homeGrassBuildings],[...ORLEANS_PAVED_COURTS,...homeGrassCourts]) }) : null;
if (grass) scene.add(grass.mesh);
scene.add(makeUpdrafts(layout.updrafts ?? []));
// 各时代的空气：幻日谷花粉、落日王国落叶、黑帆浪沫与雨线、永冬飘雪、京都余烬与落樱。
const ambient = lowQ ? null : makeRegionWeather(highQ ? 2400 : 1300);
if (ambient) scene.add(ambient.points);
debugCol.add(new THREE.Mesh(staticGeo, debugMat));
debugCol.visible = false;
scene.add(debugCol);

const collider = (name: string) => colliders.find((c) => c.name === name);
const markers = new Map<string, Marker>(layout.markers.map((m) => [m.id, m]));
// Fast-play claim points for the recovered three-servant World assets.
// Positions are existing region hubs, not new terrain or map boundaries.
const modelClaimPoints = MODEL_CLAIM_POINTS;
for (const point of modelClaimPoints) { layout.markers.push(point.marker); markers.set(point.marker.id, point.marker); }
const map = new WorldMap(grid, layout);
const objectiveFor = (x: number, z: number) => layout.objectives.find((o) => o.region === regionAt(x, z).id)!.objective;

// ───────────── progress (local, per browser) ─────────────
const progressStorage = (() => { try { return localStorage; } catch { return undefined; } })();
const worldProgress = new WorldProgress(progressStorage);
const { done, found } = worldProgress;
// 幻日探索层：宝箱、日晕之羽、石像、棱镜谜题、时层挑战、战斗据点（src/exploration）。
const exploration=createExploration({done,save:()=>save(),toast:text=>toast(text),terrain:(x,z)=>grid.sampleHeight(x,z)??0,waterLevel:layout.world.waterLevel,
 startEncounter:spec=>combat.startStoryEncounter(spec,{position:player.pos,playable:gameplayActive()&&player.onGround&&!combat.defeated&&!player.flying&&!player.gliding&&!player.swimming}),
 activeEncounter:()=>combat.storyEncounter?.id??null,cancelEncounter:()=>combat.cancelStoryEncounter(),
 onGlideLevel:level=>applyExplorationGlide(level),onResonance:()=>{combat.syncWorldProgress(done);hudRevision++;},sound:kind=>audio.explore(kind),refillAmmo:rounds=>combat.refillAmmo(rounds)});
// 环境生灵：蝴蝶、飞鸟与萤火，按时代各不相同（3 次绘制，无碰撞，无玩法影响）。
const ambientLife=createAmbientLife({terrain:(x,z)=>grid.sampleHeight(x,z)??0,waterLevel:layout.world.waterLevel});world.add(ambientLife.root);addEventListener('pagehide',event=>{if(!event.persisted)ambientLife.dispose();});
world.add(exploration.root);colliders.push(...exploration.colliders);layout.markers.push(...exploration.markers);
// 野外草药：每个时代一种回复植物，长在据点、秘境、决斗场与精英巢穴附近；战斗中走过即回复 25 生命，90 秒后再生。
const fieldHerbs=createFieldHerbs({terrain:(x,z)=>grid.sampleHeight(x,z)??0,waterLevel:layout.world.waterLevel,
  blocked:(x,z)=>{const hit=residentQueries.ground(x,z);return !!hit&&hit.point.y-(grid.sampleHeight(x,z)??0)>.45;},
  heal:amount=>typeof combat!=='undefined'?combat.state.fieldHeal(amount):0,
  eaten:(name,gained)=>toast(bilingual(`${name[0]} · 生命 +${Math.round(gained)}`,`${name[1]} · HP +${Math.round(gained)}`))});
scene.add(fieldHerbs.root); // animated (pulsing glow): kept out of the static World art tree
addEventListener('pagehide',event=>{if(!event.persisted)fieldHerbs.dispose();});
addEventListener('pagehide',event=>{if(!event.persisted)exploration.dispose();});
/** Field ammo: settlements refill the rifle; an empty trigger pull points the player at the blade. */
let ammoDryPulls=0,ammoHintAt=-1e9,ammoRefillAt=-1e9;
function fieldAmmo(){
  const st=combat.state,t=performance.now();
  if(st.dryPulls!==ammoDryPulls){ammoDryPulls=st.dryPulls;if(t-ammoHintAt>5000){ammoHintAt=t;const hint=weaponDryFireHint(st,settings.label('melee'));if(hint)toast(bilingual(...hint));}}
  if(!gameplayActive()||combat.defeated||st.ammo>=WORLD_RIFLE.ammoMax||st.quietFor<2||t-ammoRefillAt<1500)return;
  const home=settlements.placements.find(p=>Math.hypot(player.pos.x-p.position[0],player.pos.z-p.position[2])<Math.hypot(...p.footprint)/2+18);
  if(!home)return;
  ammoRefillAt=t;const got=st.refillAmmo();
  if(got>0)toast(bilingual(`${home.name[0]}：补充弹药 +${got}（${st.ammo}/${WORLD_RIFLE.ammoMax}）`,`${home.name[1]}: rounds resupplied +${got} (${st.ammo}/${WORLD_RIFLE.ammoMax})`));
}
function applyExplorationGlide(level=explorationGlideLevel(done)){const g=explorationGlideScale(level);player.glideSpeedScale=g.speed;player.glideSinkScale=g.sink;}
const weaponFinishStore = new WeaponFinishStore(progressStorage);
let weaponFinishControl: ReturnType<typeof createWeaponFinishControl> | undefined;
const save = () => worldProgress.save();
valleyPrologueScene?.apply(valleyPrologueStage(done), done, true);

let actions: WorldActions | undefined;
const fortCannon = new FortCannon();
const audio = new WorldAudio();
const travelStops = createSafeTravelStops(settlements.placements);
travelStops.push({id:'travel_home',region:'home',name:['归乡广场 · 家','Homeward Square · Home'],position:[570,16.1,40],foundFlag:'travel_home',radius:12});
for (const [region, id, name] of [['egypt', JOURNEY.egyptRead, ['埃及绿洲', 'Egyptian Oasis']], ['orleans', JOURNEY.orleansRead, ['奥尔良集市', 'Orleans Market']], ['qin', JOURNEY.qinRead, ['秦国工匠镇', 'Qin Workers’ Town']]] as const) {
  const marker = markers.get(id);
  if (marker) travelStops.push({ id: `travel_${region}`, region, name: [...name], position: [marker.p[0], marker.p[1] - .92, marker.p[2]], foundFlag: `travel_${region}`, radius: 10 });
}
travelStops.push({ id: 'compact_relay_outpost', region: 'alpha', name: ['前沿部署 · 前哨站南门外', 'Forward deployment · Outpost south gate'], position: [...compactRelaySites.arrival], foundFlag: 'compact_relay_outpost', radius: 3, requiredCompletionFlag: 'compact_relay_complete' });
let compactRelayRuntime: ReturnType<typeof createCompactRelayRuntime> | undefined;
let relayDamageRevision = 0;
const relayLastPosition = new THREE.Vector3();
let hudRevision = 0;
let travelOpenState = false;
let narrative: ReturnType<typeof createNarrativePanel> | undefined;
let homeTown:ReturnType<typeof createHomeTown>|undefined;
let ultimateDirector: UltimateDirector | undefined;
let ultimateStage: UltimateStage | undefined;
let ultimateSource: { identity: CompanionId | null; root: THREE.Object3D } | null = null;
let optionalPin: OptionalPin | null = null;
let questTrackedId: string | null = null;
let questJournal: ReturnType<typeof createQuestJournal> | undefined;
let questCatalog: ReturnType<typeof createQuestGuideCatalog> | undefined;
let questCacheKey = '', questEntries: QuestEntry[] = [];
function currentQuestEntries(): QuestEntry[] {
  if(!questCatalog)return [];
  const here = regionAt(player.pos.x, player.pos.z).id;
  const key=`${here}:${hudRevision}:${residentEventRuntime?.crossing}:${done.size}:${found.size}:${fortCannon.mounted}:${compactRelayRuntime?.active}:${Math.floor((compactRelayRuntime?.progress ?? 0)*30)}:${homeTown?.activities.carrying}`;
  if(key!==questCacheKey){
    questCacheKey=key;
    questEntries=questCatalog.list(done,found,{homeCarrying:homeTown?.activities.carrying,dryCrossing:residentEventRuntime?.crossing,mounted:fortCannon.mounted,compactRelay:{active:compactRelayRuntime?.active??false,progress:(compactRelayRuntime?.progress??0)*3}});
    const next = journeyGuide();
    const complete = done.has(JOURNEY.epilogue);
    if (next || complete) {
      const region = !next || next.region === 'sky' ? 'alpha' : next.region;
      const guide: QuestGuide | null = next ? { title: next.title, text: next.text, targetId: next.targetId, targetKind: 'marker', region, position: next.p, targetLabel: next.text } : null;
      questEntries.unshift({ id: 'main:journey', region, category: 'main', title: ['让明天继续','Let Tomorrow Continue'], complete, guide });
    }
  }
  return questEntries;
}
function trackedQuest(): QuestGuide | null {
  if(!questTrackedId)return null;
  return currentQuestEntries().find(entry=>entry.id===questTrackedId)?.guide ?? null;
}
let campaignTrackedRegion: RegionId | null = null;
let campaignJournalOpen = false;
let campaignJournal: ReturnType<typeof createCampaignJournal> | undefined;
let falseDawnRuntime: ReturnType<typeof createFalseDawnRuntime> | undefined;
let falseDawnTracked = false;
let trackedStoryHud: ReturnType<typeof createTrackedStoryHud> | undefined;
const mapBudget = new FrameWorkBudget(30), hudBudget = new FrameWorkBudget(10), statsBudget = new FrameWorkBudget(4);
const eraStoryScenes = settlements.placements.filter(p => isEraId(p.id)).map(p => ({ ...createEraStoryScene(p), region: p.id }));
const eraOptionalIds = new Set(Object.values(ERA_OPTIONALS).map(x => x.id));
for (const site of eraStoryScenes) {
  scene.add(site.group); freezeStaticArt(site.group); colliders.push(...site.colliders);
  for (const marker of site.markers) { layout.markers.push(marker); markers.set(marker.id, marker); }
}
addEventListener('pagehide', event => { if (!event.persisted) for (const site of eraStoryScenes) site.dispose(); });
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
function prologueGuide() {
  if (!valleyPrologueScene || regionAt(player.pos.x, player.pos.z).id !== 'alpha') return null;
  const guide = valleyPrologueGuide(valleyPrologueStage(done));
  if (!guide) return null;
  const p = markers.get(guide.targetId)?.p ?? settlementNpcs.getPosition(guide.targetId);
  return p ? { ...guide, p } : null;
}
function valleyGuide() {
  if (!valleyStoryScene || regionAt(player.pos.x, player.pos.z).id !== 'alpha') return null;
  const guide = getValleyStoryGuide(done); if (!guide) return null;
  const point = guide.targetKind === 'npc' ? settlementNpcs.getPosition(guide.targetId) : markers.get(guide.targetId)?.p;
  return point ? { ...guide, p: point } : null;
}
function journeyGuide() {
  const here = insideSkyCrown(player.pos) ? 'sky' : regionAt(player.pos.x, player.pos.z).id;
  if (typeof activeRealmClimax !== 'undefined' && activeRealmClimax) {
    const fight = activeRealmClimax;
    const station = (['west', 'east'] as const).find(id => fight.stationReady(id));
    const targetId = climaxMarker(fight.id, station ?? 'start');
    const p = markers.get(targetId)?.p;
    if (p) return { region: fight.id, targetId, p, title: fight.definition.title,
      text: (station ? fight.stationText(station) : ['躲开标线，攻击战场上的目标。', 'Evade the marked attack and shoot the exposed target.']) as [string, string] };
  }
  const guide = worldJourneyGuide(here, done);
  if (guide && here === 'alpha' && journeyDestinations(done).some(destination => destination.id === guide.region)) {
    const p = markers.get(JOURNEY_DISPATCH)?.p;
    if (p) return { ...guide, region: 'alpha' as const, targetId: JOURNEY_DISPATCH, p, text: ['前往观测所出发台选择目的地，也可沿大陆道路自行前往。', 'Choose your destination at the Observatory dispatch post, or take the overland road.'] as [string, string] };
  }
  const p = guide && (here === 'sky' && typeof helionFight !== 'undefined' && helionFight.active
    ? skyCrown.targets[0].position.toArray() : markers.get(guide.targetId)?.p);
  return guide && p ? { ...guide, p } : null;
}
function journeyMarkerActive(id: string) {
  if (FIELD_SIDE_STEPS.has(id) || FIELD_SERVICE_LABELS.has(id)) return fieldSideReady(id, done);
  if (CULTURAL_STEPS.has(id)) return !(orleansShadowPlay?.playing && (id === SP.rope || id === SP.encore)) && culturalStepReady(id, done);
  if (EGYPT_GAUGE_BY_ID.has(id)) return egyptGaugeNext(done)?.id === id;
  if (id === F.nightPatrol && combat.storyEncounter?.id === VALLEY_NIGHT_ENCOUNTER) return false;
  const realm = realmStationByMarker.get(id);
  if (realm) return realm.station === 'start' ? !activeRealmClimax && journeyClimaxReady(realm.region, done)
    : activeRealmClimax?.id === realm.region && activeRealmClimax.stationReady(realm.station);
  if (id === JOURNEY_DISPATCH) return journeyDestinations(done).length > 0;
  if (id === SKY_UP_LIFT || id === SKY_DOWN_LIFT) return insideSkyCrown(player.pos) && done.has(JOURNEY.skyCourt) && !helionFight.active;
  if (id === SKY_MARKERS.cache) return insideSkyCrown(player.pos) && !helionFight.active;
  if (id === SKY_MARKERS.westAmmo || id === SKY_MARKERS.eastAmmo) return insideSkyCrown(player.pos) && done.has(JOURNEY.isolate);
  if (id === SKY_MARKERS.aid) return insideSkyCrown(player.pos) && !!availableSkySupport();
  if (id === SKY_MARKERS.start) return insideSkyCrown(player.pos) && done.has(JOURNEY.isolate) && (done.has(JOURNEY.skyCourt) || legacySkyApproach(done)) && skyPhase(done) >= 0 && !helionFight.active;
  if (id === SKY_MARKERS.left || id === SKY_MARKERS.right) return helionFight.active;
  if (id === JOURNEY.launch && done.has(JOURNEY.launch)) return !done.has(JOURNEY.returnHome);
  return journeyStepReady(id, done);
}
function interactionLabel(marker: Marker) {
  if (typeof kingdomWorkMarkers !== 'undefined' && kingdomWorkMarkers.has(marker.id)) return bilingual(...KINGDOM_WORK_LABELS[marker.id as KingdomWork]);
  if (typeof worldJourneyMarkerIds !== 'undefined' && worldJourneyMarkerIds.has(marker.id)) {
    const fieldSide = FIELD_SIDE_STEPS.get(marker.id)?.label ?? FIELD_SERVICE_LABELS.get(marker.id);
    if (fieldSide) return bilingual(...fieldSide);
    const cultural = CULTURAL_STEPS.get(marker.id);
    if (cultural) return bilingual(...cultural.label);
    const gaugeStep = EGYPT_GAUGE_BY_ID.get(marker.id);
    if (gaugeStep) return bilingual(gaugeStep.label[0], gaugeStep.label[1]);
    const field = VALLEY_FIELD_BY_ID.get(marker.id);
    if (field) return bilingual(...field.label);
    const realm = realmStationByMarker.get(marker.id);
    if (realm) {
      const line = realm.station === 'start' ? REALM_CLIMAXES[realm.region].start : activeRealmClimax?.stationText(realm.station);
      return line ? bilingual(...line) : marker.label;
    }
    if (marker.id === JOURNEY_DISPATCH) return bilingual(marker.label, 'Dispatch · Egypt, Orleans and Qin');
    if (marker.id === SKY_UP_LIFT || marker.id === SKY_DOWN_LIFT) return bilingual(marker.label, marker.id === SKY_UP_LIFT ? 'Service lift · Observation hall' : 'Service lift · Clear Sky Court');
    const step = journeyStepById.get(marker.id);
    if (step) return bilingual(marker.label, step.text[1]);
    if (marker.id === SKY_MARKERS.start) return bilingual(marker.label, 'Face Helion');
    if (marker.id === SKY_MARKERS.cache) return bilingual(marker.label, 'Resupply');
    if (marker.id === SKY_MARKERS.westAmmo || marker.id === SKY_MARKERS.eastAmmo) return bilingual(marker.label, 'Repair cache · Refill ammunition');
    if (marker.id === SKY_MARKERS.aid) {
      const aid = availableSkySupport();
      return aid ? bilingual(...SKY_SUPPORT[aid].title) : bilingual(marker.label, 'Support relay');
    }
    return bilingual(marker.label, marker.id === SKY_MARKERS.left ? 'Turn west shutter' : 'Turn east shutter');
  }
  if (typeof valleyPrologueScene !== 'undefined' && valleyPrologueScene?.ownsMarker(marker.id)) {
    return bilingual(...PROLOGUE_LABELS[marker.id as keyof typeof PROLOGUE_LABELS]);
  }
  const claim=modelClaimPoints.find(point=>point.marker.id===marker.id);
  if (claim) {
    if (!done.has(marker.id)) return bilingual(...claim.label);
    const name = servantName(claim.id);
    return bilingual(`邀请 ${name.zh} 同行`, `Travel with ${name.en}`);
  }
  const townAction=HOME_CIVIC_ACTIONS.find(a=>a.id===marker.id);if(townAction)return bilingual(...townAction.label);
  const homeAction=HOME_ACTIONS.find(a=>a.id===marker.id);if(homeAction)return bilingual(homeAction.label[0],homeAction.label[1]);
  const localWork=ORLEANS_WORK_ACTIONS.find(a=>a.id===marker.id);if(localWork)return bilingual(...localWork.label);
  const explorationLabel=typeof exploration!=='undefined'?exploration.label(marker.id):null;if(explorationLabel)return explorationLabel;
  const resident=RESIDENT_ACTIONS.find(a=>a.id===marker.id);if(resident)return bilingual(...resident.label);
  const surveyLabel=PARALLAX_LABELS.find(([id])=>id===marker.id);if(surveyLabel)return bilingual(...surveyLabel[1]);
  const action=adventureSites.actions.get(marker.id);if(action)return bilingual(...action.label);
  if(adventureActive(done)&&marker.id==='compact_relay_entry')return bilingual('服务庭院 · 恢复最低外联','Service yard · Restore the minimum uplink');
  if(adventureActive(done)&&marker.id==='compact_relay_controller')return bilingual('外联控制柜 · 按住接通','Uplink cabinet · Hold to connect');
  const arcLabel = getFalseDawnMarkerLabel(marker.id); if (arcLabel) return bilingual(...arcLabel);
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
function applyFalseDawnState() { falseDawnSites.applyState(getFalseDawnState(done)); }
function applyWorldState() {
  hudRevision++;
  if (typeof syncArsenal === 'function') syncArsenal(); // guarded: validation runs isolated slices of this file
  for(const marker of layout.markers)if(['seam_west','seam_east','seam_north','seam_south'].includes(marker.id))marker.requires=adventureActive(done)&&done.has(ADVENTURE.online)?[]:['tower_console'];
  applyEraMarkerRequirements(layout.markers, done);
  combat.syncWorldProgress(done);
  for (const entry of layout.objectives) if (isEraId(entry.region)) entry.objective = getEraObjective(entry.region, done, getLanguage() === 'zh' ? 0 : 1);
  for (const site of eraStoryScenes) { if (isEraId(site.region)) { const state = getEraStoryState(site.region, done); site.applyState({ ...state, complete: state.complete || (site.region === 'britain' && state.knightDefeated) }); } }
  applyValleyStory();
  if (typeof valleyPrologueScene !== 'undefined') valleyPrologueScene?.apply(valleyPrologueStage(done), done);
  if (typeof worldJourneySites !== 'undefined') { worldJourneySites?.apply(done); skyCrown.apply(done); }
  if (typeof valleyFieldScene !== 'undefined') valleyFieldScene?.apply(done);
  if (typeof fieldSideSites !== 'undefined' && typeof player !== 'undefined') fieldSideSites?.apply(done, 0, player.pos);
  if (typeof realmClimaxSites !== 'undefined') realmClimaxSites?.apply(done);
  if (typeof kingdomWorksScene !== 'undefined') kingdomWorksScene?.apply(done);
  applyCampaignState();
  applyFalseDawnState();
  compactRelaySites.applyState({active:compactRelayRuntime?.active??false,complete:done.has(COMPACT_RELAY.complete),progress:compactRelayRuntime?.progress??0});
  kingdomGateScene.apply(done,kingdomGateRuntime?.escort ?? 0);
  parallaxGarden.apply(done);
  orleansWorksScene.apply(done,orleansWorksRuntime?.active,orleansWorksRuntime?.progress);
  if(typeof qinArmyOrder!=='undefined')qinArmyOrder.apply(done);
  if(typeof qinSentinels!=='undefined')qinSentinels.apply(done);
  if(typeof egyptMirrors!=='undefined')egyptMirrors.apply(done);
  if(typeof homeTown!=='undefined')homeTown?.apply();
  adventureSites.apply(done,0,adventureRuntime?.cartPosition,adventureRuntime?.departureProgress,adventureRuntime?.reliefProgress);
  applyWeaponFinish();
  for (const t of targets) {
    if(t.userData.homeTarget)continue;
    if(t.userData.realmClimax || (typeof IB !== 'undefined' && t.userData.target === IB.pin)) continue;
    const id = t.userData.target as string;
    if (typeof KYOTO_WITNESS !== 'undefined' && (id === KYOTO_WITNESS.cut || id === KYOTO_WITNESS.pin)) continue;
    if (typeof KW !== 'undefined' && id === KW.pin) continue;
    if (typeof VALLEY_PROLOGUE !== 'undefined' && id === VALLEY_PROLOGUE.pin) continue;
    if (typeof JOURNEY !== 'undefined' && (id === JOURNEY.lakePin || id === JOURNEY.cargoPin || id === JOURNEY.egyptTie || id === JOURNEY.orleansBrace || id === JOURNEY.eastLatch || id === JOURNEY.skyScan || id === SKY_MARKERS.target)) continue;
    const hit = done.has(id) || (id === KINGDOM_GATE.latch && (done.has(KINGDOM_GATE.unlocked)||done.has(KINGDOM_GATE.open)));
    t.visible = !hit;
    const c = collider(`COL_${t.name}`); if (c) c.enabled = !hit;
  }
  // doors and gates: a dynamic piece with opensWhen disappears (art + collider) once all ids are done
  for (const g of gates) {
    const open = (adventureTravelOpen(done)&&g.name.startsWith('Seam_'))||g.opensWhen.every((x) => done.has(x));
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
  const quest=trackedQuest();
  if(quest){
    const enemy = quest.targetKind === 'enemy' ? combat.state.enemies.find(enemy=>enemy.id===quest.targetId && enemy.active && enemy.hp>0) : undefined;
    const local: [number,number,number] = quest.targetKind==='npc' ? settlementNpcs.getPosition(quest.targetId) ?? quest.position : enemy ? [enemy.p.x,enemy.p.y,enemy.p.z] : quest.position;
    const p=isExpansionRegion(quest.region)?local:resolveTrackedStoryPoint(here,quest.region,done,local);
    if(p)return {p,label:bilingual(...quest.targetLabel)};
  }
  if(isExpansionRegion(here)) {
    const journey = typeof journeyGuide === 'function' ? journeyGuide() : null;
    return journey ? { p: journey.p, label: bilingual(...journey.text) } : null;
  }
  if (compactRelayRuntime?.active) { const guide=getCompactRelayGuide(done,{active:true,progress:compactRelayRuntime.progress*3});const point=guide&&markers.get(guide.targetId)?.p;if(point)return{p:point,label:bilingual(...guide!.title)}; }
  if (falseDawnTracked) {
    const guide = getFalseDawnGuide(done, { activeEncounter: combat.storyEncounter?.id ?? null });
    if (!guide) falseDawnTracked = false;
    else {
      const label = bilingual(`伪晓回声 · ${settings.label('mainRoute')}返回原主线`, `False Dawn · ${settings.label('mainRoute')} for original story`);
      const local = guide.targetKind === 'npc' ? settlementNpcs.getPosition(guide.targetId) : markers.get(guide.targetId)?.p;
      const p = resolveTrackedStoryPoint(here, guide.region, done, local); if (p) return { p, label };
    }
  }
  if (campaignTrackedRegion) {
    const guide = getCampaignEpisodeGuide(campaignTrackedRegion, done, residentEventRuntime?.carrying);
    if (!guide) campaignTrackedRegion = null;
    else {
      const label = bilingual(`可选纪事：${CAMPAIGN_EPISODES[campaignTrackedRegion].speaker[0]} · ${settings.label('mainRoute')}返回主线`, `Chronicle: ${CAMPAIGN_EPISODES[campaignTrackedRegion].speaker[1]} · ${settings.label('mainRoute')} for story`);
      const local = guide.targetKind === 'npc' ? settlementNpcs.getPosition(guide.targetId) : markers.get(guide.targetId)?.p;
      const p = resolveTrackedStoryPoint(here, campaignTrackedRegion, done, local); if (p) return { p, label };
    }
  }
  if(adventureActive(done)&&optionalPin){if(optionalPinExpired(optionalPin,here,player.pos,done,found))optionalPin=null;else return{p:optionalPin.p,label:bilingual(`可选：${optionalPin.label[0]} · ${settings.label('mainRoute')}返回主线`,`Optional: ${optionalPin.label[1]} · ${settings.label('mainRoute')} for story`)};}
  const opening = typeof prologueGuide === 'function' ? prologueGuide() : null;
  if (opening) return { p: opening.p, label: bilingual(...opening.text) };
  const journey = typeof journeyGuide === 'function' ? journeyGuide() : null;
  if (journey) return { p: journey.p, label: bilingual(...journey.text) };
  const adventure=isCampaignRegion(here)?getCurrentAdventureGuide(here,done):null;if(adventure){const local=adventure.targetKind==='npc'?settlementNpcs.getPosition(adventure.targetId):markers.get(adventure.targetId)?.p;const p=local&&resolveTrackedStoryPoint(here,adventure.region,done,local);if(p)return{p,label:bilingual(...adventure.text)};}
  if(adventureActive(done))return null;
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

function renderObjective() { renderMainObjective(); updateTrackedStoryHud(); }
function renderMainObjective() {
  const region=regionAt(player.pos.x,player.pos.z).id;
  const journey = typeof journeyGuide === 'function' ? journeyGuide() : null;
  if (journey) {
    const title = document.createElement('h3'), text = document.createElement('div');
    title.textContent = bilingual(...journey.title); text.className = 'cur'; text.textContent = bilingual(...journey.text);
    $('objective').replaceChildren(title, text); return;
  }
  if (typeof JOURNEY !== 'undefined' && done.has(JOURNEY.epilogue)) {
    const title = document.createElement('h3'), text = document.createElement('div');
    title.textContent = bilingual('让明天继续 · 主线完成', 'Let Tomorrow Continue · Story complete');
    text.textContent = bilingual('回望桥和七域仍然开放，居民会继续自己的日子。', 'Lookback Bridge and the seven regions remain open. Their people carry on.');
    $('objective').replaceChildren(title, text); return;
  }
  if(isExpansionRegion(region)) {
    const plan=EXPANSION_PLANS.find(p=>p.id===region)!;
    const title=document.createElement('h3'),text=document.createElement('div'),note=document.createElement('div');
    title.textContent=region==='home'?bilingual('主角城镇 · 归处','Home Town · A place to return'):region==='orleans'?bilingual('奥尔良 · 河港与钟楼','Orleans · Quay and Belfry'):region==='qin'?bilingual('秦帝国 · 骊山上下','Qin Empire · Above and Below Mount Li'):region==='egypt'?bilingual('古埃及 · 日河与太阳神殿','Solar Egypt · Sun River and Sun Temple'):bilingual(`${plan.name} · 地图框架`,`${plan.nameEn} · Map blockout`);
    text.textContent=bilingual(plan.identity,'Explore the hub, landmarks and alternate routes.');
    const localDiscoveries=layout.markers.filter(m=>m.type==='discovery'&&m.id.startsWith(`${region}_`));
    const discovered=localDiscoveries.filter(m=>found.has(m.id)).length;
    const works=ORLEANS_WORK_ACTIONS.filter(a=>done.has(a.flag)).length;
    note.textContent=region==='home'?bilingual(`镇务 ${homeTown?.civicCount??0}/4 · 到广场公告栏接受或回报；日志可追踪设施与日常。${homeSaberReady(done)?' Saber 已入住。':' 公馆可邀请已缔约的 Saber。'}`,`Town jobs ${homeTown?.civicCount??0}/4 · Accept or report at the square; track activities in the journal.${homeSaberReady(done)?' Saber has moved in.':' Invite your contracted Saber at the guest book.'}`):region==='orleans'?bilingual(`已发现 ${discovered}/${localDiscoveries.length} 处地标 · 设施 ${works}/3 · 可向当地居民问路。`,`Landmarks ${discovered}/${localDiscoveries.length} · Works ${works}/3 · Ask the residents for directions.`):region==='egypt'?bilingual(`已发现 ${discovered}/${localDiscoveries.length} 处地标 · 太阳神殿中庭的铜镜可以引光。`,`Landmarks ${discovered}/${localDiscoveries.length} · The temple court's mirrors can lead the sunlight.`):region==='qin'?bilingual(`已发现 ${discovered}/${localDiscoveries.length} 处地标 · 可向驿丞和工匠问路；地宫军令台可转动兵俑阵列。`,`Landmarks ${discovered}/${localDiscoveries.length} · Command posts below turn the terracotta ranks.`):bilingual('当前可探索地形与路线；角色、主线、机关和 Boss 正在制作。','Terrain and routes are explorable; characters, story, mechanisms and bosses are in development.');
    $('objective').replaceChildren(title,text,note);return;
  }
  const adventure=(typeof prologueGuide === 'function' ? prologueGuide() : null) ?? getCurrentAdventureGuide(region,done);
  if(adventure){const title=document.createElement('h3'),text=document.createElement('div');title.textContent=bilingual(...adventure.title);text.className='cur';text.textContent=bilingual(...adventure.text);$('objective').replaceChildren(title,text);return;}
  if(adventureActive(done)&&done.has(ADVENTURE.ending)){const title=document.createElement('h3'),text=document.createElement('div');title.textContent=bilingual('让明天继续 · 已完成','Let Tomorrow Continue · Complete');text.textContent=bilingual('归路仍然开放。可以回访居民、探索支路或自愿挑战旧敌。','Every return road remains open. Revisit the residents, explore side routes or choose a rematch.');$('objective').replaceChildren(title,text);return;}
  const intro = valleyGuide();
  if (intro) {
    $('objective').replaceChildren();
    const title = document.createElement('h3'); title.textContent = bilingual(...intro.title);
    const goal = document.createElement('div'); goal.className = 'cur'; goal.textContent = `◇ ${bilingual(...intro.text)}`;
    $('objective').append(title, goal);
    return;
  }
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
  cold.frozen = inWinter && cold.warmth <= 0 && !adventureActive(done);
  if (cold.frozen && !cold.warned) toast(bilingual('冻僵了：走不快也跑不动，快去火堆边取暖', 'Frozen stiff: you can barely move. Find a fire to warm up'));
  cold.warned = cold.frozen || (cold.warned && cold.warmth < 30);
  coldHud.hidden = !inWinter;
  if (inWinter) {
    coldHud.querySelector('span')!.textContent = `${bilingual('体温', 'Warmth')} ${Math.ceil(cold.warmth)}%${nearFire ? bilingual(' · 正在取暖', ' · warming up') : cold.reserve > 0 ? bilingual(` · 余温 ${Math.ceil(cold.reserve)}秒`, ` · Stored warmth ${Math.ceil(cold.reserve)}s`) : ''}`;
    (coldHud.querySelector('.combat-fill') as HTMLElement).style.width = `${cold.warmth}%`;
  }
  frost.style.opacity = inWinter ? `${Math.max(0, 1 - cold.warmth / 40) * (adventureActive(done)?.25:.85)}` : '0';
}

// ───────────── player / input ─────────────
const player = new Player(colliders, layout.world.waterLevel);
if (typeof applyExplorationGlide === 'function') applyExplorationGlide(); // guarded: validation runs isolated slices of this file
player.updrafts = layout.updrafts ?? [];
const initialSpawn = markers.get(INITIAL_SPAWN_ID)!;
// URL starts are intentional debug entry points only. Reset always returns to the authored Alpha
// camp, and subsequent defeat respawns in this session must not jump back to the old debug chapter.
let spawn = markers.get(startRegion === 'alpha' ? INITIAL_SPAWN_ID : `${startRegion}_spawn_p1`) ?? initialSpawn;
if (typeof valleyPrologueScene !== 'undefined' && valleyPrologueScene && !params.has('region') && !params.has('spawn')) {
  const stage = valleyPrologueStage(done);
  if (stage === 'room') spawn = valleyPrologueScene.spawn;
  else if (stage === 'briefing' || stage === 'cart' || stage === 'workshop' || stage === 'armory') spawn = valleyPrologueScene.courtyardSpawn;
  else if (stage !== 'legacy' && stage !== 'complete') spawn = valleyPrologueScene.radioSpawn;
}
if (typeof JOURNEY !== 'undefined' && !params.has('region') && !params.has('spawn')) {
  if (done.has(JOURNEY.launch) && !done.has(JOURNEY.returnHome)) spawn = skyJourneySpawn();
  else if (done.has(JOURNEY.returnHome) && !done.has(JOURNEY.epilogue)) spawn = journeyHomeSpawn();
}
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
if (worldExited || !(await graphicsRecovery.whenContextAvailable())) { rig.dispose(); return; }
// Hide the parent before asynchronous weapon art attaches: neither loading nor a late model can
// grant ownership or flash an unearned gun on a clean start.
rig.joints.Gun.visible = worldProgress.armed;
scene.add(rig.root);
// `var` so the hoisted guard is readable from applyWorldState calls that run before the arsenal exists.
// eslint-disable-next-line no-var
var arsenalReady = false;
// The equipped Arena gun (worldArsenal.ts): remembered locally, validated against what the save owns.
let equippedGunId: WorldGunId = (() => { try { return equippedGun(localStorage.getItem(GUN_STORE_KEY), done); } catch { return DEFAULT_GUN; } })();
let rifle = attachExplorerRifle(rig, renderer, undefined, equippedGunId);
try { await rifle.ready; } catch (error) { rifle.dispose(); rig.dispose(); throw error; }
if (worldExited || !(await graphicsRecovery.whenContextAvailable())) { rifle.dispose(); rig.dispose(); return; }
addEventListener('pagehide', (e) => { if (!e.persisted) { blade.dispose(); rifle.dispose(); rig.dispose(); } });
let equippedMeleeId: WorldMeleeId = (() => { try { return equippedMelee(localStorage.getItem(MELEE_STORE_KEY), done); } catch { return DEFAULT_MELEE; } })();
let blade = attachExplorerBlade(rig, undefined, equippedMeleeId);
let meleeSwap: ReturnType<typeof attachExplorerBlade> | null = null;
let ownedMelee = new Set(unlockedMelee(done).map(x => x.id));
/** Equip a melee weapon: combo scaling at once; the model swaps when its art has loaded. */
function equipMelee(id: WorldMeleeId, announce = true) {
  const weapon = worldMelee(id); if (!weapon || !meleeUnlocked(weapon, done)) return false;
  if (id !== equippedMeleeId || meleeSwap) {
    equippedMeleeId = id; if (typeof actions !== 'undefined' && actions) actions.melee.style = weapon;
    try { localStorage.setItem(MELEE_STORE_KEY, id); } catch { /* applies this session */ }
    meleeSwap?.dispose();
    const next = attachExplorerBlade(rig, undefined, id); meleeSwap = next;
    next.ready.then(() => { if (meleeSwap !== next) { next.dispose(); return; } const old = blade; blade = next; meleeSwap = null; old.dispose(); applyWeaponFinish(); })
      .catch(error => { if (meleeSwap === next) meleeSwap = null; next.dispose(); console.warn('Melee art unavailable; previous weapon kept.', error); });
  }
  if (announce) toast(bilingual(`${weapon.name[0]} · ${weapon.role[0]}`, `${weapon.name[1]} · ${weapon.role[1]}`));
  hudRevision++; return true;
}
function switchMelee() {
  if (!worldProgress.armed) return;
  const next = cycleMelee(equippedMeleeId, done);
  if (next === equippedMeleeId) { toast(bilingual('目前只有折光长刃：讨伐京都与王国的精英可以解锁流星长柄和断层战锤。', 'Only the Refract Blade so far: defeat the Kyoto and Kingdom elites for the Meteor Polearm and Faultline Hammer.')); return; }
  equipMelee(next);
}
function applyWeaponFinish() {
  const finish = weaponFinishStore.active(done);
  rifle.setFinish(finish); blade.setFinish(finish); weaponFinishControl?.refresh();
}
applyWeaponFinish();
void blade.ready.catch(error => console.warn('Melee art unavailable', error));
// (the combat state takes the equipped gun once it exists; see after WorldCombat below)
let gunSwap: ReturnType<typeof attachExplorerRifle> | null = null, gunSwapAt = -1e9;
let ownedGuns = new Set(unlockedGuns(done).map(gun => gun.id));
arsenalReady = true;
/** Equip a gun: handling changes at once; the model swaps when its art has loaded (the old one stays until then). */
function equipGun(id: WorldGunId, announce = true) {
  const gun = worldGun(id); if (!gun || !gunUnlocked(gun, done)) return false;
  if (id !== equippedGunId || gunSwap) {
    equippedGunId = id; combat.state.setGun(gun);
    try { localStorage.setItem(GUN_STORE_KEY, id); } catch { /* the choice still applies this session */ }
    gunSwap?.dispose();
    const next = attachExplorerRifle(rig, renderer, undefined, id); gunSwap = next;
    next.ready.then(() => { if (gunSwap !== next) { next.dispose(); return; } const old = rifle; rifle = next; gunSwap = null; old.dispose(); applyWeaponFinish(); if (announce) anim.drawWeapon(); })
      .catch(error => { if (gunSwap === next) gunSwap = null; next.dispose(); console.warn('Gun art unavailable; previous model kept.', error); });
  }
  if (announce) { const n = unlockedGuns(done).length, next = nextGunUnlock(done); toast(bilingual(`${gun.name[0]} · ${gun.role[0]} · 已解锁 ${n}/${WORLD_GUNS.length}${next ? `\n下一把 ${next.gun.name[0]}：${next.how[0]}` : ''}`, `${gun.name[1]} · ${gun.role[1]} · owned ${n}/${WORLD_GUNS.length}${next ? `\nNext, ${next.gun.name[1]}: ${next.how[1]}` : ''}`)); }
  hudRevision++; return true;
}
function cycleEquippedGun(dir: 1 | -1) {
  const now = performance.now(); if (now - gunSwapAt < 220) return; gunSwapAt = now;
  if (!worldProgress.armed) return;
  const next = cycleGun(equippedGunId, dir, done);
  if (next === equippedGunId) { const hint = nextGunUnlock(done); toast(hint ? bilingual(`目前只有一把枪 · 下一把 ${hint.gun.name[0]}：${hint.how[0]}`, `Only one gun so far · Next, ${hint.gun.name[1]}: ${hint.how[1]}`) : bilingual('目前只有一把枪。', 'Only one gun so far.')); return; }
  equipGun(next);
}
/** New unlocks get a banner; a save that no longer owns the equipped gun drops back to the AR. */
function syncArsenal() {
  if (!arsenalReady) return;
  const owned = new Set(unlockedGuns(done).map(gun => gun.id));
  for (const gun of WORLD_GUNS) if (owned.has(gun.id) && !ownedGuns.has(gun.id) && gun.unlock)
    toast(bilingual(`解锁新武器：${gun.name[0]} · ${gun.role[0]} · 滚轮切换`, `New weapon: ${gun.name[1]} · ${gun.role[1]} · scroll to switch`));
  ownedGuns = owned;
  if (!owned.has(equippedGunId)) equipGun(DEFAULT_GUN, false);
  const melee = new Set(unlockedMelee(done).map(x => x.id));
  for (const weapon of WORLD_MELEE) if (melee.has(weapon.id) && !ownedMelee.has(weapon.id) && weapon.unlock)
    toast(bilingual(`解锁近战武器：${weapon.name[0]} · ${weapon.role[0]} · ${settings.label('switchMelee')} 切换`, `New melee weapon: ${weapon.name[1]} · ${weapon.role[1]} · ${settings.label('switchMelee')} to switch`));
  ownedMelee = melee;
  if (!melee.has(equippedMeleeId)) equipMelee(DEFAULT_MELEE, false);
}
const anim = new SkinnedCharacterAnimator(rig, new PlayerTerrainSupport(rig, colliders));
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
const eraActors: Array<{ markerId: string; servant: ServantId; kit: keyof typeof CHARACTER_KITS; follow: KitCompanion; actor?: CharacterKit; loading?: Promise<void>; error?: unknown; retryAt: number; failures: number; controller?: AbortController; lastNeeded?: number }> = [
  { markerId: 'blackbeard_meet', servant: 'blackbeard', kit: 'blackbeard', follow: companion(12, 12, 'ranged'), retryAt: 0, failures: 0 },
  { markerId: 'napoleon_meet', servant: 'napoleon', kit: 'napoleonMounted', follow: companion(4.5, 16), retryAt: 0, failures: 0 },
  { markerId: 'musashi_meet', servant: 'musashi', kit: 'musashi', follow: companion(3.5, 9), retryAt: 0, failures: 0 },
];
const napoleonMeetingPoints=new Map(['napoleon_meet','napoleon_contract'].map(id=>[id,[...markers.get(id)!.p] as [number,number,number]]));
let eraActorsDisposed = false;
let inspectServant = false;
function companionKit(id: CompanionId | null) {
  if (id && isModelCompanionId(id)) return modelCompanion.selected === id ? modelCompanion.actor : undefined;
  return eraActors.find(entry => entry.servant === id)?.actor;
}
function companionRoot(id: CompanionId | null) {
  if (id === 'saber') return servant.root;
  return companionKit(id)?.root;
}
const servantRoot = () => companionRoot(contract.following);
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
  const roots = [servant.root, ...eraActors.map((e) => e.actor?.root), modelCompanion.actor?.root];
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
const servantName = (id: CompanionId | null) => { const s = COMPANIONS.find(x => x.id === id) ?? SERVANTS[0]; return { zh: s.name, en: s.nameEn }; };
function updateEraActors(dt: number) {
  if (eraActorsDisposed) return;
  const now = performance.now();
  for (const entry of eraActors) {
    if(entry.servant==='napoleon'){
      const searching=residentEventRuntime?.horseSearch&&!contract.isFollowing('napoleon')&&!cavalrySupport?.needed;
      for(const[id,original]of napoleonMeetingPoints){const marker=markers.get(id)!,spot=residentEventScene.horseSpot,p=searching?[spot[0],spot[1]-.9,spot[2]]:original;
        if(marker.p.some((v,i)=>Math.abs(v-p[i])>.001)){marker.p=[...p] as [number,number,number];hudRevision++;}}
    }
    const marker = markers.get(entry.markerId);
    if (!marker) continue;
    const nearMarker = player.pos.distanceTo(new THREE.Vector3(...marker.p)) < 110;
    const following = contract.isFollowing(entry.servant) && companionEnabled();
    const nearby = following || (nearMarker && !contract.has(entry.servant)) ||
      (entry.servant === 'napoleon' && (!!cavalrySupport?.needed || !!residentEventRuntime?.horseSearch && nearMarker));
    const selected=contract.selected===entry.servant;
    if(nearby||selected)entry.lastNeeded=now;
    const pinned=selected||(entry.servant==='napoleon'&&!!cavalrySupport?.needed);
    if(!nearby&&!pinned&&now-(entry.lastNeeded??now)>15_000){
      entry.controller?.abort();
      if(entry.actor){entry.follow.release(entry.actor);entry.actor.dispose();entry.actor=undefined;}
    }
    if ((nearby||selected) && !entry.actor && !entry.loading && now >= entry.retryAt) {
      const controller=new AbortController();entry.controller=controller;
      entry.loading = loadCharacterKit(CHARACTER_KITS[entry.kit], { signal: controller.signal, environment: servantEnvironment(), onEvent: (event) => { if (entry.actor) entry.follow.onEvent(entry.actor, event); } })
        .then((actor) => {
          if (eraActorsDisposed || controller.signal.aborted) { actor.dispose(); return; }
          entry.failures = 0; entry.error = undefined;
          entry.actor = actor;
          actor.root.position.fromArray(marker.p);
          actor.root.rotation.y = Math.PI;
          actor.root.visible = false;
          scene.add(actor.root);
        })
        .catch((error) => {
          if(controller.signal.aborted)return;
          entry.error = error;
          entry.failures++;
          entry.retryAt = performance.now() + Math.min(30_000, 1_000 * 2 ** Math.min(5, entry.failures - 1));
          console.warn(`Could not load ${entry.kit} servant; retrying with backoff`, error);
        })
        .finally(() => { entry.loading = undefined; entry.controller=undefined; });
    }
    if (!entry.actor) continue;
    entry.actor.root.visible = nearby;
    if(entry.servant==='napoleon'&&following&&cavalrySupport?.ownsActor&&!cavalrySupport.busy)cavalrySupport.yieldToCompanion();
    if(entry.servant==='napoleon'&&cavalrySupport?.present(entry.actor,dt,gameplayActive()))continue;
    if (following) { entry.follow.update(entry.actor, dt, player.pos, anim.facing - Math.PI, !gameplayActive()); continue; }
    entry.follow.release(entry.actor);
    // Not following: wait at the meeting spot (also after the contract, until chosen).
    if(entry.servant==='napoleon'&&residentEventRuntime?.horseSearch&&!following&&!cavalrySupport?.needed){const spot=residentEventScene.horseSpot;entry.actor.root.position.set(spot[0],spot[1]-.9,spot[2]);entry.actor.root.rotation.y=.6;}else{entry.actor.root.position.fromArray(marker.p);entry.actor.root.rotation.y=Math.PI;}
    entry.actor.update(dt, !nearby || !gameplayActive());
  }
}
const modelCompanion = new ModelCompanion({ scene, colliders, environment: servantEnvironment, onRejoin: noteCompanionRejoin,
  reservedRoots: () => [servant.root, ...eraActors.flatMap(entry => entry.actor ? [entry.actor.root] : [])],
  combat: {
    range: 3.5, damage: 14,
    target: (position, range, targetId) => { const hit = combat.allyTarget(position, range, targetId, 'melee'); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x, hit.p.y, hit.p.z) } : null; },
    track: (position, range, targetId) => { const hit = combat.allyTrack(position, range, targetId, 'melee'); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x, hit.p.y, hit.p.z) } : null; },
    strike: (position, range, damage, targetId) => { const hit = combat.allyStrike(position, range, damage, targetId, 'melee'); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x, hit.p.y, hit.p.z) } : null; },
    engage: (_player, from) => { const hit = combat.allyEngage(15, from); return hit ? { id: hit.id, position: new THREE.Vector3(hit.p.x, hit.p.y, hit.p.z) } : null; },
  },
});
const servantPanel = createServantPanel(servant, contract, () => { abortUltimate(); clearInput(); if (document.pointerLockElement) document.exitPointerLock(); }, modelCompanion);
function syncCompanionSelection() {
  const active = contract.following, selected = contract.selected;
  if (active !== 'saber' && (contract.recruited || active)) servant.root.visible = false;
  for (const entry of eraActors) {
    if (!entry.actor || active === entry.servant || entry.servant === 'napoleon' && cavalrySupport?.ownsActor) continue;
    entry.actor.root.visible = false;
    entry.follow.release(entry.actor);
  }
  const model = selected && isModelCompanionId(selected) ? selected : null;
  if (!active) modelCompanion.update(0, player.pos, player.yaw, false, true);
  if (model !== modelCompanion.selected) {
    void modelCompanion.select(active ? model : null).then(() => { hudRevision++; servantPanel.render(); });
  }
  companionRegroupUntil = 0;
  hudRevision++;
  servantPanel.render();
}
const unsubscribeCompanion = contract.subscribe(syncCompanionSelection);
syncCompanionSelection();
const contractCard = document.createElement('div');
contractCard.id = 'contract-card'; contractCard.className = 'hud';
Object.assign(contractCard.style, { right: '18px', top: '222px', width: '230px', padding: '12px', borderRadius: '12px',
  background: 'rgba(20,30,52,.85)', color: '#f8eaca', fontSize: '12px', lineHeight: '1.6' });
document.body.append(contractCard);
function renderContract() {
  servantPanel.render();
  const state = companionStatus(servant, contract, modelCompanion);
  const multi = contract.roster.length > 1 ? bilingual(`\n[${settings.label('switchServant')}] 切换从者（${contract.roster.length} 位已缔约）`, `\n[${settings.label('switchServant')}] Switch servant (${contract.roster.length} contracted)`) : '';
  const hint = contract.anyRecruited ? bilingual(`[${settings.label('summon')}] 召唤／收回 · 协助攻击`, `[${settings.label('summon')}] Summon / recall · Assists in combat`) + multi
    : bilingual('前往圣剑湖，与第一位契约从者会面', 'Visit Sword Lake to meet your first contracted servant');
  const regroup = contract.companionSummoned && performance.now() < companionRegroupUntil ? bilingual('\n已安全归队', '\nSafely regrouped') : '';
  const next = `${state}${regroup}`;
  contractCard.title=hint;
  if (contractCard.textContent !== next) contractCard.textContent = next;
  contractCard.style.whiteSpace = 'pre-line';
}
addEventListener('pagehide', (event) => { if (!event.persisted) {
  eraActorsDisposed = true;
  unsubscribeCompanion(); servantPanel.dispose(); servant.dispose(); modelCompanion.dispose();
  for (const entry of eraActors) {entry.controller?.abort();entry.actor?.dispose();}
} });
function resetProgress() {
  abortUltimate(); clearInput(); deferredCombatToast = null;
  const saved = worldProgress.reset();
  if(typeof homeTown!=='undefined')homeTown?.activities.reset();
  campaignTrackedRegion = null; falseDawnTracked = false; questTrackedId = null; falseDawnRuntime?.invalidate(); compactRelayRuntime?.invalidate(); kingdomGateRuntime?.reset(); adventureRuntime?.reset(); cavalrySupport?.reset(); residentEventRuntime?.reset();
  if (typeof helionFight !== 'undefined') helionFight.reset();
  shadowPlayCue = null; orleansShadowPlay?.reset();
  if (typeof stopRealmClimax === 'function') stopRealmClimax();
  // Reset is a new game, not another debug start on the next reload. Keep all unrelated options
  // and the hash; replaceState changes no page and adds no browser-history entry.
  clearStartOverrides(params);
  const url = new URL(location.href); clearStartOverrides(url.searchParams);
  try { history.replaceState(history.state, '', url.href); } catch { /* Restricted embedding may prohibit URL writes. */ }
  companionRegroupUntil = 0; actions?.reset(); fortCannon.reset(); contract.reset(); combat.reset();
  spawn = (typeof valleyPrologueScene !== 'undefined' && valleyPrologueScene?.spawn) || initialSpawn;
  player.restartAt(spawn.p[0], spawn.p[1] + 1, spawn.p[2], 0);
  prevPos.copy(player.pos); rig.root.position.copy(player.pos);
  anim.reset(worldProgress.armed, player.yaw + Math.PI);
  inspectServant = false; thirdPerson = true; rig.root.visible = true;
  servant.update(0, player.pos, anim.facing - Math.PI, false, true);
  for (const entry of eraActors) {
    entry.follow.release(entry.actor);
    if (entry.actor) {
      const marker = markers.get(entry.markerId)!;
      entry.actor.root.position.fromArray(marker.p); entry.actor.root.rotation.y=Math.PI;
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
  toast(saved ? bilingual('进度已重置 · 已空手回到起点', 'Progress reset · Returned unarmed to the starting point')
    : bilingual('已空手回到起点；浏览器无法保存重置，刷新可能恢复旧进度', 'Returned unarmed to the starting point; reset could not be saved, so reloading may restore old progress'));
}
const keys = new Set<string>();
const aim = new ShoulderAim();
const settings = new SettingsStore('world');
// Input capture may use native pointer lock or the explicit accessible drag mode.
let locked = false, dragLook = false;
const start = $('start');
const dragEntry=document.createElement('button');dragEntry.id='world-drag-controls';dragEntry.hidden=true;
const renderDragEntry=()=>{dragEntry.textContent=bilingual('使用拖拽视角进入 · 无需锁定鼠标','Enter with drag camera · No pointer lock');};renderDragEntry();onLanguageChange(renderDragEntry);start.append(dragEntry);
dragEntry.onclick=event=>{event.stopPropagation();if(bootFailed||worldExited||graphicsRecovery?.blocked)return;audio.unlock(event);dragLook=true;locked=true;clearInput();invalidateFrameClock();start.classList.add('hidden');$('settings-open').classList.add('hidden');languageToggle.hidden=true;toast(bilingual('右键拖拽转动视角','Right-drag to look'));};

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
const clearInput = () => { if(typeof homeTown!=='undefined')homeTown?.activities.interrupt(); orleansWorksRuntime?.interrupt();residentEventRuntime?.cancelCarry(); cavalrySupport?.cancel(); adventureRuntime?.interrupt(); kingdomGateRuntime?.interrupt(); compactRelayRuntime?.interrupt(); keys.clear(); aim.clear(); narrative?.hide(); if (!ultimateDirector?.active) actions?.cancel(); fortCannon.cancel(); hudRevision++; };
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
    try { const preference=localStorage.getItem(`parhelion.world.hide.${id}`);if(preference==='1'||((id==='help'||id==='contract-card')&&preference!=='0'))$(id).style.display='none'; } catch { if(id==='help'||id==='contract-card')$(id).style.display='none'; }
    const label = document.createElement('label'); label.className = 'settings-check';
    const box = document.createElement('input'); box.type = 'checkbox'; box.dataset.hudPanel = id; box.checked = $(id).style.display !== 'none';
    box.addEventListener('change', () => togglePanel(id, !box.checked));
    label.append(box, ` ${text}`); group.append(label);
  }
  document.querySelector('#world-settings .settings-sliders')?.after(group);
  localizeDom(group);
}
const gameplayActive = () => regionVisuals.ready(regionAt(player.pos.x,player.pos.z).id) && !bootFailed && !worldExited && !graphicsRecovery?.blocked && !ultimateDirector?.active && locked && !inspectServant && !travelOpenState && !campaignJournalOpen && !narrative?.open && !settingsPanel.open && document.visibilityState === 'visible' && document.hasFocus() && !$('bigmap').classList.contains('open');
const down = (action: string) => settings.isDown(keys, action);
function renderControlHints() {
  const k = (action: string) => settings.label(action);
  const moves = `${k('forward')}/${k('left')}/${k('back')}/${k('right')}`;
  $('help').textContent = bilingual(
    `${moves} 移动 · ${k('sprint')} 奔跑 · ${k('jump')} 跳／空中滑翔\n${k('fire')} 射击 · ${k('aim')} 按住肩射瞄准 · ${k('interact')} 互动\n${k('melee')} 近战 · ${k('evade')} 闪避 · ${k('skill')} 战技 · ${k('ultimate')} 终结技 · ${k('travel')} 据点旅行\n${k('summon')} 召唤／收回从者 · ${k('switchServant')} 切换从者 · ${k('inspectServant')} 查看从者模型 · ${k('map')} 大地图 · ${k('guide')} 任务指引 · ${k('objectives')} 任务栏 · ${k('help')} 帮助 · ${k('settings')} 设置 · Esc 释放鼠标\n召唤时战技／终结技由从者施放，收回后由你施放；你的终结技按朝向释放，可能落空。`,
    `${moves} Move · ${k('sprint')} Sprint · ${k('jump')} Jump / glide in air\n${k('fire')} Fire · ${k('aim')} Hold shoulder aim · ${k('interact')} Interact\n${k('melee')} Melee · ${k('evade')} Evade · ${k('skill')} Skill · ${k('ultimate')} Ultimate · ${k('travel')} Safe travel\n${k('summon')} Summon / recall Servant · ${k('switchServant')} Switch servant · ${k('inspectServant')} View servant model · ${k('map')} World map · ${k('guide')} Quest guide · ${k('objectives')} Quest panel · ${k('help')} Help · ${k('settings')} Settings · Esc Release mouse\nSummoned: skills/ultimates come from your companion; recalled: from you. Your ultimate follows your facing and can miss.`);

}
settings.subscribe(() => { clearInput(); renderControlHints(); }); renderControlHints();
const lockError = () => {
  if (bootFailed || worldExited || graphicsRecovery?.blocked || locked) return;
  clearInput();dragEntry.hidden=false;
  setLoading('无法锁定鼠标，请再次点击进入（或检查浏览器权限）');
  start.classList.remove('hidden');
};
setLoading('点击进入（ESC 释放鼠标）');
start.addEventListener('click', async (e) => {
  if (bootFailed || worldExited || graphicsRecovery?.state === 'lost' || graphicsRecovery?.state === 'disposed') return;
  audio.unlock(e);
  if (settingsPanel.open || servantPanel.open || travelOpenState || campaignJournalOpen || narrative?.open || ultimateDirector?.active) return;
  if (graphicsRecovery?.resume()) dispatchEvent(new Event('resize'));
  try { await canvas.requestPointerLock(); } catch { lockError(); }
});
document.addEventListener('pointerlockerror', lockError);
document.addEventListener('pointerlockchange', () => {
  invalidateFrameClock();
  if (bootFailed || worldExited || graphicsRecovery?.blocked) {
    locked = false; clearInput();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    return;
  }
  locked = dragLook || document.pointerLockElement === canvas;
  clearInput();
  if (!locked) { inspectServant = false; $('bigmap').classList.remove('open'); }
  else setLoading('点击进入（ESC 释放鼠标）');
  start.classList.toggle('hidden', locked);
  $('settings-open').classList.toggle('hidden', locked);
  languageToggle.hidden = locked;
});
document.addEventListener('mousemove', (e) => {
  if (!gameplayActive() || (dragLook&&!(e.buttons&2))) return;
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
  if (bootFailed || worldExited || graphicsRecovery?.blocked) return;
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
  if (['fire','melee','skill','evade','ultimate','jump'].includes(action)) {orleansWorksRuntime?.interrupt(); compactRelayRuntime?.interrupt(); kingdomGateRuntime?.interrupt(); adventureRuntime?.interrupt(); }
  if (actions?.press(action)) { hudRevision++; return; }
  keys.add(binding);
  if (action === 'aim') aim.held = true;
  if (action === 'fire') shoot();
  if (action === 'nextWeapon' || action === 'prevWeapon') cycleEquippedGun(action === 'nextWeapon' ? 1 : -1);
  if (action === 'switchMelee' && !repeat) switchMelee();
  if (action === 'fly') { clearInput(); player.flying = !player.flying; toast(player.flying ? '自由飞行调试 开 · 抬头前进上升，低头前进下降' : '自由飞行调试 关 · 恢复跳跃／滑翔'); }
  if (action === 'collision') { debugCol.visible = !debugCol.visible; toast(debugCol.visible ? '显示碰撞体' : '隐藏碰撞体'); }
  if (action === 'guide') toggleGuide();
  if (action === 'ping' && !repeat) coopPing();
  if (action === 'mainRoute') { questTrackedId = null; optionalPin = null; campaignTrackedRegion = null; falseDawnTracked = false; guideOn = true; hudRevision++; toast(bilingual('已返回主线指引。', 'Main-story guidance restored.')); }
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
  if(dragLook&&e.code==='Escape'){dragLook=false;locked=false;clearInput();start.classList.remove('hidden');$('settings-open').classList.remove('hidden');languageToggle.hidden=false;return;}
  if(dragLook&&/^Arrow(Left|Right|Up|Down)$/.test(e.code)&&!narrative?.open&&!settingsPanel.open){e.preventDefault();keys.add(e.code);return;}
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
addEventListener('blur', () => { invalidateFrameClock(); clearInput(); });
addEventListener('focus', invalidateFrameClock);
document.addEventListener('visibilitychange', () => { invalidateFrameClock(); clearInput(); });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('auxclick', (e) => { if (locked || settingsPanel.open) e.preventDefault(); });
addEventListener('mousedown', (e) => { audio.unlock(e); if (!settingsPanel.open && locked) { e.preventDefault(); press(`Mouse${e.button}`); } });
addEventListener('mouseup', (e) => release(`Mouse${e.button}`));
addEventListener('wheel', (e) => {
  const binding = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
  if (!gameplayActive() && !(narrative?.open && settings.action(binding) === 'interact')) return;
  e.preventDefault(); press(binding); release(binding);
}, { passive: false });

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let reducedOverride: boolean | null = null;
try { const stored=localStorage.getItem('parhelion-world-reduced-effects'); if(stored==='1'||stored==='0')reducedOverride=stored==='1'; } catch { /* use system preference */ }
const reducedEffects = () => reducedOverride ?? reducedMotion.matches;

// ───────────── shooting (hitscan + visible bounded projectiles) ─────────────
const combat = new WorldCombat({ scene, colliders, layout, done, toast: combatToast, reducedEffects, groundHeight: (x, z) => grid.sampleHeight(x, z),
  onVictory(core) { done.add(core); save(); applyWorldState(); },
  onDamage(hit) { actions?.recordDamage(hit); audio.contact(); },
  onHurt() { relayDamageRevision++; audio.hurt(); },
  onPartnerHurt(damage) { if (typeof coop !== 'undefined') coop.partnerHurt(damage); },
  onPerfectEvade() { perfectEvadeSlow = PERFECT_EVADE.slow; if (actions) actions.evade.cooldown = 0; audio.perfectEvade(); },
  onKill(id) { audio.kill(); if (typeof exploration !== 'undefined') { exploration.eliteDefeated(id); exploration.enemyDefeated(id); } if (id === 'elite_oath_knight') { if (optionalPin?.kind === 'trial') { optionalPin = null; hudRevision++; } save(); applyWorldState(); } },
  onStoryEncounterVictory(id) {
    if (id === KINGDOM_WATCH_ENCOUNTER) { advanceKingdomWorks(KW.secure); return; }
    if (id === VALLEY_RESCUE_ENCOUNTER) {
      done.add(VALLEY_PROLOGUE.machinesCleared); saveJourneyProgress();
      toast(bilingual('两台巡检机已停下。绕到急停旁继续撤离。', 'Both inspection units are down. Reach the cutoff and continue the evacuation.')); return;
    }
    if (id === VALLEY_NIGHT_ENCOUNTER) {
      done.add(F.patrolCleared); saveJourneyProgress();
      toast(bilingual('接点已压制。拆下远程接收器，或把真实计数接到救援口。', 'Junction secure. Remove the remote receiver or feed the true headcount to the rescue port.')); return;
    }
    if(typeof exploration!=='undefined'&&exploration.victory(id))return; if(adventureRuntime?.victory(id))return; if (id === KINGDOM_GATE.encounter) { toast(bilingual('守卫已清除；仍需操作绞盘并护送居民。','Guards cleared; work the winch and escort the residents.')); return; } if (!compactRelayRuntime?.victory(id)) falseDawnRuntime?.victory(id);
  },
  onPlayerDefeated() { exploration.reset(); kingdomGateRuntime?.reset(); adventureRuntime?.reset(); cavalrySupport?.reset(); residentEventRuntime?.reset(); compactRelayRuntime?.invalidate(); spawnAt(); clearInput();
    if (typeof activeRealmClimax !== 'undefined' && activeRealmClimax && realmClimaxSites) {
      const site = realmClimaxSites.sites[activeRealmClimax.id];
      stopRealmClimax(); player.teleport(site.start[0], site.start[1] + .3, site.start[2]); combat.refillAmmo();
      toast(bilingual('回到接应点 · 已完成的战斗阶段保留', 'Returned to the rally point · Completed phases are saved')); return;
    }
    if (typeof helionFight !== 'undefined' && helionFight.active) { helionFight.reset(); combat.refillAmmo(); return; }
    // Co-op: get back up beside a partner who is still standing (not mid boss/story fight).
    if (typeof coop !== 'undefined' && coop.session.paired && (coop.avatar.track.latest?.hp ?? 0) > 0 && travelToPartner() === null) return;
    toast(bilingual('已回到安全地点 · 任务进度保留', 'Returned to safety · Quest progress kept')); },
});
combat.state.setGun(worldGun(equippedGunId)!);
addEventListener('pagehide', (event) => { if (!event.persisted) combat.dispose(); });
const actionClockActive = () => gameplayActive() || (!!ultimateDirector?.releasing && document.visibilityState === 'visible' && document.hasFocus() && !settingsPanel.open && !servantPanel.open);
actions = new WorldActions({ scene,
  context: () => ({ clockRunning: actionClockActive() && !combat.defeated, enabled: actionClockActive() && !fortCannon.mounted && !inspectServant && !combat.defeated && !residentEventRuntime?.carrying && !player.flying && !player.swimming && !player.gliding,
    grounded: player.onGround, armed: worldProgress.armed&&!residentEventRuntime?.carrying, bladeReady: blade.loaded, bladeFailed: blade.root.userData.artState === 'error', position: player.pos, yaw: player.yaw,
    moveX: Number(down('right')) - Number(down('left')), moveZ: Number(down('forward')) - Number(down('back')),
    identity: contract.following }),
  strike: (strike, source) => {const result=combat.applyStrike(strike,source);if(source==='melee'&&result.hits.length)kickCamera(meleeKick());if(!reducedEffects())hitStop=Math.max(hitStop,hitStopSeconds(source,result.hits,result.kills.length));if(source==='skill'&&actions?.skills.selected==='saber')for(const hit of result.hits)combat.state.interruptEnemy(hit.id,.8);return result;},
  defense: value => combat.setDefense(value), toast, reducedEffects, bladeOrigin: () => blade.root.getWorldPosition(new THREE.Vector3()), bladeDirection: () => blade.root.getWorldDirection(new THREE.Vector3()),
  cue: kind => audio[kind](), skillEvent: event => { audio.skillEvent(event); if (event.type !== 'guard') coop.skillFx(event); if (event.type === 'strike' && event.slot === 'ultimate') ultimateDirector?.notifyStrike(); },
  onCast: event => { actionHud.announce(event); beginUltimate(event); },
  contactPoint: id => { const enemy = combat.state.enemies.find(e => e.id === id); return enemy ? { ...enemy.p } : null; },
  resolveAim: (identity, slot) => {
    const root = companionRoot(identity);
    if (!root?.visible || root.position.distanceTo(player.pos) >= 16) return null;
    const range = Math.max(...CONTRACT_SKILLS[identity][slot].pulses.map(pulse => pulse.range));
    return resolveServantSkillAim({ player: player.pos, caster: root.position, viewOrigin: camera.position, viewDirection: camera.getWorldDirection(new THREE.Vector3()), range, assistNearby: identity === 'saber' && slot === 'skill', preferredTargetId: identity === 'saber' ? servant.engagedTargetId : undefined, enemies: combat.state.enemies, terrain: combat.geometry.terrain });
  },
  startPose: (identity, command) => {
    if (identity === 'saber') return servant.root.visible && servant.root.position.distanceTo(player.pos) < 16 && servant.startSkillPose({ ...command,
      trackTarget: command.slot === 'skill' && command.targetId ? () => trackServantSkillTarget(servant.root.position, command.targetId!, Math.max(...CONTRACT_SKILLS.saber.skill.pulses.map(pulse => pulse.range)), combat.state.enemies, combat.geometry.terrain) : undefined,
    });
    if (isModelCompanionId(identity)) return modelCompanion.startSkillPose(identity, command, player.pos);
    if(identity==='napoleon'&&cavalrySupport?.busy)return false;
    const entry = eraActors.find(e => e.servant === identity);
    return !!entry?.actor?.root.visible && entry.actor.root.position.distanceTo(player.pos) < 16 && entry.follow.startSkillPose(entry.actor, command, player.pos, player.yaw);
  },
  cancelPoses: () => { servant.cancelSkillPose(); modelCompanion.cancelSkillPose(); for (const entry of eraActors) if(entry.servant!=='napoleon'||!cavalrySupport?.ownsActor)entry.follow.cancelSkillPose(entry.actor); },
});
actions.melee.style = worldMelee(equippedMeleeId)!;
ultimateStage = new UltimateStage();
ultimateDirector = new UltimateDirector({ cutInUrls: {
  saber: new URL('../assets/cinematics/saber-cut-in-v2.webp', import.meta.url).href,
  blackbeard: new URL('../assets/cinematics/blackbeard-cut-in-v2.webp', import.meta.url).href,
  napoleon: new URL('../assets/cinematics/napoleon-cut-in-v2.webp', import.meta.url).href,
  musashi: new URL('../assets/cinematics/musashi-cut-in-v2.webp', import.meta.url).href,
}, reducedEffects, onEnd: () => { audio.cinematicFrame(null); ultimateStage?.end(); ultimateSource = null; hudRevision++; } });
document.querySelector('#world-settings .settings-sliders')?.after(ultimateDirector.settingsControl);
function presentationModel(identity: CompanionId | null): THREE.Object3D | null {
  return identity === null ? rig.model : identity === 'saber' ? servant.presentationModel : companionKit(identity)?.model ?? null;
}
function beginUltimate(event: Extract<SkillEvent, { type: 'cast' }>) {
  if (event.slot !== 'ultimate' || !ultimateDirector || !ultimateStage || ultimateDirector.active) return;
  const model = presentationModel(event.identity); if (!model) return;
  keys.clear(); aim.clear();
  ultimateSource = { identity: event.identity, root: model };
  if (!ultimateDirector.begin(event.identity ?? 'player')) { ultimateSource = null; return; }
  const kit = companionKit(event.identity);
  const clips = event.identity === 'saber' ? servant.presentationClips : kit?.presentationClips;
  if (ultimateDirector.showing) {
    try { ultimateStage.begin({ identity: event.identity ?? 'player', sourceRoot: model, clips, chargeClip: kit?.definition.clips.presentation?.name, reducedEffects: reducedEffects() || ultimateDirector.frame?.reduced }); }
    catch (error) { ultimateStage.end(); ultimateDirector.skip(); console.warn('Ultimate stage unavailable; continuing the original cast without close-up.', error); }
  }
  hudRevision++;
}
function abortUltimate() { ultimateDirector?.abort(); ultimateStage?.end(); ultimateSource = null; actions?.cancel(); }
/** Presentation never owns damage. Only the original accepted action and actor
 * advance here; all other world clocks stay frozen in Full, Short and Off. */
function frameUltimate(dt: number): boolean {
  if (!ultimateDirector?.active || !ultimateStage || !ultimateSource || !actions) return false;
  const identity = contract.following;
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
      else if (identity && isModelCompanionId(identity)) modelCompanion.update(step, player.pos, anim.facing - Math.PI, companionEnabled(), false);
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
  } else { audio.cinematicFrame(null); combat.present(0, player.pos, !suspended, camera); localLights.yieldSlots(lightCensus.active(camera)); renderer.render(scene, camera); }
  actionHud.update(actions, !ultimateDirector.showing); renderContract();
  return true;
}
addEventListener('pagehide', event => { if (!event.persisted) { abortUltimate(); ultimateDirector?.dispose(); ultimateStage?.dispose(); } });
narrative = createNarrativePanel(() => settings.label('interact'));
homeTown=createHomeTown({scene,done,contract,servant,dialogue:narrative,save,changed:()=>{applyWorldState();renderObjective();},
 canInteract:id=>{const m=homeTown?.markers.find(m=>m.id===id);return !!m&&player.onGround&&!player.flying&&!player.swimming&&!player.gliding&&player.pos.distanceTo(new THREE.Vector3(...m.p))<(m.radius??2.6)&&canReachValleyPanel(m);},
 safe:()=>!getTravelSafetyBlock({...travelContext(),carrying:!!residentEventRuntime?.carrying})&&!ultimateDirector?.active,
 rest:()=>combat.recoverAtSettlement(25),refill:()=>combat.refillAmmo(60),interactLabel:()=>settings.label('interact'),
 input:()=>({held:down('interact'),moving:!!(down('forward')||down('back')||down('left')||down('right')||down('jump'))||Math.hypot(player.vel.x,player.vel.z)>.2,attacking:down('fire')||!!(actions?.skills.casting||actions?.melee.active||actions?.evade.active),grounded:player.onGround&&!player.flying&&!player.swimming&&!player.gliding,unsafeMotion:player.flying||player.swimming||player.gliding,damage:relayDamageRevision}),
 toast:line=>toast(bilingual(...line)),prepareDialogue:()=>{clearInput();hudRevision++;audio.interaction();}});
layout.markers.push(...homeTown.markers);for(const marker of homeTown.markers)markers.set(marker.id,marker);
colliders.push(...homeTown.activities.colliders);targets.push(...homeTown.activities.targets);
addEventListener('pagehide',e=>{if(!e.persisted)homeTown?.dispose();});
function speakDialogue(line: [string,string], speaker: [string,string] = ['交谈','Conversation']) {
  if (graphicsRecovery?.blocked || bootFailed || worldExited) return;
  clearInput(); narrative!.show(line,speaker); hudRevision++; audio.interaction();
}
const actionHud = createActionHud(action => settings.label(action));
weaponFinishControl = createWeaponFinishControl(weaponFinishStore, done, () => applyWeaponFinish());
document.querySelector('#world-settings .settings-sliders')?.after(weaponFinishControl.root);
addEventListener('pagehide', event => { if (!event.persisted) weaponFinishControl?.dispose(); });
let importedReloadPending = false;
function reloadImportedProgress() {
  if (importedReloadPending) return;
  importedReloadPending = true;
  // Storage is already committed. The old scene must never resume against the
  // replacement flags if browser navigation is blocked, canceled or throws.
  graphicsRecovery?.dispose();
  abortUltimate(); clearInput(); falseDawnRuntime?.dispose(); compactRelayRuntime?.dispose(); combat.cancelStoryEncounter();
  travelPanel.hide(); arenaTrainingPanel.hide(); campaignJournal?.hide(); questJournal?.hide(); settingsPanel.close(); progressPanel.dispose();
  audio.setActive(false);
  if (document.pointerLockElement) document.exitPointerLock();
  const retry = document.createElement('button'); retry.id = 'world-reload-import'; retry.type = 'button';
  const renderPending = () => {
    setLoading(bilingual('备份已保存。当前世界已停止，等待重新载入；若仍停留在此页，请点击重新载入。', 'Backup saved. This World session has stopped and is waiting to reload. If this page remains open, click Reload.'));
    retry.textContent = bilingual('重新载入已保存的世界', 'Reload saved World');
  };
  // Locale changes must not project replacement flags into the retired scene.
  refreshWorldLocale = renderPending;
  const unsubscribe = onLanguageChange(renderPending);
  addEventListener('pagehide', event => { if (!event.persisted) unsubscribe(); });
  const navigate = () => { if (worldExited) return; try { location.reload(); } catch { renderPending(); } };
  retry.addEventListener('click', event => { event.stopPropagation(); navigate(); });
  $('help').textContent = ''; $('settings-open').hidden = true;
  start.classList.remove('hidden'); start.append(retry); languageToggle.hidden = false;
  renderPending(); navigate();
}
const progressPanel = createProgressPanel(worldProgress, reloadImportedProgress);
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
  return { sessionReady: !bootFailed && !worldExited && !graphicsRecovery?.blocked, defeated: combat.defeated, combatActive: combat.bossStarted || !!combat.storyEncounter || !!compactRelayRuntime?.active || (typeof helionFight !== 'undefined' && helionFight.active) || (typeof activeRealmClimax !== 'undefined' && !!activeRealmClimax), threatened, quietSeconds: combat.state.quietFor,
    flying: player.flying, gliding: player.gliding, swimming: player.swimming, onGround: player.onGround,
    carrying: !!residentEventRuntime?.carrying||!!homeTown?.activities.carrying, mounted: fortCannon.mounted, actionActive: !!(actions?.skills.casting || actions?.melee.active || actions?.evade.active) };
}
function executeSafeTravel(id: string) {
  if (bootFailed || worldExited || graphicsRecovery?.blocked) return false;
  if (campaignJournalOpen) return false;
  if (ultimateDirector?.active) { toast(bilingual('终结技释放期间不能旅行。', 'Travel is unavailable during an ultimate.')); return false; }
  const plan = planSafeTravel(id, travelStops, done, found, travelContext());
  if (!plan.ok) { toast(bilingual(...TRAVEL_BLOCK_TEXT[plan.reason])); return false; }
  const [x, y, z] = plan.position;
  // This newly earned deployment may target an unvisited outpost, unlike the
  // original settlement stops. A moving patrol must not turn it into an ambush.
  if (id === 'compact_relay_outpost' && combat.state.enemies.some(e => e.active && !e.pacified && e.mode !== 'dead' && Math.hypot(e.p.x-x,e.p.z-z)<28)) {
    toast(bilingual('前哨落点附近仍有威胁，已取消部署。请稍后再试或选择步行。','The outpost arrival is threatened. Deployment canceled; retry later or approach on foot.')); return false;
  }
  const landing = combat.geometry.ground(x,z,y+2);
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
const arenaTrainingPanel=createArenaTrainingPanel({
  worldKey:action=>settings.label(action),
  arenaKey:action=>new SettingsStore('arena',{getItem:key=>progressStorage?.getItem(key)??null,setItem:()=>{}}).label(action),
  canOpen:()=>!bootFailed&&!worldExited&&!graphicsRecovery?.blocked&&!ultimateDirector?.active&&!compactRelayRuntime?.active,
  beforeLeave:()=>!bootFailed&&!worldExited&&!graphicsRecovery?.blocked&&save(),
});
const arenaTrainingOpen=document.createElement('button');arenaTrainingOpen.type='button';arenaTrainingOpen.id='world-arena-training-open';
const renderArenaTrainingButton=()=>{arenaTrainingOpen.textContent=bilingual('竞技训练 · 操作对照与离线 Arena','Arena practice · Controls and offline lobby');};renderArenaTrainingButton();
const unsubscribeArenaTraining=onLanguageChange(renderArenaTrainingButton);
arenaTrainingOpen.onclick=event=>{event.stopPropagation();arenaTrainingPanel.show();};start.append(arenaTrainingOpen);
addEventListener('pagehide',event=>{if(!event.persisted){arenaTrainingPanel.dispose();arenaTrainingOpen.remove();unsubscribeArenaTraining();}});
// ───────────── two-player co-op (coop/worldCoop.ts) ─────────────
const coopServer=(()=>{const value=params.get('coop');return value&&/^wss?:\/\//.test(value)?value:undefined;})();
const coop=new WorldCoop(scene,renderer,{combat,toast,onPing:()=>audio.contact(),partnerShot:(muzzle,end)=>combat.shot(muzzle,end,false),identities:COMPANIONS.map(s=>s.id),
  partnerSkill:fx=>{const origin={x:fx.o[0],y:fx.o[1],z:fx.o[2]},direction={x:fx.d[0],y:fx.d[1],z:fx.d[2]},pose={identity:fx.identity as CompanionId|null,slot:fx.slot,origin,direction,...(fx.feet!==undefined?{casterFeetY:fx.feet}:{}),...(fx.los!==undefined?{losOffset:fx.los}:{})};
    actions?.effects.show(fx.type==='strike'?{...pose,type:'strike',pulse:fx.pulse!,at:0,range:fx.range!,halfWidth:fx.hw!,damage:0,maxTargets:0}:{...pose,type:'cast',duration:fx.dur!},reducedEffects());},outlines:!params.has('noline'),server:coopServer,onStatus:()=>{if(coopPanel.open)coopPanel.render();renderCoopButton();}});
/** Co-op ping: the enemy under the crosshair, else the surface it points at (within 150 m). */
function coopPing() {
  if (!coop.session.paired) { toast(bilingual('联机时可用：标记敌人或地点给队友看。', 'Available in co-op: ping an enemy or spot for your partner.')); return; }
  if (!gameplayActive()) return;
  const origin = camera.position.clone(), look = camera.getWorldDirection(new THREE.Vector3());
  const wall = combat.geometry.cast(origin, look, 150);
  const enemy = combat.raycast(origin, look, wall?.distance ?? 150);
  const point = enemy ? enemy.point : wall ? wall.point : null;
  if (!point) { toast(bilingual('准星没有指向可标记的地方。', 'Nothing to ping under the crosshair.')); return; }
  coop.ping({ x: point.x, y: point.y + (enemy ? 0 : .2), z: point.z }, enemy?.id);
}
/** Arrive on clear ground beside the co-op partner (never mid-fight, mounted or while down). */
function travelToPartner(): string | null {
  const at = coop.partnerPoint, s = coop.avatar.track.latest;
  if (!at || !s) return bilingual('还没有收到队友的位置。', 'No partner position yet.');
  const context = travelContext();
  if (context.defeated || !s.hp) return bilingual('倒下时不能传送。', 'Cannot travel while down.');
  if (context.combatActive || context.mounted || ultimateDirector?.active) return bilingual('首领战、剧情战或操作装置时不能传送。', 'Not during a boss, story fight or while mounted.');
  for (const [dx, dz] of [[1.6, 1.2], [-1.6, 1.2], [1.6, -1.2], [-1.6, -1.2], [0, 2.2], [0, -2.2], [0, 0]]) {
    const x = at.x + dx, z = at.z + dz, landing = combat.geometry.ground(x, z, s.p[1] + 2.5);
    if (!landing || Math.abs(landing.point.y - s.p[1]) > 2.5 || !combat.geometry.clear(landing.point, .38, 1.8)) continue;
    clearInput(); player.flying = false;
    player.teleport(x, landing.point.y + .25, z, player.yaw); prevPos.copy(player.pos); rig.root.position.copy(player.pos);
    anim.reset(worldProgress.armed, player.yaw + Math.PI); camDist = 3.6; acc = 0; inspectServant = false; hudRevision++;
    toast(bilingual(`已来到${coop.partnerName}身边。`, `Joined ${coop.partnerName}.`));
    return null;
  }
  return bilingual('队友身边暂时没有安全落点，稍后再试。', 'No clear ground beside your partner yet; try again.');
}
const coopPanel=createCoopPanel({

  status:()=>({status:coop.session.status,code:coop.session.code,host:coop.session.host,partner:coop.partnerName}),
  join:code=>coop.join(code),leave:()=>coop.leave(),toPartner:travelToPartner,
  canOpen:()=>!bootFailed&&!worldExited&&!graphicsRecovery?.blocked&&!ultimateDirector?.active,
});
const coopOpen=document.createElement('button');coopOpen.type='button';coopOpen.id='world-coop-open';
const renderCoopButton=()=>{const s=coop.session.status;coopOpen.textContent=s==='paired'?bilingual(`双人联机 · 已连接 ${coop.session.code}`,`Co-op · Connected ${coop.session.code}`):s==='waiting'?bilingual(`双人联机 · 房间 ${coop.session.code} 等待中`,`Co-op · Room ${coop.session.code} waiting`):bilingual('双人联机','Co-op');};renderCoopButton();
const unsubscribeCoop=onLanguageChange(renderCoopButton);
coopOpen.onclick=event=>{event.stopPropagation();coopPanel.show();};start.append(coopOpen);
{const room=normalizeRoomCode(params.get('room')??'');if(room)coop.join(room);}
addEventListener('pagehide',event=>{if(!event.persisted){coop.dispose();coopPanel.dispose();coopOpen.remove();unsubscribeCoop();}});
const travelOpen=document.createElement('button'); travelOpen.type='button';travelOpen.id='world-travel-open';
const renderTravelButton=()=>{travelOpen.textContent=bilingual(`安全据点旅行 · ${settings.label('travel')}`,`Safe settlement travel · ${settings.label('travel')}`);};
renderTravelButton();onLanguageChange(()=>{renderTravelButton();travelPanel.refresh();});
travelOpen.addEventListener('click',event=>{event.stopPropagation();travelPanel.show();}); start.append(travelOpen);
addEventListener('pagehide',event=>{if(!event.persisted){audio.dispose();narrative?.dispose();travelPanel.dispose();travelOpen.remove();}});
const campaignTrackingBlocked = (region: WorldRegionId): [string, string] | null => trackedStoryRouteBlocked(regionAt(player.pos.x, player.pos.z).id, region, done)
  ? ['先沿当前主线接通外联或稳定召唤阵，开启地区通路。', 'Restore the uplink or stabilize the summoning circle on the current story to open regional routes.'] : null;
const questTrackingBlocked=(guide:QuestGuide)=>isExpansionRegion(guide.region)?null:campaignTrackingBlocked(guide.region);
campaignJournal = createCampaignJournal({
  done: () => done,
  onOpen: () => {
    if (bootFailed || worldExited || graphicsRecovery?.blocked || campaignJournalOpen || travelOpenState || settingsPanel.open || servantPanel.open || ultimateDirector?.active || fortCannon.mounted || actions?.skills.casting || actions?.melee.active || actions?.evade.active) return false;
    campaignJournalOpen = true; clearInput(); if (document.pointerLockElement) document.exitPointerLock(); return true;
  },
  onClose: () => { campaignJournalOpen = false; clearInput(); },
  trackingBlocked: campaignTrackingBlocked,
  pin: region => { if (campaignTrackingBlocked(region) || !getCampaignEpisodeGuide(region, done)) return false; questTrackedId = null; campaignTrackedRegion = region; falseDawnTracked = false; optionalPin = null; guideOn = true; hudRevision++; return true; },
  arcTrackingBlocked: () => { const guide = getFalseDawnGuide(done, { activeEncounter: combat.storyEncounter?.id ?? null }); return guide ? campaignTrackingBlocked(guide.region) : null; },
  pinArc: () => { const guide = getFalseDawnGuide(done, { activeEncounter: combat.storyEncounter?.id ?? null }); if (!guide || campaignTrackingBlocked(guide.region)) return false; questTrackedId = null; falseDawnTracked = true; campaignTrackedRegion = null; optionalPin = null; guideOn = true; hudRevision++; return true; },
  restoreMain: () => { questTrackedId = null; campaignTrackedRegion = null; falseDawnTracked = false; optionalPin = null; guideOn = true; hudRevision++; },
});
const journalOpen = document.createElement('button'); journalOpen.type = 'button'; journalOpen.id = 'world-campaign-journal-open';
const renderJournalButton = () => { journalOpen.textContent = bilingual('可选调查与归路纪事 · 故事进度', 'Optional investigations & chronicles · Story progress'); };
renderJournalButton(); const unsubscribeJournalButton = onLanguageChange(renderJournalButton);
journalOpen.addEventListener('click', event => { event.stopPropagation(); campaignJournal?.show(); }); start.append(journalOpen);
addEventListener('pagehide', event => { if (!event.persisted) { campaignJournal?.dispose(); journalOpen.remove(); unsubscribeJournalButton(); } });
questCatalog = createQuestGuideCatalog({
  markers: [...markers.values()], objectives: layout.objectives,
  npcs: [...settlements.npcs,...campaignSites.npcs],
  enemies: combat.state.enemies.filter(enemy=>enemy.id==='elite_oath_knight').map(enemy=>({id:enemy.id,region:'britain' as const,position:[enemy.home.x,enemy.home.y,enemy.home.z] as [number,number,number],label:['失誓骑士','Oathless Knight'] as [string,string]})),
});
questJournal = createQuestJournal({
  entries: currentQuestEntries, currentRegion:()=>regionAt(player.pos.x,player.pos.z).id, position:()=>[player.pos.x,player.pos.y,player.pos.z],
  trackingBlocked: questTrackingBlocked,
  onOpen:()=>{
    if(bootFailed||worldExited||graphicsRecovery?.blocked||campaignJournalOpen||travelOpenState||settingsPanel.open||servantPanel.open||narrative?.open||ultimateDirector?.active||fortCannon.mounted||actions?.skills.casting||actions?.melee.active||actions?.evade.active)return false;
    campaignJournalOpen=true;clearInput();if(document.pointerLockElement)document.exitPointerLock();return true;
  },
  onClose:()=>{campaignJournalOpen=false;clearInput();},
  pin:id=>{const guide=currentQuestEntries().find(entry=>entry.id===id)?.guide;if(!guide||questTrackingBlocked(guide))return false;questTrackedId=id;campaignTrackedRegion=null;falseDawnTracked=false;optionalPin=null;guideOn=true;hudRevision++;return true;},
  restoreMain:()=>{questTrackedId=null;campaignTrackedRegion=null;falseDawnTracked=false;optionalPin=null;guideOn=true;hudRevision++;},
  openChronicles:()=>campaignJournal?.show(),
});
const questOpen=document.createElement('button');questOpen.type='button';questOpen.id='world-quest-journal-open';
const renderQuestButton=()=>{questOpen.textContent=bilingual('任务指引 · 主线、支线与探索','Quest guide · Main, side & exploration');};
renderQuestButton();const unsubscribeQuestButton=onLanguageChange(renderQuestButton);
questOpen.addEventListener('click',event=>{event.stopPropagation();questJournal?.show();});start.append(questOpen);
const claimsOpen=document.createElement('button');claimsOpen.type='button';claimsOpen.id='world-servant-claims-open';
const renderClaimsButton=()=>{claimsOpen.textContent=bilingual('从者领取','Claim servants');};
renderClaimsButton();const unsubscribeClaimsButton=onLanguageChange(renderClaimsButton);
claimsOpen.addEventListener('click',event=>{event.stopPropagation();questJournal?.show({region:'all',category:'side',search:'从者领取'});});start.append(claimsOpen);
addEventListener('pagehide',event=>{if(!event.persisted){claimsOpen.remove();unsubscribeClaimsButton();}});
const adventureButton=document.createElement('button');adventureButton.type='button';adventureButton.id='world-adventure-continue';
const renderAdventureButton=()=>{adventureButton.textContent=bilingual('继续 World 主线 · 保留已有存档','Continue the World story · Keep progress');};renderAdventureButton();const unsubscribeAdventureButton=onLanguageChange(renderAdventureButton);
adventureButton.onclick=event=>{event.stopPropagation();if(worldExited||bootFailed||graphicsRecovery?.blocked)return;if(isKingdomGateOpen(done))done.add(KINGDOM_GATE.open);done.add(ADVENTURE.started);done.add(JOURNEY_DRAMA.started);save();questTrackedId=null;campaignTrackedRegion=null;falseDawnTracked=false;optionalPin=null;guideOn=true;applyWorldState();toast(bilingual('主线人物篇已启用，原有进度保留。进入世界后跟随岚的指引。','Character chapters enabled. Progress kept. Enter World and follow Lan’s lead.'));};start.append(adventureButton);
addEventListener('pagehide',event=>{if(!event.persisted){adventureButton.remove();unsubscribeAdventureButton();}});
const relayTrackButton=document.createElement('button');relayTrackButton.type='button';relayTrackButton.id='world-compact-relay-track';
const renderRelayTrackButton=()=>{relayTrackButton.textContent=bilingual('突破演练 / 前沿部署 · 追踪目标','Breach exercise / Forward deployment · Track objective');};renderRelayTrackButton();const unsubscribeRelayTrack=onLanguageChange(renderRelayTrackButton);
relayTrackButton.onclick=event=>{event.stopPropagation();if(worldExited||bootFailed||graphicsRecovery?.blocked)return;questTrackedId='main:compact-relay';campaignTrackedRegion=null;falseDawnTracked=false;optionalPin=null;guideOn=true;hudRevision++;toast(bilingual('已追踪突破演练或已开放的部署板。点击进入世界继续。','Exercise or earned deployment board tracked. Enter World to continue.'));};start.append(relayTrackButton);
addEventListener('pagehide',event=>{if(!event.persisted){relayTrackButton.remove();unsubscribeRelayTrack();}});
const moreJourney=document.createElement('details'),moreJourneyTitle=document.createElement('summary');moreJourney.id='world-more-journey';moreJourney.addEventListener('click',e=>e.stopPropagation());moreJourney.append(moreJourneyTitle,$('shot-mode'),arenaTrainingOpen,travelOpen,journalOpen,relayTrackButton);Object.assign(moreJourney.style,{textAlign:'center',maxHeight:'32vh',overflow:'auto',padding:'6px 12px',borderRadius:'8px',background:'#182b37cc'});moreJourney.querySelectorAll('button').forEach(button=>{button.style.display='block';button.style.margin='8px auto';});const renderMoreJourney=()=>{moreJourneyTitle.textContent=bilingual('更多旅途选项','More journey options');};renderMoreJourney();const unsubscribeMoreJourney=onLanguageChange(renderMoreJourney);start.append(moreJourney);addEventListener('pagehide',event=>{if(!event.persisted){moreJourney.remove();unsubscribeMoreJourney();}});
addEventListener('pagehide',event=>{if(!event.persisted){questJournal?.dispose();questOpen.remove();unsubscribeQuestButton();}});
const worldInterface=installWorldInterface({start,label:action=>settings.label(action),subscribe:listener=>settings.subscribe(listener)});
addEventListener('pagehide',event=>{if(!event.persisted)worldInterface.dispose();});
trackedStoryHud = createTrackedStoryHud($('objective'));
function updateTrackedStoryHud() {
  if (!trackedStoryHud) return;
  const active = combat.storyEncounter;
  const returnHint = bilingual(`${settings.label('mainRoute')} · 返回原主线指引`, `${settings.label('mainRoute')} · Restore original story guide`);
  const quest=trackedQuest();
  if(quest){trackedStoryHud.update({title:bilingual(...quest.title),instruction:bilingual(...(questTrackingBlocked(quest)??quest.text)),returnHint});return;}
  if (falseDawnTracked) {
    const objective = getFalseDawnObjective(done, active?.id ?? null);
    const guide = getFalseDawnGuide(done, { activeEncounter: active?.id ?? null });
    if (objective && guide) {
      const blocked = campaignTrackingBlocked(guide.region);
      trackedStoryHud.update({ title: bilingual(...objective.title), instruction: bilingual(...(blocked ?? objective.line)), returnHint,
        status: !blocked && active ? bilingual(`现场威胁剩余 ${active.remaining}`, `${active.remaining} threats remain`) : undefined });
      return;
    }
  }
  if (campaignTrackedRegion) {
    const objective = getCampaignEpisodeObjective(campaignTrackedRegion, done, residentEventRuntime?.carrying);
    if (objective) {
      const blocked = campaignTrackingBlocked(campaignTrackedRegion);
      trackedStoryHud.update({ title: bilingual(...objective.title), instruction: bilingual(...(blocked ?? objective.line)), returnHint });
      return;
    }
  }
  if(adventureActive(done)&&optionalPin&&!optionalPinExpired(optionalPin,regionAt(player.pos.x,player.pos.z).id,player.pos,done,found)){trackedStoryHud.update({title:bilingual('可选探索','Optional exploration'),instruction:bilingual(...optionalPin.label),returnHint});return;}
  trackedStoryHud.update(null);
}
addEventListener('pagehide', event => { if (!event.persisted) trackedStoryHud?.dispose(); });
const falseDawnLine = (line: [string, string]): [string, string] => {
  const guide = getFalseDawnGuide(done, { activeEncounter: combat.storyEncounter?.id ?? null });
  const blocked = guide ? campaignTrackingBlocked(guide.region) : null;
  if (blocked) line = [`${line[0]}\n${blocked[0]}`, `${line[1]}\n${blocked[1]}`];
  const root = contract.companionSummoned ? servantRoot() : undefined;
  const reaction = root?.visible && root.position.distanceTo(player.pos) <= 16 ? getFalseDawnCompanionReaction(contract.following, done) : null;
  return reaction ? [`${line[0]}\n${reaction.speaker[0]}：${reaction.line[0]}`, `${line[1]}\n${reaction.speaker[1]}: ${reaction.line[1]}`] : line;
};
falseDawnRuntime = createFalseDawnRuntime({
  done,
  reachable: id => {
    const marker = markers.get(id);
    return !bootFailed && !worldExited && !graphicsRecovery?.blocked && !!marker && falseDawnMarkerIds.has(id) && locked && !settingsPanel.open && !travelOpenState && !campaignJournalOpen && !ultimateDirector?.active && document.visibilityState === 'visible' && document.hasFocus() && !combat.defeated && !player.flying && !player.swimming && !player.gliding && player.onGround && player.pos.distanceTo(new THREE.Vector3(...marker.p)) < (marker.radius ?? 3) && canReachValleyPanel(marker);
  },
  activeEncounter: () => combat.storyEncounter?.id ?? null,
  startEncounter: id => {
    const spec = getFalseDawnEncounterSpec(id); if (!spec) return { ok: false, reason: FALSE_DAWN_START_HINTS.invalid };
    const playable = gameplayActive() && !combat.defeated && player.onGround && !player.flying && !player.swimming && !player.gliding && !fortCannon.mounted && !actions?.skills.casting && !actions?.melee.active && !actions?.evade.active;
    const result = combat.startStoryEncounter(spec, { position: player.pos, playable });
    return { ok: result.ok, reason: FALSE_DAWN_START_HINTS[result.reason] };
  },
  cancelEncounter: () => { combat.cancelStoryEncounter(); }, save, applyState: applyWorldState,
  dialogue: (line, speaker) => speakDialogue(falseDawnLine(line), speaker),
  choices: (line, speaker, choices, select) => { if (graphicsRecovery?.blocked || bootFailed || worldExited) return; clearInput(); audio.interaction(); hudRevision++; narrative!.showChoices(falseDawnLine(line), speaker, choices, select); },
  toast: line => toast(bilingual(...line)), physicalFeedback: () => audio.interaction(),
});
addEventListener('pagehide', event => { if (!event.persisted) { falseDawnRuntime?.dispose(); compactRelayRuntime?.dispose(); } });
function compactRelayReachable(id: string) {
  const marker = markers.get(id);
  return !bootFailed && !worldExited && !graphicsRecovery?.blocked && !!marker && compactRelayMarkerIds.has(id)
    && locked && !settingsPanel.open && !travelOpenState && !campaignJournalOpen && !ultimateDirector?.active
    && document.visibilityState === 'visible' && document.hasFocus() && !combat.defeated
    && !player.flying && !player.swimming && !player.gliding && player.onGround
    && player.pos.distanceTo(new THREE.Vector3(...marker.p)) < (marker.radius ?? 3) && canReachValleyPanel(marker);
}
residentEventRuntime=createResidentEventRuntime({done,save,changed:applyWorldState,toast:line=>toast(bilingual(...line)),reachable:id=>{const m=markers.get(id);return !!m&&gameplayActive()&&!combat.defeated&&player.onGround&&!player.flying&&!player.swimming&&player.pos.distanceTo(new THREE.Vector3(...m.p))<(m.radius??3)&&canReachValleyPanel(m);}});
const napoleonEntry=eraActors.find(e=>e.servant==='napoleon')!;
cavalrySupport=new LocalCavalrySupport({done,player:player.pos,actor:()=>napoleonEntry.actor,follow:napoleonEntry.follow,
 start:()=>{if(!combat.storyEncounter&&!combat.bossStarted&&combat.allyEngage(16,player.pos))return{ok:true};const a=adventureSites.actions.get('adventure_winter_support')!,spec={id:'adventure_winter_breach',anchor:{x:a.p[0],y:a.p[1],z:a.p[2]},actors:[{role:'musketeer' as const,offset:[-3,9] as const,title:['宽街侧翼枪手','Wide-road flank gunner'] as const},{role:'lancer' as const,offset:[3,9] as const,title:['拒马后卫','Roadblock rear guard'] as const}]};const result=combat.storyEncounter?.id===spec.id?{ok:true,reason:'active' as const}:combat.startStoryEncounter(spec,{position:player.pos,playable:gameplayActive()&&player.onGround});return{ok:result.ok,reason:FALSE_DAWN_START_HINTS[result.reason]};},
 target:()=>{const target=combat.allyEngage(16,player.pos);return target?{id:target.id,point:new THREE.Vector3(target.p.x,target.p.y,target.p.z)}:null;},
 ground:(x,z)=>combat.geometry.ground(x,z)?.point.y??null,clear:p=>combat.geometry.clear(p,1.25,3.4),
 strike:(origin,direction)=>combat.applyStrike({origin,direction,range:4.8,halfWidth:1.7,damage:56,maxTargets:2},'skill').hits.length>0,
 toast:line=>toast(bilingual(...line)),save,changed:applyWorldState,
});
adventureRuntime=createAdventureRuntime({done,cavalry:()=>cavalrySupport!.request(),ending:line=>{if(dramaActive(done))line=journeyEnding(done);const voices:Record<CompanionId,[string,string]>={saber:['Saber：“有些誓言，是为了让人能回家。”','Saber: “Some oaths exist so people can return home.”'],blackbeard:['黑胡子：“下一趟，航路由我们自己选。”','Blackbeard: “Next voyage, we choose the course.”'],napoleon:['拿破仑：“道路已经通了。现在，往前走。”','Napoleon: “The road is open. Now, onward.”'],musashi:['武藏：“明天还没来。今天的路，走得不错。”','Musashi: “Tomorrow is still ahead. We traveled well today.”'],jeanne:['贞德：“旗可以放下了。下一班有人接手。”','Jeanne: “We can lower the flag. The next watch is here.”'],ozymandias:['奥斯曼迪斯：“水还在流。让他们分配自己的河水。”','Ozymandias: “The water still flows. Let them share their own river.”'],qinShiHuang:['秦始皇：“今日的交接已记。明日照样可以改令。”','Qin Shi Huang: “Today’s handover is recorded. Tomorrow they may change the order.”']};const reaction=contract.following?voices[contract.following]:null;speakDialogue(reaction?[line[0]+'\n'+reaction[0],line[1]+'\n'+reaction[1]]:line,['旅途记录','Journey record']);},supply:()=>{combat.refillAmmo(30);return combat.recoverAtSettlement(25);},actions:adventureSites.actions,path:adventureSites.convoyPath,millPath:adventureSites.millConvoyPath,save,changed:applyWorldState,damage:()=>relayDamageRevision,
 continuationBlock:id=>{
  if(id==='adventure_tomorrow'&&journeyEnabled(done)&&!done.has(JOURNEY.epilogue))return ['地面撤离已经完成。真正的交接在天穹观测冠。','The ground evacuation is complete. The final handover takes place at the Sky Crown.'];
  if((id==='adventure_guardian'||id==='adventure_tower'||id==='adventure_exit'||(ADVENTURE.emitters as readonly string[]).includes(id))&&!journeyTowerReady(done))return ['先完成各地交接，再接通塔外的独立线路。','Complete the regional handovers and connect the independent circuits outside the tower first.'];
  return null;
 },
 reachable:id=>{const m=markers.get(id);return !!m&&gameplayActive()&&!combat.defeated&&player.onGround&&!player.flying&&!player.swimming&&!player.gliding&&player.pos.distanceTo(new THREE.Vector3(...m.p))<(m.radius??3)&&canReachValleyPanel(m);},
 start:spec=>{const result=combat.startStoryEncounter(spec,{position:player.pos,playable:gameplayActive()&&player.onGround&&!combat.defeated&&!player.flying&&!player.gliding&&!player.swimming});return{ok:result.ok,reason:FALSE_DAWN_START_HINTS[result.reason]};},
 encounter:()=>combat.storyEncounter?.id??null,cancel:()=>combat.cancelStoryEncounter(),toast:line=>toast(bilingual(...line)),
 moveCart:(from,to)=>medicineCartPathClear(combat.geometry.contactSurface({minX:Math.min(from[0],to[0])-3,maxX:Math.max(from[0],to[0])+3,minZ:Math.min(from[2],to[2])-3,maxZ:Math.max(from[2],to[2])+3}),from,to),
});
const helionHud = document.createElement('div');
helionHud.className = 'hud'; helionHud.id = 'helion-status'; helionHud.hidden = true;
Object.assign(helionHud.style, { top: '78px', left: '50%', transform: 'translateX(-50%)', width: 'min(420px, 80vw)', textAlign: 'center' });
const helionName = document.createElement('div'), helionHealth = document.createElement('progress'), helionTell = document.createElement('div');
helionHealth.style.width = '100%'; helionHud.append(helionName, helionHealth, helionTell); document.body.append(helionHud);
const helionFight = createHelionFight({ done,
  phaseCleared(id, supporters, shutters) {
    done.add(id);
    for (const ally of supporters) done.add(skySupportFlag(ally));
    SKY_SHUTTER_FLAGS.forEach((flag, index) => { if (shutters[index]) done.add(flag); else done.delete(flag); });
    saveJourneyProgress(); combat.refillAmmo(); combat.state.fieldHeal(22); audio.explore('solve');
    if (skyPhase(done) >= 0) helionFight.start();
    else toast(bilingual('紧急写入臂已停机。现在可以完成交接。','The emergency writer is down. Complete the handover.'));
  },
  hurt: damage => combat.state.applyExternalDamage(damage),
  cue: beat => { if (beat === 'locked') audio.interaction(); else if (beat === 'recovering') audio.bell(); },
});
addEventListener('pagehide', event => { if (!event.persisted) helionHud.remove(); });
let crownRecoverySector: number | null = null;

function availableSkySupport(): SkySupporter | undefined {
  if (!helionFight.active) return;
  const preferred = contract.following;
  return preferred && helionFight.canSupport(preferred) ? preferred : SKY_SUPPORTERS.find(id => helionFight.canSupport(id));
}

function skyJourneySpawn(): Marker {
  const point = done.has(JOURNEY.skyCourt) || (done.has(JOURNEY.isolate) && legacySkyApproach(done)) ? SKY_CHECKPOINT
    : done.has(JOURNEY.isolate) ? SKY_THROAT_CHECKPOINT : done.has(JOURNEY.skyReview) ? SKY_HALL_CHECKPOINT : SKY_LANDING;
  return { id: JOURNEY.launch, type: 'spawn', label: '天穹观测冠', p: [...point] };
}
function journeyHomeSpawn(): Marker { return { id: JOURNEY.returnHome, type: 'spawn', label: '回望桥', p: worldJourneySites?.homecoming ?? initialSpawn.p }; }
function moveJourneyPlayer(destination: Marker) {
  const [x, y, z] = destination.p;
  const ground = combat.geometry.ground(x, z, y + 1.7);
  if (!ground || Math.abs(ground.point.y - y) > .8 || !combat.geometry.clear(ground.point, .38, 1.8)) return false;
  clearInput(); player.teleport(x, ground.point.y + .2, z, destination.id === JOURNEY.returnHome ? -Math.PI / 2 : 0);
  prevPos.copy(player.pos); rig.root.position.copy(player.pos); anim.reset(worldProgress.armed, player.yaw + Math.PI);
  spawn = destination; camDist = 3.6; acc = 0; hudRevision++;
  return true;
}
function saveJourneyProgress() {
  if (!save()) toast(bilingual('本次进度未保存，请在设置里重试。','Progress could not be saved. Retry in Settings.'));
  applyWorldState();
}
const realmClimaxHud = document.createElement('div');
realmClimaxHud.id = 'realm-climax-status'; realmClimaxHud.className = 'hud'; realmClimaxHud.hidden = true;
Object.assign(realmClimaxHud.style, { top: '78px', left: '50%', transform: 'translateX(-50%)', width: 'min(440px, 82vw)', textAlign: 'center' });
const realmName = document.createElement('div'), realmHealth = document.createElement('progress'), realmCue = document.createElement('div');
realmHealth.style.width = '100%'; realmClimaxHud.append(realmName, realmHealth, realmCue); document.body.append(realmClimaxHud);
addEventListener('pagehide', event => { if (!event.persisted) realmClimaxHud.remove(); });

function stopRealmClimax() {
  const fight = activeRealmClimax;
  if (!fight) return;
  fight.reset(); realmClimaxSites?.sites[fight.id].update(fight);
  activeRealmClimax = null; realmClimaxHud.hidden = true; hudRevision++;
}
function operateRealmClimax(region: RealmClimaxId, station: ClimaxStation | 'start') {
  const site = realmClimaxSites?.sites[region];
  if (!site) return;
  if (station !== 'start') {
    if (activeRealmClimax?.id === region && activeRealmClimax.work(station)) {
      audio.interaction(); hudRevision++; renderObjective();
    }
    return;
  }
  if (!worldProgress.armed || combat.bossStarted || combat.storyEncounter || helionFight.active || activeRealmClimax) return;
  const fight = createRealmClimax(region, site.origin, { done,
    save(flag) {
      done.add(flag); saveJourneyProgress(); hudRevision++; audio.explore('solve');
      if (fight.phase < 0) {
        stopRealmClimax(); combat.state.fieldHeal(26);
        toast(bilingual('现场已安全，完成交接。','The site is secure. Complete the handover.'));
      } else combat.refillAmmo();
    },
    hurt: damage => combat.state.applyExternalDamage(damage),
    warn: () => audio.realmWarning(region),
  });
  if (fight.start()) {
    activeRealmClimax = fight; combat.refillAmmo(); site.update(fight); hudRevision++; renderObjective();
  }
}
function updateRealmClimax(dt: number) {
  const fight = activeRealmClimax;
  if (!fight || !realmClimaxSites) return;
  const site = realmClimaxSites.sites[fight.id];
  if (Math.hypot(player.pos.x - site.start[0], player.pos.z - site.start[2]) > 33 || Math.abs(player.pos.y - site.start[1]) > 7) {
    stopRealmClimax(); renderObjective();
    toast(bilingual('已离开战场 · 返回接应点继续', 'Left the battlefield · Return to the rally point to resume')); return;
  }
  const playing = gameplayActive() && !combat.defeated;
  if (playing) fight.update(dt, player.pos);
  site.update(fight, playing ? dt : 0);
  realmClimaxHud.hidden = !playing;
  if (!playing) return;
  const phase = fight.definition.phases[fight.phase];
  realmName.textContent = bilingual(
    `${fight.definition.title[0]} · ${phase.title[0]}`, `${fight.definition.title[1]} · ${phase.title[1]}`);
  realmHealth.hidden = fight.maxHp === 0;
  realmHealth.max = fight.maxHp || 1; realmHealth.value = fight.hp;
  realmCue.textContent = fight.tell ? bilingual('危险区域已锁定 · 离开橙色标线','Danger zone locked · Move clear of the orange marks')
    : fight.exposed ? bilingual('可射击 · 瞄准金色目标','Target open · Aim for the gold target')
      : bilingual('查看当前任务，操作现场机关','Follow the current objective to the field controls');
}
function selectStoryPositions(spec: StoryEncounterSpec, officers: readonly Omit<StoryEncounterActor, 'offset'>[], slots: readonly [number, number][]) {
  const { x, z } = spec.anchor;
  const actors: StoryEncounterActor[] = [];
  for (const offset of slots) {
    const next = { ...officers[actors.length], offset };
    const px = x + offset[0], pz = z + offset[1];
    const point = combat.geometry.safeAdventureSpawn({ ...spec, actors: [next] }, px, pz);
    if (!point || combat.state.enemies.some(e => e.hp > 0 && !e.pacified && Math.abs(e.p.y - point.y) < 2.6 && Math.hypot(e.p.x - px, e.p.z - pz) < 5)) continue;
    actors.push(next);
    if (actors.length === officers.length) break;
  }
  return actors;
}
function advanceKingdomWorks(id: KingdomWork) {
  if (!kingdomWorkReady(id, done)) return false;
  if (id === KW.patrol) {
    const marker = markers.get(id);
    if (!marker || !worldProgress.armed || combat.bossStarted || activeRealmClimax) return false;
    const [x, y, z] = marker.p;
    const spec: StoryEncounterSpec = { id: KINGDOM_WATCH_ENCOUNTER, anchor: { x, y: y - .9, z }, actors: [] };
    const officers: Omit<StoryEncounterActor, 'offset'>[] = [
      { role: 'breaker', title: ['旧誓盾卫', 'Oathbound shield guard'] },
      { role: 'musketeer', title: ['空甲巡卫', 'Empty patrol marksman'] },
    ];
    const lateral = done.has(KW.market) ? 1 : -1;
    const actors = selectStoryPositions(spec, officers, [[5*lateral,-5], [-5*lateral,-5], [0,-8], [-8,2], [8,2], [-6,6], [6,6]]);
    if (actors.length !== officers.length) {
      toast(bilingual('守夜点附近受阻。清理附近威胁后再启动。', 'The watch approaches are blocked. Clear nearby threats and try again.')); return false;
    }
    const result = combat.startStoryEncounter({ ...spec, actors }, { position: player.pos, playable: gameplayActive() && player.onGround });
    if (!result.ok) { toast(bilingual(...FALSE_DAWN_START_HINTS[result.reason])); return false; }
    spawn = { ...marker, type: 'spawn', p: [x, y - .9, z] }; combat.refillAmmo();
    return true;
  }
  if (!commitKingdomWork(id, done)) return false;
  kingdomWorksScene?.apply(done, 0, true);
  saveJourneyProgress();
  if (id === KW.bell) audio.bell(); else audio.interaction();
  const line = KINGDOM_WORK_LINES[id]; if (line) toast(bilingual(...line));
  return true;
}
function startValleyNightPatrol() {
  const marker = markers.get(F.nightPatrol);
  if (!marker || !worldProgress.armed || combat.bossStarted || activeRealmClimax) return;
  const [x, y, z] = marker.p;
  const spec: StoryEncounterSpec = { id: VALLEY_NIGHT_ENCOUNTER, anchor: { x, y: y - .9, z }, actors: [] };
  const decoy = done.has(F.soundDecoy);
  const officers: Omit<StoryEncounterActor, 'offset'>[] = [
    { role: 'breaker', pattern: 'echo-warden', title: ['巡护官 07', 'Patrol Officer 07'] },
    ...(done.has(F.dimWatch) ? [] : [{ role: 'musketeer' as const, title: ['执行巡卫', 'Enforcement patrol'] as const }]),
  ];
  const slots = (decoy ? [[-7, -5], [-8, 3], [6, 6], [5, -7], [0, 9], [9, 0]] : [[-7, 5], [6, -6], [0, 9], [-8, 0], [8, 0]]) as [number, number][];
  const actors = selectStoryPositions(spec, officers, slots);
  if (actors.length !== officers.length) {
    toast(bilingual('接点站位暂受阻。清理周边威胁后重试。','Junction approach blocked. Clear nearby threats and retry.')); return;
  }
  const result = combat.startStoryEncounter({ ...spec, actors }, { position: player.pos, playable: gameplayActive() && player.onGround });
  if (!result.ok) { toast(bilingual(...FALSE_DAWN_START_HINTS[result.reason])); return; }
  spawn = { ...marker, type: 'spawn', p: [x, y - .92, z] };
  combat.refillAmmo();
  toast(bilingual(...VALLEY_FIELD_BY_ID.get(F.nightPatrol)!.result));
}
function interactEgyptGauge(id: EgyptGaugeAction) {
  if (id === G.align) {
    clearInput(); audio.interaction();
    narrative?.showChoices(['盐线已经干透，井底是旧泥。只有中间那道潮痕仍在往上爬。把指针锁在哪一格？',
      'The salt is dry. The silt is old. Only the middle stain still creeps upward. Where should the pointer lock?'],
    EGYPT_GAUGE_TITLE, EGYPT_GAUGE_CHOICES, selected => {
      const marker = markers.get(id);
      if (!marker || !journeyMarkerActive(id) || combat.defeated || player.pos.distanceTo(new THREE.Vector3(...marker.p)) > (marker.radius ?? 2)
        || !canReachValleyPanel(marker)) return;
      if (selected !== 'seep') {
        toast(bilingual('水尺对不上活水。再看仍在向上爬的痕迹。', 'The reading misses the live water. Look for the stain still climbing.'));
        return;
      }
      done.add(id); saveJourneyProgress(); audio.explore('solve');
      toast(bilingual('铜针锁住了第二刻度。去找帕赫核对这次读数。', 'The bronze pointer locks onto the second mark. Check the reading with Pahek.'));
    });
    return;
  }
  done.add(id); saveJourneyProgress();
  if (id === G.trace) {
    speakDialogue(['井口明明没有涨水，墙上却有一股细水向上爬。循着潮湿的石块去低井找旧水尺。',
      'The well hasn’t risen, yet a thin trickle climbs the wall. Follow the damp stones to the old gauge.'], EGYPT_GAUGE_TITLE);
    return;
  }
  gaugeKeeperSpeaking = true;
  egyptGaugeScene?.gesture();
  speakDialogue(done.has(JOURNEY.egyptDone)
    ? ['父亲教我用第一道刻度量退水。你找回的第二道能在水压反冲前报信。明天我就教接班的人读它。',
      'My father taught me to read the receding water on the first mark. Your second mark warns us before the pressure surges. Tomorrow I’ll teach it to the next shift.']
    : ['父亲教我用第一道刻度量退水。第二道会在反冲前震响。我会把井铃接到汇水台。听见第一声就离开湿线。',
      'My father taught me to read the receding water on the first mark. The second rings before backflow. I’ll link the well bell to the forebay. Leave the wet line on the first ring.'],
  EGYPT_GAUGE_KEEPER);
}
function interactCulturalStory(id: string) {
  const theatre: [string, string] = ['纸影戏班', 'Shadow troupe'];
  const afterSiege = done.has(JOURNEY.orleansDone);
  function startShadowPlay(swallowtail: boolean) {
    if (!orleansShadowPlay) return;
    shadowPlayCue = { afterSiege, swallowtail };
    orleansShadowPlay.start(afterSiege, swallowtail);
    audio.bell();
    toast(bilingual('纸幕亮了。站在牵绳旁，看演员把旗传过去。', 'The paper screen lights up. Stay by the rope to watch the flag change hands.'));
  }
  if (id === SP.rope || id === SP.encore) {
    if (id === SP.encore) { startShadowPlay(done.has(SP.swallowtail)); return; }
    clearInput(); audio.interaction();
    narrative?.showChoices(['旗还没上杆。你想让哪个样式留在这出戏里？', 'The flag hasn’t gone up yet. Which design should we keep in the play?'], theatre,
      [{ id: 'pennant', label: ['金色尖旗', 'Gold pennant'] }, { id: 'swallowtail', label: ['蓝色燕尾旗', 'Blue swallowtail'] }], choice => {
        const m = markers.get(id);
        if (m && journeyMarkerActive(id) && !combat.defeated && player.pos.distanceTo(new THREE.Vector3(...m.p)) <= (m.radius ?? 2) && canReachValleyPanel(m)) {
          startShadowPlay(choice === 'swallowtail');
        }
      });
    return;
  }
  done.add(id); saveJourneyProgress();
  if (id === SP.discover) {
    speakDialogue(['守钟人把落幕绳借走了，演员只好拿擀面杖挑旗。绕到屏风另一侧，帮他们拉一次牵绳。',
      'The bell keeper borrowed the curtain cord, so the actors are holding up the flag with a rolling pin. Go around the screen and give their rope a pull.'], theatre);
  } else if (id === CE.turn) {
    speakDialogue(['转盘把歪脸朝里，背上露出两枚手印，一大一小。刻痕边上还有湿泥，陶工应该就在旁边。',
      'The stand turns the tilted face inward, revealing two handprints, one large and one small. The clay around them is damp. The potter must be nearby.'], ['窑场制俑台', 'Kiln worktable']);
  } else {
    qinPotterSpeaking = true; qinCrookedEffigy?.gesture();
    speakDialogue(done.has(JOURNEY.qinDone)
      ? ['她本来按着泥问我，守门的为什么不能笑。如今这尊放门外，谁路过都能看到她的手印。',
        'She pressed the clay and asked why a guard couldn’t smile. It’ll stand outside now, where everyone can see her handprint.']
      : ['小手印是我女儿的。她问守门的为什么不能笑，我只好先捏一个给她看。等门重开，就让这尊迎第一批客。',
        'The small handprint is my daughter’s. She asked why a guard couldn’t smile, so I made her one. When the gates reopen, this one can greet the first visitors.'],
    ['陶工路容', 'Lu Rong, potter']);
  }
}
function interactFieldSide(id: string) {
  if (id === RB.watch) {
    speakDialogue(['伊芙：“下一圈换我掌桨。你站在那儿，帮我看船有没有偏离木桩。”', 'Eve: “My turn to row next time. From there you can tell if I drift past the posts.”'],
      ['剑湖渡棚', 'Sword Lake ferry shelter']);
    return;
  }
  if (id === IB.test) {
    fieldSideSites?.ring(); audio.bell();
    toast(done.has(IB.camp)
      ? bilingual('渡口集合铃响了。', 'The landing muster bell rings.')
      : bilingual('雪路的定位铃响了。', 'The snow-road wayfinding bell rings.'));
    return;
  }
  if (id === VR.listen) {
    speakDialogue(done.has(JOURNEY.epilogue)
      ? ['归灯镇电台：回望桥换班结束，新外勤请在生活馆领单。', 'Lamplight Town Radio: Lookback Bridge has changed shifts. New fieldworkers, collect your slips at the residence.']
      : ['归灯镇电台：回望桥今晚有人值守。雾瀑下道湿滑，请从上道走。', 'Lamplight Town Radio: Lookback Bridge is staffed tonight. The lower Mist Falls path is slick. Please take the upper road.'],
    ['阿舟的电台', 'Azhou’s radio']);
    return;
  }
  if (id === ES.rack && !fieldSideSites?.seedsArrived()) {
    toast(bilingual('种罐还在上坡，等小车停稳。', 'The jars are still moving uphill. Wait for the cart to settle.'));
    return;
  }
  if (id === QR.supplies) {
    if (!worldProgress.armed || combat.refillAmmo(24) <= 0) {
      toast(bilingual('现在用不上，弹药留给下次。', 'The ammunition can stay here for next time.'));
      return;
    }
    done.add(id); saveJourneyProgress(); audio.explore('solve');
    toast(bilingual('从小室补给柜补充了弹药。', 'Replenished ammunition from the quiet room.'));
    return;
  }
  if (id === SM.medicine || id === OS.bowl) {
    const soup = id === OS.bowl;
    const healed = combat.state.fieldHeal(soup ? 23 : 40);
    if (healed <= 0) {
      toast(soup ? bilingual('生命值已满，这碗汤先留着。', 'Health is full. The bowl can wait.')
        : bilingual('生命值已满，备用药品留在柜里。', 'Health is full. The reserve stays in the cabinet.'));
      return;
    }
    done.add(id); saveJourneyProgress(); audio.explore('solve');
    toast(soup ? bilingual('喝完热汤，恢复了一些生命值。', 'The hot soup restores some health.')
      : bilingual('用了医疗柜的备用补给。', 'Used the medical cabinet’s reserve.'));
    return;
  }
  const step = FIELD_SIDE_STEPS.get(id);
  if (!step) return;
  if (id === VR.repeater || id === IB.choose) {
    clearInput();
    const radio = id === VR.repeater;
    const speaker: [string, string] = radio ? ['阿舟的试播单', 'Azhou’s test sheet'] : ['玛拉', 'Mara'];
    narrative?.showChoices(step.line, speaker, radio
      ? [{ id: 'early', label: ['回波提前半格', 'Return pulse half a tick early'] },
        { id: 'match', label: ['两个短脉冲完全重合', 'Both short pulses align'] },
        { id: 'late', label: ['回波拖后一格', 'Return pulse one tick late'] }]
      : [{ id: 'gorge', label: ['留在峡口，给雪路定位', 'Leave it in the gorge as a waypoint'] },
        { id: 'camp', label: ['送去渡口，召集两边居民', 'Take it to the landing for the muster'] }], choice => {
      const marker = markers.get(id);
      if (!marker || !journeyMarkerActive(id) || combat.defeated || !player.onGround || player.flying ||
          player.pos.distanceTo(new THREE.Vector3(...marker.p)) > (marker.radius ?? 2) || !canReachValleyPanel(marker)) return;
      if (radio && choice !== 'match') {
        toast(bilingual('回传仍有偏移，再对一次。', 'The return pulse is still offset. Try another bearing.'));
        return;
      }
      done.add(id);
      if (!radio && choice === 'camp') done.add(IB.camp);
      saveJourneyProgress(); audio.explore('solve');
      if (!radio) { fieldSideSites?.ring(); audio.bell(); }
      toast(radio ? bilingual('本地信号稳定了。回生活馆听阿舟试播。', 'The local signal is stable. Return to the residence for Azhou’s broadcast.')
        : choice === 'camp' ? bilingual('铃挂在渡口的新集合架上了。', 'The bell now hangs on the landing muster frame.')
          : bilingual('铃留在峡口，给雪路上的人指方向。', 'The bell stays at the gorge to guide people along the snow road.'));
    });
    return;
  }
  done.add(id);
  saveJourneyProgress();
  if (id === IB.raise || id === IB.hear) { fieldSideSites?.ring(); audio.bell(); }
  const title = id === SM.playback ? ['本地救援录音', 'Local rescue recording'] as [string, string]
    : step.label;
  const line: [string, string] = id === RB.shed && done.has('sun_core')
    ? ['誓印已经暗了。伊芙指着船底的裂纹：“现在能直接补，不用再搬船。”', 'The mark is dark. Eve points to the split in the hull. “We can patch it here now. No need to haul the boat.”']
    : step.line;
  speakDialogue(line, title);
}
function interactWorldJourney(id: string) {
  if (!journeyMarkerActive(id) || !player.onGround || player.flying || player.swimming || player.gliding || combat.defeated) return;
  if (FIELD_SIDE_STEPS.has(id) || FIELD_SERVICE_LABELS.has(id)) { interactFieldSide(id); return; }
  if (EGYPT_GAUGE_BY_ID.has(id)) { interactEgyptGauge(id as EgyptGaugeAction); return; }
  if (CULTURAL_STEPS.has(id)) { interactCulturalStory(id); return; }
  const realm = realmStationByMarker.get(id);
  if (realm) { operateRealmClimax(realm.region, realm.station); return; }
  if (id === F.nightPatrol) { startValleyNightPatrol(); return; }
  if (id === F.nightDone && !valleyFieldScene?.workerSafe()) {
    toast(bilingual('工人正在过桥，等他到达安全线。','The worker is crossing. Wait for him to reach the safe line.')); return;
  }
  if (id === F.drillDone && !valleyFieldScene?.drillReady()) {
    toast(bilingual('地面班组正在把两边带到广场。你也可以沿林线协助一处。','The crew is bringing both groups to the square. You can also help one along the forest route.')); return;
  }
  if (id === SKY_UP_LIFT || id === SKY_DOWN_LIFT) {
    const checkpoint = skyJourneySpawn();
    if (moveJourneyPlayer({ ...checkpoint, p: [...(id === SKY_UP_LIFT ? SKY_DOWN_LANDING : SKY_UP_LANDING)] })) spawn = checkpoint;
    return;
  }
  if (id === JOURNEY_DISPATCH) {
    clearInput();
    const options = journeyDestinations(done).map(destination => ({ id: destination.id, label: destination.name }));
    narrative?.showChoices(['选择出发方向。当地人的工作仍需你到现场完成。','Choose where to depart. The work still happens on the ground.'], ['观测所出发台','Observatory dispatch'], options, selected => {
      const destination = journeyDestinations(done).find(candidate => candidate.id === selected);
      const dispatch = markers.get(JOURNEY_DISPATCH), target = destination && markers.get(destination.marker);
      if (!dispatch || !target || player.pos.distanceTo(new THREE.Vector3(...dispatch.p)) > (dispatch.radius ?? 2) || !canReachValleyPanel(dispatch)) return;
      const blocked = getTravelSafetyBlock(travelContext());
      if (blocked) { toast(bilingual(...TRAVEL_BLOCK_TEXT[blocked])); return; }
      if (!moveJourneyPlayer({ ...target, type: 'spawn', p: [target.p[0], target.p[1] - .92, target.p[2]] })) {
        toast(bilingual('落点暂不可用，请重试或沿大陆道路前往。','The landing is unavailable. Retry or use the overland road.')); return;
      }
      renderObjective();
    });
    return;
  }
  if (id === JOURNEY.visitor && !worldJourneySites?.visitorArrived()) {
    toast(bilingual('访客正在过桥，在接应点等一下。','The visitor is crossing. Wait at the far side.')); return;
  }
  if (id === JOURNEY.egyptDone && !worldJourneySites?.ferryArrived()) {
    toast(bilingual('让试航船先驶过水尺，再登记通航。','Let the test ferry pass the gauge before registering the route.')); return;
  }
  if (id === JOURNEY.orleansDone && !worldJourneySites?.reliefArrived()) {
    toast(bilingual('接应队正在过桥。等他们到齐再登记。','The relief crew is crossing. Register the route once they arrive.')); return;
  }
  if (id === JOURNEY.qinHalt && !worldJourneySites?.workersArrived()) {
    toast(bilingual('让工匠先走出行进阵列，再下驻令。','Let the workers clear the marching ranks before giving the halt order.')); return;
  }
  if (id === JOURNEY.cargoSwitch && !worldJourneySites?.canSwitchCargo()) {
    toast(bilingual('货车已经过了道岔。沿轨道追到封存棚。','The cart has passed the switch. Follow the rails to the impound shed.')); return;
  }
  if (id === SKY_MARKERS.left || id === SKY_MARKERS.right) {
    const index = id === SKY_MARKERS.left ? 0 : 1;
    const shutter = skyCrown.root.getObjectByName(`SkyShutter_${index}`)!;
    const dx = Math.abs(player.pos.x - shutter.position.x), dz = Math.abs(player.pos.z - shutter.position.z);
    const next = !helionFight.shutters[index];
    if (next ? dx < .56 && dz < 4.45 : dz < .56 && dx < 4.45) {
      toast(bilingual('请离开遮板转动的轨迹。','Step out of the shutter’s swing.')); return;
    }
    helionFight.turn(index); audio.interaction(); return;
  }
  if (id === SKY_MARKERS.cache) {
    combat.refillAmmo(); combat.state.fieldHeal(100); audio.interaction();
    toast(bilingual('弹药与急救用品已补充。','Ammunition and first aid replenished.')); return;
  }
  if (id === SKY_MARKERS.westAmmo || id === SKY_MARKERS.eastAmmo) {
    const rounds = combat.refillAmmo(); audio.interaction();
    toast(rounds ? bilingual('维修箱已补充弹药。', 'The repair cache replenishes ammunition.') : bilingual('弹药已满。', 'Ammunition is full.')); return;
  }
  if (id === SKY_MARKERS.aid) {
    const ally = availableSkySupport();
    if (ally && helionFight.support(ally, player.pos)) { audio.explore('solve'); toast(bilingual(...SKY_SUPPORT[ally].line)); }
    return;
  }
  if (id === SKY_MARKERS.start) {
    if (combat.bossStarted || combat.storyEncounter || combat.defeated) return;
    crownRecoverySector = null; combat.refillAmmo();
    if (helionFight.start() && helionFight.phase === 0 && !done.has(JOURNEY.helionFirstWords)) {
      done.add(JOURNEY.helionFirstWords); saveJourneyProgress();
      toast(bilingual('赫利昂：“我已经失去过他们。不会再选一次。”', 'Helion: “I’ve lost them before. I won’t make that choice again.”'));
    }
    hudRevision++; return;
  }
  if (id === JOURNEY.launch || id === JOURNEY.returnHome) {
    if (!moveJourneyPlayer(id === JOURNEY.launch ? skyJourneySpawn() : journeyHomeSpawn())) {
      toast(bilingual('接驳落点有障碍，请重试。','The cradle landing is blocked. Try again.')); return;
    }
    if (id === JOURNEY.launch && done.has(id)) { renderObjective(); return; }
  }
  const line = commitJourneyStep(id, done);
  if (!line) return;
  if (id === JOURNEY.lake && !contract.recruited) contract.recruit();
  if (id === JOURNEY.skyReview || id === JOURNEY.isolate || id === JOURNEY.skyCourt) { spawn = skyJourneySpawn(); combat.refillAmmo(); }
  if (id === JOURNEY.skyAnchor) combat.refillAmmo(24);
  saveJourneyProgress();
  if (id === JOURNEY.lake || id === JOURNEY.epilogue) speakDialogue(line, id === JOURNEY.lake ? ['镜湖的约定','Mirror Lake pact'] : ['回望桥','Lookback Bridge']);
  else { toast(bilingual(...line)); audio.interaction(); }
}
function updateSkyJourney(dt: number, seconds: number) {
  const inSky = insideSkyCrown(player.pos);
  const playing = gameplayActive() && !combat.defeated;
  const atCrown = inSky && player.pos.y > SKY_CHECKPOINT[1] - 5 && player.pos.z < SKY_CHECKPOINT[2] + 6;
  if (helionFight.active && playing && !player.flying) {
    if (atCrown && player.onGround) {
      const east = player.pos.x >= SKY_CHECKPOINT[0];
      const far = player.pos.z < SKY_CHECKPOINT[2] - 30;
      crownRecoverySector = Number(east) + 2 * Number(far);
    } else if (crownRecoverySector !== null && player.pos.y <= SKY_CHECKPOINT[1] - 5) {
      const previousSpawn = spawn;
      if (moveJourneyPlayer({ ...previousSpawn, p: SKY_CROWN_RECOVERY[crownRecoverySector] })) {
        spawn = previousSpawn; helionFight.recoverFall();
        combat.state.applyFallDamage(combat.state.maxHp * .1);
        toast(bilingual('维护回收带把你送回同一侧。交战进度和弹药保留。', 'The maintenance catch returns you to the same side. Fight progress and ammunition are preserved.'));
        return;
      }
    }
  }
  if (!inSky && spawn.id === JOURNEY.launch && done.has(JOURNEY.launch) && !done.has(JOURNEY.returnHome) && !player.flying) {
    helionFight.reset(); moveJourneyPlayer(skyJourneySpawn());
    toast(bilingual('已返回最近的天穹检查点。','Returned to the last Sky Crown checkpoint.'));
  }
  skyCrown.updateApproach(inSky && playing ? dt : 0, player.pos, damage => combat.state.applyExternalDamage(damage));
  if (helionFight.active && !atCrown) helionFight.reset();
  if (atCrown && playing) helionFight.update(dt, player.pos);
  if (inSky || skyCrown.targets.some(target => target.visible)) skyCrown.update(helionFight, reducedEffects() ? 0 : seconds);
  helionHud.hidden = !inSky || !helionFight.active || !gameplayActive();
  if (helionHud.hidden) return;
  const phaseLabel = SKY_PHASE_LABELS[helionFight.phase];
  helionName.textContent = bilingual(`初号观测者 赫利昂 · ${phaseLabel[0]}`, `Helion, the First Observer · ${phaseLabel[1]}`);
  helionHealth.max = helionFight.maxTotalHp; helionHealth.value = helionFight.totalHp;
  helionTell.textContent = helionFight.beat === 'locked' ? bilingual('射界锁定 · 离开标线或转动遮板','Lane locked · Move clear or turn a shutter') : helionFight.vulnerable ? bilingual('核心暴露 · 射击','Core exposed · Shoot') : helionFight.phase === 1 ? bilingual('沿遮板之间推进 · 支架交替暴露','Advance between the shutters · emitters expose in turn') : bilingual('观测中 · 留意地面标线','Tracking · Watch the floor markers');
}
kingdomGateRuntime = createKingdomGateRuntime({
 done,save,changed:applyWorldState,supply:()=>{combat.refillAmmo();return combat.recoverAtSettlement(100);},damage:()=>relayDamageRevision,
 reachable:id=>{const m=markers.get(id);return !!m&&gameplayActive()&&player.onGround&&!player.flying&&!player.swimming&&!player.gliding&&!combat.defeated&&player.pos.distanceTo(new THREE.Vector3(...m.p))<(m.radius??3)&&canReachValleyPanel(m);},
 start:()=>{const result=combat.startStoryEncounter(gateEncounter(),{position:player.pos,playable:gameplayActive()&&player.onGround&&!player.flying&&!player.swimming&&!player.gliding&&!fortCannon.mounted});return {ok:result.ok,reason:FALSE_DAWN_START_HINTS[result.reason]};},
 cancel:()=>combat.cancelStoryEncounter(),encounter:()=>combat.storyEncounter?.id??null,
 toast:line=>toast(bilingual(...line)),
});
orleansWorksRuntime=createOrleansWorksRuntime({done,save,changed:applyWorldState,damage:()=>relayDamageRevision,
 reachable:id=>{const m=markers.get(id);return !!m&&gameplayActive()&&!combat.defeated&&player.onGround&&!player.flying&&!player.swimming&&!player.gliding&&player.pos.distanceTo(new THREE.Vector3(...m.p))<(m.radius??3)&&canReachValleyPanel(m);},
 toast:line=>toast(bilingual(...line)),ring:()=>{orleansWorksScene.ring();audio.bell();},sound:()=>audio.explore('solve'),
});
const orleansWorkHud=document.createElement('div');orleansWorkHud.id='orleans-work-progress';orleansWorkHud.className='hud';orleansWorkHud.hidden=true;
Object.assign(orleansWorkHud.style,{position:'fixed',left:'50%',bottom:'140px',transform:'translateX(-50%)',maxWidth:'min(580px,88vw)',padding:'10px 16px',border:'1px solid #c6b492',borderRadius:'8px',background:'#20313ce8',color:'#eee4ce',textAlign:'center',pointerEvents:'none'});document.body.append(orleansWorkHud);
addEventListener('pagehide',e=>{if(!e.persisted)orleansWorkHud.remove();});
compactRelayRuntime = createCompactRelayRuntime({
  done, reachable: compactRelayReachable,
  sessionValid: () => !bootFailed && !worldExited && !graphicsRecovery?.blocked && !combat.defeated
    && Math.hypot(player.pos.x-compactRelaySites.anchor[0],player.pos.z-compactRelaySites.anchor[2]) <= 30
    && Math.abs(player.pos.y-compactRelaySites.anchor[1]) <= 8,
  activeEncounter: () => combat.storyEncounter?.id ?? null,
  startEncounter: () => {
    if(!settings.bindingsFor('interact').some(binding=>!binding.startsWith('Wheel')))return{ok:false,reason:['此演练需要持续按住交互键；请在设置中给交互绑定一个键盘键或鼠标按钮，滚轮无法保持按住。','This exercise requires holding Interact. Bind a keyboard key or mouse button in Settings; a wheel impulse cannot be held.'] as [string,string]};
    const base = getCompactRelayEncounterSpec(compactRelaySites.anchor, compactRelaySites.enemySockets);
    const spec=adventureActive(done)?{...base,actors:base.actors.map((actor,i)=>({...actor,title:(i===0?['外联巡卫','Uplink Patrol']:['控制柜重卫','Cabinet Guard']) as [string,string]}))}:base;
    const playable=gameplayActive()&&!combat.defeated&&player.onGround&&!player.flying&&!player.swimming&&!player.gliding&&!fortCannon.mounted&&!actions?.skills.casting&&!actions?.melee.active&&!actions?.evade.active;
    const result=combat.startStoryEncounter(spec,{position:player.pos,playable});
    relayLastPosition.copy(player.pos);
    if(result.ok)spawn={id:'compact_relay_checkpoint',type:'spawn',p:[...compactRelaySites.entry],label:'庭院演练入口'};
    return {ok:result.ok,reason:FALSE_DAWN_START_HINTS[result.reason]};
  },
  cancelEncounter: () => { combat.cancelStoryEncounter(); }, save, applyState:applyWorldState,
  toast:line=>toast(bilingual(...line)),damageRevision:()=>relayDamageRevision,
  choices:(line,speaker,choices,select)=>{if(graphicsRecovery?.blocked||bootFailed||worldExited)return;clearInput();audio.interaction();narrative!.showChoices(line,speaker,choices,select);},
  deploy:()=>executeSafeTravel('compact_relay_outpost'),
});
const gateChannelHud=document.createElement('div');gateChannelHud.id='kingdom-gate-channel';Object.assign(gateChannelHud.style,{position:'fixed',left:'50%',bottom:'25%',transform:'translateX(-50%)',padding:'8px 14px',background:'#241f19e8',color:'#f4dfae',borderRadius:'6px',pointerEvents:'none'});gateChannelHud.hidden=true;document.body.append(gateChannelHud);
const relayChannelHud=document.createElement('div');relayChannelHud.id='compact-relay-channel';
Object.assign(relayChannelHud.style,{position:'fixed',left:'50%',bottom:'18%',transform:'translateX(-50%)',maxWidth:'440px',padding:'10px 14px',border:'1px solid #8aa7b8',borderRadius:'6px',background:'#12252ee8',color:'#edf6fa',textAlign:'center',pointerEvents:'none',zIndex:'8'});
const relayChannelText=document.createElement('div'),relayChannelBar=document.createElement('progress');relayChannelBar.max=3;relayChannelBar.value=0;relayChannelBar.style.width='100%';relayChannelHud.append(relayChannelText,relayChannelBar);relayChannelHud.hidden=true;document.body.append(relayChannelHud);
function renderCompactRelayHud(){
  const active=!!compactRelayRuntime?.active;relayChannelHud.hidden=!active||!gameplayActive();if(!active)return;
  const seconds=(compactRelayRuntime?.progress??0)*3;
  relayChannelText.textContent=seconds>0?bilingual(`接通 ${seconds.toFixed(1)} / 3.0 秒 · 保持站稳，停止攻击`,`Connecting ${seconds.toFixed(1)} / 3.0 s · Stand still; stop attacking`):bilingual(`借掩体突破 · 机柜旁按住 ${settings.label('interact')} 三秒 · 受伤/移动/攻击会打断`,`Use cover · Hold ${settings.label('interact')} at the cabinet for 3 s · Damage, movement or attacks interrupt`);
  relayChannelBar.value=seconds;relayChannelBar.setAttribute('aria-label',bilingual('中继接通进度','Relay connection progress'));
}
addEventListener('pagehide',event=>{if(!event.persisted)relayChannelHud.remove();});
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
  if(typeof homeTown!=='undefined'&&homeTown?.activities.carrying)return;
  if(residentEventRuntime?.carrying)return;
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
  // Fixtures that execute this function in isolation may provide a combat facade without state.
  const gun = combat.state?.gun ?? { range: WORLD_RIFLE.enemyRange, damage: WORLD_RIFLE.damage, pellets: 1, spread: 0 } as typeof combat.state.gun;
  const enemy = combat.raycast(origin,look,Math.min(gun.range,wallDist,questHit?.distance ?? 150));
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
    combat.damageEnemy(enemy.id, gun.damage);
  } else if (questHit && questHit.object.userData.needs === FORT_CANNON.marker) {
    toast(bilingual(`幽灵艇需要要塞炮：到炮位按 ${settings.label('interact')} 操作，再开火。`, 'Ghost boats need the fort cannon: interact at the station, then fire.'));
  } else if (questHit && questHit.object.userData.needs && !done.has(questHit.object.userData.needs as string)) {
    toast(bilingual('子弹打不了那么远 · 先去装填要塞大炮', 'Bullets cannot reach that far · Load the fort cannon first'));
  } else if (questHit && questHit.object.userData.nearWorld &&
    Math.hypot(player.pos.x - (questHit.object.userData.nearWorld as number[])[0], player.pos.z - (questHit.object.userData.nearWorld as number[])[1]) > (questHit.object.userData.nearR as number ?? 8)) {
    toast(bilingual('回到炮位，用大炮瞄准幽灵小艇', 'Return to the gun deck and aim the cannon at the ghost boats'));
  } else if (questHit) {
    const id = questHit.object.userData.target as string;
    if (typeof IB !== 'undefined' && id === IB.pin) {
      const hit = questHit.distance <= gun.range && fieldSideReady(id, done);
      if (hit) {
        done.add(id); saveJourneyProgress(); combat.flashHitMarker(.14);
        toast(bilingual('扣销断开，旧索松脱。沿河岸下到吊索旁。', 'The clevis breaks and the old line slackens. Follow the bank to the hoist.'));
      }
      combat.shot(muzzle, point, hit); audio.shot(); return;
    }
    if (typeof KW !== 'undefined' && id === KW.pin) {
      const hit = questHit.distance <= gun.range && advanceKingdomWorks(KW.pin);
      if (hit) combat.flashHitMarker(.14);
      combat.shot(muzzle, point, hit); audio.shot(); return;
    }
    const realm = questHit.object.userData.realmClimax as RealmClimaxId | undefined;
    if (realm) {
      const hit = typeof activeRealmClimax !== 'undefined' && activeRealmClimax?.id === realm && questHit.distance <= gun.range
        && activeRealmClimax.hit(questHit.object.userData.realmPhase, gun.damage);
      if (hit) combat.flashHitMarker(.14);
      combat.shot(muzzle, point, !!hit); audio.shot(); return;
    }
    if (typeof JOURNEY !== 'undefined' && (id === JOURNEY.lakePin || id === JOURNEY.cargoPin || id === JOURNEY.egyptTie || id === JOURNEY.orleansBrace || id === JOURNEY.eastLatch || id === JOURNEY.skyScan || id === SKY_MARKERS.target)) {
      const hit = id === SKY_MARKERS.target
        ? helionFight.hit(questHit.distance <= gun.range ? gun.damage : 0, questHit.object.userData.helionWeakPoint)
        : questHit.distance <= gun.range && commitJourneyStep(id, done);
      if (hit && id === JOURNEY.cargoPin) worldJourneySites?.saveCargoBrake(done);
      if (Array.isArray(hit)) { saveJourneyProgress(); toast(bilingual(...hit)); }
      if (hit) combat.flashHitMarker(.14);
      combat.shot(muzzle, point, !!hit); audio.shot(); return;
    }
    if (typeof VALLEY_PROLOGUE !== 'undefined' && id === VALLEY_PROLOGUE.pin) {
      if (advancePrologue(id)) combat.flashHitMarker(.14);
      combat.shot(muzzle, point, true); audio.shot(); return;
    }
    if(typeof homeTown!=='undefined'&&homeTown?.activities.hit(id)){combat.flashHitMarker(.14);combat.shot(muzzle,point,true);audio.shot();return;}
    if(adventureRuntime?.hit(id)){const fun=[...adventureSites.fun.values()].find(f=>f.ids.includes(id));if(fun&&fun.ids.every(flag=>done.has(flag)))toast(bilingual(...fun.line));combat.flashHitMarker(.14);combat.shot(muzzle,point,true);audio.shot();return;}
    if(id===KINGDOM_GATE.latch){kingdomGateRuntime?.unlock();combat.flashHitMarker(.14);combat.shot(muzzle,point,true);audio.shot();return;}
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
  // Shotgun: the remaining pellets fan out around the aim ray; each can hit an enemy or a wall.
  if (gun.pellets > 1 && !blockedMount) firePellets(origin, look, muzzle, gun);
}
const pelletDir = new THREE.Vector3(), pelletSide = new THREE.Vector3(), pelletUp = new THREE.Vector3();
function firePellets(origin: THREE.Vector3, look: THREE.Vector3, muzzle: THREE.Vector3, gun: typeof combat.state.gun) {
  pelletSide.crossVectors(look, THREE.Object3D.DEFAULT_UP).normalize(); pelletUp.crossVectors(pelletSide, look).normalize();
  for (let i = 1; i < gun.pellets; i++) {
    // Even ring plus jitter: a readable cone, never all pellets on one side.
    const a = (i / (gun.pellets - 1)) * Math.PI * 2 + Math.random() * .6, r = gun.spread * (.45 + Math.random() * .55);
    pelletDir.copy(look).addScaledVector(pelletSide, Math.cos(a) * r).addScaledVector(pelletUp, Math.sin(a) * r).normalize();
    const wall = combat.geometry.cast(origin, pelletDir, gun.range), reach = wall?.distance ?? gun.range;
    const hit = combat.raycast(origin, pelletDir, reach);
    const end = hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : wall ? wall.point.clone() : origin.clone().addScaledVector(pelletDir, reach);
    // The shoulder camera may see over cover that still hides the barrel. Check
    // each pellet's own muzzle path so a central obstruction doesn't erase clear side pellets.
    const path = end.clone().sub(muzzle);
    const blocked = combat.geometry.cast(muzzle, path, Math.max(0, path.length() - .06));
    if (hit && !blocked) combat.damageEnemy(hit.id, gun.damage);
    combat.shot(muzzle, blocked ? blocked.point : end, !!(blocked || hit || wall), false);
  }
}

// ───────────── interaction / discovery ─────────────
function nearestInteract(): Marker | null {
  let best: Marker | null = null, bd = Infinity;
  for (const m of layout.markers) {
    if (m.type !== 'interact') continue;
    if (m.id.startsWith('adventure_kyoto_witness_') && typeof kyotoWitnessActionReady === 'function' && !kyotoWitnessActionReady(m.id as KyotoWitnessAction, done)) continue;
    if (m.id.startsWith('adventure_harbor_relief_') && typeof harborReliefRequired === 'function' && (!harborReliefRequired(done) || done.has(m.id))) continue;
    const d = Math.hypot(player.pos.x - m.p[0], player.pos.y - m.p[1], player.pos.z - m.p[2]);
    if (typeof kingdomWorkMarkers !== 'undefined' && kingdomWorkMarkers.has(m.id)) {
      if (d < (m.radius ?? 3) && d < bd && kingdomWorkReady(m.id as KingdomWork, done) &&
          (m.id !== KW.patrol || combat.storyEncounter?.id !== KINGDOM_WATCH_ENCOUNTER) && canReachValleyPanel(m)) { bd = d; best = m; }
      continue;
    }
    if (typeof worldJourneyMarkerIds !== 'undefined' && worldJourneyMarkerIds.has(m.id)) {
      if (d < (m.radius ?? 3) && d < bd && journeyMarkerActive(m.id) && canReachValleyPanel(m)) { bd = d; best = m; }
      continue;
    }
    if (typeof valleyPrologueScene !== 'undefined' && valleyPrologueScene?.ownsMarker(m.id)) {
      if (d < (m.radius ?? 3) && d < bd && valleyPrologueScene.markerActive(m.id) && canReachValleyPanel(m)) { bd = d; best = m; }
      continue;
    }
    if (d < (m.radius ?? 3) && (d < bd || (adventureActive(done)&&residentEventMarkerIds.has(m.id)&&d<bd+.12)) && ((m.id !== VALLEY_STORY.discovery && !eraOptionalIds.has(m.id) && !campaignMarkerIds.has(m.id) && !falseDawnMarkerIds.has(m.id) && !compactRelayMarkerIds.has(m.id) && !kingdomGateMarkerIds.has(m.id) && !adventureMarkerIds.has(m.id) && !residentEventMarkerIds.has(m.id) && !parallaxMarkerIds.has(m.id) && !orleansWorksMarkerIds.has(m.id)) || canReachValleyPanel(m))) { bd = d; best = m; }
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
    if (typeof VALLEY_PROLOGUE !== 'undefined' && npc.id === VALLEY_PROLOGUE.steward && advancePrologue(npc.id)) return true;
    const homeLine=typeof homeTown!=='undefined'?homeTown?.residentLine(npc.id):null;if(homeLine){speakDialogue(homeLine,npc.role);return true;}
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
function startCurrentAdventure() {
  if (isKingdomGateOpen(done)) done.add(KINGDOM_GATE.open);
  done.add(ADVENTURE.started);
  done.add(JOURNEY_DRAMA.started);
}
function startPrologueMachines() {
  const marker = markers.get(VALLEY_PROLOGUE.survey);
  if (!marker || !worldProgress.armed || combat.storyEncounter || combat.bossStarted || done.has(VALLEY_PROLOGUE.machinesCleared)) return;
  const [x, y, z] = marker.p;
  const spec: StoryEncounterSpec = { id: VALLEY_RESCUE_ENCOUNTER, anchor: { x, y: y - VALLEY_SURVEY_HEIGHT, z }, actors: [] };
  const machines: Omit<StoryEncounterActor, 'offset'>[] = [
    { role: 'stalker', title: ['失控巡检机 · 切割臂', 'Damaged inspection unit · Cutting arm'] },
    { role: 'bombardier', title: ['失控巡检机 · 投射臂', 'Damaged inspection unit · Projector'] },
  ];
  const actors = selectStoryPositions(spec, machines, [[-7, -2], [7, -1], [-7, 6], [7, 6], [0, 9], [9, -2]]);
  if (actors.length !== machines.length) return;
  const result = combat.startStoryEncounter({ ...spec, actors }, { position: player.pos, playable: gameplayActive() && player.onGround });
  if (result.ok) spawn = { ...marker, type: 'spawn', p: [x, y - VALLEY_SURVEY_HEIGHT, z] };
}
function advancePrologue(id: string) {
  if (!valleyPrologueScene) return false;
  const P = VALLEY_PROLOGUE;
  if (id === P.record && !valleyPrologueScene.workerClear()) {
    toast(bilingual('等两名工人都走到围栏外。', 'Wait for both workers to clear the rail.'));
    return true;
  }
  const line = advanceValleyPrologue(valleyPrologueStage(done), id, done);
  if (!line) return false;
  if (id === P.survey) startPrologueMachines();
  if (id === P.record) {
    if (combat.storyEncounter?.id === VALLEY_RESCUE_ENCOUNTER) combat.cancelStoryEncounter();
    startCurrentAdventure();
  }
  const saved = save();
  applyWorldState();
  if (id === P.steward || id === P.cartStop || id === P.cartReturn) {
    const speaker: [string, string] = id === P.steward ? ['孟槐', 'Meng Huai'] : ['阿舟', 'Azhou'];
    settlementNpcs.gesture(id === P.steward ? P.steward : P.apprentice);
    speakDialogue(line, speaker);
  } else if (id === P.radio) {
    speakDialogue(line, ['外勤电台', 'Field radio']);
  } else {
    if (id !== P.pin) audio.interaction();
    toast(bilingual(...line));
  }
  if (!saved) toast(bilingual('本次进度未能保存，请在设置里重试。', 'Progress could not be saved. Retry in Settings.'));
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
  if (!result.dialogue || graphicsRecovery?.blocked || bootFailed || worldExited) return true;
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
  const scene=journeyScene(id,done);
  if(scene){
    settlementNpcs.gesture(id);clearInput();hudRevision++;audio.interaction();
    narrative!.showChoices(scene.text,scene.speaker,scene.choices,choice=>{
      if(!campaignInteractionReachable(id)){toast(bilingual('请回到人物身边再继续。','Return to the character to continue.'));return;}
      if(choice==='personal'){presentCampaignInteraction(interactCampaignEpisode(id,done),id);return;}
      if(confirmJourneyScene(scene,choice,done)){const saved=save();applyWorldState();if(scene.beat==='decision'&&done.has(ADVENTURE.ending))speakDialogue(journeyEnding(done),['旅途记录','Journey record']);else toast(saved?bilingual('旅途记录已更新。','Journey record updated.'):bilingual('记录尚未保存，请重试或备份。','Record not saved; retry or back up.'));}
    });
    return true;
  }
  const residentRegion=(['alpha','britain','blacksail','winter','kyoto'] as const).find(region=>id===`campaign_${region}_work`);
  if(residentRegion&&adventureActive(done)){const field=getResidentWorkGuide(residentRegion,done);if(field){campaignTrackedRegion=residentRegion;questTrackedId=null;falseDawnTracked=false;guideOn=true;toast(bilingual(...field.text));return true;}}
  const result = interactCampaignEpisode(id, done);
  if (result.handled) settlementNpcs.gesture(id);
  return presentCampaignInteraction(result, id);
}
function parallaxReachable(id: string) {
  const marker=markers.get(id);
  return !!marker && locked && !bootFailed && !worldExited && !graphicsRecovery?.blocked && !settingsPanel.open && !travelOpenState && !campaignJournalOpen && !ultimateDirector?.active && document.visibilityState==='visible' && document.hasFocus() && !combat.defeated && player.onGround && !player.flying && !player.swimming && !player.gliding && player.pos.distanceTo(new THREE.Vector3(...marker.p))<(marker.radius??3) && canReachValleyPanel(marker);
}
function interactParallax(id: string) {
  if(!parallaxReachable(id))return;
  if(done.has(PARALLAX.started)&&!done.has(PARALLAX.complete)&&!done.has(PARALLAX.experiment)){beginParallaxExperiment(done);save();applyWorldState();}
  if(id===PARALLAX.board){
    if(done.has(PARALLAX.complete)&&!done.has(PARALLAX.experiment)){
      clearInput();narrative!.showChoices(['观测记录已保存。要重新调节装置，做一次新试验吗？已获得的涂装会保留。','The record is saved. Try the instruments again? Your earned finish is kept.'],PARALLAX.title,[{id:'replay',label:['重新试验','Experiment again']},{id:'record',label:['阅读已完成记录','Read the saved record']}],choice=>{if(!parallaxReachable(PARALLAX.board))return;if(choice==='replay'){beginParallaxExperiment(done);save();applyWorldState();speakDialogue(PARALLAX_INTRO,PARALLAX.title);}else speakDialogue(PARALLAX_ENDING,PARALLAX.title);});return;
    }
    if(!done.has(PARALLAX.started)){beginParallaxExperiment(done);save();applyWorldState();questTrackedId=PARALLAX.quest;campaignTrackedRegion=null;falseDawnTracked=false;optionalPin=null;guideOn=true;speakDialogue(PARALLAX_INTRO,PARALLAX.title);return;}
    if(!done.has(PARALLAX.experiment)){beginParallaxExperiment(done);save();applyWorldState();}
    if(!done.has(PARALLAX.front)||!done.has(PARALLAX.side)){speakDialogue(PARALLAX_INTRO,PARALLAX.title);return;}
    clearInput();hudRevision++;
    narrative!.showChoices(['两次观察留下了不同的轮廓。你要如何修正“庭院只剩一枚环”的记录？','The two views show different silhouettes. How will you revise “only one ring remains”?'],PARALLAX.title,[
      {id:'perspective',label:['两枚环都还在，只是正面视线重叠。','Both rings remain; they overlap from the front.']},
      {id:'vanished',label:['第二枚环在观察时才重新出现。','The second ring reappeared while I was watching.']},
      {id:'later',label:['先不下结论，再换个位置看看。','Take another look before deciding.']},
    ],choice=>{
      if(!parallaxReachable(PARALLAX.board)){toast(bilingual('请回到记录板前再确认。','Return to the record board to confirm.'));return;}
      if(concludeParallax(choice,done)){save();applyWorldState();audio.interaction();speakDialogue(PARALLAX_ENDING,PARALLAX.title);}
      else if(choice==='vanished')speakDialogue(['你已亲手转动装置，又从两个位置验证过。同一枚环能呈现几种轮廓？观察记录保留，可以再判断。','You adjusted the rings and tested two viewpoints. How many outlines can one ring show? Your observations are kept; try again.'],PARALLAX.title);
    });
    return;
  }
  if(id===PARALLAX.near||id===PARALLAX.far){if(turnParallaxRing(done,id===PARALLAX.near?'near':'far')){save();applyWorldState();audio.interaction();toast(bilingual('手轮已转动一格。看一看哪个轮廓变了；调节后请重新记录。','Wheel turned one notch. Watch the changing outline; take fresh observations after adjustment.'));}else toast(bilingual('先到记录板开始试验。','Start an experiment at the board first.'));return;}
  if(!done.has(PARALLAX.started)){toast(bilingual('先读旁边的观测记录板，了解这次观察。','Read the nearby record board before beginning.'));return;}
  if(done.has(PARALLAX.experiment)&&!parallaxAligned(done)){toast(bilingual('还未获得圆形正面读数。试着调节两个手轮，观察哪枚环呈窄椭圆。','The fronts are not circular yet. Turn the wheels and watch which ring appears narrow.'));return;}
  const station=id===PARALLAX.front?parallaxGarden.front:parallaxGarden.side;
  const target=new THREE.Vector3(...parallaxGarden.subject),direction=target.clone().sub(camera.position),distance=direction.length();
  const clear=!combat.geometry.cast(camera.position,direction,Math.max(0,distance-.2));
  const frame={feet:player.pos.toArray() as [number,number,number],eye:camera.position.toArray() as [number,number,number],direction:camera.getWorldDirection(new THREE.Vector3()).toArray() as [number,number,number],grounded:player.onGround,playable:gameplayActive(),clear};
  if(recordParallaxView(id,done,frame,station,parallaxGarden.subject)){save();applyWorldState();audio.interaction();toast(id===PARALLAX.front?bilingual('正面已记录：轮廓相互重叠。到右侧菱形脚印再看看。','Front recorded: overlapping silhouettes. Try the diamond footprint on the right.'):(done.has(PARALLAX.front)?bilingual('侧面已记录：两枚环前后错开。回记录板对照两次观察。','Side recorded: two rings at different depths. Compare your observations at the board.'):bilingual('侧面已记录：两枚环前后错开。再到圆形脚印记录正面视角。','Side recorded: two rings at different depths. Record the front view at the round footprint next.')));}
  else toast(done.has(id)?bilingual('这个视角已经记录。可以继续观察，或跟随指引前往下一处。','This view is already recorded. Look again, or follow the guide to the next step.'):bilingual('站进脚印内并看向双环，将它们置于画面中央后再按交互。无需瞄准或射击。','Stand inside the footprint, center the rings, then interact. No aiming or shooting required.'));
}
function interactQinLift() {
  if(!player.onGround||player.flying||player.swimming||player.gliding)return;
  const to=qinLift.operate();
  if(!to){toast(bilingual('升降台正在起落。','The cage is already moving.'));return;}
  audio.interaction();
  toast(to==='bottom'?bilingual('绞盘松开，升降台沉入竖井，落向军阵中轴。','The winch pays out; the cage sinks down the shaft toward the garrison avenue.'):bilingual('绞盘收紧，升降台升向山脊井架。','The winch hauls in; the cage rises toward the ridge headframe.'));
}
function interactQinOrder() {
  if(!player.onGround||player.flying||player.swimming||player.gliding)return;
  if(qinArmyOrder.turning){toast(bilingual('阵列仍在转动。','The ranks are still turning.'));return;}
  if(qinTurnBlocked(player.pos)){toast(bilingual('有人站在转台上：离开兵俑转台和铜闸下方后再下令。','Someone is on a turntable: step clear of the ranks and the bronze gate first.'));return;}
  const phase=toggleQinOrder(done);const crushed=qinSentinels.orderTurned(done);
  if (typeof JOURNEY !== 'undefined' && phase === 'b') commitJourneyStep(JOURNEY.qinTurn, done);
  save();applyWorldState();audio.interaction();
  if(crushed.length)setTimeout(()=>toast(bilingual(`转动的兵俑阵碾碎了 ${crushed.length} 尊守陵俑。`,`The turning ranks ground down ${crushed.length} tomb guardian${crushed.length>1?'s':''}.`)),1600);
  toast(phase==='b'?bilingual('军令：让道阵。西列兵俑转为横向让出通道，斜井铜闸升起；东列合拢封路。','Order: open ranks. The west row turns aside and the shaft gate rises; the east row closes.'):bilingual('军令：守陵阵。西列兵俑合拢封路，斜井铜闸落下；东列转向让出通道。','Order: guard ranks. The west row closes, the shaft gate falls, and the east row turns aside.'));
}
function interact() {
  const m = nearestInteract();
  if (!m) return;
  if (typeof kingdomWorkMarkers !== 'undefined' && kingdomWorkMarkers.has(m.id)) {
    if (player.onGround && !player.flying && !combat.defeated) advanceKingdomWorks(m.id as KingdomWork);
    return;
  }
  if (typeof worldJourneyMarkerIds !== 'undefined' && worldJourneyMarkerIds.has(m.id)) { interactWorldJourney(m.id); return; }
  if (typeof valleyPrologueScene !== 'undefined' && valleyPrologueScene?.ownsMarker(m.id)) { advancePrologue(m.id); return; }
  const claim = modelClaimPoints.find(point => point.marker.id === m.id);
  if (claim) {
    // Claim markers sit at foot level. Aim the visibility ray above the ground,
    // just as nearby residents do, and never fall through to generic activation.
    const reachable = canReachValleyPanel({ ...m, p: [m.p[0], m.p[1] + 1.2, m.p[2]] });
    if (!reachable) { toast(bilingual('请走近领取点，避开中间的障碍。', 'Move closer to the claim point with a clear path.')); return; }
    if (!contract.has(claim.id)) {
      contract.recruit(claim.marker.id);
      saveJourneyProgress();
    } else contract.select(claim.id);
    const loading = modelCompanion.state === 'failed' ? modelCompanion.retry() : modelCompanion.select(claim.id);
    void loading.then(() => {
      if (!contract.isFollowing(claim.id) || modelCompanion.selected !== claim.id) return;
      if (modelCompanion.state === 'ready') {
        audio.interaction();
        toast(bilingual(`${m.label}：已领取`, `${localizeText(m.label)}: claimed`));
      } else toast(bilingual('从者加载失败，请再次交互重试。', 'Servant failed to load. Interact again to retry.'));
      servantPanel.render();
    });
    return;
  }
  if(typeof homeTown!=='undefined'&&homeTown?.interact(m.id))return;
  if(orleansWorksMarkerIds.has(m.id)){if(!settings.bindingsFor('interact').some(b=>!b.startsWith('Wheel'))){toast(bilingual('请为交互绑定一个可按住的键盘键或鼠标按钮。','Bind Interact to a keyboard key or mouse button that can be held.'));return;}orleansWorksRuntime?.interact(m.id);return;}
  if(parallaxMarkerIds.has(m.id)){interactParallax(m.id);return;}
  if(typeof qinOrderMarkerIds!=="undefined"&&qinOrderMarkerIds.has(m.id)){interactQinOrder();return;}
  if(typeof qinLiftMarkerIds!=="undefined"&&qinLiftMarkerIds.has(m.id)){interactQinLift();return;}
  if(typeof egyptMirrorMarkerIds!=="undefined"&&egyptMirrorMarkerIds.has(m.id)){if(!player.onGround||player.flying)return;turnEgyptMirror(done,m.id);save();applyWorldState();audio.interaction();toast(egyptMirrors.lit?bilingual('日光沿着铜镜一路照进了圣所。','The light now runs mirror to mirror into the sanctuary.'):bilingual('铜镜转了一格。看光束落在哪里。','The mirror turns a quarter. Watch where the beam falls.'));return;}
  if (typeof exploration !== 'undefined' && exploration.owns(m.id)) { exploration.interact(m.id); return; }
  if(residentEventMarkerIds.has(m.id)){residentEventRuntime?.interact(m.id);return;}
  if(adventureMarkerIds.has(m.id)){
    if(adventureSites.actions.get(m.id)?.seconds&&!settings.bindingsFor('interact').some(b=>!b.startsWith('Wheel'))){toast(bilingual('请在设置中把交互绑定到可按住的键盘键或鼠标按钮。','Bind Interact to a keyboard key or mouse button that can be held.'));return;}
    const publicBell = typeof KYOTO_WITNESS !== 'undefined' && m.id === KYOTO_WITNESS.public && !done.has(m.id);
    adventureRuntime?.interact(m.id);
    if (publicBell && done.has(m.id)) audio.bell();
    return;
  }
  if (kingdomGateMarkerIds.has(m.id)) {
    if(m.id===KINGDOM_GATE.winch&&!settings.bindingsFor('interact').some(binding=>!binding.startsWith('Wheel'))){toast(bilingual('绞盘需要按住交互键：请在设置中绑定键盘键或鼠标按钮。','The winch requires holding Interact: bind a keyboard key or mouse button in Settings.'));return;}
    kingdomGateRuntime?.interact(m.id); return;
  }
  if (compactRelayMarkerIds.has(m.id)) { compactRelayRuntime?.interact(m.id); return; }
  if (falseDawnMarkerIds.has(m.id)) { falseDawnRuntime?.interact(m.id); return; }
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
    if (typeof coop !== 'undefined' && coop.guest && !combat.bossStarted) return toast(bilingual('联机时由房主发起首领战，靠近首领场地即可一起加入。', 'In co-op the host starts boss fights; stay near the arena to join.'));
    if (!combat.beginBoss(m.id)) toast(bilingual('挑战正在进行 · 射击核心并闪避预警', 'Challenge active · Shoot the core and dodge the tells'));
    return;
  }
  const prologueArming = m.id === ARMORY_MARKER && typeof VALLEY_PROLOGUE !== 'undefined' && done.has(VALLEY_PROLOGUE.briefed) && !done.has(VALLEY_PROLOGUE.record);
  if (m.id === ARMORY_MARKER && typeof valleyPrologueStage === 'function' && typeof valleyPrologueScene !== 'undefined' && valleyPrologueScene) {
    const stage = valleyPrologueStage(done);
    if (stage === 'room' || stage === 'briefing' || stage === 'cart' || stage === 'workshop') {
      toast(bilingual('先完成外勤准备，再来领枪。','Finish your field preparations before taking the rifle.')); return;
    }
  }
  if(m.id===ARMORY_MARKER&&!prologueArming&&!done.has('summon_circle')&&!done.has('tower_console')&&!(['britain','blacksail','winter','kyoto'] as const).some(r=>done.has(`era_${r}_met`))) startCurrentAdventure();
  done.add(m.id);
  if (m.id === FORT_CANNON.marker) { actions?.cancel(); fortCannon.toggle(player.pos, true); }
  if (m.id === ARMORY_MARKER) {
    // Offer the compact combat loop immediately; the original route remains one key away.
    questTrackedId=prologueArming||adventureActive(done)?null:'main:compact-relay'; campaignTrackedRegion=null; falseDawnTracked=false; optionalPin=null; guideOn=true;
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
  if (prologueArming) return speakDialogue([
    `步枪和短刃已领取。${settings.label('fire')} 射击，${settings.label('melee')} 近战，${settings.label('evade')} 闪避。从工坊西门出去，绕到北侧收听外勤电台。`,
    `Rifle and blade issued. ${settings.label('fire')} fires, ${settings.label('melee')} strikes, ${settings.label('evade')} dodges. Leave by the west door and round the north side to the field radio.`,
  ], ['枪械工坊', 'Armory']);
  if(m.id===ARMORY_MARKER&&adventureActive(done))return speakDialogue([
    `步枪与短刃已领取。${settings.label('fire')} 射击 · ${settings.label('melee')} 近战连击 · ${settings.label('evade')} 闪避。六发连射后会散热；随身弹药 90 发，打空只能近战，击倒敌人、开宝箱、回据点都能补给；远距离威力降低，重卫收势时更容易被反击。\n先到工坊西侧服务庭院，接通最低外联。正面与维修侧路都能抵达机柜；完成后沿西路去圣剑湖。`,
    `Rifle and blade acquired. ${settings.label('fire')} Fire · ${settings.label('melee')} Melee combo · ${settings.label('evade')} Evade. Six rounds trigger a vent; you carry 90 rounds and must melee when empty (kills, chests and settlements resupply); range reduces damage, and heavy guards are vulnerable during recovery.\nRestore the minimum uplink in the service yard west of the workshop. Take front cover or the maintenance flank, then head west to Sword Lake.`,
  ],['求援讯号','The distress signal']);
  if (m.id === ARMORY_MARKER) return speakDialogue([
    `步枪与短刃已领取。连射6发后会短暂散热，停火也能冷却。\n${settings.label('fire')} 射击 · ${settings.label('melee')} 近战连击 · ${settings.label('evade')} 闪避。靶场就在前方。想直接实战，可从西门走约35米到北侧服务庭院的训练入口。已为你追踪；按 ${settings.label('mainRoute')} 可返回原主线。`,
    `Rifle and blade acquired. Six continuous shots trigger a short automatic vent; resting the trigger also cools the rifle.\n${settings.label('fire')} Fire · ${settings.label('melee')} Melee combo · ${settings.label('evade')} Evade. The range is just ahead. For immediate combat, leave by the west door and walk about 35 m to the service-yard training entrance. It is now tracked; ${settings.label('mainRoute')} restores the original story route.`,
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
let conversationBlend=0;

// screenshot / fixed-camera mode: ?cam=x,y,z,yawDeg,pitchDeg&clean
const camParam = params.get('cam')?.split(',').map(Number);
if (camParam) { player.flying = true; player.teleport(camParam[0], camParam[1] - PLAYER.eye, camParam[2], THREE.MathUtils.degToRad(camParam[3] ?? 0)); player.pitch = THREE.MathUtils.degToRad(camParam[4] ?? 0); }
if (params.has('clean')) {document.body.classList.add('clean');languageToggle.style.display='none';}
if (params.has('nofog')) scene.fog = null;
if (params.has('lit')) done.add('tower_console');
camera.fov = baseFov; camera.updateProjectionMatrix();
applyWorldState();

let perfectEvadeSlow = 0, hitStop = 0;
/** This player's pose for the co-op partner's screen. */
function coopWireState(speed: number, ads: number): PlayerWireState {
  const melee = actions?.melee.active ? [actions.melee.phase, actions.melee.combo, actions.melee.style?.id ?? equippedMeleeId] as [number, number, WorldMeleeId] : undefined;
  const armed = worldProgress.armed && !residentEventRuntime?.carrying;
  return { p: [player.pos.x, player.pos.y, player.pos.z], f: anim.facing, v: speed, g: player.onGround ? 1 : 0, sw: player.swimming ? 1 : 0, gl: player.gliding ? 1 : 0,
    a: ads, pi: player.pitch, fi: armed && down('fire') && !actions?.melee.active ? 1 : 0, ar: armed ? 1 : 0, ...(melee ? { m: melee } : {}),
    gun: equippedGunId, mel: equippedMeleeId, hp: combat.state.hp, max: combat.state.maxHp };
}
function frame(now: number) {
  regionVisuals.update(player.pos,camera.position,lowQ?.7:1);const visualRegion=regionAt(player.pos.x,player.pos.z).id;
  streamStatus.hidden=regionVisuals.ready(visualRegion);if(!streamStatus.hidden){streamFailure=regionVisuals.diagnostics.failed.includes(visualRegion)?visualRegion:'';streamRetry.hidden=!streamFailure;streamText.textContent=streamFailure?bilingual('前方地区画面加载失败，点击重试。','Region art failed to load. Click to retry.'):bilingual('正在载入前方地区…','Loading the region ahead…');}
  if (worldExited || bootFailed) return;
  if (graphicsRecovery?.blocked) { last = now; acc = 0; requestAnimationFrame(frame); return; }
  // Some browsers change DPR on monitor moves without a CSS resize event.
  if (observedDeviceDpr !== devicePixelRatio) {
    observedDeviceDpr = devicePixelRatio;
    adaptiveResolution.reset();
    dpr = targetDpr(devicePixelRatio, resolution, lowQ); applyResolution();
  }
  // Paused wall time is not visible simulation time, even if RAF never ran while hidden.
  const frameSeconds = frameClockInvalid ? 0 : (now - last) / 1000;
  if (frameClockInvalid) { acc = 0; frameClockInvalid = false; }
  // A perfect evade slows the whole world for half a real second.
  const slowed = perfectEvadeSlow > 0 && gameplayActive();
  perfectEvadeSlow = Math.max(0, perfectEvadeSlow - Math.min(0.1, frameSeconds));
  // Hit-stop: a landed blade or skill nearly freezes the world for a few hundredths of a second.
  const stopped = hitStop > 0 && gameplayActive();
  hitStop = Math.max(0, hitStop - Math.min(0.1, frameSeconds));
  const dt = Math.min(0.1, frameSeconds) * (slowed ? PERFECT_EVADE.slowScale : 1) * (stopped ? HIT_STOP.scale : 1);
  last = now;
  if (frameUltimate(dt)) { requestAnimationFrame(frame); return; }
  if (deferredCombatToast && gameplayActive()) { const message = deferredCombatToast; deferredCombatToast = null; toast(message); }
  acc += dt;
  if(dragLook&&gameplayActive()){player.yaw+=(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt*1.5;player.pitch=THREE.MathUtils.clamp(player.pitch+(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*dt,-1.5,1.5);}
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

  const canAim = worldProgress.armed && !residentEventRuntime?.carrying && (typeof homeTown==='undefined'||!homeTown?.activities.carrying) && gameplayActive() && !player.swimming && !player.gliding && !player.flying;
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
  anim.update(dt, { speed: Math.min(hs, 12), onGround: player.onGround, swimming: player.swimming, vy: player.vel.y, moveYaw: ads > 0.05 ? player.yaw + Math.PI : wx || wz ? Math.atan2(wx, wz) : null, gliding: player.gliding, carrying:residentEventRuntime?.carrying??(typeof homeTown!=='undefined'&&homeTown?.activities.carrying?'blanket':undefined), armed: worldProgress.armed&&!residentEventRuntime?.carrying&&(typeof homeTown==='undefined'||!homeTown?.activities.carrying), aim: ads, pitch: player.pitch, firing: worldProgress.armed && down('fire') && !actions?.melee.active && !(actions?.skills.casting && actions.skills.selected === null), lookYaw: player.yaw + Math.PI, melee: actions?.melee.active ? { phase: actions.melee.phase, combo: actions.melee.combo, yaw: actions.melee.yaw, style: actions.melee.style?.id } : undefined });
  coop.update(dt, camera, gameplayActive() || coop.session.paired ? coopWireState(Math.min(hs, 12), ads) : null, player.pos, now, gameplayActive() && !player.flying);
  if (thirdPerson) {
    // over-the-shoulder spring arm that pulls in when terrain/walls are in the way
    const look = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const pivot = new THREE.Vector3(player.pos.x + rx * 0.45, player.pos.y + 1.55, player.pos.z + rz * 0.45);
    // keep the pivot under any ceiling (gallery floors, arches) so the arm never starts inside geometry
    const up = combat.geometry.cast({x:player.pos.x,y:player.pos.y+1,z:player.pos.z},{x:0,y:1,z:0},.85);
    if (up && up.distance < 0.85) pivot.y = Math.max(player.pos.y + 0.9, up.point.y - 0.3);
    // The shoulder offset itself must not start on the other side of a nearby wall.
    const origin = new THREE.Vector3(player.pos.x, pivot.y, player.pos.z);
    const side = pivot.clone().sub(origin), sideLength = side.length();
    const sideHit = combat.geometry.cast(origin,side.clone().normalize(),sideLength+.15);
    if (sideHit && sideHit.distance < sideLength + 0.15) pivot.copy(origin).addScaledVector(side.normalize(), Math.max(0, sideHit.distance - 0.15));
    const back = look.clone().negate();
    const hit = combat.geometry.cast(pivot,back,5.6);
    const want = shoulderArmLength(ads, player.gliding, hit?.distance);
    camDist = want < camDist ? want : THREE.MathUtils.damp(camDist, want, 6, dt);
    camera.position.copy(pivot).addScaledVector(back, camDist);
    eye.copy(camera.position);
  } else camera.position.copy(eye);
  // Heavy contacts nudge the view for a few frames (weight, not shake): a damped two-axis wobble.
  if (cameraKick > 0) {
    const t = performance.now() / 1000, k = cameraKick * cameraKick;
    camera.position.addScaledVector(camRight.set(rx, 0, rz), Math.sin(t * 61) * k * .05).y += Math.sin(t * 47 + 1.3) * k * .06;
    cameraKick = Math.max(0, cameraKick - dt * 5);
  }
  // Full-body servant viewer: slow orbit in front of the active companion.
  const viewRoot = inspectServant ? servantRoot() : undefined;
  if (viewRoot?.visible) {
    const big = contract.selected === 'napoleon', angle = viewRoot.rotation.y + performance.now() / 4000;
    const focus = viewRoot.position.clone().add(new THREE.Vector3(0, big ? 1.3 : .95, 0));
    camera.position.copy(focus).add(new THREE.Vector3(Math.sin(angle) * (big ? 5.5 : 3.6), .35, Math.cos(angle) * (big ? 5.5 : 3.6)));
    camera.lookAt(focus);
  } else inspectServant = false;
  // Character scenes get a readable, collision-checked portrait shot. Leaving
  // dialogue restores the ordinary aim camera before gameplay can fire again.
  const conversationNpc=dramaActive(done)&&narrative?.open&&locked&&!inspectServant?nearbySettlementNpc():null;
  const conversationActor=conversationNpc?settlementNpcs.group.getObjectByName(`Resident_${conversationNpc.id}`):null;
  if(conversationActor){
    const focus=conversationActor.getObjectByName('ResidentHead')!.getWorldPosition(new THREE.Vector3());
    const orientation=conversationActor.getWorldQuaternion(new THREE.Quaternion()),front=new THREE.Vector3(0,0,1).applyQuaternion(orientation),right=new THREE.Vector3(1,0,0).applyQuaternion(orientation);
    const desired=focus.clone().addScaledVector(front,1.8).addScaledVector(right,.36);desired.y+=.035;
    const direction=desired.clone().sub(focus),distance=direction.length(),hit=combat.geometry.cast(focus,direction.clone().normalize(),distance);
    const allowed=hit?Math.max(0,hit.distance-.22):distance;
    if(allowed>.8){rig.root.visible=false;desired.copy(focus).addScaledVector(direction.normalize(),Math.min(distance,allowed));conversationBlend=reducedEffects()?1:THREE.MathUtils.damp(conversationBlend,1,7,dt);camera.position.lerp(desired,conversationBlend);const target=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position,focus,camera.up));camera.quaternion.slerp(target,conversationBlend);eye.copy(camera.position);}else conversationBlend=0;
  }else conversationBlend=0;
  combat.present(dt, player.pos, gameplayActive() && !player.flying, camera);
  if (worldJourneySites?.update(gameplayActive() ? dt : 0, player.pos)) {
    done.add(JOURNEY.cargoParked); saveJourneyProgress();
    toast(bilingual('货车已停稳。取回返程信标。','The cart has stopped. Recover the return beacon.'));
  }
  updateSkyJourney(dt, now / 1000);
  valleyFieldScene?.update(gameplayActive() ? dt : 0, player.pos);
  updateRealmClimax(dt);
  // Drain authoritative hurt/victory events before deciding a channel completion.
  compactRelayRuntime?.update({dt,held:down('interact'),playable:gameplayActive()&&!ultimateDirector?.active,inRange:compactRelayReachable(COMPACT_RELAY.controller),grounded:player.onGround&&!player.flying&&!player.gliding&&!player.swimming,moving:!!(input.x||input.z||input.jump)||relayLastPosition.distanceToSquared(player.pos)>.0004,attacking:down('fire')||!!(actions?.skills.casting||actions?.melee.active||actions?.evade.active)});
  relayLastPosition.copy(player.pos);
  compactRelaySites.applyState({active:compactRelayRuntime?.active??false,complete:done.has(COMPACT_RELAY.complete),progress:compactRelayRuntime?.progress??0});
  const elite = gameplayActive() && !combat.defeated && !combat.bossStarted ? nearbyElite(combat.state.enemies, player.pos) : null;
  $('elite-hint').textContent = elite ? bilingual(`附近精英：${elite.name[0]} · ${elite.direction[0]} · ${Math.round(elite.distance)} 米`, `Nearby elite: ${elite.name[1]} · ${elite.direction[1]} · ${Math.round(elite.distance)} m`) : '';
  if (down('fire')) shoot();
  homeTown?.update(dt,player.pos,gameplayActive(),regionVisuals.ready('home'));
  servant.update(dt, player.pos, anim.facing - Math.PI, companionEnabled(), !gameplayActive());
  cavalrySupport?.update(dt,gameplayActive()&&!combat.defeated);
  updateEraActors(dt);
  modelCompanion.update(dt, player.pos, anim.facing - Math.PI, !!modelCompanion.selected && contract.isFollowing(modelCompanion.selected) && companionEnabled(), !gameplayActive());
  actions?.flush(); actions?.present(dt); blade.update(!!actions?.melee.active);
  if (hudBudget.due(now, {active: true, revision: hudRevision})) { renderContract(); actionHud.update(actions!, gameplayActive() && !inspectServant); updateTrackedStoryHud(); renderCompactRelayHud(); }
  settlements.update(player.pos);
  settlementApproaches.update(player.pos);
  const escortPoint=gateEscortPosition(kingdomGateRuntime?.escort??0);
  const escortSafe=player.pos.distanceTo(escortPoint)<14&&!combat.state.enemies.some(e=>e.active&&!e.pacified&&e.hp>0&&Math.hypot(e.p.x-escortPoint.x,e.p.z-escortPoint.z)<10);
  kingdomGateRuntime?.update({dt,held:down('interact'),playable:gameplayActive()&&!combat.defeated&&!ultimateDirector?.active,inRange:nearestInteract()?.id===KINGDOM_GATE.winch,grounded:player.onGround&&!player.flying&&!player.swimming&&!player.gliding,moving:hs>.15||!!(input.x||input.z||input.jump),attacking:down('fire')||!!(actions?.skills.casting||actions?.melee.active||actions?.evade.active)},escortSafe,fraction=>{
   const next=gateEscortPosition(fraction),direction=next.clone().sub(escortPoint);
   // Ground and body clearance are checked along the actual passage, never teleport across a wall.
   const floor=staticBVH.raycastFirst(new THREE.Ray(next.clone().add(new THREE.Vector3(0,2,0)),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);
   if(!floor||Math.abs(floor.point.y-next.y)>.6)return false;
   for(const dx of[-.7,.7])if(combat.geometry.cast(escortPoint.clone().add(new THREE.Vector3(dx,1,0)),direction,direction.length()+.35))return false;
   return true;
  });
  kingdomGateScene.apply(done,kingdomGateRuntime?.escort??0,dt,player.pos);
  orleansWorksRuntime?.update({dt,held:down('interact'),playable:gameplayActive()&&!combat.defeated&&!ultimateDirector?.active,inRange:nearestInteract()?.id===orleansWorksRuntime?.active,grounded:player.onGround&&!player.flying&&!player.swimming&&!player.gliding,moving:hs>.15||!!(input.x||input.z||input.jump),attacking:down('fire')||!!(actions?.skills.casting||actions?.melee.active||actions?.evade.active)});
  orleansWorksScene.apply(done,orleansWorksRuntime?.active,orleansWorksRuntime?.progress);orleansWorksScene.update(gameplayActive()?dt:0,player.pos);
  const working=ORLEANS_WORK_ACTIONS.find(a=>a.id===orleansWorksRuntime?.active);orleansWorkHud.hidden=!working||!gameplayActive();
  if(working){const release=orleansWorksRuntime?.requiresRelease;orleansWorkHud.textContent=bilingual(`${working.label[0]} ${Math.round((orleansWorksRuntime?.progress??0)*100)}% · ${release?'松开，再按住':'按住'} ${settings.label('interact')}`,`${working.label[1]} ${Math.round((orleansWorksRuntime?.progress??0)*100)}% · ${release?'Release, then hold':'Hold'} ${settings.label('interact')}`);}
  gateChannelHud.hidden=!gameplayActive()||player.pos.distanceTo(escortPoint)>25||done.has(KINGDOM_GATE.rescued)||!done.has(KINGDOM_GATE.unlocked);
  gateChannelHud.textContent=done.has(KINGDOM_GATE.open)?bilingual(`居民行进 ${Math.round((kingdomGateRuntime?.escort??0)*100)}% · ${escortSafe?'陪同穿门':'等待：靠近居民并解除附近威胁'}`,`Residents ${Math.round((kingdomGateRuntime?.escort??0)*100)}% · ${escortSafe?'Escorting':'Waiting: stay close and clear nearby threats'}`):bilingual(`绞盘 ${Math.round((kingdomGateRuntime?.progress??0)*100)}% · 站稳，松开后按住 ${settings.label('interact')}`,`Winch ${Math.round((kingdomGateRuntime?.progress??0)*100)}% · Stand still, release then hold ${settings.label('interact')}`);
  const activeAdventure=adventureRuntime?.channel;
  adventureRuntime?.update({dt,held:down('interact'),playable:gameplayActive()&&!combat.defeated&&!ultimateDirector?.active,inRange:!!activeAdventure&&nearestInteract()?.id===activeAdventure.id,grounded:player.onGround&&!player.flying&&!player.swimming&&!player.gliding,moving:hs>.15||!!(input.x||input.z||input.jump),attacking:down('fire')||!!(actions?.skills.casting||actions?.melee.active||actions?.evade.active)});
  adventureSites.apply(done,gameplayActive()?dt:0,adventureRuntime?.cartPosition,adventureRuntime?.departureProgress,adventureRuntime?.reliefProgress);
  kingdomWorksScene?.apply(done, gameplayActive() ? dt : 0);
  const fieldRegion=regionAt(player.pos.x,player.pos.z).id;
  const campaignField=isCampaignRegion(fieldRegion);
  exploration.update(gameplayActive()?dt:0,player,campaignField?fieldRegion:'alpha',campaignField&&gameplayActive()&&!combat.defeated);
  ambientLife.update(gameplayActive()?dt:0,player.pos,fieldRegion,regionVisuals.ready(fieldRegion));
  fieldHerbs.update(gameplayActive()?dt:0,player.pos,campaignField?fieldRegion:'alpha',campaignField&&gameplayActive()&&!combat.defeated);
  if(typeof fieldAmmo==='function')fieldAmmo();
  flagshipInterior.apply(done,now/1000);
  if(activeAdventure&&gameplayActive()){gateChannelHud.hidden=false;gateChannelHud.textContent=bilingual(`${activeAdventure.label[0]} ${Math.round((adventureRuntime?.progress??0)*100)}%`,`${activeAdventure.label[1]} ${Math.round((adventureRuntime?.progress??0)*100)}%`);}
  residentEventRuntime?.update(player.pos,player.gliding,gameplayActive()&&!combat.defeated);
  residentEventScene.apply(done,player.pos,now/1000,residentEventRuntime?.carrying??null,residentEventRuntime?.dial??0);
  if(residentEventRuntime?.carrying){rig.root.updateMatrixWorld(true);const left=rig.handSockets.L.getWorldPosition(new THREE.Vector3()),right=rig.handSockets.R.getWorldPosition(new THREE.Vector3());residentEventScene.carried.position.copy(left).add(right).multiplyScalar(.5).add(new THREE.Vector3(0,residentEventRuntime.carrying==='page'?.012:.07,0));rig.root.getWorldQuaternion(residentEventScene.carried.quaternion);}
  if(homeTown?.activities.carrying){rig.root.updateMatrixWorld(true);const left=rig.handSockets.L.getWorldPosition(new THREE.Vector3()),right=rig.handSockets.R.getWorldPosition(new THREE.Vector3());homeTown.activities.carried.position.copy(left).add(right).multiplyScalar(.5);rig.root.getWorldQuaternion(homeTown.activities.carried.quaternion);}
  campaignSites.update(player.pos);
  falseDawnSites.update(player.pos);
  compactRelaySites.update(player.pos);
  for (const site of eraStoryScenes) site.updateVisibility(player.pos);
  settlementNpcs.setSpeaking(narrative?.open?nearbySettlementNpc()?.id??null:null);
  settlementNpcs.update(gameplayActive() || narrative?.open ? dt : 0, player.pos);
  if (valleyPrologueScene?.update(gameplayActive() ? dt : 0, settlementNpcs.pose, player.pos)) {
    done.add(VALLEY_PROLOGUE.firstSafe); saveJourneyProgress();
    toast(bilingual('07 已把陈芮带出危险区，顾桥还在等出口。', '07 gets Chen Rui to safety. Gu Qiao is still waiting for the exit.'));
  }
  if(typeof qinArmyOrder!=='undefined')qinArmyOrder.update(dt);
  if(typeof qinAtmosphere!=='undefined')qinAtmosphere.update(dt,player.pos);
  if (!narrative?.open) { gaugeKeeperSpeaking = false; qinPotterSpeaking = false; }
  qinCrookedEffigy?.update(done, gameplayActive() || narrative?.open ? dt : 0, player.pos, qinPotterSpeaking);
  if (orleansShadowPlay?.update(done, gameplayActive() && !combat.defeated ? dt : 0, player.pos) && shadowPlayCue) {
    const { afterSiege, swallowtail } = shadowPlayCue;
    shadowPlayCue = null;
    done.add(SP.rope);
    if (afterSiege) done.add(SP.encore);
    if (swallowtail) done.add(SP.swallowtail);
    saveJourneyProgress();
    speakDialogue(afterSiege
      ? ['这一幕改成了两个人接旗。工兵和船工都来看了，我们得给他们留个座。',
        'This time two people carry the flag. The engineers and ferrymen came to watch. We should save them a seat.']
      : ['擀面杖终于退场了。我们把你的旗样留在幕边。等河桥通了，再来看下一出。',
        'The rolling pin can retire. We’ll keep your flag beside the screen. Come see our next play when the bridge reopens.'],
    ['纸影戏班', 'Shadow troupe']);
  }
  egyptGaugeScene?.apply(done, gameplayActive() || narrative?.open ? dt : 0, player.pos, gaugeKeeperSpeaking);
  fieldSideSites?.apply(done, gameplayActive() || narrative?.open ? dt : 0, player.pos);
  if(typeof egyptAtmosphere!=='undefined')egyptAtmosphere.update(dt,player.pos);
  orleansAtmosphere.update(dt,player.pos);orleansOutskirts.update(dt,player.pos);
  if(typeof qinLift!=='undefined')qinLift.update(dt,player.pos);
  if(typeof egyptMirrors!=='undefined'&&egyptMirrors.update(dt,done)){done.add(EGYPT_MIRRORS.solved);save();applyWorldState();toast(bilingual('日轮被照亮，圣所后壁的石门缓缓沉下，斜道通向台地深处。','The sun disc blazes; the stone door behind it sinks, opening an incline into the plateau.'));}
  if(typeof qinSentinels!=='undefined'&&gameplayActive()&&!player.flying){const back=qinSentinels.update(dt,player.pos,done);if(back){player.teleport(back[0],back[1]+.1,back[2],player.yaw);toast(bilingual('守陵俑把你逐回了入口。把它引到转台边，再转动军令。','A tomb guardian drives you back to the entrance. Lure it beside a turntable, then turn the order.'));}}
  orleansResidentLife.update(gameplayActive()||narrative?.open?dt:0,player.pos,narrative?.open?nearbySettlementNpc()?.id??null:null,regionVisuals.ready('orleans'));
  qinResidentLife.update(gameplayActive()||narrative?.open?dt:0,player.pos,narrative?.open?nearbySettlementNpc()?.id??null:null,regionVisuals.ready('qin'));
  egyptResidentLife.update(gameplayActive()||narrative?.open?dt:0,player.pos,narrative?.open?nearbySettlementNpc()?.id??null:null,regionVisuals.ready('egypt'));
  homeResidentLife.update(dt,player.pos,narrative?.open?nearbySettlementNpc()?.id??null:null,gameplayActive()||!!narrative?.open,regionVisuals.ready('home'));
  sky.position.copy(eye);
  twilight.update(dt, player.pos.x, done.has('sun_core') && !done.has(KW.recall), done.has('sea_core'), player.pos.z, done.has('winter_core'), done.has('fire_core'),
    done.has(F.nightStart) && !done.has(F.nightDone), done.has(KW.bell));
  matchServantLighting();
  updateCold(dt);
  // Shadow frame snaps to whole shadow texels in light space: walking no longer makes every
  // shadow edge crawl. Shadows refresh every other frame below high quality (static art barely
  // moves; characters' shadows trail by one frame), which halves the shadow pass.
  snapShadowCenter(eye, twilight.direction, shadowCenter);
  sun.position.copy(shadowCenter).addScaledVector(twilight.direction, 200);
  sun.target.position.copy(shadowCenter);
  shadowTick = (shadowTick + 1) % 2;
  renderer.shadowMap.needsUpdate = highQ || shadowTick === 0 || shadowCenter.distanceToSquared(lastShadowCenter) > 4;
  if (renderer.shadowMap.needsUpdate) lastShadowCenter.copy(shadowCenter);

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
  let interactionPrompt = fortCannon.mounted ? bilingual(`[${settings.label('fire')}] 炮击 · ${fortCannon.reload > 0 ? `装填 ${fortCannon.reload.toFixed(1)} 秒` : '就绪'} · [${settings.label('interact')}] 离开炮位`, `[${settings.label('fire')}] Cannon · ${fortCannon.reload > 0 ? `Reload ${fortCannon.reload.toFixed(1)}s` : 'Ready'} · [${settings.label('interact')}] Leave`) : npcPrompt ? bilingual(`[${settings.label('interact')}] 与${nearbyNpc.role[0]}交谈`, `[${settings.label('interact')}] Talk to ${nearbyNpc.role[1]}`) :
    !gameplayActive() ? '' : !player.flying && it && (!done.has(it.id) || worldJourneyMarkerIds.has(it.id) || modelClaimPoints.some(point => point.marker.id === it.id) || parallaxMarkerIds.has(it.id) || eraOptionalIds.has(it.id) || it.id === FORT_CANNON.marker || (it.id === CAMPAIGN_CLOSURE.terminal && !!getCampaignClosureGuide('alpha',done)) || BOSSES.some(b => b.core === it.id)) ?
      `[${settings.label('interact')}] ${done.has(it.id) && BOSSES.some(b => b.core === it.id) ? bilingual('再次挑战 Boss（不重复领取首通奖励）', 'Rechallenge Boss (no repeat first-clear reward)') : interactionLabel(it)}` :
    player.inUpdraft && player.onGround ? bilingual(`[${settings.label('jump')}] 跳入上升气流`, `[${settings.label('jump')}] Jump into the updraft`) : '';

  // Match the existing Interact admission, rather than advertising an action
  // which a jump/glide/swim correctly cannot perform. No admission changes.
  if (interactionPrompt && gameplayActive() && !fortCannon.mounted && !player.flying &&
      (!player.onGround || player.gliding || player.swimming) && (npcPrompt || it)) {
    interactionPrompt = bilingual('请在稳固地面站定后交互', 'Stand on solid ground to interact') + ' · ' +
      (npcPrompt ? bilingual(...nearbyNpc.role) : interactionLabel(it!));
  }
  if(orleansWorksRuntime?.active)interactionPrompt='';
  const prompt = $('prompt');
  if (prompt.textContent !== interactionPrompt) prompt.textContent = interactionPrompt;

  const nowRegion = regionAt(player.pos.x, player.pos.z).id;
  if (nowRegion !== lastRegion) { lastRegion = nowRegion; renderObjective(); }
  culler.update(eye, lowQ ? 0.7 : 1);
  // A teleport or travel re-sweeps every prop at once instead of popping in over a few frames.
  farProps.update(eye, lowQ ? 0.7 : 1, eye.distanceToSquared(lastFarEye) > 900 ? 1 : 8); lastFarEye.copy(eye);
  const nextDpr = adaptiveResolution.sample(frameSeconds, dpr, targetDpr(devicePixelRatio, resolution, lowQ),
    resolution === 'adaptive' && !params.has('shot') && document.visibilityState === 'visible' && document.hasFocus());
  if (nextDpr !== dpr) { dpr = nextDpr; applyResolution(); }
  const tgt = guideOn ? guideTarget() : null;
  updateGuide(tgt, now);
  const mt: [number, number] | null = tgt ? [tgt.p[0], tgt.p[2]] : null;
  if (mapBudget.due(now, { active: true, revision: hudRevision })) {
    map.draw(mini, player.pos, player.yaw, { full: false, done, found, target: mt, partner: coop.partnerPoint });
    if ($('bigmap').classList.contains('open')) map.draw(big, player.pos, player.yaw, { full: true, done, found, target: mt, partner: coop.partnerPoint, overlay: (ctx, project, unit, width) => drawExplorationIcons(ctx, done, project, unit, width, exploration.commissions) });
  } // big map stays readable: no monster dots

  timeUniform.value = now / 1000;
  localLights.update(camera.position, dt);
  localLights.yieldSlots(lightCensus.active(camera));
  if (composer && !lowQ) shafts.update(camera, twilight.direction);
  grass?.update(camera.position);
  ambient?.update(camera.position, regionAt(player.pos.x, player.pos.z).id, dt, renderer.domElement.height);
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
suspendForGraphics = () => {
  dragLook=false;locked=false;
  abortUltimate(); clearInput(); falseDawnRuntime?.invalidate(); compactRelayRuntime?.invalidate(); kingdomGateRuntime?.reset(); adventureRuntime?.reset(); cavalrySupport?.reset(); residentEventRuntime?.reset(); progressPanel.cancelPendingRead();
  // Preserve pause-menu intent, but invalidate detached pre-loss controls.
  travelPanel.refresh(); arenaTrainingPanel.hide(); campaignJournal?.refresh(); questJournal?.refresh(); audio.setActive(false);
  if (document.pointerLockElement) document.exitPointerLock();
  renderLoading(); start.classList.remove('hidden');
  $('settings-open').classList.remove('hidden'); languageToggle.hidden = false;
};
if (graphicsRecovery?.blocked) suspendForGraphics();
// Small authored props outside the chunked art (exploration caches, hubs, story sets, residents)
// stop drawing once they are a few fogged pixels away. Region art keeps its own chunk culler.
for (const child of world.children) if (child.name && child.name !== 'Group' && !child.name.startsWith('Streamed_')) farProps.add(child);
for (const child of scene.children) if (/^(EraStory_|ValleyStory_|SettlementResidents$|FieldHerbs$|Updrafts$)/.test(child.name)) farProps.add(child);
// Every material already in the world (hidden effect pools included) compiles in parallel while the
// start menu is up, instead of on the frame it first appears.
warmShaders(scene)?.catch(() => undefined);
requestAnimationFrame(frame);
const ground = (x: number, z: number) =>
  staticBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide)?.point.y ?? 0;
// debug/test hook
worldInterface.ready();
(window as any).__world = { homeTown, arsenal: { equip: equipGun, cycle: cycleEquippedGun, get equipped() { return equippedGunId; }, get art() { return rifle; }, equipMelee, get melee() { return equippedMeleeId; }, get meleeArt() { return blade; } }, exploration, parallaxGarden, qinArmyOrder, qinAtmosphere, qinLift, qinSentinels, egyptMirrors, egyptAtmosphere, orleansOutskirts, orleansAtmosphere, ambientLife, fieldHerbs, orleansResidentLife, qinResidentLife, egyptResidentLife, orleansWorksScene,orleansWorksRuntime,settlementNpcs, grid, THREE, renderer, graphicsRecovery, rig, anim, aim, settings, settingsPanel, thirdPerson, player, scene, camera, layout, done, found, colliders, ground, contract, servant, combat, coop, actions, ultimateDirector, ultimateStage, travelStops, travelPanel, executeSafeTravel, audio, eraStoryScenes, campaignSites, campaignJournal, narrative, falseDawnSites, falseDawnRuntime, compactRelaySites, compactRelayRuntime, regionVisuals, cavalrySupport, residentEventRuntime, residentEventScene, flagshipInterior, adventureSites, adventureRuntime, kingdomGateScene, kingdomGateRuntime, localLights, consumedSourceReceipt, worldProgress, weaponFinishStore, weaponFinishControl, rifle, blade, valleyStory: { state: () => getValleyStoryState(done), scene: valleyStoryScene }, ready: true };
}

void boot().catch((error: unknown) => {
  if (worldExited) { disposeRenderer(); return; }
  bootFailed = true; graphicsRecovery?.dispose();
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
