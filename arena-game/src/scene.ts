// Three.js presentation: the arena map art, placeholder anime-style avatars, shields, tracers and the
// first-person weapon. No game rules in here.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import asterGlb from '../../arena/assets/station_visual.glb?url';
import sakuraGlb from '../../arena-maps/sakura/assets/sakura_visual.glb?url';
import blackflagGlb from '../../arena-maps/blackflag/assets/blackflag_visual.glb?url';
import frostcourtGlb from '../../arena-maps/frostcourt/assets/frostcourt_visual.glb?url';
import camlannGlb from '../../arena-maps/camlann/assets/camlann_visual.glb?url';
import asterOverlayGlb from '../../arena-maps/aster/assets/aster_overlay.glb?url';
import { CHARACTERS, SHIELD, WEAPONS, type Team } from '../shared/content.ts';
import type { MapPresentation, Vec3 } from '../shared/map.ts';
import type { PlayerSnap, Shield } from '../shared/match.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { atmosphereFor, type Atmosphere } from './atmosphere.ts';
import { buildFighter, FighterAnimator } from './fighter.ts';
import { OutlinePass } from './outline.ts';
import { celMaterial, toCel, makeSky } from './cel.ts';
import { CRAFTED_CHAPTERS, toChapterMaterial } from './chapterMaterial.ts';
import { attachGunArt, type GunPresentation } from './gunArt.ts';
import { isScopedWeapon } from './aim.ts';
import { meleeRecoverySeconds, meleeWindupProgress, poseMelee } from './meleeArt.ts';
import { ChapterEffects } from './chapterEffects.ts';
import { BLACKFLAG_ATMOSPHERE, BlackflagEffects, blackflagCastsShadow } from './blackflagPresentation.ts';

const MAP_GLB: Record<string, string> = { aster: asterGlb, sakura: sakuraGlb, blackflag: blackflagGlb, frostcourt: frostcourtGlb, camlann: camlannGlb };
/** Extra decorative layers drawn over a map's own art (ASTER's original model stays untouched). */
const MAP_OVERLAY: Record<string, string> = { aster: asterOverlayGlb };

export const TEAM_COLOR: Record<Team, number> = { A: 0x4fd6e0, B: 0xf09a4a };

