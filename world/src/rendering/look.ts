import {orleansToonMaterial} from '../environment/orleansMaterials';
import {qinToonMaterial,qinMercuryMaterial} from '../environment/qinMaterials';
import {egyptToonMaterial} from '../environment/egyptMaterials';
// Toon look: banded lighting, inverted-hull outlines, and a sky with a 22° halo + sundogs
// (the "parhelion" the game is named after).
import * as THREE from 'three';
import { groundGrimeUniforms } from './groundGrime';
import { kyotoToonMaterial } from '../environment/kyotoMaterials.js';
import { winterToonMaterial } from '../environment/winterMaterials.js';
import { blackSailToonMaterial } from '../environment/blackSailMaterials.js';
import { britainToonMaterial } from '../environment/britainMaterials.js';
import { valleyToonMaterial } from '../environment/valleyMaterials.js';

export const SUN_DIR = new THREE.Vector3(-0.45, 0.62, 0.64).normalize(); // from the south-west, afternoon

/** Shared clock for animated shaders (wind, water, clouds); main loop advances it. */
export const timeUniform = { value: 0 };
/** Sea level (world Y) for shore effects on terrain; the main loop sets it from the layout. */
export const seaLevelUniform = { value: 1 };
/** Wet band above the waterline on terrain: its height (m), how far the lapping edge moves, and its tint. */
export const WET_SHORE = Object.freeze({ height: .55, lap: .12, tint: [.68, .72, .78] as const });
/** Drifting cloud shadows over the land (0 = off). Low quality turns them off; only lit faces dim. */
export const cloudShadowUniform = { value: 1 };

