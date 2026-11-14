import * as THREE from 'three';

/**
 * Ground contact for every lit surface on the map: walls, posts, crates, carts, plants and characters
 * darken and warm towards the ground they stand on — a grime band up the base of a wall and a tight
 * contact line where it meets the earth — so nothing looks pasted onto the terrain.
 *
 * How: the terrain is rendered once from above into a height texture (world Y per ~2 m texel). One
 * patch to three.js's shared lighting chunk reads it and darkens the diffuse colour of near-vertical
 * faces by their real height above the ground. Materials opt in by `adoptGroundGrime` (which supplies
 * the shared uniforms); anything not adopted reads `on = 0` and is unchanged. Terrain itself and
 * translucent materials are never adopted.
 */
export const GROUND_GRIME = Object.freeze({
  res: 1024, empty: -1e4,
  /** Height of the grime band on walls (m) and of the tight contact line. */
  band: 1.15, contact: .16,
  /** Darkest multiplier at the base, warm brown-grey; characters get a much shorter band. */
  tint: [.6, .54, .48] as const, skinnedBand: .22,
});

/** Detail added with the grime to adopted materials: characters' rim light (strength and falloff power), and
 * wall weathering (half-amplitudes of the rain streaks and tonal patches, and the lift towards the top). */
export const SURFACE_DETAIL = Object.freeze({ rim: .3, rimPower: 3, streak: .035, blot: .03, lift: .04 });
/** Value noise for the weathering (prefixed: cel materials already declare their own noise helpers). */
const PG_NOISE = 'float pgHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * 0.1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }\n'
  + 'float pgNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( pgHash( i ), pgHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( pgHash( i + vec2( 0.0, 1.0 ) ), pgHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }';
const DECL = 'parhelionGroundGrime';
const VIEW_DIR = 'vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );';

/** The GLSL that darkens `material.diffuseColor` (and the cel shader's `diffuseColor`). Exported for tests. */
export const GROUND_GRIME_GLSL = /* glsl */ `
#ifdef PARHELION_GROUND
	{ // ${DECL}
		vec3 pgWorld = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );
		vec3 pgNormal = normalize( normal * mat3( viewMatrix ) );
		vec2 pgUv = ( pgWorld.xz - parhelionGroundBox.xy ) / parhelionGroundBox.zw;
		float pgGround = texture2D( parhelionGround, clamp( pgUv, 0.0, 1.0 ) ).r;
		float pgAbove = pgWorld.y - pgGround;
		#ifdef USE_SKINNING
			float pgBand = ${GROUND_GRIME.skinnedBand.toFixed(3)};
		#else
			float pgBand = ${GROUND_GRIME.band.toFixed(3)};
		#endif
		// Only near-vertical faces, only above real ground (not under it, not off the height map).
		float pgVertical = smoothstep( 0.3, 0.75, 1.0 - abs( pgNormal.y ) );
		float pgInside = step( 0.0, pgUv.x ) * step( pgUv.x, 1.0 ) * step( 0.0, pgUv.y ) * step( pgUv.y, 1.0 ) * step( -0.5, pgAbove ) * step( ${(GROUND_GRIME.empty / 2).toFixed(1)}, pgGround );
		float pgBandW = 1.0 - smoothstep( 0.0, pgBand, max( pgAbove, 0.0 ) );
		float pgContact = 1.0 - smoothstep( 0.0, ${GROUND_GRIME.contact.toFixed(3)}, max( pgAbove, 0.0 ) );
		float pgGrime = parhelionGroundOn * pgInside * ( pgVertical * ( pgBandW * 0.72 + pgContact * 0.28 ) + ( 1.0 - pgVertical ) * pgContact * 0.4 );
		vec3 pgTint = mix( vec3( 1.0 ), vec3( ${GROUND_GRIME.tint.map(v => v.toFixed(3)).join(', ')} ), clamp( pgGrime, 0.0, 1.0 ) );
		material.diffuseColor *= pgTint; diffuseColor.rgb *= pgTint;
		#ifdef USE_SKINNING
			// Rim light: characters pick up a thin edge of sky and sun, so dark clothes and hair separate from a
			// shaded street behind them. Strongest on edges that face up and towards the sun.
			float pgFres = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), ${SURFACE_DETAIL.rimPower.toFixed(1)} );
			float pgSky = 0.55 + 0.45 * dot( geometryNormal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) );
			vec3 pgRim = vec3( 0.78, 0.87, 1.0 );
			#if NUM_DIR_LIGHTS > 0
				pgSky *= 0.6 + 0.4 * saturate( dot( geometryNormal, directionalLights[ 0 ].direction ) );
				vec3 pgSunTint = directionalLights[ 0 ].color;
				pgRim = mix( pgRim, pgSunTint / max( max( pgSunTint.r, pgSunTint.g ), max( pgSunTint.b, 0.001 ) ), 0.45 );
			#endif
			reflectedLight.directDiffuse += pgRim * pgFres * pgSky * ${SURFACE_DETAIL.rim.toFixed(2)} * parhelionGroundOn;
		#else
			// Weathering on upright faces: long faint rain streaks and broad tonal patches in world space, and a
			// slight lift towards the top of tall walls. A few per cent only: plaster, not camouflage.
			float pgAlong = pgWorld.x * 0.83 + pgWorld.z * 0.56;
			float pgStreak = pgNoise( vec2( pgAlong * 1.1, pgWorld.y * 0.09 ) ) - 0.5;
			float pgBlot = pgNoise( vec2( pgAlong * 0.17, pgWorld.y * 0.21 + 7.0 ) ) - 0.5;
			float pgWear = 1.0 + pgVertical * parhelionGroundOn * ( pgStreak * ${(SURFACE_DETAIL.streak * 2).toFixed(3)} + pgBlot * ${(SURFACE_DETAIL.blot * 2).toFixed(3)} + ${SURFACE_DETAIL.lift.toFixed(3)} * smoothstep( 1.5, 7.0, pgAbove ) * pgInside );
			material.diffuseColor *= pgWear; diffuseColor.rgb *= pgWear;
		#endif
	}
#endif
`;

