import {it,expect,vi,afterEach} from 'vitest';
import {FrameGate} from '../src/renderScheduling.ts';
afterEach(()=>vi.unstubAllGlobals());
import * as THREE from 'three';
import {graphicsPixelRatio,initialGraphics} from '../src/graphics.ts';
import {renderHeldWeapon,lightWeaponScene} from '../src/weaponLighting.ts';
import {ArenaScene} from '../src/scene.ts';
import {WEAPONS} from '../shared/content.ts';
import {refineWeaponMaterial,WEAPON_SURFACES} from '../src/weaponSurface.ts';

it('detailed rendering has bounded supersampling; default smooth stays at CSS resolution',()=>{
 expect(graphicsPixelRatio('high',2,1280,720)).toBe(1.25);expect(graphicsPixelRatio('low',2,1280,720)).toBe(1);
 for(const q of ['high','low']as const)for(const dpr of [.5,1,1.25,2,3,NaN,Infinity])for(const size of [[1280,720],[3840,2160],[8000,5000],[0,0]]){const ratio=graphicsPixelRatio(q,dpr,...size as[number,number]);expect(Number.isFinite(ratio)).toBe(true);expect(ratio).toBeGreaterThanOrEqual(1);expect(ratio).toBeLessThanOrEqual(1.25);}
 expect(graphicsPixelRatio('high',2,3840,2160)).toBe(1);
});
it('only an explicit current preference enables postprocessing; old/corrupt/missing storage defaults to smooth',()=>{
 const store=(value:string|null)=>({getItem:()=>value,setItem(){}});
 expect(initialGraphics(new URLSearchParams('low'),store('high'))).toBe('low');expect(initialGraphics(new URLSearchParams(),store('low'))).toBe('low');
 expect(initialGraphics(new URLSearchParams(),store('high'))).toBe('high');for(const value of ['garbage',null])expect(initialGraphics(new URLSearchParams(),store(value))).toBe('low');
 expect(initialGraphics(new URLSearchParams(),{getItem(){throw Error('denied')},setItem(){}})).toBe('low');
 expect(initialGraphics(new URLSearchParams(),{getItem:key=>key==='parhelion-arena-graphics-v1'?'high':null,setItem(){}})).toBe('low');
});
it('world exposure never washes out held weapons, and is restored even after a failed draw',()=>{
 const seen:number[]=[],renderer={toneMappingExposure:1.7,clearDepth(){},render(){seen.push(this.toneMappingExposure);}};
 renderHeldWeapon(renderer as unknown as THREE.WebGLRenderer,new THREE.Scene(),new THREE.Camera());expect(seen).toEqual([.98]);expect(renderer.toneMappingExposure).toBe(1.7);
 renderer.render=()=>{throw Error('draw failed')};expect(()=>renderHeldWeapon(renderer as unknown as THREE.WebGLRenderer,new THREE.Scene(),new THREE.Camera())).toThrow('draw failed');expect(renderer.toneMappingExposure).toBe(1.7);
});
it('ordinary combat frames never silently resize the renderer',()=>{
 let resizes=0;const renderer={toneMappingExposure:1,clear(){},clearDepth(){},render(){},setPixelRatio(){resizes++;}};
 const state={renderer,scene:new THREE.Scene(),camera:new THREE.Camera(),vmScene:new THREE.Scene(),vmCamera:new THREE.Camera(),composer:null,chapterEffects:null};
 for(let i=0;i<600;i++)ArenaScene.prototype.render.call(state as unknown as ArenaScene,true);expect(resizes).toBe(0);expect(renderer.toneMappingExposure).toBe(1);
});
it('workshop and held weapons share directional highlight and rim lighting',()=>{
 const a=new THREE.Scene(),b=new THREE.Scene();lightWeaponScene(a);lightWeaponScene(b);
 expect(a.environmentIntensity).toBe(.85);expect(a.children.map(o=>o.toJSON().object.type)).toEqual(b.children.map(o=>o.toJSON().object.type));
 expect(a.children.filter(o=>o instanceof THREE.DirectionalLight)).toHaveLength(3);
});
it('all sixteen identities have distinct close-up surfaces that compose with their existing shader',()=>{
 const ids=WEAPONS.flatMap(w=>w.skins.map(s=>s.id));expect(Object.keys(WEAPON_SURFACES).sort()).toEqual([...ids].sort());
 for(const id of ids as Array<keyof typeof WEAPON_SURFACES>){
  const material=new THREE.MeshPhysicalMaterial({roughness:.32});let calls=0;material.onBeforeCompile=()=>{calls++;};refineWeaponMaterial(material,id,'coat');refineWeaponMaterial(material,id,'coat');
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};
  material.onBeforeCompile(shader as any,{}as any);expect(calls).toBe(1);expect(shader.fragmentShader).toContain('phDetailFade');expect(shader.fragmentShader).toContain('roughnessFactor=clamp');expect(shader.fragmentShader).not.toContain('undefined');expect(shader.fragmentShader).not.toContain('NaN');expect(material.userData.surfaceRefinement.skin).toBe(id);material.dispose();
 }
});

it('covered and background arenas submit no GPU work; closing the modal resumes the existing scene',()=>{
 let draws=0,overlay='armory-dialog';const doc={visibilityState:'visible',getElementById:(id:string)=>id===overlay?{open:true}:null};vi.stubGlobal('document',doc);
 const renderer={toneMappingExposure:1,clear(){draws++;},clearDepth(){},render(){}};
 const state={renderer,scene:new THREE.Scene(),camera:new THREE.Camera(),vmScene:new THREE.Scene(),vmCamera:new THREE.Camera(),composer:null,chapterEffects:null};
 for(const id of ['armory-dialog','arena-settings']){overlay=id;for(let i=0;i<60;i++)ArenaScene.prototype.render.call(state as unknown as ArenaScene,true);}
 expect(draws).toBe(0);overlay='';ArenaScene.prototype.render.call(state as unknown as ArenaScene,true);expect(draws).toBe(1);doc.visibilityState='hidden';ArenaScene.prototype.render.call(state as unknown as ArenaScene,true);expect(draws).toBe(1);
});
it('noncombat rendering caps work without a catch-up burst after a stalled frame',()=>{
 for(const fps of [10,24,30]){const gate=new FrameGate(fps);let count=0;for(let i=0;i<120;i++)if(gate.allow(i*1000/120))count++;expect(count).toBeLessThanOrEqual(fps);expect(count).toBeGreaterThanOrEqual(fps-1);expect(gate.allow(5000)).toBe(true);expect(gate.allow(5000)).toBe(false);}
});
