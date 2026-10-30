import test from 'node:test';
import assert from 'node:assert/strict';
import {optionalPinExpired,type OptionalPin} from '../src/optionalNavigation';
const p={x:0,y:1,z:0};
const pin:OptionalPin={kind:'quiet-route',p:[-224,11.56,840],label:['高地','Ledge'],region:'kyoto'};
test('Kyoto quiet route expires immediately after its purpose resolves, not just on arrival',()=>{
 const done=new Set(['kyoto_lantern_route']);assert.equal(optionalPinExpired(pin,'kyoto',p,done,new Set()),false);
 for(let i=1;i<=3;i++)done.add(`kikyo_banner_${i}`);assert.equal(optionalPinExpired(pin,'kyoto',p,done,new Set()),true);
});
test('treasure completion expires an old missing-map-piece pin in legacy saves',()=>{
 const clue:OptionalPin={...pin,kind:'clue',region:'blacksail',targetId:'map_piece_1'};
 const done=new Set(['blacksail_harbor_signal']);assert.equal(optionalPinExpired(clue,'blacksail',p,done,new Set()),false);done.add('shard_treasure');assert.equal(optionalPinExpired(clue,'blacksail',p,done,new Set()),true);
});
test('explicit repeat trial is not cancelled just because the first victory is saved',()=>{
 const trial:OptionalPin={...pin,kind:'trial',region:'britain'};assert.equal(optionalPinExpired(trial,'britain',p,new Set(['era_britain_knight_defeated']),new Set()),false);
 assert.equal(optionalPinExpired(trial,'kyoto',p,new Set(),new Set()),true);assert.equal(optionalPinExpired(trial,'britain',{x:pin.p[0],y:0,z:pin.p[2]},new Set(),new Set()),true);
});

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
test('production distant knight defeat clears only the current trial guide, including rematches',()=>{
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 const start=source.indexOf('  onKill(id) {'),end=source.indexOf('  onPlayerDefeated()',start);
 const body=source.slice(start,end).trim().replace(/^onKill\(/,'function onKill(').replace(/,$/,'');
 assert.ok(body.includes('optionalPin'));
 const context=vm.createContext({optionalPin:{...pin,kind:'trial',region:'britain'},hudRevision:0,audio:{kill(){}},save(){},applyWorldState(){}});
 vm.runInContext(transformSync(body+'\nglobalThis.defeat=onKill;', {loader:'ts'}).code,context);
 context.defeat('wild_1');assert.equal(context.optionalPin.kind,'trial');
 context.defeat('elite_oath_knight');assert.equal(context.optionalPin,null);assert.equal(context.hudRevision,1);
 context.optionalPin={...pin,kind:'clue'};context.defeat('elite_oath_knight');assert.equal(context.optionalPin.kind,'clue');
 context.optionalPin={...pin,kind:'trial'};context.defeat('elite_oath_knight');assert.equal(context.optionalPin,null);
});
