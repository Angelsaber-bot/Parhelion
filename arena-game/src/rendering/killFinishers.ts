/** Kill finishers: every sculpted finish has its own emblem. On a kill, particles in
 * the finish's particle shape burst from the body, assemble the emblem facing the
 * viewer, hold, then leave in the finish's own way (rise, scatter, spiral, fall,
 * shatter or implode), with a shockwave at the feet. Presentation only: about one
 * second, additive, one draw call per finisher, pooled, and dimmed and lifted
 * above the body while you aim so it never sits on the sight line. */
import * as THREE from 'three';
import type {Vec3} from '../../shared/map';
import {SIGNATURE_SKINS,type SignatureId} from '../../shared/signatureSkins.ts';
import {skinEffect,type ParticleShape} from '../cosmetics/skinEffects.ts';

type Pt=readonly[number,number];type Line=readonly Pt[];
export type FinisherExit='rise'|'scatter'|'spiral'|'fall'|'shatter'|'implode';
export interface Finisher{emblem:readonly Line[];exit:FinisherExit;ring:boolean;pillar:boolean}

const TAU=Math.PI*2;
const arc=(cx:number,cy:number,r:number,a0=0,a1=TAU,n=24,ry=r):Line=>Array.from({length:n+1},(_,i)=>{const t=a0+(a1-a0)*i/n;return[cx+Math.cos(t)*r,cy+Math.sin(t)*ry]as Pt;});
const ring=(cx:number,cy:number,r:number,ry=r)=>arc(cx,cy,r,0,TAU,28,ry);
const poly=(...p:Pt[]):Line=>p;
const closed=(...p:Pt[]):Line=>[...p,p[0]];
const star=(cx:number,cy:number,R:number,r:number,n:number,phase=Math.PI/2):Line=>closed(...Array.from({length:n*2},(_,i)=>{const t=phase+i/(n*2)*TAU,k=i%2?r:R;return[cx+Math.cos(t)*k,cy+Math.sin(t)*k]as Pt;}));
const hex=(cx:number,cy:number,r:number)=>closed(...Array.from({length:6},(_,i)=>{const t=i/6*TAU+Math.PI/6;return[cx+Math.cos(t)*r,cy+Math.sin(t)*r]as Pt;}));
const petal=(a:number,len=.9,w=.32):Line=>{const c=Math.cos(a),s=Math.sin(a);return Array.from({length:17},(_,i)=>{const t=i/16*TAU,u=len*(1-Math.cos(t))/2,v=w*Math.sin(t);return[u*c-v*s,u*s+v*c]as Pt;});};
const wave=(y:number,amp:number,cycles:number,x0=-1,x1=1):Line=>Array.from({length:33},(_,i)=>{const t=i/32;return[x0+(x1-x0)*t,y+Math.sin(t*cycles*TAU)*amp]as Pt;});
const spiral=(turns:number,r0:number,r1:number,cx=0,cy=0):Line=>Array.from({length:49},(_,i)=>{const t=i/48,a=t*turns*TAU,r=r0+(r1-r0)*t;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r]as Pt;});
const bolt=(s=1,dx=0):Line=>poly([dx+.1*s,1*s],[dx-.25*s,.1*s],[dx+.08*s,.1*s],[dx-.15*s,-1*s],[dx+.35*s,-.05*s],[dx+.02*s,-.05*s],[dx+.28*s,1*s]);

