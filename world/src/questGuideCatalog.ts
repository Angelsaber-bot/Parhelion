import type {Layout,Marker} from './types';
import type {Localized,RegionId} from './settlements/types';
import {TEXT_PAIRS} from '../../shared-client/locales';
import {regionAt} from './regions';
import {ERA_IDS,ERA_STORIES,ERA_OPTIONALS,ERA_KNIGHT_DEFEATED,getEraStoryGuide,getEraBossRequirements,isEraCoreCleared} from './eraStories';
import {getValleyStoryGuide,VALLEY_STORY} from './valleyStory';
import {getCampaignClosureState,CAMPAIGN_CLOSURE} from './campaignClosure';

export type QuestCategory='main'|'side'|'discovery';
export type QuestPoint=[number,number,number];
export interface QuestGuide {
 title:Localized; text:Localized; targetId:string; targetKind:'marker'|'npc'|'enemy';
 region:RegionId; position:QuestPoint; targetLabel:Localized; prerequisite?:Localized;
}
export interface QuestEntry {
 id:string; region:RegionId; category:QuestCategory; title:Localized;
 complete:boolean; guide:QuestGuide|null; unavailable?:Localized;
}
export interface QuestGuideContext { mounted?:boolean; }
export interface QuestCatalogInput {
 markers:readonly Marker[];
 objectives:readonly {region:string;objective:Layout['objective']}[];
 npcs:readonly {id:string;region:RegionId;position:QuestPoint;label?:Localized}[];
 enemies?:readonly {id:string;region:RegionId;position:QuestPoint;label:Localized}[];
}
const translations=new Map<string,string>(TEXT_PAIRS);
const pair=(text:string):Localized=>{
 const numbered=/^(.*?)( \d+)$/.exec(text);
 return[text,translations.get(text)??(numbered&&translations.has(numbered[1])?translations.get(numbered[1])!+numbered[2]:text)];
};
const specialLabels=new Map<string,Localized>([
 [VALLEY_STORY.npc,['驻地记录员','Residence Archivist']],
 [VALLEY_STORY.discovery,['检修侧门手动锁扣','Maintenance side-door latch']],
 ...ERA_IDS.map(region=>[ERA_OPTIONALS[region].id,ERA_OPTIONALS[region].label] as [string,Localized]),
]);
const REGIONS:readonly RegionId[]=['alpha','britain','blacksail','winter','kyoto'];
export const QUEST_REGION_NAMES:Record<RegionId,Localized>={alpha:['幻日谷','Parhelion Valley'],britain:['落日王国','Sunset Kingdom'],blacksail:['黑帆尽头','Black Sail’s End'],winter:['永冬之城','Winter City'],kyoto:['业火京都','Kyoto Ablaze']};
const OPTIONAL_CHAINS:readonly {id:string;region:RegionId;title:Localized;flags:readonly string[]}[]=[
 {id:'oath-camp',region:'britain',title:['可选 · 誓约营地碎片','Optional · Oath camp fragment'],flags:['camp_dummy_1','camp_dummy_2','camp_dummy_3','shard_camp']},
 {id:'oath-tower',region:'britain',title:['可选 · 王座碎片','Optional · Throne fragment'],flags:['shard_tower']},
 {id:'oath-table',region:'britain',title:['可选 · 圆桌三盏火与碎片','Optional · Three hearths and the Round Table fragment'],flags:['hall_brazier_1','hall_brazier_2','hall_brazier_3','shard_table']},
 {id:'sea-powder',region:'blacksail',title:['可选 · 火药碎片','Optional · Powder fragment'],flags:['shard_powder']},
 {id:'sea-compass',region:'blacksail',title:['可选 · 罗盘碎片','Optional · Compass fragment'],flags:['shard_compass']},
 {id:'sea-treasure',region:'blacksail',title:['可选 · 三张藏宝图与宝藏','Optional · Three map pieces and the treasure'],flags:['map_piece_1','map_piece_2','map_piece_3','shard_treasure']},
 {id:'winter-eagle',region:'winter',title:['可选 · 鹰旗碎片','Optional · Eagle fragment'],flags:['shard_eagle']},
 {id:'winter-bell',region:'winter',title:['可选 · 钟声碎片','Optional · Bell fragment'],flags:['shard_bell']},
 {id:'winter-frost',region:'winter',title:['可选 · 霜封与霜晶碎片','Optional · Frost seals and crystal fragment'],flags:['frost_seal_1','frost_seal_2','frost_seal_3','shard_frost']},
 {id:'kyoto-gold',region:'kyoto',title:['可选 · 金阁碎片','Optional · Golden Pavilion fragment'],flags:['shard_kinkaku']},
 {id:'kyoto-stage',region:'kyoto',title:['可选 · 清水舞台碎片','Optional · Kiyomizu stage fragment'],flags:['shard_kiyomizu']},
 {id:'kyoto-banner',region:'kyoto',title:['可选 · 桔梗碎片','Optional · Bellflower fragment'],flags:['shard_kikyo']},
];
const unavailable:Localized=['目标暂不可定位；任务记录未改变。','Target is currently unavailable; no quest progress has changed.'];
/** Read-only projection of real saved facts. It never starts combat, grants travel,
 * claims proximity completion, or revives obsolete shard prerequisites. */
