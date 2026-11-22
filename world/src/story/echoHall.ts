import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { REGIONS, regionToWorld } from '../map/regions';
import { ECHO_DESTINATIONS, echoMarkerId, echoMarkerRegion } from './echoDestinations';
import { buildEchoWaypost } from '../environment/echoWaypost';
import type { SafeTravelStop } from './safeTravel';
import { buildEchoStationArt } from '../environment/echoStationArt';
import { SiteArt } from './campaignSites';
import type { WorldRegionId } from '../core/regionIdentity';
import {homeWorld} from '../map/homePlan';
import type {Marker} from '../core/types';
import type {Collider} from '../player/player';
import type {Localized} from '../settlements/types';
import type {CompanionId} from '../companions/contracts';
import type {createNarrativePanel} from '../ui/narrativePanel';

/** The hall and field stations share a same-tab trip to their regional Arena lobby. */
export const ECHO_HALL_ID = echoMarkerId('home');
/** Hall centre (Homeward local), facing west onto the practice court, clear of the shooting lane to the north. */
export const ECHO_HALL_CENTRE: [number, number, number] = [ECHO_DESTINATIONS.home.x, 16, ECHO_DESTINATIONS.home.z];
const YAW = ECHO_DESTINATIONS.home.yaw;
/** Where the interaction is offered and where a returning player stands: on the steps, facing the hall. */
export const ECHO_HALL_STEPS: [number, number, number] = [84.6, 17, -100];
export const ECHO_RETURN_KEY = 'parhelion.world.returnTo';
/** World companion ids → Arena hero ids. */
export const ARENA_HERO: Record<CompanionId, string> = { saber: 'saber', blackbeard: 'blackbeard', napoleon: 'napoleon', musashi: 'musashi', jeanne: 'jeanne', ozymandias: 'ozymandias', qinShiHuang: 'qin' };

export function echoHallHref(hero: CompanionId | null, region: WorldRegionId = 'home'): string {
  const q = new URLSearchParams({ mode: 'offline', from: 'world', map: ECHO_DESTINATIONS[region].map });
  if (hero && ARENA_HERO[hero]) q.set('hero', ARENA_HERO[hero]);
  return `/arena/?${q}`;
}

type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const tabStorage = (): TabStorage | null => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };
/** Remember (for this tab only) the station the player left through. */
export function markEchoDeparture(storage: TabStorage | null = tabStorage(), region: WorldRegionId = 'home') { try { storage?.setItem(ECHO_RETURN_KEY, echoMarkerId(region)); } catch { /* private mode: the player simply starts at the usual spawn */ } }
/** Consume the station note only as a return destination for an Arena visit. */
export function takeEchoReturn(params: URLSearchParams, storage: TabStorage | null = tabStorage()): WorldRegionId | undefined {
  try {
    const noted = storage?.getItem(ECHO_RETURN_KEY);
    if (noted) storage?.removeItem(ECHO_RETURN_KEY);
    return params.get('from') === 'arena' ? echoMarkerRegion(noted ?? null) : undefined;
  } catch { return undefined; }
}

export interface EchoHallHost {
  scene: THREE.Scene;
  wayposts?: { stops: readonly SafeTravelStop[]; footing(x: number, z: number, y: number): number | null };
  dialogue: ReturnType<typeof createNarrativePanel>;
  prepareDialogue(): void;
  canInteract(id: string): boolean;
  safe(): boolean;
  toast(line: Localized): void;
  /** The servant the player has chosen (following or not), or null before any contract. */
  servant(): CompanionId | null;
  servantName(id: CompanionId): Localized;
  /** Ground height (world coordinates), or null where unknown. */
  ground(x: number, z: number): number | null;
  /** Save the World; false when it could not be saved (then the player stays). */
  save(): boolean;
  navigate(href: string): void;
}