/** One emblem per finish. Coordinates are a unit square, y up, about ±1. */
export const FINISHERS:Record<SignatureId,Finisher>={
 'tidal-engine':{emblem:[wave(.35,.18,1.5),wave(-.05,.18,1.5,-.85,.85),wave(-.45,.18,1.5,-.7,.7)],exit:'scatter',ring:true,pillar:false},
 'amber-apiary':{emblem:[hex(0,0,.42),hex(-.62,.36,.36),hex(.62,.36,.36),hex(0,-.72,.36)],exit:'rise',ring:false,pillar:false},
 'graviton-crucible':{emblem:[ring(0,0,.95,.35),arc(0,0,.95,0,TAU,28,.35).map(([x,y])=>[x*.5-y*.87,x*.87+y*.5]as Pt),ring(0,0,.22)],exit:'implode',ring:true,pillar:false},
 'cloudline':{emblem:[poly([-1,-.3],[1,-.3]),arc(-.5,-.3,.4,0,Math.PI,12),arc(.1,-.25,.55,0,Math.PI,14),arc(.68,-.3,.32,0,Math.PI,10)],exit:'rise',ring:false,pillar:false},
 'stormcoil':{emblem:[bolt(1)],exit:'shatter',ring:true,pillar:true},
 'abyssal-maw':{emblem:[poly(...Array.from({length:9},(_,i)=>[-1+i*.25,i%2?.15:.55]as Pt)),poly(...Array.from({length:9},(_,i)=>[-1+i*.25,i%2?-.15:-.55]as Pt))],exit:'implode',ring:true,pillar:false},
 'cinder-express':{emblem:[ring(-.35,-.55,.28),ring(.05,-.05,.36),ring(.45,.55,.42)],exit:'rise',ring:true,pillar:false},
 'sealed-passage':{emblem:[star(0,.1,.62,.55,12,0),ring(0,.1,.38),poly([-.18,.1],[.18,.1]),poly([0,-.08],[0,.28]),poly([-.2,-.45],[-.4,-1]),poly([.2,-.45],[.4,-1])],exit:'fall',ring:false,pillar:false},
 'lantern-warden':{emblem:[closed([-.38,-.7],[.38,-.7],[.45,.5],[-.45,.5]),arc(0,.7,.2,0,Math.PI,10),poly([-.5,.5],[.5,.5]),arc(0,-.15,.18,0,TAU,16,.32)],exit:'rise',ring:false,pillar:true},
 'bastion-breaker':{emblem:[closed([-.75,.85],[.75,.85],[.7,-.1],[0,-1],[-.7,-.1]),poly([-.4,.25],[0,-.2],[.4,.25])],exit:'shatter',ring:true,pillar:false},
 'celadon-atlas':{emblem:[poly([-1,-.2],[-.45,.65],[-.1,.1],[.3,.85],[1,-.2]),wave(-.6,.12,2)],exit:'scatter',ring:false,pillar:false},
 'owl-canticle':{emblem:[ring(-.38,.15,.3),ring(.38,.15,.3),poly([-.12,-.25],[0,-.55],[.12,-.25]),poly([-.6,.4],[-.75,.95],[-.35,.5]),poly([.6,.4],[.75,.95],[.35,.5])],exit:'spiral',ring:false,pillar:false},
 'brass-horizon':{emblem:[star(0,0,1,.28,8),ring(0,0,.62)],exit:'spiral',ring:true,pillar:false},
 'night-nacre':{emblem:[...Array.from({length:7},(_,i)=>poly([-.9+i*.3,.9-(i%3)*.15],[-1.05+i*.3,.3-(i%3)*.15])),arc(.2,-.45,.4,Math.PI*.2,Math.PI*1.4,14)],exit:'fall',ring:false,pillar:false},
 'petal-scabbard':{emblem:Array.from({length:5},(_,i)=>petal(Math.PI/2+i/5*TAU,.85,.3)),exit:'fall',ring:false,pillar:false},
 'mint-arcade':{emblem:['.XX.XX.','XXXXXXX','XXXXXXX','.XXXXX.','..XXX..','...X...'].flatMap((row,r)=>[...row].flatMap((c,k)=>c==='X'?[[[-.9+k*.3,.75-r*.3]as Pt]]:[])),exit:'shatter',ring:false,pillar:false},
 'koi-current':{emblem:[closed([-.9,0],[-.4,.35],[.3,.4],[.75,.15],[.95,0],[.75,-.15],[.3,-.4],[-.4,-.35]),poly([-.9,0],[-1.2,.45],[-1.1,0],[-1.2,-.45],[-.9,0]),ring(.55,.08,.05)],exit:'spiral',ring:false,pillar:false},
 'mixtape':{emblem:[ring(-.5,-.5,.22,.16),ring(.4,-.35,.22,.16),poly([-.3,-.45],[-.3,.75],[.6,.9],[.6,-.3]),poly([-.3,.5],[.6,.65])],exit:'rise',ring:false,pillar:false},
 'guard-sash':{emblem:[star(0,.25,.55,.38,12),ring(0,.25,.2),poly([-.15,-.25],[-.4,-1],[-.25,-.85],[-.1,-1]),poly([.15,-.25],[.4,-1],[.25,-.85],[.1,-1])],exit:'fall',ring:true,pillar:false},
 'hummingbird':{emblem:[closed([-.1,0],[.3,.1],[.4,0],[.3,-.12]),poly([.4,.02],[1,.1]),poly([0,.05],[-.6,.9],[-.15,.08]),poly([0,-.05],[-.75,-.6],[-.12,-.08]),poly([-.1,0],[-.6,-.15],[-.5,0],[-.6,.15],[-.1,0])],exit:'spiral',ring:false,pillar:false},
 'abyssal-requiem':{emblem:[poly([0,-.9],[0,.1]),poly([0,.1],[-.35,.45],[-.95,.55],[-.6,.25],[-.2,.05],[0,.1]),poly([0,.1],[.35,.45],[.95,.55],[.6,.25],[.2,.05],[0,.1])],exit:'fall',ring:true,pillar:false},
 'velvet-thorn':{emblem:[spiral(2.2,.05,.5,0,.3),poly([0,-.2],[0,-1]),poly([0,-.55],[-.4,-.35],[-.15,-.5]),poly([0,-.75],[.4,-.55],[.15,-.7])],exit:'fall',ring:false,pillar:false},
 'meridian-key':{emblem:[ring(0,0,.85),...Array.from({length:12},(_,i)=>{const t=i/12*TAU;return poly([Math.cos(t)*.68,Math.sin(t)*.68],[Math.cos(t)*.82,Math.sin(t)*.82]);}),poly([0,0],[0,.6]),poly([0,0],[.42,-.2])],exit:'spiral',ring:true,pillar:false},
 'glacier-survey':{emblem:[closed([0,1],[.35,.55],[.35,-.55],[0,-1],[-.35,-.55],[-.35,.55]),poly([0,1],[0,-1]),closed([.55,.4],[.8,.1],[.8,-.4],[.55,-.6],[.45,-.2])],exit:'shatter',ring:true,pillar:false},
 'void-lance':{emblem:[ring(0,0,.9),ring(0,0,.5),poly([-1.1,0],[-.6,0]),poly([.6,0],[1.1,0]),poly([0,1.1],[0,.6]),poly([0,-.6],[0,-1.1])],exit:'implode',ring:true,pillar:true},
 'prismwing':{emblem:[closed([0,0],[-.4,.75],[-.95,.6],[-.75,.05]),closed([0,0],[.4,.75],[.95,.6],[.75,.05]),closed([0,0],[-.6,-.25],[-.55,-.75],[-.15,-.4]),closed([0,0],[.6,-.25],[.55,-.75],[.15,-.4]),poly([0,.2],[0,-.5])],exit:'spiral',ring:false,pillar:false},
 'crescent-sabre':{emblem:[[...arc(0,0,.9,Math.PI*.25,Math.PI*1.75,26),...arc(.35,0,.72,Math.PI*1.68,Math.PI*.32,24)]],exit:'rise',ring:false,pillar:false},
 'clockwork-cleaver':{emblem:[star(0,0,.95,.78,14,0),ring(0,0,.42),...Array.from({length:5},(_,i)=>{const t=i/5*TAU;return poly([Math.cos(t)*.42,Math.sin(t)*.42],[Math.cos(t)*.7,Math.sin(t)*.7]);})],exit:'spiral',ring:true,pillar:false},
 'serpent-kris':{emblem:[Array.from({length:33},(_,i)=>{const t=i/32;return[Math.sin(t*TAU*1.25)*.45,-1+t*1.7]as Pt;}),closed([.0,.7],[.3,.8],[.45,.95],[.15,1],[-.1,.85]),poly([.45,.95],[.65,.98],[.75,1.05])],exit:'spiral',ring:false,pillar:false},
 'frost-fang':{emblem:Array.from({length:6},(_,i)=>{const t=i/6*TAU,c=Math.cos(t),s=Math.sin(t),p=(u:number,v:number):Pt=>[u*c-v*s,u*s+v*c];return[p(0,0),p(.95,0),p(.6,0),p(.78,.2),p(.6,0),p(.78,-.2),p(.6,0),p(.35,0),p(.5,.18),p(.35,0),p(.5,-.18)]as Line;}),exit:'shatter',ring:true,pillar:false},
 'vermilion-plume':{emblem:Array.from({length:7},(_,i)=>petal(Math.PI*.15+i/6*Math.PI*.7,1,.16)).map(l=>l.map(([x,y])=>[x,y-.55]as Pt)),exit:'rise',ring:true,pillar:false},
 'ink-bamboo':{emblem:[poly([-.3,-1],[-.3,1]),poly([.25,-1],[.25,.7]),...[-.4,.2,.75].map(y=>poly([-.38,y],[-.22,y])),...[-.6,.0].map(y=>poly([.17,y],[.33,y])),petal(Math.PI*.15,.6,.13).map(([x,y])=>[x-.3,y+.4]as Pt),petal(Math.PI*.8,.6,.13).map(([x,y])=>[x+.25,y+.1]as Pt)],exit:'fall',ring:false,pillar:false},
 'reef-regalia':{emblem:[poly([0,-1],[0,.9]),poly([-.55,.85],[-.55,.2],[.55,.2],[.55,.85]),poly([-.65,.7],[-.55,.95],[-.45,.7]),poly([-.1,.75],[0,1],[.1,.75]),poly([.45,.7],[.55,.95],[.65,.7])],exit:'rise',ring:true,pillar:false},
 'tide-moon':{emblem:[[...arc(0,.25,.7,Math.PI*.3,Math.PI*1.7,24),...arc(.3,.25,.55,Math.PI*1.62,Math.PI*.38,22)],wave(-.75,.12,1.5)],exit:'scatter',ring:true,pillar:false},
 'storm-halberd':{emblem:[[[-.25,.75],[.2,.95],[.65,.85],[.92,.45],[1,0],[.92,-.45],[.65,-.85],[.2,-.95],[-.25,-.75],[.1,-.4],[.25,0],[.1,.4],[-.25,.75]],bolt(.42,.55),poly([-.35,-1.1],[-.35,1.1]),poly([-.35,1.1],[-.2,1.25],[-.5,1.25],[-.35,1.1])],exit:'shatter',ring:true,pillar:true},
 'foundry-bell':{emblem:[poly([-.75,-.55],[-.55,-.4],[-.45,.4],[-.2,.7],[.2,.7],[.45,.4],[.55,-.4],[.75,-.55],[-.75,-.55]),ring(0,-.72,.12),arc(0,.15,.98,Math.PI*1.15,Math.PI*1.85,16),arc(0,.15,1.15,Math.PI*1.2,Math.PI*1.8,16)],exit:'scatter',ring:true,pillar:true},
 'sugar-crash':{emblem:[spiral(2.5,.04,.6,0,.3),poly([0,-.3],[0,-1.05])],exit:'scatter',ring:false,pillar:false},
 'cathedral-chime':{emblem:[closed([-.6,-1],[-.6,.2],[0,.95],[.6,.2],[.6,-1]),ring(0,.15,.28),poly([-.3,-1],[-.3,-.25]),poly([.3,-1],[.3,-.25]),poly([-.6,-.35],[.6,-.35])],exit:'rise',ring:true,pillar:true},
 'comet-thruster':{emblem:[ring(.45,.45,.3),poly([.2,.25],[-.9,-.75]),poly([.3,.15],[-.6,-.95]),poly([.15,.4],[-1,-.5])],exit:'scatter',ring:true,pillar:false},
 'amethyst-geode':{emblem:[closed([-.2,-.8],[-.35,.3],[-.15,.85],[.05,.3],[-.05,-.8]),closed([.1,-.8],[.25,.15],[.45,.6],[.6,.1],[.4,-.8]),closed([-.45,-.8],[-.7,-.1],[-.75,.35],[-.55,0],[-.25,-.8]),poly([-.9,-.8],[.9,-.8])],exit:'shatter',ring:true,pillar:true},
};

