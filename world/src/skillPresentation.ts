import * as THREE from 'three';
import type { SkillEvent } from './contractSkills';
import type { Point3 } from './combat';
const COLORS: Record<string, number> = { player: 0x91d6cf, melee: 0xb5e2dd, saber: 0xf2d18c, blackbeard: 0xf3ad78, napoleon: 0x83b7e1, musashi: 0xcca4e0 };
export interface SkillVisualOptions { style?: 'melee'; origin?: Point3; bladeDirection?: Point3 }
interface Effect { root: THREE.Group; bar: THREE.Mesh; ring: THREE.Mesh; material: THREE.MeshBasicMaterial; age: number; life: number; range: number; charge: boolean; cast: boolean; peak: number; style: string; width: number }
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
/** Fixed pool: 18 draws, 2 shared geometries (~6.9KiB), no lights/maps/post effects.
 * show() only resets transforms/material values; activation allocates no GPU resources. */
export class SkillPresentation {
  readonly root = new THREE.Group();
  private readonly barGeometry = ribbonGeometry('lance');
  private readonly ringGeometry = ribbonGeometry('arc');
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
      root.add(bar, ring); root.visible = false; this.root.add(root);
      this.effects.push({ root, bar, ring, material, age: 0, life: 0, range: 0, charge: false, cast: false, peak: 0, style: 'player', width: 1 });
    }
    scene.add(this.root);
  }
  show(event: SkillEvent, reducedFlash = false, visual:SkillVisualOptions = {}) {
    if (this.disposed || event.type === 'guard') return;
    if(![event.origin.x,event.origin.y,event.origin.z,event.direction.x,event.direction.z].every(Number.isFinite))return;
    if(event.type==='strike'&&(!Number.isFinite(event.range)||event.range<=0||event.range>40||!Number.isFinite(event.halfWidth)||event.halfWidth<=0||event.halfWidth>15))return;
    if(event.type==='cast'&&(!Number.isFinite(event.duration)||event.duration<=0))return;
    const effect = this.effects[this.cursor++ % this.effects.length];
    effect.age = 0; effect.cast = event.type === 'cast'; effect.charge = event.identity === 'napoleon' && !effect.cast;
    effect.style = visual.style ?? event.identity ?? 'player';
    effect.life = effect.style==='melee'?.16:event.type==='cast'?Math.max(.08,Math.min(event.duration,.65)):effect.style==='blackbeard'?.22:effect.style==='musashi'?.28:.52;
    effect.range = event.type === 'strike' ? event.range : 1;effect.width=event.type==='strike'?event.halfWidth:1;
    const visualOrigin=visual.origin&&[visual.origin.x,visual.origin.y,visual.origin.z].every(Number.isFinite)?visual.origin:undefined;
    const p=visualOrigin??event.origin,feet=Number.isFinite(event.casterFeetY)?event.casterFeetY!:event.origin.y;
    const sourceY=visualOrigin||event.losOffset===0?p.y:p.y+.85;
    effect.root.position.set(p.x,effect.cast||effect.charge?feet+.07:effect.style==='player'?feet+.08:sourceY,p.z);
    effect.root.rotation.set(0,Math.atan2(event.direction.x,event.direction.z),0);
    effect.material.color.setHex(COLORS[effect.style]);
    effect.peak=effect.material.opacity=reducedFlash?.09:effect.cast?.16:effect.style==='melee'?.25:.30;
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
    effect.root.visible=true;
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
      if(effect.cast)continue;
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
    this.barGeometry.dispose(); this.ringGeometry.dispose();
    for (const effect of this.effects) effect.material.dispose();
  }
}
