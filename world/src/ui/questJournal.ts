import {bilingual,onLanguageChange} from '../../../shared-client/i18n';
import type {Localized} from '../settlements/types';
import {isExpansionRegion} from '../core/regionIdentity';
import {QUEST_REGION_NAMES,type QuestEntry,type QuestGuide,type QuestPoint} from '../story/questGuideCatalog';

export interface QuestJournalOptions {
 entries:()=>readonly QuestEntry[];
 pin:(id:string)=>boolean|void;
 restoreMain:()=>void;
 onOpen:()=>boolean|void;
 onClose:()=>void;
 currentRegion:()=>string;
 position:()=>QuestPoint;
 trackingBlocked?:(guide:QuestGuide)=>Localized|null;
 openChronicles?:()=>void;
}
/** A read-only task browser. Opening/filtering never selects a target or writes
 * progress. Physical interaction and combat remain exclusively runtime-owned. */
export function createQuestJournal(options:QuestJournalOptions){
 const root=document.createElement('section');root.id='world-quest-journal';root.hidden=true;
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','world-quest-journal-title');
 Object.assign(root.style,{position:'fixed',inset:'0',zIndex:'31',background:'#101b29ed',color:'#edf0ec',padding:'clamp(8px,3vw,28px)',boxSizing:'border-box',overflow:'auto',pointerEvents:'auto'});
 const card=document.createElement('div');Object.assign(card.style,{maxWidth:'820px',margin:'0 auto',minWidth:'0'});
 const title=document.createElement('h2');title.id='world-quest-journal-title';
 const intro=document.createElement('p'),toolbar=document.createElement('div'),filters=document.createElement('div'),list=document.createElement('div'),empty=document.createElement('p');
 const close=document.createElement('button'),main=document.createElement('button'),chronicles=document.createElement('button');
 const region=document.createElement('select'),category=document.createElement('select'),showDone=document.createElement('input'),doneLabel=document.createElement('label'),doneText=document.createElement('span');
 const search=document.createElement('input'),clear=document.createElement('button'),summary=document.createElement('p');
 search.type='search';search.id='world-quest-search';search.autocomplete='off';search.maxLength=160;
 search.style.cssText='flex:1 1 250px;min-width:0;min-height:40px;padding:8px 10px;box-sizing:border-box';
 clear.type='button';clear.dataset.questClear='';clear.style.cssText='padding:8px 12px;min-height:40px';
 summary.id='world-quest-results';summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');summary.setAttribute('aria-atomic','true');
 search.setAttribute('aria-controls','world-quest-list');list.id='world-quest-list';
 showDone.type='checkbox';doneLabel.append(showDone,doneText);filters.append(search,region,category,doneLabel,clear);
 for(const row of[toolbar,filters])Object.assign(row.style,{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center',marginBottom:'12px'});
 for(const b of[close,main,chronicles]){b.type='button';b.style.cssText='padding:8px 12px;min-height:40px';}
 toolbar.append(close,main);if(options.openChronicles)toolbar.append(chronicles);
 card.append(title,intro,toolbar,filters,summary,list,empty);root.append(card);document.body.append(root);
 let disposed=false,generation=0,returnFocus:HTMLElement|null=null;
 let regionFilter='all',categoryFilter='all';
 const current=(button:HTMLElement,version:number)=>!disposed&&!root.hidden&&generation===version&&button.isConnected&&root.contains(button);
 const focusable=(element:HTMLElement|null):element is HTMLElement=>{
  if(!element?.isConnected||element.closest('[hidden],[inert]')||element.matches(':disabled'))return false;
  if(!element.matches('button,input,select,textarea,a[href],[tabindex]'))return false;
  for(let node:HTMLElement|null=element;node;node=node.parentElement){const css=getComputedStyle(node);if(css.display==='none'||css.visibility==='hidden')return false;}
  return true;
 };
 const hide=()=>{
  if(disposed||root.hidden)return;
  const ownedFocus=root.contains(document.activeElement)||document.activeElement===document.body;
  root.hidden=true;generation++;options.onClose();
  const target=returnFocus;returnFocus=null;
  // A close hook can open another panel. Restore only focus this dialog still owns.
  const active=document.activeElement;
  if(ownedFocus&&(!active||active===document.body||root.contains(active))&&!document.querySelector('dialog[open]')&&focusable(target))target.focus();
 };
 const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().trim();
 const matches=(entry:QuestEntry,tokens:readonly string[])=>{
  const guide=entry.guide;
  // Both languages remain searchable when the player changes UI language.
  const text=normalize([...entry.title,...QUEST_REGION_NAMES[entry.region],...(guide?[...guide.text,...guide.targetLabel,...(guide.prerequisite??[])]:[]),...(entry.unavailable??[])].join(' '));
  return tokens.every(token=>text.includes(token));
 };
 const render=()=>{
  if(disposed)return;const version=++generation;
  const focused=document.activeElement as HTMLElement|null,focusId=!root.hidden&&focused&&root.contains(focused)?focused.dataset.questTrack:undefined;
  title.textContent=bilingual('任务指引','Quests');
  intro.textContent=bilingual('选择任务，追踪下一步。','Choose a quest to track its next step.');
  close.textContent=bilingual('返回','Back');main.textContent=bilingual('返回主线','Main story');chronicles.textContent=bilingual('可选调查与居民纪事','Optional investigations & chronicles');
  region.setAttribute('aria-label',bilingual('按地区筛选','Filter by region'));category.setAttribute('aria-label',bilingual('按任务类型筛选','Filter by quest type'));
  region.replaceChildren();const addOption=(select:HTMLSelectElement,value:string,label:Localized)=>{const option=document.createElement('option');option.value=value;option.textContent=bilingual(...label);select.append(option);};
  addOption(region,'all',['全部地区','All regions']);for(const[id,label]of Object.entries(QUEST_REGION_NAMES))addOption(region,id,label);region.value=regionFilter;
  category.replaceChildren();for(const[id,label]of Object.entries({all:['全部任务','All quests'],main:['主线','Main story'],side:['支线','Side quests'],discovery:['探索发现','Discoveries']}))addOption(category,id,label as Localized);category.value=categoryFilter;
  doneText.textContent=bilingual('显示已完成','Show completed');
  search.placeholder=bilingual('搜索任务、人物或地点…','Search quests, people or places…');search.setAttribute('aria-label',bilingual('搜索任务、人物或地点','Search quests, people or places'));
  clear.textContent=bilingual('清除筛选','Clear filters');
  const tokens=normalize(search.value).split(/\s+/).filter(Boolean),all=options.entries();
  list.replaceChildren();const entries=all.filter(entry=>(regionFilter==='all'||entry.region===regionFilter)&&(categoryFilter==='all'||entry.category===categoryFilter)&&(showDone.checked||!entry.complete||!!entry.trackWhenComplete)&&matches(entry,tokens));
  const completed=all.filter(entry=>entry.complete).length;
  summary.textContent=bilingual(`显示 ${entries.length} / ${all.length} 项任务 · 总计完成 ${completed} 项`,`Showing ${entries.length} / ${all.length} quests · ${completed} completed overall`);
  clear.disabled=regionFilter==='all'&&categoryFilter==='all'&&!showDone.checked&&!search.value;
  empty.hidden=entries.length>0;empty.textContent=tokens.length?bilingual('没有匹配的任务。试试任务名、人物或地点，或清除筛选查看所有地区。','No matching quests. Try a quest, person or place name, or clear filters to search all regions.'):bilingual('此筛选下没有未完成任务。可换地区、类型，或显示已完成。','No unfinished quests match these filters. Change the region/type or show completed quests.');
  const position=options.position(),here=options.currentRegion();
  for(const entry of entries){
   const article=document.createElement('article');article.dataset.questId=entry.id;article.style.cssText='border:1px solid #718191;padding:12px;margin:10px 0;border-radius:8px;overflow-wrap:anywhere';
   const heading=document.createElement('h3'),status=document.createElement('p'),text=document.createElement('p'),track=document.createElement('button');
   heading.textContent=bilingual(...entry.title);status.textContent=`${bilingual(...QUEST_REGION_NAMES[entry.region])} · ${entry.complete?bilingual('已完成','Complete'):bilingual('进行中','In progress')}`;
   track.type='button';track.dataset.questTrack=entry.id;track.style.cssText='padding:8px 12px;min-height:40px';
   const guide=entry.guide,blocked=guide?options.trackingBlocked?.(guide):null;
   text.textContent=guide?bilingual(...guide.text):entry.complete?bilingual('完成记录已保留。','Your completion record is retained.'):bilingual(...(entry.unavailable??['暂不可追踪','Currently unavailable']));
   article.append(heading,status,text);
   if(guide){
    const target=document.createElement('p');target.className='quest-target';
    const distance=Math.round(Math.hypot(position[0]-guide.position[0],position[1]-guide.position[1],position[2]-guide.position[2]));
    const remote=isExpansionRegion(guide.region)?[' · 沿大世界道路前往',' · Follow world roads']:[' · 需跨年代通路',' · Era passage required'];
    target.textContent=bilingual(`目标：${guide.targetLabel[0]} · ${QUEST_REGION_NAMES[guide.region][0]}${here===guide.region?` · 直线约 ${distance} 米`:remote[0]}`,`Target: ${guide.targetLabel[1]} · ${QUEST_REGION_NAMES[guide.region][1]}${here===guide.region?` · about ${distance} m straight-line`:remote[1]}`);article.append(target);
    if(guide.prerequisite){const note=document.createElement('p');note.textContent=bilingual(...guide.prerequisite);article.append(note);}
    if(blocked){const note=document.createElement('p');note.textContent=bilingual(...blocked);article.append(note);}
   }
   track.disabled=(entry.complete&&!entry.trackWhenComplete)||!guide||!!blocked;track.textContent=blocked?bilingual('先完成通路前置','Complete passage prerequisites first'):entry.trackLabel?bilingual(...entry.trackLabel):entry.complete?bilingual('已完成','Complete'):bilingual('追踪下一步','Track next step');
   track.onclick=()=>{if(!current(track,version))return;const latest=options.entries().find(item=>item.id===entry.id);if(!latest?.guide||(latest.complete&&!latest.trackWhenComplete)||options.trackingBlocked?.(latest.guide))return;if(options.pin(entry.id)!==false)hide();};
   article.append(track);list.append(article);
  }
  if(focusId){const next=[...list.querySelectorAll<HTMLButtonElement>('[data-quest-track]')].find(button=>button.dataset.questTrack===focusId&&!button.disabled);(next??close).focus();}
 };
 close.onclick=hide;main.onclick=()=>{if(disposed||root.hidden)return;options.restoreMain();hide();};
 chronicles.onclick=()=>{if(disposed||root.hidden)return;hide();options.openChronicles?.();};
 search.oninput=()=>{if(!disposed)render();};clear.onclick=()=>{if(disposed||root.hidden)return;regionFilter='all';categoryFilter='all';showDone.checked=false;search.value='';render();search.focus();};
 region.onchange=()=>{regionFilter=region.value;render();};category.onchange=()=>{categoryFilter=category.value;render();};showDone.onchange=render;
 const key=(event:KeyboardEvent)=>{
  if(disposed||root.hidden)return;
  if(event.isComposing){event.stopPropagation();return;}
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();hide();return;}
  if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   const controls=[...root.querySelectorAll<HTMLElement>('button,select,input')].filter(el=>!(el as HTMLButtonElement).disabled&&!el.closest('[hidden]'));
   const index=controls.indexOf(document.activeElement as HTMLElement),next=event.shiftKey?(index<=0?controls.length-1:index-1):(index<0||index===controls.length-1?0:index+1);
   event.preventDefault();event.stopPropagation();controls[next]?.focus();
  }else if(!event.ctrlKey&&!event.metaKey&&!event.altKey)event.stopPropagation();
 };
 document.addEventListener('keydown',key,true);const unsubscribe=onLanguageChange(render);
 return{get open(){return !disposed&&!root.hidden;},show(){if(disposed||!root.hidden)return;const opener=document.activeElement as HTMLElement|null;if(options.onOpen()===false)return;returnFocus=opener;regionFilter=options.currentRegion();if(!(regionFilter in QUEST_REGION_NAMES))regionFilter='all';render();root.hidden=false;close.focus();},hide,refresh(){if(!root.hidden)render();},dispose(){if(disposed)return;hide();disposed=true;generation++;unsubscribe();document.removeEventListener('keydown',key,true);root.remove();}};
}
