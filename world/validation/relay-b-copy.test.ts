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