export class ArenaScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(78, 1, 0.05, 260);
  private vmScene = new THREE.Scene();
  private vmCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  private avatars = new Map<string, Avatar>();
  private shields = new Map<number, THREE.Group>();
  private tracers: { line: THREE.Line; life: number; max: number }[] = [];
  private sparks: { s: THREE.Sprite; life: number; max: number; grow: number; vel?: THREE.Vector3 }[] = [];
  private numbers: { s: THREE.Sprite; life: number; vy: number }[] = [];
  private muzzleLight = new THREE.PointLight(0xffd79a, 0, 9, 2);
  private flashT = 0;
  private baseFov = 78;
  readonly viewmodel = new Viewmodel();
  private sparkTex = makeGlowTexture();
  private sky: THREE.Mesh;
  private maps = new Map<string, Promise<THREE.Object3D>>();
  private shownMap: THREE.Object3D | null = null;
  private wantMap = '';
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private outline: OutlinePass | null = null;
  private particles: Particles | null = null;
  private blackflagEffects: BlackflagEffects | null = null;
  private chapterEffects: ChapterEffects | null = null;
  private bufferSize = new THREE.Vector2();
  private atmo: Atmosphere = atmosphereFor('day');

  constructor(canvas: HTMLCanvasElement, private readonly quality: 'high' | 'low' = 'high') {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping; // keeps anime saturation, unlike ACES
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = quality === 'high';
    r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    this.renderer = r;
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(r);
    const environment = pmrem.fromScene(room);
    this.scene.environment = this.vmScene.environment = environment.texture;
    room.dispose(); pmrem.dispose();

    const s = this.scene;
    s.background = new THREE.Color(0xbfdcf2);
    s.fog = new THREE.Fog(0xc4e2f6, 70, 220);
    this.sky = makeSky(new THREE.Vector3(-22, 35, 18));
    s.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xd6ecff, 0x6a7088, 1.8);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffe7c8, 3.0);
    this.sun = sun;
    sun.position.set(-22, 35, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 44, bottom: -44, near: 1, far: 100 });
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.045;
    s.add(sun);
    this.camera.rotation.order = 'YXZ';
    s.add(this.muzzleLight); // always present (intensity 0 when idle) so firing never recompiles shaders

    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.2);
    key.position.set(1, 2, 1);
    this.vmScene.add(key, this.viewmodel.root);

    if (quality === 'high') {
      // bloom makes emissive trims, lanterns and neon glow; the viewmodel is drawn after it, unbloomed
      // the composer's targets carry a depth texture so the outline pass can read scene depth
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(s, this.camera));
      this.outline = new OutlinePass(this.camera);
      this.composer.addPass(this.outline);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.55, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /** Apply a map's lighting mood: sky, fog, sun, ambient, exposure, bloom and ambient particles. */
  setAtmosphere(a: Atmosphere) {
    this.atmo = a;
    const s = this.scene;
    (s.background as THREE.Color).set(a.background);
    (s.fog as THREE.Fog).color.set(a.fog[0]);
    (s.fog as THREE.Fog).near = a.fog[1];
    (s.fog as THREE.Fog).far = a.fog[2];
    this.renderer.toneMappingExposure = a.exposure;
    s.environmentIntensity = a.environment ?? 1;
    this.hemi.color.set(a.hemi[0]);
    this.hemi.groundColor.set(a.hemi[1]);
    this.hemi.intensity = a.hemi[2];
    this.sun.color.set(a.sun.color);
    this.sun.intensity = a.sun.intensity;
    this.sun.position.set(...a.sun.pos);
    const u = (this.sky.material as THREE.ShaderMaterial).uniforms;
    (u.sunDir.value as THREE.Vector3).set(...a.sun.pos).normalize();
    const lin = (hex: number) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace); // raw shader values
    u.uHorizon.value = lin(a.sky.horizon); u.uMid.value = lin(a.sky.mid); u.uTop.value = lin(a.sky.top);
    u.uSun.value = lin(a.sky.sun); u.uCloudLit.value = lin(a.sky.cloudLit); u.uCloudShade.value = lin(a.sky.cloudShade);
    u.uNight.value = a.sky.night;
    u.uAurora.value = a.sky.aurora ?? 0;
    if (this.bloom) { this.bloom.strength = a.bloom; this.bloom.threshold = a.bloomThreshold; }
    if (this.particles) { this.particles.dispose(s); this.particles = null; }
    if (a.particles !== 'none') this.particles = new Particles(a.particles, this.sparkTex, s);
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Show a map's art (loaded once per map, then cached); resolves when it is on screen. */
  async loadMap(id: string, preset?: string, presentation?: MapPresentation): Promise<void> {
    this.wantMap = id;
    this.setAtmosphere(id === 'blackflag' ? BLACKFLAG_ATMOSPHERE : atmosphereFor(preset));
    let p = this.maps.get(id);
    if (!p) {
      const urls = [MAP_GLB[id] ?? asterGlb, ...(MAP_OVERLAY[id] ? [MAP_OVERLAY[id]] : [])];
      p = Promise.all(urls.map((u) => new GLTFLoader().loadAsync(u))).then((gltfs) => {
        const group = new THREE.Group();
        for (const gltf of gltfs) group.add(gltf.scene);
        group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const decorative = m.userData.decorative === true;
          const role = m.userData.role as string | undefined;
          const convert = CRAFTED_CHAPTERS.has(id) ? toChapterMaterial : toCel;
          m.material = Array.isArray(m.material) ? m.material.map(convert) : convert(m.material);
          m.receiveShadow = true;
          m.castShadow = id === 'blackflag' ? blackflagCastsShadow(m) : !decorative && role !== 'floor' && role !== 'wayfinding';
        });
        return group;
      });
      this.maps.set(id, p);
      p.catch(() => this.maps.delete(id));
    }
    const root = await p;
    if (this.wantMap !== id || this.shownMap === root) return; // a later pick won
    this.blackflagEffects?.dispose();
    this.blackflagEffects = id === 'blackflag' ? new BlackflagEffects(this.sparkTex, this.quality) : null;
    if (this.blackflagEffects) this.scene.add(this.blackflagEffects.root);
    this.chapterEffects?.dispose();
    this.chapterEffects = presentation && (presentation.glows || presentation.pools || presentation.embers || presentation.smoke || presentation.field)
      ? new ChapterEffects(presentation, this.sparkTex, this.quality) : null;
    if (this.chapterEffects) this.scene.add(this.chapterEffects.root);
    if (this.shownMap) this.scene.remove(this.shownMap);
    this.scene.add(root);
    this.shownMap = root;
    // the map is static: render its shadow map once per map change
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = this.vmCamera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.updateProjectionMatrix();
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
  }

  setView(x: number, y: number, z: number, yaw: number, pitch: number, roll = 0, fovAdd = 0) {
    this.camera.position.set(x, y, z);
    this.sky.position.set(x, y, z);
    ((this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = performance.now() / 1000);
    this.camera.rotation.set(pitch, yaw, roll);
    const fov = this.baseFov + fovAdd;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  localMuzzle(): Vec3 {
    this.camera.updateMatrixWorld(); this.vmCamera.updateMatrixWorld();
    const v = this.viewmodel.muzzlePosition();
    const ndc = v.clone().project(this.vmCamera);
    const ray = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const at = this.camera.position.clone().addScaledVector(ray, Math.max(0.2, v.length()));
    return [at.x, at.y, at.z];
  }

  /** Muzzle light: a brief warm flash on the world around the shooter. */
  muzzleFlash(at: Vec3, strength = 1) {
    this.muzzleLight.position.set(at[0], at[1], at[2]);
    this.muzzleLight.intensity = 9 * strength;
    this.flashT = 0.06;
  }

  /** Bullet impact: a dust puff and flying chips on the map, a bright star burst on a player. */
  impact(at: Vec3, onPlayer: boolean, color = 0xfff4c0) {
    if (onPlayer) {
      this.burst(at, 0xffffff, 0.55, 0.12, 0);
      this.burst(at, 0xff6f91, 0.9, 0.16, 0);
      for (let i = 0; i < 5; i++) this.burst(at, 0xffc2d4, 0.12, 0.25, 3.2);
    } else {
      this.burst(at, 0xf3ead8, 0.5, 0.35, 0);
      this.burst(at, color, 0.3, 0.1, 0);
      for (let i = 0; i < 4; i++) this.burst(at, 0xffe2a6, 0.08, 0.3, 4);
    }
  }

  private burst(at: Vec3, color: number, size: number, life: number, speed: number) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(...at);
    s.scale.setScalar(size * 0.4);
    this.scene.add(s);
    const vel = speed ? new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed) : undefined;
    this.sparks.push({ s, life, max: life, grow: size * (speed ? 0.2 : 2.4), vel });
  }

  /** Floating damage number over a hit player (anime-shooter style). */
  damageNumber(at: Vec3, dmg: number, head: boolean, kill: boolean) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d')!;
    g.font = `900 ${head || kill ? 46 : 38}px sans-serif`;
    g.textAlign = 'center';
    g.lineWidth = 6;
    g.strokeStyle = '#1a1030';
    g.fillStyle = kill ? '#ff5d7a' : head ? '#ffd34d' : '#ffffff';
    const txt = String(Math.round(dmg));
    g.strokeText(txt, 64, 48);
    g.fillText(txt, 64, 48);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    s.position.set(at[0] + (Math.random() - 0.5) * 0.5, at[1], at[2] + (Math.random() - 0.5) * 0.5);
    s.scale.set(0.9, 0.45, 1);
    s.renderOrder = 20;
    this.scene.add(s);
    this.numbers.push({ s, life: 0.8, vy: 1.6 });
  }

  // ---------- players ----------

  syncAvatar(p: PlayerSnap, pos: Vec3, yaw: number, pitch: number, ally: boolean) {
    let a = this.avatars.get(p.id);
    if (!a || a.char !== p.char || a.team !== p.team) {
      a?.dispose(this.scene);
      a = new Avatar(p);
      this.avatars.set(p.id, a);
      this.scene.add(a.root);
    }
    a.root.visible = p.alive;
    a.setAlly(ally);
    const now = performance.now() / 1000;
    a.setWeapon(p.weapon, p.skins[p.weapon] ?? 0);
    a.animate(pos, Math.min(0.1, now - this.lastAnim), p.crouched, p.meleeWindup);
    a.root.position.set(pos[0], pos[1], pos[2]);
    a.root.rotation.y = p.meleeWindup > 0 ? p.meleeYaw : yaw;
    a.aim.rotation.x = p.meleeWindup > 0 ? p.meleePitch : pitch;
    a.setHp(p.hp / CHARACTERS[p.char].hp, p.name);
  }

  meleeStrike(id: string) { this.avatars.get(id)?.strike(); }

  private lastAnim = performance.now() / 1000;
  /** Call once per frame after all syncAvatar calls. */
  endAvatars() { this.lastAnim = performance.now() / 1000; }

  pruneAvatars(ids: Set<string>) {
    for (const [id, a] of this.avatars) if (!ids.has(id)) { a.dispose(this.scene); this.avatars.delete(id); }
  }

  /** World-space muzzle of a remote avatar, for its tracers. */
  muzzleOf(id: string): Vec3 | null {
    const a = this.avatars.get(id);
    if (!a || !a.root.visible) return null;
    const v = a.muzzle.getWorldPosition(new THREE.Vector3());
    return [v.x, v.y, v.z];
  }

  // ---------- shields ----------

  syncShields(list: Shield[]) {
    const live = new Set<number>();
    for (const s of list) {
      live.add(s.id);
      let g = this.shields.get(s.id);
      if (!g) {
        g = makeShield(TEAM_COLOR[s.team]);
        this.shields.set(s.id, g);
        this.scene.add(g);
      }
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.yaw;
      const k = Math.max(0.15, s.hp / SHIELD.hp);
      ((g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.25 * k;
      const fade = Math.min(1, s.life / 30);
      g.scale.setScalar(0.3 + 0.7 * Math.min(1, (SHIELD.life - s.life) / 8)); // pop-in
      g.visible = fade > 0;
    }
    for (const [id, g] of this.shields) if (!live.has(id)) {
      this.scene.remove(g); g.traverse((node) => {
        const drawable = node as THREE.Mesh;
        drawable.geometry?.dispose();
        if (drawable.material) for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) material.dispose();
      }); this.shields.delete(id);
    }
  }

  /** Round boundaries clear transient effects without reloading maps or equipped models. */
  clearCombatEffects() {
    for (const { line } of this.tracers) { this.scene.remove(line); line.geometry.dispose(); (line.material as THREE.Material).dispose(); }
    for (const { s } of this.sparks) { this.scene.remove(s); s.material.dispose(); }
    for (const { s } of this.numbers) { this.scene.remove(s); s.material.map?.dispose(); s.material.dispose(); }
    this.tracers = []; this.sparks = []; this.numbers = [];
    this.flashT = 0; this.muzzleLight.intensity = 0;
    this.syncShields([]); this.viewmodel.resetMotion();
    for (const avatar of this.avatars.values()) avatar.resetMotion();
  }

  // ---------- effects ----------

  tracer(from: Vec3, to: Vec3, color: number, width = 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 * width, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09, max: 0.09 });
    this.spark(to, color);
  }

  spark(at: Vec3, color: number) {
    this.burst(at, color, 0.35, 0.14, 0);
  }

  update(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / t.max) * 0.9;
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); (t.line.material as THREE.Material).dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.vel) { s.vel.y -= 9 * dt; s.s.position.addScaledVector(s.vel, dt); }
      s.s.scale.setScalar(Math.max(0.01, s.s.scale.x + s.grow * dt));
      s.s.material.opacity = Math.max(0, s.life / s.max);
      if (s.life <= 0) { this.scene.remove(s.s); s.s.material.dispose(); this.sparks.splice(i, 1); }
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      n.vy -= 3 * dt;
      n.s.position.y += n.vy * dt;
      n.s.material.opacity = Math.min(1, n.life / 0.3);
      const pop = 1 + Math.max(0, n.life - 0.65) * 4;
      n.s.scale.set(0.9 * pop, 0.45 * pop, 1);
      if (n.life <= 0) { this.scene.remove(n.s); n.s.material.map?.dispose(); n.s.material.dispose(); this.numbers.splice(i, 1); }
    }
    this.flashT -= dt;
    this.muzzleLight.intensity = this.flashT > 0 ? this.muzzleLight.intensity * 0.6 : 0;
    this.viewmodel.update(dt);
    this.particles?.update(dt, this.camera.position);
    this.blackflagEffects?.update(dt);
    this.chapterEffects?.update(dt);
  }

  render(showViewmodel: boolean) {
    const r = this.renderer;
    r.clear();
    this.chapterEffects?.sync(this.camera, r.getDrawingBufferSize(this.bufferSize).y, this.scene.fog as THREE.Fog);
    if (this.composer) this.composer.render();
    else r.render(this.scene, this.camera);
    if (showViewmodel) {
      r.clearDepth();
      r.render(this.vmScene, this.vmCamera);
    }
  }
}

