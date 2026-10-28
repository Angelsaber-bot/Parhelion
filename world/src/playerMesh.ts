/** ARCHIVED rigid-body regression fixture, never imported by the default skinned player.
 * Authored Blender surface asset. Indexed quantized transport -> one batch per animated joint.
 * Source: assets/characters/player/build_player.py. No asynchronous scene replacement/pop-in.
 */
import * as THREE from 'three';
import asset from './generated/player-mesh.json';

function bytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) output[i] = binary.charCodeAt(i);
  return output;
}

export const PLAYER_ASSET_INFO = Object.freeze({
  version: asset.version,
  triangles: asset.parts.reduce((n, p) => n + p.triangles, 0),
  meshes: asset.parts.length,
});

export function installAuthoredPlayer(
  joints: Record<string, THREE.Object3D>, meshes: THREE.Mesh[], material: THREE.Material,
): void {
  // Retain equipment and its original anchors, plus the deployable glider. Only the old body is removed.
  for (let i = meshes.length - 1; i >= 0; i--) {
    const mesh = meshes[i];
    if (mesh.name === 'Rifle' || mesh.name === 'GliderWings') continue;
    mesh.removeFromParent();
    mesh.geometry.dispose();
    meshes.splice(i, 1);
  }
  for (const part of asset.parts) {
    const parent = joints[part.joint];
    if (!parent) throw new Error(`Player asset references missing joint: ${part.joint}`);
    const raw = bytes(part.data), iv = bytes(part.indices);
    if (raw.length !== part.vertices * 12 || iv.length !== part.triangles * 6)
      throw new Error(`Invalid player geometry buffer: ${part.joint}`);
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const indicesView = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
    const positions = new Float32Array(part.vertices * 3);
    const normals = new Float32Array(part.vertices * 3);
    const colours = new Uint8Array(part.vertices * 3);
    for (let v = 0; v < part.vertices; v++) {
      const p = v * 12;
      for (let c = 0; c < 3; c++) {
        positions[v * 3 + c] = view.getInt16(p + c * 2, true) / asset.positionScale;
        normals[v * 3 + c] = view.getInt8(p + 6 + c) / 127;
        colours[v * 3 + c] = view.getUint8(p + 9 + c);
      }
    }
    const indices = new Uint16Array(part.triangles * 3);
    for (let i = 0; i < indices.length; i++) indices[i] = indicesView.getUint16(i * 2, true);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `PlayerPart_${part.joint}`;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.authoredPlayer = true;
    parent.add(mesh); meshes.push(mesh);
  }
}

const uniformRest = new WeakMap<THREE.BufferGeometry, { p: Float32Array; n: Float32Array }>();

/** Short uniform cloth follows each thigh only at the hem; the belt/waist stays fixed.
 * A small CPU deformation of one indexed mesh avoids a rigid skirt colliding with walking legs.
 */
export function deformUniformCloth(joints: Record<string, THREE.Object3D>, meshes: THREE.Mesh[]) {
  const mesh = meshes.find(m => m.name === 'PlayerPart_CoatTails');
  if (!mesh) return;
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
  let rest = uniformRest.get(geometry);
  if (!rest) {
    rest = { p: new Float32Array(positions.array), n: new Float32Array(normals.array) };
    uniformRest.set(geometry, rest);
    positions.setUsage(THREE.DynamicDrawUsage); normals.setUsage(THREE.DynamicDrawUsage);
    if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.20;
  }
  const left = joints.Thigh_L.rotation.x, right = joints.Thigh_R.rotation.x;
  const cl = Math.cos(left), sl = Math.sin(left), cr = Math.cos(right), sr = Math.sin(right);
  for (let i = 0; i < positions.count; i++) {
    const k = i * 3, x = rest.p[k], y = rest.p[k + 1], z = rest.p[k + 2];
    const t = THREE.MathUtils.clamp((-y - 0.025) / 0.17, 0, 1);
    const weight = t * t * (3 - 2 * t);
    const c = x < 0 ? cl : cr, s = x < 0 ? sl : sr;
    const dy = y + 0.12;
    positions.setXYZ(i, x, y + weight * (dy * c - z * s - 0.12 - y), z + weight * (dy * s + z * c - z));
    const nx = rest.n[k], ny = rest.n[k + 1], nz = rest.n[k + 2];
    const yy = ny + weight * (ny * c - nz * s - ny), zz = nz + weight * (ny * s + nz * c - nz);
    const inverse = 1 / Math.max(1e-9, Math.hypot(nx, yy, zz));
    normals.setXYZ(i, nx * inverse, yy * inverse, zz * inverse);
  }
  positions.needsUpdate = true; normals.needsUpdate = true;
}
