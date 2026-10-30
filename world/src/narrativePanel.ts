import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import type { Localized } from './settlements/types';
/** Read-at-your-own-pace dialogue: one small panel, no auto-expiring story paragraphs. */
export function createNarrativePanel(interactLabel:()=>string){
 const root=document.createElement('section');root.id='world-dialogue';root.className='hud';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Dialogue');
 const title=document.createElement('strong'),text=document.createElement('p'),hint=document.createElement('small');root.append(title,text,hint);document.body.append(root);
 let content:Localized|null=null,speaker:Localized=['交谈','Conversation'];
 const render=()=>{if(!content)return;root.setAttribute('aria-label',bilingual('对话','Dialogue'));title.textContent=bilingual(...speaker);text.textContent=bilingual(...content);hint.textContent=bilingual(`[${interactLabel()}] 继续 · Esc 返回菜单`,`[${interactLabel()}] Continue · Esc for menu`);};
 const unsubscribe=onLanguageChange(render);
 return{get open(){return !root.hidden;},show(line:Localized,name:Localized=['交谈','Conversation']){content=line;speaker=name;render();root.hidden=false;document.body.classList.add('world-dialogue-open');},hide(){root.hidden=true;content=null;document.body.classList.remove('world-dialogue-open');},dispose(){unsubscribe();root.remove();document.body.classList.remove('world-dialogue-open');}};
}
