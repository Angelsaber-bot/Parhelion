import type {WebGLRenderer} from 'three';

/** Explicit, silent QA readout. Never mounted in ordinary play. */
export function renderTelemetry(renderer:WebGLRenderer){
 if(!new URLSearchParams(location.search).has('perf'))return null;
 const output=document.createElement('output');output.id='arena-perf';output.setAttribute('data-i18n-ignore','');
 output.style.cssText='position:fixed;left:12px;top:110px;z-index:20000;background:#101824e8;color:#fff;padding:8px;font:12px monospace;pointer-events:none';
 output.textContent='FPS · warming up';document.body.append(output);
 let last=0,next=0;const frames:number[]=[],cpu:number[]=[];
 return {pause(){last=0;},begin(){return performance.now();},end(start:number){
  const now=performance.now();
  if(document.visibilityState==='hidden'){last=0;return;}
  if(last){frames.push(now-last);cpu.push(now-start);if(frames.length>240){frames.shift();cpu.shift();}}
  last=now;if(now<next||frames.length<20)return;next=now+1000;
  const sorted=[...frames].sort((a,b)=>a-b),mean=frames.reduce((a,b)=>a+b,0)/frames.length;
  const fps=1000/mean,p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],render=cpu.reduce((a,b)=>a+b,0)/cpu.length;
  output.dataset.fps=fps.toFixed(1);output.dataset.p95=p95.toFixed(1);output.dataset.samples=String(frames.length);output.dataset.renderMs=render.toFixed(2);
  output.textContent=`FPS ${fps.toFixed(1)} · P95 ${p95.toFixed(1)} ms · CPU render ${render.toFixed(2)} ms · ${frames.length} frames · ${renderer.domElement.width}×${renderer.domElement.height}`;
 }};
}
