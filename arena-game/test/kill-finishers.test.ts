import {it,expect} from 'vitest';
import * as THREE from 'three';
import {SIGNATURE_SKINS} from '../shared/signatureSkins.ts';
import {FINISHERS,FINISHER_LIFE,FINISHER_POINTS,KillFinishers,sampleEmblem} from '../src/rendering/killFinishers.ts';

it('every one of the 40 finishes has its own kill emblem, and no two emblems are the same',()=>{
 expect(SIGNATURE_SKINS).toHaveLength(40);const keys=new Set<string>();
 for(const s of SIGNATURE_SKINS){const f=FINISHERS[s.id];expect(f,s.id).toBeDefined();const pts=sampleEmblem(f.emblem);expect(pts).toHaveLength(FINISHER_POINTS);
  for(const [x,y]of pts){expect(Number.isFinite(x)&&Number.isFinite(y)).toBe(true);expect(Math.abs(x)).toBeLessThan(1.35);expect(Math.abs(y)).toBeLessThan(1.35);}
  keys.add(pts.map(([x,y])=>`${x.toFixed(2)},${y.toFixed(2)}`).join(';'));}
 expect(keys.size).toBe(40);
});
function camera(){const c=new THREE.PerspectiveCamera(70,1.6,.1,100);c.position.set(0,1.7,6);c.lookAt(0,1.5,0);c.updateMatrixWorld();return c;}
it('a finisher assembles above the victim facing the viewer, then fully clears',()=>{
 const scene=new THREE.Scene(),fx=new KillFinishers(scene);expect(fx.play([2,0,-1],'frost-fang',camera())).toBe(true);
 const points=scene.getObjectByName('Kill finisher emblem') as THREE.Points;const p=points.geometry.getAttribute('position');
 const box=new THREE.Box3().setFromBufferAttribute(p as THREE.BufferAttribute);expect(box.min.y).toBeGreaterThan(.9);expect(box.max.y).toBeLessThan(2.6);
 expect(box.max.z-box.min.z).toBeLessThan(.01); // a flat emblem in the plane facing the camera
 fx.update(.5);expect(fx.active).toBe(1);fx.update(FINISHER_LIFE);expect(fx.active).toBe(0);expect(scene.children).toHaveLength(0);fx.dispose();
});
it('while aiming the emblem is smaller, dimmer and lifted clear of the sight line',()=>{
 const a=new THREE.Scene(),b=new THREE.Scene(),fa=new KillFinishers(a),fb=new KillFinishers(b),cam=camera();fa.play([0,0,0],'stormcoil',cam,false);fb.play([0,0,0],'stormcoil',cam,true);
 const box=(s:THREE.Scene)=>new THREE.Box3().setFromBufferAttribute((s.getObjectByName('Kill finisher emblem') as THREE.Points).geometry.getAttribute('position') as THREE.BufferAttribute);
 expect(box(b).min.y).toBeGreaterThan(box(a).min.y);expect(box(b).max.x-box(b).min.x).toBeLessThan(box(a).max.x-box(a).min.x);
 const op=(s:THREE.Scene)=>((s.getObjectByName('Kill finisher emblem') as THREE.Points).material as THREE.ShaderMaterial).uniforms.uOpacity.value;expect(op(b)).toBeLessThan(op(a));
 fa.dispose();fb.dispose();
});
it('the pool is capped and unknown finishes are ignored',()=>{
 const scene=new THREE.Scene(),fx=new KillFinishers(scene,3),cam=camera();
 for(const s of SIGNATURE_SKINS.slice(0,8))fx.play([0,0,0],s.id,cam);expect(fx.active).toBe(3);
 expect(fx.play([0,0,0],'not-a-finish',cam)).toBe(false);expect(fx.play([NaN,0,0],'stormcoil',cam)).toBe(false);fx.dispose();
});