// ---------- weapon meshes (shared by viewmodel and avatars) ----------

function toon(color: number, emissive = 0) {
  return celMaterial({ color, emissive, emissiveIntensity: emissive ? 1.2 : 0 });
}

function buildFallbackGun(weapon: number, skin: number): { group: THREE.Group; muzzle: THREE.Object3D } {
  const s = WEAPONS[weapon].skins[skin] ?? WEAPONS[weapon].skins[0];
  const body = toon(s.body), accent = toon(s.accent, s.accent), dark = toon(0x1d2630);
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const cyl = (r: number, l: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const metal = toon(0x3a4250), glow = toon(s.accent, s.accent);
  let len: number;
  if (WEAPONS[weapon].kind === 'melee') { // Honest usable fallback, never a rifle for failed melee art.
    box(.045, .045, weapon === 6 ? 1.4 : .65, dark, 0, -.1, -.22);
    if (weapon === 7) box(.3, .22, .22, body, 0, -.1, -.5);
    else box(weapon === 6 ? .09 : .07, .025, weapon === 6 ? .45 : .55, accent, 0, -.1, weapon === 6 ? -.85 : -.5);
    len = weapon === 6 ? 1.05 : .75;
  } else if (weapon === 0 || weapon === 3) { // Lumen AR: bullpup-ish carbine, rail, red-dot, glowing energy strip
    box(0.068, 0.09, 0.4, body);
    box(0.07, 0.022, 0.28, accent, 0, 0.056, -0.02);
    box(0.05, 0.12, 0.06, dark, 0, -0.1, 0.07);                 // grip
    box(0.045, 0.13, 0.07, metal, 0, -0.1, -0.05).rotation.x = 0.18; // magazine
    box(0.074, 0.03, 0.18, dark, 0, -0.035, -0.22);             // handguard
    cyl(0.017, 0.2, metal, 0, 0.005, -0.33);                    // barrel
    cyl(0.025, 0.05, dark, 0, 0.005, -0.43);                    // flash hider
    box(0.06, 0.08, 0.16, body, 0, -0.012, 0.27);               // stock
    box(0.064, 0.02, 0.05, dark, 0, 0.012, 0.34);
    box(0.03, 0.035, 0.06, dark, 0, 0.085, 0.02);               // red-dot housing
    box(0.022, 0.022, 0.004, glow, 0, 0.088, -0.012);
    box(0.072, 0.008, 0.12, glow, 0, 0.0, -0.14);               // energy strip
    len = 0.46;
  } else if (weapon === 1) { // Corona SG: wide twin-tube shotgun with a pump and a shell rack
    box(0.09, 0.105, 0.42, body);
    cyl(0.026, 0.42, metal, -0.022, 0.02, -0.27);
    cyl(0.026, 0.42, metal, 0.022, 0.02, -0.27);
    box(0.1, 0.07, 0.16, dark, 0, -0.045, -0.22);               // pump
    for (let i = 0; i < 4; i++) box(0.102, 0.012, 0.012, glow, 0, -0.045, -0.28 + i * 0.04);
    box(0.092, 0.024, 0.36, accent, 0, 0.064, 0.02);
    box(0.05, 0.12, 0.06, dark, 0, -0.11, 0.12);
    box(0.082, 0.1, 0.2, body, 0, -0.02, 0.32);
    for (let i = 0; i < 4; i++) cyl(0.011, 0.05, toon(0xe0524a), 0.05, -0.01, 0.03 + i * 0.03, 8).rotation.set(0, 0, Math.PI / 2);
    len = 0.48;
  } else { // Halo DMR: long rifle, ringed scope, fluted barrel, halo emblem
    box(0.058, 0.08, 0.5, body);
    cyl(0.016, 0.34, metal, 0, 0.005, -0.42);
    for (let i = 0; i < 3; i++) cyl(0.021, 0.02, dark, 0, 0.005, -0.32 - i * 0.07);
    cyl(0.017, 0.17, dark, 0, 0.07, -0.02);                    // scope tube
    cyl(0.022, 0.025, dark, 0, 0.07, -0.1);
    cyl(0.022, 0.025, dark, 0, 0.07, 0.06);
    cyl(0.016, 0.005, glow, 0, 0.07, -0.115);                  // lens glint
    box(0.06, 0.014, 0.44, accent, 0, -0.046, -0.02);
    box(0.045, 0.12, 0.05, dark, 0, -0.1, 0.08);
    box(0.04, 0.09, 0.05, metal, 0, -0.085, -0.04);
    box(0.06, 0.1, 0.2, body, 0, -0.02, 0.34);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 20), glow);
    halo.position.set(0.031, 0, 0.12);
    halo.rotation.y = Math.PI / 2;
    g.add(halo);
    len = 0.6;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -len);
  g.add(muzzle);
  return { group: g, muzzle };
}

