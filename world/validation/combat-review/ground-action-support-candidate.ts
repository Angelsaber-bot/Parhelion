/** ISOLATED comparison, not production: reuse the accepted geometric support
 * predicate either only during admitted ground actions or (contrast only) all
 * prior-grounded walking. Never changes action admission/cost/clocks directly. */
import {EvadeGroundSupport} from '../../src/evadeGroundSupport';
export function installGroundActionSupportCandidate(player:any,active:()=>boolean,mode:'actions'|'general'){
 const support=new EvadeGroundSupport(),originalStep=player.step,originalCollide=player.collide,stepDescriptor=Object.getOwnPropertyDescriptor(player,'step'),collideDescriptor=Object.getOwnPropertyDescriptor(player,'collide');let eligible=false,disposed=false;
 const solve=()=>originalCollide.call(player);
 player.step=function(dt:number,input:any){eligible=Number.isFinite(dt)&&dt>0&&dt<=.1&&this.onGround&&!input.jump&&!this.flying&&!input.evade&&(mode==='general'||active());try{return originalStep.call(this,dt,input);}finally{eligible=false;}};
 player.collide=function(){originalCollide.call(this);if(eligible&&!this.onGround)support.tryRecover(this,this.colliders,solve);};
 return{get diagnostics(){return support.diagnostics;},dispose(){if(disposed)return;disposed=true;if(stepDescriptor)Object.defineProperty(player,'step',stepDescriptor);else delete player.step;if(collideDescriptor)Object.defineProperty(player,'collide',collideDescriptor);else delete player.collide;}};
}
