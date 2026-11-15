import {heroIcon} from './heroIcon.ts';
import {bilingual} from '../../../shared-client/i18n.ts';
import {CHARACTERS,ABILITIES,type Loadout} from '../../shared/content.ts';
import {displayWeaponName} from './loadout.ts';
export type LobbyPane='battlefield'|'heroes'|'equipment';
const $=(id:string)=>document.getElementById(id)!;
const roles:Record<number,[string,string]>={2:['前线反击','VANGUARD'],3:['烟幕突击','BREACHER'],4:['高速游击','DUELIST'],5:['火力压制','ARTILLERY'],6:['战线支援','SUPPORT'],7:['扇面压制','SUN COMMAND'],8:['区域控制','CONTROLLER']};
/** Changes presentation only. Existing map/hero/loadout stores remain authoritative. */
export function mountLobbyShell(){
  const tabs=[...document.querySelectorAll<HTMLButtonElement>('[data-pane]')];
  let current:LobbyPane='battlefield';
  const show=(pane:LobbyPane,focus=false)=>{current=pane;for(const tab of tabs){const active=tab.dataset.pane===pane;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(`pane-${tab.dataset.pane}`).hidden=!active;if(active&&focus)tab.focus();}document.querySelector('.lobby-main')!.scrollTop=0;document.querySelector('.arena-workspace')!.scrollTop=0;};
  for(const [i,tab] of tabs.entries()){
    tab.onclick=()=>show(tab.dataset.pane as LobbyPane);
    tab.onkeydown=event=>{let target:number|undefined;if(event.key==='ArrowRight')target=(i+1)%tabs.length;if(event.key==='ArrowLeft')target=(i+tabs.length-1)%tabs.length;if(event.key==='Home')target=0;if(event.key==='End')target=tabs.length-1;if(target!==undefined){event.preventDefault();show(tabs[target].dataset.pane as LobbyPane,true);}};
  }
  $('deployment-hero').onclick=()=>show('heroes',true);
  $('deployment-loadout').onclick=()=>show('equipment',true);
  // Avoid resetting tabs or any inputs on language changes.
  const language=()=>{document.querySelectorAll<HTMLElement>('[data-ui-zh][data-ui-en]').forEach(el=>el.textContent=bilingual(el.dataset.uiZh!,el.dataset.uiEn!));document.querySelector('.arena-nav')!.setAttribute('aria-label',bilingual('整备区域','Preparation areas'));document.querySelector('.tabs')!.setAttribute('aria-label',bilingual('游戏模式','Game mode'));$('settings-lobby').setAttribute('aria-label',bilingual('操作设置','Control settings'));$('loadout').setAttribute('aria-label',bilingual('出战配装','Loadout'));document.querySelector('.arena-brand')!.setAttribute('aria-label',bilingual('Parhelion 首页','Parhelion home'));document.querySelector('.lobby-side')!.setAttribute('aria-label',bilingual('出战准备','Deployment'));};
  language();show(current);
  return {show,language};
}
export function heroShell(char:number,loadout:Loadout){
  const hero=CHARACTERS[char],ability=ABILITIES[hero.ability],name=bilingual(hero.name.split(' · ')[0],hero.name.split(' · ')[1]??hero.name),color=`#${hero.color.toString(16).padStart(6,'0')}`;
  $('pane-heroes').style.setProperty('--hero-accent',color);$('deployment-hero').style.setProperty('--hero-accent',color);
  $('hero-name').textContent=name;$('hero-role').textContent=bilingual(...roles[char]);$('hero-fundamentals').textContent=bilingual(`${hero.hp} 生命 · ${hero.speed} m/s · ${ability.cooldown/60}s 技能冷却`,`${hero.hp} HP · ${hero.speed} m/s · ${ability.cooldown/60}s cooldown`);
  $('deploy-name').textContent=name;$('deploy-ability').textContent=bilingual(ability.name,ability.en);$('deployment-hero').querySelector('.deploy-glyph')!.innerHTML=heroIcon(char);
  $('deploy-loadout').textContent=loadout.map(id=>displayWeaponName(id)).join(' / ');
  $('deployment-hero').setAttribute('aria-label',bilingual(`更换从者：${name}`,`Change hero: ${name}`));$('deployment-loadout').setAttribute('aria-label',bilingual('修改当前配装','Edit loadout'));
}
export function modeShell(mode:'offline'|'online'|'range'){
  $('mode-badge').textContent=mode==='online'?bilingual('联机对局','ONLINE'):mode==='range'?bilingual('自由训练','PRACTICE'):bilingual('本地人机','LOCAL');
  for(const button of document.querySelectorAll<HTMLButtonElement>('.tab[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
}
