import * as THREE from 'three';

/** Stabilize translation in shadow-texel space without changing resolution,
 * coverage, update frequency or the authored direction of sunlight. */
export class StabilizedSunShadow {
  private readonly direction = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  update(light: THREE.DirectionalLight, focus: THREE.Vector3, sunDirection: THREE.Vector3, distance = 200): void {
    this.direction.copy(sunDirection);
    if (this.direction.lengthSq() < 1e-12) this.direction.set(0, 1, 0);
    this.direction.normalize();
    const camera = light.shadow.camera;
    this.right.crossVectors(camera.up, this.direction);
    if (this.right.lengthSq() < 1e-12) this.right.set(1, 0, 0);
    this.right.normalize();
    this.up.crossVectors(this.direction, this.right).normalize();
    this.center.copy(focus);
    const texelX = (camera.right - camera.left) / (camera.zoom * light.shadow.mapSize.x);
    const texelY = (camera.top - camera.bottom) / (camera.zoom * light.shadow.mapSize.y);
    if (texelX > 0 && Number.isFinite(texelX)) {
      const x = focus.dot(this.right);
      this.center.addScaledVector(this.right, Math.round(x / texelX) * texelX - x);
    }
    if (texelY > 0 && Number.isFinite(texelY)) {
      const y = focus.dot(this.up);
      this.center.addScaledVector(this.up, Math.round(y / texelY) * texelY - y);
    }
    light.target.position.copy(this.center);
    light.position.copy(this.center).addScaledVector(this.direction, distance);
  }
}

export interface LocalLightDefinition {
  p: readonly [number, number, number]; color: THREE.ColorRepresentation;
  intensity: number; distance: number; decay?: number;
}
interface Candidate {
  index: number; sphere: THREE.Sphere; color: THREE.Color;
  intensity: number; distance: number; decay: number;
  edgeDistance: number; nearby: boolean; inView: boolean;
}

/** Fixed shader-light count: visible near-influence lamps win, then farther
 * in-frustum influence spheres. Behind-camera lamps near the player are protected
 * too, since they can illuminate visible geometry. No authored brightness changes.
 * Slots are never hidden or removed, so crossing regions changes uniforms rather
 * than NUM_POINT_LIGHTS shader variants. Finite-range sources only. */
export class LocalPointLightPool {
  readonly root = new THREE.Group();
  readonly lights: readonly THREE.PointLight[];
  private readonly candidates: Candidate[];
  private readonly ranked: Candidate[];
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly nearRadius: number;
  readonly selected: number[] = [];
  nearbyCount = 0;
  nearbyOverflow = 0;
  constructor(definitions: readonly LocalLightDefinition[], options: { capacity?: number; nearRadius?: number } = {}) {
    const capacity = options.capacity ?? 8;
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Local light capacity must be a positive integer');
    this.nearRadius = options.nearRadius ?? 160;
    if (!Number.isFinite(this.nearRadius) || this.nearRadius < 0) throw new Error('Invalid local light near radius');
    this.root.name = 'LocalPointLightPool';
    this.candidates = definitions.map((definition, index) => {
      if (definition.p.some(value => !Number.isFinite(value)) || !Number.isFinite(definition.distance) || definition.distance <= 0 ||
        !Number.isFinite(definition.intensity) || definition.intensity < 0 || !Number.isFinite(definition.decay ?? 1.6)) {
        throw new Error('Local lights require finite positions, intensity and positive finite influence distance');
      }
      return { index, sphere: new THREE.Sphere(new THREE.Vector3(...definition.p), definition.distance),
        color: new THREE.Color(definition.color), intensity: definition.intensity, distance: definition.distance,
        decay: definition.decay ?? 1.6, edgeDistance: 0, nearby: false, inView: false };
    });
    this.ranked = this.candidates.slice();
    this.lights = Array.from({ length: capacity }, (_, index) => {
      const light = new THREE.PointLight(0xffffff, 0, 1, 1.6);
      light.name = `LocalLightSlot:${index}`; light.castShadow = false;
      this.root.add(light); return light;
    });
  }
  update(camera: THREE.Camera): void {
    camera.updateWorldMatrix(true, false);
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection, camera.coordinateSystem, camera.reversedDepth);
    this.nearbyCount = 0;
    for (const candidate of this.candidates) {
      candidate.edgeDistance = Math.max(0, candidate.sphere.center.distanceTo(this.cameraPosition) - candidate.distance);
      candidate.nearby = candidate.edgeDistance <= this.nearRadius;
      candidate.inView = this.frustum.intersectsSphere(candidate.sphere);
      if (candidate.nearby) this.nearbyCount++;
    }
    this.ranked.sort((a, b) => Number(b.nearby) - Number(a.nearby) ||
      (a.nearby ? 0 : Number(b.inView) - Number(a.inView)) || a.edgeDistance - b.edgeDistance || a.index - b.index);
    this.nearbyOverflow = Math.max(0, this.nearbyCount - this.lights.length);
    this.selected.length = 0;
    for (let index = 0; index < this.lights.length; index++) {
      const light = this.lights[index], candidate = this.ranked[index];
      if (!candidate) { light.intensity = 0; continue; }
      this.selected.push(candidate.index);
      light.position.copy(candidate.sphere.center); light.color.copy(candidate.color);
      light.intensity = candidate.intensity; light.distance = candidate.distance; light.decay = candidate.decay;
    }
  }
}
