import * as THREE from 'three';
import { Batch, T, BOX } from '../geo.js';
import { CAMP, CAMPUS, HQ, ARMORY, SUMMON, TOWER, RUIN, STATION, CAVE, ISLAND, WORLD, SEAM_W, SEAM_N, SEAM_E, SEAM_S, BRIDGE, RIVER_OUT, PLAZA, FALLS } from '../layout.js';
import type { Piece } from '../structures.js';
import { mulberry32, range } from '../rng.js';

/** Parhelion's own 2026 design language: porcelain field instruments, anodised
 * frames, optical slots and solar calibration scales. Never historic chapter kit.
 * These are ART only; all authored support/entry surfaces retain legacy proxies. */
export const VALLEY_CRAFT_MATERIALS = ['Ceramic','Metal','Glass','Stone','Timber','Canvas','Brass'] as const;
type Surface = typeof VALLEY_CRAFT_MATERIALS[number];
const C = { ceramic:'#e4e8df', edge:'#becfc9', dark:'#344955', metal:'#697f88', glass:'#286b78', glassLight:'#7abbbb', brass:'#c9a660', stone:'#9ea9ad', stoneLight:'#c3c9bd', timber:'#8b6950', canvas:'#d6d2b7', orange:'#cf8054', purple:'#706689' };
const CYL = new THREE.CylinderGeometry(1,1,1,12);
const sphere = new THREE.IcosahedronGeometry(1,1);
class Craft {
  batches = new Map<Surface,Batch>();
  constructor(public name:string){}
  b(s:Surface){let b=this.batches.get(s);if(!b){b=new Batch(this.name+'_'+s,'M_Valley'+s);this.batches.set(s,b);}return b;}
  box(s:Surface,x:number,y:number,z:number,w:number,h:number,d:number,c:string,ry=0){this.b(s).box(x,y,z,w,h,d,c,ry,false);}
  add(s:Surface,g:THREE.BufferGeometry,c:string,m:THREE.Matrix4){this.b(s).add(g,c,m,false);}
  rod(s:Surface,a:number[],b:number[],r:number,c:string){const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));if(v.length()<1e-5)return;const m=new THREE.Matrix4().compose(new THREE.Vector3(...a).addScaledVector(v,.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),new THREE.Vector3(r,v.length(),r));this.add(s,CYL,c,m);}
  ring(s:Surface,x:number,y:number,z:number,r:number,t:number,c:string,rx=Math.PI/2,ry=0,start=0,arc=Math.PI*2){this.add(s,new THREE.TorusGeometry(r,t,6,Math.max(12,Math.ceil(64*arc/(Math.PI*2))),arc),c,T(x,y,z,ry,1,1,1,rx, start));}
  pieces():Piece[]{return [...this.batches].map(([s,b])=>({name:b.name,material:'M_Valley'+s,batch:b,outline:true}));}
}

function insetPanel(a:Craft,x:number,y:number,z:number,w:number,h:number,ry=0,glazed=false){
  const co=Math.cos(ry),si=Math.sin(ry),at=(u:number,v:number)=>[x+co*u+si*v,z-si*u+co*v];
  const p=at(0,.035);a.box(glazed?'Glass':'Ceramic',p[0],y,p[1],w,h,.075,glazed?C.glass:C.ceramic,ry);
  for(const u of [-w/2,w/2]){const q=at(u,.09);a.box('Metal',q[0],y-.06,q[1],.11,h+.12,.12,C.dark,ry);}
  for(const v of [y-.05,y+h-.05]){const q=at(0,.09);a.box('Metal',q[0],v,q[1],w+.12,.1,.12,C.metal,ry);}
  if(glazed){const q=at(0,.082);a.box('Glass',q[0],y+h*.73,q[1],w-.12,.06,.025,C.glassLight,ry);}
}

function louvers(a:Craft,x:number,y:number,z:number,w:number,h:number,ry=0){
  insetPanel(a,x,y,z,w,h,ry);
  for(let i=0;i<7;i++){const xx=x+Math.sin(ry)*.14,zz=z+Math.cos(ry)*.14;a.box('Metal',xx,y+.12+i*(h-.24)/7,zz,w-.18,.06,.22,C.dark,ry);}
}

function solarScale(a:Craft,x:number,y:number,z:number,r:number,segments:number,face='floor'){
  for(let i=0;i<segments;i++){const t=i/segments*Math.PI*2;const major=i%5===0,l=major?.48:.20;
    a.box('Brass',x+Math.sin(t)*(r-l/2),y,z+Math.cos(t)*(r-l/2),major?.075:.035,.035,l,C.brass,t);
  }
  a.ring('Metal',x,y,z,r,.045,C.dark);
}

/** A shell with a real open observing meridian, rather than a black cube stuck
 * through a closed hemisphere. The original hemisphere collision stays intact. */
function observatoryShell(a:Craft,x:number,y:number,z:number){
  const r=7.04,slit=.24;
  // Longitudinal ribs and shell panel strips, separated by fine dark joints.
  for(let k=0;k<22;k++){
    const p=Math.PI/2+slit+k*(Math.PI*2-2*slit)/22,len=(Math.PI*2-2*slit)/22-.015;
    a.add('Ceramic',new THREE.SphereGeometry(r,3,12,p,len,0,Math.PI/2),k%4===0?'#d9e0dc':C.ceramic,T(x,y,z));
  }
  for(let i=0;i<23;i++){
    const p=Math.PI/2+slit+i*(Math.PI*2-2*slit)/22;
    const points:THREE.Vector3[]=[];
    for(let j=0;j<=16;j++){const t=j/16*Math.PI/2;points.push(new THREE.Vector3(-r*Math.cos(p)*Math.sin(t),r*Math.cos(t),r*Math.sin(p)*Math.sin(t)));}
    a.add('Metal',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,i===0||i===22?.10:.035,5,false),C.metal,T(x,y,z));
  }
  a.ring('Metal',x,y+.02,z,r+.10,.16,C.dark);
  a.ring('Brass',x,y-.42,z,r+.15,.055,C.brass);
  solarScale(a,x,y-.45,z,r+.22,80);
}

