/** Original, weapon-specific surface art. All geometry belongs to the instance;
 * projection follows the actual painted mesh, including moving stock/fore-end.
 * No material or geometry from the source GLB is edited. */
import * as THREE from 'three';
import {signatureOf,type SignatureId,type SignatureStyle} from '../shared/signatureSkins.ts';
import {refineWeaponMaterial} from './weaponSurface.ts';

type Point=readonly[number,number];
type ProjectedFace=readonly[number,number,number,number,number,number,number,number,number,number];
const patterns:Record<SignatureId,string>={
 'tidal-engine':`float wave=sin(p.x*11.0+p.y*7.0+sin(p.x*4.0)*1.5);float channel=1.0-smoothstep(.04,.12,abs(wave));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.62,.57),channel*.24);`,
 'celadon-atlas':`vec2 q=p.xy*24.0;float crack=abs(sin(q.x+sin(q.y*1.7))*sin(q.y+cos(q.x*.9)));float line=1.0-smoothstep(.008,.035,crack);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.37,.32),line*.23);`,
 'abyssal-requiem':`float depth=.5+.5*sin(p.y*8.0+p.x*1.5);float mote=step(.996,fract(sin(dot(floor(p.xy*130.0),vec2(31.1,79.7)))*43758.5));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.06,.27,.37),depth*.32)+vec3(.3,.65,.78)*mote*.45;`,
 'vermilion-plume':`float lacquer=.5+.5*sin(p.x*7.0+p.y*13.0);float vein=1.0-smoothstep(.025,.08,abs(sin(p.x*32.0-p.y*19.0)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.045,.025),lacquer*.2);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.43,.12),vein*.2);`,
 'foundry-bell':`float grain=fract(sin(dot(floor(p.xy*180.0),vec2(51.1,17.7)))*43758.5);float casting=step(.95,fract(p.y*13.0));diffuseColor.rgb*=.83+grain*.22;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.11,.04),casting*.25);`,
 'amber-apiary':`float resin=.5+.5*sin(p.x*4.0+sin(p.y*5.0));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.63,.35,.07),resin*.16);`,
 'mint-arcade':`float panel=step(.7,fract(p.x*3.0+p.y*2.0));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.31,.70,.64),panel*.12);`,
 'abyssal-maw':`float scale=.5+.5*sin(p.x*12.0+sin(p.y*14.0));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.04,.17,.16),scale*.2);`,
 'velvet-thorn':`float silk=.5+.5*sin(p.x*3.0-p.y*4.0);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.07,.13),silk*.2);`,
 'prismwing':`float wing=.5+.5*sin(p.x*5.0+p.y*8.0);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.50,.73,.79),wing*.22);`,
 'ink-bamboo':`float fibre=.5+.5*sin(p.x*28.0+sin(p.y*4.0));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.08,.22,.16),fibre*.15);`,
 'sugar-crash':`float icing=.5+.5*sin(p.x*3.0+p.y*6.0);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.95,.72,.77),icing*.13);`,
 'graviton-crucible':'', 'koi-current':'', 'owl-canticle':'', 'meridian-key':'',
};
export function signatureMaterial(source:THREE.MeshStandardMaterial,id:SignatureId,clock:{value:number}){
 const s:SignatureStyle=signatureOf(id)!,m=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(m,source);m.defines={...m.defines,PHYSICAL:''};
 const body=/^PH_ivory(?:[._]?\d+)?$/.test(source.name),glow=/^PH_glow(?:[._]?\d+)?$/.test(source.name),grip=/rubber/i.test(source.name),glass=/glass/i.test(source.name);
 m.clearcoat=s.weapon==='hammer'&&s.metal>.4?.22:1;m.clearcoatRoughness=.22;m.iridescence=s.iris;m.iridescenceThicknessRange=[160,420];
 if(body){m.color.setHex(s.body);m.metalness=s.metal;m.roughness=s.rough;}
 else if(glow){m.color.setHex(s.accent);m.emissive.setHex(s.accent);m.emissiveIntensity=.36;m.roughness=.24;}
 else if(grip){m.color.setHex(s.weapon==='corona'?0x392920:0x17202b);m.metalness=.02;m.roughness=.88;m.clearcoat=.04;m.iridescence=0;}
 else if(glass){m.color.setHex(s.accent);m.metalness=.25;m.roughness=.12;}
 else if(/dark|black/i.test(source.name)&&s.shadow!==undefined){m.color.setHex(s.shadow);m.metalness=Math.min(s.metal,.55);m.roughness=Math.max(s.rough,.33);}
 else if(/dark/i.test(source.name)&&['blade','polearm','hammer'].includes(s.weapon)){m.color.setHex(s.weapon==='blade'?0x201b32:s.weapon==='polearm'?0x29191d:0x252a30);m.metalness=.55;m.roughness=.33;}
 else if(!/dark|black/i.test(source.name)){m.color.setHex(s.trim);m.metalness=.83;m.roughness=s.weapon==='hammer'?.42:.27;}
 m.userData.finish=id;m.customProgramCacheKey=()=>`signature-${id}-${body?'paint':glow?'core':'trim'}-1`;
 if(body||glow)m.onBeforeCompile=shader=>{
  shader.uniforms.phSignatureTime=clock;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 phSignaturePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nphSignaturePosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 phSignaturePosition;\nuniform float phSignatureTime;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n{vec3 p=phSignaturePosition;'+(body?patterns[id]:'diffuseColor.rgb*=.95+.05*sin(phSignatureTime*.8+p.x*3.0);')+'}');
 };
 refineWeaponMaterial(m,id);return m;
}

