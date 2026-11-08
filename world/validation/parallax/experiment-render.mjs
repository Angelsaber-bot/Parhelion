/** Actual decoded Kyoto asset + production toon materials. Cropped inspection
 * scene; no substitute geometry, texture generation or gameplay/FPS claim. */
import { chromium } from '/Users/lejiazhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out=fileURLToPath(new URL('.',import.meta.url));await mkdir(out,{recursive:true});
const html=`<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}</style></head><body><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import {createParallaxGarden} from '/src/environment/parallaxGarden.ts';
import {beginParallaxExperiment,turnParallaxRing} from '/src/story/parallaxSurvey.ts';
import {toonMaterial,cloudShadowUniform} from '/src/rendering/look.ts';
cloudShadowUniform.value=0;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.setClearColor('#c3c7be');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e3eef4','#596a52',1.5));const sun=new THREE.DirectionalLight('#fff0cf',2);sun.position.set(-20,45,15);scene.add(sun);
const camera=new THREE.PerspectiveCamera(48,1280/800,.1,200);const garden=createParallaxGarden(()=>10);scene.add(garden.root);const done=new Set();beginParallaxExperiment(done);
let triangles=0;garden.root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
window.review={tune:()=>{turnParallaxRing(done,'near');turnParallaxRing(done,'far');turnParallaxRing(done,'far');garden.apply(done);},draw:(eye,target)=>{camera.position.fromArray(eye);camera.lookAt(...target);renderer.render(scene,camera);},triangles};await renderer.compileAsync(scene,camera);garden.apply(done);window.review.draw([-118,11.62,284],[-118,12.6,269]);window.review.ready=true;
</script></body></html>`;
const browser=await chromium.launch({headless:true,executablePath:'/Users/lejiazhang/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
try{
 await page.route('**/parallax-experiment-review',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('http://127.0.0.1:5173/parallax-experiment-review');await page.waitForFunction(()=>window.review?.ready,null,{timeout:90000});
 const cameras={front:{eye:[-118,11.62,284],target:[-118,12.6,269]},side:{eye:[-104,11.62,284],target:[-118,12.6,269]}};
 for(const stage of ['before','after']){if(stage==='after')await page.evaluate(()=>window.review.tune());for(const[name,c]of Object.entries(cameras)){await page.evaluate(c=>window.review.draw(c.eye,c.target),c);await page.screenshot({path:out+stage+'-'+name+'.png'});}}
 const result={method:'Production garden component and actual state transitions, neutral component inspection at campus height10; Chromium WebGL / SwiftShader',errors,consoleErrors,cameras,triangles:await page.evaluate(()=>window.review.triangles),limitation:'Not a full running-world screenshot or frame-rate measurement.'};await writeFile(out+'experiment-evidence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