function dish(a:Craft,x:number,y:number,z:number,r:number,ry:number,rx:number){
  const points=[];for(let i=0;i<=14;i++){const rr=i/14*r;points.push(new THREE.Vector2(rr,rr*rr/(r*2.9)));}
  const m=T(x,y,z,ry,1,1,1,rx);
  // Lathe outward winding faces below the bowl. Author both sides as a thin
  // shell so its optical concavity remains visible from the feed side.
  a.add('Ceramic',new THREE.LatheGeometry([...points].reverse(),32),C.ceramic,m);
  a.add('Metal',new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p.x,p.y-.07)),32),C.edge,m);
  a.add('Metal',new THREE.TorusGeometry(r,.06,6,48),C.metal,m.clone().multiply(T(0,r/2.9,0,0,1,1,1,Math.PI/2)));
  const local=(p:number[])=>new THREE.Vector3(...p).applyMatrix4(m).toArray();
  for(let i=0;i<3;i++){const t=i/3*Math.PI*2;a.rod('Metal',local([Math.cos(t)*r,.34*r,Math.sin(t)*r]),local([0,r*.62,0]),.045,C.metal);}
  a.add('Metal',new THREE.CylinderGeometry(.12,.19,.35,12),C.dark,m.clone().multiply(T(0,r*.62,0)));
}

