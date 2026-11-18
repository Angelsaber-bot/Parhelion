import {describe,it,expect} from 'vitest';
import {buildMap,type MapData} from '../shared/map.ts';
import {hiddenFromView} from '../src/rendering/edictReveal.ts';
import {settleSmoke} from '../shared/grenade.ts';
import {SMOKE} from '../shared/content.ts';
const data:MapData={mapId:'reveal-test',version:'1',bounds:{min:[-30,-1,-30],max:[30,10,30]},objects:[
 {id:'floor',type:'box',position:[0,-.2,0],size:[60,.4,60],collision:true,role:'floor',material:'stone'},
 {id:'wall',type:'box',position:[0,1.5,-5],size:[4,3,.4],collision:true,role:'wall',material:'stone'},
 {id:'low',type:'box',position:[10,.6,-5],size:[4,1.2,.4],collision:true,role:'wall',material:'stone'}],
 anchors:[{id:'a',kind:'spawn',team:'west',position:[0,0,0]},{id:'b',kind:'spawn',team:'east',position:[0,0,-10]}],routes:[],
 player:{radius:.32,height:1.8,eyeHeight:1.62,walkSpeed:5.2,stepHeight:.35,jumpSpeed:5.4,gravity:15}} as unknown as MapData;
const map=buildMap(structuredClone(data));
describe('edict reveal silhouettes',()=>{
 it('show only while walls hide every sampled point of the body',()=>{
  expect(hiddenFromView(map,[0,1.62,0],[0,0,-8],false)).toBe(true);            // full wall between
  expect(hiddenFromView(map,[0,1.62,0],[6,0,-8],false)).toBe(false);           // in the open
  expect(hiddenFromView(map,[10,1.62,0],[10,0,-8],false)).toBe(false);         // low wall: head still visible
  expect(hiddenFromView(map,[10,1.62,0],[10,0,-6],true)).toBe(true);           // crouched behind the low wall
 });
 it('smoke between the camera and the body counts as hidden',()=>{
  const smoke=settleSmoke(map,{id:1,owner:'x',x:6,y:0,z:-4,life:SMOKE.life-120});
  expect(hiddenFromView(map,[6,1.62,0],[6,0,-8],false,[smoke])).toBe(true);
 });
});
