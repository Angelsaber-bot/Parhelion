// Three.js presentation: the ASTER map, placeholder anime-style avatars, shields, tracers and the
// first-person weapon. No game rules in here.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbUrl from '../../arena/assets/station_visual.glb?url';
import { CHARACTERS, SHIELD, WEAPONS, type Team } from '../shared/content.ts';
import type { Vec3 } from '../shared/map.ts';
import type { PlayerSnap, Shield } from '../shared/match.ts';

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
  private sparks: { s: THREE.Sprite; life: number }[] = [];
  readonly viewmodel = new Viewmodel();
  private sparkTex = makeGlowTexture();

  constructor(canvas: HTMLCanvasElement, quality: 'high' | 'low' = 'high') {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    r.shadowMap.enabled = quality === 'high';
    r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    this.renderer = r;

    const s = this.scene;
    s.background = new THREE.Color(0x9fb8c6);
    s.fog = new THREE.Fog(0x9fb8c6, 70, 200);
    s.add(new THREE.HemisphereLight(0xdceeff, 0x536372, 2.0));
    const sun = new THREE.DirectionalLight(0xffe7c8, 3.0);
    sun.position.set(-22, 35, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 44, bottom: -44, near: 1, far: 100 });
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.045;
    s.add(sun);
    this.camera.rotation.order = 'YXZ';

    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.2);
    key.position.set(1, 2, 1);
    this.vmScene.add(key, this.viewmodel.root);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  async loadMap(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(glbUrl);
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const decorative = m.userData.decorative === true;
      const role = m.userData.role as string | undefined;
      m.receiveShadow = true;
      m.castShadow = !decorative && role !== 'floor' && role !== 'wayfinding';
    });
    this.scene.add(gltf.scene);
    // the map is static: render its shadow map once
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = this.vmCamera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.updateProjectionMatrix();
  }

  setView(x: number, y: number, z: number, yaw: number, pitch: number) {
    this.camera.position.set(x, y, z);
    this.camera.rotation.set(pitch, yaw, 0);
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
    a.root.position.set(pos[0], pos[1], pos[2]);
    a.root.rotation.y = yaw;
    a.aim.rotation.x = pitch;
    a.setWeapon(p.weapon, p.skins[p.weapon] ?? 0);
    a.setHp(p.hp / CHARACTERS[p.char].hp, p.name);
  }

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
    for (const [id, g] of this.shields) if (!live.has(id)) { this.scene.remove(g); this.shields.delete(id); }
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
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(...at);
    s.scale.setScalar(0.35);
    this.scene.add(s);
    this.sparks.push({ s, life: 0.14 });
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
      s.s.scale.setScalar(0.35 + (0.14 - s.life) * 2);
      s.s.material.opacity = Math.max(0, s.life / 0.14);
      if (s.life <= 0) { this.scene.remove(s.s); s.s.material.dispose(); this.sparks.splice(i, 1); }
    }
    this.viewmodel.update(dt);
  }

  render(showViewmodel: boolean) {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (showViewmodel) {
      r.clearDepth();
      r.render(this.vmScene, this.vmCamera);
    }
  }
}

// ---------- weapon meshes (shared by viewmodel and avatars) ----------

function toon(color: number, emissive = 0) {
  return new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: emissive ? 1.2 : 0 });
}

export function buildGun(weapon: number, skin: number): { group: THREE.Group; muzzle: THREE.Object3D } {
  const s = WEAPONS[weapon].skins[skin] ?? WEAPONS[weapon].skins[0];
  const body = toon(s.body), accent = toon(s.accent, s.accent), dark = toon(0x1d2630);
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  let len: number;
  if (weapon === 0) { // compact AR
    box(0.07, 0.09, 0.42, body);
    box(0.072, 0.02, 0.3, accent, 0, 0.055, -0.02);
    box(0.05, 0.12, 0.06, dark, 0, -0.1, 0.06);
    box(0.045, 0.1, 0.05, dark, 0, -0.09, -0.08).rotation.x = 0.25;
    box(0.04, 0.04, 0.2, body, 0, 0, -0.3);
    box(0.06, 0.08, 0.16, body, 0, -0.01, 0.27);
    len = 0.42;
  } else if (weapon === 1) { // chunky shotgun
    box(0.09, 0.11, 0.48, body);
    box(0.06, 0.06, 0.32, dark, 0, -0.07, -0.08);
    box(0.092, 0.025, 0.4, accent, 0, 0.065, 0);
    box(0.05, 0.12, 0.06, dark, 0, -0.11, 0.12);
    box(0.08, 0.1, 0.2, body, 0, -0.02, 0.32);
    len = 0.26;
  } else { // long DMR with scope
    box(0.06, 0.08, 0.6, body);
    box(0.035, 0.035, 0.26, body, 0, 0, -0.42);
    box(0.05, 0.05, 0.2, dark, 0, 0.075, 0);
    box(0.062, 0.015, 0.5, accent, 0, -0.045, 0);
    box(0.045, 0.12, 0.05, dark, 0, -0.1, 0.08);
    box(0.06, 0.1, 0.18, body, 0, -0.02, 0.36);
    len = 0.55;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -len);
  g.add(muzzle);
  return { group: g, muzzle };
}

