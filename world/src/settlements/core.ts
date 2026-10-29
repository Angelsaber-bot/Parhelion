import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeParts } from './merge';
import type { WorldGrid } from '../grid';
import type { Layout } from '../types';
import { REGIONS } from '../regions';
import type { SettlementKit, SettlementPlacement, PlacedNpcSocket, RegionId } from './types';

const PREFERRED: Record<RegionId, [number, number]> = {
  alpha: [-166, 212], britain: [-108, -135], blacksail: [-160, 76], winter: [10, 180], kyoto: [-42, 100],
};
const FOUNDATION: Record<RegionId, string> = {
  alpha: '#6f899b', britain: '#8c8170', blacksail: '#756c56', winter: '#8c939a', kyoto: '#827b70',
};

export function settlementHeight(grid: WorldGrid, x: number, z: number) {
  const fx = (x - grid.x0) / grid.cell, fz = (z - grid.z0) / grid.cell;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix + 1 >= grid.nx || iz + 1 >= grid.nz) return -Infinity;
  const tx = fx - ix, tz = fz - iz, i = iz * grid.nx + ix;
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(grid.h[i], grid.h[i + 1], tx),
    THREE.MathUtils.lerp(grid.h[i + grid.nx], grid.h[i + grid.nx + 1], tx), tz);
}
function segmentDistance(x: number, z: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
export interface PlacementContext { grid: WorldGrid; blockers: MeshBVH; layout: Pick<Layout, 'markers' | 'paths'>; }
/** Read the real terrain/collision, never drop buildings on top of an existing town or quest. */
export function findSettlementPlacement(kit: SettlementKit, ctx: PlacementContext): SettlementPlacement {
  const region = REGIONS.find((r) => r.id === kit.id)!;
  const [ox, oz] = region.offset, [w, d] = kit.footprint;
  const [px, pz] = PREFERRED[kit.id];
  const radius = Math.hypot(w, d) / 2;
  const candidates: [number, number][] = [[px, pz]];
  for (let z = -280; z <= 280; z += 6) for (let x = -280; x <= 280; x += 6) candidates.push([x, z]);
  candidates.sort((a, b) => Math.hypot(a[0] - px, a[1] - pz) - Math.hypot(b[0] - px, b[1] - pz));
  const box = new THREE.Box3();
  const relevantPaths = ctx.layout.paths.filter((path) => path.some(([x,z]) => Math.abs(x-ox)<340 && Math.abs(z-oz)<340));
  const rejected = { bounds:0, paths:0, markers:0, terrain:0, approach:0, props:0, ramp:0 };
  for (const [lx, lz] of candidates) {
    const x = lx + ox, z = lz + oz;
    if (Math.abs(lx) + w/2 > 310 || Math.abs(lz) + d/2 + 12 > 310) {rejected.bounds++;continue;}
    let pathDistance = Infinity;
    for (const path of relevantPaths) for (let i = 1; i < path.length; i++) pathDistance = Math.min(pathDistance, segmentDistance(x,z,path[i-1],path[i]));
    if (pathDistance < radius + 3 || pathDistance > radius + 52) {rejected.paths++;continue;}
    if (ctx.layout.markers.some((m) => ['spawn','objective','interact'].includes(m.type) && Math.hypot(x-m.p[0],z-m.p[2]) < radius + (m.radius??3) + 4)) {rejected.markers++;continue;}
    const heights: number[] = [];
    for (let dz = -d/2; dz <= d/2 + .01; dz += d/4) for (let dx = -w/2; dx <= w/2 + .01; dx += w/4)
      heights.push(settlementHeight(ctx.grid,x+dx,z+dz));
    const min = Math.min(...heights), max = Math.max(...heights), range = max-min;
    if (!Number.isFinite(min) || min < 2.2 || range > 1.4) {rejected.terrain++;continue;}
    const y = max + .035;
    const ex = x + kit.entry[0], ez = z + Math.max(kit.entry[1],d/2);
    const approach = settlementHeight(ctx.grid, ex, ez + 9);
    if (!Number.isFinite(approach) || approach < 2.2 || y-approach < -.15 || y-approach > 2.3) {rejected.approach++;continue;}
    box.set(new THREE.Vector3(x-w/2-.8,y+.12,z-d/2-.8),new THREE.Vector3(x+w/2+.8,y+18,z+d/2+.8));
    if (ctx.blockers.intersectsBox(box,new THREE.Matrix4())) {rejected.props++;continue;}
    box.set(new THREE.Vector3(ex-2,Math.min(y,approach)+.12,ez),new THREE.Vector3(ex+2,y+3,ez+10));
    if (ctx.blockers.intersectsBox(box,new THREE.Matrix4())) {rejected.ramp++;continue;}
    return { id:kit.id,name:kit.name,position:[x,y,z],entry:[ex,y,ez],footprint:kit.footprint,groundRange:range };
  }
  throw new Error(`No safe terrain slot found for ${kit.id} settlement: ${JSON.stringify(rejected)}`);
}

function positionGeometry(mesh: THREE.Mesh) {
  let g = new THREE.BufferGeometry().setAttribute('position',mesh.geometry.attributes.position.clone());
  if (mesh.geometry.index) g.setIndex(mesh.geometry.index.clone());
  g.applyMatrix4(mesh.matrixWorld);
  if (g.index) g = g.toNonIndexed();
  return g;
}
function rampGeometry(width: number, depth: number, drop: number) {
  const hw=width/2;
  const p=[-hw,0,0, hw,0,0, hw,-drop,depth, -hw,-drop,depth, -hw,-drop-.15,0, hw,-drop-.15,0, hw,-drop-.15,depth, -hw,-drop-.15,depth];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);g.computeVertexNormals();return g;
}
/** Batch by material to avoid hundreds of small prop draw calls. Collision is extracted first. */
export function batchSettlementVisuals(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const lights: THREE.Light[] = [];
  group.traverse((o)=>{
    if (o instanceof THREE.Light) { const light=o.clone(); light.position.set(0,0,0);light.quaternion.identity();light.scale.set(1,1,1); light.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)); lights.push(light); }
    if (!(o instanceof THREE.Mesh) || o.userData.collisionOnly || !o.visible) return;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    if(materials.length!==1) throw new Error(`Settlement mesh needs one material: ${o.name}`);
    let g=o.geometry.clone();if(g.index)g=g.toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
    if(!g.attributes.normal)g.computeVertexNormals();
    // Uniform attribute layout within each material bucket.
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
    const list=batches.get(materials[0])??[];list.push(g);batches.set(materials[0],list);
  });
  group.clear();
  if(lights.length)group.add(...lights);
  for(const [material,geos] of batches){const merged=mergeParts(geos);const mesh=new THREE.Mesh(merged,material);mesh.name=`Settlement_${material.name||material.type}`;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);for(const g of geos)g.dispose();}
}

