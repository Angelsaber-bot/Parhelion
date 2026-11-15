import * as THREE from 'three';
import {ArenaCharacter} from '../player/worldHero.ts';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {buildGun} from '../rendering/scene.ts';
import {disposeTree} from '../weapons/weaponArt.ts';
import type {GunPresentation} from '../weapons/gunArt.ts';
import {HeroEffects} from '../rendering/heroEffects.ts';
import {GrenadeView} from '../rendering/grenades.ts';
import {CHARACTERS,abilityFor,abilityAllowsGunplay} from '../../shared/content.ts';
import {bilingual} from '../../../shared-client/i18n.ts';
import {HeroDemo} from './heroDemo.ts';

/** Turntable and <=8s demonstrations run the same authority and presentation as real matches. */
export class HeroPreview {
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(36,2, .1,60);
  private rig:ArenaCharacter|null=null;
  private anim:ArenaCharacter|null=null;
  private gun:GunPresentation|null=null;
  private effects:HeroEffects;
  private smoke:GrenadeView;
  private extras=new THREE.Group();
  private demonstration:HeroDemo|null=null;
  private resize:ResizeObserver;
  private extraAnimators=new Map<string,ArenaCharacter>();
  private extraObjects=new Map<string,THREE.Object3D>();
  private last=0;
  private environment:THREE.WebGLRenderTarget;

