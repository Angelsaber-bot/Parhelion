import { bilingual } from '../../shared-client/i18n';
import type { Localized } from './settlements/types';
export interface TravelPanelEntry { id:string; name:Localized; discovered:boolean; blocked:Localized|null }
/** Separate pause modal: opening it releases pointer lock; closing never traps/relocks the cursor. */
export function createTravelPanel(options:{ entries():TravelPanelEntry[]; travel(id:string):boolean; onOpen():boolean|void; onClose?():void }){
 const root=document.createElement('section');root.id='world-travel-panel';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
 root.setAttribute('aria-labelledby','world-travel-title');
 const card=document.createElement('div');card.className='travel-card';const title=document.createElement('h2'),note=document.createElement('p'),list=document.createElement('div'),close=document.createElement('button');
 title.id='world-travel-title';close.type='button';card.append(title,note,list,close);root.append(card);document.body.append(root);
 const hide=()=>{root.hidden=true;options.onClose?.();};
 close.onclick=hide;root.addEventListener('click',e=>{e.stopPropagation();if(e.target===root)hide();});
 const key=(e:KeyboardEvent)=>{if(root.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();hide();}else if(e.key==='Tab'){const buttons=Array.from(card.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));if(!buttons.length)return;const current=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=e.shiftKey?(current<=0?buttons.length-1:current-1):(current+1)%buttons.length;e.preventDefault();buttons[next].focus();}else e.stopPropagation();};
 document.addEventListener('keydown',key,true);
 function render(){
  title.textContent=bilingual('已发现的安全据点','Discovered safe settlements');
  note.textContent=bilingual('亲自到访后登记。脱离战斗、落地并安静五秒后，可快速返回；不恢复生命或技能冷却。','Register a settlement by visiting it. Return after leaving combat and staying out of combat for five seconds and landing on safe ground. Travel does not restore health or ability cooldowns.');
  close.textContent=bilingual('返回','Back');list.replaceChildren();
  for(const entry of options.entries()){
   const button=document.createElement('button');button.type='button';button.className='travel-stop';
   const name=document.createElement('strong'),state=document.createElement('span');name.textContent=bilingual(...entry.name);state.textContent=entry.blocked?bilingual(...entry.blocked):bilingual('前往据点','Travel to settlement');button.append(name,state);button.disabled=!!entry.blocked;
   button.onclick=()=>{if(options.travel(entry.id))hide();else render();};list.append(button);
  }
 }
 return {get open(){return !root.hidden;},show(){if(options.onOpen()===false)return;render();root.hidden=false;close.focus();},hide,refresh(){if(!root.hidden)render();},dispose(){document.removeEventListener('keydown',key,true);root.remove();}};
}
