/** Actual GLB + production finish controllers, plus the real Arena workshop.
 * Start Arena Vite first. Local inspection views are not full-world/FPS evidence. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/lejiazhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = fileURLToPath(new URL('../test/historical-finish-review/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || '/Users/lejiazhang/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const base = process.env.ARENA_URL || 'http://127.0.0.1:5174';
const worldModule = '/@fs' + fileURLToPath(new URL('../../world/src/weapons/weaponFinishMaterials.ts', import.meta.url));
const styles = [
  { weapon: 'firefly', art: 'firefly', id: 'guard-sash' },
  { weapon: 'corona', art: 'afterglow', id: 'sealed-passage' },
  { weapon: 'halo', art: 'meridian', id: 'night-nacre' },
];
const html = `<!doctype html><html><head><style>html,body{margin:0;overflow:hidden;background:#101a29}canvas{display:block}#label{position:fixed;top:22px;left:28px;color:#e3e6eb;font:16px system-ui;letter-spacing:.08em}</style></head><body><div id="label"></div><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import {RoomEnvironment} from '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {WeaponArtPool,combatArt,ART_URLS,disposeTree} from '/src/weapons/weaponArt.ts';
import {lightWeaponScene} from '/src/weapons/weaponLighting.ts';
import {Viewmodel} from '/src/rendering/scene.ts';
import {WEAPONS} from '/shared/content.ts';
import {createWeaponFinishMaterials} from '${worldModule}';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=.98;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#101a29');lightWeaponScene(scene);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room);scene.environment=env.texture;room.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(35,1280/800,.01,100),pool=new WeaponArtPool(),content=new THREE.Group();scene.add(content);
const held=new Viewmodel();held.aspect=1280/800;const heldCamera=new THREE.PerspectiveCamera(58,1280/800,.01,10);
let release=()=>{},root,kind='';
function clear(){release();release=()=>{};held.clear();held.root.removeFromParent();content.clear();}
window.review={ready:true,async select(mode,weapon,id){
 clear();kind=mode;const def=combatArt(weapon);if(!def)throw Error('Unknown weapon '+weapon);
 if(mode==='arena'){const skin=WEAPONS.find(w=>w.id===weapon).skins.find(s=>s.id===id);if(!skin)throw Error('Unselectable '+id);const handle=pool.acquire(def,skin);root=(await handle.ready).root;release=()=>handle.release();content.add(root);}
 else if(mode==='world'){root=(await new GLTFLoader().loadAsync(ART_URLS[def.id])).scene;const finish=createWeaponFinishMaterials(root);if(!finish.apply(id))throw Error('World finish missing '+id);release=()=>{finish.dispose();disposeTree(root);};content.add(root);}
 else {const wi=WEAPONS.findIndex(w=>w.id===weapon),si=WEAPONS[wi].skins.findIndex(s=>s.id===id);if(si<0)throw Error('Held skin missing');held.set(wi,si);scene.add(held.root);
  for(let i=0;i<300&&!held.root.children.some(o=>o.userData.artState==='ready');i++)await new Promise(r=>setTimeout(r,20));
  if(!held.root.children.some(o=>o.userData.artState==='ready'))throw Error('Actual viewmodel never loaded');held.resetMotion();held.update(0);root=held.root;
 }
 root.updateMatrixWorld(true);await renderer.compileAsync(scene,kind==='held'?heldCamera:camera);
 document.querySelector('#label').textContent=mode.toUpperCase()+' / '+weapon+' / '+id;
 const b=new THREE.Box3().setFromObject(root),size=b.getSize(new THREE.Vector3());return {meshes:(()=>{let n=0;root.traverse(o=>{if(o.isMesh)n++});return n})(),size:size.toArray()};
 },draw(view){if(kind==='held'){renderer.render(scene,heldCamera);return;}
 const b=new THREE.Box3().setFromObject(root),center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z);
 const offset=view==='side'?new THREE.Vector3(.13,.14,1.55):new THREE.Vector3(.2,1.12,1.25);
 camera.position.copy(center).addScaledVector(offset,span);camera.lookAt(center);renderer.render(scene,camera);
 }};
</script></body></html>`;
const errors = [], results = [];
function observe(page) {
  page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.error(m.text()); } });
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); observe(page);
  await page.route('**/historical-finishes-review', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(base + '/historical-finishes-review');
  await page.waitForFunction(() => window.review?.ready, null, { timeout: 30000 });
  for (const style of styles) for (const mode of ['arena', 'world', 'held']) {
    const detail = await page.evaluate(async ({ mode, style }) => window.review.select(mode, style.weapon, style.id), { mode, style });
    for (const view of mode === 'held' ? ['held'] : ['side', 'crown']) {
      await page.evaluate(view => window.review.draw(view), view);
      const name = mode + '-' + style.id + '-' + view;
      await page.screenshot({ path: out + name + '.png' }); results.push({ name, ...detail }); console.log('rendered', name);
    }
  }
  await page.close();
  const ui = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); observe(ui);
  await ui.goto(base + '/?low&mute'); await ui.click('#armory');
  for (const style of styles) {
    await ui.locator('[data-art="' + style.art + '"]').click();
    await ui.locator('[data-finish-id="' + style.id + '"]').click();
    await ui.waitForFunction(() => document.querySelector('#armory-dialog')?.getAttribute('aria-busy') === 'false');
    const before = await ui.evaluate(() => JSON.parse(localStorage.getItem('arena-lobby') || '{}'));
    assert.notEqual(before.skinIds?.[style.weapon], style.id, 'Preview must not equip');
    await ui.click('#art-equip');
    const saved = await ui.evaluate(() => JSON.parse(localStorage.getItem('arena-lobby') || '{}'));
    assert.equal(saved.skinIds[style.weapon], style.id);
    await ui.screenshot({ path: out + 'workshop-' + style.id + '.png' });
  }
  await ui.reload(); await ui.click('#armory');
  for (const style of styles) {
    await ui.locator('[data-art="' + style.art + '"]').click();
    await ui.waitForFunction(() => document.querySelector('#armory-dialog')?.getAttribute('aria-busy') === 'false');
    assert.equal(await ui.locator('[data-finish-id="' + style.id + '"]').getAttribute('aria-pressed'), 'true');
    assert.match(await ui.textContent('#art-equip'), /已装备|Equipped/);
  }
  const saved = await ui.evaluate(() => JSON.parse(localStorage.getItem('arena-lobby') || '{}'));
  await ui.close();
  await writeFile(out + 'verification.json', JSON.stringify({ method: 'Actual authored GLBs with production Arena/World material controllers; Arena production Viewmodel at its real FOV and idle pose; real workshop clicks and reload.', errors, results, selected: saved.skinIds,
    limitation: 'The side/crown and held views are isolated studio scenes. They do not measure a complete map or device frame rate.' }, null, 2) + '\n');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