export function installSettlements(kits: SettlementKit[], ctx: PlacementContext) {
  const root=new THREE.Group();root.name='Chapter_Lived_In_Hubs';
  const collisionGeometries:THREE.BufferGeometry[]=[];
  const npcs:PlacedNpcSocket[]=[];
  const placements:SettlementPlacement[]=[];
  for(const kit of kits){
    const p=findSettlementPlacement(kit,ctx);placements.push(p);
    const [x,y,z]=p.position,[w,d]=kit.footprint;
    const mat=new THREE.MeshStandardMaterial({color:FOUNDATION[kit.id],roughness:.95});mat.name=`${kit.id}_foundation`;
    const base=new THREE.Mesh(new THREE.BoxGeometry(w,Math.max(.18,p.groundRange+.18),d),mat);
    base.name='Settlement_foundation';base.position.y=-Math.max(.18,p.groundRange+.18)/2-.12;base.userData.solid=true;kit.group.add(base);
    const ex=kit.entry[0],ez=Math.max(kit.entry[1],d/2);
    const approach=settlementHeight(ctx.grid,x+ex,z+ez+9);
    const ramp=new THREE.Mesh(rampGeometry(3.4,9,Math.max(0,y-approach)),mat);
    ramp.position.set(ex,.02,ez);ramp.name='Settlement_access_ramp';ramp.userData.solid=true;kit.group.add(ramp);
    kit.group.name=`Settlement_${kit.id}`;kit.group.position.set(x,y,z);root.add(kit.group);root.updateMatrixWorld(true);
    kit.group.traverse((o)=>{if(o instanceof THREE.Mesh && o.userData.solid)collisionGeometries.push(positionGeometry(o));});
    for(const socket of kit.npcs)npcs.push({...socket,region:kit.id,position:[x+socket.position[0],y+socket.position[1],z+socket.position[2]]});
    batchSettlementVisuals(kit.group);
  }
  return {root,collisionGeometries,npcs,placements,update(player:THREE.Vector3){for(const group of root.children)group.visible=Math.hypot(group.position.x-player.x,group.position.z-player.z)<235;}};
}
