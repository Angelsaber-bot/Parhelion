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

/** Only for immutable map art, after region/pivot transforms are final.
 * World transforms stay fixed even while the scene root updates lights/actors. */
export function freezeStaticArt(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
}