export function buildGun(weapon: number, skin: number, firstPerson = false): GunPresentation {
  return attachGunArt(weapon, skin, buildFallbackGun(weapon, skin), firstPerson);
}

export class Viewmodel {
  readonly root = new THREE.Group();
  private gun: THREE.Group | null = null;
  private presentation: GunPresentation | null = null;
  private muzzle: THREE.Object3D | null = null;
  private flash: THREE.Sprite;
  private key = '';
  private kick = 0;
  private kickMax = 1;
  private meleeHit = 0;
  meleeWindup = 0;
  private weapon = 0;
  private swap = 0;
  private bob = 0;
  private sway = [0, 0];
  private shells: { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number }[] = [];
  private shellGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.028, 6);
  private shellMat = celMaterial({ color: 0xe6b55a, emissive: 0x3a2400 });
  reloading = 0; // 0..1 progress, set by game
  moving = 0;
  aim = 0;

  constructor() {
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xfff1b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.16);
    this.flash.visible = false;
    this.root.add(this.flash);
  }

  set(weapon: number, skin: number) {
    const k = `${weapon}:${skin}`;
    if (k === this.key) return;
    this.key = k;
    this.presentation?.dispose();
    const { group, muzzle } = this.presentation = buildGun(weapon, skin, true);
    group.scale.setScalar(weapon === 6 ? .6 : .72);
    this.gun = group;
    this.muzzle = muzzle;
    this.root.add(group);
    this.swap = 1;
    this.weapon = weapon; this.meleeHit = 0; this.meleeWindup = 0; this.kick = 0;
  }

  resetMotion() {
    for (const shell of this.shells) this.root.remove(shell.m); this.shells = [];
    this.flash.visible = false; this.aim = 0; this.meleeHit = 0; this.meleeWindup = 0;
    this.kick = 0; this.bob = 0; this.sway = [0, 0]; this.reloading = 0; this.moving = 0;
  }

  clear() {
    this.resetMotion();
    this.presentation?.dispose(); this.presentation = null; this.gun = null; this.muzzle = null; this.key = '';
    for (const shell of this.shells) this.root.remove(shell.m); this.shells = [];
    this.flash.visible = false; this.aim = 0; this.meleeHit = 0; this.meleeWindup = 0;
  }

  muzzlePosition() { return this.muzzle?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(0.17, -0.16, -0.7); }

  strike() { this.meleeHit = 1; }

  fire() {
    const w = this.weapon;
    if (WEAPONS[w].kind === 'melee') return;
    this.kickMax = w === 1 ? 1.9 : (w === 2 || w === 4) ? 1.4 : 0.85;
    this.kick = this.kickMax;
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(w === 1 ? 0.3 : (w === 2 || w === 4) ? 0.24 : 0.17);
    setTimeout(() => (this.flash.visible = false), w === 1 ? 60 : 40);
    if (w !== 1) this.ejectShell();
  }

  /** Spent casing flies out to the right of the gun (viewmodel space). */
  private ejectShell() {
    const m = new THREE.Mesh(this.shellGeo, this.shellMat);
    m.position.set(0.2, -0.13, -0.42);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2);
    this.root.add(m);
    this.shells.push({
      m, life: 0.6,
      v: new THREE.Vector3(0.9 + Math.random() * 0.5, 0.9 + Math.random() * 0.4, 0.15 + Math.random() * 0.2),
      spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20),
    });
  }

  /** Gun lags behind fast mouse turns, like weapon sway in mature FPS games. */
  look(dYaw: number, dPitch: number) {
    this.sway[0] = Math.max(-0.05, Math.min(0.05, this.sway[0] + dYaw * 0.35));
    this.sway[1] = Math.max(-0.05, Math.min(0.05, this.sway[1] + dPitch * 0.35));
  }

  update(dt: number) {
    if (!this.gun) return;
    // fast snap back, then a softer settle: reads as a punchy shot rather than a slide
    this.kick = Math.max(0, this.kick - dt * (this.kick > 0.4 * this.kickMax ? 14 : 6) * this.kickMax);
    this.swap = Math.max(0, this.swap - dt * 5);
    this.bob += dt * (4 + this.moving * 5);
    const k = 1 - Math.exp(-dt * 10);
    this.sway[0] -= this.sway[0] * k;
    this.sway[1] -= this.sway[1] * k;
    const bobY = Math.sin(this.bob * 2) * 0.006 * this.moving, bobX = Math.cos(this.bob) * 0.008 * this.moving;
    const rel = Math.sin(this.reloading * Math.PI);
    const kick = this.kick;
    this.gun.position.set(0.17 + bobX - this.sway[0], -0.16 + bobY - this.swap * 0.2 - rel * 0.1 + this.sway[1] * 0.6 + kick * 0.012, -0.4 + kick * 0.06);
    this.gun.rotation.set(kick * 0.16 + rel * 0.6, 0.04 + this.sway[0] * 1.5, rel * 0.4 - kick * 0.03 + this.sway[0] * 0.8);
    // At full ADS the authored optic axis runs through the centre of the view camera.
    if (this.presentation) {
      const sight = this.presentation.sight.clone().multiplyScalar(0.72);
      const aimPosition = new THREE.Vector3(-sight.x, -sight.y, -0.34 - sight.z);
      this.gun.position.lerp(aimPosition, this.aim);
      this.gun.rotation.x *= 1 - this.aim; this.gun.rotation.y *= 1 - this.aim; this.gun.rotation.z *= 1 - this.aim;
      this.presentation.animate(kick, this.reloading);
    }
    if (WEAPONS[this.weapon].kind === 'melee') {
      poseMelee(this.gun, this.weapon, meleeWindupProgress(this.meleeWindup, WEAPONS[this.weapon].windup ?? 1), this.meleeHit, true);
      this.meleeHit = Math.max(0, this.meleeHit - dt / meleeRecoverySeconds(this.weapon));
    }
    this.gun.visible = !(isScopedWeapon(this.weapon) && this.aim > 0.92); // scopes have an unobstructed magnified view
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt;
      sh.v.y -= 6 * dt;
      sh.m.position.addScaledVector(sh.v, dt);
      sh.m.rotation.x += sh.spin.x * dt; sh.m.rotation.y += sh.spin.y * dt; sh.m.rotation.z += sh.spin.z * dt;
      if (sh.life <= 0) { this.root.remove(sh.m); this.shells.splice(i, 1); }
    }
    if (this.muzzle) this.flash.position.copy(this.muzzle.getWorldPosition(new THREE.Vector3()));
  }
}

