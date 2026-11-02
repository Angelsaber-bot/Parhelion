import * as THREE from 'three';
import {SiteArt} from './campaignSites';
import {RESIDENT_ACTIONS} from './residentEventRules';
import type {Marker} from './types';
import type {Localized,RegionId} from './settlements/types';
export interface ResidentEventHooks{done:Set<string>;reachable(id:string):boolean;save():void;changed():void;toast(line:Localized):void;}
export function createResidentEventRuntime(h:ResidentEventHooks){
 let carrying:'blanket'|'page'|null=null,dial=h.done.has('campaign_alpha_worked')?1:0,horseSearch=h.done.has('resident_winter_horse_trail'),crossing=false,usedGlider=false;
 const commit=(flag:string)=>{if(h.done.has(flag))return;h.done.add(flag);h.save();h.changed();};
 const worked=(region:RegionId)=>commit(`campaign_${region}_worked`),first=(region:RegionId)=>commit(`campaign_${region}_work_step_1`);
 const actions=new Map(RESIDENT_ACTIONS.map(a=>[a.id,a]));
 return{get carrying(){return carrying;},get dial(){return dial;},get horseSearch(){return horseSearch;},get crossing(){return crossing;},
 interact(id:string){const a=actions.get(id);if(!a||!h.reachable(id))return false;
  if(a.kind==='horse'){if(id.endsWith('hoofprints')){horseSearch=true;commit('resident_winter_horse_trail');h.toast(['蹄印绕到营帐东边的新草旁。白马没有走远。','The prints lead east of the tent to fresh grass. The white horse has not gone far.']);}else if(horseSearch){commit('resident_winter_horse_found');h.toast(['拿破仑：“它比军需官更早发现了补给。算它一功。”','Napoleon: “It found supplies before the quartermaster. Credit where it is due.”']);}else h.toast(['先看看营帐边的蹄印，再沿线找过来。','Inspect the prints beside the tent, then follow them.']);return true;}
  if(a.kind==='cross-start'){crossing=true;usedGlider=false;h.toast(['挑战开始：沿跳石或滑翔穿过河面，留在这段河道内；鞋碰到水就重来。','Crossing started: use the stones or glide within this stretch of river. Touching the water requires another try.']);return true;}
  if(a.kind==='cross-finish'){if(crossing){commit('resident_kyoto_dry_shoes');if(usedGlider)commit('resident_kyoto_glider_trick');crossing=false;h.toast(usedGlider?['武藏：“说的是不湿鞋，可没说不能借风。算你赢。”','Musashi: “I said dry shoes, not no wind. You win.”']:['武藏：“脚步很稳。以后过火线，也记得找落脚处。”','Musashi: “Steady feet. Remember to find your footing in the fire too.”']);}else h.toast(['先从西岸起点开始；落水或离开河道后可以立即重来。','Begin at the west bank. After touching water or leaving the stretch, restart whenever ready.']);return true;}
  if(!h.done.has(`campaign_${a.region}_met`)){h.toast(['先与这里的居民交谈，了解他需要保住的东西。','Speak with the resident first and learn what they need to preserve.']);return true;}
  if(h.done.has(`campaign_${a.region}_worked`)){h.toast(['工作已经落实，现场结果仍然保留。回居民身边决定接下来的安排。','The work is complete and remains in place. Return to the resident to decide the next arrangement.']);return true;}
  const f=h.done.has(`campaign_${a.region}_work_step_1`);
  switch(a.kind){
   case 'ground':first('alpha');h.toast(['接地夹扣紧，嗡鸣消失。观察另一边回传灯的双脉冲。','The clip is grounded; the hum stops. Observe the double pulse on the other lamp.']);break;
   case 'observe':if(f){commit(a.fact!);h.toast(['双脉冲对应第二档。微弱的回应每次都会停下来等。','The double pulse matches position two. The faint reply pauses each time to wait.']);}else h.toast(['先扣好接地夹，让回传灯稳定下来。','Ground the receiver first so the return lamp can stabilize.']);break;
   case 'tune':if(!f||!h.done.has('resident_alpha_rhythm')){h.toast(['先接地，再观察回传节拍。','Ground the receiver and observe the return cadence first.']);break;}dial=(dial+1)%3;if(dial===1){worked('alpha');h.toast(['回声与刻度对齐，杂音退到声音后面。岚听见了一个真正等过回答的人。','The cadence aligns; static falls behind the voice. Lan hears someone who really waited for an answer.']);}else h.toast([`当前第 ${dial+1} 档，回应仍未对齐。`,`Position ${dial+1}; the reply is not aligned yet.`]);break;
   case 'order':first('britain');h.toast(['旧名册露出来了。到城门和修院核对两处记录，再回来保留无法确认的空行。','The old roll is visible. Check the gate and abbey records before marking the unknown lines.']);break;
   case 'witness':commit(a.fact!);h.toast(id.endsWith('_a')?['这些刻名仍有人辨认；已经核实。','These inscribed names are still recognized and verified.']:['这里的三行没有可靠见证。不要为他们编造名字。','Three lines have no reliable witness. Do not invent their names.']);break;
   case 'stamp':if(f&&h.done.has('resident_britain_witness_a')&&h.done.has('resident_britain_witness_b')){worked('britain');h.toast(['空行保留，旁边留下待核实印记。艾妲没有把记名变成另一份征召。','The blanks remain, marked for verification. Ada’s record has not become another draft order.']);}else h.toast(['先核实两处记录，印章不能代替见证。','Verify both records first; a stamp cannot replace a witness.']);break;
   case 'manifest':commit(a.fact!);if(['a','b','c'].every(k=>h.done.has(`resident_blacksail_manifest_${k}`)))first('blacksail');h.toast(id.endsWith('_a')?['货重牌：三次航行都满载。','Cargo board: three fully laden voyages.']:id.endsWith('_b')?['口粮牌：三次都没有一份水手口粮。','Ration board: not one crew ration on any voyage.']:['值守牌：同一批货物在同一时刻重新搬回。','Watch record: the same cargo returns at the same hour.']);break;
   case 'hood':if(!f){h.toast(['先核对三处记录。航路没有清出之前，只能标明等待线。','Compare all three records first. Before the channel clears, mark only a holding line.']);break;}worked('blacksail');h.toast(['遮板转向暖灯等待线，港口不再把船引向冷灯。','The hood turns to the warm-light holding line; ships are no longer directed toward the cold lamp.']);break;
   case 'blanket':if(!f&&!carrying){carrying='blanket';h.changed();h.toast(['干布已拿起，走到担架底部再铺下。','Blanket picked up. Carry it to the stretcher underside.']);}break;
   case 'underlay':if(carrying==='blanket'){carrying=null;first('winter');h.toast(['底部漏风处已经盖好，再固定两端绑带。','The draft underneath is covered. Secure both end straps.']);}else h.toast(['先拿起备用干布卷。','Pick up the spare blanket roll first.']);break;
   case 'strap':if(f){commit(a.fact!);if(h.done.has('resident_winter_strap_a')&&h.done.has('resident_winter_strap_b'))worked('winter');h.toast(['绑带避开伤处，抬杆可以自由活动。','The strap avoids the wound and leaves the handles clear.']);}else h.toast(['先把干布垫在担架底部，再固定绑带。','Pad the stretcher underside before fastening its straps.']);break;
   case 'page':if(!f&&!carrying){carrying='page';h.changed();h.toast(['湿页从松边分开了，托着它走到通风架。','The page lifts from its loose edge. Carry it to the drying rack.']);}break;
   case 'rack':if(carrying==='page'){carrying=null;const count=['1','2','3'].filter(k=>h.done.has(`resident_kyoto_page_${k}`)).length;commit(`resident_kyoto_page_${count+1}`);if(count>=2)first('kyoto');h.toast([`已摊开 ${Math.min(3,count+1)}/3 页，纸页之间留着风。`,`${Math.min(3,count+1)}/3 pages spread with air between them.`]);}else h.toast(['先从湿页松开的边取下一页。','Lift a page from its loose edge first.']);break;
   case 'weight':if(f){commit(a.fact!);if(h.done.has('resident_kyoto_weight_a')&&h.done.has('resident_kyoto_weight_b'))worked('kyoto');h.toast(['木片压住卷角，纸页仍然保持通风。','The strip holds the curling corner while leaving air between the pages.']);}else h.toast(['先把三页分别摊到晾架，再压住卷角。','Spread all three pages on the rack before weighting their corners.']);break;
  }return true;
 },
 update(p:THREE.Vector3,gliding:boolean,playable:boolean){if(!playable||!crossing)return;usedGlider ||=gliding;const wet=p.x>141&&p.x<164&&p.z>774&&p.z<786&&p.y<1.3;const outside=p.z<772||p.z>788||p.x<120||p.x>185;if(wet||outside){crossing=false;h.toast(wet?['鞋碰到水了。回西岸起点可以马上重来。','Your shoes touched water. Restart at the west bank whenever ready.']:['已经离开这段挑战河道。回起点可以重新尝试。','You left the challenge stretch. Return to the start to try again.']);}},
 cancelCarry(){const changed=!!carrying;carrying=null;crossing=false;if(changed)h.changed();},reset(){carrying=null;crossing=false;horseSearch=h.done.has('resident_winter_horse_trail');dial=h.done.has('campaign_alpha_worked')?1:0;},
 };
}

