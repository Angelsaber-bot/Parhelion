import * as THREE from 'three';
import type { SettlementKit } from './types';
import { KyotoWinterArt } from './kyotoWinterArt';

/** A period-style timber aid house and supply court, deliberately free of modern hospital symbols. */
export function buildWinterSettlement(): SettlementKit {
  const a=new KyotoWinterArt('SETTLEMENT_WINTER_AID_COURT');
  const log=a.mat('#786658'), endgrain=a.mat('#a28d73'), dark=a.mat('#493f39'), plaster=a.mat('#c4c3b4'), snow=a.mat('#edf2f5'), snowShade=a.mat('#c6d4df'), slate=a.mat('#63717f'), stone=a.mat('#879193'), iron=a.mat('#4c5961',.48,.55), linen=a.mat('#e4dac4'), blue=a.mat('#465e7b'), leather=a.mat('#806653'), glass=a.mat('#bbd8df',.35,.1), fire=a.mat('#ffb65d',.7,0,.75), straw=a.mat('#b5a37a');
  a.box(0,-.2,0,34,.4,30,snowShade,true);
  // Trampled service lane down the central courtyard; the main gate remains 6m wide.
  a.box(0,.015,6.6,6,.03,17,stone);
  for(let z=1;z<15;z+=2.2) a.box(0,.034,z,5.7,.018,.055,snowShade);
  function logHouse(cx:number,cz:number,w:number,d:number,h:number,openFront:boolean) {
    a.box(cx,-.08,cz,w,.16,d,log,true);
    a.box(cx,h/2,cz-d/2,w,h,.32,plaster,true);
    for(const side of [-1,1])a.box(cx+side*w/2,h/2,cz,.32,h,d,plaster,true);
    if(!openFront){
      const sideWidth=(w-3.6)/2;
      for(const side of [-1,1])a.box(cx+side*(1.8+sideWidth/2),h/2,cz+d/2,sideWidth,h,.32,plaster,true);
      a.box(cx,h-.35,cz+d/2,3.6,.7,.35,log,true);
    }
    for(let y=.3;y<h;y+=.42) {
      a.box(cx,y,cz-d/2-.19,w+.5,.28,.22,log);
      for(const side of [-1,1]){
        a.box(cx+side*(w/2+.2),y,cz,.22,.28,d+.4,log);
        if(!openFront) a.box(cx+side*(w/4+.9),y,cz+d/2+.19,w/2-1.8,.28,.22,log);
      }
    }
    for(const side of [-1,1]) for(const z of [cz-d/2,cz+d/2])a.box(cx+side*w/2,h/2,z,.42,h+.1,.42,dark,true);
    a.roof(cx,cz,w+1.7,d+1.7,h+.1,2.7,slate,dark,snow);
    // Snow hanging from the eaves and sparse icicles create an unmistakable winter silhouette.
    for(const side of [-1,1])for(let x=cx-w/2;x<=cx+w/2;x+=1.5){
      a.box(x,h+.32,cz+side*(d/2+.9),1.2,.22,.35,snow);
      if(Math.round(x*10)%3===0)a.geo(new THREE.ConeGeometry(.07,.4,5),glass,x,h-.03,cz+side*(d/2+.9),Math.PI,0,0);
    }
  }
  logHouse(-8,-4,14,16,3.7,false);
  // An asymmetric canvas supply shelter breaks the silhouette of the permanent aid house.
  a.box(9,-.08,-4.5,10,.16,15,log,true);
  a.box(9,1.8,-12,10,3.6,.25,log,true);
  for(const x of [4,14]){
    a.box(x,.55,-4.5,.22,1.1,15,log,true);
    for(const z of [-12,-7,-2,3])a.box(x,1.9,z,.25,3.8,.25,dark,true);
  }
  a.box(9,3.7,-4.5,11.4,.12,16.5,linen,true,0,.095);
  for(const x of [3.6,6.3,9,11.7,14.4])a.beam([x,4.48,-12.7],[x,2.92,3.7],.11,dark);
  for(const z of [-11,-8,-5,-2,1])a.box(9,3.74-(z+4.5)*.095,z,11.4,.05,.06,blue,false,0,.095);
  a.box(9,2.75,3.75,11.5,.5,.07,linen);
  for(let x=3.6;x<14.5;x+=.8)a.box(x,2.49,3.78,.5,.15,.08,linen);
  a.box(9,4.57,-12.2,11.3,.12,.85,snow,false,0,.095);
  for(const x of [3.5,14.5])a.box(x,3.52,-4.5,.26,.3,16,linen,false,0,.095);

  // Aid-house front sash windows, amber shutters and linen pennant rather than an anachronistic cross.
  for(const x of [-12,-4]) {
    a.box(x,2.1,4.2,2,1.8,.1,glass);
    for(const dx of [-1.12,1.12])a.box(x+dx,2.1,4.25,.4,2.1,.12,blue);
    a.box(x,2.1,4.28,.09,1.85,.08,dark);a.box(x,2.1,4.29,2.05,.08,.08,dark);
    for(const y of [1.12,3.08])a.box(x,y,4.3,2.4,.13,.22,linen);
  }
  a.box(-8,3.1,4.32,2.8,.6,.1,blue);
  for(const x of [-8.7,-8,-7.3])a.box(x,3.1,4.39,.07,.28,.04,linen);
  a.box(-8,3.6,4.9,4.8,.18,1.6,dark,true);
  a.box(-8,3.78,4.9,4.9,.18,1.7,snow);
  // Four simple recovery cots. Central aisle width exceeds 3m and doorways stay clear.
  for(const x of [-12.3,-3.7])for(const z of [-7.4,-2.7]){
    a.box(x,.5,z,2.25,.16,3.1,log,true);
    for(const dx of [-.9,.9])for(const dz of [-1.25,1.25])a.box(x+dx,.25,z+dz,.14,.5,.14,dark,true);
    a.box(x,.67,z,2.15,.23,2.95,linen);a.box(x,.84,z+.45,2.17,.12,1.85,blue);
    a.box(x,.9,z-1.1,1.7,.22,.48,linen);
    a.box(x,.73,z-1.58,2.35,.7,.12,dark,true);
    for(const zz of [-.22,.4,1.02])a.box(x,.91,z+zz,2.15,.02,.035,linen);
  }
  // Warm stove and medicine workbench: glow is emissive, with no per-building dynamic lights.
  a.box(-8,.85,-10.4,1.55,1.7,1.2,iron,true);a.box(-8,.85,-9.78,1.05,.75,.03,fire);
  for(const x of [-8.35,-8,-7.65])a.box(x,.85,-9.73,.08,.83,.03,iron);
  a.cyl(-8,3.15,-10.6,.2,3,iron,true);a.box(-8,5.75,-10.6,.8,1.9,.8,stone,true);a.box(-8,6.8,-10.6,1.1,.25,1.1,snow);
  a.box(-4,.92,1.6,2.6,.18,1.2,log,true);for(const x of [-5,-3])a.box(x,.44,1.6,.16,.88,.9,dark,true);
  for(let i=0;i<4;i++){
    a.cyl(-4.9+i*.58,1.2,1.3,.15,.35,i%2?glass:linen);a.cyl(-4.9+i*.58,1.4,1.3,.16,.07,dark);
  }
  a.box(-4,1.05,1.9,1.8,.05,.35,linen);
  // Wall pegs, hung greatcoats, and a pair of boots give the room lived-in scale.
  for(const x of [-10,-9,-7,-6]){a.box(x,2.4,-11.7,.15,.15,.5,dark);a.box(x,1.6,-11.55,.55,1.4,.18,leather);}
  for(const x of [-6.5,-6])a.box(x,.18,1.4,.28,.36,.65,dark);
  // Open supply house with two storage rows and a generous 4m center aisle.
  a.box(9,2.98,3,10.5,.25,.3,dark,true);
  for(const x of [5.2,12.8]) {
    for(const z of [-9,-5.8,-2.6]){
      a.box(x,.65,z,2,1.3,2.3,log,true);
      for(const xx of [-.75,.75])a.box(x+xx,.65,z+1.17,.1,1.28,.05,dark);
      a.box(x,.65,z+1.21,1.9,.12,.08,iron);
      a.box(x,1.5,z,1.8,.38,1.7,linen);
      for(const xx of [-.6,.6])a.box(x+xx,1.5,z+ .86,.07,.38,.04,blue);
    }
  }
  a.box(9,.9,-11.3,4.4,.18,.9,log,true);
  for(const x of [7.3,10.7])a.box(x,.45,-11.3,.16,.9,.8,dark,true);
  for(let i=0;i<5;i++)a.cyl(7.4+i*.8,1.12,-11.3,.22,.25,linen);
  // A low timber sled conveys supply work without a modern wheeled vehicle silhouette.
  a.box(9,.55,9,4.5,.25,5.5,log,true);
  for(const x of [7.3,10.7]){
    a.box(x,.2,9,.18,.25,6.1,iron,true);
    a.beam([x,.2,12],[x,.65,12.8],.1,iron);
  }
  for(const x of [6.7,11.3]){a.box(x,.95,9,.2,.7,5.6,dark,true);for(const z of [6.5,9,11.5])a.box(x,1.15,z,.16,1.1,.16,log);}
  for(const z of [7.1,9.3])a.box(9,1.1,z,3.6,.85,1.75,linen,true);
  for(const x of [8,10])a.box(x,1.58,8.2,.12,.08,4.1,blue);
  a.box(9,.78,12.8,3.7,.12,.8,snow);
  // Courtyard woodpile, snow-capped fencing, and shallow thaw-water trough.
  for(const x of [-17,17]){a.box(x,.6,0,.22,1.2,30,log,true);a.box(x,1.26,0,.35,.12,30,snow);}
  a.box(0,.6,-15,34,1.2,.22,log,true);a.box(0,1.26,-15,34,.12,.35,snow);
  for(const x of [-10,10]){a.box(x,.6,15,14,1.2,.22,log,true);a.box(x,1.26,15,14,.12,.35,snow);}
  for(let i=0;i<5;i++)for(let j=0;j<3;j++)a.geo(new THREE.CylinderGeometry(.22,.22,2.5,8),log,-13.8+i*.47,.25+j*.42,9.5,Math.PI/2,0,0);
  a.box(-12.8,1.5,9.5,3.2,.15,3.1,snow);
  a.box(-5.5,.45,10.6,2.5,.9,1.3,log,true);a.box(-5.5,.91,10.6,2.15,.025,.95,glass);
  // High lanterns frame the entrance but leave a wide unobstructed route.
  for(const x of [-3.5,3.5]){
    a.box(x,1.55,13.7,.18,3.1,.18,dark,true);a.box(x,2.6,13.7,.55,.75,.55,fire);
    for(const dx of [-.3,.3])a.box(x+dx,2.6,13.7,.045,.8,.6,iron);
    a.box(x,3.05,13.7,.85,.16,.85,snow);a.box(x,2.17,13.7,.7,.12,.7,iron);
  }
  // Loose straw beneath the sheltered supply doorway, not repeated over the snowfield.
  for(let i=0;i<8;i++)a.box(5.7+i*.28,.035,4.5+(i%3)*.25,.5,.04,.04,straw,false,i*.7);
  return {id:'winter',name:['雪路救护驿站','Snowroad Aid and Supply Post'],group:a.finish(),footprint:[35,31],entry:[0,15.5],npcs:[
    {id:'winter_surgeon',role:['随军医师','Field Surgeon'],position:[-7.9,0,.6],yaw:0,lines:[['炉边还有位置。先暖一暖，雪路上的伤要慢慢处理。','There is space by the stove. Warm up first; injuries from the snow road take patience.'],['左边是休息的铺位，补给在对面的棚屋里。','The resting cots are inside. Supplies are kept in the house across the yard.']]},
    {id:'winter_quartermaster',role:['驿站补给员','Post Quartermaster'],position:[9,0,-1.1],yaw:0,lines:[['雪橇上的毯子刚运到。穿过院子时给搬运的人留条路。','The sled has just brought blankets. Keep the courtyard passage open for the porters.'],['这间驿站连接城外与雪原。记住两盏门灯，风大时别走散。','This post links the city outskirts and the snowfield. Remember the two gate lanterns when the wind rises.']]},
  ]};
}
