import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldCombatState } from '../src/combat/combat';
import { WORLD_GUNS, worldGun } from '../src/weapons/worldArsenal';
import { weaponAmmoPresentation, weaponDryFireHint } from '../src/weapons/weaponReadiness';

for(const gun of WORLD_GUNS)test(`${gun.id}: displayed insufficiency matches the real trigger cost without spending ammunition`,()=>{
 const state=new WorldCombatState([],[]);state.setGun(gun);state.shotCooldown=0;state.ammo=gun.ammoCost-1;
 const before=state.ammo,feedback=weaponAmmoPresentation(state);assert.equal(state.canShoot(),false);assert.equal(state.ammo,before);assert.equal(feedback.tone,'empty');
 if(before>0){assert.match(feedback.text[0],/不足/);assert.match(feedback.text[1],new RegExp(`NEED ${gun.ammoCost}`));const hint=weaponDryFireHint(state,'Z')!;assert.match(hint[0],new RegExp(`需要 ${gun.ammoCost} 发，现有 ${before} 发`));assert.match(hint[0],/\[Z\]/);assert.match(hint[1],/lower-cost gun/);assert.doesNotMatch(hint[0],/耗尽/);}
 else assert.match(weaponDryFireHint(state,'Z')![0],/耗尽/);
 state.refillAmmo(1);const sufficient=weaponAmmoPresentation(state);assert.notEqual(sufficient.tone,'empty');assert.equal(sufficient.text[0],String(gun.ammoCost));assert.equal(weaponDryFireHint(state,'Z'),null);assert.equal(state.canShoot(),true);assert.equal(state.ammo,0);
});
test('boss supply and vent are independent; countdown remains visible until shooting really resumes',()=>{
 const state=new WorldCombatState([],[]);state.ammo=0;state.bossStarted=true;state.gunVent=.04;
 const feedback=weaponAmmoPresentation(state);assert.equal(feedback.tone,'boss');assert.equal(feedback.text[0],'∞ · 散热 0.1s');assert.equal(feedback.text[1],'∞ · COOL 0.1s');assert.match(feedback.description[1],/Unlimited ammunition.*Cooling/);
 assert.equal(weaponDryFireHint(state,'B'),null);assert.equal(state.canShoot(),false);assert.equal(state.ammo,0);assert.equal(state.gunVent,.04,'presentation does not consume time');
 state.gunVent=0;assert.deepEqual(weaponAmmoPresentation(state).text,['∞','∞']);assert.equal(state.canShoot(),true);assert.equal(state.ammo,0);
});
test('switching to an affordable gun immediately clears the shortage and field vents retain both reasons',()=>{
 const state=new WorldCombatState([],[]);state.setGun(worldGun('longnight')!);state.ammo=2;state.gunVent=.62;
 const before=weaponAmmoPresentation(state);assert.equal(before.tone,'empty');assert.match(before.text[0],/2 · 不足 · 散热 0.7s/);assert.match(before.description[0],/弹药不足/);assert.doesNotMatch(before.description[0],/后可再次射击/,'cooldown cannot promise fire while ammo is still insufficient');
 state.setGun(worldGun('lumen')!);const after=weaponAmmoPresentation(state);assert.notEqual(after.tone,'empty');assert.equal(after.text[0],'2 · 散热 0.7s');assert.equal(weaponDryFireHint(state,'B'),null);assert.equal(state.gunVent,.62,'switching/presentation does not erase the real vent');
});
