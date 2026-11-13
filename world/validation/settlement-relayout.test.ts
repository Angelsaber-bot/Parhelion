import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCampaignSites } from '../src/story/campaignSites';
import { createEraStoryScene } from '../src/story/eraStoryScenes';
import { settlementGrassClearance } from '../src/map/grassClearance';
import { settlementEntryApproach } from '../src/settlements/frame';
import type { SettlementPlacement } from '../src/settlements/types';

const local: SettlementPlacement = {id:'kyoto',name:['京都','Kyoto'],position:[0,0,0],entry:[0,0,15.5],footprint:[35,31],groundRange:0};
const moved: SettlementPlacement = {...local,position:[892,4.492358,-1532],entry:[892,4.492358,-1547.5],yaw:Math.PI};
const expected = (p:readonly number[]) => [892-p[0],4.492358+p[1],-1532-p[2]];
function close(actual:readonly number[], wanted:readonly number[]) {actual.forEach((v,i)=>assert.ok(Math.abs(v-wanted[i])<.0002,`${actual} != ${wanted}`));}

test('Kyoto annexes, residents and solid surfaces turn with the inn instead of occupying its opposite corner',()=>{
  const before=createCampaignSites([local]),after=createCampaignSites([moved]);
  close(after.sites[0].origin,[881.5,4.492358,-1542.2]);
  after.markers.forEach((m,i)=>close(m.p,expected(before.markers[i].p)));
  close(after.npcs[0].position,expected(before.npcs[0].position));
  assert.equal(after.npcs[0].yaw,before.npcs[0].yaw!+Math.PI);
  before.collisionGeometries.forEach((g,i)=>{
    const a=g.attributes.position,b=after.collisionGeometries[i].attributes.position;
    for(let j=0;j<a.count;j++)close([b.getX(j),b.getY(j),b.getZ(j)],expected([a.getX(j),a.getY(j),a.getZ(j)]));
  });
  before.root.updateMatrixWorld(true);after.root.updateMatrixWorld(true);
  const a=new THREE.Box3().setFromObject(before.root),b=new THREE.Box3().setFromObject(after.root);
  close(b.min.toArray(),[892-a.max.x,4.492358+a.min.y,-1532-a.max.z]);
  close(b.max.toArray(),[892-a.min.x,4.492358+a.max.y,-1532-a.min.z]);
  before.dispose();after.dispose();
});

test('Kyoto story station and its interaction move to the same rotated frontage',()=>{
  const before=createEraStoryScene(local),after=createEraStoryScene(moved);
  close(after.group.position.toArray(),[887,4.492358,-1542]);
  close(after.markers[0].p,expected(before.markers[0].p));
  assert.equal(after.group.rotation.y,Math.PI);
  const p=before.colliders[0].bvh.geometry.attributes.position,q=after.colliders[0].bvh.geometry.attributes.position;
  // BVH construction may reorder indices, but leaves the vertex positions intact.
  for(let i=0;i<p.count;i++)close([q.getX(i),q.getY(i),q.getZ(i)],expected([p.getX(i),p.getY(i),p.getZ(i)]));
  before.dispose();after.dispose();
});

test('Kyoto map approach and grass exclusion follow the actual south-facing local entrance after rotation',()=>{
  close(settlementEntryApproach(moved,8),[892,-1555.5]);
  const grid={nx:101,nz:101,x0:842,z0:-1582,cell:1};
  const mask=settlementGrassClearance(grid,[moved],[]);
  const at=(x:number,z:number)=>mask[(z-grid.z0)*grid.nx+x-grid.x0];
  assert.equal(at(892,-1555),1,'clear the actual ramp outside the turned entrance');
  assert.equal(at(892,-1508),0,'do not clear an unrelated strip behind the inn');
});