// ---------- avatar ----------

class Avatar {
  readonly root = new THREE.Group();
  readonly aim: THREE.Group;
  muzzle = new THREE.Object3D();
  readonly char: number;
  readonly team: Team;
  private gunKey = '';
  private gun: THREE.Group | null = null;
  private presentation: GunPresentation | null = null;
  private plate: THREE.Sprite;
  private plateCtx: CanvasRenderingContext2D;
  private plateKey = '';
  private anim: FighterAnimator;
  private last: Vec3 | null = null;
  private speed = 0;
  private vy = 0;
  private weapon = 0;
  private meleeHit = 0;

  constructor(p: PlayerSnap) {
    this.char = p.char;
    this.team = p.team;
    const teamCol = TEAM_COLOR[p.team];
    const rig = buildFighter(p.char, teamCol);
    this.aim = rig.aim;
    this.anim = new FighterAnimator(rig);
    this.root.add(rig.root);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 28), new THREE.MeshBasicMaterial({ color: teamCol, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.root.add(blob, ring);

    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    this.plateCtx = c.getContext('2d')!;
    this.plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, transparent: true }));
    this.plate.scale.set(1.2, 0.3, 1);
    this.plate.position.y = 2.25;
    this.plate.renderOrder = 10;
    this.root.add(this.plate);
  }

  /** Allies' nameplates show through walls; enemies' never do. */
  setAlly(ally: boolean) {
    this.plate.material.depthTest = !ally;
  }

  /** Drive the run cycle from how far the interpolated position moved since last frame. */
  strike() { this.meleeHit = 1; }

  resetMotion() { this.meleeHit = 0; this.last = null; this.speed = this.vy = 0; }

  animate(pos: Vec3, dt: number, crouched = false, meleeWindup = 0) {
    if (this.last && dt > 0) {
      const v = Math.hypot(pos[0] - this.last[0], pos[2] - this.last[2]) / dt;
      this.speed += (Math.min(v, 12) - this.speed) * Math.min(1, dt * 10);
      this.vy += ((pos[1] - this.last[1]) / dt - this.vy) * Math.min(1, dt * 10);
    }
    this.last = [pos[0], pos[1], pos[2]];
    this.anim.update(dt, this.speed, this.vy, crouched);
    this.plate.position.y = crouched ? 1.7 : 2.25;
    if (this.gun && WEAPONS[this.weapon].kind === 'melee') {
      const windup = meleeWindupProgress(meleeWindup, WEAPONS[this.weapon].windup ?? 1);
      poseMelee(this.gun, this.weapon, windup, this.meleeHit, false);
      this.anim.melee(windup, this.meleeHit, this.weapon);
      this.meleeHit = Math.max(0, this.meleeHit - dt / meleeRecoverySeconds(this.weapon));
    } else this.anim.melee(0, 0);
  }

  setWeapon(weapon: number, skin: number) {
    const k = `${weapon}:${skin}`;
    if (k === this.gunKey) return;
    this.gunKey = k; this.weapon = weapon; this.meleeHit = 0;
    this.presentation?.dispose();
    const { group, muzzle } = this.presentation = buildGun(weapon, skin);
    group.position.set(0.16, -0.08, -0.32);
    group.scale.setScalar(1.15);
    this.gun = group;
    this.muzzle = muzzle;
    this.aim.add(group);
  }

  setHp(frac: number, name: string) {
    const k = `${name}:${Math.round(frac * 50)}`;
    if (k === this.plateKey) return;
    this.plateKey = k;
    const g = this.plateCtx;
    g.clearRect(0, 0, 256, 64);
    g.font = 'bold 26px sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#000a';
    g.fillText(name, 129, 29);
    g.fillStyle = '#fff';
    g.fillText(name, 128, 28);
    g.fillStyle = '#0008';
    g.fillRect(48, 40, 160, 12);
    g.fillStyle = '#' + TEAM_COLOR[this.team].toString(16).padStart(6, '0');
    g.fillRect(50, 42, 156 * Math.max(0, frac), 8);
    (this.plate.material.map as THREE.Texture).needsUpdate = true;
  }

  dispose(scene: THREE.Scene) {
    this.presentation?.dispose();
    this.plate.material.map?.dispose(); this.plate.material.dispose();
    scene.remove(this.root);
  }
}

