import * as THREE from 'three';
import { skillContains, type SkillStrike, type SkillEvent } from './contractSkills';
import type { Point3 } from './combat';
const COLORS: Record<string, number> = { player: 0x91d6cf, melee: 0xb5e2dd, saber: 0xdbb36b, blackbeard: 0xf3ad78, napoleon: 0x83b7e1, musashi: 0xcca4e0 };
export interface SkillVisualOptions { style?: 'melee'; origin?: Point3; bladeDirection?: Point3 }
interface Effect { root: THREE.Group; bar: THREE.Mesh; ring: THREE.Mesh; material: THREE.MeshBasicMaterial; age: number; life: number; range: number; charge: boolean; cast: boolean; peak: number; style: string; width: number; motif: THREE.Mesh; contact: boolean }
/** Two shared, open silhouettes. Vertex alpha feathers both edges and the pointed ends.
 * The second strand is in the same geometry/draw, never a second transparent layer mesh. */
function ribbonGeometry(kind:'arc'|'lance') {
  const positions:number[]=[], colors:number[]=[], indices:number[]=[];
  const ribbon=(segments:number,point:(t:number,across:number)=>[number,number,number?],brightness:number)=>{
    const first=positions.length/3;
    for(let i=0;i<=segments;i++)for(let j=0;j<3;j++){
      const t=i/segments,[x,y,z=0]=point(t,j/2);positions.push(x,y,z);
      // Soft ends avoid rectangular caps; transparent edge vertices do not wash out telegraphs.
      const alpha=j===1?Math.pow(Math.sin(t*Math.PI),.55)*brightness:0;
      colors.push(j===1?1:.72,j===1?1:.86,1,alpha);
    }
    for(let i=0;i<segments;i++)for(let j=0;j<2;j++){const a=first+i*3+j,b=a+3;indices.push(a,b,a+1,b,b+1,a+1);}
  };
  if(kind==='arc'){
    for(const [radius,width,alpha,start,end]of[[.94,.09,1,-1.22,1.22],[.73,.035,.38,-1.08,.94]]){
      ribbon(16,(t,a)=>{const angle=start+(end-start)*t,r=radius+(a-.5)*width*Math.sin(t*Math.PI);return[Math.sin(angle)*r,Math.cos(angle)*r];},alpha);
    }
  }else{
    // A needle core with two short swept feather trails: not a filled charge rectangle.
    ribbon(8,(t,a)=>[(a-.5)*.19*Math.pow(Math.sin(t*Math.PI),.65),t],1);
    // A crossed core keeps a distant musket tracer legible when its main sheet is edge-on.
    ribbon(8,(t,a)=>[0,t,(a-.5)*.13*Math.pow(Math.sin(t*Math.PI),.65)],.60);
    for(const side of[-1,1])ribbon(6,(t,a)=>[side*(.34-.20*t)+(a-.5)*.045*Math.sin(t*Math.PI),.12+t*.62],.43);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
/** Four tapered contact splinters in two crossing planes. A compact local burst,
 * not a screen flash or fake traveling projectile. 656 bytes, shared by the pool. */
function contactGeometry() {
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let ray=0;ray<4;ray++){
    const angle=ray*Math.PI/2+.17,dx=Math.cos(angle),dy=Math.sin(angle),cross=ray%2===1;
    const base=positions.length/3,length=.22+(ray%3)*.055;
    for(const [r,width,alpha] of [[.045,0,0],[length*.55,-.022,0],[length+.045,0,0],[length*.55,.022,0],[length*.55,0,1]]){
      const x=dx*r-dy*width,y=dy*r+dx*width;
      positions.push(cross?x*.6:x,y,cross?x*.8:0);colors.push(1,.95,.82,alpha);
    }
    for(let edge=0;edge<4;edge++)indices.push(base+4,base+edge,base+(edge+1)%4);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(indices);g.computeBoundingSphere();return g;
}
/** Normalized X/Z corridors: all alpha-bearing vertices stay inside the damage footprint.
 * Only thin strokes, never filled rectangles, additive blending, lights or flashing planes. */
function corridorGeometry(identity: string, ultimate: boolean) {
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const stroke=(point:(t:number)=>[number,number,number],width=.055,vertical=false)=>{
    const base=positions.length/3,steps=12;
    for(let i=0;i<=steps;i++)for(let j=0;j<3;j++){
      const t=i/steps,[x,y,z]=point(t),edge=(j-1)*width*Math.sin(Math.PI*t);
      positions.push(Math.max(-1,Math.min(1,x+(vertical?0:edge))),y+(vertical?edge:0),Math.max(.001,Math.min(.999,z)));
      colors.push(1,.94,1,j===1?Math.pow(Math.sin(Math.PI*t),.4):0);
    }
    for(let i=0;i<steps;i++)for(let j=0;j<2;j++){const a=base+i*3+j,b=a+3;indices.push(a,b,a+1,b,b+1,a+1);}
  };
  if(identity==='saber') {
    // Sword-wave crests run along the complete adjudicated corridor at release, not after damage.
    for(const side of[-1,1])stroke(t=>[side*Math.sin(Math.PI*t)*.82,Math.sin(Math.PI*t)*(ultimate?1.05:.55),t]);
    if(ultimate)stroke(t=>[0,Math.sin(Math.PI*t)*1.5,t],.065);
  } else if(identity==='blackbeard') {
    stroke(t=>[0,0,t],ultimate?.07:.05);
    stroke(t=>[0,0,t],ultimate?.11:.085,true);
    if(ultimate)for(const side of[-1,1])stroke(t=>[side*.70,Math.sin(Math.PI*t)*.16,t],.025);
    else for(const side of[-1,1])stroke(t=>[side*.20*(1-t),.06*Math.sin(Math.PI*t),t*.30],.025);
  } else if(identity==='napoleon') {
    for(const side of[-1,1])stroke(t=>[side*(.9-.5*t),0,t]);
    for(const offset of ultimate?[.08,.34,.60]:[.20])for(const side of[-1,1])stroke(t=>[side*.50*(1-t),.03,offset+t*.28]);
  } else {
    // Alternating cutting planes, contained in the same broad close-range corridor.
    stroke(t=>[-.92+1.84*t,Math.sin(Math.PI*t)*.55,.08+.84*t],.065);
    stroke(t=>[.92-1.84*t,Math.sin(Math.PI*t)*.55,.08+.84*t],.065);
    if(ultimate)stroke(t=>[Math.sin(t*Math.PI*2)*.8,.15,.06+.88*t],.025);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(indices);g.computeBoundingSphere();return g;
}
/** Fixed 18-slot pool; one visible draw per slot, shared immutable geometries.
 * Activation only changes transforms/materials; no GPU resources or timers allocated. */
export class SkillPresentation {
  readonly root = new THREE.Group();
  private readonly barGeometry = ribbonGeometry('lance');
  private readonly ringGeometry = ribbonGeometry('arc');
  private readonly contactGeometry = contactGeometry();
  private readonly motifs = Object.fromEntries(['saber','blackbeard','napoleon','musashi'].flatMap(id => [false,true].map(ultimate => [`${id}-${ultimate?'ultimate':'skill'}`,corridorGeometry(id,ultimate)])));
  private readonly effects: Effect[] = [];
  private readonly blade = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly inverse = new THREE.Quaternion();
  private cursor = 0;
  private disposed = false;
  constructor(scene: THREE.Object3D) {
    this.root.name = 'contract-skill-effects';
    for (let i = 0; i < 18; i++) {
      const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, vertexColors:true, depthTest:true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      material.name=`SkillRibbonPool_${i}`;
      const root = new THREE.Group(), bar = new THREE.Mesh(this.barGeometry, material), ring = new THREE.Mesh(this.ringGeometry, material);
      bar.name='SkillNeedleAndFeathers';ring.name='SkillTaperedDoubleArc';
      // One reusable mesh per slot. Switching its immutable shared geometry is cheap;
      // keeping eight hidden Mesh siblings would still incur matrix/tree traversal cost.
      const geometries=Object.values(this.motifs),motif=new THREE.Mesh(geometries[i%geometries.length],material);
      motif.visible=false;root.add(motif);
      root.add(bar, ring); root.visible = false; this.root.add(root);
      this.effects.push({ root, bar, ring, material, age: 0, life: 0, range: 0, charge: false, cast: false, peak: 0, style: 'player', width: 1, motif, contact: false });
    }
    scene.add(this.root);
  }
  show(event: SkillEvent, reducedFlash = false, visual:SkillVisualOptions = {}) {
    if (this.disposed || event.type === 'guard') return;
    if(![event.origin.x,event.origin.y,event.origin.z,event.direction.x,event.direction.z].every(Number.isFinite))return;
    if(Math.hypot(event.direction.x,event.direction.z)<.001)return;
    if(event.type==='strike'&&(!Number.isFinite(event.range)||event.range<=0||event.range>40||!Number.isFinite(event.halfWidth)||event.halfWidth<=0||event.halfWidth>15))return;
    if(event.type==='cast'&&(!Number.isFinite(event.duration)||event.duration<=0))return;
    const effect = this.effects[this.cursor++ % this.effects.length];
    effect.contact=false;effect.motif.visible=false;effect.bar.geometry=this.barGeometry;effect.bar.name='SkillNeedleAndFeathers';
    effect.age = 0; effect.cast = event.type === 'cast'; effect.charge = event.identity === 'napoleon' && !effect.cast;
    effect.style = visual.style ?? event.identity ?? 'player';
    effect.life = effect.style==='melee'?.16:event.type==='cast'?Math.max(.08,Math.min(event.duration,1.6)):effect.style==='blackbeard'?.22:effect.style==='musashi'?.28:.52;
    effect.range = event.type === 'strike' ? event.range : 1;effect.width=event.type==='strike'?event.halfWidth:1;
    const visualOrigin=visual.origin&&[visual.origin.x,visual.origin.y,visual.origin.z].every(Number.isFinite)?visual.origin:undefined;
    const p=visualOrigin??event.origin,feet=Number.isFinite(event.casterFeetY)?event.casterFeetY!:event.origin.y;
    const sourceY=visualOrigin||event.losOffset===0?p.y:p.y+.85;
    effect.root.position.set(p.x,effect.cast||effect.charge?feet+.07:effect.style==='player'?feet+.08:sourceY,p.z);
    effect.root.rotation.set(0,Math.atan2(event.direction.x,event.direction.z),0);
    effect.material.color.setHex(COLORS[effect.style]);
    effect.peak=effect.material.opacity=reducedFlash?.09:(effect.style==='saber'||effect.style==='musashi')?(effect.cast?.10:.18):effect.cast?.16:effect.style==='melee'?.25:.30;
    effect.ring.visible=effect.cast||['saber','musashi','player','melee'].includes(effect.style);effect.bar.visible=!effect.ring.visible;
    effect.ring.position.set(0,0,0);effect.ring.rotation.set(Math.PI/2,0,0);effect.ring.scale.setScalar(event.slot==='ultimate'?.95:.65);
    effect.bar.position.set(0,0,0);effect.bar.rotation.set(Math.PI/2,0,0);effect.bar.scale.set(1,1,1);
    if(!effect.cast){
      if(effect.style==='melee'){
        // Presentation-only, sampled from the last visible blade pose. Not a GPU trail or hitbox.
        const d=visual.bladeDirection??event.direction;this.blade.set(d.x,d.y,d.z);
        if(!this.blade.toArray().every(Number.isFinite)||this.blade.lengthSq()<1e-6)this.blade.set(event.direction.x,.25,event.direction.z);
        this.inverse.copy(effect.root.quaternion).invert();this.blade.normalize().applyQuaternion(this.inverse);
        this.tangent.set(1,0,0).addScaledVector(this.blade,-this.blade.x);if(this.tangent.lengthSq()<.001)this.tangent.set(0,1,0).addScaledVector(this.blade,-this.blade.y);
        this.tangent.normalize();this.normal.crossVectors(this.tangent,this.blade).normalize();
        effect.ring.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.tangent,this.blade,this.normal));
        effect.ring.scale.set(.62,.74,1);effect.ring.position.z=visualOrigin?0:.18;
        if(!visualOrigin)effect.root.position.y=feet+.98;
      }else if(effect.style==='saber'){
        effect.ring.rotation.set(0,0,0);effect.ring.scale.set(effect.width*.88,.64,1);effect.ring.position.y=-.2;
      }else if(effect.style==='musashi'){
        effect.ring.rotation.set(0,0,event.type==='strike'&&event.pulse%2?-.65:.65);effect.ring.scale.set(Math.min(1.7,effect.width*.60),.75,1);effect.ring.position.set(0,-.25,.30);
      }else if(effect.style==='blackbeard'){
        effect.bar.scale.set(1,effect.range,1);
      }else if(effect.charge){
        effect.bar.scale.set(effect.width*2,2.1,1);
      }else effect.ring.scale.setScalar(.7);
    }
    if(!effect.cast && event.type==='strike' && effect.style!=='melee' && event.identity){
      const motif=effect.motif;motif.geometry=this.motifs[`${event.identity}-${event.slot}`];motif.name=`SkillCorridor_${event.identity}-${event.slot}`;
      effect.bar.visible=effect.ring.visible=false;motif.visible=true;
      motif.scale.set(effect.width,1,effect.range);
      // Pulse handedness mirrors only the symmetric footprint, never the hit direction.
      if(event.identity==='musashi'&&event.pulse%2)motif.scale.x*=-1;
      motif.rotation.set(0,0,0);motif.position.set(0,0,0);
    }
    effect.root.visible=true;
  }
  /** Only combat-confirmed HP-loss positions belong here; a release is not a hit. */
  hit(event: SkillStrike, point: Point3, reducedFlash = false) {
    if(this.disposed || !skillContains(event, point))return;
    const effect=this.effects[this.cursor++ % this.effects.length];
    effect.motif.visible=false;
    effect.contact=true;effect.cast=false;effect.charge=false;effect.style='contact';effect.age=0;effect.life=.18;
    effect.root.position.set(point.x,point.y+.8,point.z);effect.root.rotation.set(0,Math.atan2(event.direction.x,event.direction.z),0);
    effect.ring.visible=false;effect.bar.visible=true;effect.bar.position.set(0,0,0);effect.bar.geometry=this.contactGeometry;effect.bar.name='ConfirmedContactSplinters';effect.bar.rotation.set(0,0,Math.PI/4);effect.bar.scale.setScalar(.72);
    effect.material.color.setHex(COLORS[event.identity??'player']);effect.peak=effect.material.opacity=reducedFlash?.07:event.identity==='saber'?.14:event.identity==='musashi'?.12:.24;effect.root.visible=true;
  }
  update(dt: number, enabled = true, reducedFlash = false) {
    if (!enabled) { this.clear(); return; }
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    for (const effect of this.effects) {
      if (!effect.root.visible) continue;
      effect.age += Math.min(dt, .25);
      const progress = Math.min(1, effect.age / effect.life);
      if (progress >= 1) { effect.root.visible = false; continue; }
      effect.peak=Math.min(effect.peak,reducedFlash?.09:.30);
      effect.material.opacity = effect.peak*Math.pow(1-progress,1.3);
      if(effect.cast){
        // Quiet inward gathering, no expanding flash; pose timing owns the actual release.
        effect.ring.scale.multiplyScalar(1-Math.min(dt,.25)*.35);continue;
      }
      if(effect.contact){
        // Fast separation followed by a quiet decaying tail. Local motion only.
        effect.bar.scale.setScalar(.72+.34*(1-Math.pow(1-progress,3)));
        effect.bar.position.y=.035*progress;continue;
      }
      if(effect.charge)effect.bar.position.z=effect.range*progress;
      if(effect.style==='saber')effect.ring.position.z=effect.range*progress;
      if(effect.style==='musashi')effect.ring.position.z=.30+Math.min(1.3,effect.range*.2)*progress;
      if(effect.style==='player'){effect.ring.scale.setScalar(.7+effect.width*.6*progress);effect.ring.position.z=effect.range*.25;}
    }
  }
  clear() { for (const effect of this.effects) effect.root.visible = false; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.clear(); this.root.removeFromParent();
    this.barGeometry.dispose(); this.ringGeometry.dispose(); this.contactGeometry.dispose(); for(const geometry of Object.values(this.motifs))geometry.dispose();
    for (const effect of this.effects) effect.material.dispose();
  }
}