const EXIT:Record<FinisherExit,number>={rise:0,scatter:1,spiral:2,fall:3,shatter:4,implode:5};
const SHAPE:Record<ParticleShape,number>={ember:0,crystal:1,ring:2,pixel:3,petal:4,star:5};
export const FINISHER_POINTS=140,FINISHER_LIFE=1.15;

/** Even samples along all strokes of an emblem (isolated points kept as-is). */
export function sampleEmblem(emblem:readonly Line[],count=FINISHER_POINTS):Pt[]{
 const segs:{a:Pt;b:Pt;len:number}[]=[],dots:Pt[]=[];
 for(const line of emblem){if(line.length===1){dots.push(line[0]);continue;}for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];segs.push({a,b,len:Math.hypot(b[0]-a[0],b[1]-a[1])});}}
 const out:Pt[]=[...dots.slice(0,count)],rest=count-out.length,total=segs.reduce((n,s)=>n+s.len,0);
 if(rest>0&&total>0)for(let i=0;i<rest;i++){let d=(i+.5)/rest*total;for(const s of segs){if(d<=s.len||s===segs[segs.length-1]){const t=s.len?Math.min(1,d/s.len):0;out.push([s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t]);break;}d-=s.len;}}
 while(out.length<count)out.push(out[out.length%Math.max(1,dots.length||out.length)]??[0,0]);
 return out;
}

