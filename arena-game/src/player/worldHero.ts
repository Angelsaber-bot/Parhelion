import {abilityAllowsGunplay} from '../../shared/content.ts';
import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {buildFighter,FighterAnimator} from './fighter.ts';

/** World heroes, as their Arena match copies (assets/characters/ARENA_HEROES_MANIFEST.json, built by
 * world/tools/build-arena-heroes.ts): same skeleton, clips, morphs and materials as the World masters,
 * simplified to about 120k triangles with textures capped at 1024 px. Arena owns only the adapter,
 * aim pose and collision scale. */
export const WORLD_HERO_ASSETS:Record<number,{urls:string[];idle:string;walk:string;run:string;action:string}>={
  2:{urls:[new URL('../../../assets/characters/artoria_refined/runtime_revision2/armor/artoria_armor.arena.glb',import.meta.url).href],idle:'Idle',walk:'Walk',run:'Run',action:'Attack'},
  3:{urls:[new URL('../../../assets/characters/blackbeard/remaster_v2/Blackbeard_Captain_Remaster.arena.glb',import.meta.url).href],idle:'Idle',walk:'Walk',run:'Run',action:'Attack'},
  4:{urls:[new URL('../../../assets/characters/musashi/remaster_v2/Musashi_Runtime.arena.glb',import.meta.url).href],idle:'Idle',walk:'Walk',run:'Run',action:'Attack'},
  5:{urls:[new URL('../../../assets/characters/napoleon/remaster_v2/Napoleon_WhiteHorse_Remaster.arena.glb',import.meta.url).href],idle:'Idle',walk:'Walk',run:'Run',action:'Attack'},
  6:{urls:[new URL('../../../assets/characters/jeanne/final_20261110/runtime.arena.glb',import.meta.url).href],idle:'Idle',walk:'Walk_Draped',run:'Run_Draped',action:'Jeanne_Resolve'},
  7:{urls:[new URL('../../../assets/characters/ozymandias/final_20261110/runtime.arena.glb',import.meta.url).href],idle:'Idle',walk:'Walk',run:'Run',action:'Ozy_Regal'},
  8:{urls:[new URL('../../../assets/characters/qin-shi-huang/final_20261110/runtime.arena.glb',import.meta.url).href],idle:'Idle',walk:'Walk',run:'Run',action:'RegalHover'},
};
/** World exports may use UV sets above Three's built-in uv0..uv3 declarations. */
export function prepareWorldUVs(root:THREE.Object3D){
  const patched=new Set<THREE.Material>();
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      const channels=[...new Set(Object.values(material).filter((value):value is THREE.Texture=>value instanceof THREE.Texture&&value.channel>=4).map(texture=>texture.channel))].sort((a,b)=>a-b);
      if(!channels.length)continue;
      for(const channel of channels){const attribute=mesh.geometry.getAttribute(`texcoord_${channel}`)??mesh.geometry.getAttribute(`uv${channel}`);if(!attribute)throw Error(`World model is missing UV set ${channel}`);mesh.geometry.setAttribute(`uv${channel}`,attribute);}
      if(patched.has(material))continue;patched.add(material);
      const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
      material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.vertexShader=channels.map(channel=>`attribute vec2 uv${channel};`).join('\n')+'\n'+shader.vertexShader;};
      material.customProgramCacheKey=()=>`${key}|world-uv-${channels.join('-')}`;
    }
  });
}
const cache=new Map<number,Promise<GLTF>>();
export async function decodeWorldHero(parts:Uint8Array[]):Promise<ArrayBuffer>{
  const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.byteLength,0));let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  let buffer:ArrayBuffer=bytes.buffer;
  if(bytes[0]===0x1f&&bytes[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(buffer.byteLength<12||new DataView(buffer).getUint32(0,true)!==0x46546c67||new DataView(buffer).getUint32(8,true)!==buffer.byteLength)throw Error('Invalid World hero asset');
  return buffer;
}
export function loadWorldHero(char:number):Promise<GLTF>{
  let entry=cache.get(char);if(entry)return entry;
  entry=(async()=>{const definition=WORLD_HERO_ASSETS[char];if(!definition)throw Error('No World model for this hero');
    const parts=await Promise.all(definition.urls.map(async url=>{const response=await fetch(url);if(!response.ok)throw Error(`Character asset HTTP ${response.status}`);return new Uint8Array(await response.arrayBuffer());}));
    const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(await decodeWorldHero(parts),'');prepareWorldUVs(gltf.scene);
    if(char===5){const captain=await loadWorldHero(3);gltf.animations=captain.animations.map(c=>c.clone());}
    return gltf;
  })().catch(error=>{cache.delete(char);throw error;});cache.set(char,entry);return entry;
}
export async function prepareWorldHeroes(){
  const pending=Object.keys(WORLD_HERO_ASSETS).map(Number);await Promise.all([0,1].map(async()=>{while(pending.length)await loadWorldHero(pending.shift()!);}));
}
const normalized=(name:string)=>name.toLowerCase().replace(/mixamorig|[\s:_.-]/g,'');
function find(root:THREE.Object3D,...names:string[]){const wanted=new Set(names.map(normalized));let result:THREE.Object3D|undefined;root.traverse(o=>{if(!result&&wanted.has(normalized(o.name)))result=o;});return result;}
function point(o:THREE.Object3D){return o.getWorldPosition(new THREE.Vector3());}
function aimBone(bone:THREE.Object3D,end:THREE.Object3D,target:THREE.Vector3){
  const origin=point(bone),current=point(end).sub(origin).normalize(),desired=target.clone().sub(origin).normalize();
  if(!current.lengthSq()||!desired.lengthSq())return;
  const rotation=new THREE.Quaternion().setFromUnitVectors(current,desired).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));bone.updateWorldMatrix(false,true);
}
function armIK(upper:THREE.Object3D,lower:THREE.Object3D,hand:THREE.Object3D,target:THREE.Vector3,pole:THREE.Vector3){
  const start=point(upper),elbow=point(lower),wrist=point(hand),a=start.distanceTo(elbow),b=elbow.distanceTo(wrist);
  if(a<.001||b<.001)return;
  const axis=target.clone().sub(start),distance=THREE.MathUtils.clamp(axis.length(),Math.abs(a-b)+.001,a+b-.001);axis.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  const bend=pole.clone().sub(start);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const joint=start.clone().addScaledVector(axis,along).addScaledVector(bend,height);
  aimBone(upper,lower,joint);aimBone(lower,hand,start.addScaledVector(axis,distance));
}
/** Independent skeleton/mixer per fighter, shared original textures and geometry. */
export class ArenaCharacter {
  readonly root=new THREE.Group();readonly aim=new THREE.Group();
  readonly ready:Promise<void>;state:'loading'|'ready'|'failed'='loading';
  private legacy?:FighterAnimator;private legacyRoot?:THREE.Group;
  private model?:THREE.Group;private normalizedRoot=new THREE.Group();private mixer?:THREE.AnimationMixer;
  private actions=new Map<string,THREE.AnimationAction>();private current='';private dead=false;
  private arms:({upper:THREE.Object3D;lower:THREE.Object3D;hand:THREE.Object3D}|null)[]=[];
  private head?:THREE.Object3D;private weaponBones:THREE.Object3D[]=[];private abilityPhase='idle';
  private restPose=new Map<THREE.Object3D,THREE.Quaternion>();
  private pitch=0;private attack=false;private crouch=0;
  constructor(readonly char:number,team:number,load:()=>Promise<GLTF>=()=>loadWorldHero(char)){
    this.root.name=`Arena World hero ${char}`;this.aim.position.y=1.35;this.root.add(this.aim,this.normalizedRoot);
    if(char<2){const rig=buildFighter(char,team);this.root.remove(this.aim);this.aim=rig.aim;this.legacyRoot=rig.root;this.root.add(rig.root);this.legacy=new FighterAnimator(rig);this.state='ready';this.ready=Promise.resolve();return;}
    this.ready=load().then(gltf=>{if(this.dead)return;this.install(gltf);this.state='ready';}).catch(error=>{this.state='failed';throw error;});
    // Consumers surface readiness before entering a match; this prevents an unhandled stale preview load.
    void this.ready.catch(()=>{});
  }
  private install(gltf:GLTF){
    const model=cloneSkeleton(gltf.scene)as THREE.Group;this.model=model;
    if(this.char===5){const rider=model.getObjectByName('Root');if(rider)model.attach(rider);model.traverse(o=>{if(/^(Horse_|Rein_)|White_horse|White horse/i.test(o.name))o.visible=false;});}
    this.normalizedRoot.add(model);model.rotation.y=Math.PI;
    this.mixer=new THREE.AnimationMixer(model);
    for(const clip of gltf.animations){const tracks=clip.tracks.filter(t=>model.getObjectByName(t.name.split('.')[0]));const action=this.mixer.clipAction(new THREE.AnimationClip(clip.name,clip.duration,tracks));this.actions.set(clip.name,action);}
    const def=WORLD_HERO_ASSETS[this.char];this.play(def.idle,0);this.mixer.update(0);this.root.updateMatrixWorld(true);
    this.head=find(model,'Head','head');const feet=[find(model,'LeftFoot','FootL','Foot.L'),find(model,'RightFoot','FootR','Foot.R')].filter(Boolean)as THREE.Object3D[];
    const ground=feet.length?Math.min(...feet.map(f=>this.root.worldToLocal(point(f)).y))-.075:0;
    const height=this.head?this.root.worldToLocal(point(this.head)).y-ground:1.6;
    const scale=1.6/Math.max(.5,height);this.normalizedRoot.scale.setScalar(scale);this.normalizedRoot.position.y=-ground*scale;
    for(const side of ['L','R']){const long=side==='L'?'Left':'Right';const upper=find(model,`${long}Arm`,`UpperArm${side}`,`upper_arm.${side}`),lower=find(model,`${long}ForeArm`,`Forearm${side}`),hand=find(model,`${long}Hand`,`Hand${side}`);this.arms.push(upper&&lower&&hand?{upper,lower,hand}:null);}
    for(const name of ['WeaponSocket_R','Attachment_LeftHand_Katana','Attachment_RightHand_Katana']){const bone=model.getObjectByName(name);if(bone)this.weaponBones.push(bone);}
    // Captain's World firearm is a separate mesh; the public Arena loadout supplies the held gun.
    model.traverse(o=>{if(o.name.startsWith('Blackbeard_firearm'))o.visible=false;const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;}});
    for(const bone of [this.head,...this.arms.flatMap(arm=>arm?[arm.upper,arm.lower]:[])])if(bone)this.restPose.set(bone,bone.quaternion.clone());
    this.root.userData.source='World';this.root.userData.nativeMeshes=true;
  }
  private play(name:string,fade=.16){if(name===this.current)return;const next=this.actions.get(name);if(!next)return;const old=this.actions.get(this.current);next.reset().setLoop(THREE.LoopRepeat,Infinity).play();if(old)old.crossFadeTo(next,fade,false);this.current=name;}
  update(dt:number,speed:number,vy:number,crouched=false,grounded=true,forward=speed,strafe=0){
    if(this.legacy){this.legacy.update(dt,speed,vy,crouched,grounded,forward,strafe);return;}
    if(!this.model||!this.mixer)return;dt=Math.min(.05,Math.max(0,dt));const def=WORLD_HERO_ASSETS[this.char];
    const performing=!abilityAllowsGunplay(this.char)&&this.abilityPhase!=='idle'&&this.abilityPhase!=='recovery';
    this.play(performing&&this.actions.has(def.action)?def.action:speed>.3&&grounded?def.run:def.idle);
    if(performing&&this.char===2){const action=this.actions.get(def.action);if(action){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}if(action){action.time=.25;action.paused=true;}}else {const action=this.actions.get(def.action);if(action)action.paused=false;}
    this.actions.get(this.current)?.setEffectiveTimeScale(speed>.3&&!performing?THREE.MathUtils.clamp(speed/4.4,.65,1.45):1);
    for(const [bone,rotation] of this.restPose)bone.quaternion.copy(rotation);
    this.mixer.update(dt);this.crouch+=(Number(crouched)-this.crouch)*(1-Math.exp(-dt*18));
    this.normalizedRoot.scale.y=this.normalizedRoot.scale.x*(1-this.crouch*.28);
    this.pitch=this.aim.rotation.x;this.root.updateWorldMatrix(true,true);
    if(this.head){this.head.rotateX(-this.pitch*.5);this.head.updateWorldMatrix(false,true);}
    for(const bone of this.weaponBones)bone.scale.setScalar(performing?1:.001);
    if(!performing&&!this.attack){for(let i=0;i<2;i++){const arm=this.arms[i];if(!arm)continue;const target=this.aim.localToWorld(new THREE.Vector3(i===0?.10:.16,-.08,i===0?-.58:-.28));const pole=this.root.localToWorld(new THREE.Vector3(i===0?-.6:.6,1.05,.15));armIK(arm.upper,arm.lower,arm.hand,target,pole);}}
  }
  ability(kind:string,phase:string){this.abilityPhase=phase;this.legacy?.ability(kind,phase);}
  melee(windup:number,hit:number,weapon=0){this.attack=windup>0||hit>0;this.legacy?.melee(windup,hit,weapon);}
  reset(crouched=false,grounded=true){this.abilityPhase='idle';this.attack=false;this.legacy?.reset(crouched,grounded);}
  private xray?:{material:THREE.MeshBasicMaterial;meshes:THREE.Mesh[]};
  /** Qin's edict reveal: above 0 the body is drawn as a flat silhouette over everything (callers show it only while
   *  walls hide the player, see rendering/edictReveal.ts). Overlays share each mesh's geometry, skeleton and morph weights. */
  reveal(amount:number,color=0xff6a4d){
    const source=this.model??this.legacyRoot;
    if(!(amount>0)||!source){if(this.xray)for(const mesh of this.xray.meshes)mesh.visible=false;return;}
    if(!this.xray){
      const material=new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,fog:false,toneMapped:false});
      material.name='Edict reveal';
      const sources:THREE.Mesh[]=[];source.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh&&!mesh.userData.xraySource)sources.push(mesh);});
      const meshes=sources.map(mesh=>{
        const skinned=mesh as THREE.SkinnedMesh;let overlay:THREE.Mesh;
        if(skinned.isSkinnedMesh){const o=new THREE.SkinnedMesh(mesh.geometry,material);o.bindMode=skinned.bindMode;o.bind(skinned.skeleton,skinned.bindMatrix);overlay=o;}
        else overlay=new THREE.Mesh(mesh.geometry,material);
        if(mesh.morphTargetInfluences)overlay.morphTargetInfluences=mesh.morphTargetInfluences;
        overlay.name=`${mesh.name}__reveal`;overlay.userData.xraySource=mesh;overlay.position.copy(mesh.position);overlay.quaternion.copy(mesh.quaternion);overlay.scale.copy(mesh.scale);
        overlay.frustumCulled=false;overlay.renderOrder=20;overlay.castShadow=overlay.receiveShadow=false;overlay.raycast=()=>{};mesh.parent!.add(overlay);return overlay;
      });
      this.xray={material,meshes};
    }
    for(const mesh of this.xray.meshes)mesh.visible=(mesh.userData.xraySource as THREE.Mesh).visible;
  }
  get revealMeshes():readonly THREE.Mesh[]{return this.xray?.meshes??[];}
  dispose(){if(this.xray){for(const mesh of this.xray.meshes)mesh.removeFromParent();this.xray.material.dispose();this.xray=undefined;}this.dead=true;this.mixer?.stopAllAction();if(this.model){this.mixer?.uncacheRoot(this.model);const skeletons=new Set<THREE.Skeleton>();this.model.traverse(o=>{const skin=o as THREE.SkinnedMesh;if(skin.isSkinnedMesh)skeletons.add(skin.skeleton);});for(const skeleton of skeletons)skeleton.dispose();}if(this.legacyRoot){const materials=new Set<THREE.Material>();this.legacyRoot.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);}});materials.forEach(m=>m.dispose());}this.root.removeFromParent();}
}
