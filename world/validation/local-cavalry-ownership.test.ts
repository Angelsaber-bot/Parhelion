import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {LocalCavalrySupport} from '../src/companions/localCavalrySupport';
import type {KitCompanion} from '../src/companions/kitCompanion';
test('inactive local support cannot cancel the normal Napoleon companion skill, including far-away updates and menu cancellation',()=>{
 let cancellations=0;const h={done:new Set<string>(),player:new THREE.Vector3(-940,4,202),actor:()=>undefined,follow:{cancelSkillPose(){cancellations++;}}as unknown as KitCompanion,start:()=>({ok:true}),target:()=>null,ground:()=>0,clear:()=>true,strike:()=>false,toast(){},save(){},changed(){}};
 const support=new LocalCavalrySupport(h);for(let i=0;i<120;i++)support.update(1/60,true);support.cancel();support.reset();assert.equal(cancellations,0);assert.equal(support.ownsActor,false);assert.equal(support.request(),false);
});

test('pause cancellation keeps the accepted cavalry cooldown and rejects late contacts',()=>{
 let command:any,strikes=0;const actor={root:new THREE.Group(),play(){}};
 const support=new LocalCavalrySupport({done:new Set(['napoleon_meet','adventure_winter_road']),player:new THREE.Vector3(40,0,-687),actor:()=>actor as any,
 follow:{attacking:false,startSkillPose(_a:any,c:any){command=c;return true;},cancelSkillPose(){command?.onFinish(false);}}as unknown as KitCompanion,
 start:()=>({ok:true}),target:()=>({id:'guard',point:new THREE.Vector3(40,0,-678)}),ground:()=>0,clear:()=>true,strike:()=>{strikes++;return true;},toast(){},save(){},changed(){}});
 assert.equal(support.request(),true);support.update(1/60,true);command.onContact(new THREE.Vector3(40,0,-680),{x:0,y:0,z:1});assert.equal(strikes,1);support.cancel();command.onContact(new THREE.Vector3(),{x:0,y:0,z:1});assert.equal(strikes,1);assert.equal(support.request(),false,'opening a menu cannot refund accepted support');
 for(let i=0;i<23*60;i++)support.update(1/60,true);assert.equal(support.request(),false);for(let i=0;i<62;i++)support.update(1/60,true);assert.equal(support.request(),true);
});