export function buildValleyCraft(heightAt:(x:number,z:number)=>number):Piece[]{
  const pieces:Piece[]=[];
  // HQ: asymmetrical glass-and-porcelain observatory; no crenels, tiled roofs,
  // port shutters or east-Asian bracket sets from the era chapters.
  {
    const a=new Craft('Valley_HQ_Optical'),y=CAMPUS.y,cx=(HQ.x0+HQ.x1)/2,cz=(HQ.z0+HQ.z1)/2;
    // Grounded chamfer around original raised walkway: the old thin vertical
    // edge read as a black triangular hole in the actual oblique render.
    // Its original top plane and gameplay proxy remain at exactly y + 0.15.
    const walkDepth=PLAZA.c[1]-PLAZA.r-HQ.z1+1;
    const walk=new THREE.BoxGeometry(6,.17,walkDepth),wp=walk.attributes.position;
    for(let i=0;i<wp.count;i++)if(wp.getY(i)<0){wp.setX(i,wp.getX(i)+Math.sign(wp.getX(i))*.28);wp.setZ(i,wp.getZ(i)+Math.sign(wp.getZ(i))*.28);}
    a.add('Stone',walk,'#a6b2ad',T(PLAZA.c[0],y+.065,(HQ.z1+PLAZA.c[1]-PLAZA.r)/2));
    for(let i=0;i<10;i++){
      const x=HQ.x0+2+i*4;
      if(Math.abs(x-cx)>3) insetPanel(a,x,y+2.23,HQ.z1+.40,3.7,3.1,0,true);
      insetPanel(a,x,y+2.1,HQ.z0-.06,3.6,3.6,Math.PI,true);
      a.box('Ceramic',x,y+.12,HQ.z1+.32,3.76,1.8,.12,i%3?'#e4e7de':'#d5dfdb');
    }
    for(const side of [-1,1]){
      const x=side<0?HQ.x0-.06:HQ.x1+.06;
      for(let i=0;i<5;i++)insetPanel(a,x,y+2.2,HQ.z0+2+i*4,3.6,3.2,side*Math.PI/2,true);
      a.box('Metal',x,y+.75,cz,.14,.16,HQ.z1-HQ.z0,C.metal);
      for(let i=0;i<6;i++)a.box('Ceramic',x,y+6.1,HQ.z0+2+i*3.6,.65,.16,2.8,C.ceramic);
    }
    // Upper archive has deep vertical solar fins and precise framed panes.
    for(let i=0;i<7;i++){
      const x=cx-16+i*3;insetPanel(a,x,y+10.32,cz+6.83,2.72,1.58,0,true);
      a.box('Ceramic',x-1.5,y+9.35,cz+7.0,.17,3.9,.68,C.ceramic);
    }
    for(const x of [cx-17.95,cx+3.95])a.box('Metal',x,y+8.6,cz-1,.15,4.8,15.1,C.metal);
    observatoryShell(a,cx+11,y+9.3,cz-1);
    dish(a,cx-14,y+18.6,cz-2,3.4,.7,-.9);
    // Telescope tube collars and optical front glass, using original axis.
    const tm=T(cx+11,y+15,cz+3.5,0,1,1,1,-.9);
    for(const yy of [-2.7,-1.2,1.1,2.7])a.add('Metal',new THREE.CylinderGeometry(.91,.91,.15,20),C.metal,tm.clone().multiply(T(0,yy,0)));
    a.add('Glass',new THREE.CylinderGeometry(.69,.69,.04,24),C.glass,tm.clone().multiply(T(0,3.02,0)));
    // A cup anemometer and a compact all-sky camera make this a research
    // observatory rather than simply an unlabelled decorative dome.
    for(let i=0;i<3;i++){
      const t=i/3*Math.PI*2,xx=cx+2+Math.cos(t)*.8,zz=cz-4+Math.sin(t)*.8;
      a.rod('Metal',[cx+2,y+21.7,cz-4],[xx,y+21.7,zz],.035,C.metal);
      a.add('Metal',new THREE.SphereGeometry(.21,10,6,0,Math.PI*2,0,Math.PI/2),C.dark,T(xx,y+21.7,zz,t,1,1,1,Math.PI/2));
    }
    a.add('Metal',new THREE.CylinderGeometry(.48,.6,.42,16),C.metal,T(cx-4,y+14.22,cz-2));
    a.add('Glass',new THREE.SphereGeometry(.43,16,8,0,Math.PI*2,0,Math.PI/2),C.glass,T(cx-4,y+14.43,cz-2));
    // Canopy soffit lattice: stays above the walking and terminal space.
    for(let i=0;i<9;i++)a.box('Timber',cx-7.7+i*1.92,y+4.82,HQ.z1+4,.10,.16,7.8,C.timber);
    a.box('Metal',cx,y+5.32,HQ.z1+7.98,16.2,.18,.16,C.dark);
    for(const s of [-1,1]){
      a.box('Metal',cx+s*7,y+.12,HQ.z1+7.4,.83,.35,.83,C.metal);
      a.rod('Metal',[cx+s*7,y+3.9,HQ.z1+7.4],[cx+s*5.8,y+4.9,HQ.z1+7.4],.07,C.metal);
    }
    // Solar halo badge above closed doors; intentionally abstract, no fake text.
    a.ring('Brass',cx,y+7.12,HQ.z1+.48,.58,.055,C.brass,0);
    for(const s of [-1,1])a.add('Brass',new THREE.OctahedronGeometry(.16),C.brass,T(cx+s*.95,y+7.12,HQ.z1+.49,0,1,1.5,.25));
    pieces.push(...a.pieces());
  }
  // Armory: hardwearing precision workshop, sawtooth ventilation, clamp benches
  // and roll-up rails, visually separate from the pristine optical HQ.
  {
    const a=new Craft('Valley_Armory_Fabrication'),y=CAMPUS.y,{x0,x1,z0,z1}=ARMORY,cx=(x0+x1)/2,cz=(z0+z1)/2;
    for(const z of [z0-.43,z1+.43]){
      for(let i=0;i<8;i++){const x=x0+1.5+i*3;a.box('Ceramic',x,y+.12,z,2.8,2.2,.10,i%2?'#c9d0c8':'#d8ded4');insetPanel(a,x,y+3.2,z,2.6,1.6,z===z0-.43?Math.PI:0,true);}
      a.box('Metal',cx,y+6.6,z,x1-x0+.2,.20,.18,C.dark);
    }
    for(let i=0;i<10;i++)a.box('Metal',x1+.48,y+.3,z0+1.2+i*2.4,.16,6.2,.08,C.metal);
    for(const s of [-1,1]){
      a.box('Metal',x0-.52,y+.05,cz+s*7.15,.28,5.75,.20,C.dark);
    }
    for(let k=0;k<7;k++)a.box('Metal',x0-.54,y+5.9+k*.12,cz,.13,.06,14,C.metal);
    // Roof ventilation hardware is outside all original roof access routes.
    for(let i=0;i<3;i++){
      const x=cx-6+i*6;
      a.box('Metal',x,y+8.9,cz,3.6,.25,13.4,C.dark);
      for(let k=0;k<8;k++)a.add('Metal',BOX,C.metal,T(x,y+9.25,cz-5.5+k*1.55,0,3.2,.12,1.5,-.35));
    }
    for(const s of [-1,1]){
      a.box('Brass',cx,y+1.03,cz+s*1.05,5.8,.06,.08,C.brass);
      a.box('Metal',cx-2.0,y+1.1,cz+s*.7,.6,.35,.42,C.metal);
    }
    for(const dz of [-6,0,6])for(const zz of [-1.85,1.85])a.box('Metal',x1-1.67,y+.08,cz+dz+zz,.12,3.08,.12,C.dark);
    // Range backstop acoustic tiles, leaving targets and firing lanes untouched.
    for(let r=0;r<4;r++)for(let k=0;k<11;k++)a.box('Canvas',cx-11+k*2,y+.2+r*1.0,z1+25.84,1.8,.82,.13,(r+k)%2?'#647b7b':'#7d8b82');
    pieces.push(...a.pieces());
  }
  // Summoning atrium is a scientific interferometer, not a borrowed cathedral.
  {
    const a=new Craft('Valley_Summon_Interferometer'),[cx,cz]=SUMMON.c,y=CAMPUS.y,r=SUMMON.r;
    for(let i=0;i<14;i++){
      const t=i/14*Math.PI*2;if(Math.abs(Math.atan2(Math.sin(t),Math.cos(t)))<.3)continue;
      const x=cx+Math.cos(t)*(r-.4),z=cz+Math.sin(t)*(r-.4);
      a.box('Metal',x,y+.03,z,1.35,.36,1.35,C.dark,-t);
      a.box('Brass',x,y+7.5,z,1.32,.14,1.32,C.brass,-t);
      a.box('Ceramic',x,y+8.5,z,1.48,.4,1.48,C.ceramic,-t);
      // An inward rib curls toward a suspended alignment ring without sealing sky.
      const pts=[];for(let k=0;k<=10;k++){const u=k/10,rr=(r-.4)-u*3.0;pts.push(new THREE.Vector3(cx+Math.cos(t)*rr,y+8.8+Math.sin(u*Math.PI/2)*2.4,cz+Math.sin(t)*rr));}
      a.add('Metal',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.075,6,false),C.metal,new THREE.Matrix4());
    }
    a.ring('Metal',cx,y+11.2,cz,r-3.4,.12,C.metal);
    a.ring('Brass',cx,y+11.5,cz,r-3.5,.045,C.brass);
    solarScale(a,cx,y+.32,cz,r-2.8,80);
    for(let i=0;i<16;i++){const t=i/16*Math.PI*2;const rr=8.4;a.add('Ceramic',new THREE.CylinderGeometry(.35,.48,.16,6),i%2?C.ceramic:C.purple,T(cx+Math.cos(t)*rr,y+.42,cz+Math.sin(t)*rr));}
    // Folded aluminum fascia is attached to, not floating above, legacy top ring.
    for(let i=0;i<28;i++){const t=i/28*Math.PI*2;a.box('Ceramic',cx+Math.cos(t)*(r-.4),y+9.24,cz+Math.sin(t)*(r-.4),.14,.5,1.8,C.ceramic,-t);}
    pieces.push(...a.pieces());
  }
  // Parhelion Tower: tiered calibration instrument, ribbed optical column and
  // four independent sail fins. The signature halo and its completion logic stay.
  {
    const a=new Craft('Valley_Tower_Calibration'),[cx,cz]=TOWER.c,y=TOWER.top;
    let yy=y+.5;
    for(const [w,h] of [[9,10],[7,12],[5,10]] as const){
      for(const s of [-1,1])for(const q of [-1,1])a.box('Metal',cx+s*(w/2+.05),yy+.06,cz+q*(w/2-.20),.14,h-.7,.26,C.metal);
      for(let row=0;row<Math.floor(h/2);row++)for(const side of [-1,1]){
        insetPanel(a,cx,yy+.5+row*1.8,cz+side*(w/2+.08),w-1.6,1.15,side<0?Math.PI:0,true);
      }
      for(const s of [-1,1])for(let k=0;k<5;k++)a.box('Ceramic',cx+s*(w/2+.14),yy+1+k*(h-2)/5,cz,.28,.13,w-.7,C.ceramic);
      yy+=h;
    }
    for(let i=0;i<4;i++){
      const t=i*Math.PI/2;const x=cx+Math.cos(t)*5.8,z=cz+Math.sin(t)*5.8;
      a.rod('Metal',[x,y+.7,z],[cx+Math.cos(t)*4.7,y+9.4,cz+Math.sin(t)*4.7],.18,C.dark);
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(1.2,1.0);shape.lineTo(.15,8.6);shape.lineTo(-.42,8.0);shape.closePath();
      a.add('Ceramic',new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:1,steps:1}),C.ceramic,T(x,y+.7,z,t-Math.PI/2));
    }
    solarScale(a,cx,y+.54,cz,14.2,100);
    // Structured podium edges; no additional deck height changes.
    for(let i=0;i<24;i++){const t=i/24*Math.PI*2;a.box('Metal',cx+Math.cos(t)*15.65,y-.22,cz+Math.sin(t)*15.65,.14,.40,2.8,C.metal,-t);}
    pieces.push(...a.pieces());
  }
  pieces.push(...campCraft(),...stationCraft(),...ruinCraft(heightAt),...landscapeCraft(heightAt),...bridgeCraft(heightAt));
  return pieces;
}

