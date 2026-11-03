/** Original, weapon-specific surface art. All geometry belongs to the instance;
 * projection follows the actual painted mesh, including moving stock/fore-end.
 * No material or geometry from the source GLB is edited. */
import * as THREE from 'three';
import {signatureOf,type SignatureId} from '../shared/signatureSkins.ts';

type Point=readonly[number,number];
type ProjectedFace=readonly[number,number,number,number,number,number,number,number,number,number];
const patterns:Record<SignatureId,string>={
 'tidal-engine':`float wave=sin(p.x*11.0+p.y*7.0+sin(p.x*4.0)*1.5);float channel=1.0-smoothstep(.04,.12,abs(wave));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.62,.57),channel*.24);`,
 'night-courier':`float lacquer=.5+.5*sin(p.x*2.0-p.y*3.0);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.075,.40),lacquer*.22);`,
 'dune-falcon':`float sand=fract(sin(dot(floor(p.xy*200.0),vec2(12.9,78.2)))*43758.5);float feather=1.0-smoothstep(.025,.11,abs(sin(p.x*23.0+p.y*11.0)));diffuseColor.rgb*=.90+sand*.14;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.47,.21,.08),feather*.2);`,
 'celadon-atlas':`vec2 q=p.xy*24.0;float crack=abs(sin(q.x+sin(q.y*1.7))*sin(q.y+cos(q.x*.9)));float line=1.0-smoothstep(.008,.035,crack);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.37,.32),line*.23);`,
 'abyssal-requiem':`float depth=.5+.5*sin(p.y*8.0+p.x*1.5);float mote=step(.996,fract(sin(dot(floor(p.xy*130.0),vec2(31.1,79.7)))*43758.5));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.06,.27,.37),depth*.32)+vec3(.3,.65,.78)*mote*.45;`,
 'moonbite':`float folded=sin(p.x*18.0+sin(p.y*11.0)*1.8);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.38,.35,.51),(.5+.5*folded)*.12);`,
 'vermilion-plume':`float lacquer=.5+.5*sin(p.x*7.0+p.y*13.0);float vein=1.0-smoothstep(.025,.08,abs(sin(p.x*32.0-p.y*19.0)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.045,.025),lacquer*.2);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.43,.12),vein*.2);`,
 'foundry-bell':`float grain=fract(sin(dot(floor(p.xy*180.0),vec2(51.1,17.7)))*43758.5);float casting=step(.95,fract(p.y*13.0));diffuseColor.rgb*=.83+grain*.22;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.11,.04),casting*.25);`,
};
export function signatureMaterial(source:THREE.MeshStandardMaterial,id:SignatureId,clock:{value:number}){
 const s=signatureOf(id)!,m=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(m,source);m.defines={...m.defines,PHYSICAL:''};
 const body=/^PH_ivory(?:[._]?\d+)?$/.test(source.name),glow=/^PH_glow(?:[._]?\d+)?$/.test(source.name),grip=/rubber/i.test(source.name),glass=/glass/i.test(source.name);
 m.clearcoat=s.weapon==='hammer'?.22:1;m.clearcoatRoughness=.22;m.iridescence=s.iris;m.iridescenceThicknessRange=[160,420];
 if(body){m.color.setHex(s.body);m.metalness=s.metal;m.roughness=s.rough;}
 else if(glow){m.color.setHex(s.accent);m.emissive.setHex(s.accent);m.emissiveIntensity=.36;m.roughness=.24;}
 else if(grip){m.color.setHex(s.weapon==='corona'?0x392920:0x17202b);m.metalness=.02;m.roughness=.88;m.clearcoat=.04;m.iridescence=0;}
 else if(glass){m.color.setHex(s.accent);m.metalness=.25;m.roughness=.12;}
 else if(/dark/i.test(source.name)&&['blade','polearm','hammer'].includes(s.weapon)){m.color.setHex(s.weapon==='blade'?0x201b32:s.weapon==='polearm'?0x29191d:0x252a30);m.metalness=.55;m.roughness=.33;}
 else if(!/dark|black/i.test(source.name)){m.color.setHex(s.trim);m.metalness=.83;m.roughness=s.weapon==='hammer'?.42:.27;}
 m.userData.finish=id;m.customProgramCacheKey=()=>`signature-${id}-${body?'paint':glow?'core':'trim'}-1`;
 if(body||glow)m.onBeforeCompile=shader=>{
  shader.uniforms.phSignatureTime=clock;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 phSignaturePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nphSignaturePosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 phSignaturePosition;\nuniform float phSignatureTime;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n{vec3 p=phSignaturePosition;'+(body?patterns[id]:'diffuseColor.rgb*=.95+.05*sin(phSignatureTime*.8+p.x*3.0);')+'}');
 };
 return m;
}

