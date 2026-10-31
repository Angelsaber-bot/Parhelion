import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
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
 assert.equal(step.text,'从西侧跑跳，空中再按跳跃展翼；外缘落稳后跳上平台，绕柱启动控制台。');
 assert.ok(readFileSync(new URL('../tools/build-world.ts',import.meta.url),'utf8').includes(step.text));
 try{setLanguage('zh');assert.equal(localizeText(step.text),step.text);setLanguage('en');
 assert.equal(localizeText(step.text),'Run-jump from the west trail and press Jump again to glide. Land on the outer ledge, jump to the deck, then go around the pillar to the console.');
 }finally{setLanguage('zh')}
});

test('tower instruction uses wrappable objective rows rather than a no-wrap world label',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html);
 try{const panel=dom.window.document.getElementById('objective')!;
 const row=dom.window.document.createElement('div');row.className='cur';panel.append(row);
 const style=dom.window.getComputedStyle(row),container=dom.window.getComputedStyle(panel);
 assert.notEqual(style.whiteSpace,'nowrap');assert.notEqual(style.whiteSpace,'pre');
 assert.notEqual(container.whiteSpace,'nowrap');assert.notEqual(container.overflow,'hidden');
 assert.notEqual(style.textOverflow,'ellipsis');
 // DOM/CSS wrapping contract only; jsdom does not prove browser line layout.
 }finally{dom.window.close()}
});
