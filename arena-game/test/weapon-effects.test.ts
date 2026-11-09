import {it,expect} from 'vitest';
import * as THREE from 'three';
import {ArenaCombatEffects} from '../src/rendering/combatEffects.ts';
import {skinEffect} from '../src/cosmetics/skinEffects.ts';
import {SIGNATURE_SKINS} from '../shared/signatureSkins.ts';
import {WEAPONS} from '../shared/content.ts';
import {attachGunArt} from '../src/weapons/gunArt.ts';
import {WeaponArtPool} from '../src/weapons/weaponArt.ts';
import {ACTIONS} from '../../shared-client/settings.ts';

const sprites=(parent:THREE.Object3D)=>parent.children.filter((o):o is THREE.Sprite=>o instanceof THREE.Sprite);
for(const trail of['wave','pulse','fork','straight']as const)it(`${trail} tracers carry a skin accent only near the muzzle, never at the aim point`,()=>{
 const skin=SIGNATURE_SKINS.find(s=>skinEffect(s.id)!.trail===trail)!,style=skinEffect(skin.id)!,parent=new THREE.Group(),fx=new ArenaCombatEffects(parent,new THREE.Texture());
 const from:[number,number,number]=[0,1.5,0],to:[number,number,number]=[0,1.5,-30];fx.tracer(from,to,style.color,1,style);
 const accents=sprites(parent);expect(accents.length).toBeGreaterThanOrEqual(2);
 for(const s of accents){expect(s.position.distanceTo(new THREE.Vector3(...from))).toBeLessThan(3.2);expect(s.position.distanceTo(new THREE.Vector3(...to))).toBeGreaterThan(26);}
 fx.update(1);expect(sprites(parent)).toHaveLength(0);fx.dispose();
});
it('tracers without a skin stay a single clean line',()=>{const parent=new THREE.Group(),fx=new ArenaCombatEffects(parent,new THREE.Texture());fx.tracer([0,1,0],[0,1,-20],0xffffff);expect(sprites(parent)).toHaveLength(0);fx.dispose();});
it('directed bursts travel along the given direction',()=>{
 const parent=new THREE.Group(),fx=new ArenaCombatEffects(parent,new THREE.Texture());for(let i=0;i<20;i++)fx.burst([0,0,0],0xffffff,.02,.5,2,'star',[0,0,-1],0);
 fx.update(.1);for(const s of sprites(parent))expect(s.position.z).toBeLessThan(0);fx.dispose();
});
for(const id of['stormcoil','frost-fang'])it(`${id}: lit details flare on a shot or swing and settle again`,async()=>{
 const skin=SIGNATURE_SKINS.find(s=>s.id===id)!,index=WEAPONS.findIndex(w=>w.id===skin.weapon),skinIndex=WEAPONS[index].skins.findIndex(s=>s.id===id);
 const group=new THREE.Group(),muzzle=new THREE.Object3D();group.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial()));
 const gun=attachGunArt(index,skinIndex,{group,muzzle},true,new WeaponArtPool(async()=>{throw Error('unexpected');}));await gun.ready;
 const glows:THREE.MeshStandardMaterial[]=[];gun.group.traverse(o=>{const m=(o as THREE.Mesh).material as THREE.MeshStandardMaterial|undefined;if((o as THREE.Mesh).isMesh&&m?.name==='Sculpt_glow')glows.push(m);});
 expect(glows.length).toBeGreaterThan(0);const base=glows[0].emissiveIntensity;
 gun.animate(1,0);const lit=glows[0].emissiveIntensity;expect(lit).toBeGreaterThan(base);
 for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,5));gun.animate(0,0);}expect(glows[0].emissiveIntensity).toBeLessThan(lit);
 gun.flare!(1.2);gun.animate(0,0);expect(glows[0].emissiveIntensity).toBeGreaterThan(base*2);gun.dispose();
});
it('Arena has a rebindable inspect action on F that does not collide with other Arena actions',()=>{
 const arena=ACTIONS.arena,inspect=arena.find(a=>a.id==='inspect')!;expect(inspect.binding).toBe('KeyF');
 expect(arena.filter(a=>a.binding==='KeyF'||a.secondary==='KeyF')).toHaveLength(1);
});
it('own tracers drop the skin accent while aiming',()=>{const parent=new THREE.Group(),fx=new ArenaCombatEffects(parent,new THREE.Texture());fx.tracer([0,1,0],[0,1,-20],0xffffff,1,undefined);expect(sprites(parent)).toHaveLength(0);fx.dispose();});
it('ambient motes leave the sight picture while aiming and return at the hip',async()=>{
 const skin=SIGNATURE_SKINS.find(s=>s.id==='koi-current')!,index=WEAPONS.findIndex(w=>w.id===skin.weapon),skinIndex=WEAPONS[index].skins.findIndex(s=>s.id===skin.id);
 const group=new THREE.Group(),muzzle=new THREE.Object3D();group.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial()));
 const gun=attachGunArt(index,skinIndex,{group,muzzle},true,new WeaponArtPool(async()=>{throw Error('unexpected');}));await gun.ready;
 const motes=gun.group.getObjectByProperty('isPoints',true)!;expect(motes.visible).toBe(true);gun.focus!(1);expect(motes.visible).toBe(false);gun.focus!(0);expect(motes.visible).toBe(true);gun.dispose();
});
