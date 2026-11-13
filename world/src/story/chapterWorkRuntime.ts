import type { Localized } from '../settlements/types';
import type { StoryEncounterSpec } from './storyEncounters';
export interface ChapterWorkAction{ id:string;label:Localized;line:Localized;kind?:'fight'|'shot'; }
export interface ChapterWorkHooks{
 done:Set<string>;actions:ReadonlyMap<string,ChapterWorkAction>;ready(id:string,d:ReadonlySet<string>):boolean;
 commit(id:string,d:Set<string>):boolean;save():boolean;changed():void;toast(line:Localized):void;
 reachable(id:string):boolean;position(id:string):[number,number,number]|undefined;
 start(spec:StoryEncounterSpec):boolean;
}
/** Shared admission/persistence only. Every region owns its actual state rules. */
export function createChapterWorkRuntime(h:ChapterWorkHooks){
 let pending:string|null=null;
 function finish(id:string){
  const before=new Set(h.done);if(!h.commit(id,h.done))return false;
  if(!h.save()){h.done.clear();before.forEach(f=>h.done.add(f));h.toast(['保存失败，现场状态尚未提交。','Save failed. The field state has not been committed.']);return false;}
  h.changed();h.toast(h.actions.get(id)!.line);return true;
 }
 return{
  interact(id:string){
   const a=h.actions.get(id);if(!a||!h.reachable(id))return false;
   if(!h.ready(id,h.done))return true;
   if(a.kind==='fight'){
    const p=h.position(id);if(!p)return true;
    const spec:StoryEncounterSpec={id:`chapter_${id}`,anchor:{x:p[0],y:p[1]-.9,z:p[2]},actors:[{role:'shieldbearer',offset:[-4,6],title:a.label},{role:'lancer',offset:[4,6]}]};
    if(h.start(spec))pending=spec.id;else h.toast(['现场仍有战斗或落点受阻，请清出空间后重试。','Another fight is active or the landing is blocked. Clear space and retry.']);
   }else finish(id);return true;
  },
  hit(id:string){const a=h.actions.get(id);if(a?.kind!=='shot')return false;if(h.ready(id,h.done))finish(id);return true;},
  victory(id:string){if(!id.startsWith('chapter_')||!h.actions.has(id.slice(8)))return false;if(pending!==id)return true;pending=null;finish(id.slice(8));return true;},
  reset(){pending=null;},
 };
}
