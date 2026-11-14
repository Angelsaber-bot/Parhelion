import * as THREE from 'three';

/**
 * The world's low-poly art is smooth-shaded: a box face that points away from the sun still has
 * interpolated normals that catch some direct light, and the shadow map then shadows it against
 * itself in a sawtooth stripe pattern (ramparts, interior walls, pillars). A face that geometrically
 * faces away from the sun is in its own shadow, so the directional shadow term also takes the true
 * face direction (from screen-space derivatives) into account. Faces toward the sun are unchanged.
 * Applied once to three.js's shared lighting chunk before any material compiles.
 */
const ANCHOR = 'vec3 geometryPosition = - vViewPosition;';
const SHADOW = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const MARK = 'parhelionFaceNormal';

export function installGeometricShadowFacing(chunks: Record<string, string> = THREE.ShaderChunk as unknown as Record<string, string>) {
  const chunk = chunks.lights_fragment_begin;
  if (typeof chunk !== 'string' || chunk.includes(MARK)) return false;
  if (!chunk.includes(ANCHOR) || !chunk.includes(SHADOW)) return false; // a three.js update moved the chunk: keep stock behaviour
  chunks.lights_fragment_begin = chunk
    .replace(ANCHOR, `${ANCHOR}
	vec3 ${MARK} = cross( dFdx( geometryPosition ), dFdy( geometryPosition ) );
	${MARK} = dot( ${MARK}, ${MARK} ) > 0.0 ? normalize( ${MARK} ) : normal;
	if ( dot( ${MARK}, vViewPosition ) < 0.0 ) ${MARK} = - ${MARK};`)
    .replace(SHADOW, SHADOW.replace('vDirectionalShadowCoord[ i ] ) : 1.0;', `vDirectionalShadowCoord[ i ] ) * smoothstep( 0.0, 0.12, dot( ${MARK}, directLight.direction ) ) : 1.0;`));
  return true;
}
