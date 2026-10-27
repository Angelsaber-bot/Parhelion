import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Batch } from '../tools/gen/geo.ts';
import { resetArchitecture,architecturePieces,winterHouse,detailedDome,ivanTower,kremlinFortifications } from '../tools/gen/winter/architecture.ts';
import {resetFieldworkSurfaces,fieldworkSurfacePieces,fieldTent,fieldWagon,fieldCannon,imperialPavilion,buildCrossingTimber,decorateFieldworks} from '../tools/gen/winter/fieldworks.ts';
import * as THREE from 'three';
function fingerprint(batches:Batch[],offset=[0,0,0]){
 const vertices:string[]=[];
 for(const b of batches)for(const g of b.vis){const p=g.attributes.position;for(let i=0;i<p.count;i++)vertices.push([p.getX(i)-offset[0],p.getY(i)-offset[1],p.getZ(i)-offset[2]].map(v=>Math.round((v+.00001)*1000)).join(','));}
 vertices.sort();return createHash('sha256').update(vertices.join(';')).digest('hex');
}
function architecture(fn:(b:Batch)=>void){resetArchitecture();const b=new Batch('Moscow');fn(b);return architecturePieces().map(p=>p.batch!);}
function validVisual(batches:Batch[]){let n=0;for(const b of batches){assert.equal(b.col.length,0,'visual craft must not change gameplay collision');for(const g of b.vis){const p=g.attributes.position;n+=p.count;for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));}}assert.ok(n>0);return n;}
test('Everwinter five house families have genuinely distinct geometry, not only colors or placements',()=>{
 const prints=[];for(let id=0;id<5;id++){
  const a=architecture(b=>winterHouse(b,0,0,0,0,8,9,5,false,id));validVisual(a);prints.push(fingerprint(a));
  const shifted=architecture(b=>winterHouse(b,20,0,30,0,8,9,5,false,id));assert.equal(fingerprint(shifted,[20,0,30]),prints[id],'same translated design remains the same shape');
 }assert.equal(new Set(prints).size,5);
});
test('Everwinter eight onion variants have different actual rib/shoulder/twist geometry',()=>{
 const prints=[];for(let variant=0;variant<8;variant++){
  const batches=architecture(b=>detailedDome(b,0,0,0,2.5,1.2,variant));assert.ok(validVisual(batches)>3000);prints.push(fingerprint(batches));
 }assert.equal(new Set(prints).size,8,'not a color-only dome permutation');
});
test('Everwinter refined fieldworks are finite visual-only deterministic geometry',()=>{
 const cases=[(b:Batch)=>fieldTent(b,0,0,0,3.2,4.2,'#e8e0cc',()=>6),(b:Batch)=>fieldWagon(b,0,2,0,0),(b:Batch)=>fieldCannon(b,0,2,0,0),(b:Batch)=>imperialPavilion(b,0,6,0,12,9),(b:Batch)=>buildCrossingTimber(b,()=>6)];
 const prints=[];for(const fn of cases){resetFieldworkSurfaces();const b=new Batch('test');fn(b);const first=[b,...fieldworkSurfacePieces().map(p=>p.batch!)];validVisual(first);const expected=fingerprint(first);prints.push(expected);resetFieldworkSurfaces();const c=new Batch('test');fn(c);assert.equal(fingerprint([c,...fieldworkSurfacePieces().map(p=>p.batch!)]),expected);}assert.equal(new Set(prints).size,cases.length);
 validVisual(decorateFieldworks(()=>6).map(p=>p.batch!).filter(Boolean));
});
