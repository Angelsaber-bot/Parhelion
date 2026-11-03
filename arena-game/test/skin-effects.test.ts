import {expect,it} from 'vitest';
import * as THREE from 'three';
import {SIGNATURE_SKINS} from '../shared/signatureSkins.ts';
import {skinEffect} from '../src/skinEffects.ts';
import {ArenaCombatEffects} from '../src/combatEffects.ts';
it('every current skin has a complete theme and unknown saved IDs fall back safely',()=>{
 expect(skinEffect('removed')).toBeUndefined();
 for(const s of SIGNATURE_SKINS){const p=skinEffect(s.id)!;expect(p.color).toBe(s.accent);expect(p.life).toBeLessThan(.4);expect(p.spread).toBeGreaterThan(0);}
 expect(skinEffect('mixtape')!.particle).toBe('pixel');expect(skinEffect('glacier-survey')!.particle).toBe('crystal');
});
it('shaped trails preserve both exact endpoints and reset geometry on reuse',()=>{
 const parent=new THREE.Group(),tex=new THREE.Texture(),fx=new ArenaCombatEffects(parent,tex);
 for(const skin of SIGNATURE_SKINS){
  fx.tracer([0,0,0],[0,0,-20],0xffffff,1,skinEffect(skin.id));
  const line=parent.children[0] as THREE.Line,g=line.geometry,p=g.getAttribute('position'),last=g.drawRange.count-1;
  expect([p.getX(0),p.getY(0),p.getZ(0)]).toEqual([0,0,0]);expect([p.getX(last),p.getY(last),p.getZ(last)]).toEqual([0,0,-20]);
  expect([...p.array].every(Number.isFinite)).toBe(true);fx.update(1);
 }
 fx.tracer([100,2,0],[110,2,0],0xffffff);const g=(parent.children[0] as THREE.Line).geometry;expect(g.drawRange.count).toBe(2);
 fx.dispose();tex.dispose();
});
it('all particle shapes share the bounded pool, fade, reset and dispose cleanly',()=>{
 const parent=new THREE.Group(),tex=new THREE.Texture(),fx=new ArenaCombatEffects(parent,tex,'low');
 for(let i=0;i<500;i++){const p=skinEffect(SIGNATURE_SKINS[i%SIGNATURE_SKINS.length].id)!;fx.burst([0,1,0],p.color,.15,p.life,p.spread,p.particle);}
 expect(fx.inventory.allocated.sparks).toBe(fx.budget.sparks);
 const m=(parent.children[0] as THREE.Sprite).material;
 const shader={uniforms:{},fragmentShader:'#include <common>\n#include <map_fragment>'};m.onBeforeCompile(shader as any,null as any);
 expect(shader.fragmentShader).toContain('vMapUv');expect(shader.fragmentShader).toContain('opacity*mask');
 fx.update(1);expect(parent.children).toHaveLength(0);
 fx.burst([0,0,0],0xffffff,.5,.3,1);const sprite=parent.children[0] as THREE.Sprite;expect(sprite.scale.x).toBe(sprite.scale.y);expect(sprite.material.rotation).toBe(0);expect(sprite.material.userData.shapeIndex).toBe(0);
 fx.dispose();expect(fx.inventory.allocated.sparks).toBe(0);tex.dispose();
});
