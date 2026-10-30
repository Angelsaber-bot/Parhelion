import type { SkillEvent } from './contractSkills';
import { CONTRACT_SKILLS } from './contractSkills';
import type { WorldActions } from './worldActions';
import { bilingual } from '../../shared-client/i18n';
/** Stable DOM nodes; changed strings only. Hidden while viewing maps or menus. */
export function createActionHud(label:(action:string)=>string){
 const banner=document.createElement('div');banner.id='world-ultimate-banner';banner.className='hud';banner.hidden=true;const bannerLabel=document.createElement('small'),bannerName=document.createElement('strong');banner.append(bannerLabel,bannerName);document.body.append(banner);let bannerUntil=0;
 const root=document.createElement('div');root.id='world-action-bar';root.className='hud';
 const rows=['melee','evade','skill','ultimate'].map(id=>{
   const row=document.createElement('div');row.className='world-action';
   const key=document.createElement('b'),name=document.createElement('span'),value=document.createElement('small');
   row.append(key,name,value);root.append(row);return{id,row,key,name,value};
 });
 const meter=document.createElement('div');meter.className='world-energy';
 const fill=document.createElement('div');fill.className='world-energy-fill';meter.append(fill);root.append(meter);document.body.append(root);
 const set=(el:HTMLElement,text:string)=>{if(el.textContent!==text)el.textContent=text;};
 return {root,announce(event:Extract<SkillEvent,{type:'cast'}>){if(event.slot!=='ultimate')return;const def=CONTRACT_SKILLS[event.identity??'player'].ultimate;bannerLabel.textContent=bilingual('契约共鸣','CONTRACT RESONANCE');bannerName.textContent=bilingual(def.name,def.nameEn);bannerUntil=performance.now()+1150;banner.hidden=false;},update(actions:WorldActions,visible:boolean){
   root.hidden=!visible;banner.hidden=!visible||performance.now()>bannerUntil;if(!visible)return;
   for(const item of rows){
    set(item.key,label(item.id));let text='',status='',cooldown=0;
    if(item.id==='skill'||item.id==='ultimate'){const def=actions.skills.definition(item.id);text=bilingual(def.name,def.nameEn);cooldown=actions.skills.cooldown(item.id);status=item.id==='ultimate'?`${Math.floor(actions.skills.energy)} / 100`:'';}
    else if(item.id==='melee'){text=bilingual('近战连击','Melee combo');status=!actions.meleeAvailable?bilingual('装备未就绪','Equipment not ready'):actions.melee.active?`${actions.melee.combo+1}/3`:'';}
    else{text=bilingual('闪避','Evade');cooldown=actions.evade.cooldown;}
    if((item.id==='skill'||item.id==='ultimate')&&!actions.equipmentReady)status=bilingual('先领取装备','Collect equipment');
    set(item.name,text);set(item.value,cooldown>.05?`${cooldown.toFixed(1)}s`:status||bilingual('就绪','Ready'));
    item.row.classList.toggle('cooling',cooldown>.05);
   }
   fill.style.width=`${Math.floor(actions.skills.energy)}%`;
   root.setAttribute('aria-label',bilingual('战斗技能与终结技能量','Combat abilities and ultimate energy'));
 },dispose(){root.remove();banner.remove();}};
}
