import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FirstContract } from '../src/contracts.ts';
import { ContractServant, SERVANT_CLIPS } from '../src/servant.ts';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { setLanguage } from '../../shared-client/i18n.ts';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'',shortCircuit:true}:next(url,context);}});
class Element {
  id='';type='';className='';textContent='';value='';hidden=false;disabled=false;open=false;removed=false;
  children:Element[]=[];attributes=new Map<string,string>();listeners=new Map<string,((e:any)=>void)[]>();
  onclick?: (e:any)=>void; onchange?: (e:any)=>void;
  append(...nodes:Element[]){this.children.push(...nodes);}
  setAttribute(key:string,value:string){this.attributes.set(key,value);}
  addEventListener(name:string,listener:(e:any)=>void){this.listeners.set(name,[...this.listeners.get(name)??[],listener]);}
  removeEventListener(name:string,listener:(e:any)=>void){this.listeners.set(name,(this.listeners.get(name)??[]).filter(fn=>fn!==listener));}
  showModal(){this.open=true;}close(){this.open=false;}remove(){this.removed=true;}
}
const body=new Element(),doc=Object.assign(new Element(),{body,documentElement:{lang:'zh-CN'},pointerLockElement:null as unknown,createElement:()=>new Element()});
(globalThis as any).document=doc;
const {createServantPanel}=await import('../src/servantPanel.ts');
function flatten(root:Element):Element[]{return [root,...root.children.flatMap(flatten)];}
test('World outfit modal is reversible, bilingual and isolated from gameplay/contract progress',async()=>{
  const done=new Set(['saber_contract','relay_a']),contract=new FirstContract(done),scene=new THREE.Scene();
  const servant=new ContractServant({scene,marker:{id:'saber_contract',type:'interact',label:'Saber',p:[0,0,0]},contract,colliders:[],target:()=>null,strike:()=>null,
    load:async()=>({scene:new THREE.Group(),animations:SERVANT_CLIPS.map(name=>new THREE.AnimationClip(name,1,[]))}) as GLTF});
  let opens=0;const panel=createServantPanel(servant,contract,()=>{opens++;doc.pointerLockElement=null;});
  const all=flatten(body),launcher=all.find(e=>e.id==='servant-open')!,dialog=all.find(e=>e.id==='servant-settings')!,select=all.find(e=>e.id==='servant-outfit')!;
  assert.equal(select.value,'armor');assert.match(launcher.textContent,/从者/);
  launcher.onclick!({stopPropagation(){}});launcher.onclick!({stopPropagation(){}});assert.equal(opens,1);assert.equal(panel.open,true);
  select.value='civilian';select.onchange!({});await servant.ensureLoaded();panel.render();
  assert.equal(servant.activeOutfit,'civilian');assert.equal(contract.summoned,true);assert.deepEqual([...done],['saber_contract','relay_a']);
  select.value='armor';select.onchange!({});await servant.ensureLoaded();assert.equal(servant.activeOutfit,'armor');
  setLanguage('en');assert.equal(launcher.textContent,'Servant · Outfits');assert.equal(select.children[0].textContent,'Oath armor');assert.equal(select.children[1].textContent,'Travel clothes');
  setLanguage('zh');assert.equal(select.children[0].textContent,'誓约战甲');
  let stopped=0;for(const listener of dialog.listeners.get('keydown')!)listener({stopPropagation(){stopped++;}});assert.equal(stopped,1);
  doc.pointerLockElement={};for(const fn of doc.listeners.get('pointerlockchange')!)fn({});assert.equal(launcher.hidden,true);
  doc.pointerLockElement=null;for(const fn of doc.listeners.get('pointerlockchange')!)fn({});assert.equal(launcher.hidden,false);
  panel.dispose();panel.dispose();servant.dispose();assert.equal(launcher.removed,true);assert.equal(dialog.removed,true);
  assert.equal(doc.listeners.get('pointerlockchange')!.length,0);
});
test('outfit controls have bounded viewport CSS and opening clears input without changing Arena settings',()=>{
  const css=readFileSync(new URL('../src/servant.css',import.meta.url),'utf8');
  assert.match(css,/#servant-open\[hidden\][^}]*display:\s*none/);
  assert.match(css,/width:\s*min\(480px,\s*calc\(100vw - 28px\)\)/);assert.match(css,/max-height:.*100vh/);assert.match(css,/overflow:\s*auto/);
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  assert.match(source,/createServantPanel\(servant, contract, \(\) => \{ clearInput\(\); if \(document.pointerLockElement\) document.exitPointerLock\(\); \}\)/);
  assert.doesNotMatch(readFileSync(new URL('../src/servantPanel.ts',import.meta.url),'utf8'),/SettingsStore|skinStore|from ['"][^'"]*arena-game/);
});
