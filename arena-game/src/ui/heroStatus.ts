import {abilityFor,CHARACTERS} from '../../shared/content.ts';
import {quickAbilityPlacement,returnPathClear} from '../../shared/heroes.ts';
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
    out.text=a.phase==='guard'?bilingual(`护势 ${Math.ceil(a.guardBudget)}/150 · ${seconds}s`,`Guard ${Math.ceil(a.guardBudget)}/150 · ${seconds}s`):a.phase==='channel'?bilingual(`引导 ${seconds}s · 受伤会打断`,`Channeling ${seconds}s · Damage interrupts`):a.phase==='return'?kind==='decoy'?bilingual('错身突进 · 可受伤','Sidestepping · Vulnerable'):bilingual('正在回位','Returning'):a.phase==='windup'?bilingual(`施放 ${seconds}s`,`Casting ${seconds}s`):bilingual(`恢复 ${seconds}s`,`Recovering ${seconds}s`);
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
    if(kind==='curtain')out.text=active.pulse===0?bilingual('舰炮已锁定 · 自动齐射','Broadside committed · Firing automatically'):bilingual(`黑帆烟墙 ${seconds}s · 继续射击或换线`,`Black sail ${seconds}s · Keep firing or reposition`);
    if(kind==='lens'){out.tone='ready';out.text=bilingual(`日轮 ${seconds}s · Q 转向准星方向`,`Sun disc ${seconds}s · Q to redirect`);out.returnAvailable=true;}
    if(kind==='prayer')out.text=bilingual(`圣旗 ${Math.ceil(active.hp)}/100 · ${seconds}s · 光环内减伤与恢复`,`Banner ${Math.ceil(active.hp)}/100 · ${seconds}s · Protection and healing nearby`);
    if(kind==='edict')out.text=bilingual(`疆域 ${seconds}s · 敌人不能发起冲刺`,`Domain ${seconds}s · Enemies cannot start a dash`);
  }
  if(p.dashSealedUntil>tick){out.tone='blocked';out.text=bilingual('身处敌方疆域 · 冲刺受限，离开光圈或击碎玉印','Enemy domain · Dash sealed; leave the circle or destroy a seal');}
  if(!out.text&&map&&!remaining&&['barrier','curtain','barrage','lens','edict'].includes(kind)){
    const placement=quickAbilityPlacement(map,p,kind);if(placement.error){out.tone='blocked';out.text=placement.error.split(' / ')[getLanguage()==='en'?1:0]??placement.error;}
  }
  if(!out.text&&remaining)out.text=bilingual(`${abilityFor(p.char).name} · ${(remaining/60).toFixed(1)}s`,`${abilityFor(p.char).en} · ${(remaining/60).toFixed(1)}s`);
  return out;
}
