import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localizeText,setLanguage} from '../../shared-client/i18n';

test('Relay B objective and marker describe activation, not a nonexistent kill prerequisite, in both languages',()=>{
 const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
 const marker=layout.markers.find((m:any)=>m.id==='relay_b'),step=layout.objective.steps.find((s:any)=>s.id==='relay_b');
 assert.deepEqual(step.done,['relay_b']);assert.equal(marker.type,'interact');
 assert.equal(step.text,'进入废弃前哨站并启动中继器 B');assert.equal(marker.note,'进入据点后启动');
 try{setLanguage('zh');assert.equal(localizeText(step.text),step.text);assert.equal(localizeText(marker.note),marker.note);
 setLanguage('en');assert.equal(localizeText(step.text),'Enter the abandoned outpost and activate Relay B');assert.equal(localizeText(marker.note),'Activate inside the outpost');
 }finally{setLanguage('zh')}
 for(const[path,text]of [['../tools/build-world.ts',step.text],['../tools/gen/structures.ts',marker.note]]){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');assert.ok(source.includes(text));assert.doesNotMatch(source,/清除废弃前哨站并启动中继器 B|清除据点后启动/);
 }
});

// This is the observed original west-side climb, not a new walking ramp or double jump.
test('tower objective describes the verified staged west approach in both languages',()=>{
 const layout=JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json',import.meta.url),'utf8'));
 const step=layout.objective.steps.find((s:any)=>s.id==='tower');
 assert.deepEqual(step.done,['tower_console']);
 assert.equal(step.text,'从西侧山道接近幻日塔：跑跳后展开滑翔翼，外缘落稳再跳上平台，绕柱启动控制台。');
 assert.ok(readFileSync(new URL('../tools/build-world.ts',import.meta.url),'utf8').includes(step.text));
 try{setLanguage('zh');assert.equal(localizeText(step.text),step.text);setLanguage('en');
 assert.equal(localizeText(step.text),'Approach Parhelion Tower from the west trail: run-jump, deploy the glider, land on the outer ledge, then jump to the deck and go around the pillar to activate the console.');
 }finally{setLanguage('zh')}
});
