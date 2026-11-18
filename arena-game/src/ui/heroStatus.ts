import {abilityFor,CHARACTERS} from '../../shared/content.ts';
import {edictPlacement,quickAbilityPlacement,returnPathClear} from '../../shared/heroes.ts';
import type {ArenaMap} from '../../shared/map.ts';
import type {Snapshot} from '../../shared/match.ts';
import type {PlayerState} from '../../shared/sim.ts';
import {bilingual,getLanguage} from '../../../shared-client/i18n.ts';
export interface HeroReadout {text:string;tone:'ready'|'busy'|'blocked'|'cooldown';progress:number;returnAvailable:boolean}
export function heroReadout(map:ArenaMap|undefined,p:PlayerState,snap:Snapshot):HeroReadout{
  const a=p.ability,tick=Math.max(snap.tick,p.abilityTick),remaining=Math.max(0,a.readyAt-tick),kind=CHARACTERS[p.char].ability;
  const out:HeroReadout={text:'',tone:remaining?'cooldown':'ready',progress:0,returnAvailable:false};
  if(!p.alive){out.text=bilingual('冷却在复活期间继续','Cooldown continues while respawning');return out;}
  if(a.failureUntil>tick){out.text=a.failure.split(' / ')[getLanguage()==='en'?1:0]??a.failure;out.tone='blocked';return out;}
  if(a.phase!=='idle'){
    out.tone='busy';const seconds=Math.max(0,(a.endTick-tick)/60).toFixed(1);
    out.progress=Math.max(0,Math.min(1,(tick-a.startTick)/Math.max(1,a.endTick-a.startTick)));
    out.text=a.phase==='guard'?bilingual(`护势 ${Math.ceil(a.guardBudget)}/150 · ${seconds}s`,`Guard ${Math.ceil(a.guardBudget)}/150 · ${seconds}s`):a.phase==='channel'?bilingual(`引导 ${seconds}s · 受伤会打断`,`Channeling ${seconds}s · Damage interrupts`):a.phase==='return'?kind==='decoy'?bilingual('燕返突进 · 斩杀刷新冷却','Swallow cut · A kill resets it'):bilingual('正在回位','Returning'):a.phase==='windup'?bilingual(`施放 ${seconds}s`,`Casting ${seconds}s`):bilingual(`恢复 ${seconds}s`,`Recovering ${seconds}s`);
  }
  const anchor=snap.entities?.find(e=>e.owner===p.id&&e.kind==='anchor'&&e.lifeId===p.lifeId&&e.hp>0&&e.expires>tick);
  if(anchor&&a.phase==='idle'){
    out.returnAvailable=!!map&&returnPathClear(map,p,[anchor.x,anchor.y,anchor.z]);out.tone=out.returnAvailable?'ready':'blocked';
    const distance=Math.hypot(p.x-anchor.x,p.y-anchor.y,p.z-anchor.z).toFixed(1),left=((anchor.expires-tick)/60).toFixed(1);
    out.text=bilingual(`锚 ${left}s · ${distance}/5m · ${out.returnAvailable?'Q 回位':'同层无遮挡才能回位'}`,`Anchor ${left}s · ${distance}/5m · ${out.returnAvailable?'Q to return':'Needs a clear, level path'}`);return out;
  }
  const active=snap.entities?.find(e=>e.owner===p.id&&e.lifeId===p.lifeId&&e.kind===kind&&e.hp>0&&e.expires>tick);
  if(active&&a.phase==='idle'){
    const seconds=((active.expires-tick)/60).toFixed(1);
    if(kind==='curtain')out.text=active.victim?bilingual('钩中 · 正在拽回','Hooked · Dragging them in'):bilingual('钩索飞行中','Hook in flight');
    if(kind==='barrage')out.text=bilingual('炮弹飞行中','Cannonball in flight');
    if(kind==='lens'){out.tone='ready';out.text=bilingual(`日轮 ${seconds}s · Q 转向准星方向`,`Sun disc ${seconds}s · Q to redirect`);out.returnAvailable=true;}
    if(kind==='prayer')out.text=bilingual(`圣旗 ${Math.ceil(active.hp)}/100 · ${seconds}s · 光环内减伤与恢复`,`Banner ${Math.ceil(active.hp)}/100 · ${seconds}s · Protection and healing nearby`);
    if(kind==='edict')out.text=active.pulse===0?bilingual('御令落下中','Edict falling'):bilingual(`御令生效 · 被定住的敌人受到伤害 +25% · 区域内减速 35%`,`Edict landed · Rooted enemies take +25% damage · Zone slows by 35%`);
  }
  if((p.rootUntil??0)>tick){out.tone='blocked';out.text=bilingual(`被定身 ${((p.rootUntil-tick)/60).toFixed(1)}s · 仍可开枪`,`Rooted ${((p.rootUntil-tick)/60).toFixed(1)}s · You can still shoot`);}
  else if((p.pullT??0)>0){out.tone='blocked';out.text=bilingual('被钩索拽住','Caught by a hook');}
  if(!out.text&&map&&!remaining&&['barrier','lens','edict'].includes(kind)){
    const placement=kind==='edict'?edictPlacement(map,p,snap.players,snap.smokes??[]):quickAbilityPlacement(map,p,kind);if(placement.error){out.tone='blocked';out.text=placement.error.split(' / ')[getLanguage()==='en'?1:0]??placement.error;}
  }
  if(!out.text&&remaining)out.text=bilingual(`${abilityFor(p.char).name} · ${(remaining/60).toFixed(1)}s`,`${abilityFor(p.char).en} · ${(remaining/60).toFixed(1)}s`);
  return out;
}
