import type {Localized,RegionId} from '../settlements/types';
export type ResidentActionKind='ground'|'observe'|'tune'|'order'|'witness'|'stamp'|'manifest'|'hood'|'blanket'|'underlay'|'strap'|'page'|'rack'|'weight'|'horse'|'cross-start'|'cross-finish';
export interface ResidentActionDef{id:string;region:RegionId;kind:ResidentActionKind;label:Localized;offset?:[number,number];world?:[number,number,number];fact?:string;}
const def=(region:RegionId,key:string,kind:ResidentActionKind,label:Localized,offset:[number,number],fact?:string):ResidentActionDef=>({id:`resident_${region}_${key}`,region,kind,label,offset,fact});
export const RESIDENT_ACTIONS:readonly ResidentActionDef[]=[
 def('alpha','ground','ground',['接上金属外壳的接地夹','Ground the receiver casing'],[-2,2]),
 def('alpha','rhythm','observe',['观察双脉冲回传灯','Observe the two-pulse return lamp'],[2,2],'resident_alpha_rhythm'),
 def('alpha','tune','tune',['转动收讯刻度 · 三档循环','Turn the receiver dial · Three positions'],[0,3.7]),
 def('britain','order','order',['移开后加的征召令','Lift the later muster order'],[-2,2]),
 {id:'resident_britain_witness_a',region:'britain',kind:'witness',label:['城门归人刻名 · 确认已有名字','Gate returners’ inscription · Verify known names'],world:[-863,34,-138],fact:'resident_britain_witness_a'},
 {id:'resident_britain_witness_b',region:'britain',kind:'witness',label:['修院待核实铭牌 · 保留空行','Abbey verification plaque · Preserve unknown names'],world:[-862,34,-174],fact:'resident_britain_witness_b'},
 def('britain','stamp','stamp',['在空行旁盖上待核实印记','Stamp the unknown lines for verification'],[2,2]),
 {id:'resident_blacksail_manifest_a',region:'blacksail',kind:'manifest',label:['造船厂货重牌 · 三次满载','Shipyard cargo board · Three full loads'],world:[518,7.8,-566],fact:'resident_blacksail_manifest_a'},
 {id:'resident_blacksail_manifest_b',region:'blacksail',kind:'manifest',label:['港口口粮牌 · 零份水手口粮','Harbor ration board · No crew rations'],world:[601,3.4,-576],fact:'resident_blacksail_manifest_b'},
 {id:'resident_blacksail_manifest_c',region:'blacksail',kind:'manifest',label:['码头值守牌 · 同一航次反复返回','Quay watch board · The same voyage returns'],world:[588,3.4,-567],fact:'resident_blacksail_manifest_c'},
 def('blacksail','hood','hood',['旋转暖灯遮板 · 设为安全等待线','Rotate the warm-light hood · Set a safe holding line'],[0,3]),
 def('winter','blanket','blanket',['拿起备用干布卷','Pick up the dry blanket roll'],[-2,2]),
 def('winter','underlay','underlay',['把干布垫入担架底部','Pad the stretcher underneath'],[0,3.6]),
 def('winter','strap_a','strap',['固定担架头端绑带','Secure the stretcher head strap'],[-2,4.2],'resident_winter_strap_a'),
 def('winter','strap_b','strap',['固定担架脚端绑带','Secure the stretcher foot strap'],[2,4.2],'resident_winter_strap_b'),
 def('kyoto','page','page',['从松边取下一页湿纸','Lift a wet page from its loose edge'],[-2,2]),
 def('kyoto','rack','rack',['把湿页铺到通风架','Lay the page on the drying rack'],[2,2]),
 def('kyoto','weight_a','weight',['压稳晾架迎风侧木片','Weight the windward rack corner'],[-2,4.2],'resident_kyoto_weight_a'),
 def('kyoto','weight_b','weight',['压稳晾架背风侧木片','Weight the leeward rack corner'],[2,4.2],'resident_kyoto_weight_b'),
 {id:'resident_winter_hoofprints',region:'winter',kind:'horse',label:['循马蹄印找白马','Follow the hoofprints to the white horse'],world:[-168,6,-580]},
 {id:'resident_winter_horse',region:'winter',kind:'horse',label:['找到偷吃草的白马','Find the white horse eating grass'],world:[-153,6,-574]},
 {id:'resident_kyoto_cross_start',region:'kyoto',kind:'cross-start',label:['不湿鞋挑战 · 西岸起点','Dry-shoe crossing · West bank start'],world:[592,4,-1500]},
 {id:'resident_kyoto_cross_finish',region:'kyoto',kind:'cross-finish',label:['不湿鞋挑战 · 东岸终点','Dry-shoe crossing · East bank finish'],world:[544,4,-1500]},
];
export type ResidentCarry='blanket'|'page'|null;
export function getResidentWorkGuide(region:RegionId,done:ReadonlySet<string>,carrying:ResidentCarry=null):{targetId:string;text:Localized}|null{
 if(!done.has('adventure_v2')||!done.has(`campaign_${region}_met`)||done.has(`campaign_${region}_worked`))return null;
 const first=done.has(`campaign_${region}_work_step_1`),at=(key:string,text:Localized)=>({targetId:`resident_${region}_${key}`,text});
 switch(region){
 case 'alpha':return !first?at('ground',['先把接地夹扣到金属端子，消除外壳嗡鸣。','Fasten the grounding clip to stop the casing hum.']):!done.has('resident_alpha_rhythm')?at('rhythm',['观察回传灯的双脉冲。把刻度对准同样的两次回应。','Observe the return lamp’s two pulses; tune to the matching pair.']):at('tune',['转动三档刻度，寻找双脉冲对应的第二档。','Cycle the three dial positions to the second, matching the double pulse.']);
 case 'britain':return !first?at('order',['移开盖住旧名册的征召令。','Lift the muster order covering the old roll.']):!done.has('resident_britain_witness_a')?at('witness_a',['到城门核对归人的已有刻名。','Verify the returners’ known names at the gate.']):!done.has('resident_britain_witness_b')?at('witness_b',['到修院铭牌确认哪些名字仍待核实。','Check which names remain unverified at the abbey plaque.']):at('stamp',['回见誓棚，在无法核实的空行旁盖印，保留空行。','Return and stamp the unverified lines; preserve the blanks.']);
 case 'blacksail':{const missing=['a','b','c'].find(k=>!done.has(`resident_blacksail_manifest_${k}`));return missing?at(`manifest_${missing}`,['实地核对货重、口粮与值守三处记录，找到空航的矛盾。','Compare cargo, rations and the quay watch record to expose the empty voyage.']):at('hood',['把暖灯遮板转向安全等待线，清路前不放船靠近冷灯。','Turn the hood toward the safe holding line, away from the cold lamp.']);}
 case 'winter':return carrying==='blanket'?at('underlay',['把手中的干布铺进担架底部。','Place the blanket you are carrying under the stretcher.']):!first?at('blanket',['拿起干布，再走到担架底部垫好保温层。','Carry the dry cloth to the underside of the stretcher.']):!done.has('resident_winter_strap_a')?at('strap_a',['固定头端绑带，避开红线标出的伤处。','Secure the head strap without crossing the red wound mark.']):at('strap_b',['固定脚端绑带，保留抬杆的活动空间。','Secure the foot strap and leave the handles free.']);
 case 'kyoto':return carrying==='page'?at('rack',['把手中的湿页单独摊到通风架。','Spread the page you are carrying on the drying rack.']):!first?at('page',['从松边取页，分别铺到通风架，不能重新叠成湿纸束。','Lift each page from its loose edge and spread it on the drying rack.']):!done.has('resident_kyoto_weight_a')?at('weight_a',['用平木片压住迎风一角，保留通风。','Weight the windward corner, keeping space for air.']):at('weight_b',['固定另一侧木片，让纸页保持摊开。','Secure the other wooden strip and keep the pages spread.']);
 }
}
