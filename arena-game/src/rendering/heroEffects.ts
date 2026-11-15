import {smokeBlocks} from '../../shared/grenade.ts';
import * as THREE from 'three';
import { HERO_COMBAT as H, CHARACTERS, abilityAllowsGunplay, type AbilityId } from '../../shared/content.ts';
import type { Snapshot } from '../../shared/match.ts';
import type { PlayerState } from '../../shared/sim.ts';
import type { TacticalEntity,HeroEvent } from '../../shared/heroState.ts';
import type { ArenaMap } from '../../shared/map.ts';
import { disposeTree } from '../weapons/weaponArt.ts';
import { FIGHTER_PALETTES } from '../player/fighter.ts';

function mesh(g:THREE.BufferGeometry,color:number,opacity=1) {return new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,side:THREE.DoubleSide}));}
function ring(radius:number,color:number,opacity=.8){const m=mesh(new THREE.RingGeometry(radius-.04,radius,48),color,opacity);m.rotation.x=-Math.PI/2;return m;}
/** Lightweight persistent tactical objects. Low quality retains exactly the same silhouettes. */
export class HeroEffects {
  private objects=new Map<string,THREE.Group>();
  private bursts:{object:THREE.Group;start:number;life:number;kind:string}[]=[];
  private preview=new THREE.Group();
  private previewKind:AbilityId|null=null;
  constructor(private parent:THREE.Object3D){this.preview.name='Ability footprint preview';parent.add(this.preview);this.preview.visible=false;}
  sync(snap:Snapshot,myId:string) {
    const self=snap.players.find(p=>p.id===myId),seen=new Set<string>();
    const get=(id:string,create:()=>THREE.Group)=>{seen.add(id);let g=this.objects.get(id);if(!g){g=create();this.objects.set(id,g);this.parent.add(g);}return g;};
    for(const e of snap.entities??[]) {
      if(e.kind==='decoy')continue;
      const color=e.team===self?.team?0x79dce0:0xffaa69;
      const g=get(`e${e.id}`,()=>this.entity(e,color));g.position.set(e.x,e.y+(['anchor','barrage'].includes(e.kind)?.035:0),e.z);g.rotation.y=e.yaw;
      if(e.kind==='barrage'||e.kind==='curtain'){for(let i=0;i<3;i++){const lane=g.getObjectByName(`strike${i}`)!;lane.visible=e.kind==='barrage'?i>=e.pulse:e.commandedAt!==undefined&&e.pulse===0;const warning=lane.getObjectByName('pulse')!;warning.scale.setScalar(.65+((snap.tick-e.created)%30)/85);}}
      if(e.kind==='prayer'){const field=g.getObjectByName('field')!;field.scale.setScalar(.98+.02*Math.sin(snap.tick*.1));} 
      if(e.kind==='edict'){const line=g.getObjectByName('line') as THREE.Mesh;line.scale.y=snap.tick-e.created<H.edict.arm?.25:1;}
      if(e.kind==='lens'){const scan=g.getObjectByName('scan')!;const age=snap.tick-e.created;const halo=g.getObjectByName('solar-halo')!;halo.rotation.z=snap.tick*.018;scan.visible=Array.from({length:H.lens.pulses},(_,i)=>H.lens.warning+H.lens.interval*i).some(t=>age>=t-8&&age<=t+6);}
      if(['anchor','lens','edict','prayer'].includes(e.kind)) {
        for(let i=0;i<(e.kind==='edict'?2:1);i++){const name=`durability${i}`;let bar=g.getObjectByName(name);if(!bar){bar=mesh(new THREE.BoxGeometry(.55,.035,.035),color);bar.name=name;bar.position.set(e.kind==='edict'?(i?1.6:-1.6):0,e.kind==='lens'?1.65:e.kind==='prayer'?2:.7,0);g.add(bar);}bar.scale.x=Math.max(.02,(i?e.hp2??H.edict.hp:e.hp)/(e.kind==='prayer'?H.prayer.hp:e.kind==='lens'?H.lens.hp:e.kind==='edict'?H.edict.hp:40));}
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
    for(const burst of this.bursts){const fraction=(snap.tick-burst.start)/burst.life;burst.object.visible=fraction>=0&&fraction<1;burst.object.scale.setScalar(burst.kind==='guard'?.25+Math.max(0,fraction)*1.35:1+Math.max(0,fraction)*.35);burst.object.traverse(o=>{const mat=(o as THREE.Mesh).material as THREE.MeshBasicMaterial|undefined;if(mat){mat.transparent=true;mat.opacity=Math.max(0,1-fraction)*.65;}});}
    this.bursts=this.bursts.filter(b=>{if(snap.tick-b.start<b.life)return true;b.object.removeFromParent();disposeTree(b.object);return false;});
    for(const [id,g] of this.objects)if(!seen.has(id)){g.removeFromParent();disposeTree(g);this.objects.delete(id);}
  }
  placement(_map:ArenaMap,p:PlayerState|null) {
    const kind=p?CHARACTERS[p.char].ability:'guard';
    this.preview.visible=!!p?.alive&&p.ability.phase==='windup'&&!!p.ability.target&&['barrier','curtain','barrage','lens','edict'].includes(kind);
    if(!this.preview.visible||!p)return;
    if(this.previewKind!==kind){
      for(const child of [...this.preview.children]){child.removeFromParent();disposeTree(child);}
      this.previewKind=kind;
      if(kind==='barrage'){for(let i=0;i<3;i++){const area=ring(2.8,0x89e1bc,.9-i*.15);area.position.z=(2-i)*3;this.preview.add(area);}}
      else if(kind==='edict')this.preview.add(ring(H.edict.radius,0x89e1bc));
      else if(kind==='lens')this.preview.add(ring(.28,0x89e1bc));
      else {
        const width=kind==='curtain'?4:2.4,depth=kind==='curtain'?1.2:.12;
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
    if(e.kind==='barrage'||e.kind==='curtain') {
      for(let i=0;i<3;i++){const lane=new THREE.Group();lane.name=`strike${i}`;lane.position.set(e.kind==='curtain'?(i-1)*1.7:0,.035,e.kind==='curtain'?-3:(2-i)*3);const radius=e.kind==='curtain'?H.curtain.radius:H.barrage.radius;lane.add(ring(radius,color));const pulse=ring(radius-.06,color,.35);pulse.name='pulse';lane.add(pulse);
        for(let j=0;j<=i;j++){const mark=mesh(new THREE.BoxGeometry(.16,.025,.4),color);mark.position.set((j-i/2)*.25,.02,0);lane.add(mark);}g.add(lane);}
      if(e.kind==='curtain'){for(const x of [-1.7,0,1.7]){const cannon=mesh(new THREE.CylinderGeometry(.13,.19,.65,12),0x9a7655);cannon.rotation.x=Math.PI/2;cannon.position.set(x,.45,0);g.add(cannon);}const mast=mesh(new THREE.CylinderGeometry(.035,.055,2.3,8),0x72523a);mast.position.y=1.15;const sail=mesh(new THREE.PlaneGeometry(3.6,1.6),0x1b1820,.75);sail.position.set(0,1.4,0);g.add(mast,sail);const skull=mesh(new THREE.IcosahedronGeometry(.2,1),0xe3cfaa);skull.position.set(0,1.45,.03);g.add(skull);}
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
      for(const sign of [-1,1]){const post=mesh(new THREE.CylinderGeometry(.11,.18,.65,6),color);post.position.set(sign*1.6,.325,0);g.add(post);
        const seal=mesh(new THREE.BoxGeometry(.22,.42,.1),0x86c8b2);seal.position.set(sign*1.6,.7,0);g.add(seal);
        for(let i=0;i<3;i++){const rune=mesh(new THREE.BoxGeometry(.15,.025,.014),0xf5dda0);rune.position.set(sign*1.6,.58+i*.1,.06);g.add(rune);}}
      const line=ring(H.edict.radius,color,.8);line.position.y=.035;line.name='line';g.add(line);const inner=ring(H.edict.radius-.15,0xd9e9b2,.4);inner.position.y=.04;g.add(inner);for(let i=0;i<12;i++){const a=i*Math.PI/6;const seal=mesh(new THREE.BoxGeometry(.12,.08,.35),0xe5dc9c);seal.position.set(Math.sin(a)*(H.edict.radius-.1),.04,Math.cos(a)*(H.edict.radius-.1));seal.rotation.y=a;g.add(seal);}
      const edge=mesh(new THREE.BoxGeometry(3.2,.035,.035),color);edge.position.y=.1;g.add(edge);
    }
    return g;
  }
  event(event:HeroEvent,tick:number,yaw=0){
    if(event.action!=='pulse'&&event.action!=='heal'&&event.action!=='break')return;
    const group=new THREE.Group();group.position.set(...event.at);group.rotation.y=yaw;
    if(event.kind==='guard'){const points=Array.from({length:33},(_,i)=>{const angle=(i/32-.5)*H.guard.halfAngle*2;return new THREE.Vector3(Math.sin(angle)*H.guard.range*.62,1.1,-Math.cos(angle)*H.guard.range*.62);});const arc=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.065,5,false),0xc4e8ff,.8);group.add(arc);for(const offset of [-.17,.17]){const ribbon=arc.clone();ribbon.material=arc.material.clone();ribbon.position.y=offset;ribbon.scale.setScalar(.92);group.add(ribbon);}}
    else if(event.kind==='barrage'||event.kind==='curtain'){group.add(ring(event.kind==='barrage'?H.barrage.radius:H.curtain.radius,0xffc784));const column=mesh(new THREE.CylinderGeometry(.07,.8,5,12,1,true),0xffb775,.6);column.position.y=2.5;group.add(column);}
    else {group.add(ring(event.kind==='prayer'?.5:.8,event.kind==='lens'?0xffd773:0xc7e4ff));const rays=mesh(new THREE.OctahedronGeometry(.4),event.kind==='lens'?0xffdf89:0xd6c8ff,.65);rays.position.y=1.3;group.add(rays);}
    this.parent.add(group);this.bursts.push({object:group,start:tick,life:event.kind==='guard'?20:24,kind:event.kind});
    if(this.bursts.length>48){const oldest=this.bursts.shift()!;oldest.object.removeFromParent();disposeTree(oldest.object);}
  }
  clear(){for(const b of this.bursts){b.object.removeFromParent();disposeTree(b.object);}this.bursts=[];this.preview.visible=false;for(const g of this.objects.values()){g.removeFromParent();disposeTree(g);}this.objects.clear();}
  dispose(){this.clear();this.preview.removeFromParent();disposeTree(this.preview);}
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
