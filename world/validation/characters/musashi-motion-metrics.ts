/** Geometry QA of the real runtime actor, not screenshots or browser/WebGL acceptance. */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { CharacterKit } from '../../src/characters/characterKit.ts';

export function musashiGeometry(actor: CharacterKit) {
  const blades: THREE.SkinnedMesh[] = [], body: {mesh:THREE.SkinnedMesh; indices:number[]}[] = [], feet:{mesh:THREE.SkinnedMesh; indices:number[]}[]=[];
  const point = new THREE.Vector3();
  actor.model.traverse(object => {
    const mesh = object as THREE.SkinnedMesh; if (!mesh.isSkinnedMesh) return;
    if (/Katana.*(?:folded_polished_steel|honed_silver_edge)/.test(mesh.name)) blades.push(mesh);
    const weight=mesh.geometry.attributes.skinWeight,joint=mesh.geometry.attributes.skinIndex;
    const core:boolean[]=[],foot:number[]=[];
    for(let i=0;i<weight.count;i++){
      let coreWeight=0,footWeight=0;
      for(let c=0;c<4;c++) {const name=mesh.skeleton.bones[joint.getComponent(i,c)].name,w=weight.getComponent(i,c);if(/(?:Hips|Spine|UpLeg|Leg|Foot|Toe)/.test(name))coreWeight+=w;if(/(?:Foot|Toe)/.test(name))footWeight+=w;}
      core.push(coreWeight>.8);if(footWeight>.8)foot.push(i);
    }
    const indices:number[]=[],source=mesh.geometry.index;
    for(let i=0;i<(source?.count??weight.count);i+=3){const ids=[0,1,2].map(c=>source?source.getX(i+c):i+c);if(ids.every(v=>core[v]))indices.push(...ids);}
    if(indices.length)body.push({mesh,indices});if(foot.length)feet.push({mesh,indices:foot});
  });
  function sync(){actor.root.updateWorldMatrix(true,true);actor.model.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)(o as THREE.SkinnedMesh).skeleton.update();});}
  function vertex(mesh:THREE.SkinnedMesh,i:number){return mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);}
  function geometry(entries:{mesh:THREE.SkinnedMesh;indices:number[]}[]) {
    const positions:number[]=[];
    for(const {mesh,indices} of entries)for(const i of indices)positions.push(...vertex(mesh,i).toArray());
    return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  }
  function clearance(){
    sync();const torso=geometry(body),bvh=new MeshBVH(torso),blade=geometry(blades.map(mesh=>({mesh,indices:mesh.geometry.index?Array.from(mesh.geometry.index.array):Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i)})));
    blade.boundsTree=new MeshBVH(blade);
    const intersects=bvh.bvhcast(blade.boundsTree,new THREE.Matrix4(),{intersectsTriangles:(a,b)=>a.intersectsTriangle(b)});
    let distance=Infinity;const attribute=blade.attributes.position,target={point:new THREE.Vector3(),distance:0,faceIndex:0};
    for(let i=0;i<attribute.count;i++){point.fromBufferAttribute(attribute,i);const closest=bvh.closestPointToPoint(point,target,0,distance);if(closest)distance=Math.min(distance,closest.distance);}
    torso.dispose();blade.dispose();return {intersects,distance};
  }
  function ground(){sync();let bladeMin=Infinity,footMin=Infinity;for(const mesh of blades)for(let i=0;i<mesh.geometry.attributes.position.count;i++)bladeMin=Math.min(bladeMin,vertex(mesh,i).y);for(const {mesh,indices}of feet)for(const i of indices)footMin=Math.min(footMin,vertex(mesh,i).y);return{bladeMin,footMin};}
  return {blades,feet,body,sync,clearance,ground};
}
