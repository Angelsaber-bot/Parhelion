/** Actual production AI/HP/body/tells sampled in one uninterrupted local encounter.
 * NON-GPU offline mesh export: one field-entry teleport, no hostile state injection.
 * Fixed review camera is deliberately not represented as the player's viewport. */
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';
import {getFalseDawnEncounterSpec} from '../../src/falseDawnEncounterCatalog';
import assert from 'node:assert/strict';
const preview=process.argv.includes('--preview'),musket=process.argv.includes('--musket'),contactsOnly=process.argv.includes('--contacts');
const out=path.resolve(process.argv[2]??'../artifacts/live-warden-sequence');await mkdir(out,{recursive:true});
const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done:['armory_rack'],found:[]})}}),{world:w,window}=h,d=window.document;
const base=getFalseDawnEncounterSpec('false_dawn_warden')!,spec=musket?{...base,id:'false_dawn_musket_review',actors:[{role:'musketeer',offset:[-2.5,-.8]}]}:base,origin=new THREE.Vector3(spec.anchor.x,spec.anchor.y,spec.anchor.z);let now=0;
const frame=()=>h.frame(now+=1000/60),assets=[path.resolve(`public/assets/enemies/${musket?'musketeer':'sunward_guard'}.glb`),path.resolve('../assets/characters/player_v2/player_v2.glb'),path.resolve('../assets/weapons/glb/01_Dawn_AR.glb')];
const materialKey=(m:THREE.Material)=>m.name||`runtime_${m.uuid}`;
const material=(source:THREE.Material)=>{const m=source as THREE.MeshStandardMaterial;return{name:materialKey(m),vertexColors:m.vertexColors,color:m.color?.toArray()??[1,1,1],metalness:m.metalness??0,roughness:m.roughness??.7,opacity:m.opacity,transparent:m.transparent,emissive:m.emissive?.toArray()??((m as any).isMeshBasicMaterial?m.color.toArray():[0,0,0]),emissiveIntensity:m.emissiveIntensity??((m as any).isMeshBasicMaterial?.7:0)};};
const visible=(o:THREE.Object3D)=>{for(let p:THREE.Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;};
async function exportObjects(objects:THREE.Object3D[],prefix:string,crop=false){
 const meshes:any[]=[],extraMaterials:Record<string,unknown>={};
 for(const object of objects)object.traverse(o=>{
  if(!(o as THREE.Mesh).isMesh||!visible(o)||o.name.endsWith('__outline'))return;const mesh=o as THREE.Mesh;if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
  const g=mesh.geometry,pos=g.attributes.position,index=g.index,uv=g.attributes.uv,color=g.attributes.color,count=index?.count??pos.count,points:number[]=[],uvs:number[]=[],colors:number[]=[],groups:{start:number;count:number;materialIndex:number}[]=[];
  const v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  for(let i=g.drawRange.start;i<Math.min(count,g.drawRange.start+g.drawRange.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);for(let j=0;j<3;j++)mesh.getVertexPosition(ids[j],v[j]).applyMatrix4(o.matrixWorld).sub(origin);
   if(crop&&(Math.max(...v.map(p=>p.x))< -13||Math.min(...v.map(p=>p.x))>13||Math.max(...v.map(p=>p.z))< -13||Math.min(...v.map(p=>p.z))>13))continue;
   const start=points.length/3;for(let j=0;j<3;j++){points.push(...v[j].toArray());uvs.push(uv?uv.getX(ids[j]):0,uv?uv.getY(ids[j]):0);colors.push(color?color.getX(ids[j]):1,color?color.getY(ids[j]):1,color?color.getZ(ids[j]):1,color&&color.itemSize===4?color.getW(ids[j]):1);}
   const mi=g.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex??0,last=groups.at(-1);if(last&&last.materialIndex===mi)last.count+=3;else groups.push({start,count:3,materialIndex:mi});
  }
  if(!points.length)return;for(const m of [mesh.material].flat())extraMaterials[materialKey(m)]=material(m);
  const p=new Float32Array(points),u=new Float32Array(uvs),c=new Float32Array(colors),indices=Uint32Array.from({length:points.length/3},(_,i)=>i),file=`${prefix}-${meshes.length}.bin`;
  meshes.push({name:o.name,file,count:p.length/3,indices:indices.length,groups,materials:[mesh.material].flat().map(m=>materialKey(m)),data:Buffer.concat([Buffer.from(p.buffer),Buffer.from(u.buffer),Buffer.from(c.buffer),Buffer.from(indices.buffer)])});
 });
 for(const mesh of meshes){await writeFile(path.join(out,mesh.file),mesh.data);delete mesh.data;}return{meshes,extraMaterials};
}
try{
 (d.getElementById('start')as HTMLElement).click();await Promise.resolve();if(process.argv.includes('--reduced')){const toggle=d.getElementById('world-reduced-effects')as HTMLInputElement;toggle.checked=true;toggle.dispatchEvent(new window.Event('change',{bubbles:true}));}const x=spec.anchor.x-.2,z=spec.anchor.z-2.9,g=w.combat.geometry.ground(x,z,spec.anchor.y+4);assert.ok(g);w.player.teleport(x,g.point.y+.04,z);w.player.onGround=true;frame();await h.settleAssets();for(let i=0;i<30;i++)frame();assert.equal(w.combat.startStoryEncounter(spec,{position:w.player.pos,playable:true}).ok,true);frame();await h.settleAssets();frame();
 const enemy=w.combat.state.enemies.find((e:any)=>e.storyEncounter)!,v=w.combat.visuals.get(enemy.id);assert.ok(v);
 const heading=Math.atan2(-(enemy.p.x-w.player.pos.x),-(enemy.p.z-w.player.pos.z)),look=new window.MouseEvent('mousemove',{bubbles:true});Object.defineProperties(look,{movementX:{value:(w.player.yaw-heading)/(.0022*w.settings.value.sensitivity)},movementY:{value:0}});d.dispatchEvent(look);frame();
 const start=now,terrain:THREE.Object3D[]=[];w.scene.traverse((o:THREE.Object3D)=>{if((o as THREE.Mesh).isMesh&&o.name==='Terrain')terrain.push(o);});
 w.scene.updateMatrixWorld(true);const staticData=await exportObjects([...terrain,w.falseDawnSites.sites.find((s:any)=>s.region==='alpha').root],'static',true);
 const contactCpuMs:number[]=[];const effect=w.combat.contactEffects,emit=effect.emit.bind(effect);effect.emit=(...args:any[])=>{const start=process.hrtime.bigint();const result=emit(...args);contactCpuMs.push(Number(process.hrtime.bigint()-start)/1e6);return result;};
 const timeline:any[]=[];let sequence=0,lastContact=0,afterThird=0;
 for(let step=0;step<900&&!w.combat.defeated;step++){
  frame();const time=(now-start)/1000;if(enemy.contactSequence!==lastContact){lastContact=enemy.contactSequence;timeline.push({type:'contact',time,sequence:lastContact,attack:enemy.attack,hp:w.combat.state.hp,origin:{...enemy.p},target:{...enemy.target}});}
  if(enemy.contactSequence>=(musket?1:3))afterThird++;
  if((!contactsOnly&&step%8===0)||enemy.contactSequence!==sequence||(!contactsOnly&&musket&&afterThird>0&&afterThird<8)){sequence=enemy.contactSequence;w.scene.updateMatrixWorld(true);const id=`live-${musket?'musket':'warden'}-${String(step).padStart(4,'0')}`,dynamic=await exportObjects([v.body,v.tell,w.rig.root,w.combat.effectGroup],id),metadata={time,mode:enemy.mode,timer:enemy.timer,attack:enemy.attack,contactSequence:enemy.contactSequence,playerHp:w.combat.state.hp,player:w.player.pos.toArray(),enemy:{...enemy.p}};
   await writeFile(path.join(out,`${id}.json`),JSON.stringify({id,assets,meshes:[...staticData.meshes,...dynamic.meshes],extraMaterials:{...staticData.extraMaterials,...dynamic.extraMaterials},metadata,framing:{center:[-.8,1.0,-1],size:7.6}}));timeline.push({type:'frame',id,...metadata});
  }
  if(afterThird>=(musket?10:20)||preview)break;
 }
 if(!preview){assert.equal(enemy.contactSequence,musket?1:3);assert.deepEqual(timeline.filter(row=>row.type==='contact').map(row=>row.attack),musket?['shot']:['thrust','sweep','burst']);assert.equal(w.combat.state.hp,musket?86:48);}
 await writeFile(path.join(out,'timeline.data.json'),JSON.stringify({evidence:'Actual main AI/HP/GLB/BVH; fixed offline review camera, shader-only player outlines and line primitives omitted (mesh bolts/flashes retained), no GPU claim; only field entry is teleported; facing uses actual mouse input',timeline,contactCpuMs},null,2));console.log(JSON.stringify({frames:timeline.filter(row=>row.type==='frame').length,contacts:timeline.filter(row=>row.type==='contact'),hp:w.combat.state.hp}));
}finally{await h.close();}
