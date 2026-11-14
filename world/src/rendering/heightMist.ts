import * as THREE from 'three';

/**
 * Low-lying mist for depth layering: on top of the scene's distance fog, anything that sits low in the
 * world (sea level, river plains, the winter road, Kyoto's streets) gathers extra haze with distance,
 * while hilltops, towers and castles stay clear above it. Looking out from a height, the land reads in
 * layers — clear ridges over a soft lowland — instead of one flat fade.
 *
 * One patch to three.js's shared fog chunks (every fogged material, no uniforms to plumb): the vertex
 * stage carries the world height, the fragment stage thickens the fog by it. Constants are baked into
 * the shader. Scenes with a short fog (the ultimate stage, far < `minFar`) are left alone.
 */
export const HEIGHT_MIST = Object.freeze({
  /** Full mist at or below `low` (m, world Y), none at or above `high`. */
  low: 2, high: 16,
  /** Builds from `near` to `far` metres from the camera, up to `strength` of the fog colour. */
  near: 45, far: 300, strength: .34,
  /** Only scenes whose own fog reaches at least this far. */
  minFar: 300,
});
const MARK = 'vFogWorldY';
const MIX = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
const DEPTH = 'vFogDepth = - mvPosition.z;';
const f = (n: number) => n.toFixed(2);

/** The extra fog share for a point `y` metres up, `depth` metres away (mirrors the GLSL; used by tests). */
export function heightMistAt(y: number, depth: number) {
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return (1 - ss(HEIGHT_MIST.low, HEIGHT_MIST.high, y)) * ss(HEIGHT_MIST.near, HEIGHT_MIST.far, depth) * HEIGHT_MIST.strength;
}

/** Patch the shared fog chunks once, before any material compiles. False if already patched or three moved them. */
export function installHeightMist(chunks: Record<string, string> = THREE.ShaderChunk as unknown as Record<string, string>) {
  const { fog_pars_vertex: pv, fog_vertex: v, fog_pars_fragment: pf, fog_fragment: fr } = chunks;
  if ([pv, v, pf, fr].some(c => typeof c !== 'string') || pv.includes(MARK)) return false;
  if (!v.includes(DEPTH) || !fr.includes(MIX)) return false;
  chunks.fog_pars_vertex = `${pv}\n#ifdef USE_FOG\n\tvarying float ${MARK};\n#endif\n`;
  chunks.fog_pars_fragment = `${pf}\n#ifdef USE_FOG\n\tvarying float ${MARK};\n#endif\n`;
  // World Y from the view-space position: camera height plus the view matrix's Y row turned back.
  chunks.fog_vertex = v.replace(DEPTH, `${DEPTH}\n\t${MARK} = cameraPosition.y + dot( vec3( viewMatrix[ 1 ] ), mvPosition.xyz );`);
  chunks.fog_fragment = fr.replace(MIX, `#ifndef FOG_EXP2
		{
			float pmLow = 1.0 - smoothstep( ${f(HEIGHT_MIST.low)}, ${f(HEIGHT_MIST.high)}, ${MARK} );
			float pmFar = smoothstep( ${f(HEIGHT_MIST.near)}, ${f(HEIGHT_MIST.far)}, vFogDepth );
			fogFactor = max( fogFactor, pmLow * pmFar * ${f(HEIGHT_MIST.strength)} * step( ${f(HEIGHT_MIST.minFar)}, fogFar ) );
		}
	#endif
	${MIX}`);
  return true;
}