const VERTEX=`
uniform float uTime;uniform float uExit;uniform float uSize;uniform vec3 uOrigin;uniform vec3 uCenter;uniform vec3 uUp;
attribute vec3 aStart;attribute float aSeed;
varying float vAlpha;varying float vSpin;
void main(){
 float t=uTime,a=smoothstep(0.,.3,t),e=smoothstep(.72,1.15,t),k=a*a*(3.-2.*a);
 vec3 burst=uOrigin+aStart*(.25+.9*sin(min(t/.3,1.)*3.14159));
 vec3 p=mix(burst,position,k);
 vec3 off=p-uCenter;
 if(uExit<.5)p+=uUp*e*.9+aStart*e*.15;
 else if(uExit<1.5)p+=normalize(aStart+vec3(.001))*e*1.4;
 else if(uExit<2.5){float ang=e*4.;vec3 axis=uUp;p=uCenter+off*cos(ang)+cross(axis,off)*sin(ang)+axis*dot(axis,off)*(1.-cos(ang));p+=off*e*.8+uUp*e*.3;}
 else if(uExit<3.5)p+=vec3(sin(t*6.+aSeed*20.)*.12*e,-e*e*1.3,cos(t*5.+aSeed*13.)*.12*e);
 else if(uExit<4.5)p+=aStart*e*1.8-uUp*e*e*1.2;
 else p=mix(p,uCenter,e*e);
 vec4 mv=modelViewMatrix*vec4(p,1.);
 float twinkle=.75+.25*sin(t*18.+aSeed*50.);
 vAlpha=smoothstep(0.,.06,t)*(1.-e)*twinkle*(uExit>4.5?1.+e*2.:1.);
 vSpin=aSeed*6.283+t*(fract(aSeed*3.7)-.5)*5.;
 gl_PointSize=clamp(uSize*(.75+.5*fract(aSeed*13.1))*projectionMatrix[1][1]*420./max(.1,-mv.z),2.,40.);
 gl_Position=projectionMatrix*mv;
}`;
const FRAGMENT=`
uniform vec3 uColor;uniform vec3 uSecondary;uniform float uShape;uniform float uOpacity;
varying float vAlpha;varying float vSpin;
void main(){
 vec2 q=gl_PointCoord*2.-1.;float c=cos(vSpin),s=sin(vSpin);q=mat2(c,-s,s,c)*q;
 float r=length(q),m;
 if(uShape<.5)m=smoothstep(1.,.1,r);
 else if(uShape<1.5)m=step(abs(q.x)*.62+abs(q.y),.82);
 else if(uShape<2.5)m=smoothstep(.22,.0,abs(r-.62));
 else if(uShape<3.5)m=step(max(abs(q.x),abs(q.y)),.62);
 else if(uShape<4.5)m=step(length(q*vec2(1.,1.8)),.9);
 else m=smoothstep(.16,.0,min(abs(q.x)*(.35+abs(q.y)),abs(q.y)*(.35+abs(q.x))))*step(r,1.);
 if(m<.02)discard;
 gl_FragColor=vec4(mix(uSecondary,uColor,.4+.6*m),m*clamp(vAlpha,0.,1.)*uOpacity);
}`;

