import * as THREE from 'three';

// Sample a periodic lattice. Wrapping the cell indices keeps the seam continuous at every octave.
export function tileNoise(u: number, v: number, columns: number, rows: number, seed: number) {
  const x = u * columns, y = v * rows;
  const ix = Math.floor(x), iy = Math.floor(y);
  function corner(dx: number, dy: number) {
    const col = ((ix + dx) % columns + columns) % columns;
    const row = ((iy + dy) % rows + rows) % rows;
    let h = Math.imul(col + seed * 17, 374761393) + Math.imul(row + seed, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(corner(0, 0), corner(1, 0), sx),
    THREE.MathUtils.lerp(corner(0, 1), corner(1, 1), sx), sy);
}

export function repeatingTexture(name: string, data: Uint8Array, size: number) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = name;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

let terrainGrain: THREE.DataTexture | undefined;

/** Four height fields in one linear texture. A single filtered fetch supplies all terrain finishes. */
export function terrainGrainTexture() {
  if (terrainGrain) return terrainGrain;
  const size = 128, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = 4 * (y * size + x);
    const warp = tileNoise(u, v, 4, 5, 12) - .5;
    const grit = tileNoise(u, v, 58, 64, 92);
    const pebble = THREE.MathUtils.smoothstep(tileNoise(u, v, 20, 24, 48), .52, .85);
    const grass = tileNoise(u + v + warp * .10, v, 53, 13, 61);
    const ripple = Math.sin(2 * Math.PI * (u * 3 + v * 14 + warp * 1.4));
    bytes[i] = Math.round(255 * (.16 + .50 * pebble + .32 * grit));
    bytes[i + 1] = Math.round(255 * (.15 + .72 * grass + .12 * grit));
    bytes[i + 2] = Math.round(255 * (.48 + .27 * ripple + .22 * (grit - .5)));
    bytes[i + 3] = Math.round(255 * (.65 * tileNoise(u, v, 7, 9, 23) + .35 * grit));
  }
  terrainGrain = repeatingTexture('World terrain grain', bytes, size);
  return terrainGrain;
}
