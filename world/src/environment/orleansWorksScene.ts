import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Marker} from '../core/types';
import type {Collider} from '../player/player';
import {toonMaterial} from '../rendering/look';
import {ORLEANS_WORK_ACTIONS,ORLEANS_WORKS as W,ORLEANS_SLUICE_GATE as G} from '../map/orleansWorks';

const OX=-720,OZ=-720;
export function createOrleansWorksScene(ground:(x:number,z:number,ceiling:number)=>number|null){
 const root=new THREE.Group();root.name='OrleansPublicWorks';
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Map<string,THREE.Material>();
 const own=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
 const cube=own(new THREE.BoxGeometry(1,1,1)),cylinder=own(new THREE.CylinderGeometry(1,1,1,10));
 function material(color:string){let m=materials.get(color);if(!m){const source=new THREE.MeshStandardMaterial({name:'M_OrleansCraft',color,roughness:.85});m=toonMaterial(source);source.dispose();materials.set(color,m);}return m;}
 function mesh(g:THREE.BufferGeometry,color:string,parent:THREE.Object3D,p:readonly number[]=[0,0,0],s:readonly number[]=[1,1,1]){
  const m=new THREE.Mesh(g,material(color));m.position.set(p[0],p[1],p[2]);m.scale.set(s[0],s[1],s[2]);m.receiveShadow=true;parent.add(m);return m;
 }
 const box=(parent:THREE.Object3D,p:readonly number[],s:readonly number[],color:string)=>mesh(cube,color,parent,p,s);
 function beam(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,color:string){const m=mesh(cylinder,color,parent,a.clone().add(b).multiplyScalar(.5).toArray(),[r,a.distanceTo(b),r]);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}
 function compact(group:THREE.Group){
  const bins=new Map<THREE.Material,THREE.BufferGeometry[]>();
  for(const child of [...group.children])if(child instanceof THREE.Mesh){child.updateMatrix();const g=child.geometry.clone().applyMatrix4(child.matrix),m=child.material as THREE.Material;const list=bins.get(m)??[];list.push(g);bins.set(m,list);group.remove(child);}
  for(const [m,parts] of bins){const g=own(mergeGeometries(parts));for(const p of parts)p.dispose();const out=new THREE.Mesh(g,m);out.receiveShadow=true;group.add(out);}
 }
 const markers:Marker[]=ORLEANS_WORK_ACTIONS.map(a=>{
  const [x,y,z]=a.position,wx=x+OX,wz=z+OZ,floor=ground(wx,wz,y+1.5);
  const standing=floor!==null&&Math.abs(floor-y)<1.5?floor:y;
  return{id:a.id,type:'interact',label:a.label[0],p:[wx,standing+.95,wz],radius:2.6,note:a.hint[0]};
 });
 // Twin treadwheels turn around their actual axle; material merging keeps them
 // to two draws rather than a draw for every tread and spoke.
 const drums=new THREE.Group();drums.name='OrleansCraneDrums';drums.position.set(OX-174.5,14.15,OZ-8);root.add(drums);
 const rim=own(new THREE.TorusGeometry(3.3,.17,5,24));
 for(const side of [-1,1]){
  mesh(rim,'#987650',drums,[0,0,side*2.5]);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;beam(drums,new THREE.Vector3(0,0,side*2.5),new THREE.Vector3(Math.cos(a)*3.2,Math.sin(a)*3.2,side*2.5),.075,'#66513d');}
 }
 for(let i=0;i<18;i++){const a=i/18*Math.PI*2;box(drums,[Math.cos(a)*3.2,Math.sin(a)*3.2,0],[.23,.23,5.1],'#987650');}
 compact(drums);
 const barge=new THREE.Group();barge.name='OrleansGrainBarge';barge.position.set(OX-197,.3,OZ-8);root.add(barge);
 box(barge,[0,0,0],[4,.45,6.5],'#66513d');
 for(const x of [-2,2])box(barge,[x,.45,0],[.18,.8,6.5],'#987650');
 for(const z of [-3.2,3.2])box(barge,[0,.45,z],[4,.8,.18],'#987650');
 for(let i=0;i<12;i++)box(barge,[0,.25,-2.9+i*.52],[3.8,.08,.46],'#987650');
 compact(barge);
 const cargo=new THREE.Group();cargo.name='OrleansCraneGrain';root.add(cargo);
 for(let i=0;i<5;i++)box(cargo,[-1+i*.5,.12,0],[.44,.24,2.2],'#987650');
 for(const x of [-.8,.8])box(cargo,[x,-.03,0],[.2,.18,2.4],'#66513d');
 const sack=own(new THREE.IcosahedronGeometry(.48,1));
 for(const x of [-.6,.55])for(const z of [-.6,.55])mesh(sack,'#b5a57e',cargo,[x,.65,z],[1.15,.85,1]);
 for(const side of [-1,1]){beam(cargo,new THREE.Vector3(side*1.1,.3,-.9),new THREE.Vector3(0,1.6,0),.026,'#806649');beam(cargo,new THREE.Vector3(side*1.1,.3,.9),new THREE.Vector3(0,1.6,0),.026,'#806649');}
 compact(cargo);
 const rope=mesh(cylinder,'#a68d61',root),trolley=box(root,[OX-197,18.4,OZ-8],[.8,.45,.7],'#465665');
 const landing=ground(OX-185.6,OZ-8,10),loadFloor=(landing!==null&&Number.isFinite(landing)?landing:8.45)+.08;
 // The quay-side handle fits the existing clear standing space.
 const craneControl=new THREE.Group();craneControl.position.set(markers[0].p[0],markers[0].p[1]-.95,markers[0].p[2]-.95);root.add(craneControl);
 for(const x of [-.55,.55])box(craneControl,[x,.75,0],[.16,1.5,.4],'#66513d');
 const hand=new THREE.Group();hand.position.set(0,1.2,.25);craneControl.add(hand);
 mesh(own(new THREE.TorusGeometry(.52,.065,5,16)),'#b9a26c',hand);
 beam(hand,new THREE.Vector3(-.5,0,0),new THREE.Vector3(.5,0,0),.05,'#987650');
 beam(hand,new THREE.Vector3(.45,0,0),new THREE.Vector3(.45,0,.28),.06,'#66513d');
 // Portcullis bars retract into the masonry pocket. One physical collider is
 // enabled until the operation actually completes, then permanently disabled.
 const gate=new THREE.Group();gate.name='OrleansServiceGrille';gate.position.set(OX+G.position[0],G.position[1],OZ+G.position[2]);gate.rotation.y=G.yaw;root.add(gate);
 const bars=new THREE.InstancedMesh(cube,material('#465665'),9),rungs=new THREE.InstancedMesh(cube,material('#746f60'),3);gate.add(bars,rungs);
 bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rungs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 const gateGeometry=own(new THREE.BoxGeometry(G.width,G.height,.4).translate(0,G.position[1]+G.height/2,0).rotateY(G.yaw).translate(OX+G.position[0],0,OZ+G.position[2]));
 const collider:Collider={name:'COL_Orleans_ServiceGrille',bvh:new MeshBVH(gateGeometry),enabled:true};
 const winch=new THREE.Group();winch.position.set(markers[1].p[0],markers[1].p[1]-.95,markers[1].p[2]-.95);root.add(winch);
 for(const x of [-.65,.65])box(winch,[x,.6,0],[.2,1.2,.8],'#66513d');
 const wheel=new THREE.Group();wheel.position.set(0,1.1,.3);winch.add(wheel);
 mesh(own(new THREE.TorusGeometry(.62,.075,5,18)),'#987650',wheel);
 for(const a of [0,Math.PI/2]){const spoke=box(wheel,[0,0,0],[1.2,.07,.07],'#746f60');spoke.rotation.z=a;}
 beam(wheel,new THREE.Vector3(.54,0,0),new THREE.Vector3(.54,0,.32),.06,'#66513d');
 // Flared bell and independent clapper; saved completion never rings on load.
 const bell=new THREE.Group();bell.name='OrleansBelfryBell';bell.position.set(OX-12,41.5,OZ-62);root.add(bell);
 const profile=[[.5,0],[.6,-.4],[.72,-1],[1.05,-1.6],[1.75,-2.2],[2.1,-2.4],[2.1,-2.65],[1.8,-2.65],[1.5,-2.25],[.85,-1.7],[.5,-1],[.35,-.4]].map(p=>new THREE.Vector2(p[0],p[1]));
 mesh(own(new THREE.LatheGeometry(profile,24)),'#b7a267',bell);
 mesh(own(new THREE.SphereGeometry(.26,8,6)),'#66513d',bell,[0,-2.45,0]);beam(bell,new THREE.Vector3(0,-.2,0),new THREE.Vector3(0,-2.4,0),.08,'#66513d');
 const ropeTop=new THREE.Vector3(OX-23,42,OZ-62),ropeBottom=new THREE.Vector3(OX-23,40.1,OZ-62);
 const bellRope=beam(root,ropeTop,ropeBottom,.035,'#a68d61');
 beam(root,new THREE.Vector3(OX-12,41.5,OZ-62),ropeTop,.035,'#a68d61');
 mesh(own(new THREE.TorusGeometry(.17,.03,5,12)),'#a68d61',root,ropeBottom.toArray());
 let disposed=false,ringTime=0;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 const smooth=(a:number,b:number,t:number)=>THREE.MathUtils.smoothstep(t,a,b);
 function apply(done:ReadonlySet<string>,active:string|null=null,progress=0){
  if(disposed)return;
  const amount=Number.isFinite(progress)?THREE.MathUtils.clamp(progress,0,1):0;
  const c=done.has(W.craneDone)?1:active===W.crane?amount:0;
  const lift=smooth(0,.55,c),travel=smooth(.55,.85,c),lower=smooth(.85,1,c);
  cargo.position.set(OX+THREE.MathUtils.lerp(-197,-185.6,travel),THREE.MathUtils.lerp(.8,11.5,lift)-(11.5-loadFloor)*lower,OZ-8);
  const bottom=cargo.position.y+1.6;rope.position.set(cargo.position.x,(18.35+bottom)/2,OZ-8);rope.scale.set(.035,Math.max(.1,18.35-bottom),.035);trolley.position.x=cargo.position.x;drums.rotation.z=-c*Math.PI*7;hand.rotation.z=-c*Math.PI*6;
  const f=done.has(W.sluiceDone)?1:active===W.sluice?amount:0;
  gate.visible=f<.999;collider.enabled=!done.has(W.sluiceDone);wheel.rotation.z=-f*Math.PI*6;
  const height=Math.max(.0001,G.height*(1-f));
  for(let i=0;i<9;i++){matrix.compose(new THREE.Vector3(-2.08+i*.52,G.height-height/2,0),q,new THREE.Vector3(.15,height,.16));bars.setMatrixAt(i,matrix);}
  for(let i=0;i<3;i++){const y=.5+i*1.55+f*G.height;matrix.compose(new THREE.Vector3(0,y,0),q,new THREE.Vector3(y<G.height?4.45:.0001,.17,.2));rungs.setMatrixAt(i,matrix);}
  bars.instanceMatrix.needsUpdate=true;rungs.instanceMatrix.needsUpdate=true;bars.computeBoundingSphere();rungs.computeBoundingSphere();
  const pull=active===W.bell?Math.sin(amount*Math.PI):0;bellRope.position.y=(ropeTop.y+ropeBottom.y)/2-pull*.15;
 }
 return{root,markers,collider,apply,
  ring(){if(!disposed)ringTime=6;},
  update(dt:number,viewer:THREE.Vector3){if(disposed)return;root.visible=Math.hypot(viewer.x-OX,viewer.z-OZ)<600;if(Number.isFinite(dt)&&dt>0){ringTime=Math.max(0,ringTime-Math.min(.05,dt));bell.rotation.z=Math.sin((6-ringTime)*7.2)*.18*(ringTime/6);}},
  dispose(){if(disposed)return;disposed=true;collider.enabled=false;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();root.clear();},
 };
}