function makeShield(color: number): THREE.Group {
  const g = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(SHIELD.width, SHIELD.height),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  plane.position.y = SHIELD.height / 2;
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(SHIELD.width, SHIELD.height, 6, 4)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
  frame.position.y = SHIELD.height / 2;
  // hex-ish grid lines for the anime barrier look
  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.PlaneGeometry(SHIELD.width, SHIELD.height, 6, 5)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending }),
  );
  grid.position.y = SHIELD.height / 2;
  g.add(plane, frame, grid);
  return g;
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffffff');
  grad.addColorStop(0.3, '#ffffffaa');
  grad.addColorStop(1, '#ffffff00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- ambient particles (petals at dusk, dust motes at noon, embers at night) ----------

class Particles {
  private points: THREE.Points;
  private vel: Float32Array;
  private phase: Float32Array;
  private readonly n: number;
  private readonly box = [26, 12, 26];

  constructor(private kind: 'petals' | 'motes' | 'embers' | 'snow', tex: THREE.Texture, scene: THREE.Scene) {
    this.n = kind === 'petals' ? 420 : kind === 'embers' ? 360 : kind === 'snow' ? 900 : 220;
    const pos = new Float32Array(this.n * 3);
    this.vel = new Float32Array(this.n * 3);
    this.phase = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2 * this.box[0];
      pos[i * 3 + 1] = Math.random() * this.box[1];
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * this.box[2];
      this.phase[i] = Math.random() * 10;
      const fall = kind === 'petals' ? -(0.5 + Math.random() * 0.6) : kind === 'snow' ? -(0.7 + Math.random() * 0.7) : kind === 'embers' ? 0.25 + Math.random() * 0.4 : (Math.random() - 0.5) * 0.15;
      this.vel.set([0.6 + Math.random() * 0.5, fall, 0.2 + Math.random() * 0.3], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = kind === 'petals' ? 0xffb7cf : kind === 'snow' ? 0xf4f8ff : kind === 'embers' ? 0x7ff6ff : 0xfff1c4;
    const mat = new THREE.PointsMaterial({
      color, map: tex, alphaMap: tex, alphaTest: 0.02, size: kind === 'petals' ? 0.16 : kind === 'snow' ? 0.1 : kind === 'embers' ? 0.12 : 0.08,
      transparent: true, depthWrite: false,
      blending: kind === 'petals' || kind === 'snow' ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: kind === 'motes' ? 0.55 : 0.95,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt: number, around: THREE.Vector3) {
    const p = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const [bx, by, bz] = this.box;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      this.phase[i] += dt;
      const sway = Math.sin(this.phase[i] * 1.7) * (this.kind === 'petals' ? 0.9 : this.kind === 'snow' ? 0.4 : 0.25);
      a[k] += (this.vel[k] + sway) * dt;
      a[k + 1] += this.vel[k + 1] * dt;
      a[k + 2] += (this.vel[k + 2] + Math.cos(this.phase[i] * 1.3) * 0.3) * dt;
      // keep the cloud centred on the camera so it is always around the player
      if (a[k] - around.x > bx) a[k] -= 2 * bx; else if (a[k] - around.x < -bx) a[k] += 2 * bx;
      if (a[k + 2] - around.z > bz) a[k + 2] -= 2 * bz; else if (a[k + 2] - around.z < -bz) a[k + 2] += 2 * bz;
      if (a[k + 1] < 0) a[k + 1] += by; else if (a[k + 1] > by) a[k + 1] -= by;
    }
    p.needsUpdate = true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