export function createResidentEventScene(workMarkers:readonly Marker[],floor:(x:number,z:number,ceiling?:number)=>number|null,clear:(p:THREE.Vector3)=>boolean){
 const root=new THREE.Group(),markers:Marker[]=[],origins=new Map<RegionId,THREE.Vector3>(),props=new Map<string,THREE.Object3D>();
 const regions=['alpha','britain','blacksail','winter','kyoto']as const;
 const arts=new Map(regions.map(r=>[r,new SiteArt()])),points=new Map<string,THREE.Vector3>();
 for(const region of regions){const m=workMarkers.find(m=>m.id===`campaign_${region}_work`)!;origins.set(region,new THREE.Vector3(m.p[0],m.p[1]-.9,m.p[2]));}
 const choose=(x:number,z:number,y:number)=>{for(const[dx,dz]of[[0,0],[.8,0],[-.8,0],[0,.8],[0,-.8],[1.4,0],[-1.4,0],[0,1.4],[0,-1.4]]){const h=floor(x+dx,z+dz,y+2)??floor(x+dx,z+dz);if(h!==null&&clear(new THREE.Vector3(x+dx,h+.04,z+dz)))return new THREE.Vector3(x+dx,h,z+dz);}return new THREE.Vector3(x,y,z);};
 const materials={paper:new THREE.MeshStandardMaterial({color:'#dccda7',roughness:.95}),cloth:new THREE.MeshStandardMaterial({color:'#b4b6a1',roughness:1}),blue:new THREE.MeshStandardMaterial({color:'#496874',roughness:.7}),brass:new THREE.MeshStandardMaterial({color:'#b39d69',metalness:.5,roughness:.4}),ink:new THREE.MeshStandardMaterial({color:'#4b5047',roughness:.9}),green:new THREE.MeshBasicMaterial({color:'#9dc5a8'})};
 const movable=(parent:THREE.Object3D,name:string,size:[number,number,number],p:[number,number,number],material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.fromArray(p);parent.add(mesh);return mesh;};
 const dynamics=new Map<string,THREE.Mesh>();
 for(const a of RESIDENT_ACTIONS){const origin=origins.get(a.region)!,p=a.world?choose(a.world[0],a.world[2],a.world[1]):choose(origin.x+a.offset![0],origin.z+a.offset![1],origin.y);points.set(a.id,p);markers.push({id:a.id,type:'interact',label:a.label[0],p:[p.x,p.y+.9,p.z],radius:1.7});}
 for(const a of RESIDENT_ACTIONS){
  const p=points.get(a.id)!,art=arts.get(a.region)!,prop=new THREE.Group();prop.name=a.id;prop.position.copy(p).add(new THREE.Vector3(.8,0,-.25));root.add(prop);props.set(a.id,prop);
  const x=prop.position.x,y=prop.position.y,z=prop.position.z;
  const box=(dx:number,dy:number,dz:number,w:number,h:number,d:number,color:string)=>art.box([x+dx,y+dy,z+dz],[w,h,d],color);
  const legTable=(w=1.1,d=.7)=>{box(0,.76,0,w,.08,d,'#786146');for(const dx of[-w*.4,w*.4])for(const dz of[-d*.38,d*.38])box(dx,.36,dz,.07,.72,.07,'#564735');};
  const scroll=(rows=4)=>{box(0,.94,0,.86,.48,.06,'#b69a6a');box(0,.94,.04,.76,.4,.015,'#e0d0a7');for(let i=0;i<rows;i++)box(-.05,1.08-i*.09,.055,.57-(i%2)*.12,.015,.01,'#56594d');for(const dx of[-.36,.36])box(dx,.5,0,.06,.8,.06,'#67543b');};
  if(a.kind==='ground'||a.kind==='observe'||a.kind==='tune'){
   legTable();box(0,1.04,0,1,.5,.48,'#3d5b68');box(0,1.06,.25,.87,.35,.035,'#9caa9f');
   for(let i=0;i<6;i++)box(-.32+i*.045,1.04,.274,.015,.24,.012,'#46524d');
   art.ring([x+.23,y+1.07,z+.28],.12,.018,'#c0a56b');
   if(a.kind==='ground'){art.beam([x-.45,y+.9,z],[x-.7,y+.08,z+.12],.025,'#736338');box(-.7,.1,.12,.15,.2,.06,'#b9a06e');const clip=movable(prop,'GroundingClip',[.18,.07,.07],[-.47,.9,.16],materials.brass);dynamics.set('clip',clip);}
   if(a.kind==='observe'){art.beam([x,y+1.3,z],[x,y+2.3,z],.035,'#b39c6f');art.beam([x-.4,y+2.2,z],[x+.4,y+2.2,z],.025,'#8a989b');}
   if(a.kind==='tune'){const knob=movable(prop,'DialPointer',[.025,.14,.045],[.23,1.07,.315],materials.ink);dynamics.set('dial',knob);for(let i=0;i<3;i++){const angle=(i-1)*.85;box(.23+Math.sin(angle)*.17,1.07+Math.cos(angle)*.17,.28,.025,.025,.025,'#4a514c');}}
  }else if(a.kind==='order'||a.kind==='stamp'){
   legTable(1.5,1);for(let i=0;i<3;i++){art.paper(x+(i-1)*.36,y+.82,z,.34,.65);}
   if(a.kind==='order'){const order=movable(prop,'LaterMusterOrder',[1.05,.025,.74],[0,.85,0],materials.paper);dynamics.set('order',order);}
   else{box(.5,.95,.1,.12,.23,.12,'#6e3a30');box(.5,.84,.1,.22,.05,.22,'#4c3834');for(let i=0;i<3;i++){const mark=movable(prop,`VerificationMark${i}`,[.09,.008,.06],[.1,.855,-.2+i*.15],materials.blue);dynamics.set(`stamp${i}`,mark);}}
  }else if(a.kind==='witness'||a.kind==='manifest'){
   scroll(a.kind==='witness'?3:4);const seal=movable(prop,'CheckedSeal',[.09,.09,.02],[.27,.82,.07],materials.green);dynamics.set(a.id,seal);
   if(a.kind==='manifest'){box(.5,.15,0,.5,.3,.5,'#78614a');for(const dx of[.31,.69])box(dx,.15,0,.04,.32,.54,'#4d5656');}
  }else if(a.kind==='hood'){
   box(0,1.1,0,.12,2.2,.12,'#66513b');art.lantern(x,y+1.75,z);art.ring([x,y+1.75,z],.42,.03,'#a28e62');
   const hood=movable(prop,'RotatingHarborHood',[.7,.65,.05],[0,1.75,-.21],materials.blue);dynamics.set('hood',hood);art.beam([x,y+1.3,z],[x+.5,y+1.3,z],.045,'#b6a06d');
  }else if(a.kind==='blanket'){
   legTable(.85,.65);const roll=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.8,16),materials.cloth);roll.name='SpareBlanket';roll.rotation.z=Math.PI/2;roll.position.y=.98;prop.add(roll);dynamics.set('blanket',roll);for(const dx of[-.25,.25])art.ring([x+dx,y+.98,z],.186,.02,'#6e6455','body',[0,Math.PI/2,0]);
  }else if(a.kind==='underlay'){
   for(const side of[-.4,.4]){art.beam([x+side,y+.6,z-1.25],[x+side,y+.6,z+1.25],.065,'#6f543b');for(const dz of[-.7,.7])box(side,.3,dz,.055,.6,.07,'#645039');}
   box(0,.62,0,.73,.06,1.8,'#908672');const cover=movable(prop,'InsulatingUnderlay',[.75,.035,1.75],[0,.57,0],materials.cloth);dynamics.set('underlay',cover);box(0,.7,-.58,.5,.14,.3,'#c5bda6');box(0,.67,.02,.22,.018,.3,'#83584c');
   for(const[i,dz]of[-.5,.6].entries()){const strap=movable(prop,`TiedStrap${i}`,[.88,.04,.09],[0,.69,dz],materials.brass);dynamics.set(`strap${i}`,strap);}
  }else if(a.kind==='strap'){
   box(0,.4,0,.42,.8,.4,'#76624a');art.ring([x,y+.84,z],.13,.025,'#b79f6e','metal',[Math.PI/2,0,0]);
  }else if(a.kind==='page'){
   legTable(1,.9);for(let i=0;i<3;i++){const page=movable(prop,`WetPage${i}`,[.64,.014,.72],[(i-1)*.04,.82+i*.02,0],materials.paper);page.rotation.y=(i-1)*.08;dynamics.set(`wet${i}`,page);}
  }else if(a.kind==='rack'){
   legTable(2.4,1.1);for(let slat=-5;slat<=5;slat++)box(slat*.21,.83,0,.04,.045,1.05,'#a1855a');
   for(let i=0;i<3;i++){const page=movable(prop,`DryingPage${i}`,[.62,.014,.78],[(i-1)*.75,.87,0],materials.paper);dynamics.set(`page${i}`,page);for(let j=0;j<4;j++)movable(page,`Ink${j}`,[.4,.005,.012],[0,.01,-.24+j*.14],materials.ink);}
   for(const[i,dx]of[-.98,.98].entries()){const weight=movable(prop,`CornerWeight${i}`,[.11,.045,.7],[dx,.9,0],materials.ink);dynamics.set(`weight${i}`,weight);}
  }else if(a.kind==='weight'){
   box(0,.35,0,.65,.7,.5,'#745c40');box(0,.73,0,.5,.05,.22,'#4e5346');
  }else if(a.kind==='horse'){
   if(a.id.endsWith('hoofprints'))for(let i=0;i<12;i++)for(const side of[-1,1])art.ring([p.x+i*1.05+side*.24,p.y+.025,p.z+i*.36],.11,.025,'#887e70','body',[Math.PI/2,0,0]);
   else for(let i=0;i<15;i++){const angle=i*2.4;art.beam([x+Math.cos(angle)*.7,y,z+Math.sin(angle)*.6],[x+Math.cos(angle)*.75,y+.23,z+Math.sin(angle)*.66],.025,'#8c9670');}
  }else if(a.kind==='cross-start'||a.kind==='cross-finish'){
   for(const dx of[-.55,.55]){box(dx,.75,0,.08,1.5,.08,'#927047');art.ring([x+dx,y+1.4,z],.09,.02,'#c3b491');}box(0,1.32,0,1.2,.3,.025,a.kind==='cross-start'?'#536e6c':'#a19066');
  }
 }
 for(const[region,art]of arts){art.finish(region);root.add(art.root);}
 const carried=new THREE.Mesh(new THREE.BoxGeometry(.7,.14,.5),materials.cloth);carried.name='CarriedResidentItem';root.add(carried);carried.visible=false;
 const pulse=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),materials.green);pulse.position.set(.23,1.07,.3);props.get('resident_alpha_rhythm')!.add(pulse);
 const show=(key:string,visible:boolean)=>{const node=dynamics.get(key);if(node)node.visible=visible;};
 function apply(done:ReadonlySet<string>,position:THREE.Vector3,time:number,carrying:'blanket'|'page'|null,dial:number){
  for(const art of arts.values())art.root.visible=art.root.children.some(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry?.boundingSphere)mesh.geometry?.computeBoundingSphere();return !!mesh.geometry?.boundingSphere&&mesh.geometry.boundingSphere.center.distanceTo(position)<mesh.geometry.boundingSphere.radius+130;});
  for(const prop of props.values())prop.visible=prop.position.distanceToSquared(position)<160*160;
  carried.visible=!!carrying;carried.position.copy(position).add(new THREE.Vector3(.3,1,-.35));carried.scale.y=carrying==='page'?.12:1;carried.material=carrying==='page'?materials.paper:materials.cloth;
  pulse.visible=(time%1.6<.15)||(time%1.6>.35&&time%1.6<.5);
  dynamics.get('dial')!.rotation.z=-((done.has('campaign_alpha_worked')?1:dial)-1)*.85;dynamics.get('clip')!.position.y=done.has('campaign_alpha_work_step_1')?.15:.9;
  show('order',!done.has('campaign_britain_worked')&&!done.has('campaign_britain_work_step_1'));for(let i=0;i<3;i++)show(`stamp${i}`,done.has('campaign_britain_worked'));
  for(const a of RESIDENT_ACTIONS)if(a.fact&&dynamics.has(a.id))show(a.id,done.has(a.fact)||done.has(`campaign_${a.region}_worked`));
  dynamics.get('hood')!.rotation.y=done.has('campaign_blacksail_worked')?Math.PI/2:0;
  show('blanket',!done.has('campaign_winter_worked')&&!done.has('campaign_winter_work_step_1')&&carrying!=='blanket');show('underlay',done.has('campaign_winter_worked')||done.has('campaign_winter_work_step_1'));
  for(let i=0;i<2;i++){show(`strap${i}`,done.has('campaign_winter_worked')||done.has(`resident_winter_strap_${i?'b':'a'}`));show(`weight${i}`,done.has('campaign_kyoto_worked')||done.has(`resident_kyoto_weight_${i?'b':'a'}`));}
  const dried=done.has('campaign_kyoto_worked')?3:['1','2','3'].filter(k=>done.has(`resident_kyoto_page_${k}`)).length;
  for(let i=0;i<3;i++){show(`wet${i}`,i>=dried+(carrying==='page'?1:0));const page=dynamics.get(`page${i}`)!;page.visible=done.has('campaign_kyoto_worked')||done.has(`resident_kyoto_page_${i+1}`);page.rotation.z=done.has('campaign_kyoto_worked')?0:Math.sin(time*3+i)*.025;}
 }
 return{root,markers,props,origins,apply,carried,horseSpot:markers.find(m=>m.id==='resident_winter_horse')!.p,
  dispose(){const geometries=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());for(const art of arts.values()){Object.values(art.materials).forEach(m=>{if(!mats.has(m))m.dispose();});art.solids.forEach(g=>g.dispose());}root.removeFromParent();},
 };
}
