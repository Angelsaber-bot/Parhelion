import * as THREE from 'three';
import type {SettlementArt} from './valleyBritainArt';

/** Domestic scale, recessed joinery and occupied rooms for the actual walk-in hub. */
export function residenceCraft(a:SettlementArt){
 const stone='#d1c9b7',edge='#eee7d7',wood='#8d6951',grain='#73533e',ink='#344c69',brass='#b89c67',cloth='#6d9693';
 // Sheltered entrance: two distinct supports and knee braces leave the central route open.
 for(const s of[-1,1]){
  a.rounded('portico_foot',[s*4,.18,1.8],[.7,.36,.7],.05,stone,true);
  a.box('portico_post',[s*4,1.87,1.8],[.24,3.4,.24],ink,true);
  a.box('portico_capital',[s*4,3.46,1.8],[.48,.2,.48],brass);
  a.beam('portico_knee',[s*4,2.8,1.8],[s*3.25,3.5,1.8],.13,wood);
 }
 a.gable('portico',0,.65,8.8,3.4,3.6,.8,ink,brass);
 for(const x of[-3.3,-1.1,1.1,3.3])a.box('portico_soffit_rib',[x,3.54,.65],[.08,.1,3.1],wood);
 // Grounded lower courses and corner quoins keep a long wall from reading as one blank slab.
 for(const z of[-13.22,-.79])for(const s of[-1,1]){
  a.box('dressed_stone_skirt',[s*8,.35,z],[11.7,.7,.13],stone);
  a.box('skirt_weathering',[s*8,.72,z],[11.8,.08,.22],edge);
  for(let row=0;row<5;row++)a.box('corner_quoin',[s*13.65,.22+row*.61,z],[row%2?.8:.56,.48,.21],row%2?edge:stone);
 }
 for(const s of[-1,1]){
  a.box('rear_corner_quoin',[s*14.21,.35,-7],[.15,.7,12.1],stone);
  for(let row=0;row<6;row++)a.box('rear_masonry_joint',[s*14.22,.2+row*.48,-7],[.025,.016,11.7],'#b5b3a7');
 }
 // Inset windows: interior curtains, deep reveals and fine lead divisions.
 for(const x of[-11,-5.5,5.5,11]){
  for(const s of[-1,1]){
   a.box('window_reveal',[x+s*1.23,2.5,-1],[.14,2.1,.52],edge);
   a.rounded('window_curtain',[x+s*.87,2.5,-1.3],[.48,1.88,.09],.025,cloth);
   for(let fold=0;fold<4;fold++)a.cyl('curtain_fold',[x+s*.87+(fold-1.5)*.095,2.5,-1.24],.025,1.8,fold%2?cloth:'#82a9a1');
   a.box('window_shutter_frame',[x+s*1.65,2.5,-.77],[.52,1.98,.13],ink);
   for(let rail=0;rail<7;rail++)a.box('window_shutter_louver',[x+s*1.65,1.75+rail*.24,-.67],[.42,.12,.055],wood);
   a.box('shutter_hinge',[x+s*1.61,1.92,-.61],[.32,.045,.035],brass);
   a.box('shutter_hinge',[x+s*1.61,3.08,-.61],[.32,.045,.035],brass);
  }
  a.box('window_header',[x,3.56,-.84],[2.77,.16,.3],edge);
 }
 for(const x of[-10.5,10.5])a.window('rear_residence_window',x,2.55,-13.2,2.2,1.7,ink,'#8fb6be');
 // Visible joinery under the roof, with a continuous ceiling and a traversable 4 m entry strip.
 a.box('residence_ceiling',[0,4.5,-7],[27.6,.12,11.6],'#e2dfd1');
 for(const x of[-9.3,-4.6,0,4.6,9.3])a.box('ceiling_crossbeam',[x,4.35,-7],[.12,.18,11.5],wood);
 for(const s of[-1,1])a.box('interior_wainscot',[s*13.72,.59,-7],[.09,1.16,11.5],ink);
 for(let x=-13;x<14;x+=.6)a.box('floorboard_joint',[x,.009,-7],[.014,.012,11.5],'#a39b89');
 // An entry runner gives the long hall a human-scale center; it does not block the player.
 a.box('entry_runner',[0,.024,-3.15],[3.25,.026,3.6],ink);
 for(const s of[-1,1])a.box('runner_border',[s*1.48,.04,-3.15],[.055,.008,3.35],brass);
 for(const z of[-4.78,-1.52])a.box('runner_border',[0,.04,z],[3,.008,.055],brass);
 // A reading alcove in each wing, oriented toward the inner room, outside NPC sockets.
 for(const s of[-1,1]){
  // Bedrooms have a lower, framed ceiling, instead of borrowing the hall's
  // 4.5 m void; curtains and a travel sketch give the side walls a lived-in scale.
  a.box('sleepwing_ceiling',[s*9.5,3.45,-9],[8.8,.14,7.8],'#e2dfd1');
  for(const z of[-12.7,-9,-5.25])a.box('sleepwing_ceiling_beam',[s*9.5,3.32,z],[8.8,.14,.10],wood);
  for(const z of[-10.5,-6.5,-3]){
   a.beam('side_curtain_rod',[s*13.62,3.27,z-1.35],[s*13.62,3.27,z+1.35],.045,brass);
   for(const end of[-1,1]){
    a.rounded('side_window_curtain',[s*13.68,2.28,z+end*.78],[.09,1.85,.48],.025,cloth);
    for(let fold=0;fold<4;fold++)a.cyl('side_curtain_fold',[s*13.61,2.28,z+end*.78+(fold-1.5)*.10],.025,1.8,fold%2?cloth:'#82a9a1');
    a.box('side_curtain_tie',[s*13.55,2.1,z+end*.78],[.025,.055,.43],brass);
   }
  }
  a.box('travel_sketch_frame',[s*5.17,2,-8.5],[.08,1.15,1.55],wood);
  a.box('travel_sketch_paper',[s*5.22,2,-8.5],[.018,.94,1.33],edge);
  for(let k=0;k<4;k++)a.beam('travel_sketch_contour',[s*5.24,1.72+k*.12,-9.01],[s*5.24,1.85+k*.09,-7.99],.012,'#a5b7ae');
  for(const z of[-10.8,-6.6]){
   for(const xx of[-1,1])for(const zz of[-1,1])a.box('bed_tapered_foot',[s*10.1+xx*.94,.12,z+zz*.5],[.09,.24,.09],wood);
   for(let stitch=0;stitch<7;stitch++)a.box('quilt_stitch',[s*9.86,.736,z+(stitch-3)*.165],[1.5,.006,.012],s<0?'#a8c6b4':'#bab1cf');
   a.box('headboard_panel',[s*11.26,.84,z],[.025,.52,1.08],ink);
   a.box('bedside_drawer',[s*12.5,.55,z+.86],[.65,.36,.03],grain);
   a.cyl('bedside_drawer_pull',[s*12.5,.55,z+.9],.04,.035,brass).rotation.x=Math.PI/2;
  }
  a.rounded('reading_chair_seat',[s*7.2,.5,-10.8],[1.1,.24,1.05],.1,cloth,true);
  a.rounded('reading_chair_back',[s*7.2,.93,-11.22],[1.1,.85,.22],.09,cloth);
  for(const xx of[-1,1]){
   a.rounded('reading_chair_arm',[s*7.2+xx*.54,.72,-10.8],[.15,.22,1.1],.05,wood);
   for(const zz of[-1,1])a.box('chair_leg',[s*7.2+xx*.43,.2,-10.8+zz*.4],[.08,.4,.08],ink);
  }
  a.table('reading_side_table',s*6.8,-8.5,.9,.75,wood,-.2);
  a.box('reading_notebook',[s*6.8,.83,-8.5],[.46,.07,.33],ink);
  a.box('reading_notebook_pages',[s*6.8,.83,-8.32],[.42,.045,.015],edge);
  a.box('sleepwing_rug',[s*9,.018,-8.5],[6.6,.025,6.8],s<0?'#728f88':'#8b849d');
  // Towels, garment pegs and a low luggage rack make the wings occupied.
  for(let i=0;i<3;i++){
   a.cyl('coat_peg',[s*5.18,1.75,-6.1+i*.36],.035,.22,wood).rotation.z=Math.PI/2;
   a.box('linen_fold',[s*12.45,.98+i*.07,-5.35],[.55,.06,.42],i%2?cloth:edge);
  }
 }
 // Meal and writing details are sized to the characters, not enlarged proxy boxes.
 for(const x of[-2,0,2]){
  a.box('dining_placemat',[x,1.002,-8.3],[1.35,.012,1.18],cloth);
  a.box('dining_napkin',[x+.42,1.025,-8.12],[.22,.025,.3],edge);
  for(const dx of[-.38,.65])a.box('dining_cutlery',[x+dx,1.026,-8.25],[.025,.018,.42],brass);
 }
 a.cyl('serving_teapot_body',[.8,1.18,-8.65],.2,.31,edge);
 a.cyl('serving_teapot_lid',[.8,1.35,-8.65],.16,.045,brass);
 const handle=a.mesh('teapot_handle',new THREE.TorusGeometry(.13,.025,5,12),a.mat(brass),[.56,1.2,-8.65],[1,1,1]);handle.rotation.y=Math.PI/2;
 a.beam('teapot_spout',[.97,1.16,-8.65],[1.15,1.3,-8.65],.065,edge);
 // Wardrobe doors are recessed with visible frame-and-panel construction.
 for(const s of[-1,1]){
  a.box('sleepwing_wardrobe',[s*7,1.15,-12.45],[2.6,2.3,.65],wood,true);
  for(const dx of[-.63,.63]){
   a.box('wardrobe_panel',[s*7+dx,1.19,-12.1],[1.12,1.88,.065],ink);
   a.box('wardrobe_pull',[s*7+dx-Math.sign(dx)*.39,1.12,-12.04],[.035,.2,.035],brass);
  }
 }
 // Closed gables with recessed sunburst joinery, rather than a thin triangle alone.
 for(const z of[-13.05,-.95])a.attic('residence_attic',0,z,28,30,4.7,2.15,'#e9e6d8',-.08);
 for(const s of[-1,1])a.beam('gable_sun_strut',[s*11,4.8,-.72],[s*2,6.33,-.72],.085,wood);
}
