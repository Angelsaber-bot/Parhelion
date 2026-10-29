import type { SettlementKit } from './types';
import { KyotoWinterArt } from './kyotoWinterArt';

/** A walk-in craft lane, not another shrine: open swordsmith, tatami inn, and a shared rear garden. */
export function buildKyotoSettlement(): SettlementKit {
  const a=new KyotoWinterArt('SETTLEMENT_KYOTO_CRAFT_LANE');
  const wood=a.mat('#765039'), dark=a.mat('#3e302b'), pale=a.mat('#f1dfbc'), paper=a.mat('#fff1cd'), tile=a.mat('#536476'), tileEdge=a.mat('#728496'), stone=a.mat('#96978d'), stoneDark=a.mat('#666c68'), tatami=a.mat('#b3b58a'), indigo=a.mat('#3b527b'), brass=a.mat('#b99b61',.43,.5), iron=a.mat('#424e58',.38,.6), ember=a.mat('#ff9b3d',.65,0,1.25), water=a.mat('#6fadb3',.25,.12), leaf=a.mat('#718e62');
  // Continuous accessible paving has no raised doorstep that can catch the player's capsule.
  a.box(0,-.2,0,34,.4,30,stone,true);
  for(let x=-15;x<=15;x+=3) for(let z=5;z<=13;z+=2.6) a.box(x,.014,z,2.86,.026,2.46,(x+z)%2?stone:stoneDark);
  // Inn, +Z-facing, 3.6 m entrance. Its rooms are fully accessible at the same floor elevation.
  a.box(8,-.08,-3,16,.16,14,wood,true);
  a.box(8,2,-10,16,4,.3,pale,true);
  a.box(0,2,-3,.3,4,14,pale,true); a.box(16,2,-3,.3,4,14,pale,true);
  for(const x of [2.55,13.45])a.box(x,2,4,5.1,4,.28,pale,true);
  a.box(8,3.65,4,5.8,.7,.3,dark,true);
  for(const x of [0,5.1,10.9,16])a.box(x,2.05,4,.22,4.1,.38,dark,true);
  for(const z of [-10,-5,0,4])for(const x of [0,16])a.box(x,2,z,.25,4.05,.3,dark);
  for(const y of [.4,2.9,3.85]){
    a.box(8,y,-10.18,16.4,.14,.15,dark);a.box(8,y,4.18,16.4,.14,.15,dark);
    a.box(-.18,y,-3,.15,.14,14.4,dark);a.box(16.18,y,-3,.15,.14,14.4,dark);
  }
  a.roof(8,-3,18,16,4.15,2.1,tile,dark);
  // Ceramic ridge caps and roof courses catch soft anime-style rim light without texture noise.
  for(let x=-.5;x<=16.5;x+=.55){
    a.box(x,6.43,-3,.46,.18,.5,tileEdge);
    for(const s of [-1,1])for(let row=1;row<7;row++)a.box(x,6.43-row*.27,-3+s*row*1.03,.075,.075,.9,tileEdge,false,0,s*.255);
  }
  // Front shoji windows framed in individual timber mullions.
  for(const x of [2.5,13.5]){
    a.box(x,2.05,4.18,3.8,2.35,.08,paper);
    for(let k=-2;k<=2;k++)a.box(x+k*.72,2.05,4.25,.065,2.45,.07,dark);
    for(let k=-1;k<=1;k++)a.box(x,2.05+k*.7,4.26,3.9,.06,.07,dark);
  }
  // Projecting entrance canopy has curved eave tips, distinct from the workshop roof.
  a.roof(8,5.35,5.5,3,3.25,.85,tile,dark);
  for(const x of [5.5,10.5])a.box(x,1.55,6.5,.2,3.1,.2,dark,true);
  for(const side of [-1,1])a.box(8,3.35,5.35+side*1.55,5.8,.14,.55,tile,false,0,-side*.2);
  // Split noren leaves never obstruct the doorway's physical clearance.
  for(const x of [6.8,9.2]){a.box(x,3.18,4.32,1.05,.85,.045,indigo);a.box(x,3.15,4.35,.09,.5,.025,pale);}
  a.box(8,4.05,4.4,3.3,.55,.15,wood);
  for(const x of [7.5,8,8.5])a.box(x,4.06,4.5,.08,.3,.03,brass);
  // Shared room with a low dining table; circulation remains over 2m around the table.
  a.box(4.1,.5,-.8,2.6,.18,1.6,wood,true);
  for(const x of [3.1,5.1])for(const z of [-1.3,-.3])a.box(x,.25,z,.14,.5,.14,dark,true);
  for(const x of [3.3,4.9]){a.box(x,.09,.65,1.2,.18,.8,indigo);a.box(x,.09,-2.3,1.2,.18,.8,indigo);}
  a.cyl(4.2,.72,-.8,.22,.2,brass);for(const x of [3.5,4.9])a.cyl(x,.65,-.8,.13,.12,paper);
  // Rear sleeping alcoves are separated by a short screen, with a broad central approach.
  for(const x of [3.5,12.5]){
    a.box(x,.04,-6.6,4.5,.08,4.4,tatami);for(const z of [-8.4,-6.6,-4.8])a.box(x,.085,z,4.4,.025,.045,indigo);
    a.box(x,.17,-7.1,2,.23,2.7,paper);a.box(x,.32,-8.1,1.65,.22,.5,pale);
    a.box(x,.31,-6.3,2,.12,1,indigo);
  }
  a.box(8,1.4,-7.7,.15,2.8,4.3,paper,true);
  a.box(8,2.8,-7.7,.25,.12,4.5,dark);a.box(8,1.4,-5.55,.25,2.9,.2,dark);
  // Back-wall shelving and small travel chests distinguish an inhabited inn from a facade.
  for(const x of [2.3,13.7]){
    a.box(x,.65,-9.35,2.8,1.3,.8,wood,true);a.box(x,.67,-8.93,2.5,.07,.045,brass);
    for(let k=0;k<3;k++)a.box(x-.7+k*.7,1.43,-9.3,.45,.25,.55,indigo);
  }
  // Open-front swordsmith workshop with generous central working aisle.
  a.box(-10,-.08,-3,10,.16,12,stoneDark,true);
  a.box(-10,1.95,-9,10,3.9,.3,pale,true);
  a.box(-15,1.95,-3,.3,3.9,12,pale,true);a.box(-5,1.95,-3,.3,3.9,12,wood,true);
  for(const x of [-15,-5])for(const z of [-9,3])a.box(x,2.1,z,.34,4.2,.34,dark,true);
  a.box(-10,3.85,3,10.4,.35,.4,dark,true);
  a.roof(-10,-3,11.5,13.5,4.1,1.65,tile,dark);
  for(let x=-15.4;x<=-4.6;x+=.6)for(const side of [-1,1]){
    a.beam([x,5.93,-3],[x,4.32,-3+side*6.7],.055,tileEdge);
    a.cyl(x,4.19,-3+side*6.8,.115,.16,tileEdge,false,8);
  }
  // A subtly upswept secondary eave, repeated ceramic edge caps, and carpenter brackets.
  for(const spec of [[8,18,16,4.15],[-10,11.5,13.5,4.1]]){
    const [cx,w,d,e]=spec;
    for(const side of [-1,1]){
      a.box(cx,e+.08,-3+side*(d/2+.12),w+.25,.16,.58,tile,false,0,-side*.14);
      for(let x=cx-w/2+.3;x<cx+w/2;x+=.7)a.box(x,e+.2,-3+side*(d/2+.18),.38,.18,.44,tileEdge);
    }
    for(const x of [cx-w/2+.7,cx+w/2-.7])for(const side of [-1,1]){
      a.box(x,e-.22,-3+side*(d/2-.65),.4,.35,1.3,wood);
      a.box(x,e-.5,-3+side*(d/2-1),.22,.35,.65,dark);
    }
  }
  // Clay hearth with recessed glowing coals; emissive only, no costly shadow point light.
  a.box(-12.9,.65,-6.8,2.3,1.3,2.1,stoneDark,true);
  a.box(-12.9,1.35,-6.8,1.6,.12,1.45,ember);
  a.box(-12.9,2,-7.8,2.3,2.2,.35,stone,true);
  a.box(-12.9,4,-7.8,1.1,4.4,1.1,stone,true);
  for(let y=1;y<5.8;y+=.38)a.box(-12.9,y,-7.22,1.15,.035,.035,stoneDark);
  a.box(-11.25,.8,-6.7,.75,.6,1.2,wood,true);a.box(-11.25,1.16,-6.7,.65,.12,1.2,iron);
  // Anvil on stump and quenching basin, kept clear of the smith's dialogue socket.
  a.cyl(-11.8,.5,-2.5,.65,1,wood,true);a.box(-11.8,1.18,-2.5,1.55,.4,.65,iron,true);a.box(-11.8,1.45,-2.5,1.9,.12,.8,iron);
  a.cyl(-6.5,.55,-6.4,.65,1.1,wood,true);a.cyl(-6.5,1.08,-6.4,.58,.035,water);
  for(let i=0;i<3;i++){
    const z=-5.8+i*1.4;a.box(-5.8,1.1,z,.45,.18,1.05,wood,true);a.box(-5.8,1.32,z,.1,.07,1.7,iron);
  }
  a.box(-8.4,.85,-8.3,3.1,.18,.95,wood,true);for(const x of [-9.6,-7.2])a.box(x,.4,-8.3,.14,.8,.6,dark,true);
  for(let i=0;i<4;i++)a.box(-9.5+i*.65,1.02,-8.3,.12,.09,.7,iron);
  // Tool racks and exterior travel bundles make the lane readable before entering either door.
  for(let i=0;i<4;i++)a.beam([-14.1+i*.42,.2,4.2],[-14.1+i*.42,2,4.3],.045,wood);
  a.box(-13.5,1.1,4.25,2,.12,.15,dark);
  for(const x of [12.5,14.4]){a.box(x,.3,5.5,1.5,.6,.8,wood,true);a.box(x,.63,5.5,1.4,.08,.75,pale);}
  // Garden strip, rain basin and crafted fence with an open 5m frontage.
  for(const x of [-17,17])a.box(x,.55,0,.22,1.1,29,wood,true);
  a.box(0,.55,-15,34,1.1,.22,wood,true);
  for(const x of [-10,10])a.box(x,.55,15,14,1.1,.22,wood,true);
  for(let x=-16;x<=16;x+=2)a.box(x,.8,-15,.16,1.6,.2,dark);
  for(let x=-12;x<=12;x+=4){a.cyl(x,.28,-13,.55,.55,stone);a.cyl(x,.85,-13,.65,1,leaf,false,8,.45);}
  a.cyl(-2.5,.55,7.8,.8,1.1,stone,true);a.cyl(-2.5,1.1,7.8,.62,.025,water);
  // An irregular planted pocket interrupts the paved frontage, clear of the central lane.
  a.box(-9,.04,10,7,.08,5,stoneDark);
  for(let k=0;k<6;k++){
    const x=-11.7+(k%3)*2,z=8.8+Math.floor(k/3)*2;
    a.cyl(x,.2,z,.6,.4,stone,false,7,.35);
    for(let stem=0;stem<3;stem++){
      const sx=x+stem*.23-.2;a.cyl(sx,1.55+stem*.18,z,.045,3.1+stem*.36,leaf);
      for(let y=.6;y<3;y+=.6)a.cyl(sx,y,z,.06,.08,dark);
      a.box(sx+.2,2.7+stem*.15,z,.7,.05,.18,leaf,false,.6+stem);
    }
  }
  // Warm lanterns on independent posts; decorative geometry does not block entry.
  for(const x of [-3,3]){
    a.box(x,1.45,11,.15,2.9,.15,dark,true);a.cyl(x,2.5,11,.34,.65,a.mat('#f7c878',.7,0,.45));
    a.box(x,2.9,11,.8,.12,.7,tile);a.box(x,2.1,11,.6,.12,.5,dark);
  }
  return {id:'kyoto',name:['刀匠与旅籠小路','Swordsmith and Wayfarer Lane'],group:a.finish(),footprint:[35,31],entry:[0,15.5],npcs:[
    {id:'kyoto_swordsmith',role:['刀匠','Swordsmith'],position:[-8.8,0,-1.9],yaw:0,lines:[['炉火要慢，磨刀要稳。沿旁边的巷道走，就是旅籠的院子。','Keep the forge steady and the whetstone slow. The lane leads to the inn courtyard.'],['我修的是旅人的兵器，不是让这座城再多一场火。','I mend travelers’ weapons. This city needs no more fire.']]},
    {id:'kyoto_innkeeper',role:['旅籠老板','Innkeeper'],position:[11.8,0,.6],yaw:0,lines:[['里面留了两间铺席。先在灯下歇歇，后院的路也通着。','Two sleeping alcoves are ready. Rest by the lantern; the rear garden is open.'],['锻刀的声音是隔壁师傅。夜里也有人守着这条小路。','The hammering comes from our neighbor. Someone still watches over this lane at night.']]},
  ]};
}
