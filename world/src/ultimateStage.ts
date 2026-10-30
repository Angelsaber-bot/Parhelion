import * as THREE from 'three';
import { createUltimatePerformance, type UltimatePerformanceFrame } from './ultimatePerformance';
import { SaberStageArt } from './saberStageArt';
import { ultimateEnergyGeometry } from './ultimateEnergy';
import { buildMaritimeShip } from '../tools/gen/blacksail/ships';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
export type UltimateStagePhase = 'intro' | 'charge' | 'release' | 'outro';
export interface UltimateStageBegin { identity: string; sourceRoot: THREE.Object3D; clips?: readonly THREE.AnimationClip[]; reducedEffects?: boolean; }
export interface UltimateStageFrame { elapsed: number; phase: UltimateStagePhase; progress: number; pulse: number; sourceRoot?: THREE.Object3D; reduced?: boolean; strikeCount?: number; }
const palettes: Record<string, [number, number, number]> = {
  saber: [0x061d36, 0x81e8ff, 0xffdf85], blackbeard: [0x07141e, 0xf5ac52, 0x6ec1d3],
  napoleon: [0x233248, 0xffe5a1, 0xf5f7ff], musashi: [0xc5bcbc, 0xb6284d, 0x2678af],
};
const clamp = (n: number) => THREE.MathUtils.clamp(Number.isFinite(n) ? n : 0, 0, 1);
/** Isolated full-canvas presentation: no gameplay events or ownership of source assets. */
export class UltimateStage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, .05, 180);
  private actor = new THREE.Group(); private effects = new THREE.Group();
  // Weak identity cache: repeated casts avoid CPU-skinning every vertex for framing.
  // Replaced/outfit models get new keys; cache values never retain source resources.
  private framing = new WeakMap<THREE.Object3D, { scale: number; offsetY: number }>();
  private sourceRoot?: THREE.Object3D; private clone?: THREE.Object3D; private pairs: [THREE.Object3D, THREE.Object3D][] = [];
  private releasePose: { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }[] = [];
  private previousPhase: UltimateStagePhase = 'intro'; private releaseBlendElapsed = .14;
  private mixer?: THREE.AnimationMixer; private idleAction?: THREE.AnimationAction; private chargeAction?: THREE.AnimationAction; private charging = false;
  private geometries = new Set<THREE.BufferGeometry>(); private materials = new Set<THREE.Material>();
  private beams: THREE.Mesh[] = []; private rings: THREE.Mesh[] = []; private streaks: THREE.Mesh[] = [];
  private performance?: ReturnType<typeof createUltimatePerformance>;
  private performanceFrame: UltimatePerformanceFrame = { phase: 'intro', progress: 0, elapsed: 0, strikeCount: 0, reduced: false };
  private saberArt?: SaberStageArt;
  private ship?: THREE.Group; private identity = ''; private reduced = false; private active = false; private lastElapsed = 0;
  private baseCameraPosition = new THREE.Vector3(); private narrowWeight = 0;
  private aim = new THREE.Vector3(); private viewport = new THREE.Vector4(); private scissor = new THREE.Vector4();
  private clearColor = new THREE.Color(); private size = new THREE.Vector2();
  get isActive() { return this.active; }
  get resourceCounts() { return { geometries: this.geometries.size, materials: this.materials.size, actors: this.clone ? 1 : 0 }; }
  begin(options: UltimateStageBegin) {
    this.end(); this.identity = options.identity.toLowerCase().replace('napoleonmounted', 'napoleon'); this.reduced = !!options.reducedEffects;
    const colors = palettes[this.identity] ?? palettes.saber;
    this.scene.background = new THREE.Color(colors[0]); this.scene.fog = new THREE.Fog(colors[0], 20, 70);
    this.scene.add(new THREE.HemisphereLight(0xe6f3ff, colors[0], 2.8));
    const key = new THREE.DirectionalLight(0xfff4df, 3.5); key.position.set(-3, 6, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(colors[1], 3); rim.position.set(3, 3, -4); this.scene.add(rim);
    this.actor = new THREE.Group(); this.effects = new THREE.Group(); this.scene.add(this.actor, this.effects);
    this.sourceRoot = options.sourceRoot; this.clone = cloneSkeleton(options.sourceRoot); this.clone.position.set(0, 0, 0); this.clone.quaternion.identity(); this.clone.visible = true; this.actor.add(this.clone);
    const originals: THREE.Object3D[] = [], copies: THREE.Object3D[] = [];
    options.sourceRoot.traverse(o => originals.push(o)); this.clone.traverse(o => {
      copies.push(o); if ((o as THREE.Mesh).isMesh) { o.frustumCulled = false; (o as THREE.Mesh).castShadow = false; (o as THREE.Mesh).receiveShadow = false; }
    });
    this.pairs = originals.map((o, i) => [o, copies[i]]);
    this.releasePose = copies.map(o => ({ position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() }));
    this.clone.updateMatrixWorld(true);
    let framing = this.framing.get(options.sourceRoot);
    if (!framing) {
      const head = this.identity === 'saber' ? this.clone.getObjectByName('mixamorigHeadTop_End') : undefined;
      const left = this.clone.getObjectByName('mixamorigLeftToe_End'), right = this.clone.getObjectByName('mixamorigRightToe_End');
      if (head && left && right) {
        // Intentionally frame the BODY, not the raised weapon. This also avoids a first-cast full skin scan.
        const headY = head.getWorldPosition(new THREE.Vector3()).y;
        const footY = Math.min(left.getWorldPosition(new THREE.Vector3()).y, right.getWorldPosition(new THREE.Vector3()).y);
        const span = Math.max(.1, headY - footY), floor = footY - span * .018, top = headY + span * .025;
        const scale = 2.8 / (top - floor); framing = { scale, offsetY: -floor * scale };
      } else {
        const bounds = new THREE.Box3().setFromObject(this.clone), extent = bounds.getSize(new THREE.Vector3());
        const scale = Number.isFinite(extent.y) && extent.y > .01 ? 2.8 / extent.y : 1;
        framing = { scale, offsetY: Number.isFinite(bounds.min.y) ? -bounds.min.y * scale : 0 };
      }
      this.framing.set(options.sourceRoot, framing);
    }
    this.actor.scale.setScalar(framing.scale); this.actor.position.y = framing.offsetY;
    this.performance = createUltimatePerformance(this.identity, this.clone);
    if (options.clips?.length) {
      this.mixer = new THREE.AnimationMixer(this.clone);
      this.idleAction = this.mixer.clipAction(options.clips.find(c => /idle|stand/i.test(c.name)) ?? options.clips[0]); this.idleAction.play();
      const attack = options.clips.find(c => /attack/i.test(c.name));
      if (attack) { this.chargeAction = this.mixer.clipAction(attack); this.chargeAction.setLoop(THREE.LoopOnce, 1); this.chargeAction.clampWhenFinished = true; }
    }
    const glow = this.material(colors[1], .6), accent = this.material(colors[2], .8);
    const ground = this.mesh(new THREE.CircleGeometry(42, 64), this.material(colors[0], 1)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.04;
    // Distinct floor language: no shared concentric arena circles.
    const waveMaterial = this.identity === 'blackbeard' ? this.material(0x6293a5, .2) : undefined;
    if (waveMaterial) for (let i = 0; i < 8; i++) {
      const wave = this.mesh(new THREE.PlaneGeometry(30, .025), waveMaterial); wave.rotation.x = -Math.PI / 2; wave.position.set(0, .015, -i * 2.8);
    }
    if (this.identity === 'napoleon') for (const x of [-1.3, 1.3]) {
      const track = this.mesh(new THREE.PlaneGeometry(.05, 45), this.material(0xc6e2ec, .25)); track.rotation.x = -Math.PI / 2; track.position.set(x, .02, -12);
    }
    // Fixed pool: no geometry/material allocations on frames or impact pulses.
    for (let i = 0; i < 28; i++) {
      const petal = this.identity === 'musashi', snow = this.identity === 'napoleon';
      const streak = this.mesh(petal ? new THREE.PlaneGeometry(.055, .11) : new THREE.BoxGeometry(.012, .012, snow ? .08 : this.identity === 'saber' ? .18 : 1.5), i % 3 ? glow : accent);
      if (petal) streak.rotation.z = i * 1.7;
      const angle = i * 2.39996, radius = 4 + i % 7;
      streak.position.set(Math.cos(angle) * radius, .3 + i % 9, -12 + i % 5); this.streaks.push(streak);
    }
    const count = this.identity === 'saber' ? 0 : this.identity === 'blackbeard' ? 7 : this.identity === 'musashi' ? 2 : 1;
    const energyMaterials = (this.identity === 'blackbeard' ? [0xffd0a1] : [colors[2], colors[1]]).map(color => {
      const material = this.material(color, this.reduced ? .55 : .9); material.vertexColors = true; material.toneMapped = false; return material;
    });
    for (let i = 0; i < count; i++) {
      const slash = this.identity === 'musashi' || this.identity === 'napoleon';
      const geometry = ultimateEnergyGeometry(slash ? 'arc' : 'lance');
      const energy = energyMaterials[i % energyMaterials.length];
      const beam = this.mesh(geometry, energy);
      // Energy sheets face the audience, not down the viewing axis; no cylinder silhouette.
      beam.position.set((i - (count - 1) / 2) * .9, 1.3, slash ? .7 : -3);
      beam.rotation.z = slash ? 0 : this.identity === 'saber' ? -1.08 : -.08;
      if (this.identity === 'saber') beam.position.set(2.8, 1.3, -2);
      if (this.identity === 'blackbeard') { beam.rotation.x = Math.PI / 2; beam.rotation.z = .2; }
      beam.visible = false; this.beams.push(beam);
    }
    if (this.identity === 'blackbeard') this.buildShip(colors[1]);
    if (this.identity === 'saber') {
      this.saberArt = new SaberStageArt(this.actor, this.clone, {
        mesh: (geometry, material, parent) => this.mesh(geometry, material, parent),
        material: (color, opacity) => this.material(color, opacity),
      }); this.effects.add(this.saberArt.root);
    }
    if (this.identity === 'musashi') {
      const ink = this.material(0x342b35, .85);
      const circle = this.mesh(new THREE.TorusGeometry(3.8, .13, 5, 72, Math.PI * 1.85), ink); circle.position.set(0, 2.6, -6); circle.rotation.z = .2;
    }
    if (this.identity === 'napoleon') {
      const pillarMat = this.material(0xc3bb9b, .55);
      for (const x of [-7, 7]) for (let i = 0; i < 5; i++) {
        const pillar = this.mesh(new THREE.BoxGeometry(.35, 8, .35), pillarMat); pillar.position.set(x, 4, -i * 6);
        const banner = this.mesh(new THREE.PlaneGeometry(1.6, 3), i % 2 ? accent : glow); banner.position.set(x + (x < 0 ? .8 : -.8), 5.5, -i * 6);
      }
    }
    this.active = true; this.update({ elapsed: 0, phase: 'intro', progress: 0, pulse: 0 });
  }
  private material(color: number, opacity: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide, forceSinglePass: true }); this.materials.add(mat); return mat;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.effects) {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh;
  }
  private buildShip(_color: number) {
    this.ship = new THREE.Group(); this.ship.name = 'Original broadside silhouette'; this.effects.add(this.ship);
    // Reuse ONLY the existing handcrafted ship generator, not a map/terrain loader.
    const pieces = buildMaritimeShip('CinematicFlagship', 0, 0, 0, 42, 3.5,
      { hull: '#43352c', hullDark: '#1a2027', deck: '#97724d', sail: '#18232d', masts: 3, castle: true }, 0);
    for (const piece of pieces) {
      const merged = piece.batch.build();
      piece.batch.vis.forEach(g => g.dispose()); piece.batch.col.forEach(g => g.dispose()); merged.col?.dispose();
      if (!merged.vis) continue;
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: /Iron|Brass/.test(piece.name) ? .3 : 0, side: THREE.DoubleSide });
      this.materials.add(material); const mesh = this.mesh(merged.vis, material, this.ship); mesh.name = piece.name;
    }
    this.ship.scale.setScalar(.26); this.ship.rotation.y = .92; this.ship.position.set(0, -.7, -12);
  }
  update(frame: UltimateStageFrame) {
    if (!this.active) return;
    if (frame.sourceRoot && frame.sourceRoot !== this.sourceRoot) { this.end(); return; }
    // Accessibility may become more restrictive mid-cast, never brighter again until begin.
    if (frame.reduced && !this.reduced) {
      this.reduced = true;
      for (const material of this.materials) {
        const basic = material as THREE.MeshBasicMaterial;
        if (basic.isMeshBasicMaterial && basic.vertexColors) basic.opacity = Math.min(.55, basic.opacity);
      }
    }
    const p = clamp(frame.progress), elapsed = Number.isFinite(frame.elapsed) ? Math.max(0, frame.elapsed) : this.lastElapsed;
    const dt = Math.max(0, Math.min(.1, elapsed - this.lastElapsed)); this.lastElapsed = elapsed;
    const release = frame.phase === 'release', outro = frame.phase === 'outro';
    if (release || outro) {
      if (release && this.previousPhase === 'charge') {
        // Capture the last presented wind-up, not a recomputed pose. Buffers were allocated at begin.
        this.releaseBlendElapsed = 0;
        for (let i = 1; i < this.pairs.length; i++) {
          const copy = this.pairs[i][1], pose = this.releasePose[i];
          pose.position.copy(copy.position); pose.quaternion.copy(copy.quaternion); pose.scale.copy(copy.scale);
        }
      } else this.releaseBlendElapsed = Math.min(.14, this.releaseBlendElapsed + dt);
      const blend = this.identity === 'saber' && this.performance?.anchors.socket ? 1 : clamp(this.releaseBlendElapsed / .14);
      // Local visual poses only. The live caster/contact clock is never delayed or mutated.
      for (let i = 1; i < this.pairs.length; i++) {
        const [source, copy] = this.pairs[i];
        if (blend < 1) {
          const pose = this.releasePose[i]; copy.position.lerpVectors(pose.position, source.position, blend);
          copy.quaternion.slerpQuaternions(pose.quaternion, source.quaternion, blend); copy.scale.lerpVectors(pose.scale, source.scale, blend);
        } else { copy.position.copy(source.position); copy.quaternion.copy(source.quaternion); copy.scale.copy(source.scale); }
        copy.visible = source.visible;
      }
    } else if (frame.phase === 'charge' && this.chargeAction) {
      if (!this.charging) { this.idleAction?.stop(); this.chargeAction.reset().play(); this.charging = true; }
      // Independent wind-up sample only; actual release always follows the live caster.
      this.chargeAction.time = this.chargeAction.getClip().duration * .3 * p; this.mixer?.update(0);
    } else this.mixer?.update(dt);
    const pf = this.performanceFrame; pf.phase = frame.phase; pf.elapsed = elapsed; pf.progress = p; pf.strikeCount = frame.strikeCount; pf.reduced = this.reduced;
    this.performance?.update(pf);
    const mounted = this.identity === 'napoleon', close = frame.phase === 'intro';
    const distance = close ? THREE.MathUtils.lerp(mounted ? 3.4 : 2.4, mounted ? 3.9 : 2.9, p) : frame.phase === 'charge' ? THREE.MathUtils.lerp(4.3, 8, p) : mounted ? 7.2 : this.identity === 'saber' ? 7.35 : 7;
    const orbit = this.reduced ? .1 : close ? -.36 + p * .16 : release ? .35 - p * .5 : this.identity === 'blackbeard' ? -.35 + p * .7 : this.identity === 'musashi' ? -.2 + p * .5 : .12;
    this.camera.position.set(Math.sin(orbit) * distance, close ? 2.35 : 2.7 + (mounted ? .6 : 0), Math.cos(orbit) * distance);
    this.aim.set(0, close ? 2.05 : 1.45, release ? -1.3 : 0); this.camera.lookAt(this.aim);
    this.camera.fov = close ? 32 : 42;
    if (this.identity === 'saber') {
      // A close portrait, a low-angle gathering shot and a wider contact composition.
      // Reduced mode keeps the same readable endpoints without orbit or contact jolts.
      if (close) {
        this.camera.position.set(-.55, 2.60, 2.70 - p * .12); this.aim.set(0, 2.45, .02); this.camera.fov = 33;
      } else if (frame.phase === 'charge') {
        this.camera.position.set(this.reduced ? .4 : .65 + p * .4, 1.95 + p * .2, 6.4 - p * .35);
        this.aim.set(.4, 1.55 + p * .18, 0); this.camera.fov = 38;
      } else {
        this.camera.position.set(this.reduced ? .4 : 1.25 - p * .55, 2.10, 6.3);
        this.aim.set(.30, 1.53, .1); this.camera.fov = 38;
      }
      this.camera.lookAt(this.aim);
    }
    this.baseCameraPosition.copy(this.camera.position);
    this.narrowWeight = close ? 0 : frame.phase === 'charge' ? p : 1; this.setAspect(this.camera.aspect);
    this.actor.position.z = mounted && release ? -1 + p * 2 : 0;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i]; ring.rotation.z = elapsed * (i % 2 ? -.2 : .2); ring.scale.setScalar(release ? 1 + p * 3 : .9 + p * .15);
    }
    for (let i = 0; i < this.streaks.length; i++) {
      const streak = this.streaks[i]; streak.visible = !this.reduced || i % 3 === 0;
      streak.position.z = this.reduced ? -10 + i % 5 : -20 + ((elapsed * (release ? 12 : 2) + i * 1.7) % 26);
      if (this.identity === 'saber') streak.position.y = .3 + ((i + elapsed * .35) % 9);
      if (this.identity === 'musashi') { streak.rotation.z = i * 1.7 + (this.reduced ? 0 : elapsed * .3); streak.position.y = .3 + ((i + 9 - elapsed * .25 % 9) % 9); }
      if (this.identity === 'napoleon') streak.position.y = .3 + ((i + 9 - elapsed * .5 % 9) % 9);
    }
    const pulse = this.reduced ? Math.min(.2, clamp(frame.pulse)) : clamp(frame.pulse);
    for (let i = 0; i < this.beams.length; i++) {
      const beam = this.beams[i]; beam.visible = release && (p > .04 || pulse > 0); beam.scale.set(this.identity === 'blackbeard' ? .14 + pulse * .08 : .8 + pulse * .35, .4 + p * .6, 1);
      if (this.identity === 'musashi' || mounted) beam.scale.setScalar(.75 + p * .45 + pulse * .12);
      if (this.identity === 'musashi') { beam.rotation.z = (i ? -1 : 1) * (.5 + p * .8); beam.position.x = (i ? -1 : 1) * .65; }
      if (this.identity === 'napoleon') { beam.rotation.z = -.65 - p * .8; beam.position.y = 1.6; }
    }
    if (this.ship) this.ship.position.x = this.reduced ? 0 : Math.sin(elapsed * .4) * .3;
    this.actor.updateMatrixWorld(true); this.saberArt?.update(frame, this.camera, this.reduced); this.previousPhase = frame.phase;
  }
  /** Actor-only portrait protection; background/energy may intentionally leave the frame. */
  setAspect(aspect: number) {
    this.camera.aspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const portrait = THREE.MathUtils.clamp((1 - this.camera.aspect) / (1 - 9 / 16), 0, 1);
    const factor = 1 + portrait * this.narrowWeight * (this.identity === 'musashi' ? .35 : this.identity === 'saber' ? .40 : .12);
    this.camera.position.copy(this.baseCameraPosition).sub(this.aim).multiplyScalar(factor).add(this.aim);
    this.camera.lookAt(this.aim); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
  }
  render(renderer: THREE.WebGLRenderer, aspect: number) {
    if (!this.active) return;
    const target = renderer.getRenderTarget(), autoClear = renderer.autoClear;
    renderer.getViewport(this.viewport); renderer.getScissor(this.scissor);
    const scissorTest = renderer.getScissorTest(), alpha = renderer.getClearAlpha(); renderer.getClearColor(this.clearColor);
    try {
      this.setAspect(aspect);
      renderer.setRenderTarget(null); renderer.getSize(this.size); renderer.setViewport(0, 0, this.size.x, this.size.y);
      renderer.setScissorTest(false); renderer.autoClear = true; renderer.render(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(target); renderer.setViewport(this.viewport); renderer.setScissor(this.scissor);
      renderer.setScissorTest(scissorTest); renderer.setClearColor(this.clearColor, alpha); renderer.autoClear = autoClear;
    }
  }
  end() {
    this.active = false; this.performance?.dispose(); this.performance = undefined; this.saberArt?.dispose(); this.saberArt = undefined; this.mixer?.stopAllAction(); if (this.clone) this.mixer?.uncacheRoot(this.clone); this.mixer = undefined; this.idleAction = undefined; this.chargeAction = undefined; this.charging = false;
    // SkeletonUtils skeletons are private; source geometry/materials/textures are never disposed.
    const skeletons = new Set<THREE.Skeleton>(); this.clone?.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((o as THREE.SkinnedMesh).skeleton); }); skeletons.forEach(s => s.dispose());
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    this.geometries.clear(); this.materials.clear(); this.pairs = []; this.releasePose = []; this.previousPhase = 'intro'; this.releaseBlendElapsed = .14; this.beams = []; this.rings = []; this.streaks = [];
    this.actor.clear(); this.effects.clear();
    this.sourceRoot = undefined; this.clone = undefined; this.ship = undefined; this.scene.clear(); this.lastElapsed = 0;
  }
  dispose() { this.end(); this.framing = new WeakMap(); }
}
