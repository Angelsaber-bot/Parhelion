import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {toonMaterial} from '../rendering/look';
import {EXPANSION_PLANS} from '../map/worldPlan';
import {ORLEANS_BRIDGE_MILL as BM,ORLEANS_OFFSET,ORLEANS_WINDMILL as WM} from '../map/orleansOutskirts';

/**
 * The two machines of Orleans' outskirts that never stop: the undershot wheel hung
 * beside the bridge-mill pier and the cloth sails of the east ridge windmill.
 * Each is one merged mesh per colour, turned about its own shaft.
 */
export function createOrleansOutskirtsScene(){
  const [OX,OZ]=ORLEANS_OFFSET,root=new THREE.Group();root.name='OrleansOutskirtsMachines';
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Map<string,THREE.Material>();
  const own=<G extends THREE.BufferGeometry>(g:G)=>{geometries.add(g);return g;};
  const cube=own(new THREE.BoxGeometry(1,1,1)),cylinder=own(new THREE.CylinderGeometry(1,1,1,10));
  const material=(color:string)=>{let m=materials.get(color);if(!m){const source=new THREE.MeshStandardMaterial({name:'M_OrleansCraft',color,roughness:.85});m=toonMaterial(source);source.dispose();materials.set(color,m);}return m;};
  const add=(parent:THREE.Object3D,g:THREE.BufferGeometry,color:string,p:readonly number[],s:readonly number[],r:readonly number[]=[0,0,0])=>{
    const m=new THREE.Mesh(g,material(color));m.position.set(p[0],p[1],p[2]);m.scale.set(s[0],s[1],s[2]);m.rotation.set(r[0],r[1],r[2]);parent.add(m);return m;
  };
  const compact=(group:THREE.Group)=>{
    const bins=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const child of [...group.children])if(child instanceof THREE.Mesh){child.updateMatrix();const g=child.geometry.clone().applyMatrix4(child.matrix),m=child.material as THREE.Material;const list=bins.get(m)??[];list.push(g);bins.set(m,list);group.remove(child);}
    for(const [m,parts] of bins){const g=own(mergeGeometries(parts));for(const p of parts)p.dispose();const out=new THREE.Mesh(g,m);out.castShadow=true;out.receiveShadow=true;out.userData.dynamic=true;group.add(out);}
  };
  // Mill wheel: the axle lies along the pier frame's x axis; the lowest paddles sweep the river.
  const W=BM.wheel,sin=Math.sin(BM.yaw),cos=Math.cos(BM.yaw);
  const wheelMount=new THREE.Group();wheelMount.name='OrleansMillWheelMount';
  wheelMount.position.set(OX+BM.x+cos*W.x+sin*W.z,W.y,OZ+BM.z-sin*W.x+cos*W.z);wheelMount.rotation.y=BM.yaw;root.add(wheelMount);
  const wheel=new THREE.Group();wheel.name='OrleansMillWheel';wheelMount.add(wheel);
  const rim=own(new THREE.TorusGeometry(W.radius-.25,.16,5,28));
  for(const side of [-1,1]){
    add(wheel,rim,'#66513d',[side*(W.width/2-.12),0,0],[1,1,1],[0,Math.PI/2,0]);
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2,r=(W.radius-.25)/2;add(wheel,cube,'#987650',[side*(W.width/2-.12),Math.sin(a)*r,Math.cos(a)*r],[.16,.2,W.radius-.25],[-a,0,0]);}
  }
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=W.radius-.45;add(wheel,cube,i%2?'#987650':'#8a6a49',[0,Math.sin(a)*r,Math.cos(a)*r],[W.width,.09,.95],[-a,0,0]);}
  add(wheel,cylinder,'#66513d',[0,0,0],[.3,W.width+2.6,.3],[0,0,Math.PI/2]);
  compact(wheel);
  // Windmill: hub on the windshaft, four stocks, lattice bars and cloth.
  const tower=EXPANSION_PLANS.find(p=>p.id==='orleans')!.sites.find(s=>s.id==='windmill')!;
  const sailMount=new THREE.Group();sailMount.name='OrleansWindmillSailMount';
  sailMount.position.set(OX+WM.x+Math.sin(WM.yaw)*(WM.reach+.3),tower.position[1]+WM.hub,OZ+WM.z+Math.cos(WM.yaw)*(WM.reach+.3));sailMount.rotation.y=WM.yaw;root.add(sailMount);
  const sails=new THREE.Group();sails.name='OrleansWindmillSails';sailMount.add(sails);
  add(sails,cylinder,'#66513d',[0,0,0],[.5,.9,.5],[Math.PI/2,0,0]);
  for(let k=0;k<4;k++){
    const arm=new THREE.Group();arm.rotation.z=k*Math.PI/2;sails.add(arm);
    add(arm,cube,'#66513d',[0,WM.sail/2,0],[.24,WM.sail,.24]);
    add(arm,cube,'#987650',[-1.75,WM.sail/2+.9,0],[.1,WM.sail-1.9,.1]);
    for(let j=0;j<8;j++)add(arm,cube,'#987650',[-.88,1.9+j*(WM.sail-2.1)/7,0],[1.76,.09,.09]);
    add(arm,cube,k%2?'#ece0c1':'#e2d5b4',[-.9,WM.sail/2+.95,-.07],[1.6,WM.sail-2.2,.04],[0,.12,0]);
    arm.updateMatrix();for(const child of [...arm.children]){child.updateMatrix();child.applyMatrix4(arm.matrix);sails.add(child);}
    sails.remove(arm);
  }
  compact(sails);
  const centre=new THREE.Vector3(OX,0,OZ);let disposed=false;
  return{root,wheel,sails,
    update(dt:number,viewer:{x:number;z:number}){
      if(disposed)return;
      const near=Math.hypot(viewer.x-centre.x,viewer.z-centre.z)<900;root.visible=near;if(!near)return;
      dt=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
      wheel.rotation.x+=dt*.5;sails.rotation.z+=dt*.42;
    },
    dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();},
  };
}
