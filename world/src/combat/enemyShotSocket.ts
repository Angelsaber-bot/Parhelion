import { isEnemySkinnedMesh } from './enemyMeshTypes';
import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {Point3} from './combat';

const cache=new WeakMap<object,Readonly<Point3>|null>();
/** Native musket steel is rigidly weighted to weapon_musket. Measure the actual
 * barrel cap at FirePreview's contact sample once, on a private skeleton clone.
 * This is a presentation socket, NEVER a damage origin or animation event clock. */
export function nativeMusketeerContactMuzzle(gltf:Pick<GLTF,'scene'|'animations'>):Readonly<Point3>|null{
 if(cache.has(gltf))return cache.get(gltf)!;
 const clip=gltf.animations.find(value=>value.name==='FirePreview');if(!clip){cache.set(gltf,null);return null;}
 const root=clone(gltf.scene),mixer=new THREE.AnimationMixer(root),points:THREE.Vector3[]=[];
 try{
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;action.time=0;mixer.update(0);root.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(o=>{
   if(!(isEnemySkinnedMesh(o))||![o.material].flat().some(material=>material.name==='Blue black steel'))return;
   const bone=o.skeleton.bones.findIndex(value=>value.name==='weapon_musket');if(bone<0)return;
   const indices=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;o.skeleton.update();
   for(let i=0;i<indices.count;i++){
    let held=false;for(let k=0;k<4;k++)if(indices.getComponent(i,k)===bone&&weights.getComponent(i,k)>.8)held=true;
    if(held)points.push(o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld).applyMatrix4(inverse));
   }
  });
  const front=Math.max(...points.map(point=>point.z)),cap=points.filter(point=>point.z>front-.004);
  if(!cap.length||!Number.isFinite(front)||front<.4||front>2){cache.set(gltf,null);return null;}
  const center=cap.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(1/cap.length);
  if(![center.x,center.y,center.z].every(Number.isFinite)||center.y<.8||center.y>2.2){cache.set(gltf,null);return null;}
  const result=Object.freeze({x:center.x,y:center.y,z:center.z});cache.set(gltf,result);return result;
 }finally{
  mixer.stopAllAction();mixer.uncacheRoot(root);
  root.traverse(o=>{if(isEnemySkinnedMesh(o))o.skeleton.dispose();});
  root.removeFromParent();
 }
}
/** Snapshot transform, not the latest rendered root: dropped presentation frames
 * must not shift a shot back to a stale actor position or unlock its aim. */
export function transformEnemyContactMuzzle(local:Point3,origin:Point3,target:Point3):THREE.Vector3{
 const yaw=Math.atan2(target.x-origin.x,target.z-origin.z),s=Math.sin(yaw),c=Math.cos(yaw);
 return new THREE.Vector3(origin.x+local.x*c+local.z*s,origin.y+local.y,origin.z-local.x*s+local.z*c);
}