export function createEchoHall(host: EchoHallHost) {
  const root = new THREE.Group(); root.name = 'EchoHall';
  const centre = new THREE.Vector3(...homeWorld(ECHO_HALL_CENTRE));
  centre.y = host.ground(centre.x, centre.z) ?? centre.y;
  root.position.copy(centre); root.rotation.y = YAW; host.scene.add(root);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
  const material = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra }); materials.push(m); return m; };
  const stone = material(0xb9b2a4), dark = material(0x4e5961), brass = material(0xc9a35d, { metalness: .5, roughness: .45 }), rune = material(0x7fd8ee, { emissive: 0x2a9fc4, emissiveIntensity: 1.1, roughness: .4 });
  const solid: THREE.BufferGeometry[] = [];
  const box = (name: string, size: [number, number, number], at: [number, number, number], m: THREE.Material, collide = false) => {
    const g = new THREE.BoxGeometry(...size); geometries.push(g);
    const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    if (collide) { mesh.updateWorldMatrix(true, false); solid.push(g.clone().applyMatrix4(new THREE.Matrix4().compose(centre, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, YAW, 0)), new THREE.Vector3(1, 1, 1)).multiply(mesh.matrix))); }
    return mesh;
  };
  // Stone dais with two steps, four pillars, a lintel and a shallow roof: an open pavilion you walk into.
  box('EchoHallDais', [9, .5, 7], [0, .25, 0], stone, true);
  box('EchoHallStep', [9, .25, 1], [0, .125, 4], stone, true);
  for (const x of [-3.8, 3.8]) for (const z of [-2.8, 2.8]) box('EchoHallPillar', [.55, 4.2, .55], [x, 2.6, z], stone, true);
  box('EchoHallLintel', [9, .5, .7], [0, 4.85, 2.8], dark);
  box('EchoHallLintelBack', [9, .5, .7], [0, 4.85, -2.8], dark);
  const pavilion = new SiteArt();
  const copper = '#537773', timber = '#564a41', gold = '#be9963';
  // Standing-seam copper over timber trusses, with an open gable above the sign.
  for (const side of [-1, 1]) {
    const tilt = side * .29;
    pavilion.box([0, 5.84, side * 2.0], [10.2,.17,4.25], copper, false, 'metal', [tilt,0,0]);
    for (let x = -4.8; x <= 4.81; x += .8)
      pavilion.box([x,5.95,side*2.0],[.045,.07,4.24], '#799690', false, 'metal', [tilt,0,0]);
    for (const x of [-3.8, 0, 3.8])
      pavilion.beam([x,6.35,0],[x,5.13,side*4],.19,timber);
    for (const z of [-2.8,2.8]) {
      pavilion.box([side*3.8,.69,z],[.83,.35,.83],'#827e72');
      pavilion.box([side*3.8,4.57,z],[.85,.27,.84],gold,false,'metal');
      pavilion.beam([side*3.8,3.7,z],[side*2.86,4.73,z],.19,timber);
    }
    pavilion.beam([side*2.86,4.65,2.80],[side*2.86,3.74,2.80],.036,gold);
    pavilion.lantern(side*2.86,3.39,2.80);
  }
  pavilion.box([0,6.49,0],[10.45,.13,.19],gold,false,'metal');
  pavilion.ring([0,7.22,0],.70,.085,gold);
  pavilion.ring([0,7.22,0],.67,.045,'#8ccbc9','metal',[0,1.0,.32]);
  pavilion.finish('home'); root.add(pavilion.root);
  // The simulation ring on the floor: a slowly turning disc of light where the echoes fight.
  const ringGeometry = new THREE.RingGeometry(1.4, 2.1, 48); geometries.push(ringGeometry);
  const ring = new THREE.Mesh(ringGeometry, rune); ring.rotation.x = -Math.PI / 2; ring.position.y = .52; ring.name = 'EchoHallRing'; root.add(ring);
  const coreGeometry = new THREE.CircleGeometry(.9, 32); geometries.push(coreGeometry);
  const core = new THREE.Mesh(coreGeometry, rune); core.rotation.x = -Math.PI / 2; core.position.y = .53; root.add(core);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box('EchoHallRune', [.16, .03, .6], [Math.cos(a) * 2.6, .52, Math.sin(a) * 2.6], brass).rotation.y = -a; }
  // Sign over the entrance, readable from the court.
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext?.('2d');
  if (canvas && ctx) {
    canvas.width = 512; canvas.height = 128; ctx.fillStyle = '#28414c'; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = '#f3e5c8'; ctx.textAlign = 'center';
    ctx.font = '40px sans-serif'; ctx.fillText('英灵演武场', 256, 58); ctx.font = '24px sans-serif'; ctx.fillText('ECHO HALL · ARENA', 256, 98);
    const texture = new THREE.CanvasTexture(canvas); textures.push(texture);
    const signGeometry = new THREE.PlaneGeometry(4.2, 1.05); geometries.push(signGeometry);
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); materials.push(signMaterial);
    const sign = new THREE.Mesh(signGeometry, signMaterial); sign.position.set(0, 4.25, 3.17); sign.name = 'EchoHallSign'; root.add(sign);
  }
  const merged = solid.length ? mergeGeometries(solid) : null; solid.forEach(g => g.dispose());
  const colliders: Collider[] = merged ? [{ name: 'EchoHall', enabled: true, bvh: new MeshBVH(merged) }] : [];
  if (merged) geometries.push(merged);

  const steps = new THREE.Vector3(...homeWorld(ECHO_HALL_STEPS)); steps.y = (host.ground(steps.x, steps.z) ?? steps.y - 1) + 1;
  const markers: Marker[] = [{ id: ECHO_HALL_ID, type: 'interact', label: '英灵演武场', p: [steps.x, steps.y, steps.z], radius: 3.2 }];
  const stations = [pavilion];
  const poses = new Map<WorldRegionId, {p: THREE.Vector3; yaw: number}>([['home', {p: steps, yaw: YAW}]]);
  for (const def of REGIONS) {
    if (def.id === 'home') continue;
    const destination = ECHO_DESTINATIONS[def.id];
    const [x,z] = regionToWorld(def, destination.x, destination.z);
    const yaw = destination.yaw + (def.rotated ? Math.PI : 0);
    const y = host.ground(x,z);
    if (y === null) continue;
    const art = buildEchoStationArt(def.id);
    art.relocate(new THREE.Matrix4().makeRotationY(yaw).setPosition(x,y,z));
    host.scene.add(art.root); stations.push(art);
    const body = mergeGeometries(art.solids);
    for (const part of art.solids.splice(0)) part.dispose();
    if (body) {
      geometries.push(body);
      colliders.push({name: art.root.name, enabled: true, bvh: new MeshBVH(body)});
    }
    const frontX = x + 2.15 * Math.sin(yaw), frontZ = z + 2.15 * Math.cos(yaw);
    const p = new THREE.Vector3(frontX, (host.ground(frontX, frontZ) ?? y) + .85, frontZ);
    poses.set(def.id, {p, yaw});
    markers.push({id: echoMarkerId(def.id), type:'interact', label: destination.title[0]+'演武台', p:p.toArray(), radius:2.5});
  }
  if (host.wayposts) {
    for (const stop of host.wayposts.stops) {
      const pose = poses.get(stop.region);
      if (stop.requiredCompletionFlag || !pose) continue;
      const [cx,cy,cz] = stop.position;
      // Keep the arrival capsule and the direct route to the station clear.
      const bearing = Math.atan2(pose.p.x-cx,pose.p.z-cz);
      for (const offset of [Math.PI/2,-Math.PI/2,Math.PI*.75,-Math.PI*.75,Math.PI]) {
        const x=cx+4*Math.sin(bearing+offset), z=cz+4*Math.cos(bearing+offset);
        const y=host.wayposts.footing(x,z,cy);
        if (y===null) continue;
        const art=buildEchoWaypost(stop.region);
        const yaw=Math.atan2(pose.p.x-x,pose.p.z-z);
        art.relocate(new THREE.Matrix4().makeRotationY(yaw).setPosition(x,y,z));
        host.scene.add(art.root); stations.push(art);
        const body=mergeGeometries(art.solids);
        for(const part of art.solids.splice(0)) part.dispose();
        if (body) {
          geometries.push(body);
          colliders.push({name:art.root.name,enabled:true,bvh:new MeshBVH(body)});
        }
        break;
      }
    }
  }
  let disposed = false, time = 0;

  function leave(region: WorldRegionId, withServant: boolean) {
    if (disposed || !host.canInteract(echoMarkerId(region)) || !host.safe()) return;
    if (!host.save()) { host.toast(['世界进度未能保存，请在设置里重试保存或导出备份。', 'World progress could not be saved. Retry saving or export a backup in Settings.']); return; }
    markEchoDeparture(undefined, region);
    host.navigate(echoHallHref(withServant ? host.servant() : null, region));
  }
  function interact(id: string): boolean {
    const region = echoMarkerRegion(id);
    if (!region || !poses.has(region)) return false;
    if (!host.canInteract(id)) return true;
    if (!host.safe()) { host.toast(['先脱离危险，在稳固地面站好再开始演武。', 'Leave danger and stand on safe ground before sparring.']); return true; }
    const servant = host.servant(), name = servant ? host.servantName(servant) : null;
    const [zh,en] = ECHO_DESTINATIONS[region].title;
    const choices: { id: string; label: Localized }[] = [];
    if (servant && name) choices.push({ id:'servant', label:[`以${name[0]}出战`, `Spar as ${name[1]}`] });
    choices.push({ id:'free', label:['前往大厅选择从者','Choose a hero in the lobby'] }, { id:'later', label:['继续旅途','Continue the journey'] });
    host.prepareDialogue();
    host.dialogue.showChoices(
      [`铜环中映出${zh}。进入 Arena 前会保存旅程。在大厅按开始即可演武；训练结束后可从 Arena 返回此处。`,
       `The bronze ring frames ${en}. Your journey will be saved before you leave. Press Start in the Arena lobby to spar, then use Return to World to come back here.`],
      [`${zh} · 演武台`, `${en} · Echo station`], choices,
      choice => { if (choice === 'servant' || choice === 'free') leave(region, choice === 'servant'); });
    return true;
  }
  return {
    root, markers, colliders,
    /** Where a player returning from Arena stands: on the steps, facing into the hall. */
    returnPose(region: WorldRegionId = 'home') {
      const pose = poses.get(region);
      return pose && {p: pose.p.clone(), yaw: pose.yaw};
    },
    interact,
    update(dt: number) { if (disposed) return; time += dt; ring.rotation.z = time * .25; rune.emissiveIntensity = 1 + Math.sin(time * 1.6) * .25; },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      for (const art of stations) {
        art.root.removeFromParent();
        for (const mesh of art.layers.values()) mesh.geometry.dispose();
        for (const m of Object.values(art.materials)) m.dispose();
      }
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      for (const c of colliders) c.enabled = false;
    },
  };
}
