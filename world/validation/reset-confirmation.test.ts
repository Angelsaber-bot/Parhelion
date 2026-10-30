import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{transformSync}from'esbuild';
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const body=source.slice(source.indexOf('function requestProgressReset()'),source.indexOf('function press(binding:'));
function run(answer:boolean|'unavailable'){
 let reset=0,cleared=0,unlocked=0;let message='';const context=vm.createContext({clearInput(){cleared++;},resetProgress(){reset++;},document:{pointerLockElement:{},exitPointerLock(){unlocked++;}},window:{confirm(text:string){message=text;if(answer==='unavailable')throw Error('blocked');return answer;}},bilingual:(_zh:string,en:string)=>en});
 vm.runInContext(transformSync(body+'\nrequestProgressReset();',{loader:'ts'}).code,context);return{reset,cleared,unlocked,message};
}
test('reset hotkey requires deliberate confirmation; cancel or unavailable dialog never clears progress',()=>{for(const answer of [false,'unavailable'] as const){const r=run(answer);assert.equal(r.reset,0);assert.equal(r.cleared,1);assert.equal(r.unlocked,1);}assert.equal(run(true).reset,1);});
test('reset confirmation explains affected progress and preserved preferences',()=>{const r=run(false);assert.match(r.message,/quests, contracts and discoveries/);assert.match(r.message,/Controls, language and graphics settings are kept/);assert.match(source,/action === 'reset'.*requestProgressReset/);});
