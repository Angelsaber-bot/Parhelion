import { arenaTrainingBriefing, ARENA_TRAINING_HREF } from './arenaTrainingBridge';
import { bilingual, onLanguageChange } from '../../shared-client/i18n';
export interface ArenaTrainingPanelOptions {
  worldKey(action: string): string;
  arenaKey(action: string): string;
  canOpen(): boolean;
  beforeLeave(): boolean;
}
/** Explicit user navigation only. Never imports World stats into Arena. */
export function createArenaTrainingPanel(options: ArenaTrainingPanelOptions) {
  const root = document.createElement('dialog'); root.id = 'world-arena-training';
  Object.assign(root.style, { maxWidth:'640px', width:'min(90vw,640px)', maxHeight:'85vh', overflow:'auto', border:'1px solid #8194a2', borderRadius:'10px', padding:'22px', background:'#182a36', color:'#edf4f7' });
  let disposed=false, previous:HTMLElement|null=null;
  const title=document.createElement('h2'),intro=document.createElement('p'),rows=document.createElement('div'),practice=document.createElement('ol'),warning=document.createElement('p'),fairness=document.createElement('p'),status=document.createElement('p'),links=document.createElement('div'),close=document.createElement('button');
  title.id='world-arena-training-title';root.setAttribute('aria-labelledby',title.id);
  status.setAttribute('role','status');warning.style.color='#ffd69e';
  const launch=document.createElement('a');launch.href=ARENA_TRAINING_HREF;launch.target='_blank';launch.rel='noopener noreferrer';launch.id='arena-training-new-tab';
  const fallback=document.createElement('a');fallback.href=ARENA_TRAINING_HREF;fallback.id='arena-training-same-tab';fallback.style.display='block';fallback.style.marginTop='14px';
  const explanation=document.createElement('p');
  links.append(launch,explanation,fallback);root.append(title,intro,rows,practice,warning,fairness,status,links,close);document.body.append(root);
  function render(){
    const info=arenaTrainingBriefing(options.worldKey,options.arenaKey);
    title.textContent=bilingual(...info.title);intro.textContent=bilingual(...info.introduction);
    rows.replaceChildren(...info.rows.map(row=>{const p=document.createElement('p');p.textContent=`${bilingual(...row.title)} — World: ${bilingual(...row.world)} / Arena: ${bilingual(...row.arena)}`;return p;}));
    practice.replaceChildren(...info.practice.map(line=>{const li=document.createElement('li');li.textContent=bilingual(...line);return li;}));
    warning.textContent=bilingual(...info.warning);fairness.textContent=bilingual(...info.fairness);
    launch.textContent=bilingual('保存世界进度，在新标签打开 Arena 离线大厅','Save World progress and open the Arena offline lobby in a new tab');
    explanation.textContent=bilingual('到大厅后自行点开始。保留这张世界标签，练习后切回来；若新标签被阻止，可使用下方本页入口。','Choose Start in the lobby. Keep this World tab and switch back after practice. If a new tab is blocked, use the same-tab link below.');
    fallback.textContent=bilingual('备用：保存后在本页打开（世界现场将退出）','Fallback: save and open here (leave this World session)');
    close.textContent=bilingual('返回世界','Return to World');
  }
  function admit(event:MouseEvent){
    if(disposed||!root.open||!options.beforeLeave()){event.preventDefault();status.textContent=bilingual('当前进度未能保存或世界已经停止，未离开。请在设置中重试保存或导出备份。','Progress could not be saved or World has stopped. You have not left. Retry saving or export a backup in Settings.');return;}
    status.textContent=event.currentTarget===fallback?bilingual('进度已保存，正在离开本次世界现场。','Progress saved; leaving this World session.'):bilingual('进度已保存。两种模式保持各自规则；世界现场留在此页。','Progress saved. Each mode keeps its own rules; World remains in this tab.');
  }
  launch.addEventListener('click',admit);fallback.addEventListener('click',admit);
  close.onclick=()=>root.close();root.addEventListener('close',()=>{if(previous?.isConnected)previous.focus();});
  const unsubscribe=onLanguageChange(()=>{if(root.open)render();});
  return{root,get open(){return root.open;},show(){if(disposed||!options.canOpen())return false;previous=document.activeElement instanceof HTMLElement?document.activeElement:null;status.textContent='';render();root.showModal();close.focus();return true;},hide(){if(root.open)root.close();},dispose(){if(disposed)return;disposed=true;unsubscribe();root.close();root.remove();}};
}
