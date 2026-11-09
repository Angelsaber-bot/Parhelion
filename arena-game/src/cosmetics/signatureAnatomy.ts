/** Working-firearm anatomy shared by every sculpted gun: an ejection port whose
 * bolt carrier rides the bolt kick, a fire selector, a magazine release and sling
 * swivels. Each detail is seated by casting onto the finish's own authored surface
 * (the side the first-person camera sees is −Z), so it sits flush on a koi, a
 * cassette or a whale skull alike and is skipped where no surface is found. */
import * as THREE from 'three';
import type {Sculpture} from './signatureModels.ts';

const ray=new THREE.Raycaster();
function solids(s:Sculpture,roles:readonly string[]){
 s.root.updateMatrixWorld(true);const meshes:THREE.Mesh[]=[];
 for(const role of roles)s.parts[role]?.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&!/glass|motes/i.test((m.material as THREE.Material).name))meshes.push(m);});
 return meshes;
}
/** First hit travelling along `dir` from far outside; returns point and face normal in model space. */
function cast(s:Sculpture,meshes:THREE.Mesh[],from:THREE.Vector3,dir:THREE.Vector3){
 ray.set(from,dir);ray.far=4;const hit=ray.intersectObjects(meshes,false)[0];if(!hit?.face)return null;
 const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);return{point:hit.point,normal};
}
function flank(s:Sculpture,meshes:THREE.Mesh[],x:number,y:number){
 const hit=cast(s,meshes,new THREE.Vector3(x,y,-2),new THREE.Vector3(0,0,1));return hit&&hit.normal.z<-.55?hit.point.z:null;
}
function underside(s:Sculpture,meshes:THREE.Mesh[],x:number){
 const hit=cast(s,meshes,new THREE.Vector3(x,-2,0),new THREE.Vector3(0,1,0));return hit&&hit.normal.y<-.4?hit.point.y:null;
}

export function addFirearmAnatomy(s:Sculpture){
 const muzzle=s.def.muzzle,[gx,gy]=s.def.grip;if(!muzzle)return;
 const body=solids(s,['body']),stock=solids(s,['stock']);
 // Ejection port with a bolt carrier that slides back on every shot.
 const flat=(x:number,y:number)=>[x-.08,x,x+.08].map(at=>flank(s,body,at,y)).reduce<number|null>((acc,z)=>acc===null||z===null?null:Math.min(acc,z),0);
 let px=0,py=0,zPort:number|null=null;
 for(const dy of[0,-.05,.05,-.1])for(const dx of[0,.1,-.1,.2]){if(zPort!==null)break;px=gx+.36+dx;py=Math.min(muzzle[1]+.06,gy+.5)+dy;zPort=flat(px,py);}
 if(zPort!==null){
  s.box([.22,.075,.006],[px,py,zPort-.002],s.dark,'body',.003);
  for(const dy of[-.042,.042])s.box([.24,.008,.008],[px,py+dy,zPort-.004],s.metal,'body',.002);
  for(const dx of[-.116,.116])s.box([.008,.09,.008],[px+dx,py,zPort-.004],s.metal,'body',.002);
  s.box([.12,.04,.012],[px+.02,py,zPort-.008],s.metal,'bolt',.004);
  for(let i=0;i<3;i++)s.box([.012,.03,.006],[px-.02+i*.03,py,zPort-.015],s.dark,'bolt',.001);
 }
 // Fire selector above the grip, with two lit position marks.
 let sx=0,sy=0,zSel:number|null=null;
 for(const dy of[0,-.05,.05,-.1])for(const dx of[0,.06,-.06]){if(zSel!==null)break;sx=gx+.12+dx;sy=gy+.33+dy;zSel=flank(s,body,sx,sy);}
 if(zSel!==null){
  s.mesh(new THREE.CylinderGeometry(.026,.026,.012,16),s.metal,[sx,sy,zSel-.005],'body',[Math.PI/2,0,0]);
  const lever=s.box([.07,.016,.008],[sx+.03,sy+.012,zSel-.012],s.metal,'body',.003);lever.rotation.z=.35;
  for(const [dx,dy]of[[-.04,.025],[.055,.04]]as const)s.mesh(new THREE.SphereGeometry(.006,8,6),s.glow,[sx+dx,sy+dy,zSel-.004]);
 }
 // Magazine release just ahead of the trigger guard.
 const mx=gx+.40,my=gy+.22,zMag=flank(s,body,mx,my);
 if(zMag!==null){s.mesh(new THREE.CylinderGeometry(.018,.02,.016,14),s.metal,[mx,my,zMag-.006],'body',[Math.PI/2,0,0]);s.ring(.024,.004,[mx,my,zMag-.002],s.dark);}
 // Sling swivels under the stock and under the fore-end.
 const tail=stock.length?(()=>{const box=new THREE.Box3();for(const m of stock)box.expandByObject(m);return box.min.x+.18;})():null;
 for(const [x,meshes,role]of[[tail,stock,'stock'],[s.def.support[0]+.18,body,'body']]as const){
  if(x===null)continue;const yb=underside(s,meshes as THREE.Mesh[],x);if(yb===null)continue;
  s.box([.03,.03,.02],[x,yb-.008,0],s.metal,role,.006);s.ring(.026,.0055,[x,yb-.034,0],s.metal,role);
 }
}
