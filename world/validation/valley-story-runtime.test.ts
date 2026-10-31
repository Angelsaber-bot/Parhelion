import { campaignSourceContext } from './campaign-source-context';
import { SettingsStore } from '../../shared-client/settings.ts';
import { WorldAudio } from '../src/worldAudio';
import * as campaignClosure from '../src/campaignClosure';
import {FortCannon, FORT_CANNON} from '../src/fortCannon.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import * as THREE from 'three';
import {VALLEY_STORY,getValleyStoryState,getValleyStoryGuide,interactValleyStory} from '../src/valleyStory.ts';
import {createValleyStoryScene} from '../src/valleyStoryScene.ts';
import {WorldProgress,ARMORY_MARKER} from '../src/progress.ts';
import * as eraStory from '../src/eraStories.ts';
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const slice=(a:string,b:string)=>{const start=source.indexOf(a);assert.ok(start>=0,`Missing source anchor ${a}`);const end=source.indexOf(b,start);assert.ok(end>start,`Missing source terminator ${b}`);return source.slice(start,end);};
function fixture(){
 const data=new Map<string,string>(), storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}},progress=new WorldProgress(storage);
 const scene=createValleyStoryScene({id:'alpha',name:['测试','Test'],position:[0,0,0],entry:[0,0,15],footprint:[34,30],groundRange:0});
 const hq={id:'hq_terminal',type:'interact',p:[30,0,0],label:'HQ'},layout={markers:[hq,...scene.markers]},player={pos:new THREE.Vector3(0,0,0)};
 let region='alpha';let npc:any={id:VALLEY_STORY.npc,position:[0,0,1],role:['记录员','Archivist']},blocked=false,saves=0;
 const context=vm.createContext({...campaignSourceContext,settings:new SettingsStore('world',{getItem:()=>null,setItem(){}}),speakDialogue(){},narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false,campaignJournalOpen:false,campaignTrackedRegion:null,falseDawnTracked:false,falseDawnRuntime:undefined, FORT_CANNON, fortCannon: new FortCannon(),...eraStory,eraOptionalIds:new Set(Object.values(eraStory.ERA_OPTIONALS).map(x=>x.id)),found:progress.found,THREE,VALLEY_STORY,ARMORY_MARKER,getValleyStoryState,getValleyStoryGuide,interactValleyStory,done:progress.done,player,layout,markers:new Map(layout.markers.map(m=>[m.id,m])),valleyStoryScene:scene,
 settlementNpcs:{nearest:()=>npc,getPosition:()=>npc.position,gesture(){},requestRelocation(){},interact:()=>['普通','Generic']},combat:{geometry:{cast:()=>blocked?{distance:.2}:null}},BOSSES:[],servantByContract:()=>false,regionAt:()=>({id:region}),toast(){},bilingual:(a:string,b:string)=>b,localizeText:(s:string)=>s,save:()=>{saves++;return progress.save();}});
 const code='let appliedValleyStory="";'+slice('function applyValleyStory()','addEventListener(\'pagehide\'')+slice('function valleyGuide()','function interactionLabel(')+slice('function nearestInteract()','function checkDiscoveries()')+'\nfunction applyWorldState(){applyValleyStory();}\nglobalThis.api={applyValleyStory,interactSettlementNpc,interact,nearestInteract,valleyGuide};';
 vm.runInContext(transformSync(code,{loader:'ts'}).code,context);
 return {api:context.api,progress,scene,player,hq,storage,setRegion(v:string){region=v;},setBlocked(v:boolean){blocked=v;},setNpc(v:any){npc=v;},saves:()=>saves};
}
test('real runtime NPC→terminal→report updates actual gate/light and yields original guidance',()=>{
 const f=fixture();f.api.applyValleyStory();assert.equal(f.scene.colliders[1].enabled,true);
 assert.equal(f.api.interactSettlementNpc(),true);assert.equal(f.scene.colliders[1].enabled,false);assert.equal(getValleyStoryState(f.progress.done).stage,'restore');assert.equal(f.saves(),1);
 f.player.pos.set(...f.hq.p as [number,number,number]);f.api.interact();assert.equal(getValleyStoryState(f.progress.done).stage,'report');
 const light=f.scene.group.getObjectByName('RestoredPathInlays') as THREE.Mesh;assert.ok((light.material as THREE.MeshStandardMaterial).emissiveIntensity>0);
 f.player.pos.set(0,0,0);f.api.interactSettlementNpc();assert.equal(getValleyStoryState(f.progress.done).stage,'complete');assert.equal(f.api.valleyGuide(),null);assert.equal(f.progress.armed,false);
 assert.equal(getValleyStoryState(new WorldProgress(f.storage).done).stage,'complete');
 f.progress.reset();f.api.applyValleyStory();assert.equal(f.scene.colliders[1].enabled,true);assert.equal((light.material as THREE.MeshStandardMaterial).emissiveIntensity,0);f.scene.dispose();
});
test('real runtime panel rejects distance and wall; accepted manual use is persisted and idempotent',()=>{
 const f=fixture(),p=f.scene.markers[0].p;f.setNpc(null);f.api.applyValleyStory();f.player.pos.set(p[0],p[1]-1.2,p[2]+10);f.api.interact();assert.equal(f.progress.done.size,0);
 f.player.pos.set(p[0],p[1]-1.2,p[2]+1);f.setBlocked(true);f.api.interact();assert.equal(f.progress.done.size,0);
 f.setBlocked(false);f.api.interact();assert.equal(f.scene.colliders[1].enabled,false);assert.equal(f.progress.done.has(VALLEY_STORY.discovery),true);assert.equal(f.saves(),1);f.api.interact();assert.equal(f.saves(),1);assert.equal(new WorldProgress(f.storage).done.has(VALLEY_STORY.discovery),true);f.scene.dispose();
});

test('runtime guide follows live NPC location and never overrides another chapter',()=>{
 const f=fixture();assert.deepEqual([...f.api.valleyGuide().p],[0,0,1]);
 f.setNpc({id:VALLEY_STORY.npc,position:[20,0,20],role:['记录员','Archivist']});assert.deepEqual([...f.api.valleyGuide().p],[20,0,20]);
 f.setRegion('kyoto');assert.equal(f.api.valleyGuide(),null);assert.equal(f.progress.done.size,0);f.scene.dispose();
});
