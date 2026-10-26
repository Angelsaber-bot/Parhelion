// Anime cel look shared by the map, avatars and guns: soft single terminator, blue-violet shadows,
// warm key and a fresnel rim. Plus a gradient sky dome with drifting cumulus.
import * as THREE from 'three';

let ramp: THREE.DataTexture | null = null;
function celRamp() {
  if (ramp) return ramp;
  const n = 64, d = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    d[i] = Math.round(255 * (0.52 + 0.38 * THREE.MathUtils.smoothstep(x, 0.36, 0.42) + 0.1 * THREE.MathUtils.smoothstep(x, 0.82, 0.88)));
  }
  ramp = new THREE.DataTexture(d, n, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
  ramp.needsUpdate = true;
  return ramp;
}

export function celMaterial(p: THREE.MeshToonMaterialParameters, rim = 0.3): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ ...p, gradientMap: celRamp() });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        vec3 base = diffuseColor.rgb + 1e-4;
        float shade = clamp(dot(outgoingLight / base, vec3(0.333)), 0.0, 2.0);
        float s = 1.0 - smoothstep(0.62, 0.95, shade);
        outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.78, 0.82, 1.12) + base * vec3(0.03, 0.02, 0.08), s);
        outgoingLight *= mix(vec3(1.0), vec3(1.05, 1.0, 0.94), 1.0 - s);
        float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5);
        outgoingLight += vec3(1.0, 0.96, 0.9) * fres * ${rim.toFixed(2)} * (1.0 - 0.6 * s);
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `cel-${rim}`;
  return m;
}

/** Swap a loaded PBR material for the cel version, keeping its colour, texture and emissive. */
export function toCel(src: THREE.Material): THREE.Material {
  const s = src as THREE.MeshStandardMaterial;
  if (!(s as any).isMeshStandardMaterial) return src;
  const m = celMaterial({
    color: s.color, map: s.map, vertexColors: s.vertexColors, emissive: s.emissive, emissiveMap: s.emissiveMap,
    emissiveIntensity: s.emissiveIntensity, transparent: s.transparent, opacity: s.opacity, side: s.side,
    alphaTest: s.alphaTest, depthWrite: s.depthWrite, name: s.name,
  }, 0.22);
  src.dispose();
  return m;
}

export function makeSky(sunDir: THREE.Vector3): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      sunDir: { value: sunDir.clone().normalize() }, uTime: { value: 0 },
      uHorizon: { value: new THREE.Color(0.95, 0.96, 1.0) }, uMid: { value: new THREE.Color(0.49, 0.77, 0.96) },
      uTop: { value: new THREE.Color(0.17, 0.45, 0.86) }, uSun: { value: new THREE.Color(1.0, 0.97, 0.85) },
      uCloudLit: { value: new THREE.Color(1.0, 0.99, 0.97) }, uCloudShade: { value: new THREE.Color(0.72, 0.76, 0.92) },
      uNight: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 sunDir; uniform float uTime; varying vec3 vDir;
      uniform vec3 uHorizon, uMid, uTop, uSun, uCloudLit, uCloudShade; uniform float uNight;
      float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vn(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.25, h));
        col = mix(col, uTop, smoothstep(0.25, 0.9, h));
        float a = acos(clamp(dot(d, sunDir), -1.0, 1.0));
        col += uSun * smoothstep(0.05, 0.035, a) + uSun * 0.35 * exp(-a * 10.0);
        if (uNight > 0.0 && d.y > 0.0) {
          vec2 sp = d.xz / (d.y + 0.3) * 60.0;
          float st = step(0.985, h12(floor(sp))) * (0.5 + 0.5 * sin(uTime * 2.0 + h12(floor(sp) + 7.0) * 30.0));
          col += vec3(0.85, 0.9, 1.0) * st * uNight * smoothstep(0.05, 0.4, d.y);
        }
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
          float c = fbm(uv * 0.8) + 0.45 * fbm(uv * 2.7 + 3.1) - 0.84;
          float cov = smoothstep(0.0, 0.04, c) * smoothstep(0.0, 0.12, d.y);
          vec3 cloud = mix(uCloudLit, uCloudShade, smoothstep(0.02, 0.22, c) * 0.75);
          col = mix(col, cloud, cov * 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  sky.scale.setScalar(240);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}