/** Patch three's shared chunks once, before any material compiles. Returns false if already patched or the chunk moved. */
export function installGroundGrime(chunks: Record<string, string> = THREE.ShaderChunk as unknown as Record<string, string>) {
  const lights = chunks.lights_fragment_begin, pars = chunks.lights_pars_begin;
  if (typeof lights !== 'string' || typeof pars !== 'string' || lights.includes(DECL)) return false;
  if (!lights.includes(VIEW_DIR)) return false;
  // Declared only where a material opted in: an unset sampler would share texture unit 0 with another
  // sampler type and fail the draw (GL_INVALID_OPERATION), so stock programs never see these lines.
  chunks.lights_pars_begin = `#ifdef PARHELION_GROUND\nuniform sampler2D parhelionGround;\nuniform vec4 parhelionGroundBox;\nuniform float parhelionGroundOn;\n${PG_NOISE}\n#endif\n${pars}`;
  chunks.lights_fragment_begin = lights.replace(VIEW_DIR, `${VIEW_DIR}\n${GROUND_GRIME_GLSL}`);
  return true;
}

/** Shared uniforms (one texture for every adopted material). */
const placeholder = new THREE.DataTexture(new Uint16Array([THREE.DataUtils.toHalfFloat(GROUND_GRIME.empty)]), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
placeholder.needsUpdate = true;
export const groundGrimeUniforms = {
  parhelionGround: { value: placeholder as THREE.Texture },
  parhelionGroundBox: { value: new THREE.Vector4(0, 0, 1, 1) },
  parhelionGroundOn: { value: 1 },
};

/** Bake world heights of `terrains` (rendered from above, topmost surface wins) into the shared texture. */
export function bakeGroundHeights(renderer: THREE.WebGLRenderer, terrains: readonly THREE.Object3D[], res: number = GROUND_GRIME.res) {
  // Headless hosts and stub renderers simply get no grime (and no warning).
  const r = renderer as Partial<THREE.WebGLRenderer>;
  if (typeof r.clear !== 'function' || typeof r.readRenderTargetPixels !== 'function' || typeof r.setRenderTarget !== 'function' || typeof r.getClearColor !== 'function') return null;
  const box = new THREE.Box3(); for (const t of terrains) { t.updateMatrixWorld(true); box.expandByObject(t); }
  if (box.isEmpty()) return null;
  const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 4, cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const x0 = cx - size / 2, z0 = cz - size / 2;
  const target = new THREE.WebGLRenderTarget(res, res, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: true, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
  // Looking straight down; texel (u, v) = (x, z). Camera up is -Z so +v maps to +z after the flip below.
  const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 1, box.max.y - box.min.y + 20);
  cam.position.set(cx, box.max.y + 10, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, box.min.y, cz); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying float vY; void main(){ gl_FragColor = vec4(vY, 1.0, 0.0, 1.0); }',
    side: THREE.DoubleSide,
  });
  const scene = new THREE.Scene(), holders: THREE.Mesh[] = [];
  for (const t of terrains) t.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) { const h = new THREE.Mesh(m.geometry, mat); h.matrixAutoUpdate = false; h.matrix.copy(m.matrixWorld); h.matrixWorld.copy(m.matrixWorld); h.frustumCulled = false; holders.push(h); scene.add(h); } });
  const prevTarget = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha(), prevAuto = renderer.shadowMap.autoUpdate;
  const pixels = new Float32Array(res * res * 4);
  try {
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    renderer.readRenderTargetPixels(target, 0, 0, res, res, pixels);
  } finally {
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha); renderer.shadowMap.autoUpdate = prevAuto;
    target.dispose(); mat.dispose();
  }
  // Pixel row 0 is the bottom of the image; with up = -Z the bottom row is the largest z. Flip to +z rows.
  const heights = new Uint16Array(res * res);
  for (let row = 0; row < res; row++) for (let col = 0; col < res; col++) {
    const i = (row * res + col) * 4, covered = pixels[i + 1] > .5, out = (res - 1 - row) * res + col;
    heights[out] = THREE.DataUtils.toHalfFloat(covered ? pixels[i] : GROUND_GRIME.empty);
  }
  const tex = new THREE.DataTexture(heights, res, res, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  const old = groundGrimeUniforms.parhelionGround.value; groundGrimeUniforms.parhelionGround.value = tex; if (old !== placeholder) old.dispose();
  groundGrimeUniforms.parhelionGroundBox.value.set(x0, z0, size, size);
  return { x0, z0, size, res, sample(x: number, z: number) { const c = Math.floor((x - x0) / size * res), r = Math.floor((z - z0) / size * res); return c < 0 || r < 0 || c >= res || r >= res ? null : THREE.DataUtils.fromHalfFloat(heights[r * res + c]); } };
}

