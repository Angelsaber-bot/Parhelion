/** World-only tuning. Quest shots keep their separate 150m ray and Arena is untouched. */
export const WORLD_RIFLE = Object.freeze({
 damage:12, interval:.18, burst:6, vent:1.35, enemyRange:70,
 fullDamageRange:12, minimumDamageRange:48, minimumMultiplier:.2,
 recoveryBonus:1.3, breakerArmor:.7,
 /** rifle damage a shieldbearer's tower shield lets through while it faces the player */
 shieldBlock:.15,
 /** Field ammo: era-boss arenas feed the rifle from the sun core, everywhere else rounds run out
  *  and the answer is the blade. Settlements refill, chests and kills top it up. */
 ammoMax:90, ammoPerKill:3, ammoChest:30, ammoRespawn:45,
});
export function rifleDistanceMultiplier(distance:number){
 if(!Number.isFinite(distance))return 0;
 const t=Math.max(0,Math.min(1,(distance-WORLD_RIFLE.fullDamageRange)/(WORLD_RIFLE.minimumDamageRange-WORLD_RIFLE.fullDamageRange)));
 return 1-t*(1-WORLD_RIFLE.minimumMultiplier);
}
