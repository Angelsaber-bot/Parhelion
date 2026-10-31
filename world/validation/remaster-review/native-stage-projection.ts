import * as THREE from 'three';
/** Read-only full native-vertex projection at selected actual-input stage frames.
 * Includes skinned vertices/morph targets; reports clipping rather than disguising
 * intended close-ups as pass/fail. No occlusion, shader or GPU claim. */
export function nativeStageProjection(stage:any){
 const oldAspect=stage.camera.aspect, clone=stage.clone;const rows:any[]=[];
 stage.scene.updateMatrixWorld(true);
 clone.traverse((o:any)=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const meshes:any[]=[];clone.traverse((o:any)=>{if(o.isMesh&&o.visible&&o.geometry?.attributes.position){let visible=true;for(let p=o.parent;p&&p!==clone.parent;p=p.parent)if(!p.visible)visible=false;if(visible)meshes.push(o);}});
 const point=new THREE.Vector3(),projected=new THREE.Vector3();
 try{for(const aspect of [16/9,9/16]){
  stage.setAspect(aspect);const camera=stage.camera;
  const bounds=meshes.map(mesh=>{let outside=0,behind=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];const geometry=mesh.geometry,attributeCount=geometry.attributes.position.count,total=geometry.index?.count??attributeCount,drawStart=Math.max(0,geometry.drawRange.start),drawEnd=Math.min(total,drawStart+geometry.drawRange.count);const used=new Set<number>();const ranges=Array.isArray(mesh.material)?geometry.groups.filter((g:any)=>mesh.material[g.materialIndex]?.visible!==false).map((g:any)=>[Math.max(drawStart,g.start),Math.min(drawEnd,g.start+g.count)]):mesh.material.visible===false?[]:[[drawStart,drawEnd]];for(const [start,end]of ranges)for(let j=start;j<end;j++)used.add(geometry.index?geometry.index.getX(j):j);const count=used.size;
   for(const i of used){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);projected.copy(point).project(camera);const a=projected.toArray();for(let j=0;j<3;j++){min[j]=Math.min(min[j],a[j]);max[j]=Math.max(max[j],a[j]);}if(Math.abs(a[0])>1||Math.abs(a[1])>1)outside++;if(a[2]<-1||a[2]>1)behind++;}
   return{name:mesh.name,vertices:count,attributeVertices:attributeCount,min,max,outside,behind};
  });rows.push({aspect,camera:camera.position.toArray(),meshes:bounds});
 }}finally{stage.setAspect(oldAspect);}
 return rows;
}
