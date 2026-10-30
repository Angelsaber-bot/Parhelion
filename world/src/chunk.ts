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

interface CullItem {
  mesh: THREE.Mesh; c: THREE.Vector3; r: number; max: number; outline: THREE.Object3D | null;
}
interface CullNode {
  x0: number; y0: number; z0: number; x1: number; y1: number; z1: number;
  minRange: number; maxRange: number; minRadius: number; maxRadius: number;
  visible: boolean | null;
  children: [CullNode, CullNode] | null;
  items: CullItem[] | null;
}

/** Build once after immutable map chunks have their final world transforms. */
function cullTree(items: CullItem[], outline: boolean, outlineDist: number): CullNode | null {
  if (!items.length) return null;
  const node: CullNode = {
    x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity,
    minRange: Infinity, maxRange: 0, minRadius: Infinity, maxRadius: 0,
    visible: null, children: null, items: null,
  };
  for (const item of items) {
    node.x0 = Math.min(node.x0, item.c.x); node.x1 = Math.max(node.x1, item.c.x);
    node.y0 = Math.min(node.y0, item.c.y); node.y1 = Math.max(node.y1, item.c.y);
    node.z0 = Math.min(node.z0, item.c.z); node.z1 = Math.max(node.z1, item.c.z);
    const range = outline ? outlineDist : item.max;
    node.minRange = Math.min(node.minRange, range); node.maxRange = Math.max(node.maxRange, range);
    node.minRadius = Math.min(node.minRadius, item.r); node.maxRadius = Math.max(node.maxRadius, item.r);
  }
  if (items.length <= 16) node.items = items;
  else {
    const axis = node.x1 - node.x0 >= node.z1 - node.z0 ? 'x' : 'z';
    items.sort((a, b) => a.c[axis] - b.c[axis]);
    const mid = items.length >> 1;
    node.children = [cullTree(items.slice(0, mid), outline, outlineDist)!, cullTree(items.slice(mid), outline, outlineDist)!];
  }
  return node;
}

function setCullNode(node: CullNode, visible: boolean, outline: boolean): void {
  // Far regions remain untouched until the eye/range reaches them again.
  if (node.visible === visible) return;
  node.visible = visible;
  if (node.children) {
    setCullNode(node.children[0], visible, outline); setCullNode(node.children[1], visible, outline);
  } else for (const item of node.items!) (outline ? item.outline! : item.mesh).visible = visible;
}

function updateCullNode(node: CullNode, eye: THREE.Vector3, scale: number, outline: boolean, outlineDist: number): void {
  const dx = Math.max(node.x0 - eye.x, 0, eye.x - node.x1);
  const dy = Math.max(node.y0 - eye.y, 0, eye.y - node.y1);
  const dz = Math.max(node.z0 - eye.z, 0, eye.z - node.z1);
  const farRange = node.maxRange * scale + node.maxRadius;
  if (dx * dx + dy * dy + dz * dz >= farRange * farRange) {
    setCullNode(node, false, outline); return;
  }
  const fx = Math.max(Math.abs(eye.x - node.x0), Math.abs(eye.x - node.x1));
  const fy = Math.max(Math.abs(eye.y - node.y0), Math.abs(eye.y - node.y1));
  const fz = Math.max(Math.abs(eye.z - node.z0), Math.abs(eye.z - node.z1));
  const nearRange = node.minRange * scale + node.minRadius;
  if (fx * fx + fy * fy + fz * fz < nearRange * nearRange) {
    setCullNode(node, true, outline); return;
  }
  node.visible = null;
  if (node.children) {
    updateCullNode(node.children[0], eye, scale, outline, outlineDist);
    updateCullNode(node.children[1], eye, scale, outline, outlineDist);
  } else for (const item of node.items!) {
    const range = (outline ? outlineDist : item.max) * scale + item.r;
    (outline ? item.outline! : item.mesh).visible = item.c.distanceToSquared(eye) < range * range;
  }
}

/** Exact sphere/range culling of immutable chunks and outlines, with a spatial broad phase.
 * Only boundary leaves need per-mesh checks; unchanged distant regions cost no visibility writes.
 * The culler owns these visibility flags (stateful gameplay objects must not be registered).
 */
export class DistanceCuller {
  items: CullItem[] = [];
  private drawTrees: CullNode[] = [];
  private outlineTree: CullNode | null = null;
  private dirty = true;
  private builtOutlineDist = NaN;
  constructor(public outlineDist = 150) {}
  add(mesh: THREE.Mesh, max: number) {
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const s = mesh.geometry.boundingSphere!;
    const c = s.center.clone().applyMatrix4(mesh.matrixWorld);
    this.items.push({ mesh, c, r: s.radius * mesh.matrixWorld.getMaxScaleOnAxis(), max, outline: mesh.children.find((o) => o.name.endsWith('__outline')) ?? null });
    this.dirty = true;
  }
  update(eye: THREE.Vector3, scale = 1) {
    if (this.dirty || this.builtOutlineDist !== this.outlineDist) {
      // Keep always-drawn landmarks separate: a huge landmark range must not
      // prevent the broad phase from rejecting nearby-detail trees/rocks.
      const ranges = new Map<number, CullItem[]>();
      for (const item of this.items) {
        let group = ranges.get(item.max);
        if (!group) ranges.set(item.max, group = []);
        group.push(item);
      }
      this.drawTrees = Array.from(ranges.values(), group => cullTree(group, false, this.outlineDist)!);
      this.outlineTree = cullTree(this.items.filter(item => item.outline), true, this.outlineDist);
      this.builtOutlineDist = this.outlineDist;
      this.dirty = false;
    }
    for (const tree of this.drawTrees) updateCullNode(tree, eye, scale, false, this.outlineDist);
    if (this.outlineTree) updateCullNode(this.outlineTree, eye, scale, true, this.outlineDist);
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

/** Only for immutable map art, after region/pivot transforms are final.
 * World transforms stay fixed even while the scene root updates lights/actors. */
export function freezeStaticArt(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
}
