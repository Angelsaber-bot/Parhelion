import * as THREE from 'three';
import { repeatingTexture, tileNoise } from '../rendering/surfaceGrain';

export type CraftSurface = 'wood' | 'stone' | 'plaster' | 'cloth' | 'slate' | 'paper';

const finishes = {
  wood:   { metres: .85, relief: .0048, roughness: .82, contrast: 33 },
  stone:  { metres: 1.15, relief: .0120, roughness: .92, contrast: 37 },
  plaster:{ metres: .85, relief: .0038, roughness: .95, contrast: 24 },
  cloth:  { metres: .25, relief: .0018, roughness: .98, contrast: 28 },
  slate:  { metres: 1.32, relief: .0170, roughness: .76, contrast: 42 },
  paper:  { metres: .45, relief: .0006, roughness: .94, contrast: 17 },
} as const;
const surfaces = new Map<CraftSurface, { color: THREE.DataTexture; normal: THREE.DataTexture }>();
const tau = Math.PI * 2;
const smoothstep = THREE.MathUtils.smoothstep;

function grainHeight(kind: CraftSurface, u: number, v: number, fine: number, patch: number) {
  switch (kind) {
    case 'wood': {
      const bend = .5 * Math.sin(v * tau) + 1.8 * tileNoise(u, v, 3, 2, 33);
      const growth = .5 + .5 * Math.sin(tau * (u * 7 + bend));
      const pore = tileNoise(u, v, 67, 8, 11);
      return .25 + .32 * growth - .15 * smoothstep(growth, .82, .97) + .31 * pore + .1 * fine;
    }
    case 'stone': {
      const aggregate = tileNoise(u, v, 23, 20, 82);
      return .12 + .26 * patch + .38 * aggregate + .25 * fine - .12 * smoothstep(fine, .7, .94);
    }
    case 'plaster':
      return .1 + .42 * patch + .23 * tileNoise(u + v, v, 9, 3, 14) + .23 * fine;
    case 'cloth': {
      const warp = Math.cos(u * 28 * tau), weft = Math.cos(v * 30 * tau);
      const crossing = Math.cos(u * 14 * tau) * Math.cos(v * 15 * tau);
      return .48 + .17 * (warp + weft) + .12 * crossing + .07 * (fine - .5);
    }
    case 'slate': {
      const course = v * 4, row = Math.floor(course), lip = course - row;
      const tile = u * 3 + (row % 2) * .5;
      const seam = Math.abs(tile - Math.round(tile));
      const lamina = .5 + .5 * Math.sin(tau * (v * 7 - u * 2 + patch * .5));
      return .25 + .27 * lip + .13 * lamina + .13 * patch + .1 * fine
        - .18 * (1 - smoothstep(seam, .008, .035)) - .21 * (1 - smoothstep(lip, .008, .055));
    }
    case 'paper':
      return .18 + .29 * patch + .3 * tileNoise(u + v, v, 8, 60, 41) + .18 * fine;
  }
}

function makeSurface(kind: CraftSurface) {
  const size = 128, profile = finishes[kind];
  const height = new Float32Array(size * size);
  const colorData = new Uint8Array(size * size * 4), normalData = new Uint8Array(colorData.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = y * size + x;
    const patch = tileNoise(u, v, 5, 6, 3), fine = tileNoise(u, v, 73, 78, 9);
    const h = height[i] = grainHeight(kind, u, v, fine, patch);
    const value = 238 + (h - .5) * profile.contrast + (patch - .5) * 8;
    const warmth = (patch - .5) * (kind === 'wood' || kind === 'stone' ? 9 : 4);
    colorData[4*i] = Math.min(255, Math.round(value + warmth));
    colorData[4*i+1] = Math.min(255, Math.round(value));
    colorData[4*i+2] = Math.min(255, Math.round(value - warmth));
    colorData[4*i+3] = 255;
  }
  const scale = profile.relief * size / (2 * profile.metres);
  const index = (x: number, y: number) => ((y + size) % size) * size + (x + size) % size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (height[index(x-1,y)] - height[index(x+1,y)]) * scale;
    const dy = (height[index(x,y-1)] - height[index(x,y+1)]) * scale;
    const inv = 1 / Math.hypot(dx, dy, 1), i = 4 * index(x, y);
    normalData[i] = Math.round(127.5 + 127.5 * dx * inv);
    normalData[i+1] = Math.round(127.5 + 127.5 * dy * inv);
    normalData[i+2] = Math.round(127.5 + 127.5 * inv);
    normalData[i+3] = 255;
  }
  const color = repeatingTexture('SettlementCraft_' + kind, colorData, size);
  color.colorSpace = THREE.SRGBColorSpace;
  return { color, normal: repeatingTexture('SettlementRelief_' + kind, normalData, size) };
}

export function applyCraftSurface(material: THREE.MeshStandardMaterial, kind: CraftSurface) {
  let textures = surfaces.get(kind);
  if (!textures) { textures = makeSurface(kind); surfaces.set(kind, textures); }
  material.map = textures.color;
  material.normalMap = textures.normal;
  material.roughness = finishes[kind].roughness;
  material.userData.craftSurface = kind;
  return material;
}

/** Resize each face's authored UV chart in metres before the geometry is merged.
 * This works for builders that already merged parts and baked their rotations.
 * Keeping chart coordinates also preserves cylindrical wraps and roof pitch. */
export function scaleCraftUvs(geometry: THREE.BufferGeometry, kind: CraftSurface) {
  if (geometry.index) return;
  const p = geometry.getAttribute('position');
  if (!geometry.hasAttribute('uv')) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  const uv = geometry.getAttribute('uv');
  const tile = finishes[kind].metres;
  const side1 = new THREE.Vector3(), side2 = new THREE.Vector3(), origin = new THREE.Vector3(), axis = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    origin.fromBufferAttribute(p, i);
    side1.fromBufferAttribute(p, i+1).sub(origin);
    side2.fromBufferAttribute(p, i+2).sub(origin);
    const u = uv.getX(i), v = uv.getY(i);
    const u1 = uv.getX(i+1)-u, u2 = uv.getX(i+2)-u;
    const v1 = uv.getY(i+1)-v, v2 = uv.getY(i+2)-v;
    const det = Math.abs(u1 * v2 - u2 * v1);
    if (det < 1e-8) {
      // Some merged roof and rubble pieces have no UVs. Project their faces in settlement metres.
      axis.crossVectors(side1, side2);
      const ax = Math.abs(axis.x), ay = Math.abs(axis.y), az = Math.abs(axis.z);
      for (let j = i; j < i + 3; j++) {
        if (ay >= ax && ay >= az) uv.setXY(j, p.getX(j) / tile, -p.getZ(j) / tile);
        else if (ax >= az) uv.setXY(j, -p.getZ(j) / tile, p.getY(j) / tile);
        else uv.setXY(j, p.getX(j) / tile, p.getY(j) / tile);
      }
      continue;
    }
    const spanU = axis.copy(side1).multiplyScalar(v2).addScaledVector(side2, -v1).length() / det;
    const spanV = axis.copy(side2).multiplyScalar(u1).addScaledVector(side1, -u2).length() / det;
    // Timber fibres run along the beam, whether its source chart runs vertically or horizontally.
    const alongU = kind === 'wood' && spanU > spanV * 1.25;
    for (let j = i; j < i + 3; j++) {
      const x = uv.getX(j) * spanU / tile, y = uv.getY(j) * spanV / tile;
      if (alongU) uv.setXY(j, -y, x); else uv.setXY(j, x, y);
    }
  }
}
