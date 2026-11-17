import {smokeBlocks} from '../../shared/grenade.ts';
import * as THREE from 'three';
import { HERO_COMBAT as H, CHARACTERS, abilityAllowsGunplay, type AbilityId } from '../../shared/content.ts';
import type { Snapshot } from '../../shared/match.ts';
import type { PlayerState } from '../../shared/sim.ts';
import type { TacticalEntity,HeroEvent } from '../../shared/heroState.ts';
import type { ArenaMap } from '../../shared/map.ts';
import { disposeTree } from '../weapons/weaponArt.ts';
import { FIGHTER_PALETTES } from '../player/fighter.ts';
import { puffTexture } from './grenades.ts';

const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
function mesh(g:THREE.BufferGeometry,color:number,opacity=1) {return new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,side:THREE.DoubleSide}));}
function ring(radius:number,color:number,opacity=.8){const m=mesh(new THREE.RingGeometry(radius-.04,radius,48),color,opacity);m.rotation.x=-Math.PI/2;return m;}
/** Lightweight persistent tactical objects. Low quality retains exactly the same silhouettes. */
export class HeroEffects {
  private objects=new Map<string,THREE.Group>();
  private bursts:{object:THREE.Group;start:number;life:number;kind:string}[]=[];
  private preview=new THREE.Group();
  private previewKind:AbilityId|null=null;
  private puffs:THREE.Texture[]|null=null;
  private snapTick=-1;
  private snapAt=0;
  constructor(private parent:THREE.Object3D){this.preview.name='Ability footprint preview';parent.add(this.preview);this.preview.visible=false;}
  sync(snap:Snapshot,myId:string) {
    const self=snap.players.find(p=>p.id===myId),seen=new Set<string>();
    const get=(id:string,create:()=>THREE.Group)=>{seen.add(id);let g=this.objects.get(id);if(!g){g=create();this.objects.set(id,g);this.parent.add(g);}return g;};
    if(snap.tick!==this.snapTick){this.snapTick=snap.tick;this.snapAt=now();}
    const ahead=Math.min(4,Math.max(0,(now()-this.snapAt)*.06));
    for(const e of snap.entities??[]) {
      if(e.kind==='decoy')continue;
      const color=e.team===self?.team?0x79dce0:0xffaa69;
      const g=get(`e${e.id}`,()=>this.entity(e,color));
      if(e.kind==='barrage'||e.kind==='curtain'){this.projectile(g,e,snap,ahead);continue;}
      g.position.set(e.x,e.y+(e.kind==='anchor'?.035:0),e.z);g.rotation.y=e.yaw;
      if(e.kind==='prayer'){const field=g.getObjectByName('field')!;field.scale.setScalar(.98+.02*Math.sin(snap.tick*.1));}
      if(e.kind==='edict'){const age=snap.tick-e.created,armed=age>=H.edict.arm,fill=g.getObjectByName('fill') as THREE.Mesh,seal=g.getObjectByName('seal')!;
        const k=armed?Math.min(1,(age-H.edict.arm)/H.edict.life):age/H.edict.arm;fill.scale.setScalar(armed?1:Math.max(.05,k));(fill.material as THREE.MeshBasicMaterial).opacity=armed?.32*(1-k):.12+.18*k;
        seal.position.y=armed?.05:2.4-2.35*k*k;seal.visible=!armed||k<.7;(g.getObjectByName('line')!as THREE.Mesh).scale.setScalar(armed?1+.08*k:1);}
      if(e.kind==='lens'){const scan=g.getObjectByName('scan')!;const age=snap.tick-e.created;const halo=g.getObjectByName('solar-halo')!;halo.rotation.z=snap.tick*.018;scan.visible=Array.from({length:H.lens.pulses},(_,i)=>H.lens.warning+H.lens.interval*i).some(t=>age>=t-8&&age<=t+6);}
      if(['anchor','lens','prayer'].includes(e.kind)) {
        let bar=g.getObjectByName('durability0');if(!bar){bar=mesh(new THREE.BoxGeometry(.55,.035,.035),color);bar.name='durability0';bar.position.set(0,e.kind==='lens'?1.65:e.kind==='prayer'?2:.7,0);g.add(bar);}bar.scale.x=Math.max(.02,e.hp/(e.kind==='prayer'?H.prayer.hp:e.kind==='lens'?H.lens.hp:40));
      }
    }
    for(const mark of snap.marks??[])if(mark.team===self?.team&&mark.expires>snap.tick) {
      const g=get(`m${mark.id}`,()=>{const o=new THREE.Group();o.add(ring(.45,0xf6da81));const pillar=mesh(new THREE.ConeGeometry(.12,.24,4),0xf6da81);pillar.rotation.z=Math.PI;pillar.position.y=1.8;o.add(pillar);return o;});
      g.position.set(mark.x,mark.y+.025,mark.z);g.scale.setScalar(.9+.1*Math.sin(snap.tick*.4));
    }
    for(const p of snap.players)if(p.alive&&['guard','channel','windup'].includes(p.ability?.phase)) {
      const kind=CHARACTERS[p.char].ability;if(kind!=='guard'&&kind!=='prayer')continue;
      if(self&&p.team!==self.team&&smokeBlocks(snap.smokes??[],[self.x,self.y+1.62,self.z],[p.x,p.y+1.1,p.z]))continue;
      const g=get(`p${p.id}`,()=>{const o=new THREE.Group();if(kind==='guard'){const r=mesh(new THREE.TorusGeometry(.53,.025,6,40,140*Math.PI/180),0xc3deff,.9);r.rotation.z=.35;r.position.set(0,1.05,-.4);o.add(r);}else {o.add(ring(.65,0xc5b5f7));const pole=mesh(new THREE.CylinderGeometry(.014,.014,1.2,6),0xd8daec);pole.position.set(-.4,1,0);const flag=mesh(new THREE.PlaneGeometry(.45,.32),0xc3a8e6,.8);flag.position.set(-.17,1.4,0);o.add(pole,flag);}return o;});g.position.set(p.x,p.y+.025,p.z);g.rotation.y=p.yaw;
    }
    for(const p of snap.players)if(p.alive&&(p.rootUntil??0)>snap.tick) {
      if(self&&p.team!==self.team&&smokeBlocks(snap.smokes??[],[self.x,self.y+1.62,self.z],[p.x,p.y+1.1,p.z]))continue;
      const g=get(`r${p.id}`,()=>this.shackles());g.position.set(p.x,p.y+.03,p.z);g.rotation.y=snap.tick*.02;
      const left=((p.rootUntil??0)-snap.tick)/H.edict.root;g.scale.setScalar(.85+.15*Math.min(1,left*1.5));
    }
    for(const burst of this.bursts){const fraction=(snap.tick-burst.start)/burst.life;burst.object.visible=fraction>=0&&fraction<1;burst.object.scale.setScalar(burst.kind==='guard'?.25+Math.max(0,fraction)*1.35:1+Math.max(0,fraction)*.35);burst.object.traverse(o=>{const mat=(o as THREE.Mesh).material as THREE.MeshBasicMaterial|undefined;if(mat){mat.transparent=true;mat.opacity=Math.max(0,1-fraction)*.65;}});}
    this.bursts=this.bursts.filter(b=>{if(snap.tick-b.start<b.life)return true;b.object.removeFromParent();disposeTree(b.object,false);return false;});
    for(const [id,g] of this.objects)if(!seen.has(id)){g.removeFromParent();disposeTree(g);this.objects.delete(id);}
  }
  placement(_map:ArenaMap,p:PlayerState|null) {
    const kind=p?CHARACTERS[p.char].ability:'guard';
    this.preview.visible=!!p?.alive&&p.ability.phase==='windup'&&!!p.ability.target&&['barrier','lens','edict'].includes(kind);
    if(!this.preview.visible||!p)return;
    if(this.previewKind!==kind){
      for(const child of [...this.preview.children]){child.removeFromParent();disposeTree(child);}
      this.previewKind=kind;
      if(kind==='edict')this.preview.add(ring(H.edict.radius,0x89e1bc));
      else if(kind==='lens')this.preview.add(ring(.28,0x89e1bc));
      else {
        const width=2.4,depth=.12;
        const geometry=new THREE.BufferGeometry().setFromPoints([[-width/2,0,-depth/2],[width/2,0,-depth/2],[width/2,0,depth/2],[-width/2,0,depth/2]].map(p=>new THREE.Vector3(...p)));
        this.preview.add(new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:0x89e1bc,transparent:true,opacity:.8})));
      }
      const arrow=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.18,0,-.25),new THREE.Vector3(0,0,-.6),new THREE.Vector3(.18,0,-.25)]);
      this.preview.add(new THREE.Line(arrow,new THREE.LineBasicMaterial({color:0x89e1bc,transparent:true,opacity:.8})));
    }
    const point=p.ability.target!,error='';this.preview.position.set(point[0],point[1]+.04,point[2]);this.preview.rotation.y=p.ability.yaw;
    this.preview.traverse(o=>{const material=(o as THREE.Mesh).material as THREE.MeshBasicMaterial|undefined;material?.color?.setHex(error?0xef6b6b:0x89e1bc);});
  }
  private entity(e:TacticalEntity,color:number) {
    const g=new THREE.Group();g.name=`${e.kind} ${e.id}`;
    if(e.kind==='barrage') {
      // Iron round shot with a hot core and a smoke streak behind it.
      const ball=mesh(new THREE.SphereGeometry(H.barrage.ball*.8,14,10),0x2b2725);ball.name='head';g.add(ball);
      const glow=mesh(new THREE.SphereGeometry(H.barrage.ball*1.1,12,8),0xffa45c,.25);glow.name='glow';ball.add(glow);
      const trail=mesh(new THREE.CylinderGeometry(.03,.12,1,10,1,true),0xd8cdbd,.25);trail.name='trail';g.add(trail);
    } else if(e.kind==='curtain') {
      // Grapnel: shank, ring and three barbs, on a tarred line back to the caster's hand.
      const head=new THREE.Group();head.name='head';g.add(head);
      const shank=mesh(new THREE.CylinderGeometry(.025,.025,.34,8),0x8a8f96);shank.rotation.x=Math.PI/2;head.add(shank);
      const eye=mesh(new THREE.TorusGeometry(.05,.012,6,12),0x8a8f96);eye.position.z=.19;head.add(eye);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3,barb=mesh(new THREE.ConeGeometry(.025,.16,6),0xb5bbc2);barb.position.set(Math.sin(a)*.08,Math.cos(a)*.08,-.15);barb.rotation.set(-Math.PI/2+Math.cos(a)*.7,0,-Math.sin(a)*.7);head.add(barb);}
      const rope=mesh(new THREE.CylinderGeometry(.012,.012,1,5,1,true),0x5b4330);rope.name='trail';g.add(rope);
    }else if(e.kind==='anchor'){
      const a=mesh(new THREE.ConeGeometry(.28,.15,3),color);a.position.y=.09;g.add(a);g.add(ring(.4,color));
    }else if(e.kind==='lens'){
      const base=mesh(new THREE.CylinderGeometry(.18,.28,.25,8),0x9c7a3d);base.position.y=.125;
      const pole=mesh(new THREE.CylinderGeometry(.03,.03,1.2,8),color);pole.position.y=.7;
      const lens=mesh(new THREE.TorusGeometry(.24,.04,8,24),0xf3ca62);lens.position.y=1.3;
      const scan=mesh(new THREE.CircleGeometry(H.lens.range,48,Math.PI/2-H.lens.halfAngle,H.lens.halfAngle*2),0xf5d477,.08);scan.rotation.x=-Math.PI/2;scan.position.y=.03;scan.name='scan';g.add(base,pole,lens,scan);
      const halo=new THREE.Group();halo.name='solar-halo';halo.position.y=1.3;g.add(halo);
      for(let i=0;i<12;i++){const a=i*Math.PI/6,ray=mesh(new THREE.ConeGeometry(.045,.2,4),0xf5d477);ray.position.set(Math.sin(a)*.39,Math.cos(a)*.39,0);ray.rotation.z=-a;halo.add(ray);}
      const core=mesh(new THREE.IcosahedronGeometry(.12,1),0xffe7aa);halo.add(core);
    }else if(e.kind==='prayer') {
      const field=ring(H.prayer.radius,color,.4);field.position.y=.03;field.name='field';g.add(field);
      const pole=mesh(new THREE.CylinderGeometry(.025,.035,1.9,10),0xf2d897);pole.position.y=.95;const finial=mesh(new THREE.OctahedronGeometry(.12),0xffedb6);finial.position.y=1.95;
      const flag=mesh(new THREE.PlaneGeometry(.7,1),0xded9ff,.9);flag.position.set(.36,1.35,0);
      const cross=mesh(new THREE.BoxGeometry(.07,.55,.04),0xe2bd67);cross.position.set(.36,1.38,.03);const arm=mesh(new THREE.BoxGeometry(.35,.07,.04),0xe2bd67);arm.position.set(.36,1.52,.03);g.add(pole,finial,flag,cross,arm);g.add(ring(.42,0xe6dca7));
    }else if(e.kind==='edict') {
      // A falling jade tablet and the circle it will seal: the warning fills inward before the edict lands.
      const line=ring(H.edict.radius,0xf1d27a,.9);line.position.y=.04;line.name='line';g.add(line);
      const inner=ring(H.edict.radius-.18,color,.5);inner.position.y=.045;g.add(inner);
      const fill=mesh(new THREE.CircleGeometry(H.edict.radius,48),color,.2);fill.rotation.x=-Math.PI/2;fill.position.y=.03;fill.name='fill';g.add(fill);
      for(let i=0;i<8;i++){const a=i*Math.PI/4,glyph=mesh(new THREE.BoxGeometry(.1,.03,.42),0xf1d27a);glyph.position.set(Math.sin(a)*(H.edict.radius-.45),.05,Math.cos(a)*(H.edict.radius-.45));glyph.rotation.y=a;g.add(glyph);}
      const seal=new THREE.Group();seal.name='seal';g.add(seal);
      const tablet=mesh(new THREE.BoxGeometry(.5,.12,.5),0x86c8b2);seal.add(tablet);const knob=mesh(new THREE.BoxGeometry(.18,.16,.18),0xd9e9b2);knob.position.y=.14;seal.add(knob);
    }
    return g;
  }
  event(event:HeroEvent,tick:number,yaw=0){
    if(event.action!=='pulse'&&event.action!=='heal'&&event.action!=='break'&&!(event.action==='trigger'&&event.kind==='edict'))return;
    if(event.action==='break'&&event.kind==='barrage')return;
    const group=new THREE.Group();group.position.set(...event.at);group.rotation.y=yaw;let life=24;
    if(event.kind==='guard'){const points=Array.from({length:33},(_,i)=>{const angle=(i/32-.5)*H.guard.halfAngle*2;return new THREE.Vector3(Math.sin(angle)*H.guard.range*.62,1.1,-Math.cos(angle)*H.guard.range*.62);});const arc=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.065,5,false),0xc4e8ff,.8);group.add(arc);for(const offset of [-.17,.17]){const ribbon=arc.clone();ribbon.material=arc.material.clone();ribbon.position.y=offset;ribbon.scale.setScalar(.92);group.add(ribbon);}life=20;}
    else if(event.kind==='decoy'){
      // Two crossing blade arcs where each enemy was cut.
      for(const tilt of [-.65,.65]){const arc=mesh(new THREE.TorusGeometry(.95,.055,4,28,Math.PI*.9),0xffe2ec,1);arc.rotation.set(0,yaw?0:Math.PI/2,tilt);arc.rotation.order='YXZ';group.add(arc);}
      group.add(mesh(new THREE.OctahedronGeometry(.22),0xffffff,.95));life=18;
    }
    else if(event.kind==='barrage'){group.add(ring(H.barrage.radius,0xffc784));this.puffs??=[puffTexture(11),puffTexture(29),puffTexture(47,1.6)];
      const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:this.puffs[2],color:0xffb15e,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));flash.position.y=.6;flash.scale.setScalar(2.6);group.add(flash);
      for(const [x,y,z,r,k] of [[0,.7,0,2.4,0],[.7,.45,.35,1.7,1],[-.65,.5,-.25,1.8,0],[.15,1.3,-.1,1.6,1],[-.2,.25,.6,1.4,1]]){const puff=new THREE.Sprite(new THREE.SpriteMaterial({map:this.puffs[k],color:0x8b8178,transparent:true,depthWrite:false}));puff.position.set(x,y,z);puff.scale.setScalar(r);group.add(puff);}}
    else if(event.kind==='curtain'){group.add(mesh(new THREE.TorusGeometry(event.action==='break'?.22:.4,.03,5,18),event.action==='break'?0xb9a48c:0xffc784,.8));life=event.action==='break'?12:16;}
    else if(event.kind==='edict'){if(event.action==='trigger'){const flash=mesh(new THREE.CylinderGeometry(.55,.55,2,12,1,true),0xf1d27a,.45);flash.position.y=1;group.add(flash);life=18;}else{group.add(ring(H.edict.radius,0xf1d27a));const column=mesh(new THREE.CylinderGeometry(H.edict.radius*.9,H.edict.radius,.5,32,1,true),0xd9e9b2,.4);column.position.y=.25;group.add(column);life=20;}}
    else {group.add(ring(event.kind==='prayer'?.5:.8,event.kind==='lens'?0xffd773:0xc7e4ff));const rays=mesh(new THREE.OctahedronGeometry(.4),event.kind==='lens'?0xffdf89:0xd6c8ff,.65);rays.position.y=1.3;group.add(rays);}
    this.parent.add(group);this.bursts.push({object:group,start:tick,life,kind:event.kind});
    if(this.bursts.length>48){const oldest=this.bursts.shift()!;oldest.object.removeFromParent();disposeTree(oldest.object,false);}
  }
  /** Cannonball or hook in flight (extrapolated between snapshots); a caught hook rides its victim and keeps its line taut. */
  private projectile(g:THREE.Group,e:TacticalEntity,snap:Snapshot,ahead:number){
    const d=new THREE.Vector3(e.dx??0,e.dy??0,e.dz??-1),speed=(e.kind==='barrage'?H.barrage.speed:H.curtain.speed)/60,range=e.kind==='barrage'?H.barrage.range:H.curtain.range;
    const lead=e.victim===undefined?Math.min(ahead*speed,Math.max(0,range-e.travelled)):0;
    const head=new THREE.Vector3(e.x,e.y,e.z).addScaledVector(d,lead),owner=snap.players.find(p=>p.id===e.owner);
    g.position.set(0,0,0);g.rotation.set(0,0,0);
    const ball=g.getObjectByName('head')!,trail=g.getObjectByName('trail')!;ball.position.copy(head);
    const tail=e.kind==='curtain'&&owner?new THREE.Vector3(owner.x,owner.y+1.25,owner.z):new THREE.Vector3(e.ox??e.x,e.oy??e.y,e.oz??e.z);
    if(e.kind==='barrage'&&tail.distanceTo(head)>2.4)tail.copy(head).addScaledVector(d,-2.4);
    if(e.kind==='curtain')ball.lookAt(tail);
    const span=head.distanceTo(tail);trail.visible=span>.05;trail.position.copy(head).add(tail).multiplyScalar(.5);trail.scale.set(1,Math.max(.01,span),1);
    if(span>.05)trail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),head.clone().sub(tail).normalize());
  }
  /** Jade shackles round a rooted player's feet. */
  private shackles(){
    const o=new THREE.Group();o.name='rooted';o.add(ring(.62,0xf1d27a,.9));o.add(ring(.48,0x86c8b2,.6));
    for(let i=0;i<4;i++){const a=i*Math.PI/2,post=mesh(new THREE.BoxGeometry(.09,.5,.09),0x86c8b2);post.position.set(Math.sin(a)*.62,.25,Math.cos(a)*.62);post.rotation.set(Math.cos(a)*.35,0,-Math.sin(a)*.35);o.add(post);
      const link=mesh(new THREE.TorusGeometry(.06,.015,4,10),0xf1d27a);link.position.set(Math.sin(a)*.5,.45,Math.cos(a)*.5);o.add(link);}
    return o;
  }
  clear(){for(const b of this.bursts){b.object.removeFromParent();disposeTree(b.object,false);}this.bursts=[];this.preview.visible=false;for(const g of this.objects.values()){g.removeFromParent();disposeTree(g);}this.objects.clear();}
  dispose(){this.clear();this.preview.removeFromParent();disposeTree(this.preview);for(const t of this.puffs??[])t.dispose();this.puffs=null;}
}