let gradient: THREE.DataTexture | null = null;
/** Anime-style ramp: one crisp terminator with a thin soft edge, lifted shadows. */
function toonGradient() {
  if (gradient) return gradient;
  const n = 64;
  const steps = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const lit = THREE.MathUtils.smoothstep(x, 0.36, 0.42);
    const hi = THREE.MathUtils.smoothstep(x, 0.82, 0.88);
    steps[i] = Math.round(255 * (0.5 + 0.4 * lit + 0.1 * hi));
  }
  gradient = new THREE.DataTexture(steps, n, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.LinearFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`;

/** Snow glitter on cool near-white terrain: grain cells per metre, the share of cells that can glint, how
 * white the paint must be (linear, min channel), and the distance band over which it fades out. */
export const SNOW_GLITTER = Object.freeze({ cellsPerMetre: 34, share: .022, white: [.55, .72] as const, near: 5, far: 16, strength: .55 });
type Kind = 'default' | 'terrain' | 'foliage' | 'water';

/** Cel shading on top of MeshToonMaterial: cool hue-shifted shadows, warm key, fresnel rim, world-space colour breakup. */
function celify(mat: THREE.MeshToonMaterial, kind: Kind) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeUniform; sh.uniforms.uCloud = cloudShadowUniform; sh.uniforms.uSea = seaLevelUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;`)
      .replace('#include <begin_vertex>', kind === 'foliage' ? `#include <begin_vertex>
        {
          vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
          float sway = sin(uTime * 1.7 + wp0.x * 0.35 + wp0.z * 0.27) + 0.5 * sin(uTime * 3.1 + wp0.z * 0.8);
          float w = clamp(position.y * 0.12, 0.0, 1.0);
          transformed.x += sway * 0.09 * w;
          transformed.z += cos(uTime * 1.3 + wp0.x * 0.5) * 0.06 * w;
        }` : '#include <begin_vertex>')
      .replace('#include <project_vertex>', `#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uCloud;\nuniform float uSea;\nvarying vec3 vWPos;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${kind === 'terrain' ? `{
          float n = fbm(vWPos.xz * 0.045);
          float g = fbm(vWPos.xz * 0.6);
          diffuseColor.rgb *= 0.86 + 0.26 * n;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.12, 0.82), smoothstep(0.55, 0.75, g) * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.95, 1.1), smoothstep(0.4, 0.2, g) * 0.35);
          // Wet shore: ground within reach of the waterline darkens and cools, with a lapping upper edge.
          // Snow and ice at the waterline (cool near-white paint) stay dry-looking.
          float icy = smoothstep(0.5, 0.68, min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b))) * step(diffuseColor.r * 0.97, diffuseColor.b);
          float lapEdge = uSea + ${WET_SHORE.height.toFixed(2)} + sin(uTime * 0.9 + vnoise(vWPos.xz * 0.35) * 6.0) * ${WET_SHORE.lap.toFixed(2)};
          float wet = (1.0 - smoothstep(uSea + 0.03, lapEdge, vWPos.y)) * (1.0 - icy);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(${WET_SHORE.tint.map(v => v.toFixed(2)).join(', ')}), wet);
        }` : kind === 'foliage' ? `{
          float n = fbm(vWPos.xz * 0.12 + vWPos.y * 0.2);
          diffuseColor.rgb *= 0.88 + 0.24 * n;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.15, 1.1, 0.7), smoothstep(0.6, 0.8, n) * 0.5);
        }` : `diffuseColor.rgb *= 0.94 + 0.1 * fbm(vWPos.xz * 0.3 + vWPos.y * 0.3);`}`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 base = diffuseColor.rgb + 1e-4;
          float shade = clamp(dot(outgoingLight / base, vec3(0.333)), 0.0, 2.0);
          float sh = 1.0 - smoothstep(0.62, 0.95, shade);
          // anime shadows: hue-shift toward blue-violet instead of just darkening
          outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.78, 0.82, 1.12) + base * vec3(0.03, 0.02, 0.08), sh);
          // warm key light on lit faces
          outgoingLight *= mix(vec3(1.0), vec3(1.05, 1.0, 0.94), 1.0 - sh);
          // cloud shadows: big soft patches drifting with the wind, dimming and cooling only the lit side
          float cloud = smoothstep(0.5, 0.68, fbm(vWPos.xz * 0.0105 + vec2(uTime * 0.016, uTime * 0.008))) * uCloud * (1.0 - sh);
          outgoingLight *= mix(vec3(1.0), vec3(0.74, 0.78, 0.9), cloud);
          vec3 vd = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.5);
          outgoingLight += vec3(1.0, 0.96, 0.88) * fres * ${kind === 'terrain' ? '0.08' : '0.32'} * (1.0 - 0.6 * sh);
          ${kind === 'terrain' ? `{
            // Snow glitter: cool, near-white ground throws tiny glints in the sun that wink on and off as the
            // view turns. Only close by (they would shimmer as noise at range) and only on the lit side.
            float snowy = smoothstep(${SNOW_GLITTER.white[0].toFixed(2)}, ${SNOW_GLITTER.white[1].toFixed(2)}, min(base.r, min(base.g, base.b))) * step(base.r * 0.97, base.b);
            if (snowy > 0.0) {
              float dist = length(vViewPosition);
              vec2 grain = vWPos.xz * ${SNOW_GLITTER.cellsPerMetre.toFixed(1)}, cell = floor(grain);
              float seed = hash12(cell);
              // A round grain in the middle of its cell, not the whole square.
              float dot2 = 1.0 - smoothstep(0.12, 0.34, length(fract(grain) - 0.5));
              float wink = fract(seed * 43.0 + dot(vd.xy, vec2(5.3, 3.7)) + vd.z * 2.9);
              float glint = dot2 * step(${(1 - SNOW_GLITTER.share).toFixed(3)}, seed) * smoothstep(0.55, 0.9, wink) * (1.0 - smoothstep(${SNOW_GLITTER.near.toFixed(1)}, ${SNOW_GLITTER.far.toFixed(1)}, dist));
              outgoingLight += vec3(0.9, 0.97, 1.0) * glint * snowy * (1.0 - sh) * ${SNOW_GLITTER.strength.toFixed(2)};
            }
          }` : ''}
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `cel-${kind}`;
  return mat;
}

