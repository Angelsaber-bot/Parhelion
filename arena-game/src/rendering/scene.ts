import {disposeTree,combatArt,artPoint} from '../weapons/weaponArt.ts';
import type {SkinEffect} from '../cosmetics/skinEffects.ts';
import {skinEffect} from '../cosmetics/skinEffects.ts';
// Three.js presentation: the arena map art, placeholder anime-style avatars, shields, tracers and the
// first-person weapon. No game rules in here.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import asterGlb from '../../../arena/assets/station_visual.glb?url';
import sakuraGlb from '../../../arena-maps/sakura/assets/sakura_visual.glb?url';
import rangeGlb from '../../../arena-maps/range/assets/range_visual.glb?url';
import blackflagGlb from '../../../arena-maps/blackflag/assets/blackflag_visual.glb?url';
import frostcourtGlb from '../../../arena-maps/frostcourt/assets/frostcourt_visual.glb?url';
import camlannGlb from '../../../arena-maps/camlann/assets/camlann_visual.glb?url';
import asterOverlayGlb from '../../../arena-maps/aster/assets/aster_overlay.glb?url';
import { CHARACTERS, SHIELD, WEAPONS, type Team } from '../../shared/content.ts';
import type { MapPresentation, Vec3 } from '../../shared/map.ts';
import type { PlayerSnap, Shield } from '../../shared/match.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { atmosphereFor, type Atmosphere } from './atmosphere.ts';
import { buildFighter, FighterAnimator } from '../player/fighter.ts';
import { AvatarMotion, ViewmodelStride, motionDt } from '../player/characterMotion.ts';
import { OutlinePass } from './outline.ts';
import { celMaterial, toCel, makeSky } from './cel.ts';
import { CRAFTED_CHAPTERS, toChapterMaterial } from './chapterMaterial.ts';
import { attachGunArt, setGunArtWarmer, type GunPresentation } from '../weapons/gunArt.ts';
import { isScopedWeapon } from '../player/aim.ts';
import { meleeRecoverySeconds, meleeWindupProgress, poseMelee } from '../weapons/meleeArt.ts';
import { ChapterEffects } from './chapterEffects.ts';
import { ArenaCombatEffects } from './combatEffects.ts';
import { WeaponFx, SWING_GLSL } from './weaponFx.ts';
import { flashTexture } from './fxShapes.ts';
import { signatureFx, SWING_STYLES, type GunFx, type MeleeFx } from '../cosmetics/signatureFx.ts';
import { KillFinishers } from './killFinishers.ts';
import { GrenadeView } from './grenades.ts';
import { insideSmoke, smokeBlocks, type Grenade, type Smoke } from '../../shared/grenade.ts';
import { BLACKFLAG_ATMOSPHERE, BlackflagEffects, blackflagCastsShadow } from './blackflagPresentation.ts';
import {graphicsPixelRatio,type GraphicsQuality} from './graphics.ts';
import {lightWeaponScene,renderHeldWeapon} from '../weapons/weaponLighting.ts';
import {firearmIdlePose} from '../weapons/weaponPose.ts';
import {renderTelemetry} from './renderTelemetry.ts';
import {worldRenderVisible} from './renderScheduling.ts';

const MAP_GLB: Record<string, string> = { aster: asterGlb, sakura: sakuraGlb, blackflag: blackflagGlb, frostcourt: frostcourtGlb, camlann: camlannGlb, range: rangeGlb };
/** Extra decorative layers drawn over a map's own art (ASTER's original model stays untouched). */
const MAP_OVERLAY: Record<string, string> = { aster: asterOverlayGlb };

export const TEAM_COLOR: Record<Team, number> = { A: 0x4fd6e0, B: 0xf09a4a };

