import * as THREE from 'three';
import {SiteArt} from './campaignSites';
import type {AdventureAction} from './adventureSites';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeParts} from './settlements/merge';
import type {Collider} from './player';
import {ADVENTURE as A} from './openWorldCampaign';
/** Period materials, recognizable silhouettes and state-bearing mechanisms.
 * Static surfaces share three materials; moving handles and indicators are tiny. */
export function createAdventureFacilityArt(actions:ReadonlyMap<string,AdventureAction>){
 const a=new SiteArt(),root=a.root,dynamics:{mesh:THREE.Object3D;flag:string;rotate?:boolean}[]=[];
 const dark='#39474e',wood='#71583f',edge='#b49b6c',paper='#e0d0ad',steel='#708087';
 const indicatorOn=new THREE.MeshBasicMaterial({color:'#a4d6ad'}),indicatorOff=new THREE.MeshBasicMaterial({color:'#b37c4b'});
 const indicators:{mesh:THREE.Mesh;flag:string}[]=[];
 for(const action of actions.values()){
  const[x0,y,z0]=action.p,home=action.id.startsWith('adventure_home_'),z=z0+(home?2.5:0),x=x0+(home?-1:action.id==='adventure_winter_arrival'?-4.5:action.id==='adventure_winter_support'?-6:1.4),box=(dx:number,dy:number,dz:number,w:number,h:number,d:number,c:string,layer:'body'|'metal'|'glow'='body')=>a.box([x+dx,y+dy,z+dz],[w,h,d],c,w>.06&&h>.06&&d>.06,layer);
  if(action.id==='adventure_harbor_records')continue;
  if(action.id.includes('rigging')){
   a.cyl([x+1,y+.16,z],.7,.3,wood);a.cyl([x+1,y+.55,z],.32,.7,dark,false,'metal');
   for(let i=0;i<6;i++){const angle=i*Math.PI/3;box(1+Math.cos(angle)*.48,.9,Math.sin(angle)*.48,.9,.08,.08,wood);}
   for(const dy of[.3,.45,.6])a.ring([x+1,y+dy,z],.35,.04,edge,'metal',[Math.PI/2,0,0]);
   a.beam([x+1,y+.4,z],[x+2,y+.2,z+2],.045,edge);
  }else if(action.id.includes('depart')){
   box(1,1.8,0,.16,3.6,.16,wood);box(1,2.7,0,2.3,.12,.12,wood);
   for(const dx of[-.85,.85]){a.lantern(x+1+dx,y+2.25,z);box(1+dx,1.65,0,.4,.2,.08,edge,'metal');}
   box(1,1.05,-.1,1.3,.6,.08,dark);for(let i=0;i<3;i++)box(1,.9+i*.14,-.045,.95-i*.15,.025,.012,paper);
  }else if(action.id.includes('emitter')||action.id==='adventure_guardian'){
   box(1,.4,0,1.15,.8,.9,dark);for(const dx of[-.45,.45])box(1+dx,.08,0,.2,.16,1.3,steel,'metal');
   a.cyl([x+1,y+2.3,z],.075,3.8,steel,false,'metal');
   for(const dy of[2,3.1]){a.ring([x+1,y+dy,z],dy===2?.7:.45,.035,edge,'metal',[Math.PI/2,.3,0]);for(const dx of[-.8,.8])a.beam([x+1,y+dy,z],[x+1+dx,y+dy+.2,z],.025,steel);}
   const vane=new THREE.Group();vane.position.set(x+1,y+3.9,z);const blade=new THREE.Mesh(new THREE.BoxGeometry(1.4,.12,.12),a.materials.metal);vane.add(blade);root.add(vane);dynamics.push({mesh:vane,flag:action.flag??A.guardian,rotate:true});
  }else if(action.id==='adventure_tower'){
   box(1,.7,0,1.2,1.4,.6,dark);box(1,1.15,.32,.9,.4,.05,steel,'metal');a.ring([x+1,y+.8,z+.4],.27,.04,edge);
   for(const dx of[-.35,0,.35])box(1+dx,1.18,.37,.15,.12,.02,paper);
   for(const side of[-1,1])a.beam([x+1+side*.4,y+.05,z],[x+1+side*.6,y+.3,z-.7],.055,dark);
  }else if(action.id.includes('winter')&&!action.id.startsWith('adventure_home_')){
   if(action.id.includes('support')){box(1,1.5,0,.1,3,.1,wood);box(1.45,2.5,0,.9,.65,.04,'#667d91');box(1.45,2.5,.025,.1,.5,.015,paper);}
   else{box(1,.35,0,1.5,.7,.8,wood);for(const dx of[-.6,.6])box(1+dx,.4,0,.08,.8,.9,dark,'metal');box(1,.73,0,1.55,.1,.85,paper);for(const dx of[-.4,.4])a.cyl([x+1+dx,y+.92,z],.12,.3,'#7f775e');}
  }else if(action.id.includes('kyoto')&&!action.id.startsWith('adventure_home_')){
   box(1,1.1,0,.11,2.2,.12,wood);box(1,1.9,0,1.6,.12,.7,dark);for(const side of[-1,1])a.beam([x+1,y+1.3,z],[x+1+side*.7,y+1.85,z],.065,wood);
   box(1,1.2,.05,1,.65,.08,paper);for(const dx of[-.3,0,.3])for(let i=0;i<4;i++)box(1+dx,1.4-i*.12,.1,.035,.075,.012,dark);
   a.lantern(x+1,y+.6,z);
  }else if(action.id.startsWith('adventure_home_')){
   box(1,.6,0,1.6,1.2,.75,wood);box(1,1.25,0,1.9,.12,.95,paper);
   if(action.id.endsWith('britain')){a.ring([x+1,y+1.7,z],.38,.05,steel);a.beam([x+.8,y+1.35,z],[x+1.2,y+2.3,z],.07,edge);}
   else if(action.id.endsWith('blacksail')){box(1,1.4,0,1.1,.2,.45,dark);a.beam([x+1,y+1.4,z],[x+1,y+2.4,z],.025,wood);box(1.2,2,0,.5,.65,.025,paper);}
   else if(action.id.endsWith('winter')){box(1,1.4,0,.9,.25,.5,'#b9baa9');for(const dx of[-.25,.25])a.cyl([x+1+dx,y+1.65,z],.1,.3,'#86734e');}
   else{for(const dx of[-.3,.3]){a.cyl([x+1+dx,y+1.42,z],.12,.2,'#c0b49c');a.ring([x+1+dx,y+1.53,z],.11,.015,dark,'metal',[Math.PI/2,0,0]);}box(1,1.45,-.22,.8,.09,.3,paper);}
  }else{
   // Safe assembly points use destination lamps, not another identical control box.
   for(const dx of[-.65,.65]){box(1+dx,1.25,0,.1,2.5,.1,wood);a.lantern(x+1+dx,y+1.9,z);}
   box(1,1.2,0,1.4,.5,.07,paper);for(let i=0;i<3;i++)box(1,1.35-i*.14,.045,1-i*.15,.028,.018,dark);
  }
  if(action.flag){const led=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),indicatorOff);led.position.set(x+1,y+1.25,z+.43);root.add(led);indicators.push({mesh:led,flag:action.flag});}
 }
 a.finish('alpha');const collisionGeometry=mergeParts(a.solids);const colliders:Collider[]=[{name:'COL_JourneyFacilities',bvh:new MeshBVH(collisionGeometry),enabled:true}];root.name='JourneyFacilities_FinishedArt';
 return{root,colliders,apply(done:ReadonlySet<string>,dt:number){for(const item of indicators)item.mesh.material=done.has(item.flag)?indicatorOn:indicatorOff;for(const item of dynamics)if(item.rotate&&!done.has(item.flag))item.mesh.rotation.y+=Math.min(dt,.05)*.7;},
 dispose(){root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});Object.values(a.materials).forEach(m=>m.dispose());indicatorOn.dispose();indicatorOff.dispose();collisionGeometry.dispose();for(const g of a.solids)g.dispose();root.removeFromParent();},
 };
}
