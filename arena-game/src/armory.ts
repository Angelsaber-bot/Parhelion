import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WEAPON_ART, weaponArtPool, type ArtHandle } from './weaponArt.ts';

/** Created only on demand, one selected GLB at a time; closing releases renderer + model resources. */
export function openArmory() {
  if (document.getElementById('armory-dialog')) return;
  const dialog = document.createElement('dialog'); dialog.id = 'armory-dialog';
  dialog.innerHTML = `<header><div><small>PARHELION / WAYFARER ARMORY</small><h2>旅人武装</h2></div><button id="armory-close" aria-label="关闭武器展示">关闭 ✕</button></header>
    <div class="armory-layout"><nav aria-label="模型选择">${WEAPON_ART.map((a) => `<button data-art="${a.id}"><b>${a.name}</b><span>${a.category} · ${a.combat ? '已接入战斗外观' : '仅模型展示'}</span></button>`).join('')}</nav>
    <section><canvas aria-label="可旋转的三维武器模型"></canvas><h3 id="art-title"></h3><p id="art-info"></p><p id="art-status" role="status"></p><button id="art-retry" hidden>重试加载</button><p class="muted">拖动旋转 · 滚轮缩放 · Esc 关闭。这里不改变配装或战斗数值。</p></section></div>`;
  document.body.append(dialog); dialog.showModal();
  const canvas = dialog.querySelector('canvas')!;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch (error) {
    dialog.querySelector('#art-status')!.textContent = `无法创建三维预览：${String(error)}`;
    dialog.querySelector('#armory-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), { once: true }); return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x13252f);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.enablePan = false;
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const env = pmrem.fromScene(room); scene.environment = env.texture; room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe1f5ff, 0x45505c, 2));
  const key = new THREE.DirectionalLight(0xffe3c5, 3); key.position.set(2, 4, 3); scene.add(key);
  let handle: ArtHandle | null = null, closed = false, serial = 0, selected = 'dawn';
  const select = async (id: string) => {
    const def = WEAPON_ART.find((a) => a.id === id)!; selected = id;
    const ticket = ++serial; handle?.release();
    const status = dialog.querySelector('#art-status')!, retry = dialog.querySelector<HTMLButtonElement>('#art-retry')!;
    retry.hidden = true; status.textContent = '正在加载所选模型…';
    dialog.querySelector('#art-title')!.textContent = def.name;
    dialog.querySelector('#art-info')!.textContent = def.combat
      ? `${def.category} · ${def.combat === 'lumen' ? 'Lumen AR' : def.combat === 'corona' ? 'Corona SG' : 'Halo DMR'} 外观已接入；保留现有伤害、弹药与射速。`
      : `${def.category} · 仅模型展示。尚无该类别的战斗规则，不能装备作战。`;
    dialog.querySelectorAll<HTMLButtonElement>('[data-art]').forEach((b) => { const on = b.dataset.art === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const current = handle = weaponArtPool.acquire(def);
    try {
      const instance = await current.ready;
      if (!instance || closed || ticket !== serial) return;
      const box = new THREE.Box3().setFromObject(instance.root), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      instance.root.position.sub(center); scene.add(instance.root);
      const radius = size.length() / 2;
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.14;
      camera.position.set(distance * 0.25, distance * 0.2, distance); controls.target.set(0, 0, 0);
      controls.minDistance = radius * 1.25; controls.maxDistance = distance * 2.5; controls.update();
      status.textContent = `${def.triangles.toLocaleString()} 三角形 · 原始 PBR 材质 · 无骨骼动画`;
    } catch (error) {
      current.release();
      if (!closed && ticket === serial) { status.textContent = `模型加载失败，可重试：${String(error)}`; retry.hidden = false; }
    }
  };
  dialog.querySelectorAll<HTMLButtonElement>('[data-art]').forEach((b) => b.onclick = () => void select(b.dataset.art!));
  dialog.querySelector<HTMLButtonElement>('#art-retry')!.onclick = () => void select(selected);
  dialog.querySelector<HTMLButtonElement>('#armory-close')!.onclick = () => dialog.close();
  const observer = new ResizeObserver(() => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }); observer.observe(canvas);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  dialog.addEventListener('close', () => {
    closed = true; ++serial; handle?.release(); observer.disconnect(); controls.dispose();
    renderer.setAnimationLoop(null); env.dispose(); renderer.dispose(); renderer.forceContextLoss(); dialog.remove();
  }, { once: true });
  void select(selected);
}