/** Tiny, conformal relief: triangles with a missed sample or depth discontinuity
 * are discarded, so no emblem bridges a void or hovers off a curved surface. */
class SurfaceArt{
 private positions:number[][]=[[],[],[]];private inverse:THREE.Matrix4;private box=new THREE.Box3();
 private grid:ProjectedFace[][]=Array.from({length:64*32},()=>[]);private depths=new Map<string,readonly[number,number]|null>();
 constructor(private part:THREE.Object3D,private top=false){
  part.updateWorldMatrix(true,true);this.inverse=part.matrixWorld.clone().invert();const targets:THREE.Mesh[]=[];
  part.traverse(o=>{if(o instanceof THREE.Mesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>/^PH_(?:ivory|dark|black|steel|copper)(?:[._]?\d+)?$/.test(m.name))){targets.push(o);this.box.expandByObject(o);}});
  // A small 2D acceleration grid over the original triangles replaces thousands
  // of full-mesh raycasts. Projection still uses exact barycentric surface depth.
  if(top){this.box.min.set(this.box.min.x,this.box.min.z,this.box.min.y);this.box.max.set(this.box.max.x,this.box.max.z,this.box.max.y);}
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const mesh of targets){const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;for(let i=0;i<(index?.count??p.count);i+=3){
   a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
   if(top)for(const v of [a,b,c])v.set(v.x,v.z,v.y);
   const dx=b.x-a.x,dy=b.y-a.y,ex=c.x-a.x,ey=c.y-a.y,det=dx*ey-dy*ex;if(Math.abs(det)<1e-12)continue;
   const face:ProjectedFace=[a.x,a.y,a.z,dx,dy,b.z-a.z,ex,ey,c.z-a.z,1/det];
   const x0=this.cellX(Math.min(a.x,b.x,c.x)),x1=this.cellX(Math.max(a.x,b.x,c.x)),y0=this.cellY(Math.min(a.y,b.y,c.y)),y1=this.cellY(Math.max(a.y,b.y,c.y));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)this.grid[y*64+x].push(face);
  }}
 }
 private cellX(x:number){return Math.max(0,Math.min(63,Math.floor((x-this.box.min.x)/Math.max(1e-8,this.box.max.x-this.box.min.x)*64)));}
 private cellY(y:number){return Math.max(0,Math.min(31,Math.floor((y-this.box.min.y)/Math.max(1e-8,this.box.max.y-this.box.min.y)*32)));}
 private hit(p:Point,side:number,bin:number){
  if(this.box.isEmpty()||p[0]<this.box.min.x||p[0]>this.box.max.x||p[1]<this.box.min.y||p[1]>this.box.max.y)return null;
  const key=p[0].toFixed(7)+','+p[1].toFixed(7);let depths=this.depths.get(key);
  if(depths===undefined){let near=Infinity,far=-Infinity;for(const f of this.grid[this.cellY(p[1])*64+this.cellX(p[0])]){const x=p[0]-f[0],y=p[1]-f[1],u=(x*f[7]-y*f[6])*f[9],v=(f[3]*y-f[4]*x)*f[9];if(u< -1e-7||v< -1e-7||u+v>1+1e-7)continue;const z=f[2]+u*f[5]+v*f[8];near=Math.min(near,z);far=Math.max(far,z);}depths=Number.isFinite(near)?[near,far]:null;this.depths.set(key,depths);}
  if(!depths)return null;return new THREE.Vector3(p[0],p[1],depths[side>0?1:0]+side*(bin===2?.0001:bin===0?.0004:.0007));
 }
 private projectTriangle(a:Point,b:Point,c:Point,bin:number,side:number,depth=0){
  const points=[this.hit(a,side,bin),this.hit(b,side,bin),this.hit(c,side,bin)];const [p,q,r]=points as THREE.Vector3[];
  const ab:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc:Point=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca:Point=[(c[0]+a[0])/2,(c[1]+a[1])/2],center:Point=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3];
  const interior=[this.hit(center,side,bin),this.hit(ab,side,bin),this.hit(bc,side,bin),this.hit(ca,side,bin)];
  const valid=points.every(Boolean)&&interior.every(Boolean)&&Math.max(p.z,q.z,r.z)-Math.min(p.z,q.z,r.z)<.045&&interior.every((v,i)=>Math.abs(v!.z-[(p.z+q.z+r.z)/3,(p.z+q.z)/2,(q.z+r.z)/2,(r.z+p.z)/2][i])<.003);
  if(valid){for(const v of [p,q,r]){if(this.top)v.set(v.x,v.z,v.y);this.positions[bin].push(...v.applyMatrix4(this.inverse).toArray());}return;}
  // Curved spearheads and large illustrated panels need smaller surface
  // triangles; refine twice, retaining only the pieces that actually fit.
  if(depth>=2||[...points,...interior].every(v=>!v))return;
  this.projectTriangle(a,ab,ca,bin,side,depth+1);this.projectTriangle(ab,b,bc,bin,side,depth+1);this.projectTriangle(ca,bc,c,bin,side,depth+1);this.projectTriangle(ab,bc,ca,bin,side,depth+1);
 }
 private tri(a:Point,b:Point,c:Point,bin:number){for(const side of this.top?[1]:[-1,1])this.projectTriangle(a,b,c,bin,side);}
 polygon(points:Point[],bin=0){if(points.length<3)return;const center:Point=[points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length];for(let i=0;i<points.length;i++)this.tri(center,points[i],points[(i+1)%points.length],bin);}
 path(points:Point[],width:number,bin=0){for(let i=1;i<points.length;i++){const [a,b]=[points[i-1],points[i]],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<.00001)continue;const x=-dy/length*width/2,y=dx/length*width/2;this.polygon([[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]],bin);}}
 curve(points:Point[],width:number,bin=0){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p,0)));this.path(curve.getPoints(Math.max(20,points.length*8)).map(v=>[v.x,v.y]as const),width,bin);}
 arc(x:number,y:number,r:number,start=0,end=Math.PI*2,width=.012,bin=0){this.path(Array.from({length:49},(_,i)=>[x+Math.cos(start+(end-start)*i/48)*r,y+Math.sin(start+(end-start)*i/48)*r]as const),width,bin);}
 build(materials:THREE.Material[],name:string){const group=new THREE.Group();group.name=name;for(let i=0;i<3;i++){if(!this.positions[i].length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions[i],3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,materials[i]);mesh.name=`${name}_${['metal','light','enamel'][i]}`;group.add(mesh);}if(!group.children.length)return null;this.part.add(group);return group;}
}