function campCraft():Piece[]{
  const a=new Craft('Valley_Landing_Fieldkit'),[cx,cz]=CAMP.c,y=CAMP.top;
  // Octagonal pressure hull shell around legacy solid crash proxy.
  const hull=new THREE.Shape();for(const [i,p] of [[-2.5,-1.6],[-2.5,1.1],[-1.8,1.6],[1.8,1.6],[2.5,1.1],[2.5,-1.6]].entries()){if(i===0)hull.moveTo(p[0],p[1]);else hull.lineTo(p[0],p[1]);}hull.closePath();
  const m=T(cx+16,y+1.6,cz+9,.5,1,1,1,0,.12);
  a.add('Ceramic',new THREE.ExtrudeGeometry(hull,{depth:11,bevelEnabled:true,bevelThickness:.18,bevelSize:.14,bevelSegments:2,steps:1}).translate(0,0,-5.5),C.ceramic,m);
  for(let k=0;k<5;k++){
    const z=-4.5+k*2.2;
    for(const s of [-1,1])a.add('Metal',BOX,C.dark,m.clone().multiply(T(s*2.54,-.1,z,0,.10,2.7,.12)));
  }
  for(const s of [-1,1]){
    a.add('Glass',BOX,C.glass,m.clone().multiply(T(s*1.2,.55,-5.72,0,1.9,1.0,.07)));
    a.add('Metal',new THREE.CylinderGeometry(.65,.85,2.2,16),C.dark,m.clone().multiply(T(s*1.55,-.6,5.55,0,1,1,1,Math.PI/2)));
    a.add('Brass',new THREE.TorusGeometry(.62,.08,6,24),C.brass,m.clone().multiply(T(s*1.55,-.6,6.72)));
  }
  a.add('Metal',BOX,C.metal,m.clone().multiply(T(0,-1.2,-5.73,0,4.0,.16,.12)));
  // Two flush service hatches sit BETWEEN the existing hull ribs. Their dark
  // rebates, captive fasteners and orange release tabs read at walking distance;
  // all fittings stay attached to the hull, not in the camp's walking space.
  for(const side of [-1,1]){
    const panel=(s:Surface,x:number,yy:number,z:number,w:number,h:number,d:number,c:string)=>a.add(s,BOX,c,m.clone().multiply(T(side*x,yy,z,0,w,h,d)));
    // The bevel expands the actual flat hull side to x=±2.64 (not ±2.5).
    panel('Metal',2.658,-.25,1.0,.045,1.65,1.64,C.dark);
    panel('Ceramic',2.690,-.25,1.0,.025,1.48,1.46,C.edge);
    for(const yy of [-.87,.37])for(const zz of [.39,1.61])
      a.add('Metal',new THREE.CylinderGeometry(.045,.045,.025,6),C.metal,m.clone().multiply(T(side*2.713,yy,zz,0,1,1,1,0,Math.PI/2)));
    for(const zz of [.58,1.42]){
      panel('Metal',2.715,-.25,zz,.025,.32,.14,C.dark);
      panel('Ceramic',2.738,-.25,zz,.035,.15,.10,C.orange);
    }
  }
  // Field shelters follow the original prism's above-ground envelope exactly:
  // 4.2 m along X, lean-to roof from z=-1.1/y=3.005 to z=2.2/y=1.1.
  // The collision's buried lower triangle stays unchanged, but no floating
  // A-frame straps are added perpendicular to the original shelter axis.
  for(const [i,v] of [[-13,4,.2],[-16,12,-.3],[-6,16,.6]].entries()){
    const [dx,dz,r]=v,tm=T(cx+dx,y,cz+dz,r);
    const tri=(vs:number[][],color:string)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs.flat(),3));g.computeVertexNormals();a.add('Canvas',g,color,tm);};
    const h=1.1+Math.sqrt(3)*1.1;
    for(let k=0;k<6;k++){
      const x0=-2.1+k*.7,x1=x0+.7;
      tri([[x0,h,-1.1],[x0,1.1,2.2],[x1,1.1,2.2],[x0,h,-1.1],[x1,1.1,2.2],[x1,h,-1.1]],k===i+1?'#c5c8ae':C.canvas);
    }
    a.add('Canvas',BOX,C.canvas,tm.clone().multiply(T(0,h/2,-1.1,0,4.2,h,.035)));
    a.add('Canvas',BOX,C.canvas,tm.clone().multiply(T(0,.55,2.2,0,4.2,1.1,.035)));
    for(const s of [-1,1]){
      const x=s*2.1;tri([[x,0,-1.1],[x,h,-1.1],[x,1.1,2.2],[x,0,-1.1],[x,1.1,2.2],[x,0,2.2]],i===1?'#b9bfa9':C.canvas);
      const p=new THREE.Vector3(x,1.12,2.22).applyMatrix4(tm).toArray(),q=new THREE.Vector3(x,h+.025,-1.1).applyMatrix4(tm).toArray();a.rod('Canvas',p,q,.035,C.dark);
      a.add('Canvas',BOX,i===2?C.orange:C.dark,tm.clone().multiply(T(x+s*.025,.8,.30,0,.045,1.6,.06)));
    }
    for(const xx of [-1.45,1.45])a.rod('Canvas',new THREE.Vector3(xx,h+.025,-1.1).applyMatrix4(tm).toArray(),new THREE.Vector3(xx,1.125,2.22).applyMatrix4(tm).toArray(),.025,i===1?C.orange:C.dark);
  }
  solarScale(a,cx,y+.51,cz-6,7.4,40);
  for(const [dx,dz,s,r] of [[8,-16,1.2,.2],[9.4,-16.2,1,.7],[-8,-14,1.3,.1],[-9,-12.5,.9,.9],[4,10,1.4,.4]]){
    const tm=T(cx+dx,y,cz+dz,r);
    for(const ss of [-1,1])a.add('Metal',BOX,C.dark,tm.clone().multiply(T(ss*s*.32,s/2,0,0,.08,s+.06,s+.06)));
    a.add('Metal',BOX,C.metal,tm.clone().multiply(T(0,s*.55,s*.51,0,s*.32,.10,.10)));
  }
  return a.pieces();
}

