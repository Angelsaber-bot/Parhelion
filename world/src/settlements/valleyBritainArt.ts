import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small authored architectural kit. Repeated pieces share geometry/materials and are batched. */
export class SettlementArt {
  group = new THREE.Group();
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
  mat(color: string, metal = 0, glow = 0) {
    const key = `${color}/${metal}/${glow}`;
    if (!this.mats.has(key)) this.mats.set(key, new THREE.MeshStandardMaterial({
      color, roughness: metal ? .48 : .83, metalness: metal,
      emissive: glow ? color : '#000000', emissiveIntensity: glow,
    }));
    return this.mats.get(key)!;
  }
  mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: number[], scale: number[], solid = false) {
    const m = new THREE.Mesh(geometry, material);
    m.name = name; m.position.set(p[0], p[1], p[2]); m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true; m.receiveShadow = true; m.userData.solid = solid;
    this.group.add(m); return m;
  }
  box(name: string, p: number[], size: number[], color: string, solid = false, metal = 0, glow = 0) {
    return this.mesh(name, this.boxGeo, this.mat(color, metal, glow), p, size, solid);
  }
  cyl(name: string, p: number[], radius: number, h: number, color: string, solid = false, metal = 0) {
    return this.mesh(name, this.cylinderGeo, this.mat(color, metal), p, [radius, h, radius], solid);
  }
  beam(name: string, a: number[], b: number[], width: number, color: string, solid = false) {
    const from = new THREE.Vector3(...a as [number, number, number]);
    const to = new THREE.Vector3(...b as [number, number, number]);
    const m = this.box(name, from.clone().add(to).multiplyScalar(.5).toArray(), [width, from.distanceTo(to), width], color, solid);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    return m;
  }
  room(name: string, x: number, z: number, w: number, d: number, h: number, color: string, door = 3.2) {
    this.box(`${name}_floor`, [x, -.13, z], [w, .26, d], '#b8b2a3', true);
    this.box(`${name}_back`, [x, h / 2, z - d / 2], [w, h, .34], color, true);
    for (const side of [-1, 1]) {
      this.box(`${name}_side`, [x + side * w / 2, h / 2, z], [.34, h, d], color, true);
      this.box(`${name}_front_pier`, [x + side * (w + door) / 4, h / 2, z + d / 2], [(w - door) / 2, h, .34], color, true);
    }
    this.box(`${name}_door_lintel`, [x, h - .3, z + d / 2], [door, .6, .36], color, true);
  }
  gable(name: string, x: number, z: number, w: number, d: number, y: number, rise: number, color: string, trim: string) {
    const half = w / 2, angle = Math.atan2(rise, half), length = Math.hypot(half, rise);
    for (const s of [-1, 1]) {
      const roof = this.box(`${name}_roof`, [x + s * half / 2, y + rise / 2, z], [length + .25, .22, d], color, true);
      roof.rotation.z = -s * angle;
      for (const edge of [-1, 1]) this.beam(`${name}_bargeboard`, [x, y + rise + .06, z + edge * d / 2], [x + s * half, y + .06, z + edge * d / 2], .18, trim);
      this.box(`${name}_eave`, [x + s * half, y, z], [.2, .24, d + .12], trim);
      for (let j = 1; j <= 4; j++) {
        const q = j / 5;
        this.box(`${name}_roof_seam`, [x + s * half * q, y + rise * (1 - q) + .13, z], [.045, .045, d], trim);
      }
    }
    this.box(`${name}_ridge`, [x, y + rise + .14, z], [.28, .28, d + .3], trim);
  }
  window(name: string, x: number, y: number, z: number, w: number, h: number, frame: string, glass: string) {
    this.box(`${name}_glass`, [x, y, z], [w, h, .06], glass, false, .05, .13);
    for (const s of [-1, 1]) {
      this.box(`${name}_jamb`, [x + s * w / 2, y, z + .05], [.11, h + .2, .14], frame);
      this.box(`${name}_rail`, [x, y + s * h / 2, z + .05], [w + .2, .1, .14], frame);
    }
    this.box(`${name}_mullion`, [x, y, z + .07], [.075, h, .12], frame);
    this.box(`${name}_crossbar`, [x, y, z + .07], [w, .07, .12], frame);
    this.box(`${name}_sill`, [x, y - h / 2 - .12, z + .16], [w + .4, .16, .4], frame);
  }
  table(name: string, x: number, z: number, w: number, d: number, wood: string, y = 0) {
    this.box(`${name}_top`, [x, y + .9, z], [w, .18, d], wood, true);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(`${name}_leg`, [x + sx * (w / 2 - .2), y + .4, z + sz * (d / 2 - .15)], [.14, .8, .14], wood);
  }
  barrel(name: string, x: number, z: number, color: string, y = 0) {
    this.cyl(name, [x, y + .48, z], .42, .96, color, true);
    for (const yy of [.16, .75]) this.cyl(`${name}_hoop`, [x, y + yy, z], .435, .075, '#515965', false, .55);
    for (let k = 0; k < 8; k++) {
      const angle = k * Math.PI / 4;
      this.box(`${name}_stave`, [x + Math.cos(angle) * .42, y + .47, z + Math.sin(angle) * .42], [.025, .8, .025], '#45372b');
    }
  }
  finish(name: string) {
    // Batch static render geometry by material AND collision classification. No per-frame geometry work.
    const buckets = new Map<string, { geo: THREE.BufferGeometry[]; mat: THREE.Material; solid: boolean }>();
    this.group.updateMatrixWorld(true);
    for (const obj of this.group.children) {
      const m = obj as THREE.Mesh;
      const mat = m.material as THREE.Material;
      const key = `${mat.uuid}/${m.userData.solid ? 1 : 0}`;
      if (!buckets.has(key)) buckets.set(key, { geo: [], mat, solid: !!m.userData.solid });
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      buckets.get(key)!.geo.push(geo.applyMatrix4(m.matrix));
    }
    const group = new THREE.Group(); group.name = name;
    for (const {geo, mat, solid} of buckets.values()) {
      const geometry = mergeGeometries(geo, false)!;
      for (const g of geo) g.dispose();
      const m = new THREE.Mesh(geometry, mat); m.name = `${name}_${solid ? 'structure' : 'craft'}_${group.children.length}`;
      m.userData.solid = solid; m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
    return group;
  }
}
