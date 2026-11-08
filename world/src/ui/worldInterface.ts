import {bilingual,onLanguageChange} from '../../../shared-client/i18n';

interface InterfaceOptions {
 start:HTMLElement;
 label(action:string):string;
 subscribe(listener:()=>void):()=>unknown;
}
/** Presentation only. Existing buttons retain their handlers and save semantics. */
export function installWorldInterface(options:InterfaceOptions){
 const {start}=options;
 const panel=document.createElement('section');panel.className='world-menu';panel.setAttribute('aria-label',bilingual('游戏菜单','Game menu'));
 const brand=document.createElement('header');brand.className='world-menu-brand';
 const title=start.querySelector('h1')!,edition=start.querySelector('p:not(#loading)')!;
 brand.append(edition,title);
 const loading=document.getElementById('loading')!;loading.setAttribute('role','status');
 const enter=document.createElement('button');enter.id='world-enter';enter.type='button';enter.className='world-menu-primary';enter.disabled=true;
 // Native button clicks bubble to the existing start listener; keyboard and audio
 // activation retain the original trusted event rather than a synthetic click.
 const navigation=document.createElement('nav');navigation.className='world-menu-navigation';
 const get=(id:string)=>document.getElementById(id)!;
 const more=get('world-more-journey');
 const dragEntry=get('world-drag-controls');
 navigation.append(get('world-quest-journal-open'),get('world-travel-open'),get('settings-open'));
 more.append(get('world-adventure-continue'),get('servant-open'));
 const coopOpen=document.getElementById('world-coop-open');const summary=more.querySelector('summary');if(coopOpen){if(summary)summary.after(coopOpen);else more.prepend(coopOpen);}
 const locale=document.querySelector<HTMLElement>('body > .parhelion-language');
 const bottom=document.createElement('div');bottom.className='world-menu-bottom';if(locale)bottom.append(locale);
 const footer=document.createElement('div');footer.id='world-shortcuts';footer.className='hud';
 panel.append(brand,loading,enter,dragEntry,navigation,more,bottom);start.append(panel);document.body.append(footer);
 const iconPaths:Record<string,string>={
  melee:'M5 4l13 13m-1-13L6 17M4 15l5 5m6-5l5 5M5 4l4 1-3 3M17 4l-4 1 3 3',
  evade:'M5 8h10m-4-4 4 4-4 4M19 16H9m4-4-4 4 4 4',
  skill:'M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M5.6 18.4l2.8-2.8m7.2-7.2 2.8-2.8M12 8l4 4-4 4-4-4z',
  ultimate:'M12 2l8 10-8 10L4 12zM12 7l4 5-4 5-4-5z',
 };
 const icons:Element[]=[];
 for(const row of document.querySelectorAll<HTMLElement>('#world-action-bar [data-action]')){
  const path=iconPaths[row.dataset.action??''];if(!path)continue;
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),shape=document.createElementNS('http://www.w3.org/2000/svg','path');
  icon.classList.add('world-action-icon');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');shape.setAttribute('d',path);shape.setAttribute('fill','none');shape.setAttribute('stroke','currentColor');shape.setAttribute('stroke-width','1.5');shape.setAttribute('stroke-linecap','round');shape.setAttribute('stroke-linejoin','round');icon.append(shape);row.prepend(icon);icons.push(icon);
 }
 document.body.classList.add('world-interface');
 document.body.classList.toggle('world-debug',new URLSearchParams(location.search).has('stats'));
 let disposed=false;
 const render=()=>{
  if(disposed)return;
  enter.textContent=bilingual('进入世界','Enter world');
  panel.setAttribute('aria-label',bilingual('游戏菜单','Game menu'));
  navigation.setAttribute('aria-label',bilingual('旅途菜单','Journey menu'));
  const labels:Record<string,[string,string]>={
   'world-quest-journal-open':['任务指引','Quests'],
   'world-travel-open':['据点旅行','Travel'],
   'settings-open':['设置','Settings'],
   'world-adventure-continue':['主线 · 人物篇','Story · Character chapters'],
   'world-arena-training-open':['竞技训练','Arena practice'],
   'world-campaign-journal-open':['居民纪事与续篇','Chronicles & continuation'],
   'world-compact-relay-track':['突破演练','Breach exercise'],
  };
  for(const[id,label]of Object.entries(labels)){const button=document.getElementById(id);if(button)button.textContent=bilingual(...label);}
  more.querySelector('summary')!.textContent=bilingual('更多','More');
  const hints:[string,string][]=[['map',bilingual('地图','Map')],['help',bilingual('操作','Controls')],['settings',bilingual('设置','Settings')]];
  footer.replaceChildren(...hints.map(([action,name])=>{const item=document.createElement('span'),key=document.createElement('kbd');key.textContent=options.label(action);item.append(key,` ${name}`);return item;}));
 };
 render();const localeOff=onLanguageChange(render),settingsOff=options.subscribe(render);
 return{
  ready(){enter.disabled=false;},
  dispose(){if(disposed)return;disposed=true;localeOff();settingsOff();footer.remove();enter.remove();panel.replaceWith(...panel.childNodes);icons.forEach(icon=>icon.remove());document.body.classList.remove('world-interface','world-debug');},
 };
}