type Slot={points:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;wave:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;pillar:THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>;life:number;finisher:Finisher;order:number};
const cache=new Map<string,Pt[]>();

export class KillFinishers{
 private slots:Slot[]=[];private order=0;
 constructor(private parent:THREE.Object3D,private max=5){}
 get active(){return this.slots.filter(s=>s.life>0).length;}
 private create():Slot{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(FINISHER_POINTS*3),3));
  geometry.setAttribute('aStart',new THREE.BufferAttribute(new Float32Array(FINISHER_POINTS*3),3));
  geometry.setAttribute('aSeed',new THREE.BufferAttribute(new Float32Array(Array.from({length:FINISHER_POINTS},(_,i)=>(Math.sin(i*91.7)*43758.5)%1+1).map(v=>v%1)),1));
  const material=new THREE.ShaderMaterial({name:'Kill finisher',vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
   uniforms:{uTime:{value:0},uExit:{value:0},uSize:{value:.05},uOrigin:{value:new THREE.Vector3()},uCenter:{value:new THREE.Vector3()},uUp:{value:new THREE.Vector3(0,1,0)},uColor:{value:new THREE.Color()},uSecondary:{value:new THREE.Color()},uShape:{value:0},uOpacity:{value:1}}});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=6;points.name='Kill finisher emblem';points.raycast=()=>{};
  const wave=new THREE.Mesh(new THREE.RingGeometry(.86,1,48),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));wave.rotation.x=-Math.PI/2;wave.name='Kill finisher shockwave';wave.raycast=()=>{};
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.32,.42,2.6,24,1,true),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));pillar.name='Kill finisher pillar';pillar.raycast=()=>{};
  return{points,wave,pillar,life:0,finisher:FINISHERS['stormcoil'],order:0};
 }
 /** `feet` is the victim position; `camera` orients the emblem toward the viewer. */
 play(feet:Vec3,skinId:string|undefined,camera:THREE.Camera,aiming=false){
  const finisher=skinId?FINISHERS[skinId as SignatureId]:undefined,style=skinEffect(skinId);if(!finisher||!style||!feet.every(Number.isFinite))return false;
  let slot=this.slots.find(s=>s.life<=0);if(!slot){if(this.slots.length<this.max){slot=this.create();this.slots.push(slot);}else slot=this.slots.reduce((a,b)=>a.order<b.order?a:b);}
  slot.life=FINISHER_LIFE;slot.finisher=finisher;slot.order=++this.order;
  const origin=new THREE.Vector3(feet[0],feet[1]+1.1,feet[2]),center=new THREE.Vector3(feet[0],feet[1]+(aiming?2.35:1.75),feet[2]);
  camera.updateMatrixWorld();const forward=new THREE.Vector3();camera.getWorldDirection(forward);
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));if(right.lengthSq()<1e-6)right.set(1,0,0);right.normalize();
  const up=new THREE.Vector3(0,1,0),scale=aiming?.5:.72;
  const pts=cache.get(skinId!)??sampleEmblem(finisher.emblem);cache.set(skinId!,pts);
  const pos=slot.points.geometry.getAttribute('position') as THREE.BufferAttribute,start=slot.points.geometry.getAttribute('aStart') as THREE.BufferAttribute;
  pts.forEach(([x,y],i)=>{
   const p=center.clone().addScaledVector(right,x*scale).addScaledVector(up,y*scale);pos.setXYZ(i,p.x,p.y,p.z);
   const a=i*2.399963,z=((i*.6180339)%1)*2-1,r=Math.sqrt(1-z*z);start.setXYZ(i,Math.cos(a)*r,z*.7+.2,Math.sin(a)*r);
  });
  pos.needsUpdate=true;start.needsUpdate=true;
  const u=slot.points.material.uniforms;u.uTime.value=0;u.uExit.value=EXIT[finisher.exit];u.uOrigin.value.copy(origin);u.uCenter.value.copy(center);u.uUp.value.copy(up);
  // Dark accents (wax red, navy) vanish under additive light: lift them toward white.
  const lift=(c:THREE.Color)=>{const l=.2126*c.r+.7152*c.g+.0722*c.b;if(l<.3)c.lerp(new THREE.Color(1,1,1),.42-l);return c;};
  lift(u.uColor.value.setHex(style.color));lift(u.uSecondary.value.setHex(style.secondary));u.uShape.value=SHAPE[style.particle];u.uOpacity.value=aiming?.5:1;u.uSize.value=aiming?.08:.12;
  slot.wave.position.set(feet[0],feet[1]+.04,feet[2]);slot.wave.material.color.setHex(style.color);slot.wave.visible=finisher.ring;
  slot.pillar.position.set(feet[0],feet[1]+1.3,feet[2]);slot.pillar.material.color.setHex(style.secondary);slot.pillar.visible=finisher.pillar;
  this.parent.add(slot.points,slot.wave,slot.pillar);this.update(0);return true;
 }
 update(dt:number){
  if(!Number.isFinite(dt)||dt<0)return;
  for(const slot of this.slots){if(slot.life<=0)continue;
   slot.life=Math.max(0,slot.life-dt);const t=FINISHER_LIFE-slot.life;slot.points.material.uniforms.uTime.value=t;
   const w=Math.min(1,t/.5);slot.wave.scale.setScalar(.25+w*1.8);slot.wave.material.opacity=slot.finisher.ring?(1-w)*.65*slot.points.material.uniforms.uOpacity.value:0;
   const p=Math.min(1,t/.55);slot.pillar.scale.set(1-p*.6,.4+p*.8,1-p*.6);slot.pillar.material.opacity=slot.finisher.pillar?(1-p)*.35*slot.points.material.uniforms.uOpacity.value:0;
   if(slot.life<=0)for(const o of[slot.points,slot.wave,slot.pillar])o.removeFromParent();
  }
 }
 clear(){for(const slot of this.slots){slot.life=0;for(const o of[slot.points,slot.wave,slot.pillar])o.removeFromParent();}}
 dispose(){this.clear();for(const slot of this.slots){slot.points.geometry.dispose();slot.points.material.dispose();slot.wave.geometry.dispose();slot.wave.material.dispose();slot.pillar.geometry.dispose();slot.pillar.material.dispose();}this.slots.length=0;}
}
/** Every catalogued finish has a finisher (guarded by tests). */
export const finisherIds=()=>SIGNATURE_SKINS.map(s=>s.id).filter(id=>id in FINISHERS);
