import {SiteArt} from './campaignSites';
import {gatePoint} from './kingdomGate';
import type {AdventurePoint} from './openWorldCampaign';
/** Furnished through-spaces wrap the actual maintenance paths. Doorways remain
 * open on both ends; walls and roofs are solid while the verified ramp owns floors. */
export function createJourneyPassageArt(){
 const abbey=new SiteArt(),houses=new SiteArt();
 const P=(side:number,out:number,y:number)=>gatePoint(side,out,y),rotation:[number,number,number]=[0,Math.PI/4,0];
 const stone=(side:number,out:number,y:number,w:number,h:number,d:number,c:string,solid=false)=>abbey.box(P(side,out,y),[w,h,d],c,solid,'body',rotation);
 // A compact repair scriptorium along the abbey wall, above the street battle.
 for(const side of[-26.8,-21.2]){stone(side,-5,10.4,.24,3.2,19,'#8b8c80',true);for(let out=-13;out<=4;out+=1.2)stone(side,out,10.6,.28,.045,1.15,'#b0ab93');}
 for(const out of[4,-14])for(const side of[-25.9,-22.1])stone(side,out,10.4,1.5,3.2,.2,'#9d9c8d',true);
 stone(-24,-5,12.2,6,.25,19,'#7a7667',true);
 for(const out of[3,-2,-7,-12]){stone(-24,out,12.05,5.4,.16,.15,'#584c3c');for(const side of[-26.5,-21.5])abbey.lantern(...P(side,out,11.3));}
 stone(-26,-6,9.55,.8,1.35,3,'#725d43',true);for(const out of[-6.8,-6,-5.2]){stone(-26,out,10.32,.55,.06,.55,'#dfd0b0');stone(-26,out,10.4,.03,.08,.4,'#655a47');}
 for(let i=0;i<5;i++){stone(-21.8,-8+i*.55,9.5,.65,1.2,.4,i%2?'#7f7055':'#686e5d',true);stone(-21.8,-8+i*.55,10.14,.6,.04,.45,'#bdab85');}
 abbey.finish('britain');abbey.root.name='Abbey_RepairScriptorium';
 // Two connected machiya through-rooms on the water-gate approach. Lower rooms
 // offer cover; a separate raised route traverses their roof line.
 for(const cx of[-63.5,-72.5]){
  const y=8.8+(cx+59)*4.1/18,z=740;
  const slope=Math.atan(4.1/18);
  houses.box([cx,y-.16,z],[8.9,.18,6.65],'#8f7652',true,'body',[0,0,slope]);
  for(const dx of[-4.3,0,4.3])for(const side of[-1,1]){
   const floorY=y+dx*4.1/18;houses.box([cx+dx,floorY-1.75,z+side*3.2],[.2,3.5,.2],'#5d4b38',true);
  }
  for(let dx=-4;dx<=4;dx+=.5)houses.box([cx+dx,y-.045+dx*4.1/18,z],[.025,.02,6.5],'#62533e');

  for(const side of[-1,1]){
   houses.box([cx,y+1.7,z+side*3.45],[8.9,3.4,.16],'#c4b594',true);
   for(const dx of[-4.35,0,4.35])houses.box([cx+dx,y+1.7,z+side*3.3],[.15,3.4,.15],'#66503b',true);
   for(let dx=-4;dx<=4;dx+=.55)houses.box([cx+dx,y+1.35,z+side*3.35],[.035,1.1,.055],'#766047');
   for(const dy of[.3,2.9])houses.box([cx,y+dy,z+side*3.57],[8.9,.1,.08],'#6b5138');
   for(const dx of[-2.3,2.3]){
    houses.box([cx+dx,y+1.9,z+side*3.55],[1.7,1.05,.025],'#dfcaa5');
    for(const offset of[-.7,-.35,0,.35,.7])houses.box([cx+dx+offset,y+1.9,z+side*3.58],[.025,1.1,.025],'#755c3f');
    houses.box([cx+dx,y+1.9,z+side*3.59],[1.75,.025,.025],'#755c3f');
   }
   // The centre doorway is 3.4 m wide, clear for both player and companions.
   for(const end of[-4.45,4.45])houses.box([cx+end,y+1.7,z+side*2.6],[.14,3.4,1.7],'#9b8966',true);
   houses.box([cx,y+3.8,z+side*1.75],[9.3,.2,3.7],'#46525a',true,'body',[side*.09,0,Math.atan(4.1/18)]);
  }
  for(const end of[-4.45,4.45])houses.box([cx+end,y+3.2,z],[.15,.35,6.9],'#6d533a',true);
  for(const dx of[-4.3,0,4.3])houses.box([cx+dx,y+3.4,z],[.15,.18,6.9],'#66503b');
  // Distinct rooms: a paper shop and a refuge with bedding, rather than clones.
  if(cx>-70){for(const dx of[-2,0,2]){houses.box([cx+dx,y+.5,z-2.5],[1.2,1,.65],'#795c3e',true);for(let i=0;i<3;i++)houses.paper(cx+dx,y+1.04+i*.03,z-2.5,.8,.45);}}
  else{for(const dx of[-2,1]){houses.box([cx+dx,y+.12,z+2.45],[1.6,.24,1.2],'#8c9271');houses.box([cx+dx,y+.3,z+2.75],[1.4,.15,.38],'#c2baa3');}houses.cyl([cx+2.8,y+.4,z-2.5],.35,.8,'#785d3b');}
  houses.lantern(cx,y+2.3,z-2.9);houses.lantern(cx,y+2.3,z+2.9);
 }
 houses.finish('kyoto');houses.root.name='Kyoto_TwoMachiyaPassage';
 const roofRoute:AdventurePoint[]=[[-43,4.45,749],[-53,12.8,749],[-59,12.8,740],[-77,8.7,740],[-87,4.7,740]];
 return{abbey,houses,roofRoute};
}
