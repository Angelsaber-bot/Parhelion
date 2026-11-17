import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {homeWorld} from '../map/homePlan';
import type {Marker} from '../core/types';
import type {Collider} from '../player/player';
import type {Localized} from '../settlements/types';
import type {CompanionId} from '../companions/contracts';
import type {createNarrativePanel} from '../ui/narrativePanel';

/**
 * The Echo Hall (英灵演武场) at Homeward's North Practice Court: the World's door into Arena. Interacting saves the
 * World, then opens the Arena lobby in this tab with the active servant and the HOMEWARD map preselected (the player
 * still presses Start, and every hero stays selectable: no World power crosses over). Arena's "Back to World" returns
 * here: this tab remembers the hall, and the next World load puts the player on its steps.
 */
export const ECHO_HALL_ID = 'home_echo_hall';
/** Hall centre (Homeward local), facing west onto the practice court, clear of the shooting lane to the north. */
export const ECHO_HALL_CENTRE: [number, number, number] = [91, 16, -100];
const YAW = -Math.PI / 2;
/** Where the interaction is offered and where a returning player stands: on the steps, facing the hall. */
export const ECHO_HALL_STEPS: [number, number, number] = [84.6, 17, -100];
export const ECHO_RETURN_KEY = 'parhelion.world.returnTo';
export const ECHO_ARENA_MAP = 'homeward';
/** World companion ids → Arena hero ids. */
export const ARENA_HERO: Record<CompanionId, string> = { saber: 'saber', blackbeard: 'blackbeard', napoleon: 'napoleon', musashi: 'musashi', jeanne: 'jeanne', ozymandias: 'ozymandias', qinShiHuang: 'qin' };

export function echoHallHref(hero: CompanionId | null): string {
  const q = new URLSearchParams({ mode: 'offline', from: 'world', map: ECHO_ARENA_MAP });
  if (hero && ARENA_HERO[hero]) q.set('hero', ARENA_HERO[hero]);
  return `/arena/?${q}`;
}

type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const tabStorage = (): TabStorage | null => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };
/** Remember (for this tab only) that the player left through the hall. */
export function markEchoDeparture(storage: TabStorage | null = tabStorage()) { try { storage?.setItem(ECHO_RETURN_KEY, ECHO_HALL_ID); } catch { /* private mode: the player simply starts at the usual spawn */ } }
/** True once, when this load is the return from Arena through the hall; clears the note. */
export function takeEchoReturn(params: URLSearchParams, storage: TabStorage | null = tabStorage()): boolean {
  try {
    const noted = storage?.getItem(ECHO_RETURN_KEY) === ECHO_HALL_ID;
    if (noted) storage?.removeItem(ECHO_RETURN_KEY);
    return noted && params.get('from') === 'arena';
  } catch { return false; }
}

export interface EchoHallHost {
  scene: THREE.Scene;
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
  box('EchoHallRoof', [10, .35, 7.6], [0, 5.25, 0], dark);
  box('EchoHallRidge', [10.4, .25, .4], [0, 5.55, 0], brass);
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
  let disposed = false, time = 0;

  function leave(withServant: boolean) {
    if (disposed || !host.canInteract(ECHO_HALL_ID) || !host.safe()) return;
    if (!host.save()) { host.toast(['世界进度未能保存，暂时不能进入演武场。请在设置里重试保存或导出备份。', 'World progress could not be saved, so the hall stays closed for now. Retry saving or export a backup in Settings.']); return; }
    markEchoDeparture();
    host.navigate(echoHallHref(withServant ? host.servant() : null));
  }
  function interact(id: string): boolean {
    if (id !== ECHO_HALL_ID) return false;
    if (!host.canInteract(id)) return true;
    if (!host.safe()) { host.toast(['先脱离危险，在稳固地面站好再进入演武场。', 'Leave danger and stand on safe ground before entering the hall.']); return true; }
    const servant = host.servant(), name = servant ? host.servantName(servant) : null;
    const choices: { id: string; label: Localized }[] = [];
    if (servant && name) choices.push({ id: 'servant', label: [`与${name[0]}的英灵投影一同演武（HOMEWARD）`, `Spar as ${name[1]}'s echo (HOMEWARD)`] });
    choices.push({ id: 'free', label: ['自选从者，进入演武场大厅', 'Choose any servant in the hall lobby'] }, { id: 'later', label: ['先去走走。', 'Maybe later.'] });
    host.prepareDialogue();
    host.dialogue.showChoices(
      ['石台上的光环映出英灵的投影。在这里演武只是模拟：不会改变世界里的契约、装备和进度，所有从者在演武场里一律平等。离开前会先保存世界进度，结束后可从演武场返回这里。',
        'The ring of light on the dais casts echoes of heroes. Sparring here is a simulation: it changes none of your World contracts, gear or progress, and every servant is equal in the hall. Your World progress is saved before you go, and the hall brings you back here afterwards.'],
      ['英灵演武场', 'Echo Hall'], choices, choice => { if (choice === 'servant') leave(true); else if (choice === 'free') leave(false); });
    return true;
  }
  return {
    root, markers, colliders,
    /** Where a player returning from Arena stands: on the steps, facing into the hall. */
    returnPose: () => ({ p: steps.clone(), yaw: YAW }),
    interact,
    update(dt: number) { if (disposed) return; time += dt; ring.rotation.z = time * .25; rune.emissiveIntensity = 1 + Math.sin(time * 1.6) * .25; },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      for (const c of colliders) c.enabled = false;
    },
  };
}