export function addSignatureArt(parts:Record<string,THREE.Object3D>,id:SignatureId){
 const s:SignatureStyle=signatureOf(id)!;
 const metal=new THREE.MeshPhysicalMaterial({color:s.trim,metalness:.86,roughness:.25,clearcoat:.75,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const light=new THREE.MeshPhysicalMaterial({color:s.accent,emissive:s.accent,emissiveIntensity:.20,metalness:.3,roughness:.2,clearcoat:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const enamel=new THREE.MeshPhysicalMaterial({color:s.inlay??(s.weapon==='halo'?0x3c9388:s.weapon==='firefly'?0xe7ebc8:0x151f2b),metalness:.25,roughness:.34,clearcoat:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const materials=[metal,light,enamel],groups:THREE.Group[]=[];
 refineWeaponMaterial(metal,id,'metal');refineWeaponMaterial(light,id,'accent');refineWeaponMaterial(enamel,id,'coat');
 const draw=(role:string,paint:(a:SurfaceArt)=>void,top=false)=>{if(!parts[role])return;const a=new SurfaceArt(parts[role],top);paint(a);const group=a.build(materials,`Signature_${id}_${role}${top?'_crown':''}`);if(group)groups.push(group);};
 draw('body',a=>{
  switch(id){
   case'tidal-engine':
    for(let i=0;i<4;i++)a.curve([[-.52,.12+i*.055],[-.1,.08+i*.04],[.45,.32+i*.024],[1.3,.17+i*.045]],i===0?.024:.012,i===0?1:0);
    a.arc(-.23,.29,.105,0,Math.PI*2,.014);a.arc(-.23,.29,.072,-.8,3.7,.024,1);
    for(let i=0;i<7;i++){const t=i/7*Math.PI*2;a.path([[-.23+Math.cos(t)*.08,.29+Math.sin(t)*.08],[-.23+Math.cos(t+.38)*.048,.29+Math.sin(t+.38)*.048]],.009);}
    break;
   case'celadon-atlas':
    a.polygon([[-.95,.23],[-.65,.38],[-.35,.26],[-.12,.40],[.15,.23],[.41,.34],[.77,.22]],2);
    a.path([[-.95,.23],[-.65,.38],[-.35,.26],[-.12,.40],[.15,.23],[.41,.34],[.77,.22]],.012,0);
    for(let i=0;i<3;i++)a.curve([[-.97,.22+i*.028],[-.45,.20+i*.028],[.04,.28+i*.028],[.72,.22+i*.028]],.006,i===0?0:1);
    a.arc(.58,.36,.052,0,Math.PI*2,.009,0);break;
   case'abyssal-requiem':
    a.curve([[-.53,.21],[-.12,.30],[.65,.24],[1.54,.24]],.015,0);
    for(let i=0;i<12;i++){const x=-.38+i*.147;a.curve([[x,.27],[x+.025,.17],[x+.085,.11]],.010,i%4===0?1:0);}
    a.polygon([[1.39,.24],[1.59,.37],[1.53,.24],[1.64,.11]],0);a.arc(-.38,.25,.028,0,Math.PI*2,.010,1);break;
   case'vermilion-plume':
    a.curve([[.68,.015],[.96,.025],[1.35,.015],[1.74,.015]],.013,1);
    for(let i=0;i<7;i++){const x=.71+i*.13,spread=.23-i*.023;for(const sign of [-1,1])a.curve([[x,.015],[x+.13,.015+sign*spread],[x+.29,.015+sign*spread*.65]],.012,0);}
    for(let i=0;i<8;i++)a.path([[-1.5+i*.25,-.025],[-1.48+i*.25,.055]],.014,0);break;
   case'foundry-bell':
    a.arc(.47,.055,.255,0,Math.PI*2,.022,0);a.arc(.47,.055,.20,-.4,4.5,.016,1);
    for(let i=0;i<16;i++){const t=i/16*Math.PI*2;a.path([[.47+Math.cos(t)*.24,.055+Math.sin(t)*.24],[.47+Math.cos(t)*.29,.055+Math.sin(t)*.29]],.022,0);}
    a.polygon([[.37,-.06],[.56,-.06],[.56,.17],[.37,.17]],2);
    for(let i=0;i<3;i++)a.path([[.405+i*.055,-.025],[.405+i*.055,.13]],.017,1);
    a.path([[.27,-.38],[.35,-.22],[.28,-.12],[.33,.04]],.013,1);a.path([[.61,.20],[.7,.32],[.65,.45]],.012,1);break;
   case'amber-apiary':
    for(let row=0;row<2;row++)for(let col=0;col<8;col++){const x=-.4+col*.21+row*.105,y=.15+row*.145,r=.082;a.path(Array.from({length:7},(_,i)=>[x+Math.cos(i*Math.PI/3)*r,y+Math.sin(i*Math.PI/3)*r]as const),.012,col%3===0?1:0);}
    a.polygon([[-.55,.12],[-.43,.07],[-.31,.12],[-.43,.2]],1);break;
   case'mint-arcade':
    a.polygon([[-.45,.29],[-.45,.36],[-.38,.36],[-.38,.4],[-.30,.4],[-.30,.36],[-.23,.36],[-.23,.29],[-.34,.20]],2);
    for(let i=0;i<4;i++)a.polygon([[.05+i*.2,.14],[.13+i*.2,.14],[.13+i*.2,.22],[.05+i*.2,.22]],i%2?0:1);
    a.path([[.15,.34],[.15,.44]],.026,0);a.path([[.1,.39],[.2,.39]],.026,0);
    a.path([[.42,.39],[.87,.39]],.015,1);break;
   case'abyssal-maw':
    a.curve([[-.56,.36],[-.17,.39],[.29,.32]],.022,2);a.curve([[-.56,.20],[-.17,.17],[.29,.24]],.022,2);
    for(let i=0;i<7;i++){const x=-.5+i*.11;a.polygon([[x,.34],[x+.045,.245],[x+.08,.345]],0);if(i<6)a.polygon([[x+.04,.20],[x+.09,.28],[x+.13,.205]],1);}break;
   case'velvet-thorn':
    a.curve([[-.57,.12],[-.13,.27],[.42,.12],[1.03,.28],[1.58,.15]],.012,0);
    for(let i=0;i<9;i++){const x=-.42+i*.21;a.polygon([[x,.2],[x+.055,.30],[x+.08,.21]],2);}
    for(let j=0;j<3;j++){const r=.10-j*.026;a.path(Array.from({length:41},(_,i)=>{const t=i/40*Math.PI*2,rr=r*(1+.15*Math.cos(5*t));return[-.22+Math.cos(t)*rr,.27+Math.sin(t)*rr]as const;}),.009,j===2?1:0);}break;
   case'prismwing':
    for(const sign of [-1,1]){a.polygon([[.14,.01],[.42,.01+sign*.12],[.62,.01+sign*.12],[.40,.01+sign*.035],[.18,.01]],2);a.curve([[.17,.01],[.35,.01+sign*.10],[.55,.01+sign*.08]],.011,0);}
    a.path([[.13,-.045],[.19,.07]],.015,1);
    for(let i=0;i<5;i++)a.path([[.55+i*.13,.06],[.63+i*.13,.01],[.55+i*.13,-.04]],.007,i%2?1:0);break;
   case'ink-bamboo':
    a.curve([[.67,.01],[1.03,.01],[1.36,.04],[1.71,.01]],.014,0);
    for(let i=0;i<4;i++){const x=.72+i*.2;for(const sign of [-1,1])a.polygon([[x,.01],[x+.08,.01+sign*.12],[x+.28,.01+sign*.18],[x+.18,.01+sign*.04]],i%2?0:1);}
    for(let i=0;i<8;i++)a.path([[-1.52+i*.27,-.035],[-1.52+i*.27,.06]],.014,0);break;
   case'sugar-crash':
    a.path(Array.from({length:111},(_,i)=>{const t=i/110*Math.PI*4,r=.025+.21*i/110;return[.47+Math.cos(t)*r,.055+Math.sin(t)*r]as const;}),.023,0);
    for(let i=0;i<12;i++){const t=i/12*Math.PI*2,x=.47+Math.cos(t)*.3,y=.055+Math.sin(t)*.3;a.path([[x-.014,y-.02],[x+.014,y+.02]],.018,i%2?1:2);}
    a.curve([[.24,.35],[.35,.40],[.50,.35],[.66,.40],[.75,.35]],.022,0);break;
  }
 });
 draw('stock',a=>{
  if(id==='tidal-engine')a.curve([[-1.22,.13],[-1.06,.29],[-.8,.24]],.018,1);
  if(id==='abyssal-requiem')a.curve([[-1.42,.13],[-1.25,.44],[-.86,.31]],.013,1);
  if(id==='amber-apiary')a.path([[-1.25,.18],[-1.06,.31],[-.8,.18]],.025,0);
  if(id==='mint-arcade')for(let i=0;i<3;i++)a.polygon([[-1.2+i*.12,.03],[-1.13+i*.12,.03],[-1.13+i*.12,.1],[-1.2+i*.12,.1]],1);
  if(id==='velvet-thorn')a.curve([[-1.42,.19],[-1.21,.42],[-.86,.29]],.013,0);
 });
 draw('fore_end',a=>{
  if(id==='abyssal-maw')for(let i=0;i<7;i++){const x=.46+i*.1;a.polygon([[x,.28],[x+.05,.14],[x+.085,.28]],0);a.polygon([[x,.04],[x+.055,.15],[x+.085,.04]],1);}
 });
 draw('magazine',a=>{if(id==='tidal-engine')for(let i=0;i<3;i++)a.path([[.24+i*.1,-.5],[.21+i*.1,-.11]],.012,1);});
 // Upper surfaces are visible for most of the time a gun is actually held.
 // These motifs are projected onto the real crown, including holes and rails.
 draw('body',a=>{
  switch(id){
   case'tidal-engine':
    for(const side of[-1,1])a.curve([[-.46,side*.06],[-.08,side*.095],[.45,side*.045],[1.20,side*.055]],.010,1);
    a.arc(-.36,0,.052,0,Math.PI*2,.008,0);break;
   case'amber-apiary':
    for(let i=0;i<7;i++){const x=-.39+i*.20,r=.054;a.path(Array.from({length:7},(_,j)=>[x+Math.cos(j*Math.PI/3)*r,Math.sin(j*Math.PI/3)*r]as const),.009,i%3===0?1:0);}break;
   case'mint-arcade':
    for(let i=0;i<5;i++){const x=-.32+i*.21;a.polygon([[x,-.052],[x+.065,-.052],[x+.065,.012],[x,.012]],i%2?1:2);}
    a.path([[-.28,.065],[.72,.065]],.008,0);break;
   case'celadon-atlas':
    a.path([[-.82,0],[-.62,.065],[-.38,-.025],[-.15,.07],[.18,-.03],[.47,.05],[.76,0]],.011,0);
    for(const sign of[-1,1])a.curve([[-.80,sign*.07],[-.32,sign*.085],[.21,sign*.05],[.78,sign*.06]],.006,1);break;
   case'abyssal-requiem':
    a.path([[-.48,0],[1.35,0]],.011,1);
    for(let i=0;i<11;i++){const x=-.42+i*.16;for(const sign of[-1,1])a.curve([[x,0],[x+.04,sign*.055],[x+.11,sign*.08]],.008,0);}break;
   case'velvet-thorn':
    a.curve([[-.48,-.055],[-.02,.055],[.46,-.05],[.90,.05],[1.35,-.025]],.009,0);
    for(let i=0;i<7;i++){const x=-.36+i*.22;a.polygon([[x,0],[x+.035,.065],[x+.075,.015]],2);}break;
   case'vermilion-plume':
    a.path([[.72,0],[1.70,0]],.009,0);
    for(let i=0;i<6;i++)a.path([[.8+i*.14,-.012],[.84+i*.14,.014]],.006,1);break;
   case'foundry-bell':
    for(let i=0;i<5;i++){const x=.30+i*.075;a.path([[x,-.15],[x,.15]],.014,i%2?1:0);}
    a.path([[.26,-.17],[.69,-.17],[.69,.17],[.26,.17],[.26,-.17]],.008,0);break;
  }
 },true);
 draw('stock',a=>{
  if(['tidal-engine','amber-apiary','mint-arcade','abyssal-requiem','velvet-thorn','celadon-atlas'].includes(id))for(const sign of[-1,1])a.curve([[-1.29,sign*.045],[-1.08,sign*.065],[-.82,sign*.025]],.008,id==='mint-arcade'?1:0);
 },true);
 return {groups,dispose(){for(const group of groups){group.removeFromParent();group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}materials.forEach(m=>m.dispose());}};
}
