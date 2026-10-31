import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MusashiWindupCamera } from '../src/musashiWindupCamera';
import type { EraArtFrame } from '../src/eraStageArt';
const frame=(phase:EraArtFrame['phase'],progress:number):EraArtFrame=>({phase,progress,elapsed:3,pulse:0,strikeCount:0});
test('Musashi camera changes only mid-charge, preserves baseline aim and has continuous bounded endpoints',()=>{
 const actor=new THREE.Group(),helper=new MusashiWindupCamera(actor),camera=new THREE.PerspectiveCamera(35,16/9),aim=new THREE.Vector3(0,2.5,0),position=new THREE.Vector3(1.2,2.8,3.2);
 for(const[phase,p,reduced]of [['intro',.5,false],['charge',.29,false],['charge',.3,false],['charge',.9,false],['charge',.95,false],['release',.5,false],['outro',.5,false],['charge',.5,true],['charge',NaN,false]]as const){camera.position.copy(position);camera.fov=35;const q=camera.quaternion.clone();const result=helper.update(frame(phase,p),camera,reduced,aim);assert.deepEqual(camera.position.toArray(),position.toArray());assert.deepEqual(camera.quaternion.toArray(),q.toArray());assert.equal(camera.fov,35);assert.deepEqual(result.toArray(),aim.toArray());}
 for(const p of [.3+1e-7,.9-1e-7]){camera.position.copy(position);camera.fov=35;const result=helper.update(frame('charge',p),camera,false,aim);assert(camera.position.distanceTo(position)<1e-9);assert(result.distanceTo(aim)<1e-9);}
 camera.position.copy(position);camera.fov=35;const opened=helper.update(frame('charge',.45),camera,false,aim);assert.deepEqual(camera.position.toArray(),[1.6,2,7.8]);assert.deepEqual(opened.toArray(),[0,1.55,.05]);assert.equal(camera.fov,40);assert.deepEqual(aim.toArray(),[0,2.5,0]);
 const once=camera.position.clone();camera.position.copy(position);camera.fov=35;helper.update(frame('charge',.45),camera,false,aim);assert.deepEqual(camera.position.toArray(),once.toArray());assert.deepEqual(actor.position.toArray(),[0,0,0]);
});