/** Tiny, conformal relief: triangles with a missed sample or depth discontinuity
 * are discarded, so no emblem bridges a void or hovers off a curved surface. */
class SurfaceArt{
 private positions:number[][]=[[],[],[]];private inverse:THREE.Matrix4;private box=new THREE.Box3();
 private grid:ProjectedFace[][]=Array.from({length:64*32},()=>[]);private depths=new Map<string,readonly[number,number]|null>();
 constructor(private part:THREE.Object3D){
  part.updateWorldMatrix(true,true);this.inverse=part.matrixWorld.clone().invert();const targets:THREE.Mesh[]=[];
  part.traverse(o=>{if(o instanceof THREE.Mesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>/^PH_(?:ivory|dark|black|steel|copper)(?:[._]?\d+)?$/.test(m.name))){targets.push(o);this.box.expandByObject(o);}});
  // A small 2D acceleration grid over the original triangles replaces thousands
  // of full-mesh raycasts. Projection still uses exact barycentric surface depth.
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const mesh of targets){const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;for(let i=0;i<(index?.count??p.count);i+=3){
   a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
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
 private tri(a:Point,b:Point,c:Point,bin:number){for(const side of [-1,1]){const points=[this.hit(a,side,bin),this.hit(b,side,bin),this.hit(c,side,bin)];if(points.some(p=>!p))continue;const [p,q,r]=points as THREE.Vector3[];if(Math.max(p.z,q.z,r.z)-Math.min(p.z,q.z,r.z)>.045)continue;for(const v of [p,q,r])this.positions[bin].push(...v.applyMatrix4(this.inverse).toArray());}}
 polygon(points:Point[],bin=0){if(points.length<3)return;const center:Point=[points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length];for(let i=0;i<points.length;i++)this.tri(center,points[i],points[(i+1)%points.length],bin);}
 path(points:Point[],width:number,bin=0){for(let i=1;i<points.length;i++){const [a,b]=[points[i-1],points[i]],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<.00001)continue;const x=-dy/length*width/2,y=dx/length*width/2;this.polygon([[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]],bin);}}
 curve(points:Point[],width:number,bin=0){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p,0)));this.path(curve.getPoints(Math.max(20,points.length*8)).map(v=>[v.x,v.y]as const),width,bin);}
 arc(x:number,y:number,r:number,start=0,end=Math.PI*2,width=.012,bin=0){this.path(Array.from({length:49},(_,i)=>[x+Math.cos(start+(end-start)*i/48)*r,y+Math.sin(start+(end-start)*i/48)*r]as const),width,bin);}
 build(materials:THREE.Material[],name:string){const group=new THREE.Group();group.name=name;for(let i=0;i<3;i++){if(!this.positions[i].length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions[i],3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,materials[i]);mesh.name=`${name}_${['metal','light','enamel'][i]}`;group.add(mesh);}if(!group.children.length)return null;this.part.add(group);return group;}
}