export class ArenaScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(78, 1, 0.15, 260);
  private vmScene = new THREE.Scene();
  private vmCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  private avatars = new Map<string, Avatar>();
  private shields = new Map<number, THREE.Group>();
  private combatEffects: ArenaCombatEffects;
  private weaponFx: WeaponFx | null = null;
  private killFinishers!: KillFinishers;
  private grenadeView!: GrenadeView;
  private muzzleLight = new THREE.PointLight(0xffd79a, 0, 9, 2);
  private flashT = 0;
  private baseFov = 78;
  readonly viewmodel = new Viewmodel();
  private sparkTex = makeGlowTexture();
  private sky: THREE.Mesh;
  private maps = new Map<string, Promise<THREE.Object3D>>();
  private shownMap: THREE.Object3D | null = null;
  private wantMap = '';
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private outline: OutlinePass | null = null;
  private fxaa: ShaderPass | null = null;
  private telemetry: ReturnType<typeof renderTelemetry> = null;
  private mapPresentation: MapPresentation | undefined;
  private shownMapId='';
  private particles: Particles | null = null;
  private blackflagEffects: BlackflagEffects | null = null;
  private chapterEffects: ChapterEffects | null = null;
  private bufferSize = new THREE.Vector2();
  private atmo: Atmosphere = atmosphereFor('day');

  constructor(canvas: HTMLCanvasElement, private quality: GraphicsQuality = 'low') {
    this.combatEffects = new ArenaCombatEffects(this.scene, this.sparkTex, quality);
    this.weaponFx = new WeaponFx(this.scene, quality);
    this.killFinishers = new KillFinishers(this.scene);
    this.grenadeView = new GrenadeView(this.scene);
    const r = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(graphicsPixelRatio(quality,devicePixelRatio,innerWidth,innerHeight));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping; // keeps anime saturation, unlike ACES
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    this.renderer = r;
    this.telemetry=renderTelemetry(r);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(r);
    const environment = pmrem.fromScene(room);
    this.scene.environment = this.vmScene.environment = environment.texture;
    room.dispose(); pmrem.dispose();

    const s = this.scene;
    s.background = new THREE.Color(0xbfdcf2);
    s.fog = new THREE.Fog(0xc4e2f6, 70, 220);
    this.sky = makeSky(new THREE.Vector3(-22, 35, 18));
    s.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xd6ecff, 0x6a7088, 1.8);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffe7c8, 3.0);
    this.sun = sun;
    sun.position.set(-22, 35, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 44, bottom: -44, near: 1, far: 100 });
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.045;
    s.add(sun);
    this.camera.rotation.order = 'YXZ';
    // No gunfire point lights in the map shader: architecture keeps stable lighting.

    lightWeaponScene(this.vmScene);this.vmScene.add(this.viewmodel.root);
    this.configureQuality();
    // Gun art that streams in mid-match is compiled for the exact pass it will be drawn in
    // (viewmodel scene, or the world through the composer) before it replaces its fallback.
    setGunArtWarmer((root, firstPerson) => {
      const r = this.renderer;
      if (firstPerson) return r.compileAsync(root, this.vmCamera, this.vmScene);
      const previous = r.getRenderTarget();
      if (this.composer) r.setRenderTarget(this.composer.readBuffer);
      try { return r.compileAsync(root, this.camera, this.scene); } finally { r.setRenderTarget(previous); }
    });

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private configureQuality(){
    const r=this.renderer;
    this.composer?.passes.forEach(pass=>pass.dispose());this.composer?.dispose();
    this.composer=null;this.bloom=null;this.outline=null;this.fxaa=null;
    r.shadowMap.enabled=true;r.shadowMap.needsUpdate=true;
    const shadowSize=this.quality==='high'?2048:1024;
    if(this.sun.shadow.mapSize.x!==shadowSize){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(shadowSize,shadowSize);}
    if(this.quality==='high'){
      // Single-sample HDR + one lightweight edge pass, never HDR MSAA × supersampling.
      const rt=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1),samples:0});
      this.composer=new EffectComposer(r,rt);this.composer.addPass(new RenderPass(this.scene,this.camera));
      this.outline=new OutlinePass(this.camera);this.composer.addPass(this.outline);
      this.bloom=new UnrealBloomPass(new THREE.Vector2(256,256),this.atmo.bloom,.55,this.atmo.bloomThreshold);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
      this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);
    }
  }
  /** Live quality changes do not replace the match, map or weapon selection. */
  setQuality(quality:GraphicsQuality){
    if(quality===this.quality)return;
    this.quality=quality;this.configureQuality();
    this.combatEffects.dispose();this.combatEffects=new ArenaCombatEffects(this.scene,this.sparkTex,quality);
    this.weaponFx?.dispose();this.weaponFx=new WeaponFx(this.scene,quality);
    this.configureDressing();this.setAtmosphere(this.atmo);this.resize();
  }

  private configureDressing(){
    this.blackflagEffects?.dispose();
    this.blackflagEffects=this.shownMapId==='blackflag'?new BlackflagEffects(this.sparkTex,this.quality):null;
    if(this.blackflagEffects)this.scene.add(this.blackflagEffects.root);
    this.chapterEffects?.dispose();const p=this.mapPresentation;
    this.chapterEffects=p&&(p.glows||p.pools||p.embers||p.smoke||p.field)?new ChapterEffects(p,this.sparkTex,this.quality):null;
    if(this.chapterEffects)this.scene.add(this.chapterEffects.root);
  }

  /** Apply a map's lighting mood: sky, fog, sun, ambient, exposure, bloom and ambient particles. */
  setAtmosphere(a: Atmosphere) {
    this.atmo = a;
    const s = this.scene;
    (s.background as THREE.Color).set(a.background);
    (s.fog as THREE.Fog).color.set(a.fog[0]);
    (s.fog as THREE.Fog).near = a.fog[1];
    (s.fog as THREE.Fog).far = a.fog[2];
    this.renderer.toneMappingExposure = a.exposure;
    s.environmentIntensity = a.environment ?? 1;
    this.hemi.color.set(a.hemi[0]);
    this.hemi.groundColor.set(a.hemi[1]);
    this.hemi.intensity = a.hemi[2];
    this.sun.color.set(a.sun.color);
    this.sun.intensity = a.sun.intensity;
    this.sun.position.set(...a.sun.pos);
    const u = (this.sky.material as THREE.ShaderMaterial).uniforms;
    (u.sunDir.value as THREE.Vector3).set(...a.sun.pos).normalize();
    const lin = (hex: number) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace); // raw shader values
    u.uHorizon.value = lin(a.sky.horizon); u.uMid.value = lin(a.sky.mid); u.uTop.value = lin(a.sky.top);
    u.uSun.value = lin(a.sky.sun); u.uCloudLit.value = lin(a.sky.cloudLit); u.uCloudShade.value = lin(a.sky.cloudShade);
    u.uNight.value = a.sky.night;
    u.uAurora.value = a.sky.aurora ?? 0;
    if (this.bloom) { this.bloom.strength = a.bloom; this.bloom.threshold = a.bloomThreshold; }
    if (this.particles) { this.particles.dispose(s); this.particles = null; }
    if (a.particles !== 'none') this.particles = new Particles(a.particles, this.sparkTex, s,this.quality);
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Show a map's art (loaded once per map, then cached); resolves when it is on screen. */
  async loadMap(id: string, preset?: string, presentation?: MapPresentation): Promise<void> {
    this.wantMap = id;
    this.setAtmosphere(id === 'blackflag' ? BLACKFLAG_ATMOSPHERE : atmosphereFor(preset));
    let p = this.maps.get(id);
    if (!p) {
      const urls = [MAP_GLB[id] ?? asterGlb, ...(MAP_OVERLAY[id] ? [MAP_OVERLAY[id]] : [])];
      p = Promise.all(urls.map((u) => new GLTFLoader().loadAsync(u))).then((gltfs) => {
        const group = new THREE.Group();
        for (const gltf of gltfs) group.add(gltf.scene);
        group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const decorative = m.userData.decorative === true;
          const role = m.userData.role as string | undefined;
          const convert = CRAFTED_CHAPTERS.has(id) ? toChapterMaterial : toCel;
          m.material = Array.isArray(m.material) ? m.material.map(convert) : convert(m.material);
          m.receiveShadow = true;
          m.castShadow = id === 'blackflag' ? blackflagCastsShadow(m) : !decorative && role !== 'floor' && role !== 'wayfinding';
        });
        return group;
      });
      this.maps.set(id, p);
      p.catch(() => this.maps.delete(id));
    }
    const root = await p;
    if (this.wantMap !== id || this.shownMap === root) return; // a later pick won
    this.shownMapId=id;this.mapPresentation=presentation;this.configureDressing();
    if (this.shownMap) this.scene.remove(this.shownMap);
    this.scene.add(root);
    this.shownMap = root;
    // the map is static: render its shadow map once per map change
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Pay art construction and shader compilation while the loading panel is up. */
  private releaseWarmup:(()=>void)|null=null;
  async prepareLoadout(indices:readonly number[],skins:readonly number[]){
    const presentations:GunPresentation[]=[],fighters:THREE.Group[]=[],avatars:Avatar[]=[];
    try{
      for(const index of indices){
        const held=buildGun(index,skins[index]??0,true);presentations.push(held);await held.ready;
        const remote=buildGun(index,skins[index]??0,false);presentations.push(remote);await remote.ready;
        this.vmScene.add(held.group);this.scene.add(remote.group);
      }
      // Whole avatars (team ring, contact shadow, nameplate) and a barrier, exactly as the match draws them.
      for(const char of [0,1]){const avatar=new Avatar({char,team:'A'} as PlayerSnap);avatars.push(avatar);this.scene.add(avatar.root);}
      const shield=makeShield(TEAM_COLOR.A);fighters.push(shield);this.scene.add(shield);
      this.combatEffects.tracer([0,-1000,0],[0,-1000,-1],0xffffff);
      this.combatEffects.burst([0,-1000,0],0xffffff,.01,.1,0);
      // Every weapon-effect material, so the first shot, hit or swing never compiles a shader.
      const wf=this.weaponFx;if(wf){wf.streak([0,-1000,0],[0,-1000,-5],0xffffff);wf.flash([0,-1000,0],0xffffff);wf.puff([0,-1000,0],0xffffff,.1,.5);wf.decal([0,-1000,0],[0,1,0]);wf.arc([0,-1000,0],[0,-1000,-1],0xffffff,1,1);
        // And each equipped finish's own flash / mark / emblem textures, uploaded now rather than on first use.
        for(const index of indices){const f=signatureFx(WEAPONS[index]?.skins[skins[index]??0]?.id);if(f?.kind==='gun'){wf.flash([0,-1000,0],f.head,.1,f.flash);wf.decal([0,-1000,0],[0,1,0],.1,1,f.mark,f.head);}else if(f)wf.flash([0,-1000,0],f.head,.1,f.glyph);}}
      this.killFinishers.play([0,-1000,0],'stormcoil',this.camera); // compile the finisher shader with the rest
      // With post-processing the scene is drawn into the composer's linear, untonemapped buffer; programs
      // compiled for the screen would not match and would all compile again on the first real frame.
      const previous=this.renderer.getRenderTarget();
      if(this.composer)this.renderer.setRenderTarget(this.composer.readBuffer);
      const world=this.renderer.compileAsync(this.scene,this.camera);
      this.renderer.setRenderTarget(previous);
      await Promise.all([world,this.renderer.compileAsync(this.vmScene,this.vmCamera)]);
      // Program compilation alone does not upload vertex buffers/textures: draw one real frame.
      if(this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
      renderHeldWeapon(this.renderer,this.vmScene,this.vmCamera);
    }finally{
      this.combatEffects.clear();this.weaponFx?.clear();
      for(const presentation of presentations)presentation.group.removeFromParent();
      for(const object of [...fighters,...avatars.map(avatar=>avatar.root)])object.removeFromParent();
      // three.js deletes a shader program as soon as no live material uses it, so disposing the warm-up
      // set here would throw away the programs just compiled. Keep it off-scene until the next warm-up.
      this.releaseWarmup?.();
      this.releaseWarmup=()=>{
        for(const presentation of presentations)presentation.dispose();
        for(const fighter of fighters)disposeTree(fighter,false);
        for(const avatar of avatars){avatar.dispose(this.scene);disposeTree(avatar.root,false);}
      };
      this.renderer.shadowMap.needsUpdate=true;
    }
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(graphicsPixelRatio(this.quality,devicePixelRatio,w,h));
    this.renderer.setSize(w, h);
    this.viewmodel.aspect=w/h;
    this.camera.aspect = this.vmCamera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.updateProjectionMatrix();
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    if(this.fxaa)this.fxaa.uniforms.resolution.value.set(1/(w*this.renderer.getPixelRatio()),1/(h*this.renderer.getPixelRatio()));
  }

  setView(x: number, y: number, z: number, yaw: number, pitch: number, roll = 0, fovAdd = 0) {
    this.camera.position.set(x, y, z);
    this.sky.position.set(x, y, z);
    ((this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = performance.now() / 1000);
    this.camera.rotation.set(pitch, yaw, roll);
    const fov = this.baseFov + fovAdd;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  localMuzzle(): Vec3 {
    this.camera.updateMatrixWorld(); this.vmCamera.updateMatrixWorld();
    const v = this.viewmodel.muzzlePosition();
    const ndc = v.clone().project(this.vmCamera);
    const ray = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const at = this.camera.position.clone().addScaledVector(ray, Math.max(0.2, v.length()));
    return [at.x, at.y, at.z];
  }

  /** Muzzle light: a brief warm flash on the world around the shooter. */
  muzzleFlash(at: Vec3, strength = 1, skinId?:string) {
    // World lighting remains fixed while firing; the held muzzle sprite carries the flash.
    this.muzzleLight.position.set(...at);this.muzzleLight.intensity=0;this.flashT=0;
  }

  /** A travelling slug of light from the muzzle to the hit, in the finish's colour. Your own shot
   *  while aiming starts a few metres out and stays faint, so the sight picture stays clear. */
  skinTracer(from:Vec3,to:Vec3,id?:string,width=1,accent=true,weapon=0,aiming=false){
    const style=skinEffect(id),fx=gunFx(id),color=fx?.head??style?.color??0xffa63d,p=TRACER_PROFILE[weapon]??TRACER_PROFILE[0];
    if(!this.weaponFx){this.combatEffects.tracer(from,to,color,width,accent?style:undefined);return;}
    // Each finish flies its own way: helix, beads, bolt, ribbon, comet, dashes or a wave.
    this.weaponFx.streak(from,to,color,p.width,p.speed,aiming?.3:Math.min(1,.45+width*.8),aiming?2.5:0,{style:fx?.tracer,tail:fx?.tail});
    if(accent&&style)this.combatEffects.accent(from,to,style);
  }
  /** Bullet contact. On the map: the finish's own mark flush with the surface (a plain hole for
   *  stock), a dust puff and a few hot chips. On a player: a compact flash and particles. */
  skinImpact(at:Vec3,onPlayer:boolean,id?:string,normal?:Vec3){
    const style=skinEffect(id),fx=gunFx(id);
    this.combatEffects.burst(at,onPlayer?0xffe6d2:(style?.secondary??0xc7b9a2),.055,.10,1.5,style?.particle);
    if(onPlayer){
      this.combatEffects.burst(at,0xffffff,.16,.06,0);
      for(let i=0;i<4;i++)this.combatEffects.burst(at,i%2?style?.secondary??0xffd0b0:style?.color??0xffcd9a,.035,.16,2.6,style?.particle);
      return;
    }
    const n=normal??[0,1,0],out:Vec3=[at[0]+n[0]*.04,at[1]+n[1]*.04,at[2]+n[2]*.04];
    this.weaponFx?.decal(at,n,undefined,undefined,fx?.mark,fx?.head);
    this.weaponFx?.puff(out,0xbdb3a3,.28,.55,.42,[n[0]*.7,n[1]*.7,n[2]*.7],.25);
    for(let i=0;i<3;i++)this.combatEffects.burst(out,i?(style?.color??0xffd28a):0xffffff,.03,.22+Math.random()*.12,3.2,style?.particle??'ember',n,9);
  }
  /** Other players' shots: their finish's flash shape at the muzzle and a thin breath of smoke. */
  remoteMuzzle(at:Vec3,weapon:number,id?:string){
    const fx=gunFx(id);
    this.weaponFx?.flash(at,fx?.head??0xffa040,weapon===1?.55:weapon===4?.5:.36,fx?.flash);
    if(weapon===1||weapon===4)this.weaponFx?.puff(at,0xd9d4cb,.3,.6,.22,[0,0,0],.5);
  }
  /** Your own polearm thrust and hammer chop drive straight into the screen, where a ribbon along
   *  the weapon cannot show them. A pierce ring (polearm) or a downward chop arc (hammer) in the
   *  finish's swing style opens in front of you instead, low and clear of the crosshair. */
  ownSwing(weapon:number,id?:string){
    if(weapon!==6&&weapon!==7)return;
    const fx=meleeFx(id),c=this.camera,f=new THREE.Vector3(0,0,-1).applyQuaternion(c.quaternion),r=new THREE.Vector3(1,0,0).applyQuaternion(c.quaternion),u=new THREE.Vector3(0,1,0).applyQuaternion(c.quaternion);
    const chop=weapon===7,centre=c.position.clone().addScaledVector(f,chop?.35:.55).addScaledVector(r,chop?.05:.12).addScaledVector(u,chop?-.08:-.12),to=centre.clone().add(f);
    let color=fx?.head??MELEE_COLOR[weapon],tail=fx?.tail;if(fx&&luma(fx.head)>.78&&luma(fx.tail)<luma(fx.head)){color=fx.tail;tail=fx.head;}
    if(chop)this.weaponFx?.arc([centre.x,centre.y,centre.z],[to.x,to.y,to.z],color,.5,2.2,'chop',.22,fx?.swing??'crescent',tail);
    else this.weaponFx?.arc([centre.x,centre.y,centre.z],[to.x,to.y,to.z],color,.3,6.1,'thrust',.2,fx?.swing??'crescent',tail);
  }
  /** Another player's swing, drawn as the crescent the weapon sweeps (blade), a long narrow
   *  thrust (polearm) or an overhead chop (hammer), in the finish's own style. Never a line
   *  through the target. */
  skinSwing(from:Vec3,to:Vec3,id?:string,weapon=5){
    const style=skinEffect(id),fx=meleeFx(id),centre:Vec3=[from[0],from[1]-.25,from[2]];
    // A very pale accent (silver, ice) would vanish on white maps: lead with the deeper trim colour instead.
    let color=fx?.head??style?.color??MELEE_COLOR[weapon]??0x9cf0ff,tail=fx?.tail;
    if(fx&&luma(fx.head)>.78&&luma(fx.tail)<luma(fx.head)){color=fx.tail;tail=fx.head;}
    const look=fx?.swing??'crescent';
    if(weapon===7)this.weaponFx?.arc(centre,to,color,1.05,2.4,'chop',.24,look,tail);
    else if(weapon===6)this.weaponFx?.arc(centre,to,color,.42,6.1,'thrust',.2,look,tail);
    else this.weaponFx?.arc(centre,to,color,1.1,2.5,'slash',.2,look,tail);
  }

  /** Bullet impact: a dust puff and flying chips on the map, a bright star burst on a player. */
  impact(at: Vec3, onPlayer: boolean, color = 0xfff4c0) {
    if (onPlayer) {
      this.burst(at, 0xffffff, 0.55, 0.12, 0);
      this.burst(at, 0xff6f91, 0.9, 0.16, 0);
      for (let i = 0; i < 5; i++) this.burst(at, 0xffc2d4, 0.12, 0.25, 3.2);
    } else {
      this.burst(at, 0xf3ead8, 0.5, 0.35, 0);
      this.burst(at, color, 0.3, 0.1, 0);
      for (let i = 0; i < 4; i++) this.burst(at, 0xffe2a6, 0.08, 0.3, 4);
    }
  }

  /** Melee contact: a white flash, a shock ring, a spray of sparks in the finish's colours and shape,
   *  heavier debris and a dust burst for the hammer. Finished weapons get the same weight as stock. */
  meleeImpact(at: Vec3, weapon: number, skinId?:string) {
    const style=skinEffect(skinId), heavy = weapon === 7;
    const color = style?.color ?? MELEE_COLOR[weapon] ?? 0x9cf0ff, second = style?.secondary ?? 0xfff1c8, shape = style?.particle;
    this.combatEffects.burst(at, 0xffffff, heavy ? 1.1 : .75, .08, 0);
    this.combatEffects.burst(at, color, heavy ? 1.4 : 1, .18, 0, 'ring');
    for (let i = 0; i < (heavy ? 12 : 8); i++) this.combatEffects.burst(at, i % 3 ? color : second, .1, .3, heavy ? 4.5 : 5.5, shape);
    for (let i = 0; i < (heavy ? 6 : 3); i++) this.combatEffects.burst(at, 0xfff1c8, .07, .4, 3, 'ember');
    // The finish's emblem bursts at the point of contact: a gear, a rose, a snowflake, a bolt...
    const fx = meleeFx(skinId); if (fx) this.weaponFx?.flash(at, fx.head, heavy ? 1.3 : 1, fx.glyph, .2);
    if (heavy) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; this.weaponFx?.puff([at[0], at[1] - .6, at[2]], 0xc8bba6, .5, .7, .35, [Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4], .3); }
  }

  private burst(at: Vec3, color: number, size: number, life: number, speed: number) {
    this.combatEffects.burst(at, color, size, life, speed);
  }

  /** Floating damage labels reuse one private canvas texture per bounded slot. */
  damageNumber(at: Vec3, dmg: number, head: boolean, kill: boolean) {
    this.combatEffects.damageNumber(at, dmg, head, kill);
  }

  get combatEffectInventory() { return this.combatEffects.inventory; }
  /** Page teardown only; ordinary rounds retain the bounded reusable resources. */
  disposeCombatEffects() { this.combatEffects.dispose(); this.weaponFx?.dispose(); this.killFinishers?.dispose(); this.grenadeView?.dispose(); }
  private smokes: readonly Smoke[] = [];
  syncGrenades(grenades: readonly Grenade[], smokes: readonly Smoke[], since: number) { this.smokes = smokes; this.grenadeView?.sync(grenades, smokes, since); }
  /** Frag detonation: flash, shockwave, smoke, plus sparks from the shared effect pool. */
  grenadeBlast(at: Vec3) { this.grenadeView?.blast(at); for (let i = 0; i < 10; i++) this.combatEffects.burst([at[0], at[1] + .3, at[2]], i % 2 ? 0xffd27a : 0xff7a3a, .12, .45, 7, 'ember'); }
  smokePop(at: Vec3) { for (let i = 0; i < 6; i++) this.combatEffects.burst([at[0], at[1] + .2, at[2]], 0xdfe6ee, .4, .6, 2.2); }
  /** Per-finish kill emblem at the victim; dimmed and lifted while the local player aims. */
  killFinisher(feet: Vec3, skinId?: string) { return this.killFinishers.play(feet, skinId, this.camera, this.viewmodel.aim > .3); }

  // ---------- players ----------

  syncAvatar(p: PlayerSnap, pos: Vec3, yaw: number, pitch: number, ally: boolean) {
    let a = this.avatars.get(p.id);
    if (!a || a.char !== p.char || a.team !== p.team) {
      a?.dispose(this.scene);
      a = new Avatar(p);
      this.avatars.set(p.id, a);
      this.scene.add(a.root);
    }
    if (a.root.visible !== p.alive) a.resetMotion(p.crouched, p.grounded);
    a.root.visible = p.alive;
    a.setAlly(ally);
    // Smoke hides an enemy completely: no nameplate or health bar through or inside a cloud.
    const head: Vec3 = [pos[0], pos[1] + 1.6, pos[2]], eye = this.camera.position;
    a.conceal(!ally && this.smokes.length > 0 && (insideSmoke(this.smokes, head) || smokeBlocks(this.smokes, [eye.x, eye.y, eye.z], head)));
    const now = performance.now() / 1000;
    a.setWeapon(p.weapon, p.skins[p.weapon] ?? 0);
    const facing = p.meleeWindup > 0 ? p.meleeYaw : yaw;
    a.animate(pos, now - this.lastAnim, p.crouched, p.meleeWindup, p.grounded, facing);
    a.root.position.set(pos[0], pos[1], pos[2]);
    a.root.rotation.y = facing;
    a.aim.rotation.x = p.meleeWindup > 0 ? p.meleePitch : pitch;
    a.setHp(p.hp / CHARACTERS[p.char].hp, p.name);
  }

  meleeStrike(id: string) { this.avatars.get(id)?.strike(); }

  private lastAnim = performance.now() / 1000;
  /** Call once per frame after all syncAvatar calls. */
  endAvatars() { this.lastAnim = performance.now() / 1000; }

  pruneAvatars(ids: Set<string>) {
    for (const [id, a] of this.avatars) if (!ids.has(id)) { a.dispose(this.scene); this.avatars.delete(id); }
  }

  /** World-space muzzle of a remote avatar, for its tracers. */
  muzzleOf(id: string): Vec3 | null {
    const a = this.avatars.get(id);
    if (!a || !a.root.visible) return null;
    const v = a.muzzle.getWorldPosition(new THREE.Vector3());
    return [v.x, v.y, v.z];
  }

  // ---------- shields ----------

  syncShields(list: Shield[]) {
    const live = new Set<number>();
    for (const s of list) {
      live.add(s.id);
      let g = this.shields.get(s.id);
      if (!g) {
        g = makeShield(TEAM_COLOR[s.team]);
        this.shields.set(s.id, g);
        this.scene.add(g);
      }
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.yaw;
      const k = Math.max(0.15, s.hp / SHIELD.hp);
      ((g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.25 * k;
      const fade = Math.min(1, s.life / 30);
      g.scale.setScalar(0.3 + 0.7 * Math.min(1, (SHIELD.life - s.life) / 8)); // pop-in
      g.visible = fade > 0;
    }
    for (const [id, g] of this.shields) if (!live.has(id)) {
      this.scene.remove(g); g.traverse((node) => {
        const drawable = node as THREE.Mesh;
        drawable.geometry?.dispose();
        if (drawable.material) for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) material.dispose();
      }); this.shields.delete(id);
    }
  }

  /** Round boundaries clear transient effects without reloading maps or equipped models. */
  clearCombatEffects() {
    this.combatEffects.clear(); this.weaponFx?.clear(); this.killFinishers?.clear(); this.grenadeView?.clear();
    this.flashT = 0; this.muzzleLight.intensity = 0;
    this.syncShields([]); this.viewmodel.resetMotion();
    for (const avatar of this.avatars.values()) avatar.resetMotion();
  }

  // ---------- effects ----------

  tracer(from: Vec3, to: Vec3, color: number, width = 1) {
    this.combatEffects.tracer(from, to, color, width);
    this.spark(to, color);
  }

  spark(at: Vec3, color: number) {
    this.burst(at, color, 0.35, 0.14, 0);
  }

  update(dt: number) {
    this.combatEffects.update(dt); this.weaponFx?.update(dt); this.killFinishers?.update(dt); this.grenadeView?.update(dt);
    const flashDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.flashT = Math.max(0, this.flashT - flashDt);
    // Preserve the original 60 Hz falloff, rather than dimming once per frame.
    this.muzzleLight.intensity = this.flashT > 1e-9 ? this.muzzleLight.intensity * Math.pow(.6, flashDt * 60) : 0;
    this.viewmodel.update(dt);
    this.particles?.update(dt, this.camera.position);
    this.blackflagEffects?.update(dt);
    this.chapterEffects?.update(dt);
  }

  render(showViewmodel: boolean) {
    if(typeof document!=='undefined'&&!worldRenderVisible(document)){this.telemetry?.pause();return;}
    const start=this.telemetry?.begin();
    const r = this.renderer;
    r.clear();
    this.chapterEffects?.sync(this.camera, r.getDrawingBufferSize(this.bufferSize).y, this.scene.fog as THREE.Fog);
    if (this.composer) this.composer.render();
    else r.render(this.scene, this.camera);
    if (showViewmodel) {
      renderHeldWeapon(r,this.vmScene,this.vmCamera);
    }
    if(start!==undefined)this.telemetry?.end(start);
  }
}

// ---------- weapon meshes (shared by viewmodel and avatars) ----------

function toon(color: number, emissive = 0) {
  return celMaterial({ color, emissive, emissiveIntensity: emissive ? 1.2 : 0 });
}

function buildFallbackGun(weapon: number, skin: number): { group: THREE.Group; muzzle: THREE.Object3D } {
  const s = WEAPONS[weapon].skins[skin] ?? WEAPONS[weapon].skins[0];
  const body = toon(s.body), accent = toon(s.accent, s.accent), dark = toon(0x1d2630);
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const cyl = (r: number, l: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const metal = toon(0x3a4250), glow = toon(s.accent, s.accent);
  let len: number;
  if (WEAPONS[weapon].kind === 'melee') { // Honest usable fallback, never a rifle for failed melee art.
    box(.045, .045, weapon === 6 ? 1.4 : .65, dark, 0, -.1, -.22);
    if (weapon === 7) box(.3, .22, .22, body, 0, -.1, -.5);
    else box(weapon === 6 ? .09 : .07, .025, weapon === 6 ? .45 : .55, accent, 0, -.1, weapon === 6 ? -.85 : -.5);
    len = weapon === 6 ? 1.05 : .75;
  } else if (weapon === 0 || weapon === 3) { // Lumen AR: bullpup-ish carbine, rail, red-dot, glowing energy strip
    box(0.068, 0.09, 0.4, body);
    box(0.07, 0.022, 0.28, accent, 0, 0.056, -0.02);
    box(0.05, 0.12, 0.06, dark, 0, -0.1, 0.07);                 // grip
    box(0.045, 0.13, 0.07, metal, 0, -0.1, -0.05).rotation.x = 0.18; // magazine
    box(0.074, 0.03, 0.18, dark, 0, -0.035, -0.22);             // handguard
    cyl(0.017, 0.2, metal, 0, 0.005, -0.33);                    // barrel
    cyl(0.025, 0.05, dark, 0, 0.005, -0.43);                    // flash hider
    box(0.06, 0.08, 0.16, body, 0, -0.012, 0.27);               // stock
    box(0.064, 0.02, 0.05, dark, 0, 0.012, 0.34);
    box(0.03, 0.035, 0.06, dark, 0, 0.085, 0.02);               // red-dot housing
    box(0.022, 0.022, 0.004, glow, 0, 0.088, -0.012);
    box(0.072, 0.008, 0.12, glow, 0, 0.0, -0.14);               // energy strip
    len = 0.46;
  } else if (weapon === 1) { // Corona SG: wide twin-tube shotgun with a pump and a shell rack
    box(0.09, 0.105, 0.42, body);
    cyl(0.026, 0.42, metal, -0.022, 0.02, -0.27);
    cyl(0.026, 0.42, metal, 0.022, 0.02, -0.27);
    box(0.1, 0.07, 0.16, dark, 0, -0.045, -0.22);               // pump
    for (let i = 0; i < 4; i++) box(0.102, 0.012, 0.012, glow, 0, -0.045, -0.28 + i * 0.04);
    box(0.092, 0.024, 0.36, accent, 0, 0.064, 0.02);
    box(0.05, 0.12, 0.06, dark, 0, -0.11, 0.12);
    box(0.082, 0.1, 0.2, body, 0, -0.02, 0.32);
    for (let i = 0; i < 4; i++) cyl(0.011, 0.05, toon(0xe0524a), 0.05, -0.01, 0.03 + i * 0.03, 8).rotation.set(0, 0, Math.PI / 2);
    len = 0.48;
  } else { // Halo DMR: long rifle, ringed scope, fluted barrel, halo emblem
    box(0.058, 0.08, 0.5, body);
    cyl(0.016, 0.34, metal, 0, 0.005, -0.42);
    for (let i = 0; i < 3; i++) cyl(0.021, 0.02, dark, 0, 0.005, -0.32 - i * 0.07);
    cyl(0.017, 0.17, dark, 0, 0.07, -0.02);                    // scope tube
    cyl(0.022, 0.025, dark, 0, 0.07, -0.1);
    cyl(0.022, 0.025, dark, 0, 0.07, 0.06);
    cyl(0.016, 0.005, glow, 0, 0.07, -0.115);                  // lens glint
    box(0.06, 0.014, 0.44, accent, 0, -0.046, -0.02);
    box(0.045, 0.12, 0.05, dark, 0, -0.1, 0.08);
    box(0.04, 0.09, 0.05, metal, 0, -0.085, -0.04);
    box(0.06, 0.1, 0.2, body, 0, -0.02, 0.34);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 20), glow);
    halo.position.set(0.031, 0, 0.12);
    halo.rotation.y = Math.PI / 2;
    g.add(halo);
    len = 0.6;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -len);
  g.add(muzzle);
  return { group: g, muzzle };
}

export function buildGun(weapon: number, skin: number, firstPerson = false): GunPresentation {
  return attachGunArt(weapon, skin, buildFallbackGun(weapon, skin), firstPerson);
}

export class Viewmodel {
  readonly root = new THREE.Group();
  private gun: THREE.Group | null = null;
  private presentation: GunPresentation | null = null;
  private muzzle: THREE.Object3D | null = null;
  private flash: THREE.Sprite;
  private key = '';
  private kick = 0;
  private kickMax = 1;
  private meleeHit = 0;
  private hitStop = 0;
  meleeWindup = 0;
  private weapon = 0;
  private swap = 0;
  private stride = new ViewmodelStride();
  private aimPosition = new THREE.Vector3();
  private flashPosition = new THREE.Vector3();
  private sway = [0, 0];
  private shells: { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number }[] = [];
  private shellGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.028, 6);
  private shellMat = celMaterial({ color: 0xe6b55a, emissive: 0x3a2400 });
  /** Viewmodel-space cosmetics: skin muzzle sparks. Separate pool, never in the world. */
  private fx = new ArenaCombatEffects(this.root, makeGlowTexture(), 'low');
  /** Viewmodel-space smoke from the muzzle (normal-blended puffs). */
  private vfx = new WeaponFx(this.root, 'low');
  private flashLife = 0; private flashSize = .1;
  private style: SkinEffect | undefined;
  /** Melee swing ribbon: recent tip/heel samples in viewmodel space, faded by age. */
  private trail = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    uniforms: { uStyle: { value: 0 }, uTime: { value: 0 } }, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vCol; varying vec2 vUv; void main(){ vCol = color; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uStyle; uniform float uTime; varying vec3 vCol; varying vec2 vUv;\n${SWING_GLSL}\nvoid main(){ vec3 c = vCol * swingMask(vUv.x, vUv.y, uStyle, uTime); float a = max(max(c.r, c.g), c.b); gl_FragColor = vec4(c / max(a, 1e-3), min(1., a * 1.15)); }`,
  }));
  private trailSamples: { a: THREE.Vector3; b: THREE.Vector3; age: number }[] = [];
  private trailPos = new THREE.BufferAttribute(new Float32Array(TRAIL_VERTS * 3), 3);
  private trailCol = new THREE.BufferAttribute(new Float32Array(TRAIL_VERTS * 3), 3);
  private trailUv = new THREE.BufferAttribute(new Float32Array(TRAIL_VERTS * 2), 2);
  private inspectT = 0;
  private throwT = 0;
  aspect=16/9;
  reloading = 0; // 0..1 progress, set by game
  moving = 0;
  aim = 0;

  constructor() {
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture('star'), color: 0xfff1b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.16);
    this.flash.visible = false;
    this.root.add(this.flash);
    // A hidden casing keeps the shell shader compiled by the loadout warm-up, so the first shot never compiles it.
    const spare = new THREE.Mesh(this.shellGeo, this.shellMat);
    spare.visible = false;
    this.root.add(spare);
    this.trailPos.setUsage(THREE.DynamicDrawUsage); this.trailCol.setUsage(THREE.DynamicDrawUsage);
    const trailIndex: number[] = []; for (let i = 1; i < TRAIL_VERTS / 2; i++) trailIndex.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, i * 2, i * 2 + 1, (i - 1) * 2 + 1);
    this.trail.geometry.setAttribute('position', this.trailPos); this.trail.geometry.setAttribute('color', this.trailCol); this.trail.geometry.setAttribute('uv', this.trailUv); this.trailUv.setUsage(THREE.DynamicDrawUsage); this.trail.geometry.setIndex(trailIndex);
    this.trail.name = 'Viewmodel swing trail'; this.trail.frustumCulled = false; this.trail.renderOrder = 3; this.trail.visible = false; this.root.add(this.trail);
  }

  set(weapon: number, skin: number) {
    const k = `${weapon}:${skin}`;
    if (k === this.key) return;
    this.key = k;
    this.presentation?.dispose();
    const { group, muzzle } = this.presentation = buildGun(weapon, skin, true);
    group.scale.setScalar(weapon === 6 ? .6 : .72);
    this.gun = group;
    this.muzzle = muzzle;
    this.root.add(group);
    this.swap = 1;
    const style=skinEffect(WEAPONS[weapon].skins[skin]?.id);
    this.flash.material.color.setHex(style?.color??0xfff1b0);
    this.flash.material.rotation=style?.particle==='crystal'?Math.PI/4:0;
    // The finish's own muzzle-flash shape and swing style.
    const sig=signatureFx(WEAPONS[weapon].skins[skin]?.id);
    this.flash.material.map=flashTexture(sig?.kind==='gun'?sig.flash:'star');if(sig)this.flash.material.color.setHex(sig.head);
    (this.trail.material as THREE.ShaderMaterial).uniforms.uStyle.value=sig?.kind==='melee'?SWING_STYLES.indexOf(sig.swing):0;this.trailSig=!!sig;
    // Normal blending (reads on white maps); a very pale accent leads with the deeper trim colour.
    const pale=!!sig&&luma(sig.head)>.78&&luma(sig.tail)<luma(sig.head);this.trailMain.setHex(sig?(pale?sig.tail:sig.head):(VIEW_MELEE_COLOR[weapon]??0xffffff));this.trailTail.setHex(sig?(pale?sig.head:sig.tail):0xffffff);
    this.style=style;this.shellMat.color.setHex(style?.secondary??0xe6b55a);this.shellMat.emissive.setHex(style?.color??0x3a2400).multiplyScalar(.18);
    this.trailSamples.length=0;this.inspectT=0;
    this.weapon = weapon; this.meleeHit = 0; this.meleeWindup = 0; this.kick = 0;
  }

  resetMotion() {
    for (const shell of this.shells) this.root.remove(shell.m); this.shells = [];
    this.fx.clear(); this.vfx.clear(); this.trailSamples.length = 0; this.trail.visible = false; this.inspectT = 0;
    this.flash.visible = false; this.flashLife = 0; this.aim = 0; this.meleeHit = 0; this.hitStop = 0; this.meleeWindup = 0;
    this.kick = 0; this.swap = 0; this.stride.reset(); this.sway = [0, 0]; this.reloading = 0; this.moving = 0;
  }

  clear() {
    this.resetMotion();
    this.presentation?.dispose(); this.presentation = null; this.gun = null; this.muzzle = null; this.key = '';
    for (const shell of this.shells) this.root.remove(shell.m); this.shells = [];
    this.flash.visible = false; this.aim = 0; this.meleeHit = 0; this.meleeWindup = 0;
  }

  private updateTrail(dt: number) {
    for (const sample of this.trailSamples) sample.age += dt;
    while (this.trailSamples.length && this.trailSamples[0].age > TRAIL_AGE) this.trailSamples.shift();
    const def = combatArt(WEAPONS[this.weapon]?.id ?? ''), melee = WEAPONS[this.weapon]?.kind === 'melee';
    const ready = meleeWindupProgress(this.meleeWindup, WEAPONS[this.weapon]?.windup ?? 1);
    // Every melee weapon leaves a ribbon; finishes colour it, stock weapons use their own colour.
    if (melee && def && this.gun && (this.meleeHit > .62 || ready > .7)) {
      // Ribbons span across the part that travels: the hammer's head (a chop moves the whole head),
      // the spearhead (a thrust runs along the shaft, so tip-to-heel would have no width).
      const [tip, heel] = this.weapon === 7 ? [[.86, .22, 0], [.86, -.18, 0]] : this.weapon === 6 ? [[1.75, .16, .05], [1.75, -.16, -.05]] : [[1.5, 0, 0], [.55, 0, 0]];
      this.gun.updateMatrixWorld(true);
      const point = (raw: number[]) => this.root.worldToLocal(this.gun!.localToWorld(artPoint(def, raw)));
      this.trailSamples.push({ a: point(tip), b: point(heel), age: 0 });
      if (this.trailSamples.length > TRAIL_SAMPLES) this.trailSamples.shift();
    }
    const n = this.trailSamples.length;
    this.trail.visible = n > 1;
    if (n < 2) return;
    // Catmull-Rom between samples (3 steps each), so a fast swing reads as a smooth arc, not facets.
    const tint = this.trailTint.copy(this.trailMain), pos = this.trailPos.array as Float32Array, col = this.trailCol.array as Float32Array;
    const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
    let v = 0; const steps = 3, total = (n - 1) * steps + 1;
    for (let k = 0; k < total; k++) {
      const seg = Math.min(n - 2, Math.floor(k / steps)), t = k === total - 1 ? 1 : (k - seg * steps) / steps;
      const s0 = this.trailSamples[Math.max(0, seg - 1)], s1 = this.trailSamples[seg], s2 = this.trailSamples[seg + 1], s3 = this.trailSamples[Math.min(n - 1, seg + 2)];
      const age = s1.age + (s2.age - s1.age) * t, along = k / (total - 1);
      // Newest edge is hot and nearly white at the tip; older edge and the heel fade out.
      const fade = Math.max(0, 1 - age / TRAIL_AGE) * Math.sqrt(along) * .85, hot = along * along * .55;
      // Finishes blend from their trim colour at the heel to the accent at the tip.
      const uv = this.trailUv.array as Float32Array;
      for (const [edge, bright] of [['a', 1], ['b', .38]] as const) {
        uv[v * 2] = along; uv[v * 2 + 1] = edge === 'a' ? 1 : 0;
        const base = this.trailSig && edge === 'b' ? this.trailTail : tint;
        pos[v * 3] = cr(s0[edge].x, s1[edge].x, s2[edge].x, s3[edge].x, t); pos[v * 3 + 1] = cr(s0[edge].y, s1[edge].y, s2[edge].y, s3[edge].y, t); pos[v * 3 + 2] = cr(s0[edge].z, s1[edge].z, s2[edge].z, s3[edge].z, t);
        const w = edge === 'a' ? hot : 0;
        col[v * 3] = (base.r + (1 - base.r) * w) * fade * bright; col[v * 3 + 1] = (base.g + (1 - base.g) * w) * fade * bright; col[v * 3 + 2] = (base.b + (1 - base.b) * w) * fade * bright;
        v++;
      }
    }
    this.trailPos.needsUpdate = this.trailCol.needsUpdate = this.trailUv.needsUpdate = true;
    (this.trail.material as THREE.ShaderMaterial).uniforms.uTime.value += dt;
    this.trail.geometry.setDrawRange(0, (total - 1) * 6);
  }
  private trailTint = new THREE.Color(); private trailTail = new THREE.Color(); private trailMain = new THREE.Color(0xffffff); private trailSig = false;

  muzzlePosition() { return this.muzzle?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(0.17, -0.16, -0.7); }

  strike() { this.meleeHit = 1; this.hitStop = 0; this.inspectT = 0; }
  /** Inspect: turn the weapon to show its flank and crown, then return. Any action cancels it. */
  inspect() { if (this.gun && this.swap < .2) { this.inspectT = 2.1; this.presentation?.flare?.(1.2); } }
  get inspecting() { return this.inspectT > 0; }
  /** Off-hand throw: the weapon dips and rolls out of the way, then comes back. */
  throwGesture() { this.throwT = .5; this.inspectT = 0; }
  /** Confirmed melee contact: hold the follow-through pose for a few frames (cosmetic only). */
  contact(seconds: number) { if (this.meleeHit > 0) this.hitStop = seconds; }

  fire() {
    const w = this.weapon;
    if (WEAPONS[w].kind === 'melee') return;
    this.kickMax = w === 1 ? 1.9 : (w === 2 || w === 4) ? 1.4 : 0.85;
    this.kick = this.kickMax;
    this.flash.visible = true; this.flashLife = FLASH_LIFE;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flashSize = (w===1?.15:w===4?.13:.1) * (.85 + Math.random() * .3); this.flash.scale.setScalar(this.flashSize);
    this.flash.material.opacity=this.aim > .5 ? .22 : .55;
    if (isScopedWeapon(w) && this.aim > .5) this.flash.visible = false; // never flash inside the scope image
    this.inspectT = 0;
    const style = this.style;
    if (style && this.muzzle && this.gun && this.aim < .3) {
      // The skin's own particle shape bursts forward off the barrel axis, in viewmodel space.
      const at = this.root.worldToLocal(this.muzzle.getWorldPosition(new THREE.Vector3()));
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.gun.quaternion);
      for (let i = 0, n = w === 1 ? 6 : 4; i < n; i++) this.fx.burst([at.x, at.y, at.z], i % 2 ? style.secondary : style.color, .016 + Math.random() * .012, .07 + Math.random() * .06, 1.2 + Math.random() * .9, style.particle, [dir.x, dir.y, dir.z], 0);
    }
    // A breath of smoke off the muzzle at the hip (never while aiming: it would sit in the sight).
    if (this.muzzle && this.aim < .3 && (w === 1 || w === 4 || Math.random() < .35)) {
      const at = this.root.worldToLocal(this.muzzle.getWorldPosition(new THREE.Vector3()));
      this.vfx.puff([at.x, at.y + .01, at.z], 0xe4e0d8, w === 1 ? .1 : .06, w === 1 ? .7 : .5, w === 1 ? .2 : .13, [.02, 0, -.05], .06);
    }
    if (w !== 1) this.ejectShell();
  }

  /** Spent casing flies out to the right of the gun (viewmodel space). */
  private ejectShell() {
    const m = new THREE.Mesh(this.shellGeo, this.shellMat);
    m.position.set(0.2, -0.13, -0.42);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2);
    this.root.add(m);
    this.shells.push({
      m, life: 0.6,
      v: new THREE.Vector3(0.9 + Math.random() * 0.5, 0.9 + Math.random() * 0.4, 0.15 + Math.random() * 0.2),
      spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20),
    });
  }

  /** Gun lags behind fast mouse turns, like weapon sway in mature FPS games. */
  look(dYaw: number, dPitch: number) {
    this.sway[0] = Math.max(-0.05, Math.min(0.05, this.sway[0] + dYaw * 0.35));
    this.sway[1] = Math.max(-0.05, Math.min(0.05, this.sway[1] + dPitch * 0.35));
  }

  update(dt: number) {
    if (!this.gun) return;
    // fast snap back, then a softer settle: reads as a punchy shot rather than a slide
    this.kick = Math.max(0, this.kick - dt * (this.kick > 0.4 * this.kickMax ? 14 : 6) * this.kickMax);
    this.swap = Math.max(0, this.swap - dt * 5);
    this.stride.update(dt, this.moving);
    const k = 1 - Math.exp(-dt * 10);
    this.sway[0] -= this.sway[0] * k;
    this.sway[1] -= this.sway[1] * k;
    const bobY = Math.sin(this.stride.phase * 2) * 0.006 * this.stride.weight, bobX = Math.cos(this.stride.phase) * 0.008 * this.stride.weight;
    const rel = Math.sin(this.reloading * Math.PI);
    const kick = this.kick;
    const held=firearmIdlePose(this.weapon,this.aspect);
    this.gun.position.set(held.x + bobX - this.sway[0], held.y + bobY - this.swap * 0.2 - rel * 0.1 + this.sway[1] * 0.6 + kick * 0.012, held.z + kick * 0.06);
    this.gun.rotation.set(kick * 0.16 + rel * 0.6, held.yaw + this.sway[0] * 1.5, held.roll + rel * 0.4 - kick * 0.03 + this.sway[0] * 0.8);
    // At full ADS the authored optic axis runs through the centre of the view camera.
    if (this.presentation) {
      const sight = this.presentation.sight;
      this.aimPosition.set(-sight.x * .72, -sight.y * .72, -.34 - sight.z * .72);
      this.gun.position.lerp(this.aimPosition, this.aim);
      this.gun.rotation.x *= 1 - this.aim; this.gun.rotation.y *= 1 - this.aim; this.gun.rotation.z *= 1 - this.aim;
      const melee = WEAPONS[this.weapon].kind === 'melee';
      this.presentation.animate(melee ? Math.max(meleeWindupProgress(this.meleeWindup, WEAPONS[this.weapon].windup ?? 1), this.meleeHit) : kick, this.reloading);
      this.presentation.focus?.(this.aim);
    }
    if (WEAPONS[this.weapon].kind === 'melee') {
      poseMelee(this.gun, this.weapon, meleeWindupProgress(this.meleeWindup, WEAPONS[this.weapon].windup ?? 1), this.meleeHit, true);
      if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dt);
      else this.meleeHit = Math.max(0, this.meleeHit - dt / meleeRecoverySeconds(this.weapon));
    }
    if (this.inspectT > 0) {
      if (this.kick > .01 || this.aim > .05 || this.reloading > 0 || this.meleeHit > 0 || this.meleeWindup > 0 || this.swap > .3) this.inspectT = 0;
      else {
        this.inspectT = Math.max(0, this.inspectT - dt);
        const p = 1 - this.inspectT / 2.1, bell = Math.sin(Math.PI * Math.min(1, p * 1.05)) ** 2, ease = Math.sin(p * Math.PI);
        this.gun.rotation.y += ease * 1.05; this.gun.rotation.z += Math.sin(p * Math.PI * 2) * .32 * bell; this.gun.rotation.x += bell * .18;
        this.gun.position.x -= bell * .09; this.gun.position.y += bell * .05; this.gun.position.z += bell * .05;
      }
    }
    if (this.throwT > 0) {
      this.throwT = Math.max(0, this.throwT - dt);
      const k = Math.sin((1 - this.throwT / .5) * Math.PI);
      this.gun.position.y -= k * .16; this.gun.position.x += k * .05; this.gun.rotation.z -= k * .5; this.gun.rotation.x -= k * .35;
    }
    this.updateTrail(dt);
    this.fx.update(dt); this.vfx.update(dt);
    // Two frames of flash, shrinking, whatever the frame rate.
    if (this.flashLife > 0) {
      this.flashLife = Math.max(0, this.flashLife - dt);
      if (this.flashLife <= 0) this.flash.visible = false;
      else { const k = this.flashLife / FLASH_LIFE; this.flash.scale.setScalar(this.flashSize * (.65 + .35 * k)); }
    }
    this.gun.visible = !(isScopedWeapon(this.weapon) && this.aim > 0.92); // scopes have an unobstructed magnified view
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt;
      sh.v.y -= 6 * dt;
      sh.m.position.addScaledVector(sh.v, dt);
      sh.m.rotation.x += sh.spin.x * dt; sh.m.rotation.y += sh.spin.y * dt; sh.m.rotation.z += sh.spin.z * dt;
      if (sh.life <= 0) { this.root.remove(sh.m); this.shells.splice(i, 1); }
    }
    if (this.muzzle) this.flash.position.copy(this.root.worldToLocal(this.muzzle.getWorldPosition(this.flashPosition)));
  }
}

// ---------- avatar ----------

class Avatar {
  readonly root = new THREE.Group();
  readonly aim: THREE.Group;
  muzzle = new THREE.Object3D();
  readonly char: number;
  readonly team: Team;
  private gunKey = '';
  private gun: THREE.Group | null = null;
  private presentation: GunPresentation | null = null;
  private plate: THREE.Sprite;
  private plateCtx: CanvasRenderingContext2D;
  private plateKey = '';
  private anim: FighterAnimator;
  private motion = new AvatarMotion();
  private weapon = 0;
  private meleeHit = 0;

  constructor(p: PlayerSnap) {
    this.char = p.char;
    this.team = p.team;
    const teamCol = TEAM_COLOR[p.team];
    const rig = buildFighter(p.char, teamCol);
    this.aim = rig.aim;
    this.anim = new FighterAnimator(rig);
    this.root.add(rig.root);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 28), new THREE.MeshBasicMaterial({ color: teamCol, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.root.add(blob, ring);

    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    this.plateCtx = c.getContext('2d')!;
    this.plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, transparent: true }));
    this.plate.scale.set(1.2, 0.3, 1);
    this.plate.position.y = 2.25;
    this.plate.renderOrder = 10;
    this.root.add(this.plate);
  }

  /** Allies' nameplates show through walls; enemies' never do. */
  setAlly(ally: boolean) {
    this.plate.material.depthTest = !ally;
  }
  conceal(hidden: boolean) { this.plate.visible = !hidden; }

  /** Drive the run cycle from how far the interpolated position moved since last frame. */
  strike() { this.meleeHit = 1; }

  resetMotion(crouched = false, grounded = true) {
    this.meleeHit = 0;
    this.motion.reset();
    this.anim.reset(crouched, grounded);
  }

  animate(pos: Vec3, dt: number, crouched = false, meleeWindup = 0, grounded = true, yaw = 0) {
    const motion = this.motion.sample(pos, yaw, dt);
    if (motion.discontinuity) { this.meleeHit = 0; this.anim.reset(crouched, grounded); }
    dt = motionDt(dt);
    this.anim.update(dt, motion.speed, motion.vy, crouched, grounded, motion.forward, motion.strafe);
    this.plate.position.y = crouched ? 1.7 : 2.25;
    if (this.gun && WEAPONS[this.weapon].kind === 'melee') {
      const windup = meleeWindupProgress(meleeWindup, WEAPONS[this.weapon].windup ?? 1);
      poseMelee(this.gun, this.weapon, windup, this.meleeHit, false);
      this.anim.melee(windup, this.meleeHit, this.weapon);
      this.presentation?.animate(Math.max(windup, this.meleeHit), 0); // sculpted rotors speed up through the swing
      this.meleeHit = Math.max(0, this.meleeHit - dt / meleeRecoverySeconds(this.weapon));
    } else { this.anim.melee(0, 0); this.presentation?.animate(0, 0); }
  }

  setWeapon(weapon: number, skin: number) {
    const k = `${weapon}:${skin}`;
    if (k === this.gunKey) return;
    this.gunKey = k; this.weapon = weapon; this.meleeHit = 0;
    this.presentation?.dispose();
    const { group, muzzle } = this.presentation = buildGun(weapon, skin);
    group.position.set(0.16, -0.08, -0.32);
    group.scale.setScalar(1.15);
    this.gun = group;
    this.muzzle = muzzle;
    this.aim.add(group);
  }

  setHp(frac: number, name: string) {
    const k = `${name}:${Math.round(frac * 50)}`;
    if (k === this.plateKey) return;
    this.plateKey = k;
    const g = this.plateCtx;
    g.clearRect(0, 0, 256, 64);
    g.font = 'bold 26px sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#000a';
    g.fillText(name, 129, 29);
    g.fillStyle = '#fff';
    g.fillText(name, 128, 28);
    g.fillStyle = '#0008';
    g.fillRect(48, 40, 160, 12);
    g.fillStyle = '#' + TEAM_COLOR[this.team].toString(16).padStart(6, '0');
    g.fillRect(50, 42, 156 * Math.max(0, frac), 8);
    (this.plate.material.map as THREE.Texture).needsUpdate = true;
  }

  dispose(scene: THREE.Scene) {
    this.presentation?.dispose();
    this.plate.material.map?.dispose(); this.plate.material.dispose();
    scene.remove(this.root);
  }
}

function makeShield(color: number): THREE.Group {
  const g = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(SHIELD.width, SHIELD.height),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  plane.position.y = SHIELD.height / 2;
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(SHIELD.width, SHIELD.height, 6, 4)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
  frame.position.y = SHIELD.height / 2;
  // hex-ish grid lines for the anime barrier look
  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.PlaneGeometry(SHIELD.width, SHIELD.height, 6, 5)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending }),
  );
  grid.position.y = SHIELD.height / 2;
  g.add(plane, frame, grid);
  return g;
}

const FLASH_LIFE = .045, TRAIL_AGE = .2, TRAIL_SAMPLES = 18, TRAIL_VERTS = ((TRAIL_SAMPLES - 1) * 3 + 1) * 2;
const VIEW_MELEE_COLOR: Record<number, number> = { 5: 0x9cf0ff, 6: 0xb6aaff, 7: 0xffb35a };
/** Tracer look per base weapon: slug width (m) and visual speed (m/s). */
const TRACER_PROFILE: Record<number, { width: number; speed: number }> = {
  0: { width: .028, speed: 480 }, 1: { width: .018, speed: 380 }, 2: { width: .034, speed: 650 }, 3: { width: .022, speed: 440 }, 4: { width: .045, speed: 820 },
};
const luma = (c: number) => (.2126 * ((c >> 16) & 255) + .7152 * ((c >> 8) & 255) + .0722 * (c & 255)) / 255;
const gunFx = (id?: string) => { const f = signatureFx(id); return f?.kind === 'gun' ? f as GunFx & { head: number; tail: number } : undefined; };
const meleeFx = (id?: string) => { const f = signatureFx(id); return f?.kind === 'melee' ? f as MeleeFx & { head: number; tail: number } : undefined; };
/** Stock melee colours (finishes use their own accent). */
const MELEE_COLOR: Record<number, number> = { 5: 0x9cf0ff, 6: 0xb6aaff, 7: 0xffb35a };
function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffffff');
  grad.addColorStop(0.3, '#ffffffaa');
  grad.addColorStop(1, '#ffffff00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- ambient particles (petals at dusk, dust motes at noon, embers at night) ----------

class Particles {
  private points: THREE.Points;
  private vel: Float32Array;
  private phase: Float32Array;
  private readonly n: number;
  private readonly box = [26, 12, 26];

  constructor(private kind: 'petals' | 'motes' | 'embers' | 'snow', tex: THREE.Texture, scene: THREE.Scene, quality:GraphicsQuality) {
    this.n = Math.round((kind === 'petals' ? 420 : kind === 'embers' ? 360 : kind === 'snow' ? 900 : 220)*(quality==='low'?.35:1));
    const pos = new Float32Array(this.n * 3);
    this.vel = new Float32Array(this.n * 3);
    this.phase = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2 * this.box[0];
      pos[i * 3 + 1] = Math.random() * this.box[1];
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * this.box[2];
      this.phase[i] = Math.random() * 10;
      const fall = kind === 'petals' ? -(0.5 + Math.random() * 0.6) : kind === 'snow' ? -(0.7 + Math.random() * 0.7) : kind === 'embers' ? 0.25 + Math.random() * 0.4 : (Math.random() - 0.5) * 0.15;
      this.vel.set([0.6 + Math.random() * 0.5, fall, 0.2 + Math.random() * 0.3], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = kind === 'petals' ? 0xffb7cf : kind === 'snow' ? 0xf4f8ff : kind === 'embers' ? 0x7ff6ff : 0xfff1c4;
    const mat = new THREE.PointsMaterial({
      color, map: tex, alphaMap: tex, alphaTest: 0.02, size: kind === 'petals' ? 0.16 : kind === 'snow' ? 0.1 : kind === 'embers' ? 0.12 : 0.08,
      transparent: true, depthWrite: false,
      blending: kind === 'petals' || kind === 'snow' ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: kind === 'motes' ? 0.55 : 0.95,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt: number, around: THREE.Vector3) {
    const p = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const [bx, by, bz] = this.box;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      this.phase[i] += dt;
      const sway = Math.sin(this.phase[i] * 1.7) * (this.kind === 'petals' ? 0.9 : this.kind === 'snow' ? 0.4 : 0.25);
      a[k] += (this.vel[k] + sway) * dt;
      a[k + 1] += this.vel[k + 1] * dt;
      a[k + 2] += (this.vel[k + 2] + Math.cos(this.phase[i] * 1.3) * 0.3) * dt;
      // keep the cloud centred on the camera so it is always around the player
      if (a[k] - around.x > bx) a[k] -= 2 * bx; else if (a[k] - around.x < -bx) a[k] += 2 * bx;
      if (a[k + 2] - around.z > bz) a[k + 2] -= 2 * bz; else if (a[k + 2] - around.z < -bz) a[k + 2] += 2 * bz;
      if (a[k + 1] < 0) a[k + 1] += by; else if (a[k + 1] > by) a[k + 1] -= by;
    }
    p.needsUpdate = true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
