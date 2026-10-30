import type { SkillEvent } from './contractSkills';
import { CONTRACT_SKILLS } from './contractSkills';
import type { WorldActions } from './worldActions';
import { bilingual } from '../../shared-client/i18n';

type ActionId = 'melee' | 'evade' | 'skill' | 'ultimate';
/** UI reads live action clocks and restrictions. It never starts, queues or refunds an action. */
export function actionPresentation(actions: WorldActions, id: ActionId) {
 const context = actions.actionContext;
 let name = '', status = '', cooldown = 0, available = true, chaining = false;
 if (id === 'melee') {
  name = bilingual('近战连击', 'Melee combo'); cooldown = actions.melee.cooldown;
  if (actions.melee.active) {
   chaining = actions.melee.comboWindowOpen;
   status = actions.melee.nextCutQueued ? bilingual('已衔接下一斩', 'Next cut queued')
    : chaining ? bilingual('再按一次衔接', 'Press again to chain')
    : actions.melee.combo === 2 ? bilingual('终结斩', 'Finishing cut')
    : bilingual(`${actions.melee.combo + 1}/3 · 出刀`, `${actions.melee.combo + 1}/3 · striking`);
   available = chaining;
  }
  if (!context.bladeReady) { available = false; status = context.bladeFailed ? bilingual('模型加载失败', 'Model failed to load') : bilingual('武器加载中', 'Weapon loading'); }
  if (actions.skills.casting || actions.evade.active) { available = false; status = bilingual('动作进行中', 'Action in progress'); }
 } else if (id === 'evade') {
  name = bilingual('闪避', 'Evade'); cooldown = actions.evade.cooldown;
  if (actions.evade.active) { available = false; status = bilingual('闪避中', 'Evading'); }
  if (actions.skills.casting && actions.skills.selected === null) { available = false; status = bilingual('施放中', 'Casting'); }
 } else {
  const definition = actions.skills.definition(id); name = bilingual(definition.name, definition.nameEn); cooldown = actions.skills.cooldown(id);
  if (actions.skills.casting || actions.melee.active || actions.evade.active) { available = false; status = bilingual('动作进行中', 'Action in progress'); }
  else if (id === 'ultimate' && actions.skills.energy < 100) { available = false; status = bilingual(`能量 ${Math.floor(actions.skills.energy)}/100`, `Energy ${Math.floor(actions.skills.energy)}/100`); }
 }
 if (cooldown > .001) { available = false; if (!status) status = `${(Math.ceil(cooldown * 10) / 10).toFixed(1)}s`; }
 if (id !== 'evade' && !context.armed) { available = false; status = bilingual('先领取装备', 'Collect equipment'); }
 if (!context.enabled || !context.grounded) { available = false; chaining = false; status = !context.grounded ? bilingual('落地后可用', 'Land to use') : bilingual('当前不可用', 'Unavailable now'); }
 return { name, status: status || bilingual('就绪', 'Ready'), cooldown, available, chaining };
}
/** Stable DOM nodes; no flashing animation or per-frame DOM allocation. */
export function createActionHud(label:(action:string)=>string){
 const banner=document.createElement('div');banner.id='world-ultimate-banner';banner.className='hud';banner.hidden=true;const bannerLabel=document.createElement('small'),bannerName=document.createElement('strong');banner.append(bannerLabel,bannerName);document.body.append(banner);let bannerUntil=0;
 const root=document.createElement('div');root.id='world-action-bar';root.className='hud';
 const rows=(['melee','evade','skill','ultimate'] as const).map(id=>{
  const row=document.createElement('div');row.className='world-action';row.dataset.action=id;
  const key=document.createElement('b'),name=document.createElement('span'),value=document.createElement('small');row.append(key,name,value);root.append(row);return{id,row,key,name,value};
 });
 const meter=document.createElement('div');meter.className='world-energy';meter.setAttribute('role','progressbar');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');
 const fill=document.createElement('div');fill.className='world-energy-fill';meter.append(fill);root.append(meter);document.body.append(root);
 const set=(el:HTMLElement,text:string)=>{if(el.textContent!==text)el.textContent=text;};
 return {root,announce(event:Extract<SkillEvent,{type:'cast'}>){if(event.slot!=='ultimate')return;const def=CONTRACT_SKILLS[event.identity??'player'].ultimate;bannerLabel.textContent=bilingual('契约共鸣','CONTRACT RESONANCE');bannerName.textContent=bilingual(def.name,def.nameEn);bannerUntil=performance.now()+1150;banner.hidden=false;},update(actions:WorldActions,visible:boolean){
  root.hidden=!visible;banner.hidden=!visible||performance.now()>bannerUntil;if(!visible)return;
  for(const item of rows){
   const state=actionPresentation(actions,item.id);set(item.key,label(item.id));set(item.name,state.name);set(item.value,state.status);
   item.row.classList.toggle('cooling',state.cooldown>.001);item.row.classList.toggle('unavailable',!state.available);item.row.classList.toggle('chain-open',state.chaining);item.row.classList.toggle('action-ready',state.available);
  }
  const energy=Math.min(100,Math.max(0,Math.floor(actions.skills.energy)));
  fill.style.width=`${energy}%`;meter.setAttribute('aria-valuenow',String(energy));meter.setAttribute('aria-label',bilingual('终结技能量','Ultimate energy'));
  meter.classList.toggle('energy-full',energy===100);
  root.setAttribute('aria-label',bilingual('战斗技能与终结技能量','Combat abilities and ultimate energy'));
 },dispose(){root.remove();banner.remove();}};
}
