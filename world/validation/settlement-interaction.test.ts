import { campaignSourceContext } from './campaign-source-context';
import { WorldAudio } from '../src/worldAudio';
import * as campaignClosure from '../src/campaignClosure';
import {FortCannon, FORT_CANNON} from '../src/fortCannon.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {interactValleyStory, VALLEY_STORY} from '../src/valleyStory.ts';
import * as THREE from 'three';
import {interactEraStory} from '../src/eraStories.ts';
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function nearbySettlementNpc()'),source.indexOf('function interact()'));
function fixture(blocked=false,questDistance:number|null=null){
 const npc={id:'test_clerk',position:[0,0,2],role:['书记官','Clerk']},spoken:string[]=[],done=new Set(['tutorial']);
 const context=vm.createContext({...campaignSourceContext,narrative:undefined,...campaignClosure,audio:new WorldAudio({listen:false}),travelOpenState:false,campaignJournalOpen:false,campaignTrackedRegion:null,falseDawnTracked:false,falseDawnRuntime:undefined, FORT_CANNON, fortCannon: new FortCannon(),THREE,interactEraStory,found:new Set<string>(),interactValleyStory,VALLEY_STORY,player:{pos:new THREE.Vector3()},settlementNpcs:{nearest:()=>npc,interact:()=>['货物已经登记。','The cargo is registered.']},
  combat:{geometry:{cast:()=>blocked?{distance:.5}:null}},nearestInteract:()=>questDistance===null?null:{p:[0,0,questDistance]},speakDialogue:(line:[string,string],name:[string,string])=>spoken.push(`${name[1]}: ${line[1]}`),toast:(s:string)=>spoken.push(s),bilingual:(zh:string,en:string)=>en,done});
 vm.runInContext(transformSync(code+'\nglobalThis.tryInteraction=interactSettlementNpc;', {loader:'ts'}).code,context);
 return {context,spoken,done};
}
test('resident dialog follows actual runtime route and does not change progress',()=>{const f=fixture();assert.equal(f.context.tryInteraction(),true);assert.equal(f.spoken[0],'Clerk: The cargo is registered.');assert.deepEqual([...f.done],['tutorial']);});
test('nearer quest retains interaction priority over resident',()=>{const f=fixture(false,1);assert.equal(f.context.tryInteraction(),false);assert.equal(f.spoken.length,0);});
test('resident wins only when nearer than quest',()=>{const f=fixture(false,3);assert.equal(f.context.tryInteraction(),true);assert.equal(f.spoken.length,1);});
test('resident cannot talk through an intervening wall',()=>{const f=fixture(true);assert.equal(f.context.tryInteraction(),false);assert.equal(f.spoken.length,0);});
test('resident action is dispatched only behind existing gameplay and remapped input guards',()=>{
 const press=source.slice(source.indexOf('function press('),source.indexOf("addEventListener('keydown'"));
 assert.ok(press.indexOf('if (!gameplayActive() || combat.defeated) return;')<press.indexOf('!interactSettlementNpc()'));
 assert.match(press,/settings\.action\(binding\)/);assert.match(press,/action === 'interact' && !player\.flying && !player\.gliding && !player\.swimming && player\.onGround && !interactSettlementNpc\(\)/);
});
import {MeshBVH} from 'three-mesh-bvh';
import {makeCombatTerrain} from '../src/combatTerrain.ts';
import type {Layout} from '../src/types.ts';
test('new living hubs exclude random wilderness spawns without removing surrounding wilderness',()=>{
 const floor=new THREE.BoxGeometry(400,1,400).translate(0,-.5,0);
 const terrain=makeCombatTerrain([{name:'floor',enabled:true,bvh:new MeshBVH(floor)}],{
  world:{waterLevel:-2},areas:[{id:'britain_living_hub',c:[0,0],r:25}],markers:[],
 } as unknown as Layout);
 assert.equal(terrain.safeSpawn(0,0),null);assert.equal(terrain.safeSpawn(30,0),null);
 assert.ok(terrain.safeSpawn(80,0));
 floor.dispose();
});
