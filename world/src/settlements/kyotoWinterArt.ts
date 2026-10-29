import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Small material-batched architectural kit. Collidable and decorative faces never share a batch. */
export class KyotoWinterArt {
  readonly root = new THREE.Group();
  private bins = new Map<string, { material: THREE.MeshStandardMaterial; solid: boolean; parts: THREE.BufferGeometry[] }>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  constructor(name: string) { this.root.name = name; }
  mat(color: string, roughness = .84, metalness = 0, glow = 0) {
    const key = `${color}:${roughness}:${metalness}:${glow}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({color, roughness, metalness, emissive: glow ? color : '#000000', emissiveIntensity: glow}));
    return this.materials.get(key)!;
  }
  geo(g: THREE.BufferGeometry, m: THREE.MeshStandardMaterial, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, solid = false) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)), new THREE.Vector3(1,1,1));
    g.applyMatrix4(matrix);
    const key = `${m.uuid}:${solid}`;
    if (!this.bins.has(key)) this.bins.set(key,{material:m,solid,parts:[]});
    this.bins.get(key)!.parts.push(g.index ? g.toNonIndexed() : g);
    if(g.index) g.dispose();
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.MeshStandardMaterial, solid=false, ry=0, rx=0, rz=0) {
    this.geo(new THREE.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz,solid);
  }
  cyl(x:number,y:number,z:number,r:number,h:number,m:THREE.MeshStandardMaterial,solid=false,segments=10,top=r) {
    this.geo(new THREE.CylinderGeometry(top,r,h,segments),m,x,y,z,0,0,0,solid);
  }
  beam(a:[number,number,number],b:[number,number,number],r:number,m:THREE.MeshStandardMaterial,solid=false) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), delta=q.clone().sub(p);
    const g=new THREE.CylinderGeometry(r,r,delta.length(),8); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    const mid=p.add(q).multiplyScalar(.5); this.geo(g,m,mid.x,mid.y,mid.z,0,0,0,solid);
  }
  roof(x:number,z:number,w:number,d:number,eave:number,rise:number,material:THREE.MeshStandardMaterial,trim:THREE.MeshStandardMaterial,snow?:THREE.MeshStandardMaterial) {
    const angle=Math.atan2(rise,d/2), slope=Math.hypot(d/2,rise);
    for (const side of [-1,1]) {
      this.box(x,eave+rise/2,z+side*d/4,w,.25,slope+.2,material,true,0,side*angle);
      this.box(x,eave+.03,z+side*d/2,w+.24,.2,.22,trim);
      if(snow) this.box(x,eave+rise/2+.22,z+side*d/4,w+.12,.18,slope+.15,snow,false,0,side*angle);
    }
    this.box(x,eave+rise+.12,z,w+.35,.25,.3,trim);
    // Closed timber attic cheeks: layered boards avoid hollow black triangular facade gaps.
    for(const side of [-1,1])for(let dy=.12;dy<rise-.08;dy+=.22){
      const span=Math.max(.1,d*(1-dy/rise)-.3);
      this.box(x+side*(w/2-.72),eave+dy,z,.12,.2,span,trim);
    }
    // Timber gable triangles at either end support the visible roof silhouette.
    for(const side of [-1,1]) {
      this.beam([x+side*w/2,eave,z-d/2],[x+side*w/2,eave+rise,z],.11,trim);
      this.beam([x+side*w/2,eave+rise,z],[x+side*w/2,eave,z+d/2],.11,trim);
    }
  }
  finish() {
    for(const [key,bin] of this.bins) {
      const geometry=mergeGeometries(bin.parts,false); if(!geometry) throw new Error(`Cannot merge ${key}`);
      const mesh=new THREE.Mesh(geometry,bin.material); mesh.name=`${this.root.name}_${bin.solid?'solid':'detail'}_${this.root.children.length}`;
      mesh.userData.solid=bin.solid; mesh.castShadow=true; mesh.receiveShadow=true; this.root.add(mesh);
      for(const g of bin.parts)g.dispose();
    }
    return this.root;
  }
}