function stationCraft():Piece[]{
  const a=new Craft('Valley_Station_Retrofit'),y=STATION.y;
  // Aged campus generation: exposed concrete expansion joints, rust-brown
  // repair plates and radio utility, rather than new-campus porcelain.
  for(let i=0;i<6;i++)insetPanel(a,-159+i*4,y+1.4,-63.34,3.3,2.4,Math.PI,true);
  for(let i=0;i<3;i++)louvers(a,-161.36,y+.8,-60+i*5,2.6,2.8,-Math.PI/2);
  for(const x of [-160.8,-155,-141,-135.1])a.box('Metal',x,y+.03,-46.64,.12,4.35,.12,C.metal);
  for(const z of [-61.5,-48.5])a.box('Metal',-134.63,y+.06,z,.12,4.30,.12,C.metal);
  for(const x of [-158,-154,-143,-139])a.box('Stone',x,y+.2,-46.64,2.5,.7,.08,'#a8b6b0');
  // Front-facing old service panels sit OUTSIDE the z=-47 wall's south face
  // (-46.7), not buried within it. Narrow sealed lights and heavy maintenance
  // grilles distinguish this old outpost from the campus glazing curtain wall.
  for(const x of [-158,-154,-143,-139]){
    insetPanel(a,x,y+2.85,-46.64,2.45,.72,0,true);
    a.box('Stone',x,y+1.2,-46.66,2.45,1.2,.065,x===-154?'#adb7ae':'#bec7bc');
  }
  louvers(a,-138,y+.65,-46.56,2.2,1.55,0);
  for(const x of [-151.3,-146.7])a.box('Metal',x,y+.05,-46.57,.18,3.3,.18,C.dark);
  a.box('Metal',-149,y+3.22,-46.57,4.8,.18,.18,C.dark);
  a.box('Ceramic',-149,y+3.65,-46.59,3.2,.34,.12,'#9caeaa');
  for(const z of [-57.3,-52.7])a.box('Metal',-134.55,y+.05,z,.18,3.3,.18,C.dark);
  a.box('Metal',-134.55,y+3.22,-55,.18,.18,4.8,C.dark);
  louvers(a,-134.52,y+1.0,-60.4,2.6,2.1,Math.PI/2);
  // Grounded corner repair sleeves, roof joint tape and capped parapet joints.
  for(const [x,z] of [[-160.9,-46.55],[-135.1,-46.55],[-134.55,-62.8]]){
    a.box('Metal',x,y+.15,z,.24,3.7,.24,'#8a7661');
    for(let k=0;k<5;k++)a.box('Brass',x,y+.45+k*.65,z+.13,.10,.08,.035,C.brass);
  }
  for(let i=0;i<6;i++)a.box('Metal',-159+i*4.2,y+4.92,-55,.035,.025,14.5,'#668b8b');
  a.box('Metal',-148,y+5.92,-47,26.6,.09,.6,C.metal);
  a.box('Metal',-135,y+5.92,-55,.6,.09,15.4,C.metal);
  a.box('Metal',-145.85,y+5.92,-63,22.3,.09,.6,C.metal);
  a.box('Metal',-161,y+5.92,-52.15,.6,.09,9.7,C.metal);
  // Aged precast perimeter panels: physical seams and restrained patchwork,
  // clipped to each original gate/breach span so no opening becomes narrower.
  const wallX=(x0:number,x1:number,z:number)=>{
    const n=Math.floor((x1-x0)/5);for(let i=0;i<n;i++){
      const x=x0+(i+.5)*(x1-x0)/n;
      for(const side of [-1,1]){
        a.box('Stone',x,y+.12,z+side*.535,(x1-x0)/n-.16,1.15,.07,i%3?'#aeb9b1':'#b8c1b5');
        a.box('Metal',x-(x1-x0)/n/2+.08,y+.1,z+side*.55,.055,4.75,.065,'#8c9b97');
        if(i%4===1)a.box('Stone',x+.4,y+3.5,z+side*.55,1.05,.48,.06,'#8a9d96');
      }
    }
  };
  const wallZ=(z0:number,z1:number,x:number)=>{
    const n=Math.floor((z1-z0)/5);for(let i=0;i<n;i++){
      const z=z0+(i+.5)*(z1-z0)/n;
      for(const side of [-1,1]){
        a.box('Stone',x+side*.535,y+.12,z,.07,1.15,(z1-z0)/n-.16,i%3?'#aeb9b1':'#b8c1b5');
        a.box('Metal',x+side*.55,y+.1,z-(z1-z0)/n/2+.08,.065,4.75,.055,'#8c9b97');
      }
    }
  };
  wallX(-175,-145,-20);wallX(-135,-105,-20);wallX(-175,-160,-82);wallX(-152,-105,-82);
  wallZ(-82,-20,-175);wallZ(-82,-60,-105);wallZ(-48,-20,-105);
  // Interior cabinets stay on the original north wall and console footprint.
  for(const x of [-157,-153,-143,-139]){
    insetPanel(a,x,y+1.5,-62.65,2.6,1.9,0,true);
    for(let k=0;k<3;k++)a.box('Metal',x,y+1.75+k*.45,-62.48,2.3,.055,.06,C.metal);
  }
  for(const x of [-148.85,-147.15])a.box('Brass',x,y+.25,-58.47,.08,.5,.05,C.brass);
  dish(a,-139,y+9.3,-59,4.2,.6,-.9);
  // Horizontal barbed-free defensive rail joins old gate, no route obstruction.
  for(const x of [-146.5,-133.5])a.box('Metal',x,y+.10,-18.96,2.06,.4,.12,C.dark);
  a.box('Metal',-140,y+7.58,-18.92,14.8,.16,.14,C.dark);
  for(const [tx,tz] of [[-168,-30],[-112,-74]]){
    for(const s of [-1,1])a.rod('Metal',[tx+s*1.7,y+.4,tz-1.7],[tx-s*1.7,y+5.8,tz-1.7],.06,C.dark);
    for(let i=0;i<5;i++)a.box('Timber',tx-1.8+i*.9,y+6.42,tz-2.26,.07,.86,.08,C.timber);
    for(const s of [-1,1])a.box('Metal',tx+s*1.8,y+7.2,tz-1.8,.10,1.4,.10,C.metal);
  }
  // Corrugation attached to known large-container footprints, not new cover.
  for(const [x,z,w,d,ry] of [[-124,-34,6,2.5,-.12],[-123,-38,6,2.5,.13],[-168,-70,6,2.5,-.12],[-119,-60,2.5,6,.13],[-146,-33,6,2.5,-.12]]){
    const tm=T(x,y,z,ry);
    for(const side of [-1,1])for(let k=0;k<Math.floor(w/.5);k++)a.add('Metal',BOX,k%3?C.metal:'#9a836e',tm.clone().multiply(T(-w/2+.25+k*.5,1.3,side*(d/2+.06),0,.08,2.45,.09)));
  }
  return a.pieces();
}