export class Viewmodel {
  readonly root = new THREE.Group();
  private gun: THREE.Group | null = null;
  private muzzle: THREE.Object3D | null = null;
  private flash: THREE.Sprite;
  private key = '';
  private kick = 0;
  private swap = 0;
  private bob = 0;
  reloading = 0; // 0..1 progress, set by game
  moving = 0;

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
    if (this.gun) this.root.remove(this.gun);
    const { group, muzzle } = buildGun(weapon, skin);
    group.scale.setScalar(0.72);
    this.gun = group;
    this.muzzle = muzzle;
    this.root.add(group);
    this.swap = 1;
  }

  fire() {
    this.kick = 1;
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * Math.PI;
    setTimeout(() => (this.flash.visible = false), 40);
  }

  update(dt: number) {
    if (!this.gun) return;
    this.kick = Math.max(0, this.kick - dt * 9);
    this.swap = Math.max(0, this.swap - dt * 5);
    this.bob += dt * (4 + this.moving * 5);
    const bobY = Math.sin(this.bob * 2) * 0.006 * this.moving, bobX = Math.cos(this.bob) * 0.008 * this.moving;
    const rel = Math.sin(this.reloading * Math.PI);
    this.gun.position.set(0.17 + bobX, -0.16 + bobY - this.swap * 0.2 - rel * 0.1, -0.4 + this.kick * 0.05);
    this.gun.rotation.set(this.kick * 0.12 + rel * 0.6, 0.04, rel * 0.4);
    if (this.muzzle) this.flash.position.copy(this.muzzle.getWorldPosition(new THREE.Vector3()));
  }
}

// ---------- avatar ----------

class Avatar {
  readonly root = new THREE.Group();
  readonly aim = new THREE.Group();
  muzzle = new THREE.Object3D();
  readonly char: number;
  readonly team: Team;
  private gunKey = '';
  private gun: THREE.Group | null = null;
  private plate: THREE.Sprite;
  private plateCtx: CanvasRenderingContext2D;
  private plateKey = '';

  constructor(p: PlayerSnap) {
    this.char = p.char;
    this.team = p.team;
    const teamCol = TEAM_COLOR[p.team];
    const suit = toon(p.char === 0 ? 0xeef2f6 : 0x2c3442);
    const trim = toon(teamCol, teamCol);
    const skin = toon(0xffe1d0);
    const hair = toon(p.char === 0 ? 0x9fd8ff : 0xffb347);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.6, 4, 12), suit);
    body.position.y = 0.95;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 20), trim);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.82;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 10), suit);
    legs.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), skin);
    head.position.y = 1.6;
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.y = 1.62;
    hairCap.rotation.x = -0.25;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.05), trim);
    visor.position.set(0, 1.62, -0.19);
    this.root.add(body, belt, legs, head, hairCap, visor);

    if (p.char === 0) {
      // Aster: floating parhelion halo
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 28), toon(0xfff2b0, 0xffe58a));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 1.95;
      this.root.add(halo);
    } else {
      // Vega: twin ear fins and a ponytail
      for (const sx of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 4), trim);
        fin.position.set(sx * 0.18, 1.78, 0.02);
        fin.rotation.z = -sx * 0.5;
        this.root.add(fin);
      }
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), hair);
      tail.position.set(0, 1.45, 0.24);
      tail.rotation.x = 0.4;
      this.root.add(tail);
    }

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 28), new THREE.MeshBasicMaterial({ color: teamCol, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.root.add(blob, ring);

    this.aim.position.set(0, 1.35, 0);
    this.root.add(this.aim);

    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    this.plateCtx = c.getContext('2d')!;
    this.plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    this.plate.scale.set(1.2, 0.3, 1);
    this.plate.position.y = 2.25;
    this.plate.renderOrder = 10;
    this.root.add(this.plate);
  }

  /** Allies' nameplates show through walls; enemies' never do. */
  setAlly(ally: boolean) {
    this.plate.material.depthTest = !ally;
  }

  setWeapon(weapon: number, skin: number) {
    const k = `${weapon}:${skin}`;
    if (k === this.gunKey) return;
    this.gunKey = k;
    if (this.gun) this.aim.remove(this.gun);
    const { group, muzzle } = buildGun(weapon, skin);
    group.position.set(0.24, 0, -0.25);
    group.scale.setScalar(1.3);
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
