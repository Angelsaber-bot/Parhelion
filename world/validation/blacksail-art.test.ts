import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Batch} from '../tools/gen/geo.ts';
import {portHouse} from '../tools/gen/blacksail/architecture.ts';
import {buildMaritimeShip} from '../tools/gen/blacksail/ships.ts';
function fingerprint(bs:Batch[],offset=[0,0,0]) {const rows:string[]=[];for(const b of bs)for(const g of b.vis){const p=g.attributes.position;for(let i=0;i<p.count;i++)rows.push([p.getX(i)-offset[0],p.getY(i)-offset[1],p.getZ(i)-offset[2]].map(v=>Math.round((v+.00001)*1000)).join(','));}rows.sort();return createHash('sha256').update(rows.join(';')).digest('hex');}
function valid(bs:Batch[]) {let count=0;for(const b of bs){assert.equal(b.col.length,0,'authored surfaces must never modify gameplay collision');for(const g of b.vis){const p=g.attributes.position;count+=p.count;for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite),'finite authored geometry');}}assert.ok(count>0);}
test('Black Sail eight Nassau building families have distinct actual geometry, not recolors or relocation',()=>{
 const hashes=[];for(let i=0;i<8;i++){const a=new Batch('test');portHouse(a,0,0,0,0,8,9,5,i);valid([a]);const h=fingerprint([a]);hashes.push(h);const b=new Batch('test');portHouse(b,20,0,30,0,8,9,5,i);assert.equal(a.vis.length,b.vis.length);for(let g=0;g<a.vis.length;g++){const ap=a.vis[g].attributes.position,bp=b.vis[g].attributes.position;assert.equal(ap.count,bp.count);for(let v=0;v<ap.count;v++)for(let k=0;k<3;k++)assert.ok(Math.abs(ap.getComponent(v,k)-(bp.getComponent(v,k)-[20,0,30][k]))<.00001,'same relative vertices after translation');}}assert.equal(new Set(hashes).size,8);
});
test('Black Sail ship craft is deterministic, finite and collision-free',()=>{
 const style={hull:'#5b3a26',hullDark:'#3e271a',deck:'#b8875a',sail:'#efe4c8',castle:true};
 const a=buildMaritimeShip('Nassau_Ship',0,0,0,32,5,style,1).map(p=>p.batch!);valid(a);
 const b=buildMaritimeShip('Nassau_Ship',0,0,0,32,5,style,1).map(p=>p.batch!);assert.equal(fingerprint(a),fingerprint(b));
});

test('Black Sail equal-size port hull families vary their actual curved bilges and rigging',()=>{
 const style={hull:'#5b3a26',hullDark:'#3e271a',deck:'#b8875a',sail:'#efe4c8',castle:true};
 const hashes=[];for(let cx=0;cx<3;cx++){const bs=buildMaritimeShip('Nassau_Ship',cx,0,0,32,5,style,1).map(p=>p.batch!);valid(bs);hashes.push(fingerprint(bs,[cx,0,0]));}assert.equal(new Set(hashes).size,3);
});
