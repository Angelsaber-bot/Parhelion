import {it,expect} from 'vitest';
import * as THREE from 'three';
import {HeroEffects} from '../src/rendering/heroEffects.ts';
import {HeroDemo} from '../src/ui/heroDemo.ts';
import {rayTactical} from '../shared/heroes.ts';
import type {TacticalEntity} from '../shared/heroState.ts';
it('cannonball and hook are drawn where the authority has them, and the hook line runs back to the caster',()=>{
 for(const char of [3,5]){const demo=new HeroDemo(char);for(let i=0;i<36;i++)demo.advance(1/60);const snap=demo.snapshot,entity=snap.entities!.find(e=>e.kind==='barrage'||e.kind==='curtain')!;expect(entity).toBeTruthy();
  const scene=new THREE.Scene(),fx=new HeroEffects(scene);fx.sync(snap,'hero');scene.updateMatrixWorld(true);const head=scene.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
  expect(head.z).toBeLessThanOrEqual(entity.z+.01);expect(head.z).toBeGreaterThan(entity.z-5);expect(head.x).toBeCloseTo(entity.x,2);
  const trail=scene.getObjectByName('trail')!;expect(trail.visible).toBe(true);fx.dispose();expect(scene.children).toHaveLength(0);}
});
it('a rooted player wears shackles until the root ends',()=>{
 const demo=new HeroDemo(8);for(let i=0;i<60;i++)demo.advance(1/60);const snap=demo.snapshot,target=snap.players.find(p=>p.id==='target')!;expect(target.rootUntil).toBeGreaterThan(snap.tick);
 const scene=new THREE.Scene(),fx=new HeroEffects(scene);fx.sync(snap,'hero');expect(scene.getObjectByName('rooted')).toBeTruthy();fx.sync({...snap,tick:target.rootUntil+1},'hero');expect(scene.getObjectByName('rooted')).toBeFalsy();fx.dispose();
});
it('the solar cone points forward, and transient effects retire without accumulating objects',()=>{
 const demo=new HeroDemo(7);for(let i=0;i<3;i++)demo.advance(.25);const scene=new THREE.Scene(),fx=new HeroEffects(scene);fx.sync(demo.snapshot,'hero');const scan=scene.getObjectByName('scan') as THREE.Mesh;expect(scan).toBeTruthy();scan.geometry.computeBoundingBox();const centre=scan.geometry.boundingBox!.getCenter(new THREE.Vector3());scan.updateMatrix();centre.applyMatrix4(scan.matrix);expect(centre.z).toBeLessThan(-1);
 const count=scene.children.length;fx.event({t:'ability',id:'hero',castSeq:1,kind:'guard',action:'pulse',at:[0,0,0]},demo.snapshot.tick);expect(scene.children.length).toBe(count+1);fx.sync({...demo.snapshot,tick:demo.snapshot.tick+30},'hero');expect(scene.children.length).toBe(count);fx.dispose();expect(scene.children).toHaveLength(0);
});
it('the visible banner cloth and finial can both be shot, including a rotated flag',()=>{
 for(const yaw of [0,Math.PI/2]){const flag={kind:'prayer',x:0,y:0,z:0,yaw,hp:60} as TacticalEntity;for(const point of [[Math.cos(yaw)*.36,1.35,-Math.sin(yaw)*.36],[0,1.75,0]]){const origin:[number,number,number]=[point[0],point[1],point[2]+3];expect(rayTactical(origin,[0,0,-1],flag)).not.toBeNull();}}
});
