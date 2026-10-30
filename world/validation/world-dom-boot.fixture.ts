/** NON-GPU integration harness. Runs the production main module, real index DOM,
 * actual GLBs/BVHs/state and event handlers. Renderer/PMREM/Canvas2D are explicit
 * no-op adapters, and image bitmaps are 1×1 placeholders: this establishes neither
 * visual/texture correctness nor WebGL/FPS.
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';

const require=createRequire(import.meta.url);
class NoGpuRenderer {
  domElement:HTMLCanvasElement;shadowMap={enabled:false,type:0};info={autoReset:true,render:{calls:0,triangles:0},reset(){}};
  toneMapping=0;toneMappingExposure=1;private ratio=1;private size=new THREE.Vector2();
  constructor(options:{canvas:HTMLCanvasElement}){this.domElement=options.canvas;}
  setPixelRatio(value:number){this.ratio=value;}getPixelRatio(){return this.ratio;}
  setSize(x:number,y:number){this.size.set(x,y);}getSize(out:THREE.Vector2){return out.copy(this.size);}
  render(scene:THREE.Scene,camera:THREE.Camera){scene.updateMatrixWorld();camera.updateMatrixWorld();}
  dispose(){}
}
class NoGpuPMREM {constructor(_renderer:unknown){}fromScene(){return{texture:new THREE.Texture(),dispose(){}};}dispose(){}}
export async function bootWorldWithoutGpu(options: { worldRoot?: string; deterministic?: boolean } = {}) {
  const world = options.worldRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const html=await readFile(resolve(world,'index.html'),'utf8');
  const dom=new JSDOM(html,{url:'http://world.test/?nopost&q=low',pretendToBeVisual:true,runScripts:'outside-only'}),window=dom.window;
  const errors:unknown[][]=[],warnings:unknown[][]=[],frames:FrameRequestCallback[]=[];
  let simulatedNow=0;
  if(options.deterministic){
    Object.defineProperty(window.performance,'now',{value:()=>simulatedNow});
    let seed=0x12345678;window.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  }
  const manager=THREE.DefaultLoadingManager,start=manager.itemStart.bind(manager),end=manager.itemEnd.bind(manager);let pendingLoads=0;
  manager.itemStart=(url:string)=>{pendingLoads++;start(url);};manager.itemEnd=(url:string)=>{pendingLoads--;end(url);};
  window.console.error=(...args:unknown[])=>errors.push(args);window.console.warn=(...args:unknown[])=>warnings.push(args);
  window.addEventListener('error',event=>errors.push([event.error??event.message]));
  const globals=new Map<string,PropertyDescriptor|undefined>();
  const NativeRequest=Request,nativeFetch=fetch;
  const placeholderBitmap=async()=>({width:1,height:1,close(){}});
  class BrowserRequest extends NativeRequest {constructor(input:RequestInfo|URL,init?:RequestInit){super(typeof input==='string'?new URL(input,'http://world.test/').href:input,init);}}
  const inject=(key:string,value:unknown)=>{globals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
  const fetchAsset:typeof fetch=async(input)=>{
    const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    const url=new URL(raw,'http://world.test/');let path:string;
    if(url.protocol==='blob:')return nativeFetch(url);
    if(url.protocol==='file:')path=fileURLToPath(url);
    else if(url.origin==='http://world.test')path=resolve(world,'public',url.pathname.replace(/^\//,''));
    else throw new Error(`No external asset access in boot smoke: ${url.href}`);
    if(!path.startsWith(resolve(world,'..')+'/'))throw new Error(`Asset outside repository: ${path}`);
    const bytes=await readFile(path);return new Response(bytes,{status:200,headers:{'Content-Length':String(bytes.length),'Content-Type':path.endsWith('.json')?'application/json':'application/octet-stream'}});
  };
  for(const [key,value]of Object.entries({window,document:window.document,self:window,navigator:window.navigator,ProgressEvent:window.ProgressEvent,fetch:fetchAsset,Request:BrowserRequest,createImageBitmap:placeholderBitmap}))inject(key,value);
  Object.defineProperty(window.document,'hasFocus',{value:()=>true});
  Object.defineProperty(window.document,'pointerLockElement',{value:null,writable:true,configurable:true});
  window.HTMLCanvasElement.prototype.requestPointerLock=function(){Object.defineProperty(window.document,'pointerLockElement',{value:this,writable:true,configurable:true});window.document.dispatchEvent(new window.Event('pointerlockchange'));return Promise.resolve();};
  window.document.exitPointerLock=()=>{Object.defineProperty(window.document,'pointerLockElement',{value:null,writable:true,configurable:true});window.document.dispatchEvent(new window.Event('pointerlockchange'));};
  // jsdom has no native dialog top layer or pointer-lock permission UI. Model the
  // documented state/events only; browser focus/inert/permission behavior is untested.
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector<HTMLElement>('button')?.focus();};
  window.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;this.dispatchEvent(new window.Event('close'));};
  window.HTMLCanvasElement.prototype.getContext=function(type:string){
    if(type!=='2d')throw new Error('The non-GPU harness must not create a graphics context');
    const canvas=this;return new Proxy({canvas,createImageData:(w:number,h:number)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),measureText:(text:string)=>({width:text.length*8}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?Reflect.get(target,key):()=>{}});
  } as typeof window.HTMLCanvasElement.prototype.getContext;
  window.requestAnimationFrame=(callback:FrameRequestCallback)=>{frames.push(callback);return frames.length;};window.cancelAnimationFrame=()=>{};
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}}) as unknown as MediaQueryList;
  // External Three loaders and bundled app code must use the same typed-array realm,
  // just as they do in the browser; otherwise mergeGeometries rejects equal formats.
  Object.assign(window,{Float32Array,Float64Array,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,ArrayBuffer,DataView,
    URL,Blob,DecompressionStream,createImageBitmap:placeholderBitmap,fetch:fetchAsset,Request,Response,TextDecoder,TextEncoder,require:(id:string)=>id==='three'?{...THREE,WebGLRenderer:NoGpuRenderer,PMREMGenerator:NoGpuPMREM}:require(id)});
  let closed=false;
  const close=async()=>{if(closed)return;closed=true;window.dispatchEvent(new window.PageTransitionEvent('pagehide',{persisted:false}));const deadline=Date.now()+10000;while(pendingLoads>0&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));await new Promise(r=>setTimeout(r,20));dom.window.close();manager.itemStart=start;manager.itemEnd=end;for(const[key,value]of globals){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}};
  try{
    const bundle=await build({entryPoints:[resolve(world,'src/main.ts')],bundle:true,write:false,platform:'node',format:'cjs',external:['three','three/*','three-mesh-bvh'],loader:{'.css':'empty'},plugins:[{name:'real-module-urls',setup(plugin){plugin.onLoad({filter:/\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replaceAll('import.meta.url',JSON.stringify(pathToFileURL(args.path).href)),loader:'ts'}));}}]});
    window.eval(bundle.outputFiles[0].text);
    const deadline=Date.now()+60000;
    while(!(window as any).__world?.ready&&!errors.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
    if(!(window as any).__world?.ready)throw new Error(`Production boot did not become ready: ${errors.map(args=>args.map(String).join(' ')).join('\n')||'60 second timeout'}`);
    // `ready` intentionally does not block play on optional blade/enemy art. Give
    // those real asynchronous file loads their event-loop turns before action QA.
    const assetDeadline=Date.now()+10000;while(pendingLoads>0&&Date.now()<assetDeadline)await new Promise(r=>setTimeout(r,10));
    if(pendingLoads>0)throw new Error(`Optional asset loads did not settle: ${pendingLoads}`);
    await new Promise(r=>setTimeout(r,20));
    return{window,world:(window as any).__world,errors,warnings,
      async snapshot(title:string){
        const clone=window.document.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script,link').forEach(node=>node.remove());
        clone.querySelectorAll('[src]').forEach(node=>node.removeAttribute('src'));
        for(const input of window.document.querySelectorAll<HTMLInputElement>('input[id]')){
          const copy=clone.querySelector<HTMLInputElement>(`#${input.id}`);if(!copy)continue;copy.setAttribute('value',input.value);if(input.checked)copy.setAttribute('checked','');else copy.removeAttribute('checked');
        }
        const head=clone.querySelector('head')!;
        const css=await Promise.all(['src/actions.css','src/combat.css','src/servant.css','../shared-client/settings.css'].map(path=>readFile(resolve(world,path),'utf8')));
        const style=window.document.createElement('style');style.textContent=css.join('\n')+'\n#view{background:linear-gradient(145deg,#27343a,#39453b 50%,#1c2937)}.qa-placeholder{position:fixed;left:50%;top:45%;transform:translate(-50%,-50%);color:#d3dfda70;text-align:center;pointer-events:none;font:14px system-ui;z-index:0}.qa-label{position:fixed;bottom:3px;left:8px;z-index:99999;font:10px system-ui;color:#eef3ee;background:#111c;padding:2px 5px;pointer-events:none}';head.append(style);
        const csp=window.document.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; style-src 'unsafe-inline'; img-src data:";head.append(csp);
        const notice=window.document.createElement('div');notice.className='qa-label';notice.textContent=`${title} · Synthetic QA progress · DOM/CSS only, no WebGL render`;clone.querySelector('body')!.append(notice);
        const placeholder=window.document.createElement('div');placeholder.className='qa-placeholder';placeholder.textContent='3D scene intentionally absent — UI layout review';clone.querySelector('body')!.append(placeholder);
        return '<!doctype html>\n'+clone.outerHTML;
      },
      frame(now=1000){simulatedNow=now;const callback=frames.shift();if(!callback)throw new Error('No scheduled production frame');callback(now);},close};
  }catch(error){await close();throw error;}
}
