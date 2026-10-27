import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildMaritimeShip,buildSmallCraft,buildHalfWreckHull } from '../tools/gen/blacksail/ships.js';
import type { Piece } from '../tools/gen/structures.js';
const style={hull:'#5b3a26',hullDark:'#3e271a',deck:'#b8875a',sail:'#efe4c8',castle:true};
const triangles=(p:Piece[])=>p.reduce((n,x)=>n+x.batch.vis.reduce((s,g)=>s+g.attributes.position.count/3,0),0);
function check(p:Piece[]){assert.ok(p.length>0);for(const x of p){assert.equal(x.batch.col.length,0,`${x.name} must not append collision proxies`);assert.equal(x.material,x.batch.material);for(const g of x.batch.vis){assert.ok(g.attributes.position.count>0);for(const a of Object.values(g.attributes))for(const n of a.array)assert.ok(Number.isFinite(n),`${x.name} finite geometry`);}}}
function fingerprint(p:Piece[]){const h=createHash('sha256');for(const x of p)for(const g of x.batch.vis)h.update(Buffer.from(g.attributes.position.array.buffer));return h.digest('hex');}
test('maritime visual replacements are finite, material-separated, collider-free, and bounded',()=>{
 for(const [name,len,deck] of [['Nassau_Ship',32,4.8],['Sky_Wreck',30,68],['Ghost_Fleet',46,7]] as const){
  const p=buildMaritimeShip(name,0,0,0,len,deck,{...style,keel:name==='Sky_Wreck'?63.5:undefined},1);check(p);assert.ok(triangles(p)<16000,`${name} economical silhouette/rigging`);
  assert.equal(p.find(x=>x.name.endsWith('_Canvas'))?.material,name==='Ghost_Fleet'?'M_Beam':'M_BlackSailCanvas');
  assert.ok(p.some(x=>x.material==='M_BlackSailTimber'));assert.ok(p.some(x=>x.material==='M_BlackSailRope'));
 }
});
test('wreck and intact ship are geometrically distinct, not recolors',()=>{
 const intact=buildMaritimeShip('Nassau',0,0,0,30,7,style,1),wreck=buildMaritimeShip('Sky_Wreck',0,0,0,30,7,style,1);
 assert.notEqual(fingerprint(intact),fingerprint(wreck));assert.ok(triangles(wreck)<triangles(intact));
});
test('reef yawl and half-sunk ribbed merchantman add no fake collision decks',()=>{
 const yawl=buildSmallCraft('Reef_Yawl',146,202,1.1,5,1.6,3.7),smuggler=buildSmallCraft('Smuggler',146,202,1.1,5,1.6,3.7,'smuggler'),wreck=buildHalfWreckHull(104,214,1);
 for(const p of [yawl,smuggler,wreck]){check(p);assert.ok(triangles(p)<2500);}assert.notEqual(fingerprint(yawl),fingerprint(smuggler));
});
test('forefoot rise tapers to zero at deck: bow shell never becomes a tall wall',()=>{
 const deck=7,p=buildMaritimeShip('Ghost_Fleet',0,0,0,46,deck,style,1);
 const strakes=p.flatMap(x=>x.batch.vis).filter(g=>g.userData.maritimeRole==='hull-strake');assert.ok(strakes.length>40);
 for(const g of strakes){const a=g.attributes.position;for(let i=0;i<a.count;i++)assert.ok(a.getY(i)<=deck+.001,`hull shell at ${a.getY(i)} must be below deck ${deck}`);}
});
test('wreck primary spars remain visible to the original full-height gliding collider tops',()=>{
 const deck=68,len=30,p=buildMaritimeShip('Sky_Wreck',0,0,0,len,deck,{...style,castle:false,masts:2,keel:63.5},1);
 for(const z of [-len*.22,len*.26]){let top=-Infinity;for(const item of p.filter(x=>x.material==='M_BlackSailTimber'))for(const g of item.batch.vis){const a=g.attributes.position;for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i))<.3&&Math.abs(a.getZ(i)-z)<.3)top=Math.max(top,a.getY(i));}assert.ok(top>=deck+len*.75-.001,`visible spar ${z} reaches its retained collision top`);}
});
