/** Ambient particles for sculpted finishes: a few motes rise off each model's
 * lit details and fade, drawn in the skin's own particle shape (ember, crystal,
 * petal, star, pixel or ring). Presentation only; one draw call per weapon, all
 * motion on the GPU, and no allocation per frame. */
import * as THREE from 'three';
import type {SignatureStyle} from '../../shared/signatureSkins.ts';
import {skinEffect,type ParticleShape} from './skinEffects.ts';

const SHAPES:Record<ParticleShape,number>={ember:0,crystal:1,ring:2,pixel:3,petal:4,star:5};
const VERTEX=`
uniform float uTime;uniform float uKick;uniform float uSize;
attribute float aSeed;attribute vec3 aDrift;
varying float vAlpha;varying float vSpin;
void main(){
 float phase=fract(uTime*(.18+.14*fract(aSeed*7.13))+aSeed);
 vec3 p=position+aDrift*phase+vec3(sin(uTime*1.7+aSeed*40.)*.008,0.,cos(uTime*1.3+aSeed*23.)*.008);
 vec4 mv=modelViewMatrix*vec4(p,1.);
 vAlpha=sin(phase*3.14159)*(.55+.45*sin(uTime*5.+aSeed*61.))*(1.+uKick*1.6);
 vSpin=aSeed*6.283+uTime*(fract(aSeed*3.7)-.5)*2.;
 gl_PointSize=clamp(uSize*(.7+.6*fract(aSeed*13.1))*projectionMatrix[1][1]*420./max(.05,-mv.z),1.,28.);
 gl_Position=projectionMatrix*mv;
}`;
const FRAGMENT=`
uniform vec3 uColor;uniform vec3 uSecondary;uniform float uShape;
varying float vAlpha;varying float vSpin;
void main(){
 vec2 q=gl_PointCoord*2.-1.;float c=cos(vSpin),s=sin(vSpin);q=mat2(c,-s,s,c)*q;
 float r=length(q),m;
 if(uShape<.5)m=smoothstep(1.,.15,r);
 else if(uShape<1.5)m=step(abs(q.x)*.62+abs(q.y),.82);
 else if(uShape<2.5)m=smoothstep(.22,.0,abs(r-.62));
 else if(uShape<3.5)m=step(max(abs(q.x),abs(q.y)),.62);
 else if(uShape<4.5)m=step(length(q*vec2(1.,1.8)),.9);
 else m=smoothstep(.16,.0,min(abs(q.x)*(.35+abs(q.y)),abs(q.y)*(.35+abs(q.x))))*step(r,1.);
 if(m<.02)discard;
 gl_FragColor=vec4(mix(uSecondary,uColor,.35+.65*m),m*clamp(vAlpha,0.,1.)*.85);
}`;

/** Motes are light, not matter: never picked by raycasts (ADS sight checks, hit tests). */
class MotePoints extends THREE.Points{override raycast(){}}
function hash(n:number){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
/** Seed positions on the model's glowing (otherwise metal) surfaces in static parts. */
export function addSignatureMotes(asset:THREE.Object3D,partPrefix:string,style:SignatureStyle,count=26){
 asset.updateWorldMatrix(true,true);
 const inverse=asset.matrixWorld.clone().invert(),sources:{mesh:THREE.Mesh;weight:number}[]=[];
 const pick=(re:RegExp)=>{asset.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.parent?.userData.spin)return;const m=o.material as THREE.Material;if(re.test(m.name))sources.push({mesh:o,weight:o.geometry.getAttribute('position').count});});};
 pick(/glow/);if(!sources.length)pick(/metal/);if(!sources.length)return null;
 const total=sources.reduce((n,s)=>n+s.weight,0),positions:number[]=[],drift:number[]=[],seeds:number[]=[],v=new THREE.Vector3(),n=new THREE.Vector3(),normal=new THREE.Matrix3();
 for(let i=0;i<count;i++){
  let target=hash(i+style.body%997)*total,source=sources[0];for(const s of sources){if(target<s.weight){source=s;break;}target-=s.weight;}
  const g=source.mesh.geometry,position=g.getAttribute('position'),normals=g.getAttribute('normal'),k=Math.floor(hash(i*3.1+7)*position.count);
  const local=source.mesh.matrixWorld.clone().premultiply(inverse);normal.getNormalMatrix(local);
  v.fromBufferAttribute(position,k).applyMatrix4(local);n.set(0,1,0);if(normals)n.fromBufferAttribute(normals,k).applyMatrix3(normal).normalize();
  v.addScaledVector(n,.012);positions.push(v.x,v.y,v.z);
  drift.push(n.x*.025+(hash(i+.5)-.5)*.02,.05+.05*hash(i+1.5),n.z*.025+(hash(i+2.5)-.5)*.02);seeds.push(hash(i+9.9));
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('aDrift',new THREE.Float32BufferAttribute(drift,3));geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));
 geometry.computeBoundingSphere();geometry.computeBoundingBox();
 const effect=skinEffect(style.id),material=new THREE.ShaderMaterial({name:'Sculpt_motes',vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uTime:{value:0},uKick:{value:0},uSize:{value:.011},uColor:{value:new THREE.Color(effect?.color??style.accent)},uSecondary:{value:new THREE.Color(effect?.secondary??style.trim)},uShape:{value:SHAPES[effect?.particle??'ember']}}});
 material.userData.finish=style.id;
 const points=new MotePoints(geometry,material);points.name=`${partPrefix}__motes`;points.userData.motes=true;points.frustumCulled=false;points.renderOrder=2;
 asset.add(points);return points;
}
/** Advance motes inside `parts` (called beside the rotor update). */
export function animateMotes(part:THREE.Object3D,seconds:number,kick:number){
 const m=(part as THREE.Points).material as THREE.ShaderMaterial|undefined;if(!m?.uniforms?.uTime)return;
 m.uniforms.uTime.value=seconds%1000;m.uniforms.uKick.value+= (Math.min(1,Math.max(0,kick))-m.uniforms.uKick.value)*.25;
}
