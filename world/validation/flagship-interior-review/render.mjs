/** Actual Black Sail core/visual meshes and the production record-hold component.
 * This local WebGL inspection omits the rest of the world; no FPS claim. */
import { chromium } from '/Users/lejiazhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(new URL('.', import.meta.url));
await mkdir(output, { recursive: true });
const html = `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}</style></head><body><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import {regionLoader,bakeQuantized} from '/src/rendering/glb.ts';
import {toonMaterial,cloudShadowUniform} from '/src/rendering/look.ts';
import {createFlagshipInterior} from '/src/environment/flagshipInterior.ts';
import {flagshipPoint as P} from '/src/map/shipInteriorCut.ts';
cloudShadowUniform.value=0;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.setClearColor('#b7c6c9');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e3eef4','#74624c',1.4));const sun=new THREE.DirectionalLight('#fff0cf',1.9);sun.position.set(1030,45,80);scene.add(sun);
const light=new THREE.PointLight('#ffe1aa',9,30,1);light.position.fromArray(P(5,0,5.9));scene.add(light);
const camera=new THREE.PerspectiveCamera(62,1280/800,.06,140),hold=createFlagshipInterior();scene.add(hold.root);
const sourceNames=[];for(const kind of['core','visual']){
 const {scene:source}=await regionLoader().loadAsync('/assets/world_blacksail.'+kind+'.glb');bakeQuantized(source);source.position.set(720,0,-720);source.updateMatrixWorld(true);
 const meshes=[];source.traverse(o=>{if(o.isMesh&&o.name.startsWith('Ghost_Fleet_Ship_296_104'))meshes.push(o);});
 for(const mesh of meshes){const copy=new THREE.Mesh(mesh.geometry,toonMaterial(mesh.material));copy.name=mesh.name;copy.applyMatrix4(mesh.matrixWorld);scene.add(copy);sourceNames.push(mesh.name);}
}
if(!sourceNames.some(name=>name.endsWith('_Timber')))throw Error('The actual flagship timber mesh is missing');
window.review={draw:(eye,target)=>{camera.position.fromArray(P(...eye));camera.lookAt(...P(...target));renderer.render(scene,camera);},sourceNames};
await renderer.compileAsync(scene,camera);window.review.draw([8,1.2,4.9],[1,0,6.6]);window.review.ready=true;
</script></body></html>`;
const browser = await chromium.launch({ headless: true,
  executablePath: '/Users/lejiazhang/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/flagship-hold-review', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://127.0.0.1:5173/flagship-hold-review');
  await page.waitForFunction(() => window.review?.ready, null, { timeout: 90000 });
  const cameras = {
    'cabin-ceiling': { eye: [8, 1.2, 4.9], target: [1, 0, 6.6] },
    'port-hatch-down': { eye: [-9.2, -3.75, 8.65], target: [.7, -3.75, 4.6] },
    'starboard-hatch-up': { eye: [5.7, 3.75, 4.95], target: [-5.5, 3.75, 7] },
    'alarm-support': { eye: [-11.8, .3, 4.6], target: [-10, 1.8, 4.2] },
  };
  for (const [name, camera] of Object.entries(cameras)) {
    await page.evaluate(c => window.review.draw(c.eye, c.target), camera);
    await page.screenshot({ path: output + name + '.png' });
  }
  const result = { method: 'Real Black Sail core/visual GLBs, production flagshipInterior component and toon materials; neutral local inspection lights; Chromium WebGL / SwiftShader',
    errors, cameras, sourceNames: await page.evaluate(() => window.review.sourceNames),
    limitation: 'Isolated ship inspection, not a running full-world scene or a device frame-rate measurement.' };
  await writeFile(output + 'render-evidence.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
