/** Cosmetic hip-fire presentation; ADS still aligns the original sight socket. */
export function firearmIdlePose(weapon:number,aspect=16/9){
 const compact=Math.max(0,Math.min(1,(1.4-aspect)/.6));
 const yaw=[.15,.13,.11,.17,.10][weapon]??.14;
 return{x:.13-.035*compact,y:weapon===3?-.145:-.15,z:(weapon===4?-.47:weapon===3?-.43:-.45)-.05*compact,yaw,roll:weapon===3?-.045:-.025};
}