const LIT = (m: THREE.Material) => (m as THREE.MeshToonMaterial).isMeshToonMaterial || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial
  || (m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshPhongMaterial).isMeshPhongMaterial;
/** Whether a material should carry ground grime: lit, opaque, not terrain/water, not opted out. */
export function wantsGroundGrime(m: THREE.Material) {
  return !!LIT(m) && !m.transparent && m.opacity === 1 && !/Terrain|Water|Ground|Road|Path|Snow|Sand|Floor/i.test(m.name) && !m.userData.noGroundGrime;
}
const ADOPTED = Symbol('groundGrime');
/** Hand the shared uniforms to every eligible material under `root` (chains any existing onBeforeCompile).
 * Returns how many materials were newly adopted. Safe to call repeatedly. */
export function adoptGroundGrime(root: THREE.Object3D) {
  let n = 0;
  root.traverse(o => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh || !mesh.material) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const tagged = m as THREE.Material & { [ADOPTED]?: boolean };
      if (tagged[ADOPTED] || !wantsGroundGrime(m)) continue;
      tagged[ADOPTED] = true; n++;
      const prior = m.onBeforeCompile, priorKey = m.customProgramCacheKey;
      m.onBeforeCompile = function (shader, renderer) {
        Object.assign(shader.uniforms, groundGrimeUniforms);
        shader.defines = { ...shader.defines, PARHELION_GROUND: '' };
        prior.call(this, shader, renderer);
      };
      // Its own program key: a material compiled before adoption gets a fresh program (and this hook),
      // and adopted/stock materials never share a program.
      m.customProgramCacheKey = function () { return `${priorKey.call(this)}|ground`; };
      m.needsUpdate = true;
    }
  });
  return n;
}