export function addSignatureArt(parts:Record<string,THREE.Object3D>,id:SignatureId){
 const s=signatureOf(id)!;
 const metal=new THREE.MeshPhysicalMaterial({color:s.trim,metalness:.86,roughness:.25,clearcoat:.75,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const light=new THREE.MeshPhysicalMaterial({color:s.accent,emissive:s.accent,emissiveIntensity:.20,metalness:.3,roughness:.2,clearcoat:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const enamel=new THREE.MeshPhysicalMaterial({color:s.weapon==='halo'?0x3c9388:s.weapon==='firefly'?0xe7ebc8:0x151f2b,metalness:.25,roughness:.34,clearcoat:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const materials=[metal,light,enamel],groups:THREE.Group[]=[];
 const draw=(role:string,paint:(a:SurfaceArt)=>void)=>{if(!parts[role])return;const a=new SurfaceArt(parts[role]);paint(a);const group=a.build(materials,`Signature_${id}_${role}`);if(group)groups.push(group);};
 draw('body',a=>{
  switch(id){
   case'tidal-engine':
    for(let i=0;i<4;i++)a.curve([[-.52,.12+i*.055],[-.1,.08+i*.04],[.45,.32+i*.024],[1.3,.17+i*.045]],i===0?.024:.012,i===0?1:0);
    a.arc(-.23,.29,.105,0,Math.PI*2,.014);a.arc(-.23,.29,.072,-.8,3.7,.024,1);
    for(let i=0;i<7;i++){const t=i/7*Math.PI*2;a.path([[-.23+Math.cos(t)*.08,.29+Math.sin(t)*.08],[-.23+Math.cos(t+.38)*.048,.29+Math.sin(t+.38)*.048]],.009);}
    break;
   case'night-courier':
    for(let i=0;i<4;i++){const x=-.43+i*.37;a.polygon([[x,.12],[x+.13,.12],[x+.37,.43],[x+.24,.43]],i%2?1:2);}
    a.path([[-.49,.48],[.13,.48],[.27,.38],[.92,.38]],.016,1);
    a.path([[-.49,.18],[-.49,.34],[-.37,.34],[-.37,.18],[-.49,.18]],.018);a.path([[-.29,.34],[-.16,.34],[-.27,.18]],.019);
    break;
   case'dune-falcon':
    a.polygon([[-.59,.22],[-.45,.38],[-.17,.38],[.28,.19],[-.1,.22],[-.34,.17]],2);
    a.polygon([[-.55,.23],[-.37,.35],[-.16,.35],[-.02,.28],[-.2,.28],[-.32,.2]],0);
    a.path([[-.2,.32],[-.13,.32]],.014,1);
    for(let i=0;i<6;i++)a.curve([[-.44+i*.10,.25],[-.36+i*.10,.18],[-.2+i*.10,.18]],.013,0);
    a.path([[-.59,.39],[.3,.39]],.008);break;
   case'celadon-atlas':
    a.polygon([[-.95,.23],[-.65,.38],[-.35,.26],[-.12,.40],[.15,.23],[.41,.34],[.77,.22]],2);
    a.path([[-.95,.23],[-.65,.38],[-.35,.26],[-.12,.40],[.15,.23],[.41,.34],[.77,.22]],.012,0);
    for(let i=0;i<3;i++)a.curve([[-.97,.22+i*.028],[-.45,.20+i*.028],[.04,.28+i*.028],[.72,.22+i*.028]],.006,i===0?0:1);
    a.arc(.58,.36,.052,0,Math.PI*2,.009,0);break;
   case'abyssal-requiem':
    a.curve([[-.53,.21],[-.12,.30],[.65,.24],[1.54,.24]],.015,0);
    for(let i=0;i<12;i++){const x=-.38+i*.147;a.curve([[x,.27],[x+.025,.17],[x+.085,.11]],.010,i%4===0?1:0);}
    a.polygon([[1.39,.24],[1.59,.37],[1.53,.24],[1.64,.11]],0);a.arc(-.38,.25,.028,0,Math.PI*2,.010,1);break;
   case'moonbite':
    a.arc(.17,.01,.113,-1.3,1.3,.028,0);a.arc(.20,.01,.09,-1.1,1.1,.009,1);
    a.curve([[.15,-.08],[.47,-.09],[.94,-.03],[1.32,.0]],.012,1);
    a.curve([[.14,.10],[.55,.12],[1.03,.055],[1.32,.0]],.018,0);
    for(let i=0;i<5;i++)a.path([[.42+i*.12,-.035],[.46+i*.12,.015]],.005,0);break;
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
  }
 });
 draw('stock',a=>{
  if(id==='night-courier')for(let i=0;i<3;i++)a.path([[-1.18+i*.13,.04],[-.98+i*.13,.27]],.035,i%2?1:2);
  if(id==='dune-falcon')for(let i=0;i<3;i++)a.curve([[-1.28,.10+i*.07],[-1.03,.10+i*.07],[-.8,.25]],.012);
  if(id==='tidal-engine')a.curve([[-1.22,.13],[-1.06,.29],[-.8,.24]],.018,1);
  if(id==='abyssal-requiem')a.curve([[-1.42,.13],[-1.25,.44],[-.86,.31]],.013,1);
 });
 draw('fore_end',a=>{if(id==='dune-falcon')for(let i=0;i<7;i++)a.curve([[.46+i*.09,.07],[.54+i*.09,.19],[.68+i*.09,.26]],.017);});
 draw('magazine',a=>{if(id==='tidal-engine')for(let i=0;i<3;i++)a.path([[.24+i*.1,-.5],[.21+i*.1,-.11]],.012,1);if(id==='night-courier')a.polygon([[.11,-.46],[.19,-.46],[.31,-.02],[.23,-.02]],1);});
 return {groups,dispose(){for(const group of groups){group.removeFromParent();group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}materials.forEach(m=>m.dispose());}};
}
