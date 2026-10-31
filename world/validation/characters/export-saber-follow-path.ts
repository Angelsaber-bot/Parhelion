/** Actual follow controller, identical timed route before/after. CPU evidence only. */
import * as THREE from 'three';import{mkdir,writeFile,readFile}from'node:fs/promises';import{fileURLToPath,pathToFileURL}from'node:url';import path from'node:path';import{createHash}from'node:crypto';
import{gzipSync}from'node:zlib';
import{MeshBVH}from'three-mesh-bvh';import{readCharacter}from'./inspect.ts';import{ContractServant,SERVANT_MODELS}from'../../src/servant.ts';import{FirstContract}from'../../src/contracts.ts';import{ServantAppearance}from'../../src/servantAppearance.ts';
const out=process.argv[2];if(!out)throw Error('Workspace output directory required');await mkdir(out,{recursive:true});
const option=(name:string)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
const baseline=option('baseline-module'),outfit=(option('outfit')??'armor')as'armor'|'civilian',fps=Number(option('fps')??12),hz=Number(option('hz')??60),metricsOnly=process.argv.includes('--metrics-only'),compact=process.argv.includes('--compact'),trueGround=process.argv.includes('--true-ground'),contactCloseup=process.argv.includes('--contact-closeup'),selected=option('frames')?new Set(option('frames')!.split(',').map(Number)):undefined;if(!['armor','civilian'].includes(outfit)||(!metricsOnly&&hz%fps!==0))throw Error('Invalid outfit or sampling rate');
const Runtime=baseline?(await import(pathToFileURL(path.resolve(baseline)).href)).ContractServant:ContractServant;
const asset=fileURLToPath(new URL(SERVANT_MODELS[outfit])),{gltf}=await readCharacter(asset),appearance=new ServantAppearance();appearance.select(outfit);
const actor=new Runtime({scene:new THREE.Scene(),marker:{id:'test',type:'interact',label:'test',p:[0,0,0]},contract:new FirstContract(new Set(['saber_contract'])),appearance,colliders:[{name:'floor',enabled:true,bvh:new MeshBVH(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2))}],load:async()=>gltf,target:()=>null,strike:()=>null});
await actor.ensureLoaded();const sharedFiles=new Set<string>();const player=new THREE.Vector3(),metrics:any[]=[];
const runtimePath=baseline?path.resolve(baseline):fileURLToPath(new URL('../../src/servant.ts',import.meta.url)),runtimeSha256=createHash('sha256').update(await readFile(runtimePath)).digest('hex');
const sourceHashes:Record<string,string>={servant:runtimeSha256};if(!baseline)for(const name of ['saberStride','saberStrideRuntime','saberGroundedLocomotion','saberTerrainPatch','saberFootSupport','saberSoleGeometry','actionBlend'])sourceHashes[name]=createHash('sha256').update(await readFile(fileURLToPath(new URL('../../src/characters/'+name+'.ts',import.meta.url)))).digest('hex');
for(let tick=0;tick<=8*hz;tick++){
 const time=tick/hz;let speed=0,yaw=Math.PI/2;
 if(time>=.5&&time<2.5)speed=5.5;
 else if(time>=3&&time<4){speed=9;}
 else if(time>=4&&time<5){speed=5.5;yaw=Math.PI/2*(5-time);}
 else if(time>=5&&time<6){speed=5.5;yaw=-Math.PI/2;}
 if(tick){player.x+=Math.sin(yaw)*speed/hz;player.z+=Math.cos(yaw)*speed/hz;}
 actor.update(1/hz,player,yaw,true,false);actor.root.updateMatrixWorld(true);
 const internal=actor as any,current=internal.current as THREE.AnimationAction|undefined;
 metrics.push({runWeight:internal.clips.get('run')?.getEffectiveWeight(),stride:actor.strideDiagnostics?JSON.parse(JSON.stringify(actor.strideDiagnostics)):null,time,player:player.toArray(),root:actor.root.position.toArray(),yaw:actor.root.rotation.y,state:actor.animation,clipTime:current?.time,rate:current?.getEffectiveTimeScale(),feet:['Left','Right'].map(s=>gltf.scene.getObjectByName('mixamorig'+s+'Foot')!.getWorldPosition(new THREE.Vector3()).toArray())});
 if(metricsOnly||tick%(hz/fps)||(selected&&!selected.has(tick/(hz/fps))))continue;
 const id=`follow-${outfit}-${String(tick/(hz/fps)).padStart(3,'0')}`,meshes:any[]=[],point=new THREE.Vector3();
 gltf.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;for(let node:THREE.Object3D|null=mesh;node;node=node.parent)if(!node.visible)return;
  if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
  const count=mesh.geometry.attributes.position.count,p=new Float32Array(count*3),uv=new Float32Array(count*2),color=new Float32Array(count*4);
  for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);p.set(point.toArray(),i*3);const a=mesh.geometry.attributes.uv;if(a){uv[i*2]=a.getX(i);uv[i*2+1]=a.getY(i);}const c=mesh.geometry.attributes.color;color.set(c?[c.getX(i),c.getY(i),c.getZ(i),c.itemSize===4?c.getW(i):1]:[1,1,1,1],i*4);}
  const index=mesh.geometry.index,indices=new Uint32Array(index?Array.from(index.array):Array.from({length:count},(_,i)=>i)),file=`${id}-${meshes.length}.bin`;
  const staticFile=`shared-${meshes.length}.bin`,first=!sharedFiles.has(staticFile);sharedFiles.add(staticFile);
  meshes.push({name:mesh.name,file:compact?file+'.gz':file,...(compact?{staticFile}:{}),count,indices:indices.length,groups:mesh.geometry.groups,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.name),data:compact?gzipSync(Buffer.from(p.buffer),{level:1}):Buffer.concat([Buffer.from(p.buffer),Buffer.from(uv.buffer),Buffer.from(color.buffer),Buffer.from(indices.buffer)]),...(compact&&first?{staticData:Buffer.concat([Buffer.from(uv.buffer),Buffer.from(color.buffer),Buffer.from(indices.buffer)])}:{})});
 });
 for(const m of meshes){await writeFile(path.join(out,m.file),m.data);delete m.data;if(m.staticData){await writeFile(path.join(out,m.staticFile),m.staticData);delete m.staticData;}}
 await writeFile(path.join(out,id+'.json'),JSON.stringify({id,time,fps,mode:baseline?'baseline':'current',runtimeSha256,sourceHashes,label:`Saber ${outfit} actual follow route ${time.toFixed(3)}s`,asset:asset.replace(/\.gz$/,''),framing:{center:actor.root.position.clone().add(new THREE.Vector3(0,contactCloseup?.35:.95,0)).toArray(),size:contactCloseup?1:2.25},groundY:trueGround?0:-.025,trackLights:trueGround,lightingOrigin:actor.root.position.toArray(),view:contactCloseup?'side':'front',grid:true,meshes,limitations:['CPU-skinned runtime controller route, offline Cycles; not WebGL or game camera','Identical world-time route and root-tracking QA camera, no pose normalization']}));
}
await writeFile(path.join(out,`metrics-${outfit}.json`),JSON.stringify({outfit,fps,hz,runtimeSha256,sourceHashes,samples:metrics},null,2));actor.dispose();console.log(out,outfit,metrics.length);
