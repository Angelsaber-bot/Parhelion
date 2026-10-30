import * as THREE from 'three';
import { ultimateEnergyGeometry } from './ultimateEnergy';
interface ArtFrame { elapsed: number; phase: 'intro'|'charge'|'release'|'outro'; progress: number; pulse: number; strikeCount?: number; reduced?: boolean; }
interface Owner {
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh;
  material(color: number, opacity: number): THREE.MeshBasicMaterial;
}
/** Original, bounded presentation art. Samples the stage clone only; never adjudicates a hit. */
export class SaberStageArt {
  readonly root = new THREE.Group();
  readonly tip = new THREE.Vector3(); readonly grip = new THREE.Vector3();
  private socket?: THREE.Object3D;
  private shadow: THREE.Mesh; private glow: THREE.Mesh; private core: THREE.Mesh; private wave: THREE.Mesh; private spark: THREE.Mesh;
  private trail: THREE.Mesh; private trailPositions: THREE.BufferAttribute;
  private trailTips = Array.from({ length: 8 }, () => new THREE.Vector3());
  private trailGrips = Array.from({ length: 8 }, () => new THREE.Vector3());
  private origin = new THREE.Vector3(); private direction = new THREE.Vector3(0, 0, 1);
  private unitY = new THREE.Vector3(0, 1, 0); private bladeDirection = new THREE.Vector3();
  private point = new THREE.Vector3(); private cameraDirection = new THREE.Vector3(); private normal = new THREE.Vector3();
  private basis = new THREE.Matrix4(); private xAxis = new THREE.Vector3();
  private waveStarted = false; private age = 10; private lastTime = 0; private count = 0; private lastPulse = 0; private trailReady = false;
  private curtains: THREE.Mesh[] = []; private motes: THREE.Mesh[] = [];
  constructor(private actor: THREE.Group, private clone: THREE.Object3D, private owner: Owner) {
    this.root.name = 'Saber: sacred shore, sword light and impact';
    this.socket = clone.getObjectByName('WeaponSocket_R') ?? clone.getObjectByName('mixamorigRightHand');
    actor.updateMatrixWorld(true); this.socket?.getWorldPosition(this.grip);
    const groundLight = owner.material(0x385b70, .35); groundLight.vertexColors = true;
    const pool = owner.mesh(radialGeometry(3.2), groundLight, this.root); pool.rotation.x = -Math.PI / 2; pool.scale.y = 1.5; pool.position.set(0, -.033, -.5);
    const shadowMat = owner.material(0x000509, .72); shadowMat.vertexColors = true;
    this.shadow = owner.mesh(radialGeometry(1), shadowMat, this.root); this.shadow.name = 'Saber contact shadow';
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.set(1.05, .55, 1); this.shadow.position.y = -.025;
    // A restrained horizon and layered side veils make scale and depth legible, not a generic ring arena.
    for (let i = 0; i < 3; i++) {
      const mat = owner.material(i === 0 ? 0x598995 : 0x214454, .20); mat.vertexColors = true;
      const strip = owner.mesh(softPanelGeometry(36, .45 + i * .3), mat, this.root);
      strip.position.set(0, .02 + i * .025, -5 - i * 6); strip.rotation.x = -Math.PI / 2;
    }
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const mat = owner.material(i === 0 ? 0x95c5cf : 0x244455, .18); mat.vertexColors = true;
      const curtain = owner.mesh(softPanelGeometry(.6 + i * .5, 10), mat, this.root);
      curtain.position.set(side * (3.8 + i * 2.3), 3.5, -3 - i * 5); curtain.rotation.z = side * -.18;
      this.curtains.push(curtain);
    }
    const energy = owner.material(0xffe7ac, .88); energy.vertexColors = true; energy.toneMapped = false;
    this.glow = owner.mesh(ultimateEnergyGeometry('lance'), energy, this.root); this.glow.name = 'Saber sword-linked gathering';
    const coreMaterial = owner.material(0xfff8e7, .98); coreMaterial.vertexColors = true; coreMaterial.toneMapped = false;
    this.core = owner.mesh(this.glow.geometry, coreMaterial, this.root); this.core.name = 'Saber white-gold blade core';
    const releaseMaterial = owner.material(0xffefc3, .9); releaseMaterial.vertexColors = true; releaseMaterial.toneMapped = false;
    this.wave = owner.mesh(ultimateEnergyGeometry('lance'), releaseMaterial, this.root); this.wave.name = 'Saber contact-driven sword wave'; this.wave.visible = false;
    const sparkMaterial = owner.material(0xfff4d2, .8); sparkMaterial.vertexColors = true; sparkMaterial.toneMapped = false;
    this.spark = owner.mesh(radialGeometry(1), sparkMaterial, this.root); this.spark.name = 'Saber local impact glint'; this.spark.visible = false;
    const trailGeometry = new THREE.BufferGeometry(), colors = new Float32Array(8 * 3 * 4), indices: number[] = [];
    this.trailPositions = new THREE.BufferAttribute(new Float32Array(8 * 3 * 3), 3); this.trailPositions.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) { const v = (i * 3 + j) * 4; colors.set([1, .91, .62, j === 1 ? (1 - i / 8) * .65 : 0], v); }
    for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
    trailGeometry.setAttribute('position', this.trailPositions); trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 4)); trailGeometry.setIndex(indices);
    const trailMaterial = owner.material(0xffe3a0, .72); trailMaterial.vertexColors = true; trailMaterial.toneMapped = false;
    this.trail = owner.mesh(trailGeometry, trailMaterial, this.root); this.trail.name = 'Saber sampled blade motion trail'; this.trail.frustumCulled = false;
    const moteGeometry = radialGeometry(.09), moteMaterial = owner.material(0xffd68b, .5); moteMaterial.vertexColors = true;
    for (let i = 0; i < 12; i++) { const mote = owner.mesh(moteGeometry, moteMaterial, this.root); this.motes.push(mote); }
  }
  update(frame: ArtFrame, camera: THREE.Camera, reduced: boolean = false) {
    const dt = Math.max(0, Math.min(.1, frame.elapsed - this.lastTime)); this.lastTime = frame.elapsed; this.age += dt;
    this.actor.updateMatrixWorld(true);
    if (this.socket) this.socket.getWorldPosition(this.grip); else this.grip.set(0, 1.4, .2);
    if (this.socket) this.tip.set(0, 1.647, 0).applyMatrix4(this.socket.matrixWorld);
    else this.tip.copy(this.grip).add(this.unitY);
    this.bladeDirection.copy(this.tip).sub(this.grip); const length = Math.max(.1, this.bladeDirection.length()); this.bladeDirection.multiplyScalar(1 / length);
    const nextCount = frame.strikeCount ?? (frame.pulse > .2 && this.lastPulse <= .2 ? this.count + 1 : this.count);
    if (frame.phase === 'release' && nextCount > this.count) {
      this.count = nextCount; this.age = 0; this.waveStarted = false; this.origin.copy(this.tip);
      // Capture the actual sword's contact point. Flight is a visual continuation, not a collision path.
      this.direction.set(.25, .02, 1).normalize();
    }
    this.lastPulse = frame.pulse;
    const charge = frame.phase === 'charge', release = frame.phase === 'release', releaseVisual = (release || frame.phase === 'outro') && this.count > 0, fade = Math.max(0, 1 - this.age / .65);
    this.glow.visible = charge || (releaseVisual && this.age < .35);
    this.glow.position.copy(this.grip).add(this.tip).multiplyScalar(.5);
    this.faceBlade(this.glow, this.bladeDirection, camera);
    this.glow.position.addScaledVector(this.cameraDirection, .025);
    this.glow.scale.set((charge ? .09 + frame.progress * .42 : .12 * fade) * (reduced ? .65 : 1), length / 12 * 1.12, 1);
    this.core.visible = this.glow.visible; this.core.position.copy(this.glow.position).addScaledVector(this.cameraDirection, .025); this.core.quaternion.copy(this.glow.quaternion);
    this.core.scale.set(charge ? .07 + frame.progress * .065 : .08 * fade, length / 12 * 1.08, 1);
    (this.core.material as THREE.MeshBasicMaterial).opacity = (reduced ? .48 : .65 + (charge ? frame.progress : fade) * .33);
    this.shadow.position.x = this.actor.position.x; this.shadow.position.z = this.actor.position.z;
    if (releaseVisual && this.age >= .10 && this.age < .65 && !this.waveStarted) { this.origin.copy(this.tip); this.waveStarted = true; }
    this.wave.visible = releaseVisual && this.waveStarted && this.age < .65;
    const flightAge = Math.max(0, this.age - .10), travel = reduced ? flightAge * 4 : flightAge * 9;
    this.wave.position.copy(this.origin).addScaledVector(this.direction, travel + 1.6);
    this.faceBlade(this.wave, this.direction, camera); this.wave.scale.set((.24 + this.age * .75) * fade, (.3 + this.age * .45), 1);
    (this.wave.material as THREE.MeshBasicMaterial).opacity = (reduced ? .5 : .9) * fade;
    this.spark.visible = (charge && frame.progress > .2) || (releaseVisual && this.age < .22); this.spark.position.copy(charge ? this.grip : this.tip); this.spark.quaternion.copy(camera.quaternion);
    this.spark.scale.setScalar(charge ? .12 + frame.progress * .14 : (reduced ? .22 : .42) * (1 + this.age * 3));
    (this.spark.material as THREE.MeshBasicMaterial).opacity = charge ? (reduced ? .2 : .25 + frame.progress * .25) : Math.max(0, 1 - this.age / .22) * (reduced ? .3 : .7);
    if (!this.trailReady) { for (let i = 0; i < 8; i++) { this.trailTips[i].copy(this.tip); this.trailGrips[i].copy(this.grip); } this.trailReady = true; }
    if (dt > 0) { for (let i = 7; i > 0; i--) { this.trailTips[i].copy(this.trailTips[i - 1]); this.trailGrips[i].copy(this.trailGrips[i - 1]); } this.trailTips[0].copy(this.tip); this.trailGrips[0].copy(this.grip); }
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) { this.point.lerpVectors(this.trailGrips[i], this.trailTips[i], j / 2); this.trailPositions.setXYZ(i * 3 + j, this.point.x, this.point.y, this.point.z); }
    this.trailPositions.needsUpdate = true; this.trail.visible = releaseVisual && this.age < .45 && !reduced;
    for (let i = 0; i < this.motes.length; i++) {
      const mote = this.motes[i]; mote.visible = charge && (!reduced || i % 3 === 0);
      const t = ((frame.elapsed * .55 + i / 12) % 1), radius = (1 - t) * (.5 + (i % 3) * .15), angle = i * 2.399 + frame.elapsed * .4;
      mote.position.copy(this.grip).lerp(this.tip, t); mote.position.x += Math.cos(angle) * radius; mote.position.z += Math.sin(angle) * radius;
      mote.quaternion.copy(camera.quaternion); mote.scale.setScalar(.35 + t * .5);
    }
  }
  private faceBlade(mesh: THREE.Mesh, axis: THREE.Vector3, camera: THREE.Camera) {
    this.cameraDirection.copy(camera.position).sub(mesh.position).normalize();
    this.xAxis.crossVectors(axis, this.cameraDirection).normalize(); if (this.xAxis.lengthSq() < .01) this.xAxis.set(1, 0, 0);
    this.normal.crossVectors(this.xAxis, axis).normalize(); this.basis.makeBasis(this.xAxis, axis, this.normal); mesh.quaternion.setFromRotationMatrix(this.basis);
  }
  dispose() { this.root.clear(); this.socket = undefined;  this.trailTips = []; this.trailGrips = []; this.curtains = []; this.motes = []; }
}
export function radialGeometry(radius: number) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], segments = 32;
  for (let ring = 0; ring < 4; ring++) for (let i = 0; i <= segments; i++) { const a = i / segments * Math.PI * 2, r = radius * ring / 3; positions.push(Math.cos(a) * r, Math.sin(a) * r, 0); colors.push(1, 1, 1, [1, .55, .12, 0][ring]); }
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < segments; i++) { const a = ring * (segments + 1) + i, b = a + segments + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); geometry.setIndex(indices); return geometry;
}
function softPanelGeometry(width: number, height: number) {
  const geometry = new THREE.PlaneGeometry(width, height, 4, 4), colors: number[] = [];
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) { const x = positions.getX(i) / width * 2, y = positions.getY(i) / height * 2; colors.push(1, 1, 1, Math.pow(Math.max(0, 1 - Math.abs(x)), .8) * Math.max(0, 1 - Math.abs(y))); }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); return geometry;
}