function ruinCraft(heightAt:(x:number,z:number)=>number):Piece[]{
  const a=new Craft('Valley_Ruin_Resonator'),[cx,cz]=RUIN.c,y=heightAt(cx,cz),sz=cz-9;
  const rng=mulberry32(WORLD.seed+5);
  for(let i=0;i<10;i++){
    const t=i/10*Math.PI*2+.2;if(Math.abs(t-Math.PI*1.5)<.5)continue;
    const h=range(rng,1.5,6.5),x=cx+Math.cos(t)*11,z=cz+Math.sin(t)*11;
    const shape=new THREE.Shape(),pts=[[-.56,-.7],[.56,-.7],[.7,-.56],[.7,.56],[.56,.7],[-.56,.7],[-.7,.56],[-.7,-.56]];
    pts.forEach((p,k)=>k?shape.lineTo(p[0],p[1]):shape.moveTo(p[0],p[1]));shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1,curveSegments:1}).rotateX(-Math.PI/2);
    a.add('Stone',g,i%3===0?'#a0aca4':C.stoneLight,T(x,y,z,t));
    const tm=T(x,y,z,t);
    // Inset course breaks and asymmetric surviving fragments, never a crown
    // or cap taller than the old target-supporting pillar top.
    for(let k=1;k<Math.floor(h/1.2);k++)for(const s of [-1,1])a.add('Stone',BOX,'#81978e',tm.clone().multiply(T(0,k*1.2,s*.706,0,1.10,.045,.035)));
    for(let k=0;k<3;k++)a.add('Stone',BOX,k===i%3?'#7c9489':'#b1bcb1',tm.clone().multiply(T(-.32+k*.32,Math.min(h-.35,1.1+k*.27),.714,0,.075,.65,.045)));
    a.add('Stone',BOX,'#a8b4a9',tm.clone().multiply(T(0,.18,0,0,1.48,.25,1.48)));
  }
  // Lost geometric resonator masonry, no Celtic/Japanese/Russian motifs.
  for(let k=0;k<4;k++){
    for(const s of [-1,1])a.box('Stone',cx+s*3.43,y+.1+k*.95,sz,.13,.78,5.85,k%2?C.stone:C.stoneLight);
    for(let j=0;j<3;j++)a.box('Stone',cx-2.2+j*2.2,y+.12+k*.95,sz-3.44,1.98,.76,.13,(j+k)%2?C.stone:C.stoneLight);
  }
  for(const s of [-1,1]){
    a.box('Metal',cx+s*3.0,y+.1,sz+3.5,.18,3.9,.14,C.dark);
    a.box('Brass',cx+s*3.0,y+3.75,sz+3.60,.45,.10,.08,C.brass);
  }
  // Roof perimeter restrained triangular fret; shrine door untouched/dynamic.
  for(let i=0;i<8;i++){
    const x=cx-3.3+i*.94;a.add('Stone',new THREE.OctahedronGeometry(.28),C.stoneLight,T(x,y+4.64,sz+3.25,0,1,.45,.5));
  }
  a.box('Stone',cx,y+4.13,sz+3.68,7.2,.30,.14,'#aab6aa');
  for(let i=0;i<11;i++){
    const x=cx-3.0+i*.6;
    a.add('Stone',BOX,i%3?'#849a90':'#bdc6b5',T(x,y+4.29,sz+3.77,0,.22,.16,.05,0,i%2?.35:-.35));
  }
  // Two surviving corbel profiles shoulder the stone lintel, with stepped
  // fracture instead of the modern workshop's straight roller-door fascia.
  for(const s of [-1,1])for(let k=0;k<3;k++)a.box('Stone',cx+s*(3.15-k*.12),y+3.1+k*.28,sz+3.25,.42+k*.18,.26,.65,'#a7b3a6');
  solarScale(a,cx,y+.32,cz,8.7,60);
  a.ring('Stone',cx,y+.30,cz,10.4,.08,C.stone);
  for(let i=0;i<12;i++){const t=i/12*Math.PI*2;
    const x=cx+Math.cos(t)*6.9,z=cz+Math.sin(t)*6.9;
    a.box('Brass',x,y+.33,z,.055,.025,.8,C.brass,-t);
  }
  return a.pieces();
}

/** Added to the original dynamic door Batch, so every carved piece moves or
 * hides with that same door. No independent static relief can block an opening. */