  private rotation=0;
  private dragging=false;
  private char=-1;
  private weapon=-1;
  private skin=-1;
  private running=true;
  private button:HTMLButtonElement;
  private caption:HTMLElement;
  private raf=0;
  private canvas:HTMLCanvasElement;
  constructor(host:HTMLElement){
    host.innerHTML='<canvas data-no-i18n aria-label="角色模型预览 / Hero model preview"></canvas><div><button type="button"></button><small></small></div>';
    this.canvas=host.querySelector('canvas')!;this.button=host.querySelector('button')!;this.caption=host.querySelector('small')!;
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(400,180,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room);this.scene.environment=this.environment.texture;room.dispose();pmrem.dispose();
    this.resize=new ResizeObserver(()=>{const width=this.canvas.clientWidth||400,height=this.canvas.clientHeight||180;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();});this.resize.observe(this.canvas);
    this.scene.add(new THREE.HemisphereLight(0xd9edff,0x5b5270,1.4));const key=new THREE.DirectionalLight(0xffe5c9,2.3);key.position.set(2,4,3);this.scene.add(key);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(16,64),new THREE.MeshBasicMaterial({color:0x0b191d}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;this.scene.add(floor,this.extras);
    const grid=new THREE.GridHelper(24,24,0x36504f,0x263b3c);grid.material.transparent=true;grid.material.opacity=.2;grid.position.y=-.02;this.scene.add(grid);
    for(const radius of [.78,.87]){const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.007,80),new THREE.MeshBasicMaterial({color:0x75938a,transparent:true,opacity:.35,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.015;this.scene.add(ring);}
    this.scene.fog=new THREE.Fog(0x0d1a1e,20,32);
    this.effects=new HeroEffects(this.scene);this.smoke=new GrenadeView(this.scene);
    this.canvas.addEventListener('pointerdown',e=>{this.dragging=true;this.canvas.setPointerCapture(e.pointerId);});this.canvas.addEventListener('pointerup',()=>this.dragging=false);this.canvas.addEventListener('lostpointercapture',()=>this.dragging=false);this.canvas.addEventListener('pointercancel',()=>this.dragging=false);this.canvas.addEventListener('pointermove',e=>{if(this.dragging)this.rotation+=e.movementX*.015;});
    this.button.onclick=()=>this.demo();
    this.loop(0);
  }
  choose(char:number,weapon=0,skin=0){
    this.canvas.setAttribute('aria-label',bilingual('角色模型预览','Hero model preview'));
    this.button.textContent=bilingual('观看技能演示 · 8秒','Watch ability · 8 seconds');
    this.caption.textContent=bilingual('拖动查看角色 · 点击观看技能','Drag to rotate · Preview your ability');
    if(char===this.char&&weapon===this.weapon&&skin===this.skin&&this.rig?.state!=='failed')return;
    this.demonstration=null;this.effects.clear();this.smoke.clear();this.clearExtras();
    this.gun?.dispose();if(this.rig){this.rig.dispose();}
    this.renderer.clear();this.canvas.setAttribute('aria-busy','true');this.char=char;this.weapon=weapon;this.skin=skin;this.rig=new ArenaCharacter(char,0x70d9dd);this.anim=this.rig;this.scene.add(this.rig.root);
    this.gun=buildGun(weapon,skin);this.gun.group.position.set(.16,-.08,-.32);this.gun.group.scale.setScalar(1.15);this.rig.aim.add(this.gun.group);this.rotation=Math.PI+.2;
    const visual=this.rig;this.button.disabled=true;this.caption.textContent=bilingual('正在加载角色…','Loading hero…');
    void visual.ready.then(()=>{if(this.rig!==visual)return;this.button.disabled=false;this.canvas.setAttribute('aria-busy','false');this.caption.textContent=bilingual('拖动查看角色 · 点击下方观看技能','Drag to rotate · Preview your ability below');}).catch(error=>{console.error('Arena hero preview failed',char,error);if(this.rig!==visual)return;this.canvas.setAttribute('aria-busy','false');this.caption.textContent=bilingual('模型加载失败，重新选择可重试','Model failed to load; select again to retry');});
  }
  private demo(){this.demonstration=new HeroDemo(this.char);this.effects.clear();this.smoke.clear();this.clearExtras();this.caption.textContent=bilingual(abilityFor(this.char).description,abilityFor(this.char).english);}
  private clearExtras(){for(const [key,o] of this.extraObjects){const actor=this.extraAnimators.get(key);if(actor)actor.dispose();else{o.removeFromParent();disposeTree(o);}}this.extraObjects.clear();this.extraAnimators.clear();}
  private loop=(time:number)=>{
    if(!this.running)return;this.raf=requestAnimationFrame(this.loop);
    if(document.hidden||document.getElementById('lobby')?.classList.contains('hidden')||document.getElementById('pane-heroes')?.hidden){this.last=time;return;}
    if(time-this.last<40)return;
    const dt=Math.min(.08,(time-this.last)/1000);this.last=time;
    if(!this.rig||!this.anim||this.rig.state!=='ready')return;
    const demo=this.demonstration;
    if(demo&&!demo.done){
      const snap=demo.advance(dt),p=demo.match.player('hero')!;
      this.rig.root.position.set(p.x,p.y,p.z);this.rig.root.rotation.y=p.yaw;this.anim.ability(CHARACTERS[this.char].ability,p.ability.phase);this.anim.update(dt,Math.hypot(p.vx,p.vz),0);if(this.gun)this.gun.group.visible=abilityAllowsGunplay(this.char)||p.ability.phase==='idle'||p.ability.phase==='recovery';
      for(const e of snap.events)if(e.t==='ability')this.effects.event(e,snap.tick,p.yaw);this.effects.sync(snap,'hero');this.smoke.sync([],snap.smokes??[],0);this.smoke.update(dt);
      this.caption.textContent=bilingual(`演示 ${(demo.ticks/60).toFixed(1)}/8s · 自己 ${Math.ceil(p.hp)} HP · 目标 ${Math.ceil(demo.match.player('target')!.hp)} HP`,`Demo ${(demo.ticks/60).toFixed(1)}/8s · You ${Math.ceil(p.hp)} HP · Target ${Math.ceil(demo.match.player('target')!.hp)} HP`);
      const alive=new Set<string>();
      for(const s of snap.shields){const key=`shield:${s.id}`;alive.add(key);let panel=this.extraObjects.get(key);if(!panel){panel=new THREE.Mesh(new THREE.BoxGeometry(2.4,2,.06),new THREE.MeshBasicMaterial({color:0x79dce0,transparent:true,opacity:.55}));this.extraObjects.set(key,panel);this.extras.add(panel);}panel.position.set(s.x,s.y+1,s.z);panel.rotation.y=s.yaw;}
      const target=demo.match.player('target')!;
      const actors=[{key:'target',char:2,x:target.x,y:target.y,z:target.z,yaw:target.yaw,speed:Math.hypot(target.vx,target.vz),color:0xffaa69},...(snap.entities??[]).filter(e=>e.kind==='decoy').map(e=>({key:`echo:${e.id}`,char:e.char,x:e.x,y:e.y,z:e.z,yaw:e.yaw,speed:e.travelled<8?5.2:0,color:0x70d9dd}))];
      for(const actor of actors){alive.add(actor.key);let body=this.extraObjects.get(actor.key);if(!body){const rig=new ArenaCharacter(actor.char,actor.color);body=rig.root;this.extraObjects.set(actor.key,body);this.extraAnimators.set(actor.key,rig);this.extras.add(body);}body.position.set(actor.x,actor.y,actor.z);body.rotation.y=actor.yaw;this.extraAnimators.get(actor.key)!.update(dt,actor.speed,0);}
      for(const [key,o] of this.extraObjects)if(!alive.has(key)){const actor=this.extraAnimators.get(key);if(actor)actor.dispose();else{o.removeFromParent();disposeTree(o);}this.extraObjects.delete(key);this.extraAnimators.delete(key);}
      this.camera.position.set(8,7,9);this.camera.lookAt(0,.5,-3);
    }else{
      if(demo){this.demonstration=null;this.effects.clear();this.smoke.clear();this.clearExtras();this.caption.textContent=bilingual('拖动查看角色 · 点击观看技能','Drag to rotate · Preview your ability');}
      if(this.gun)this.gun.group.visible=true;this.rig.root.position.set(0,0,0);this.rig.root.rotation.y=this.rotation;this.anim.ability(CHARACTERS[this.char].ability,'idle');this.anim.update(dt,0,0);this.anim.melee(0,0,this.weapon);
      this.camera.position.set(0,1.35,3.9);this.camera.lookAt(0,1.05,0);
    }
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){this.running=false;this.resize.disconnect();cancelAnimationFrame(this.raf);this.gun?.dispose();this.effects.dispose();this.smoke.dispose();this.rig?.dispose();this.clearExtras();this.environment.dispose();disposeTree(this.scene);this.renderer.dispose();}
}