/** Water depth bands (m): the shallow tint fades out by `shallow`, shore foam lives within `foam`. */
export const WATER_DEPTH = Object.freeze({ shallow: 3.2, foam: .45 });
/** Stylised water: banded depth colour, scrolling caustic glints, foam-ish fresnel edge, real-depth shallows and shore foam. */
function waterMaterial(name: string) {
  const mat = new THREE.MeshToonMaterial({ color: '#3fc4e4', transparent: true, opacity: 0.84, gradientMap: toonGradient(), emissive: '#1580b0', emissiveIntensity: 0.3 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeUniform;
    // The baked terrain height (groundGrime.ts) gives the water its real depth: shallows, shore foam.
    sh.uniforms.uGround = groundGrimeUniforms.parhelionGround; sh.uniforms.uGroundBox = groundGrimeUniforms.parhelionGroundBox;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform sampler2D uGround;\nuniform vec4 uGroundBox;\nvarying vec3 vWPos;\n${NOISE_GLSL}`)
      .replace('#include <opaque_fragment>', `
        {
          // Depth below the surface from the baked terrain (off the map or no terrain: deep water).
          vec2 guv = (vWPos.xz - uGroundBox.xy) / uGroundBox.zw;
          float gy = texture2D(uGround, clamp(guv, 0.0, 1.0)).r;
          float depth = (gy < -5000.0 || guv.x < 0.0 || guv.y < 0.0 || guv.x > 1.0 || guv.y > 1.0) ? 99.0 : max(vWPos.y - gy, 0.0);
          float shallow = 1.0 - smoothstep(0.0, ${WATER_DEPTH.shallow.toFixed(2)}, depth);
          // Shallows run lighter and more turquoise; deep water keeps the banded sea colour. Opacity is
          // unchanged: the seabed is grass-painted terrain and must not show through as a lawn.
          outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.86, 1.04, 1.06) + vec3(0.03, 0.09, 0.1), shallow * 0.6);
          // Shore foam: a broken, slowly breathing band where the water meets the land.
          float lap = sin(uTime * 1.1 + vnoise(vWPos.xz * 0.35) * 6.0) * 0.5 + 0.5;
          float foamEdge = 1.0 - smoothstep(0.0, ${WATER_DEPTH.foam.toFixed(2)} * (0.6 + 0.6 * lap), depth);
          float foam = foamEdge * smoothstep(0.35, 0.6, vnoise(vWPos.xz * 1.6 + vec2(uTime * 0.12, -uTime * 0.08)) + foamEdge * 0.35);
          outgoingLight = mix(outgoingLight, vec3(0.95, 0.99, 1.0), foam * 0.85);
          diffuseColor.a = mix(diffuseColor.a, 0.95, foam);
        }
        {
          vec2 p = vWPos.xz * 0.18;
          float a = vnoise(p + vec2(uTime * 0.25, uTime * 0.1));
          float b = vnoise(p * 1.7 - vec2(uTime * 0.18, -uTime * 0.22));
          float ridge = 1.0 - abs(a + b - 1.0) * 2.0;
          float glint = smoothstep(0.86, 0.96, ridge);
          float tint = fbm(vWPos.xz * 0.02);
          outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.7, 0.92, 1.05), smoothstep(0.35, 0.65, tint) * 0.5);
          outgoingLight += vec3(0.85, 1.0, 1.0) * glint * 0.55;
          vec3 vd = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 4.0);
          outgoingLight = mix(outgoingLight, vec3(0.86, 0.96, 1.0), fres * 0.55);
          diffuseColor.a = mix(diffuseColor.a, 0.96, fres);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'cel-water';
  return Object.assign(mat, { name });
}

export function toonMaterial(src: THREE.Material): THREE.Material {
  const orleans=orleansToonMaterial(src,toonGradient());if(orleans)return orleans;
  const mercury=qinMercuryMaterial(src,timeUniform);if(mercury)return mercury;
  const qin=qinToonMaterial(src,toonGradient());if(qin)return qin;
  const egypt=egyptToonMaterial(src,toonGradient());if(egypt)return egypt;
  const kyoto = kyotoToonMaterial(src, toonGradient());
  if (kyoto) return kyoto;
  const winter = winterToonMaterial(src, toonGradient());
  if (winter) return winter;
  const blackSail = blackSailToonMaterial(src, toonGradient());
  if (blackSail) return blackSail;
  const britain = britainToonMaterial(src, toonGradient());
  if (britain) return britain;
  const valley = valleyToonMaterial(src, toonGradient());
  if (valley) return valley;
  const name = src.name;
  const s = src as THREE.MeshStandardMaterial;
  switch (name) {
    case 'M_Water':
      return waterMaterial(name);
    case 'M_Waterfall':
      return Object.assign(new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }), { name });
    case 'M_Emissive':
    case 'M_Target':
      return Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) }), { name });
    case 'M_Beam': // light beams / portal veil: additive, see-through, never writes depth
      return Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), { name });
    case 'M_Halo':
      return Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.32, 0.32, 0.36) }), { name });
    default: {
      const kind: Kind = name === 'M_Terrain' ? 'terrain' : name === 'M_Foliage' ? 'foliage' : 'default';
      // Stylisation changes the lighting model, not authored visibility or practical glow.
      // Texture references stay shared/externally owned; no image or texture is cloned here.
      const m = new THREE.MeshToonMaterial({
        vertexColors: s.vertexColors, color: s.color, gradientMap: toonGradient(),
        map: s.map ?? null, alphaMap: s.alphaMap ?? null,
        emissive: s.emissive ?? 0x000000, emissiveMap: s.emissiveMap ?? null,
        emissiveIntensity: s.emissiveIntensity ?? 1,
        side: s.side, transparent: s.transparent, opacity: s.opacity, alphaTest: s.alphaTest,
        depthTest: s.depthTest, depthWrite: s.depthWrite,
        polygonOffset: s.polygonOffset, polygonOffsetFactor: s.polygonOffsetFactor,
        polygonOffsetUnits: s.polygonOffsetUnits,
      });
      return Object.assign(celify(m, kind), { name });
    }
  }
}