export function createQuestGuideCatalog(input:QuestCatalogInput){
 const markers=new Map(input.markers.map(m=>[m.id,m]));
 const npcs=new Map(input.npcs.map(n=>[n.id,n]));
 const enemies=new Map((input.enemies??[]).map(n=>[n.id,n]));
 const objectives=new Map(input.objectives.map(o=>[o.region,o.objective]));
 const point=(id:string):Pick<QuestGuide,'targetKind'|'region'|'position'|'targetLabel'>|null=>{
  const npc=npcs.get(id);if(npc)return{targetKind:'npc',region:npc.region,position:[...npc.position],targetLabel:npc.label??specialLabels.get(id)??pair(id)};
  const enemy=enemies.get(id);if(enemy)return{targetKind:'enemy',region:enemy.region,position:[...enemy.position],targetLabel:enemy.label};
  const marker=markers.get(id);return marker?{targetKind:'marker',region:regionAt(marker.p[0],marker.p[2]).id as RegionId,position:[...marker.p],targetLabel:specialLabels.get(id)??pair(marker.label)}:null;
 };
 const instruction=(id:string):Localized=>{
  const marker=markers.get(id),label=specialLabels.get(id)??(marker?pair(marker.label):pair(id));
  if(id.startsWith('ghost_boat_'))return['留在要塞炮位，用大炮击破这艘幽灵艇；不要游向目标。','Stay at the fort cannon and destroy this ghost boat; do not swim to it.'];
  if(marker?.type==='objective')return[`瞄准并射击：${label[0]}。`,`Aim and shoot: ${label[1]}.`];
  if(marker?.type==='discovery')return[`靠近探索地点：${label[0]}；到达范围后自动记录。`,`Approach the discovery: ${label[1]}; entering its radius records it automatically.`];
  return[`到现场站稳，交互：${label[0]}。`,`Stand at the site and interact: ${label[1]}.`];
 };
 const guide=(title:Localized,text:Localized,id:string,done:ReadonlySet<string>,context:QuestGuideContext={},seen=new Set<string>()):QuestGuide|null=>{
  if(seen.has(id))return null;seen.add(id);
  const marker=markers.get(id);
  const requires=marker?(getEraBossRequirements(id,done)??marker.requires??[]):[];
  const missing=requires.find(flag=>!done.has(flag));
  if(missing){const next=guide(title,instruction(missing),missing,done,context,seen);return next?{...next,prerequisite:[`先完成前置，才能操作「${pair(marker!.label)[0]}」。`,`Complete this prerequisite before using “${pair(marker!.label)[1]}”.`]}:null;}
  if(marker?.type==='objective'&&!done.has('armory_rack')){
   const next=guide(title,['先到枪械工坊领取武器，再回来射击目标。','Collect equipment at the armory before shooting the target.'],'armory_rack',done,context,seen);
   return next?{...next,prerequisite:['射击需要先领取装备。','Shooting requires equipment first.']}:null;
  }
  if(id.startsWith('ghost_boat_')&&!context.mounted){
   const next=guide(title,['到要塞大炮交互进入炮位，再瞄准幽灵艇；步枪无法代替重炮。','Interact with the fort cannon, then aim at the ghost boats; a rifle cannot replace the cannon.'],'fort_cannon',done,context,seen);
   return next?{...next,prerequisite:['幽灵艇必须用要塞大炮击破。','Ghost boats require the fort cannon.']}:null;
  }
  const target=point(id);return target?{title,text:[...text],targetId:id,...target}:null;
 };
 const build=(done:ReadonlySet<string>,found:ReadonlySet<string>,context:QuestGuideContext={}):QuestEntry[]=>{
  const entries:QuestEntry[]=[];
  const add=(id:string,region:RegionId,category:QuestCategory,title:Localized,complete:boolean,next:QuestGuide|null)=>entries.push({id,region,category,title,complete,guide:complete?null:next,...(!complete&&!next?{unavailable}: {})});
  for(const region of REGIONS){
   if(region==='alpha'){
    const objective=objectives.get(region),title:Localized=['幻日谷 · 重启幻日塔','Parhelion Valley · Restart the tower'];
    const intro=getValleyStoryGuide(done),step=objective?.steps.find(s=>s.done.some(id=>!done.has(id)));
    const id=step?.done.find(id=>!done.has(id));
    add('main:alpha',region,'main',title,!intro&&!step,intro?guide(title,intro.text,intro.targetId,done,context):id?guide(title,pair(step!.text),id,done,context):null);
   }else{
    const next=getEraStoryGuide(region,done),title=ERA_STORIES[region].title;
    add(`main:${region}`,region,'main',title,!next,next?guide(title,next.text,next.targetId,done,context):null);
   }
  }
  const valley=getValleyStoryGuide(done),valleyTitle:Localized=['生活馆记录员 · 留一盏灯','Residence Archivist · A Light to Return To'];
  add('side:valley-record','alpha','side',valleyTitle,!valley,valley?guide(valleyTitle,valley.text,valley.targetId,done,context):null);
  // The maintenance note is an interactable done flag, not a found discovery.
  const noteTitle:Localized=['可选 · 观测所检修路线笔记','Optional · Observatory maintenance route note'];
  add('side:valley-note','alpha','side',noteTitle,done.has(VALLEY_STORY.discovery),guide(noteTitle,instruction(VALLEY_STORY.discovery),VALLEY_STORY.discovery,done,context));
  for(const region of ERA_IDS){const def=ERA_OPTIONALS[region];add(`side:${def.id}`,region,'side',def.label,done.has(def.id),guide(def.label,instruction(def.id),def.id,done,context));}
  const knightTitle:Localized=['可选试炼 · 失誓骑士','Optional Trial · Oathless Knight'];
  const knightReady=done.has(ERA_OPTIONALS.britain.id);
  add('side:oath-knight','britain','side',knightTitle,done.has(ERA_KNIGHT_DEFEATED),guide(knightTitle,knightReady?['迎战失誓骑士；避开横扫，等收剑后反击。未出现时回铭牌交互接下试炼。','Face the Oathless Knight; evade the sweep and punish recovery. If absent, interact with the memorial to start the trial.']:['先擦亮旧誓铭牌，现场交互接下试炼。','Restore the oath memorial and interact there to start the trial.'],knightReady&&enemies.has('elite_oath_knight')?'elite_oath_knight':ERA_OPTIONALS.britain.id,done,context));
  for(const chain of OPTIONAL_CHAINS){
   // A collected reward is authoritative even if an old save lacks its setup flags.
   const complete=done.has(chain.flags[chain.flags.length-1]);const id=chain.flags.find(id=>!done.has(id));
   add(`side:${chain.id}`,chain.region,'side',chain.title,complete,id?guide(chain.title,instruction(id),id,done,context):null);
  }
  const closure=getCampaignClosureState(done),closureTitle:Localized=['可选收束 · 灯火相连','Optional Epilogue · Lights Connected'];
  const missingEra=ERA_IDS.find(region=>!isEraCoreCleared(ERA_STORIES[region].core,done));
  let closing:QuestGuide|null=null;
  if(closure.stage==='ready')closing=guide(closureTitle,['回观测所终端，记录四处时层的旅程。','Return to the Observatory terminal to record the four-era journey.'],CAMPAIGN_CLOSURE.terminal,done,context);
  else if(missingEra){const next=getEraStoryGuide(missingEra,done);if(next)closing=guide(closureTitle,next.text,next.targetId,done,context);if(closing)closing.prerequisite=['先完成四处时层的核心，再回观测所记录。','Resolve all four era cores before recording the journey at the Observatory.'];}
  add('side:closure','alpha','side',closureTitle,closure.stage==='recorded',closing);
  for(const marker of input.markers.filter(m=>m.type==='discovery')){const title=pair(marker.label);add(`discovery:${marker.id}`,regionAt(marker.p[0],marker.p[2]).id as RegionId,'discovery',title,found.has(marker.id),guide(title,instruction(marker.id),marker.id,done,context));}
  return entries;
 };
 return{list:build,resolve(id:string,done:ReadonlySet<string>,found:ReadonlySet<string>,context:QuestGuideContext={}){return build(done,found,context).find(entry=>entry.id===id)?.guide??null;}};
}
