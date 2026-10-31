/** Shared compact CPU-deformed pose export. No animation retiming or image synthesis. */
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Collider } from '../../src/player.ts';
export class RuntimePoseExporter {
  private shared=new Set<string>();
  constructor(private out:string){}
  async frame(id:string,model:THREE.Object3D,metadata:Record<string,unknown>,colliders?:Collider[],center?:THREE.Vector3){
    await mkdir(this.out,{recursive:true});model.updateWorldMatrix(true,true);
    const meshes:any[]=[],point=new THREE.Vector3();
    model.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;for(let n:THREE.Object3D|null=mesh;n;n=n.parent)if(!n.visible)return;
      if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
      const count=mesh.geometry.attributes.position.count,p=new Float32Array(count*3),uv=new Float32Array(count*2),color=new Float32Array(count*4);
      for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);p.set(point.toArray(),i*3);const a=mesh.geometry.attributes.uv;if(a){uv[i*2]=a.getX(i);uv[i*2+1]=a.getY(i);}const c=mesh.geometry.attributes.color;color.set(c?[c.getX(i),c.getY(i),c.getZ(i),c.itemSize===4?c.getW(i):1]:[1,1,1,1],i*4);}
      const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i));
      const uv1=mesh.geometry.attributes.uv1,uv1File=uv1?`shared-${meshes.length}-uv1.bin`:undefined,uv1Data=uv1?new Float32Array(count*2):undefined;if(uv1Data)for(let i=0;i<count;i++){uv1Data[i*2]=uv1.getX(i);uv1Data[i*2+1]=uv1.getY(i);}
      const file=`${id}-${meshes.length}.bin.gz`,staticFile=`shared-${meshes.length}.bin`,first=!this.shared.has(staticFile);this.shared.add(staticFile);
      meshes.push({name:mesh.name,file,staticFile,...(uv1File?{uv1File,...(first?{uv1Data:Buffer.from(uv1Data!.buffer)}:{})}:{}),count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.name),data:gzipSync(Buffer.from(p.buffer),{level:1}),...(first?{staticData:Buffer.concat([Buffer.from(uv.buffer),Buffer.from(color.buffer),Buffer.from(indices.buffer)])}:{})});
    });
    for(const m of meshes){if(m.uv1Data){await writeFile(join(this.out,m.uv1File),m.uv1Data);delete m.uv1Data;}await writeFile(join(this.out,m.file),m.data);delete m.data;if(m.staticData){await writeFile(join(this.out,m.staticFile),m.staticData);delete m.staticData;}}
    const terrain:number[][]=[];
    if(colliders&&center){const box=new THREE.Box3(center.clone().add(new THREE.Vector3(-3,-1.5,-3)),center.clone().add(new THREE.Vector3(3,1.2,3))),normal=new THREE.Vector3();for(const c of colliders)if(c.enabled)c.bvh.shapecast({intersectsBounds:b=>b.intersectsBox(box),intersectsTriangle:t=>{t.getNormal(normal);if(Math.abs(normal.y)>.7)terrain.push([...t.a.toArray(),...t.b.toArray(),...t.c.toArray()]);return terrain.length>=4096;}});}
    await writeFile(join(this.out,id+'.json'),JSON.stringify({id,...metadata,meshes,...(colliders?{terrainTriangles:terrain}:{}),limitations:['CPU-deformed runtime pose on actual collision triangles; offline render, not WebGL/game-camera/GPU performance','Neutral collision-surface QA material, not final world material']}));
  }
}