export function decorateValleyRuinDoor(b:Batch,x:number,y:number,z:number){
  const f=z+.285;
  b.add(new THREE.TorusGeometry(1.02,.065,6,36),'#b5ad86',T(x,y+2.0,f),false);
  b.add(new THREE.TorusGeometry(.70,.035,5,28),'#4e6d69',T(x,y+2.0,f+.02),false);
  for(const s of [-1,1]){
    b.box(x+s*2.27,y+.12,f,.16,3.5,.09,'#b1baa5',0,false);
    b.box(x+s*1.62,y+.56,f,.10,2.30,.07,'#566e64',0,false);
    b.box(x+s*1.38,y+2.75,f,.56,.10,.07,'#a4b29b',0,false);
  }
  for(let i=0;i<8;i++){const t=i/8*Math.PI*2;b.add(new THREE.OctahedronGeometry(.10),'#aab59f',T(x+Math.sin(t)*1.03,y+2+Math.cos(t)*1.03,f+.03,0,.6,1,.25),false);}
}

/** Sculpted cliff lip around the unchanged hidden cave corridor. Original box
 * proxies remain in their original stream; this shell is strictly ART only. */
export function decorateValleyFallsRock(b:Batch){
  const cz=(CAVE.z0+CAVE.z1)/2,ys=[CAVE.floor,8.4,15.4,23.1,30.4,37.8,40.0];
  const widths=[5.2,5.4,6.8,8.0,8.8,9.1,8.3],cols=12,points:number[][]=[];
  for(let j=0;j<ys.length;j++)for(let k=0;k<=cols;k++){
    const u=k/cols*2-1,z=cz+u*widths[j];
    const x=FALLS.x-2.18-.38*Math.sin(k*1.91+j*.83)-.22*Math.cos(k*.71-j*1.33)+(j===6?2.2:0);
    const y=ys[j]+(j<2?0:.36*Math.sin(k*1.72+j));
    points.push([x,y,z]);
  }
  const add=(p:number[][],color:string)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));b.add(g,color,new THREE.Matrix4(),false);};
  const colors=['#7f8d91','#89989b','#77878e','#929f9c','#7b8c91'];
  for(let j=0;j<ys.length-1;j++)for(let k=0;k<cols;k++){
    if(j===0&&k>=1&&k<=10)continue; // original entrance aperture remains open
    const q=j*(cols+1)+k;
    add([points[q],points[q+1],points[q+cols+1]],colors[(j*3+k)%5]);
    add([points[q+1],points[q+cols+2],points[q+cols+1]],colors[(j*3+k+1)%5]);
  }
  for(const side of [0,cols])for(let j=0;j<ys.length-1;j++){
    const a=points[j*(cols+1)+side],c=points[(j+1)*(cols+1)+side];
    const aa=[a,[172.5,Math.min(a[1],39),cz+(a[2]-cz)*.9],[175.5,Math.min(a[1],33.0),cz+(a[2]-cz)*.65]];
    const cc=[c,[172.5,Math.min(c[1],39),cz+(c[2]-cz)*.9],[175.5,Math.min(c[1],33.0),cz+(c[2]-cz)*.65]];
    for(let n=0;n<2;n++)add(side?[aa[n],aa[n+1],cc[n],aa[n+1],cc[n+1],cc[n]]:[aa[n],cc[n],aa[n+1],aa[n+1],cc[n],cc[n+1]],colors[(j+side+n)%5]);
  }
  for(let k=0;k<cols;k++){
    const a=points[6*(cols+1)+k],c=points[6*(cols+1)+k+1];
    const aa=[a,[172.5,39+.12*Math.sin(k),cz+(a[2]-cz)*.9],[175.5,33.0,cz+(a[2]-cz)*.65]];
    const cc=[c,[172.5,39+.12*Math.sin(k+1),cz+(c[2]-cz)*.9],[175.5,33.0,cz+(c[2]-cz)*.65]];
    for(let n=0;n<2;n++)add([aa[n],cc[n],aa[n+1],cc[n],cc[n+1],aa[n+1]],colors[(k+n)%5]);
  }
  // Interior corridor surfaces behind the veil keep their original planes.
  add([[164,2.4,-64],[172,2.4,-64],[164,8.4,-64],[172,2.4,-64],[172,8.4,-64],[164,8.4,-64]],'#6b7d83');
  add([[164,2.4,-56],[164,8.4,-56],[172,2.4,-56],[172,2.4,-56],[164,8.4,-56],[172,8.4,-56]],'#6b7d83');
  add([[164,8.4,-64],[172,8.4,-64],[164,8.4,-56],[172,8.4,-64],[172,8.4,-56],[164,8.4,-56]],'#6b7d83');
}

/** A connected, broadly rippled curtain with irregular edges, not glass strips. */
export function decorateValleyWaterfall(b:Batch){
  const cz=(CAVE.z0+CAVE.z1)/2,positions:number[]=[],indices:number[]=[],rows=64,cols=32;
  for(let j=0;j<=rows;j++){
    const t=j/rows,y=CAVE.floor+.08+t*37.45,half=7.25+.28*Math.sin(t*9.1)+.15*Math.sin(t*24.3);
    for(let k=0;k<=cols;k++){
      const u=k/cols*2-1,x=FALLS.x-3.16+2.15*Math.pow(t,64)-.14*Math.cos(u*13+t*5)-.09*Math.sin(u*24-t*19);
      positions.push(x,y+.05*Math.sin(k*.83+t*7),cz+u*half+.12*Math.sin(t*14)*(1-u*u));
    }
  }
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const q=j*(cols+1)+k;indices.push(q,q+1,q+cols+1,q+1,q+cols+2,q+cols+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);b.add(g,'#f5ffff',new THREE.Matrix4(),false);
  // Low splash apron on the existing wet ledge; no new collision.
  const fan:number[]=[],center=[FALLS.x-4.3,CAVE.floor+.055,cz];
  for(let i=0;i<36;i++){
    const point=(n:number)=>{const t=n/36*Math.PI*2,r=1+.08*Math.sin(n*2.1);return [center[0]+Math.cos(t)*2.5*r,center[1]+.012*Math.sin(n*1.3),cz+Math.sin(t)*7.8*r];};
    fan.push(...center,...point(i+1),...point(i));
  }
  const f=new THREE.BufferGeometry();f.setAttribute('position',new THREE.Float32BufferAttribute(fan,3));b.add(f,'#e2fbff',new THREE.Matrix4(),false);
  for(let i=0;i<7;i++)b.add(new THREE.TorusGeometry(.38+(i%3)*.13,.042,5,16,Math.PI*1.45),'#ffffff',T(FALLS.x-4.6-.6*Math.sin(i*1.7),CAVE.floor+.1,cz-6+i*1.9,i*.7,1,.7,1,Math.PI/2),false);
}

