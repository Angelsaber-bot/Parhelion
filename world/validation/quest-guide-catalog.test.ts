import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuestGuideCatalog} from '../src/questGuideCatalog';
import {REGIONS,mergeLayouts} from '../src/regions';
import {ERA_OPTIONALS,ERA_IDS,ERA_BOSS_REQUIREMENTS} from '../src/eraStories';
import type {Marker} from '../src/types';
const parts=REGIONS.map(def=>({def,layout:JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`,import.meta.url),'utf8'))}));
const layout=mergeLayouts(parts);
const extra:Marker[]=[{id:'valley_route_note',type:'interact',label:'检修侧门手动锁扣',p:[-160,4,220]},...ERA_IDS.map(region=>({id:ERA_OPTIONALS[region].id,type:'interact' as const,label:ERA_OPTIONALS[region].label[0],p:[...REGIONS.find(r=>r.id===region)!.offset.slice(0,1),4,REGIONS.find(r=>r.id===region)!.offset[1]] as [number,number,number]}))];
const catalog=createQuestGuideCatalog({markers:[...layout.markers,...extra],objectives:layout.objectives,npcs:[{id:'alpha_archivist',region:'alpha',position:[-166,4,212]}],enemies:[{id:'elite_oath_knight',region:'britain',position:[-800,5,40],label:['失誓骑士','Oathless Knight']}]});

test('catalog covers five real main chapters, authored optional chains and every discovery without mutating facts',()=>{
 const done=new Set<string>(),found=new Set<string>(),entries=catalog.list(done,found);
 assert.equal(entries.filter(e=>e.category==='main').length,5);
 assert.equal(entries.filter(e=>e.category==='discovery').length,layout.markers.filter(m=>m.type==='discovery').length);
 assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
 for(const entry of entries){assert.ok(entry.guide,entry.id);const guide=entry.guide!;assert.ok(guide.position.every(Number.isFinite));assert.ok(guide.text[0]);assert.ok(guide.text[1]);assert.doesNotMatch(guide.targetLabel[1],/[\u3400-\u9fff]/,entry.id);}
 assert.deepEqual([...done],[]);assert.deepEqual([...found],[]);
});
test('Alpha main follows actual archivist then original steps, and reacts to same-size changed saves',()=>{
 const done=new Set<string>();assert.equal(catalog.resolve('main:alpha',done,new Set())?.targetId,'alpha_archivist');
 done.add('valley_story_met');assert.equal(catalog.resolve('main:alpha',done,new Set())?.targetId,'hq_terminal');
 done.add('hq_terminal');assert.equal(catalog.resolve('main:alpha',done,new Set())?.targetId,'alpha_archivist');
 done.add('valley_story_resolved');assert.equal(catalog.resolve('main:alpha',done,new Set())?.targetId,'armory_rack');
 done.add('armory_rack');assert.equal(catalog.resolve('main:alpha',done,new Set())?.targetId,'range_target_1');
 done.add('range_target_1');assert.equal(catalog.resolve('main:alpha',done,new Set())?.targetId,'range_target_2');
 done.delete('range_target_1');done.add('range_target_2');assert.equal(catalog.resolve('main:alpha',done,new Set())?.targetId,'range_target_1');
});
test('era main uses current real boss requirements, not obsolete optional shard gates; legacy contracts remain authoritative',()=>{
 for(const region of ERA_IDS){const core={britain:'sun_core',blacksail:'sea_core',winter:'winter_core',kyoto:'fire_core'}[region];const done=new Set(['armory_rack',...ERA_BOSS_REQUIREMENTS[core]]);const guide=catalog.resolve(`main:${region}`,done,new Set());assert.equal(guide?.targetId,core);assert.ok(!guide?.prerequisite);}
 assert.equal(catalog.resolve('main:blacksail',new Set(['blackbeard_contract']),new Set()),null);
 assert.notEqual(catalog.resolve('main:britain',new Set(['saber_contract']),new Set()),null);
});
test('cannon boats route to actual cannon unless mounted and optional prerequisite chains advance without granting flags',()=>{
 const done=new Set(['armory_rack','blackbeard_meet','fort_cannon']);
 const first=catalog.resolve('main:blacksail',done,new Set());assert.equal(first?.targetId,'fort_cannon');assert.match(first!.text[1],/cannon/);
 assert.equal(catalog.resolve('main:blacksail',done,new Set(),{mounted:true})?.targetId,'ghost_boat_1');
 done.add('ghost_boat_1');assert.equal(catalog.resolve('main:blacksail',done,new Set(),{mounted:true})?.targetId,'ghost_boat_2');
 assert.equal(catalog.resolve('side:winter-frost',new Set(),new Set())?.targetId,'armory_rack');
 const frost=new Set(['armory_rack','frost_seal_1','frost_seal_2']);assert.equal(catalog.resolve('side:winter-frost',frost,new Set())?.targetId,'frost_seal_3');frost.add('frost_seal_3');assert.equal(catalog.resolve('side:winter-frost',frost,new Set())?.targetId,'shard_frost');
 assert.equal(catalog.resolve('side:sea-treasure',new Set(['shard_treasure']),new Set()),null,'legacy reward is not revoked by missing setup flags');
});
test('discovery uses found, trial uses true victory, epilogue follows unresolved eras rather than pretending ready',()=>{
 const id=layout.markers.find(m=>m.type==='discovery')!.id;
 assert.ok(catalog.resolve(`discovery:${id}`,new Set([id]),new Set()));assert.equal(catalog.resolve(`discovery:${id}`,new Set(),new Set([id])),null);
 assert.equal(catalog.resolve('side:oath-knight',new Set(),new Set())?.targetId,'britain_memorial');
 assert.equal(catalog.resolve('side:oath-knight',new Set(['britain_memorial']),new Set())?.targetId,'elite_oath_knight');
 assert.equal(catalog.resolve('side:oath-knight',new Set(['era_britain_knight_defeated']),new Set()),null);
 assert.notEqual(catalog.resolve('side:closure',new Set(),new Set())?.targetId,'hq_terminal');
 const done=new Set(['sun_core','sea_core','winter_core','fire_core']);assert.equal(catalog.resolve('side:closure',done,new Set())?.targetId,'hq_terminal');done.add('world_epilogue_recorded');assert.equal(catalog.resolve('side:closure',done,new Set()),null);
});
test('missing/cyclic prerequisites fail closed and unknown IDs never become destinations',()=>{
 const broken=createQuestGuideCatalog({markers:[{id:'hq_terminal',type:'interact',label:'终端',p:[0,0,0],requires:['hq_terminal']}],objectives:[{region:'alpha',objective:{id:'x',name:'x',steps:[{id:'x',text:'x',done:['hq_terminal']}]}}],npcs:[]});
 assert.equal(broken.resolve('main:alpha',new Set(['valley_story_met']),new Set()),null);assert.equal(broken.resolve('__proto__',new Set(),new Set()),null);
});

test('missing main layout and nonfinite target data are unavailable, never falsely completed',()=>{
 const missing=createQuestGuideCatalog({markers:[],objectives:[],npcs:[]});
 const state=missing.list(new Set(['armory_rack']),new Set()).find(e=>e.id==='main:alpha')!;
 assert.equal(state.complete,false);assert.equal(state.guide,null);assert.ok(state.unavailable);
 const invalid=createQuestGuideCatalog({markers:[{id:'secret',type:'discovery',label:'发现',p:[NaN,0,0]}],objectives:[],npcs:[]});
 assert.equal(invalid.resolve('discovery:secret',new Set(),new Set()),null);
});
