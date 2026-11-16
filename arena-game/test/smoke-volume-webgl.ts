/** Browser GPU regression fixture. Bundle with esbuild and serve on the local review site.
 * Pixel assertions run against real depth textures, both render chains and moving cameras.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SmokeVolumePass } from '../src/rendering/smokeVolume.ts';
import { OutlinePass } from '../src/rendering/outline.ts';
import { buildFighter, FighterAnimator } from '../src/player/fighter.ts';
import type { Smoke } from '../shared/grenade.ts';

const log = document.createElement('pre'); document.body.append(log);
const report = (text: string) => { log.textContent += text+'\n'; };
const check = (condition: boolean, text: string) => { if (!condition) throw Error(text); report('PASS '+text); };
const size = 192;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(size,size); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
document.body.append(renderer.domElement);
renderer.debug.onShaderError = (_gl, _program, _vertex, fragment) => {
  throw Error('Smoke shader compilation failed: '+renderer.getContext().getShaderInfoLog(fragment));
};
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x182535);
scene.add(new THREE.HemisphereLight(0xffffff,0x777777,3));
const camera = new THREE.PerspectiveCamera(60,1,.15,80);
const target = new THREE.Mesh(new THREE.BoxGeometry(1.6,2.4,.5),new THREE.MeshBasicMaterial({color:0xff0010}));
target.position.set(0,1.3,0); scene.add(target);
const cloud: Smoke = { id: 1, owner: 'test', x: 0, y: 0, z: 5, life: 200 };
const pixel = new Uint8Array(4);
let composer: EffectComposer, smoke: SmokeVolumePass;
const configure = (high: boolean) => {
  composer?.passes.forEach(p=>p.dispose()); composer?.dispose();
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(size,size)}));
  composer.addPass(new RenderPass(scene,camera));
  if(high) composer.addPass(new OutlinePass(camera));
  smoke = new SmokeVolumePass(camera); composer.addPass(smoke);
  if(high) composer.addPass(new UnrealBloomPass(new THREE.Vector2(size,size),.2,.55,.85));
  composer.addPass(new OutputPass());
  const fxaa = new ShaderPass(FXAAShader); fxaa.uniforms.resolution.value.set(1/size,1/size); composer.addPass(fxaa);
};
function render(smokes: Smoke[], eye = [0,1.3,14], at = [0,1.3,0]) {
  camera.position.set(...eye as [number,number,number]); camera.lookAt(...at as [number,number,number]);
  smoke.sync(smokes,0); composer.render();
  const gl=renderer.getContext(); gl.readPixels(size/2,size/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  checkGL(); return Array.from(pixel).slice(0,3);
}
function checkGL() { const gl=renderer.getContext(), error=gl.getError(); if(error!==gl.NO_ERROR) throw Error('WebGL error '+error); }
const difference = (a: number[],b: number[]) => Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const shot = (title: string) => {
  const f = document.createElement('figure'), img = document.createElement('img'), cap=document.createElement('figcaption');
  img.src=renderer.domElement.toDataURL(); cap.textContent=title; f.append(img,cap); document.body.append(f);
};
try {
  for(const high of [false,true]) {
    configure(high); const mode=high?'high':'low';
    target.visible=true; target.position.set(0,1.3,0);
    const open=render([]), behind=render([cloud]);
    check(open[0]>open[1]+100, mode+' unobscured character');
    check(behind[1]>behind[0]-20, mode+' dense smoke conceals character');
    shot(mode+' behind smoke');
    target.visible=false; const empty=render([cloud]); target.visible=true;
    check(difference(behind,empty)<=2, mode+' no silhouette through dense smoke');
    target.position.z=12;
    check(difference(render([]),render([cloud]))<=2,mode+' character in front of smoke remains visible');
    target.position.z=0;
    const inside=render([cloud],[0,1.3,5]); target.visible=false;
    check(difference(inside,render([cloud],[0,1.3,5]))<=2,mode+' camera inside smoke has no silhouette'); target.visible=true;
    const box={...cloud,box:{width:4,height:2.4,depth:1.2,yaw:Math.PI/4}};
    const curtain=render([box]); target.visible=false;
    check(difference(curtain,render([box]))<=2,mode+' rotated black-sail curtain occludes'); target.visible=true;
    check(difference(open,render([{...box,delay:1}]))<=2,mode+' pending curtain does not prematurely obscure');
    const many=Array.from({length:19},(_,id)=>({...cloud,id,x:(id-9)*.05}));
    const overlap=render(many); target.visible=false;
    check(difference(overlap,render(many))<=2,mode+' overlapping clouds conceal without capacity cutoff'); target.visible=true;
    const forward: number[][]=[];
    for(let i=0;i<=80;i++)forward.push(render([cloud],[3.8+i*.02,1.3,14],[3.8+i*.02,1.3,0]));
    let jump=0;
    for(let i=1;i<forward.length;i++)jump=Math.max(jump,difference(forward[i],forward[i-1]));
    check(jump<16,mode+' smooth smoke edge: maximum 2 cm step = '+jump+'/255');
    let reversal=0;
    for(let i=80;i>=0;i--)reversal=Math.max(reversal,difference(forward[i],render([cloud],[3.8+i*.02,1.3,14],[3.8+i*.02,1.3,0])));
    check(reversal<5,mode+' forward/reverse boundary stable: '+reversal+'/255');
    const through: number[][]=[]; target.position.z=-6;
    for(let i=0;i<=160;i++)through.push(render([cloud],[0,1.3,12-i*.1],[0,1.3,-10]));
    jump=0;for(let i=1;i<through.length;i++)jump=Math.max(jump,difference(through[i],through[i-1]));
    check(jump<32,mode+' walking through volume: maximum 10 cm step = '+jump+'/255');
    target.position.z=0;
    for (const fov of [20,78,100]) {camera.fov=fov;camera.aspect=1.7;camera.updateProjectionMatrix();render([cloud]);}
    camera.fov=60;camera.aspect=1;camera.updateProjectionMatrix();
    check(difference(open,render([]))<=2,mode+' smoke expiry restores original image');
  }
  target.visible=false;
  const fighter=buildFighter(1,0xf09a4a), anim=new FighterAnimator(fighter);
  scene.add(fighter.root);fighter.root.position.set(0,0,10.6);anim.update(1/60,3,0,false,true,3,0);
  render([cloud],[0,1.3,14],[0,1.1,7]);shot('Character at smoke edge');
  fighter.root.position.z=3;render([cloud]);shot('Character inside smoke');
  report('ALL GPU CHECKS PASSED');
} catch(error) { report('FAIL '+String(error)); document.title='FAIL smoke GPU review'; throw error; }
