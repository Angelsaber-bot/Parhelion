import type {NetEvent,Snapshot} from '../../shared/match.ts';
import type {PlayerState} from '../../shared/sim.ts';
import {bilingual} from '../../../shared-client/i18n.ts';
/** Optional three-interaction lesson, derived only from real accepted casts and combat events. */
export class HeroLesson {
  private stage=0;
  private root=document.createElement('div');
  private opponents=new Set<string>();
  constructor(private id:string){this.root.id='hero-lesson';document.getElementById('hud')!.append(this.root);}
  event(e:NetEvent){
    if(this.stage===0&&e.t==='ability'&&e.id===this.id&&e.action==='accepted')this.stage=1;
    else if(this.stage===1&&e.t==='ability'&&this.opponents.has(e.id)&&['pulse','trigger','break','heal'].includes(e.action))this.stage=2;
    else if(this.stage===2&&e.t==='ability'&&e.id===this.id&&e.action==='accepted'&&Math.abs(e.at[0])<10&&Math.abs(e.at[2])<10)this.stage=3;
  }
  update(s:Snapshot,p:PlayerState|null){
    for(const actor of s.players)if(actor.team!==p?.team)this.opponents.add(actor.id);
    const lines=[bilingual('① 施放一次角色技能，观察它的作用。','① Cast your hero ability and observe the effect.'),bilingual('② 看清对手的技能：地上的预警圈、飞来的炮弹和钩索都能躲开。','② Read the opponent’s ability: warning circles, cannonballs and hooks can all be dodged.'),bilingual('③ 到公共穿堂附近，在真实交战中再使用一次技能。','③ Approach the central passage and use your ability in combat.'),bilingual('✓ 三项互动完成。继续对局，练习换线与技能时机。','✓ Lesson complete. Continue playing to practice routes and timing.')];
    this.root.textContent=lines[this.stage];
  }
  dispose(){this.root.remove();}
}
