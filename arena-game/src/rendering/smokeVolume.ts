/** Depth-clipped smoke, composited before outlines/bloom and the first-person weapon.
 * Characters keep their normal opaque materials and animation; smoke never toggles them.
 * Analytic integration avoids billboard sorting and ray-marching noise at cloud boundaries.
 */
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMOKE, TICK_HZ } from '../../shared/content.ts';
import { smokeCentre, type Smoke } from '../../shared/grenade.ts';

export function smokeEnvelope(s: Smoke, since = 0): number {
  if (s.life <= 0 || (s.delay ?? 0) > 0) return 0;
  if (s.box) return 1;
  const elapsed = Number.isFinite(since) ? Math.max(0, Math.min(.12, since)) : 0;
  const age = (SMOKE.life - s.life) / TICK_HZ + elapsed;
  const left = s.life / TICK_HZ - elapsed;
  return Math.max(0, Math.min(1, age / .7)) * Math.max(0, Math.min(1, left / 1.5));
}

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const fragmentShader = `
uniform sampler2D tDiffuse, tDepth;
uniform mat4 inverseProjection, cameraWorld;
uniform int count;
uniform vec4 centres[SMOKE_CAPACITY]; // xyz centre, density envelope
uniform vec4 shapes[SMOKE_CAPACITY]; // half extents, yaw (zero extents = sphere)
uniform float time, radius;
varying vec2 vUv;

vec3 localPoint(vec3 p, float yaw) {
  float c = cos(yaw), s = sin(yaw);
  return vec3(p.x*c-p.z*s, p.y, p.x*s+p.z*c);
}
bool slab(float o, float d, float extent, inout float lo, inout float hi) {
  if (abs(d) < .000001) return abs(o) <= extent;
  float a = (-extent-o)/d, b = (extent-o)/d;
  lo = max(lo, min(a,b)); hi = min(hi, max(a,b));
  return hi > lo;
}
void main() {
  vec4 colour = texture2D(tDiffuse, vUv);
  float depth = texture2D(tDepth, vUv).x;
  // Preserve the scene depth for the following outline pass (not the fullscreen quad).
  gl_FragDepth = depth;
  vec4 view = inverseProjection * vec4(vUv*2.-1., depth*2.-1., 1.);
  vec3 origin = cameraWorld[3].xyz;
  vec3 end = (cameraWorld * vec4(view.xyz/view.w, 1.)).xyz;
  float distanceToSurface = length(end-origin);
  vec3 ray = (end-origin)/max(distanceToSurface, .000001);
  float opticalDepth = 0.;
  vec3 smokeColour = vec3(.52,.57,.63);
  float nearestEntry = 1.e10;
  for (int i=0; i<SMOKE_CAPACITY; i++) {
    if (i >= count) break;
    vec3 offset = origin-centres[i].xyz;
    float lo = 0., hi = distanceToSurface, density = 0.;
    if (shapes[i].x > 0.) {
      vec3 o = localPoint(offset, shapes[i].w), d = localPoint(ray, shapes[i].w);
      if (!slab(o.x,d.x,shapes[i].x,lo,hi) ||
          !slab(o.y,d.y,shapes[i].y,lo,hi) ||
          !slab(o.z,d.z,shapes[i].z,lo,hi)) continue;
      density = (hi-lo)*6.;
    } else {
      float along = dot(offset,ray);
      float perpendicular2 = max(0., dot(offset,offset)-along*along);
      float radial = 1.-perpendicular2/(radius*radius);
      if (radial <= 0.) continue;
      float halfChord = radius*sqrt(radial);
      lo = max(0., -along-halfChord);
      hi = min(distanceToSurface, -along+halfChord);
      if (hi <= lo) continue;
      // Integrate the smooth radial density 1-r^2/R^2 along the visible segment.
      float a = lo+along, b = hi+along;
      density = max(0., radial*(hi-lo)-(b*b*b-a*a*a)/(3.*radius*radius))*3.;
    }
    density *= centres[i].w;
    // Once the ray is opaque, its colour must not depend on a hidden character's depth.
    if (lo < nearestEntry) {
      nearestEntry = lo;
      vec3 p = origin + ray*(lo+1.);
      float billow = sin(p.x*2.3+time*.17)*sin(p.y*1.8-time*.13)*sin(p.z*2.1+time*.11);
      smokeColour = (shapes[i].x > 0. ? vec3(.24,.29,.33) : vec3(.52,.57,.63)) + billow*.035;
    }
    opticalDepth += density;
  }
  // Exact opacity in dense smoke: no faint silhouette, shadow or outline leaking through.
  float transmission = exp(-opticalDepth)*(1.-smoothstep(3.,6.,opticalDepth));
  gl_FragColor = vec4(mix(smokeColour,colour.rgb,transmission),colour.a);
}`;

export class SmokeVolumePass extends ShaderPass {
  private capacity = 8;
  constructor(private camera: THREE.PerspectiveCamera) {
    super({
      defines: { SMOKE_CAPACITY: 8 },
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null },
        inverseProjection: { value: new THREE.Matrix4() }, cameraWorld: { value: new THREE.Matrix4() },
        centres: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
        shapes: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
        count: { value: 0 }, time: { value: 0 }, radius: { value: SMOKE.radius },
      }, vertexShader, fragmentShader,
    });
    this.enabled = false;
    this.material.depthTest = true;
    this.material.depthWrite = true;
    this.material.depthFunc = THREE.AlwaysDepth;
  }

  sync(smokes: readonly Smoke[], since: number) {
    // Grow for unusually crowded matches instead of silently dropping an active cloud.
    if (smokes.length > this.capacity) {
      while (smokes.length > this.capacity) this.capacity *= 2;
      for (const key of ['centres', 'shapes'])
        this.uniforms[key].value = Array.from({ length: this.capacity }, () => new THREE.Vector4());
      this.material.defines.SMOKE_CAPACITY = this.capacity;
      this.material.needsUpdate = true;
    }
    let count = 0;
    for (const s of smokes) {
      const envelope = smokeEnvelope(s, since);
      if (envelope <= 0) continue;
      const centre = s.box ? [s.x, s.y+s.box.height/2, s.z] : smokeCentre(s);
      this.uniforms.centres.value[count].set(...centre, envelope);
      const box = s.box;
      this.uniforms.shapes.value[count].set(box ? box.width/2 : 0, box ? box.height/2 : 0, box ? box.depth/2 : 0, box?.yaw ?? 0);
      count++;
    }
    this.uniforms.count.value = count;
    this.enabled = count > 0;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    this.uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
    this.uniforms.cameraWorld.value.copy(this.camera.matrixWorld);
    this.uniforms.time.value = performance.now()/1000;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

/** Nameplates hide immediately and only return after a consistently clear sight line. */
export class SmokeNameplate {
  private clearSince = -Infinity;
  private hidden = false;
  update(blocked: boolean, now: number) {
    if (blocked) { this.hidden = true; this.clearSince = now; }
    else if (now - this.clearSince >= .12) this.hidden = false;
    return this.hidden;
  }
}
