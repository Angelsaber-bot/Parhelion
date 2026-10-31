import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createProgressPanel} from '../src/progressPanel';
import {WorldProgress} from '../src/progress';
import {setLanguage} from '../../shared-client/i18n';
test('restore failure feedback follows locale changes without altering saved data',async()=>{
 const dom=new JSDOM('<!doctype html><body></body>'),old=new Map(['window','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.defineProperty(globalThis,'window',{configurable:true,value:dom.window});Object.defineProperty(globalThis,'document',{configurable:true,value:dom.window.document});
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)};
 setLanguage('zh');const progress=new WorldProgress(storage),panel=createProgressPanel(progress,()=>assert.fail('invalid backup must not restore'));
 try{dom.window.document.body.append(panel.root);const file=panel.root.querySelector<HTMLInputElement>('input[type="file"]')!;
 Object.defineProperty(file,'files',{configurable:true,value:[{size:5,text:async()=>'{bad'}]});file.dispatchEvent(new dom.window.Event('change'));
 for(let i=0;i<5;i++)await Promise.resolve();
 const result=panel.root.querySelectorAll('p')[2];assert.match(result.textContent!,/无法读取有效/);const before=[...values];setLanguage('en');
 assert.match(result.textContent!,/not a readable progress backup/);assert.deepEqual([...values],before);
 }finally{panel.dispose();setLanguage('zh');dom.window.close();for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}}
});
for(const outcome of['blocked','failed','canceled','success','interrupted']as const)test(`restore ${outcome} feedback stays truthful across locale changes`,async()=>{
 const dom=new JSDOM('<!doctype html><body></body>'),old=new Map(['window','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.defineProperty(globalThis,'window',{configurable:true,value:dom.window});Object.defineProperty(globalThis,'document',{configurable:true,value:dom.window.document});
 let denyRead=false,denyWrite=false,restored=0,confirmed=0,resolveRead!:(s:string)=>void;
 const values=new Map<string,string>(),storage={getItem:(k:string)=>{if(denyRead)throw Error('blocked');return values.get(k)??null},setItem:(k:string,v:string)=>{if(denyWrite)throw Error('quota');values.set(k,v)}};
 setLanguage('zh');const progress=new WorldProgress(storage),panel=createProgressPanel(progress,()=>restored++);dom.window.confirm=()=>{confirmed++;return outcome!=='canceled'};
 try{dom.window.document.body.append(panel.root);const file=panel.root.querySelector<HTMLInputElement>('input[type="file"]')!,result=panel.root.querySelectorAll('p')[2];
 denyRead=outcome==='blocked';denyWrite=outcome==='failed';const raw='{"done":["chapter_test"],"found":[]}';
 const text=outcome==='interrupted'?()=>new Promise<string>(r=>{resolveRead=r}):async()=>raw;
 Object.defineProperty(file,'files',{configurable:true,value:[{size:raw.length,text}]});file.dispatchEvent(new dom.window.Event('change'));
 if(outcome==='interrupted'){panel.cancelPendingRead();resolveRead(raw)}for(let i=0;i<5;i++)await Promise.resolve();
 setLanguage('en');if(outcome==='blocked'||outcome==='failed')assert.match(result.textContent!,/Save not replaced/);else assert.equal(result.textContent,'');
 assert.equal(restored,outcome==='success'?1:0);assert.equal(progress.done.has('chapter_test'),outcome==='success');
 if(outcome==='blocked'||outcome==='interrupted')assert.equal(confirmed,0);
 const before=[...values];setLanguage('zh');if(outcome==='blocked'||outcome==='failed')assert.match(result.textContent!,/未替换存档/);else assert.equal(result.textContent,'');assert.deepEqual([...values],before);
 }finally{panel.dispose();setLanguage('zh');dom.window.close();for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}}
});
