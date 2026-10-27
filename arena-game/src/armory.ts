import { bilingual, localizeDom, localizeText, onLanguageChange } from '../../shared-client/i18n.ts';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WEAPON_ART, weaponArtPool, type ArtHandle } from './weaponArt.ts';
import { WEAPONS } from '../shared/content.ts';
import { displayWeaponName, weaponRole, weaponStats } from './loadout.ts';

/** Created only on demand, one selected GLB at a time; closing releases renderer + model resources. */
export function openArmory() {
  if (document.getElementById('armory-dialog')) return;
  const dialog = document.createElement('dialog'); dialog.id = 'armory-dialog';
  dialog.innerHTML = `<header><div><small>PARHELION / WAYFARER ARMORY</small><h2>旅人武装</h2></div><button id="armory-close" aria-label="关闭武器展示">关闭 ✕</button></header>
    <div class="armory-layout"><nav aria-label="模型选择">${WEAPON_ART.map((a) => `<button data-art="${a.id}"><b>${displayWeaponName(a.combat ?? '')}</b><span>${localizeText(a.name)} · ${bilingual('可装备作战', 'Combat-ready')}</span></button>`).join('')}</nav>
    <section><canvas aria-label="可旋转的三维武器模型"></canvas><h3 id="art-title"></h3><p id="art-info"></p><p id="art-status" role="status"></p><button id="art-retry" hidden>重试加载</button><p class="muted">拖动旋转 · 滚轮缩放 · Esc 关闭。在大厅选择两把枪和一件近战；这里仅预览外观，不更改配装。数值是尚未完成竞技平衡验证的 Alpha 原型。</p></section></div>`;
  document.body.append(dialog); localizeDom(dialog); dialog.showModal();
  const canvas = dialog.querySelector('canvas')!;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch (error) {
    dialog.querySelector('#art-status')!.textContent = bilingual(`无法创建三维预览：${String(error)}`, `Could not create 3D preview: ${String(error)}`);
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
  let statusText: [string, string] = ['', ''];
  const setStatus = (zh: string, en: string) => { statusText = [zh, en]; dialog.querySelector('#art-status')!.textContent = bilingual(zh, en); };
  const renderDetails = () => {
    const def = WEAPON_ART.find((a) => a.id === selected)!;
    dialog.querySelector('#art-title')!.textContent = `${displayWeaponName(def.combat ?? '')} · ${localizeText(def.name)}`;
    const weapon = WEAPONS.find((w) => w.id === def.combat);
    dialog.querySelector('#art-info')!.textContent = weapon
      ? bilingual(`${weaponRole(weapon.id)}。${weaponStats(weapon)}。可在大厅对应配装槽装备。`, `${weaponRole(weapon.id)}. ${weaponStats(weapon)}. Equip it in a matching lobby slot.`)
      : bilingual('战斗数据未匹配，请重新加载同版本客户端。', 'Combat data did not match. Reload the matching client version.');
    dialog.querySelector('#art-status')!.textContent = bilingual(...statusText);
    dialog.querySelectorAll<HTMLButtonElement>('[data-art]').forEach((button) => {
      const def = WEAPON_ART.find((a) => a.id === button.dataset.art)!;
      button.querySelector('b')!.textContent = displayWeaponName(def.combat ?? '');
      button.querySelector('span')!.textContent = `${localizeText(def.name)} · ${bilingual('可装备作战', 'Combat-ready')}`;
    });
    localizeDom(dialog);
  };
  const unsubscribeLanguage = onLanguageChange(renderDetails);
  const select = async (id: string) => {
    const def = WEAPON_ART.find((a) => a.id === id)!; selected = id;
    const ticket = ++serial; handle?.release();
    const status = dialog.querySelector('#art-status')!, retry = dialog.querySelector<HTMLButtonElement>('#art-retry')!;
    retry.hidden = true; setStatus('正在加载所选模型…', 'Loading the selected model…');
    renderDetails();
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
      setStatus(`${def.triangles.toLocaleString()} 三角形 · 原始 PBR 材质 · 程序化武器动作`, `${def.triangles.toLocaleString()} triangles · Authored PBR materials · Procedural weapon motion`);
    } catch (error) {
      current.release();
      if (!closed && ticket === serial) { setStatus(`模型加载失败，可重试：${String(error)}`, `Model failed to load; retry is available: ${String(error)}`); retry.hidden = false; }
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
    closed = true; unsubscribeLanguage(); ++serial; handle?.release(); observer.disconnect(); controls.dispose();
    renderer.setAnimationLoop(null); env.dispose(); renderer.dispose(); renderer.forceContextLoss(); dialog.remove();
  }, { once: true });
  void select(selected);
}