function landscapeCraft(heightAt:(x:number,z:number)=>number):Piece[]{
  const a=new Craft('Valley_Exploration_Detail');
  // Cave stratum attached to walls and outside central corridor; never plug
  // traversal with high polygon rock clutter or uncollidable hanging blocks.
  for(let side=0;side<2;side++)for(let k=0;k<5;k++){
    const z=side?CAVE.z1-.12:CAVE.z0+.12,x=CAVE.x0+2+k*3.8;
    a.add('Stone',sphere,k%2?'#768b99':'#a4b3b8',T(x,CAVE.floor+3.7,z,k*.3,1.8,2.6,.32));
  }
  for(const s of [-1,1])for(let k=0;k<3;k++)a.add('Stone',sphere,k%2?'#718d95':'#9eb3ae',T(FALLS.x-2.7-k*.22,CAVE.floor+.12+k*.11,-60+s*(6.8+k*.42),k*.6,.55,.30,.52));
  // Optical survey cases in secret chamber, no altered chest interact point.
  for(const s of [-1,1])a.box('Metal',188+s*.56,CAVE.floor+.06,-60,.10,1.15,1.05,C.dark);
  a.box('Brass',188,CAVE.floor+.65,-60.53,.26,.28,.06,C.brass);
  const [ix,iz]=ISLAND.c,iy=WORLD.waterLevel+1.6;
  for(let k=0;k<8;k++){
    const yy=iy+k*1.08;
    for(const s of [-1,1])a.box('Stone',ix+s*1.52,yy,iz,.08,.90,2.88,k%2?C.stone:C.stoneLight);
    a.box('Stone',ix,yy,iz+1.52,2.88,.90,.08,k%2?C.stoneLight:C.stone);
  }
  for(const s of [-1,1])a.box('Metal',ix+s*.42,iy+9.04,iz,.07,.75,.85,C.metal);
  a.box('Brass',ix,iy+9.35,iz+.44,.18,.22,.06,C.brass);
  for(const x of [-.36,.36])a.box('Metal',ix+x,iy+9.65,iz-.43,.16,.10,.08,C.dark);
  // Each seam receives the same *instrument* coupling, not another copy of a
  // chapter landmark. Local orientation follows its existing pylon heading.
  for(const [c,ry,base] of [[SEAM_W.c,Math.PI/2,null],[SEAM_N.c,0,WORLD.waterLevel+.12],[SEAM_E.c,-Math.PI/2,null],[SEAM_S.c,Math.PI,SEAM_S.y]] as const){
    const [cx,cz]=c,y=base??heightAt(cx,cz),ax=Math.cos(ry),az=-Math.sin(ry);
    for(const s of [-1,1]){
      const x=cx+ax*10*s,z=cz+az*10*s;
      for(let k=0;k<5;k++)a.box('Metal',x,y+.5+k*2.8,z,1.95,.16,1.95,C.metal,ry);
      a.box('Ceramic',x,y+.12,z,2.04,.42,2.04,C.ceramic,ry);
      a.box('Brass',x,y+13.5,z,1.92,.10,1.92,C.brass,ry);
    }
  }
  return a.pieces();
}

function bridgeCraft(heightAt:(x:number,z:number)=>number):Piece[]{
  const a=new Craft('Valley_Ford_Hydrology');
  let best=0,bd=Infinity;
  for(let i=0;i<RIVER_OUT.length-1;i++){
    const mx=(RIVER_OUT[i][0]+RIVER_OUT[i+1][0])/2,mz=(RIVER_OUT[i][1]+RIVER_OUT[i+1][1])/2,d=Math.hypot(mx-BRIDGE.c[0],mz-BRIDGE.c[1]);
    if(d<bd){bd=d;best=i;}
  }
  const dx=RIVER_OUT[best+1][0]-RIVER_OUT[best][0],dz=RIVER_OUT[best+1][1]-RIVER_OUT[best][1],l=Math.hypot(dx,dz),px=-dz/l,pz=dx/l,ry=Math.atan2(px,pz),[cx,cz]=BRIDGE.c;
  const ha=heightAt(cx-px*20,cz-pz*20),hb=heightAt(cx+px*20,cz+pz*20),deck=Math.max(WORLD.waterLevel+2.2,Math.min(ha,hb)+.3),m=T(cx,0,cz,ry);
  const p=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).applyMatrix4(m).toArray();
  // Flush plank joints are at most 2 cm above the existing deck, while metal
  // engineering is attached outside/below the legacy walkable envelope.
  for(let k=0;k<40;k++)a.add('Timber',BOX,k%4?'#916c50':'#a88360',m.clone().multiply(T(0,deck+.009,-15.6+k*.8,0,3.75,.018,.71)));
  for(const side of [-1,1]){
    for(let s=-14;s<=14;s+=7){
      a.add('Metal',BOX,C.metal,m.clone().multiply(T(side*2.17,deck-.1,s,0,.07,1.0,.66)));
      for(const yy of [deck-.42,deck+.20])for(const zz of [-.2,.2])a.add('Brass',new THREE.CylinderGeometry(.055,.055,.05,8),C.brass,m.clone().multiply(T(side*2.23,yy,s+zz,0,1,1,1,0,Math.PI/2)));
      if(s<14){a.rod('Metal',p(side*1.92,deck-.5,s),p(side*1.92,Math.max(WORLD.waterLevel-.3,deck-2.0),s+7),.045,C.dark);a.rod('Metal',p(side*1.92,Math.max(WORLD.waterLevel-.3,deck-2.0),s),p(side*1.92,deck-.5,s+7),.045,C.dark);}
    }
    a.add('Metal',BOX,C.metal,m.clone().multiply(T(side*1.9,deck+1.02,0,0,.24,.08,31.8)));
  }
  // A stream-gauge head clamps to an existing bridge post; no new blocking prop.
  a.add('Ceramic',BOX,C.ceramic,m.clone().multiply(T(2.14,deck+.6,-14,0,.48,.55,.38)));
  a.add('Glass',BOX,C.glass,m.clone().multiply(T(2.4,deck+.62,-14,0,.03,.22,.25)));
  a.rod('Metal',p(2.0,deck+.25,-14),p(2.3,WORLD.waterLevel+.4,-14),.045,C.metal);
  return a.pieces();
}