/** Depth push for every inverted-hull ink line (world and characters). */
export const OUTLINE_DEPTH_PUSH = Object.freeze({ factor: 2, units: 4 });
const outlineMats = new Map<number, THREE.MeshBasicMaterial>();
function outlineMat(width: number, color: THREE.ColorRepresentation) {
  const key = Math.round(width * 1e4) + new THREE.Color(color).getHex() * 1e5;
  let m = outlineMats.get(key);
  if (!m) {
    // The hull must always lose a depth tie against the model it outlines. Without the offset, thin
    // slabs and distant pieces (where depth precision is coarser than the 4.5 cm hull) let the dark
    // hull win on some pixels and not others: black speckle that crawls over the model as you move.
    m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: OUTLINE_DEPTH_PUSH.factor, polygonOffsetUnits: OUTLINE_DEPTH_PUSH.units });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = position + normalize(normal) * ${width.toFixed(4)};`,
      );
    };
    m.customProgramCacheKey = () => `outline-${width}`;
    outlineMats.set(key, m);
  }
  return m;
}

/** Ink colour for a piece of map art. Foliage is open underneath (cone tiers, bush shells), so the inside of
 * its hull shows as a large patch from below: a deep leaf green reads as the shaded underside of the canopy,
 * where the default ink read as a black-blue disc under every tree. */
export const OUTLINE_INK = Object.freeze({ default: '#2b2f45', foliage: '#1e3b2a' });
export function outlineColorFor(name: string): string { return /Leaves|Bushes|Foliage|^Trees$/.test(name) ? OUTLINE_INK.foliage : OUTLINE_INK.default; }
/** Inverted-hull outline sharing the mesh's geometry. */
export function addOutline(mesh: THREE.Mesh, width = 0.045, color: THREE.ColorRepresentation = '#2b2f45') {
  const o = new THREE.Mesh(mesh.geometry, outlineMat(width, color));
  o.name = `${mesh.name}__outline`;
  o.raycast = () => {};
  mesh.add(o);
}

export function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      uTime: timeUniform,
      top: { value: new THREE.Color('#2a74dc') },
      mid: { value: new THREE.Color('#7cc4f5') },
      horizon: { value: new THREE.Color('#f2f6ff') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, top, mid, horizon;
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.25, 0.9, h));
        float a = acos(clamp(dot(d, sunDir), -1.0, 1.0));
        col += vec3(1.0, 0.97, 0.85) * smoothstep(0.05, 0.035, a);           // sun disk
        col += vec3(1.0, 0.95, 0.8) * 0.35 * exp(-a * 10.0);                  // glow
        float halo = exp(-pow((a - 0.384) / 0.012, 2.0));                     // 22° halo
        col += mix(vec3(1.0, 0.75, 0.6), vec3(0.75, 0.85, 1.0), smoothstep(0.37, 0.4, a)) * halo * 0.28;
        // sundogs: two bright spots on the halo, level with the sun
        vec3 right = normalize(cross(sunDir, vec3(0.0, 1.0, 0.0)));
        vec3 up = cross(right, sunDir);
        for (int i = 0; i < 2; i++) {
          float s = i == 0 ? 1.0 : -1.0;
          vec3 dog = normalize(sunDir * cos(0.384) + right * s * sin(0.384));
          float ad = acos(clamp(dot(d, dog), -1.0, 1.0));
          col += vec3(1.0, 0.85, 0.7) * exp(-ad * 70.0) * 0.6;
        }
        // anime cumulus: projected fbm sheet, hard-ish edge, lavender undersides, sun-lit rims
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
          float c = fbm(uv * 0.8) + 0.45 * fbm(uv * 2.7 + 3.1) - 0.84;
          float cov = smoothstep(0.0, 0.04, c) * smoothstep(0.0, 0.12, d.y);
          float thick = smoothstep(0.02, 0.22, c);
          float lit = clamp(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))) * 0.5 + 0.5, 0.0, 1.0);
          vec3 cloud = mix(vec3(1.0, 0.99, 0.97), vec3(0.72, 0.76, 0.92), thick * 0.75);
          cloud += vec3(1.0, 0.92, 0.78) * smoothstep(0.1, 0.02, c - 0.02) * 0.25 * lit;
          col = mix(col, cloud, cov * 0.92);
        }
        col = mix(col, horizon * vec3(1.0, 0.97, 0.94), smoothstep(0.08, 0.0, abs(d.y)) * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  sky.scale.setScalar(1500);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.name = 'Sky';
  return sky;
}