/** First-person identity remains independent of the equipped public weapon. */
export class HeroHands {
  readonly root=new THREE.Group();
  private char=-1;
  private left=new THREE.Group();
  private right=new THREE.Group();
  private token=new THREE.Group();
  constructor(parent:THREE.Object3D){parent.add(this.root);}
  update(p:PlayerState,aim:number) {
    if(p.char!==this.char){this.build(p.char);this.char=p.char;}
    const active=!abilityAllowsGunplay(p.char)&&p.ability.phase!=='idle'&&p.ability.phase!=='recovery';
    this.left.position.set(active?-.18:-.23,active?-.19:-.34,active?-.42:-.57);
    const kind=CHARACTERS[p.char].ability;
    this.left.rotation.set(active?(kind==='guard'?-.25:kind==='prayer'?-.55:-.8):-.3,active&&kind==='edict'?.25:0,active?(kind==='curtain'?.35:-.3):.2);
    this.right.position.set(.16,-.29,-.38);this.right.rotation.set(active&&kind==='prayer'?-.9:-.4,0,active&&kind==='prayer'?.35:-.1);
    this.token.visible=active;this.root.visible=p.alive&&aim<.7;
  }
  private build(char:number){
    for(const o of [...this.root.children]){o.removeFromParent();disposeTree(o);}
    const palette=FIGHTER_PALETTES[char],accent=CHARACTERS[char].color;
    this.left=new THREE.Group();this.right=new THREE.Group();this.token=new THREE.Group();
    for(const [side,hand] of [this.left,this.right].entries()) {
      const sleeve=mesh(new THREE.CylinderGeometry(.042,.055,.22,10),new THREE.Color(palette.coat).getHex());sleeve.rotation.x=Math.PI/2;sleeve.position.z=.12;
      const gloveColor=new THREE.Color(palette.inner).getHex(),glove=mesh(new THREE.BoxGeometry(.075,.055,.095),gloveColor);
      const cuff=mesh(new THREE.TorusGeometry(.046,.007,5,12),[2,6].includes(char)?0xc8dcec:accent);cuff.position.z=.045;
      hand.add(sleeve,glove,cuff);
      for(let finger=0;finger<4;finger++){const tip=mesh(new THREE.CapsuleGeometry(.008,.043,2,5),gloveColor);tip.rotation.x=Math.PI/2-.28;tip.position.set((finger-1.5)*.017,-.006,-.056);hand.add(tip);}
      const thumb=mesh(new THREE.CapsuleGeometry(.012,.03,2,5),gloveColor);thumb.rotation.z=side?-.65:.65;thumb.position.set(side?-.039:.039,-.012,-.018);hand.add(thumb);this.root.add(hand);
    }
    const kind=CHARACTERS[char].ability;
    const add=(geometry:THREE.BufferGeometry,color:number,x=0,y=.14,z=-.08)=>{const object=mesh(geometry,color);object.position.set(x,y,z);this.token.add(object);return object;};
    if(kind==='guard'||kind==='decoy'){
      for(const side of kind==='decoy'?[-1,1]:[0]){const blade=add(new THREE.BoxGeometry(.028,.36,.012),0xc8dcec,side*.055,.2);blade.rotation.z=side*.2;add(new THREE.BoxGeometry(.13,.025,.035),accent,side*.04,.035);}
    }else if(kind==='barrier'){
      add(new THREE.BoxGeometry(.15,.19,.025),0x3f697f);for(let i=-1;i<=1;i++)add(new THREE.BoxGeometry(.018,.14,.008),accent,i*.043,.14,-.097);
    }else if(kind==='anchor'){
      add(new THREE.TorusGeometry(.085,.013,6,3),accent);add(new THREE.OctahedronGeometry(.028),0xf6dd92);
    }else if(kind==='curtain'){
      add(new THREE.CylinderGeometry(.04,.055,.14,10),0x775148);add(new THREE.CylinderGeometry(.024,.024,.045,8),0xceae72,0,.235);add(new THREE.TorusGeometry(.045,.005,4,10),accent,0,.14,-.125);
    }else if(kind==='barrage'){
      const barrel=add(new THREE.CylinderGeometry(.035,.05,.25,10),0xd9b365);barrel.rotation.x=.6;add(new THREE.BoxGeometry(.13,.025,.09),0x3e536b,0,.035);add(new THREE.TorusGeometry(.04,.008,6,12),0xf0ce80,0,.24,-.15);
    }else if(kind==='prayer'){
      add(new THREE.CylinderGeometry(.008,.008,.38,6),0xd8dce5,0,.15);add(new THREE.PlaneGeometry(.14,.18),0xd9c9ef,.07,.23);add(new THREE.BoxGeometry(.02,.09,.008),0xf4e9bd,.07,.23,-.087);add(new THREE.BoxGeometry(.07,.02,.008),0xf4e9bd,.07,.25,-.087);
    }else if(kind==='lens'){
      add(new THREE.TorusGeometry(.075,.012,6,24),0xebc568);add(new THREE.SphereGeometry(.035,10,8),0x6ba6c5);for(let i=0;i<8;i++){const angle=i*Math.PI/4,r=.106;const ray=add(new THREE.BoxGeometry(.012,.035,.012),0xebc568,Math.sin(angle)*r,.14+Math.cos(angle)*r);ray.rotation.z=-angle;}
    }else{
      add(new THREE.BoxGeometry(.1,.2,.025),0x83b7a3);for(let i=-1;i<=1;i++)add(new THREE.BoxGeometry(.058,.008,.004),0xeff1d4,0,.14+i*.045,-.095);
    }
    this.left.add(this.token);
  }
  dispose(){for(const o of this.root.children)disposeTree(o);this.root.removeFromParent();}
}
