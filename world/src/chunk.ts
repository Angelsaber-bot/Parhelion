// Split the generator's map-wide merged meshes into spatial chunks so frustum culling,
// shadow culling and distance culling can skip most of the world each frame.
import * as THREE from 'three';

/** Returns chunk meshes (sharing the source's attribute buffers) and removes the source from its parent. */
export function chunkMesh(mesh: THREE.Mesh, cell: number): THREE.Mesh[] {
  const g = mesh.geometry as THREE.BufferGeometry;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const index = g.index;
  const tris = index ? index.count / 3 : pos.count / 3;
  const vid = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const buckets = new Map<string, number[]>();
  for (let t = 0; t < tris; t++) {
    const a = vid(t, 0), b = vid(t, 1), c = vid(t, 2);
    const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(a, b, c);
  }
  const out: THREE.Mesh[] = [];
  const v = new THREE.Vector3();
  for (const list of buckets.values()) {
    const cg = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) cg.setAttribute(name, attr);
    cg.setIndex(new THREE.BufferAttribute(pos.count > 65535 ? new Uint32Array(list) : new Uint16Array(list), 1));
    const box = new THREE.Box3();
    for (const i of list) box.expandByPoint(v.fromBufferAttribute(pos, i));
    cg.boundingBox = box;
    cg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(cg, mesh.material);
    m.name = mesh.name;
    m.userData = mesh.userData;
    m.castShadow = mesh.castShadow;
    m.receiveShadow = mesh.receiveShadow;
    m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
    mesh.parent?.add(m);
    out.push(m);
  }
  mesh.parent?.remove(mesh);
  return out;
}

/** Hides chunks (and their outlines) past a per-mesh draw distance. */
export class DistanceCuller {
  items: { mesh: THREE.Mesh; c: THREE.Vector3; r: number; max: number; outline: THREE.Object3D | null }[] = [];
  constructor(public outlineDist = 150) {}
  add(mesh: THREE.Mesh, max: number) {
    mesh.updateWorldMatrix(true, false);
    const s = (mesh.geometry as THREE.BufferGeometry).boundingSphere!;
    const c = s.center.clone().applyMatrix4(mesh.matrixWorld);
    this.items.push({ mesh, c, r: s.radius * mesh.matrixWorld.getMaxScaleOnAxis(), max, outline: mesh.children.find((o) => o.name.endsWith('__outline')) ?? null });
  }
  update(eye: THREE.Vector3, scale = 1) {
    for (const it of this.items) {
      const d2 = it.c.distanceToSquared(eye);
      // Equivalent sphere/range test without one square root per chunk per frame.
      it.mesh.visible = d2 < (it.max * scale + it.r) ** 2;
      if (it.outline) it.outline.visible = d2 < (this.outlineDist * scale + it.r) ** 2;
    }
  }
}

/** A nested dynamic ancestor/descendant must never be baked into immutable world transforms. */
export function isStaticArtEligible(root: THREE.Object3D): boolean {
  const dynamic = (object: THREE.Object3D) => object.name === 'Water' || object.name.startsWith('TGT_') ||
    ['spin', 'bob', 'dynamic', 'showWhen', 'hideWhen', 'opensWhen'].some(key => !!object.userData[key]);
  for (let ancestor: THREE.Object3D | null = root; ancestor; ancestor = ancestor.parent) if (dynamic(ancestor)) return false;
  let eligible = true;
  root.traverse(object => { if (dynamic(object)) eligible = false; });
  return eligible;
}

interface FrozenTraversal {
  root: THREE.Object3D;
  original: THREE.Object3D['updateMatrixWorld'];
  nodes: THREE.Object3D[];
}
// Weak ownership does not retain disposed scenes. Every descendant watches topology
// changes so a late dynamic child at any depth falls back to normal traversal.
const frozenOwners = new WeakMap<THREE.Object3D, FrozenTraversal>();
function restoreFrozenTraversal(state: FrozenTraversal) {
  if (state.root.updateMatrixWorld === updateFrozenMatrixWorld) state.root.updateMatrixWorld = state.original;
  state.root.removeEventListener('removed', frozenTopologyChanged);
  for (const node of state.nodes) if (frozenOwners.get(node) === state) {
    node.removeEventListener('childadded', frozenTopologyChanged);
    node.removeEventListener('childremoved', frozenTopologyChanged);
    frozenOwners.delete(node);
  }
}
function frozenTopologyChanged(event: { target?: THREE.Object3D | null }) {
  const state = event.target && frozenOwners.get(event.target);
  if (state) restoreFrozenTraversal(state);
}
function updateFrozenMatrixWorld(this: THREE.Object3D, force?: boolean) {
  const state = frozenOwners.get(this);
  // A caller may have saved/wrapped the fast method before topology invalidation.
  // Its stale reference must still behave like ordinary Three traversal.
  if (!state) { THREE.Object3D.prototype.updateMatrixWorld.call(this, force); return; }
  // Explicitly thawing the root also opts back into Three's original behavior.
  if (this.matrixAutoUpdate || this.matrixWorldAutoUpdate || this.matrixWorldNeedsUpdate) {
    restoreFrozenTraversal(state); state.original.call(this, force);
  }
  // All existing descendant matrices are immutable world-space snapshots. Visibility,
  // materials and geometry remain live; explicit updateWorldMatrix is untouched.
}

/** Only for immutable map art, after region/pivot transforms are final.
 * World transforms stay fixed even while the scene root updates lights/actors. */
export function freezeStaticArt(root: THREE.Object3D) {
  const previous = frozenOwners.get(root);
  if (previous) restoreFrozenTraversal(previous);
  root.updateWorldMatrix(true, true);
  const nodes: THREE.Object3D[] = [];
  root.traverse((object) => {
    const owner = frozenOwners.get(object);
    if (owner) restoreFrozenTraversal(owner);
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
    nodes.push(object);
  });
  // Never suppress a custom matrix callback (for example a moving actor subclass).
  if (nodes.some(node => node.updateMatrixWorld !== THREE.Object3D.prototype.updateMatrixWorld)) return;
  const state: FrozenTraversal = { root, original: root.updateMatrixWorld, nodes };
  for (const node of nodes) {
    frozenOwners.set(node, state);
    node.addEventListener('childadded', frozenTopologyChanged);
    node.addEventListener('childremoved', frozenTopologyChanged);
  }
  root.addEventListener('removed', frozenTopologyChanged);
  root.updateMatrixWorld = updateFrozenMatrixWorld;
}
