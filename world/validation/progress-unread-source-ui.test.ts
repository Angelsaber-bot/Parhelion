import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {WorldProgress,LEGACY_WORLD_PROGRESS_KEYS} from '../src/progress';
import {createProgressPanel} from '../src/progressPanel';
import {setLanguage} from '../../shared-client/i18n';

test('unread legacy source offers session backup, not nonexistent raw bytes; cancel never writes',()=>{
 const dom=new JSDOM('<!doctype html><body></body>');
 const old=new Map(['window','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.defineProperty(globalThis,'window',{configurable:true,value:dom.window});Object.defineProperty(globalThis,'document',{configurable:true,value:dom.window.document});
 let writes=0,removes=0;const confirms:string[]=[];
 const progress=new WorldProgress({getItem(key){if(key===LEGACY_WORLD_PROGRESS_KEYS[0])throw Error('read unavailable');return key===LEGACY_WORLD_PROGRESS_KEYS[1]?JSON.stringify({done:['relay_b'],found:['retained_discovery']}):null},setItem(){writes++},removeItem(){removes++}});
 dom.window.confirm=message=>{confirms.push(String(message));return false};
 const panel=createProgressPanel(progress,()=>assert.fail('canceled replacement must not reload'));
 try{
  dom.window.document.body.append(panel.root);assert.equal(progress.saveBlocked,true);assert.equal(progress.exportUnreadableSnapshot(),null);
  assert.equal(progress.done.has('relay_b'),true);assert.equal(progress.found.has('retained_discovery'),true);
  for(const lang of ['zh','en']as const){
   setLanguage(lang);const buttons=[...panel.root.querySelectorAll('button')];
   const original=buttons.find(b=>/无损原始|lossless original/.test(b.textContent!))!;assert.equal(original.hidden,true);
   assert.match(panel.root.querySelector('p')!.textContent!,lang==='zh'?/重新载入可重试读取/:/reloading to retry the reads/);
   const replace=buttons.find(b=>/用本次进度替换|Replace with session progress/.test(b.textContent!))!;assert.equal(replace.hidden,false);replace.click();
   assert.match(confirms.at(-1)!,lang==='zh'?/可能不包含其中的任务/:/may omit their quests/);
   assert.equal(writes,0);assert.equal(removes,0);assert.equal(progress.done.has('relay_b'),true);
  }
  assert.equal(confirms.length,2);
 }finally{panel.dispose();setLanguage('zh');dom.window.close();for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}}
});
