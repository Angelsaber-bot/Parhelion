import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SiteArt} from '../src/campaignSites';
import {Frame,chestBody,chestLid,waterPlatform,steppingStone} from '../src/exploration/models';
import type {ChestTier} from '../src/exploration/catalog';

for(const tier of['common','exquisite','precious','luxurious'] as ChestTier[]){
 test(`${tier}: FrontSide lid is closed from underneath both before and after opening`,()=>{
  const {group,art}=chestLid(tier);
  for(const angle of[0,-.8,-1.75]){
   group.rotation.x=angle;group.updateMatrixWorld(true);
   for(const x of[-.43,-.2,0,.2,.43])for(const z of[.04,.17,.32,.47,.60]){
    const from=group.localToWorld(new THREE.Vector3(x,-.3,z));
    const direction=new THREE.Vector3(0,1,0).transformDirection(group.matrixWorld);
    const hit=new THREE.Raycaster(from,direction,0,.4).intersectObject(group,true)[0];
    assert.ok(hit,`missing inner lid at ${x},${z}, angle ${angle}`);
   }
  }
  for(const m of art.layers.values())m.geometry.dispose();Object.values(art.materials).forEach(m=>m.dispose());
 });
 test(`${tier}: open body has a continuous lining and interior space below its rim`,()=>{
  const art=new SiteArt();chestBody(new Frame(art,[0,0,0]),tier);art.finish('britain');art.root.updateMatrixWorld(true);
  for(const x of[-.35,0,.35])for(const z of[-.2,0,.2]){
   const hit=new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)).intersectObject(art.root,true)[0];
   assert.ok(hit&&hit.point.y<.18&&hit.point.y>.13,`missing or filled chest interior ${x},${z}: ${hit?.point.y}`);
  }
  for(const sign of[-1,1])assert.ok(new THREE.Raycaster(new THREE.Vector3(0,.32,0),new THREE.Vector3(sign,0,0),0,.6).intersectObject(art.root,true)[0],'inner side wall');
  for(const m of art.layers.values())m.geometry.dispose();for(const g of art.solids)g.dispose();Object.values(art.materials).forEach(m=>m.dispose());
 });
}

test('water platforms and stepping stones have one top face rather than overlapping coplanar caps',()=>{
 for(const build of[waterPlatform,steppingStone]){
  const art=new SiteArt();build(new Frame(art,[0,0,0]),2,-2);art.finish('britain');art.root.updateMatrixWorld(true);
  const hits=new THREE.Raycaster(new THREE.Vector3(.37,3,.11),new THREE.Vector3(0,-1,0)).intersectObject(art.root,true);
  assert.equal(hits.filter(h=>Math.abs(h.point.y-2)<.001).length,1,build.name);
  for(const m of art.layers.values())m.geometry.dispose();for(const g of art.solids)g.dispose();Object.values(art.materials).forEach(m=>m.dispose());
 }
});
