import type {Localized} from '../settlements/types';
import type {RoutePoint} from './worldPlan';
export interface HomeActivity {id:string;label:Localized;p:RoutePoint;flag?:string;seconds?:number;hint:Localized;}
export const HOME_CIVIC={started:'home_civic_started',complete:'home_civic_complete',boat:'home_boat_hauled',light:'home_lighthouse_aligned',garden:'home_garden_watered',bread:'home_bread_delivered',practice:'home_practice_complete',fish:'home_fish_caught'} as const;
export const HOME_CIVIC_ACTIONS:HomeActivity[]=[
 {id:'home_winch',label:['港湾起船绞盘','Harbour boat winch'],p:[253,6.9,126],flag:HOME_CIVIC.boat,seconds:5,hint:['松开，再按住交互，将小艇吊到修船滑台。','Release, then hold Interact to haul the boat onto the repair slip.']},
 {id:'home_lighthouse',label:['灯塔导光手轮','Lighthouse alignment wheel'],p:[245,6.9,88],flag:HOME_CIVIC.light,seconds:3,hint:['站稳转动手轮，将灯罩对准外海航道。','Stand still and turn the wheel to align the lamp with the sea approach.']},
 {id:'home_water',label:['花园手压水泵','Garden hand pump'],p:[-110,17,112],flag:HOME_CIVIC.garden,seconds:3,hint:['按住交互泵水，让水沿沟槽流入花圃。','Hold Interact to pump water through the garden channels.']},
 {id:'home_bread_pickup',label:['领取公馆面包篮','Collect the house bread basket'],p:[-122.8,17,71.4],hint:['把面包篮亲手送到公馆厨房；菜单、攻击或受伤会放回篮子。','Carry the basket to the house kitchen. Menus, attacks or damage return it to the bakery.']},
 {id:'home_bread_drop',label:['公馆厨房收货台','House pantry delivery'],p:[-26,17,-26],flag:HOME_CIVIC.bread,hint:['带着面包篮到这里交付。','Bring the bread basket here and hand it over.']},
 {id:'home_practice_start',label:['北坡射击练习','North court shooting practice'],p:[70,17,-100],flag:HOME_CIVIC.practice,hint:['开始后击中三面蓝靶；离开练习庭结束本轮，可随时重来。','Hit all three blue targets. Leaving the court ends the round; restart whenever ready.']},
 {id:'home_fishing',label:['栈桥垂钓','Fishing on the pier'],p:[302,6.9,112],flag:HOME_CIVIC.fish,hint:['抛竿后等浮漂下沉，再按交互提竿。没有消耗和失败惩罚。','Cast, wait for the float to dip, then press Interact to reel in. No bait cost or failure penalty.']},
 {id:'home_bakery_service',label:['面包房柜台','Bakery counter'],p:[-122,17,68],hint:['取一份热面包，或帮忙送餐。','Take some fresh bread or help with a delivery.']},
 {id:'home_grocer_service',label:['杂货铺柜台','Grocer counter'],p:[-87,17,78],hint:['查看家用陈设。','Choose furnishings for your home.']},
 {id:'home_cafe_service',label:['咖啡馆今日报纸','Cafe newspaper'],p:[-52,17,87],hint:['坐下休息，看看从旅途中带回的消息。','Rest and read the news brought back from your travels.']},
 {id:'home_tailor_service',label:['裁缝铺配色样本','Tailor colour samples'],p:[-2,17,46],hint:['为家里的地毯与布艺选择配色。','Choose colours for your home textiles.']},
 {id:'home_repair_service',label:['修理铺补给台','Repair shop supply bench'],p:[48,15.8,63],hint:['为已领取的装备补充弹药。','Refill ammunition for equipment you already own.']},
 {id:'home_clinic_service',label:['诊所治疗台','Clinic treatment'],p:[-115,17,-15],hint:['脱离危险后接受治疗。','Receive treatment once you are safe.']},
 {id:'home_collection',label:['家中的纪念架','Home keepsake shelf'],p:[-163,17,127],hint:['查看亲手完成的城镇纪念。','View mementos of the town activities you completed.']},
];
export const HOME_TARGETS:RoutePoint[]=[[57,18.6,-115.7],[70,18.6,-124],[83,18.6,-115.7]];
export const HOME_REPORT_REQUIRED:readonly string[]=[HOME_CIVIC.boat,HOME_CIVIC.light,HOME_CIVIC.garden,HOME_CIVIC.bread];
export const homeCivicReady=(done:ReadonlySet<string>)=>HOME_REPORT_REQUIRED.every(f=>done.has(f));
/** Saved facts choose a useful next site; physical delivery remains a separate action. */
export function homeCivicGuide(done:ReadonlySet<string>,carrying=false){
 if(!done.has(HOME_CIVIC.started)||homeCivicReady(done))return 'home_notice';
 if(!done.has(HOME_CIVIC.bread))return carrying?'home_bread_drop':'home_bread_pickup';
 return HOME_CIVIC_ACTIONS.find(a=>a.flag&&HOME_REPORT_REQUIRED.includes(a.flag)&&!done.has(a.flag))?.id??'home_notice';
}
