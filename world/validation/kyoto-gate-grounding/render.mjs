/** Actual decoded Kyoto asset + production toon materials. Cropped inspection
 * scene; no substitute geometry, texture generation or gameplay/FPS claim. */
import { chromium } from '/Users/lejiazhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out=fileURLToPath(new URL('.',import.meta.url));await mkdir(out,{recursive:true});
const html=`<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}</style></head><body><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import {regionLoader,bakeQuantized} from '/src/rendering/glb.ts';
import {toonMaterial,cloudShadowUniform} from '/src/rendering/look.ts';
cloudShadowUniform.value=0;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.setClearColor('#c3c7be');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e3eef4','#596a52',1.5));const sun=new THREE.DirectionalLight('#fff0cf',2);sun.position.set(-20,45,15);scene.add(sun);
const camera=new THREE.PerspectiveCamera(48,1280/800,.1,200);const gltf=await regionLoader().loadAsync('/assets/world_kyoto.glb');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
let triangles=0;for(const name of['Terrain','Higashiyama','Kyoto_RoofCraft','Kyoto_Hillside_Foundations','Glow_Props']){
 const source=gltf.scene.getObjectByName(name),g=source.geometry;const indices=g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i),keep=[];const p=g.attributes.position;
 for(let i=0;i<indices.length;i+=3){let x=0,z=0;for(let j=0;j<3;j++){x+=p.getX(indices[i+j]);z+=p.getZ(indices[i+j]);}x/=3;z/=3;if(x>=195&&x<=228&&z>=-36&&z<=-5)keep.push(indices[i],indices[i+1],indices[i+2]);}
 if(!keep.length)continue;const crop=new THREE.BufferGeometry();for(const[name,a]of Object.entries(g.attributes)){const values=[];for(const index of keep)for(let c=0;c<a.itemSize;c++)values.push(a.getComponent(index,c));crop.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));}
 const mesh=new THREE.Mesh(crop,toonMaterial(source.material));mesh.name=source.name;mesh.applyMatrix4(source.matrixWorld);scene.add(mesh);triangles+=keep.length/3;
}
window.review={draw:(eye,target)=>{camera.position.fromArray(eye);camera.lookAt(...target);renderer.render(scene,camera);},triangles};await renderer.compileAsync(scene,camera);window.review.draw([198,10.1,-29],[212,11,-20]);window.review.ready=true;
</script></body></html>`;
const browser=await chromium.launch({headless:true,executablePath:'/Users/lejiazhang/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
try{
 await page.route('**/yasaka-gate-review',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('http://127.0.0.1:5173/yasaka-gate-review');await page.waitForFunction(()=>window.review?.ready,null,{timeout:90000});
 const cameras={gate:{eye:[198,10.1,-29],target:[212,11,-20]},footing:{eye:[205,8.8,-12.5],target:[210.2,7.9,-15.5]}};
 for(const[name,c]of Object.entries(cameras)){await page.evaluate(c=>window.review.draw(c.eye,c.target),c);await page.screenshot({path:out+name+'.png'});}
 const result={method:'Actual production Kyoto GLB cropped around Yasaka, production toon materials, neutral inspection lights; Chromium WebGL / SwiftShader',errors,consoleErrors,cameras,triangles:await page.evaluate(()=>window.review.triangles),limitation:'Not a full running-world screenshot or frame-rate measurement.'};await writeFile(out+'render-evidence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
