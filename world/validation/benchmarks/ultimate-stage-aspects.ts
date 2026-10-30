/** CPU projection audit of actual skinned actor vertices, not WebGL screenshots. */
import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import { readCharacter } from '../characters/inspect.ts';
import { SERVANT_MODELS } from '../../src/servant.ts';
import { CHARACTER_KITS } from '../../src/characters/catalog.ts';
import { UltimateStage } from '../../src/ultimateStage.ts';
const rows=[];
for(const identity of ['saber','blackbeard','napoleon','musashi'] as const){
 const definition=identity==='saber'?null:CHARACTER_KITS[identity==='napoleon'?'napoleonMounted':identity];
 const {gltf}=await readCharacter(fileURLToPath(new URL(definition?.assetUrl??SERVANT_MODELS.armor)));
 const stage=new UltimateStage();stage.begin({identity,sourceRoot:gltf.scene,clips:gltf.animations});
 const mixer=new THREE.AnimationMixer(gltf.scene),clip=gltf.animations.find(c=>/attack/i.test(c.name))!;mixer.clipAction(clip).play();
 const audit=(progress:number,sequence:'authored'|'charge-release')=>{
  const actor=stage.scene.children.find(o=>o instanceof THREE.Group)!;actor.updateMatrixWorld(true);
  const vertices:THREE.Vector3[]=[];actor.traverse(o=>{const mesh=o as THREE.SkinnedMesh;if(!mesh.isMesh)return;if(mesh.isSkinnedMesh)mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){const v=new THREE.Vector3();mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);vertices.push(v);}});
  for(const aspect of [16/9,4/3,21/9,9/16]){
   if('setAspect' in stage)(stage as any).setAspect(aspect);else{stage.camera.aspect=aspect;stage.camera.updateProjectionMatrix();}
   stage.camera.updateMatrixWorld(true);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(const v of vertices){const p=v.clone().project(stage.camera);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
   rows.push({identity,sequence,progress,aspect,ndc:{minX,maxX,minY,maxY},inside:minX>=-1&&maxX<=1&&minY>=-1&&maxY<=1});
  }
 };
 for(const progress of Array.from({length:21},(_,i)=>i/20)){
  mixer.setTime(clip.duration*progress);stage.update({elapsed:2+progress,phase:'release',progress,pulse:0});audit(progress,'authored');
 }
 // Exercise the actual visual hand-off against a moving authored source, including its terminal exact-pose frame.
 stage.update({elapsed:5,phase:'charge',progress:1,pulse:0});
 for(const seconds of [0,.035,.07,.105,.14,.175]){
  mixer.setTime(seconds);stage.update({elapsed:5.1+seconds,phase:'release',progress:seconds/clip.duration,pulse:0});audit(seconds,'charge-release');
 }
 stage.dispose();mixer.stopAllAction();
}
console.log(JSON.stringify({note:'Actual CPU-skinned full actor incl hair/weapons at 21 raw authored attack samples (5% increments), plus six real stage charge-to-release hand-off samples over .175s. Not every gameplay blend/contact. No GPU, occlusion, motion or pixel quality claim.',rows},null,2));
