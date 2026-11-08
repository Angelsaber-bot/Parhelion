/** Shipped Alpha bridge, terrain and water only. Cropped geometry and production
 * materials provide a local visual check; this does not measure game frame rate. */
import { chromium } from '/Users/lejiazhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('.', import.meta.url));
await mkdir(out, { recursive: true });
const html = `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}</style></head><body><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import {regionLoader,bakeQuantized} from '/src/rendering/glb.ts';
import {toonMaterial,cloudShadowUniform} from '/src/rendering/look.ts';
cloudShadowUniform.value=0;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.setClearColor('#c5d4d6');
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e3eef4','#596a52',1.3));
const sun=new THREE.DirectionalLight('#fff0cf',1.9);sun.position.set(60,55,-4);scene.add(sun);
const camera=new THREE.PerspectiveCamera(52,1280/800,.06,200);
const gltf=await regionLoader().loadAsync('/assets/world_alpha.glb');bakeQuantized(gltf.scene);gltf.scene.updateMatrixWorld(true);
const center=[81,-36],axis=new THREE.Vector2(-.301131,-.953583).normalize(),side=new THREE.Vector2(axis.y,-axis.x);
const point=(s,t,y)=>[center[0]+axis.x*s+side.x*t,y,center[1]+axis.y*s+side.y*t];
let triangles=0;const sourceNames=[];
for(const name of ['Crossings','Terrain','Water']){
 const source=gltf.scene.getObjectByName(name);if(!source?.isMesh)throw Error('Missing production mesh '+name);
 const g=source.geometry,p=g.attributes.position,indices=g.index?.array??Array.from({length:p.count},(_,i)=>i),keep=[];
 const world=new THREE.Vector3();
 for(let i=0;i<indices.length;i+=3){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(let j=0;j<3;j++){world.fromBufferAttribute(p,indices[i+j]).applyMatrix4(source.matrixWorld);minX=Math.min(minX,world.x);maxX=Math.max(maxX,world.x);minZ=Math.min(minZ,world.z);maxZ=Math.max(maxZ,world.z);}
  // Water uses broad triangles: retain any triangle that overlaps the crop,
  // rather than dropping a surface because its centroid lies beyond the view.
  if(maxX>=center[0]-42&&minX<=center[0]+42&&maxZ>=center[1]-42&&minZ<=center[1]+42)keep.push(indices[i],indices[i+1],indices[i+2]);
 }
 if(!keep.length)throw Error('Empty bridge-area crop '+name);
 const crop=new THREE.BufferGeometry();
 for(const[name,a]of Object.entries(g.attributes)){const values=[];for(const index of keep)for(let c=0;c<a.itemSize;c++)values.push(a.getComponent(index,c));crop.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));}
 const mesh=new THREE.Mesh(crop,toonMaterial(source.material));mesh.name=source.name;mesh.applyMatrix4(source.matrixWorld);scene.add(mesh);triangles+=keep.length/3;sourceNames.push(name);
}
scene.updateMatrixWorld(true);
const ray=new THREE.Raycaster(),samples=[];
const surface=(name,s)=>{ray.set(new THREE.Vector3(...point(s,0,80)),new THREE.Vector3(0,-1,0));return ray.intersectObject(scene.getObjectByName(name),false)[0]?.point.y??null;};
for(const s of [-15,-14,-13,0,13,14,15])samples.push({s,bridge:surface('Crossings',s),terrain:surface('Terrain',s)});
const low=surface('Crossings',-13),mid=surface('Crossings',0),high=surface('Crossings',13);
if(low===null||mid===null||high===null)throw Error('Bridge surface absent from actual GLB');
const cameras={
 'bridge-overview':{eye:point(-19,15,mid+13),target:point(0,0,mid)},
 'low-bank-contact':{eye:point(-20,3.5,low+2.7),target:point(-13,0,low-.1)},
 'high-bank-contact':{eye:point(20,-3.5,high+2.7),target:point(13,0,high-.1)},
 'walking-face':{eye:point(-14,.4,low+1.7),target:point(5,0,mid+.1)},
};
window.review={draw:(eye,target)=>{camera.position.fromArray(eye);camera.lookAt(...target);renderer.render(scene,camera);},sourceNames,triangles,samples,cameras};
await renderer.compileAsync(scene,camera);window.review.draw(cameras['bridge-overview'].eye,cameras['bridge-overview'].target);window.review.ready=true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/lejiazhang/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], consoleErrors = [];
page.on('pageerror', error => { errors.push(error.message); console.error('pageerror:', error.message); });
page.on('console', message => { if (message.type() === 'error') { consoleErrors.push(message.text()); console.error('browser console:', message.text()); } });
try {
  await page.route('**/alpha-log-bridge-review', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://127.0.0.1:5173/alpha-log-bridge-review');
  await Promise.race([
    page.waitForFunction(() => window.review?.ready, null, { timeout: 90000 }),
    page.waitForEvent('pageerror', { timeout: 90000 }).then(error => { throw error; }),
  ]);
  const detail = await page.evaluate(() => ({ cameras: window.review.cameras, sourceNames: window.review.sourceNames, triangles: window.review.triangles, samples: window.review.samples }));
  for (const [name, camera] of Object.entries(detail.cameras)) {
    await page.evaluate(c => window.review.draw(c.eye, c.target), camera);
    await page.screenshot({ path: out + name + '.png' });
  }
  const bytes = await readFile(new URL('../../public/assets/world_alpha.glb', import.meta.url));
  const result = { method: 'Actual production Alpha GLB cropped to Crossings / Terrain / Water near the log bridge, production toon materials, neutral inspection lights; Chromium WebGL / SwiftShader',
    errors, consoleErrors, ...detail, assetSha256: createHash('sha256').update(bytes).digest('hex'),
    limitation: 'Local visual inspection only; not a complete running-world scene or a device frame-rate measurement.' };
  await writeFile(out + 'render-evidence.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  if (errors.length || consoleErrors.length) process.exitCode = 1;
} finally { await browser.close(); }
