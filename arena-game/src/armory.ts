import { bilingual, localizeDom, localizeText, onLanguageChange } from '../../shared-client/i18n.ts';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WEAPON_ART, weaponArtPool, type ArtHandle } from './weaponArt.ts';
import { WEAPONS } from '../shared/content.ts';
import { displayWeaponName } from './loadout.ts';
import {finishOf,FINISH_DETAILS,updateFinishClock} from './weaponFinishes.ts';
import {signatureOf,signaturesFor,signatureModelOf} from '../shared/signatureSkins.ts';
import {lightWeaponScene} from './weaponLighting.ts';
import {FrameGate} from './renderScheduling.ts';

/** Created only on demand, one selected GLB at a time; closing releases renderer + model resources. */
export function openArmory(options:{skins?:readonly number[];equip?:(weapon:number,skin:number)=>{saved:boolean}}={}) {
  if (document.getElementById('armory-dialog')) return;
  const dialog = document.createElement('dialog'); dialog.id = 'armory-dialog';dialog.setAttribute('data-i18n-ignore','');dialog.setAttribute('aria-labelledby','armory-title');
  dialog.innerHTML = `<header><div><small>PARHELION / WAYFARER ARMORY</small><h2 id="armory-title">皮肤工坊</h2></div><button id="armory-close" aria-label="关闭武器展示">关闭 ✕</button></header>
    <div class="armory-layout"><nav aria-label="模型选择">${WEAPON_ART.map((a) => `<button data-art="${a.id}"><b>${displayWeaponName(a.combat ?? '')}</b><span>${localizeText(a.name)} · ${bilingual('可装备作战', 'Combat-ready')}</span></button>`).join('')}</nav>
    <section><div class="art-preview"><canvas aria-label="可旋转的三维武器模型"></canvas><button id="art-view-reset" type="button">复位视角</button></div><h3 id="art-title"></h3><p id="art-info"></p><div id="art-finishes" aria-label="皮肤主题"></div><button id="art-equip" class="primary" type="button">装备皮肤</button><p id="art-status" role="status"></p><button id="art-retry" hidden>重试加载</button><p id="art-hint" class="muted">拖动旋转 · 滚轮缩放 · Esc 返回</p></section></div>`;
  document.body.append(dialog); localizeDom(dialog); dialog.showModal();
  const canvas = dialog.querySelector('canvas')!;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch (error) {
    dialog.querySelector('#art-status')!.textContent = bilingual(`无法创建三维预览：${String(error)}`, `Could not create 3D preview: ${String(error)}`);
    dialog.querySelector('#armory-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), { once: true }); return;
  }
  renderer.setPixelRatio(Math.min(Math.max(1,devicePixelRatio),1.25)); renderer.toneMapping = THREE.NeutralToneMapping;renderer.toneMappingExposure=.98;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101a29);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.enablePan = false;
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const env = pmrem.fromScene(room); scene.environment = env.texture; room.dispose(); pmrem.dispose();
  lightWeaponScene(scene);
  let handle: ArtHandle | null = null, closed = false, serial = 0, selected = 'dawn';
  let framedModel='',framedDistance=0;
  let statusText: [string, string] = ['', ''];
  // Enter on the weapon's unique art, without changing the equipped skin.
  // Saved equipment only changes on the explicit Equip action below.
  const equippedSkins=WEAPONS.map((w,i)=>w.skins[options.skins?.[i]??-1]?options.skins![i]:0);
  const selectedSkins=[...equippedSkins];
  const equip=dialog.querySelector<HTMLButtonElement>('#art-equip')!;equip.hidden=!options.equip;
  const setStatus = (zh: string, en: string) => { statusText = [zh, en]; dialog.querySelector('#art-status')!.textContent = bilingual(zh, en); };
  const renderDetails = () => {
    dialog.querySelector('h2')!.textContent=bilingual('皮肤工坊','Skin workshop');
    dialog.querySelector('nav')!.setAttribute('aria-label',bilingual('武器选择','Weapon selection'));
    dialog.querySelector('#armory-close')!.textContent=bilingual('关闭 ✕','Close ✕');
    dialog.querySelector('#armory-close')!.setAttribute('aria-label',bilingual('关闭皮肤工坊','Close skin workshop'));
    dialog.querySelector('#art-hint')!.textContent=bilingual('拖动旋转 · 滚轮缩放 · Esc 返回','Drag to rotate · Scroll to zoom · Esc to return');
    dialog.querySelector('#art-retry')!.textContent=bilingual('重试加载','Retry');
    dialog.querySelector('#art-view-reset')!.textContent=bilingual('复位视角','Reset view');
    dialog.querySelector('#art-finishes')!.setAttribute('aria-label',bilingual('皮肤主题','Finish collection'));
    canvas.setAttribute('aria-label',bilingual('可旋转的三维武器模型','Rotatable 3D weapon model'));

    const def = WEAPON_ART.find((a) => a.id === selected)!;
    const weapon=WEAPONS.find(w=>w.id===def.combat)!,index=WEAPONS.indexOf(weapon),skin=weapon.skins[selectedSkins[index]],finish=finishOf(skin.id);
    dialog.querySelector('#art-title')!.textContent=finish?bilingual(FINISH_DETAILS[finish].zh,FINISH_DETAILS[finish].en):localizeText(skin.name);
    dialog.querySelector('#art-info')!.textContent=displayWeaponName(weapon.id)+' · '+(finish?bilingual(...FINISH_DETAILS[finish].description):bilingual('原装材质与配色。','Original materials and colorway.'));
    const focused=(document.activeElement as HTMLElement|null)?.dataset.finish;
    const buttons=weapon.skins.map((item,i)=>{const button=document.createElement('button');button.type='button';button.dataset.finish=String(i);button.dataset.finishId=item.id;button.className='finish-card';button.classList.toggle('on',i===selectedSkins[index]);button.setAttribute('aria-pressed',String(i===selectedSkins[index]));button.style.setProperty('--finish-body','#'+item.body.toString(16).padStart(6,'0'));button.style.setProperty('--finish-light','#'+item.accent.toString(16).padStart(6,'0'));const paint=document.createElement('i');paint.setAttribute('aria-hidden','true');const name=document.createElement('span'),theme=finishOf(item.id);name.textContent=theme?bilingual(FINISH_DETAILS[theme].zh,FINISH_DETAILS[theme].en):localizeText(item.name);button.append(paint,name);if(signatureOf(item.id)){button.classList.add('signature-card');const tag=document.createElement('small'),remodeled=!!signatureModelOf(item.id);tag.textContent=i===equippedSkins[index]?bilingual('已装备','Equipped'):remodeled?bilingual('新外形','New model'):bilingual('专属设计','Weapon exclusive');tag.classList.toggle('is-equipped',i===equippedSkins[index]);tag.classList.toggle('is-model',remodeled);button.append(tag);}button.onclick=()=>{selectedSkins[index]=i;void select(selected,true);};return button;});
    dialog.querySelector('#art-finishes')!.replaceChildren(...buttons);
    (dialog.querySelector('#art-finishes') as HTMLElement).style.setProperty('--finish-count',String(buttons.length));
    if(focused)dialog.querySelector<HTMLButtonElement>(`[data-finish="${focused}"]`)?.focus();
    equip.textContent=selectedSkins[index]===equippedSkins[index]?bilingual('已装备','Equipped'):bilingual('装备皮肤','Equip finish');
    dialog.querySelector('#art-status')!.textContent = bilingual(...statusText);
    dialog.querySelectorAll<HTMLButtonElement>('[data-art]').forEach((button) => {
      const def = WEAPON_ART.find((a) => a.id === button.dataset.art)!;
      button.querySelector('b')!.textContent = displayWeaponName(def.combat ?? '');
      const count=signaturesFor(def.combat).length;
      button.querySelector('span')!.textContent = bilingual(`${count} 款专属`,`${count} exclusive finishes`);
    });
    localizeDom(dialog);
  };
  const unsubscribeLanguage = onLanguageChange(renderDetails);
  const select = async (id: string,preserveView=false) => {
    if(closed||!dialog.isConnected)return;
    const def = WEAPON_ART.find((a) => a.id === id)!; selected = id;
    const ticket = ++serial; handle?.release();dialog.setAttribute('aria-busy','true');equip.disabled=true;
    const status = dialog.querySelector('#art-status')!, retry = dialog.querySelector<HTMLButtonElement>('#art-retry')!;
    retry.hidden = true; setStatus('正在加载所选模型…', 'Loading the selected model…');
    renderDetails();
    dialog.querySelectorAll<HTMLButtonElement>('[data-art]').forEach((b) => { const on = b.dataset.art === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const weapon=WEAPONS.find(w=>w.id===def.combat)!,colors=weapon.skins[selectedSkins[WEAPONS.indexOf(weapon)]],modelKey=signatureModelOf(colors.id)??def.id;
    const current = handle = weaponArtPool.acquire(def,colors);
    try {
      const instance = await current.ready;
      if (!instance || closed || ticket !== serial) return;
      const box = new THREE.Box3().setFromObject(instance.root), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      instance.root.position.sub(center); scene.add(instance.root);
      const radius = size.length() / 2;
      const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
      const aspect=Math.max(.5,canvas.clientWidth/Math.max(1,canvas.clientHeight));
      const distance=Math.max(size.x/(2*tangent*aspect),size.y/(2*tangent))*1.16+size.z;
      controls.minDistance = radius * .55; controls.maxDistance = Math.max(distance*3,radius*4);
      if(!preserveView){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.set(distance*.38,distance*.24,distance);controls.target.set(0,0,0);controls.update();controls.saveState();controls.enableDamping=damping;}
      else {
        // A replacement silhouette can be much smaller than the original GLB.
        // Preserve orbit/relative zoom while fitting the new structure to the view.
        if(framedModel!==modelKey&&framedDistance>0){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.sub(controls.target).multiplyScalar(distance/framedDistance).add(controls.target);controls.position0.set(distance*.38,distance*.24,distance);controls.target0.set(0,0,0);controls.enableDamping=damping;}
        controls.update();
      }
      framedModel=modelKey;framedDistance=distance;
      dialog.setAttribute('aria-busy','false');equip.disabled=false;setStatus('','');
    } catch (error) {
      current.release();
      if (!closed && ticket === serial) { dialog.setAttribute('aria-busy','false');setStatus(`模型加载失败，可重试：${String(error)}`, `Model failed to load; retry is available: ${String(error)}`); retry.hidden = false; }
    }
  };
  dialog.querySelectorAll<HTMLButtonElement>('[data-art]').forEach((b) => b.onclick = () => void select(b.dataset.art!));
  dialog.querySelector<HTMLButtonElement>('#art-retry')!.onclick = () => void select(selected);
  dialog.querySelector<HTMLButtonElement>('#armory-close')!.onclick = () => dialog.close();
  dialog.querySelector<HTMLButtonElement>('#art-view-reset')!.onclick=()=>{const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.reset();controls.enableDamping=damping;};
  equip.onclick=()=>{if(closed||equip.disabled||!options.equip)return;const index=WEAPONS.findIndex(w=>w.id===WEAPON_ART.find(a=>a.id===selected)!.combat);const result=options.equip(index,selectedSkins[index]);equippedSkins[index]=selectedSkins[index];renderDetails();setStatus(result.saved?'已装备，已保存。':'已装备，本机保存失败；本次游戏仍可使用。',result.saved?'Equipped and saved.':'Equipped; local save failed. Available for this session.');};
  const pageExit=(event:PageTransitionEvent)=>{if(!event.persisted)dialog.close();};addEventListener('pagehide',pageExit);
  const observer = new ResizeObserver(() => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }); observer.observe(canvas);
  const previewFrames=new FrameGate(30);
  renderer.setAnimationLoop(now => { if(document.visibilityState==='hidden'||!previewFrames.allow(now))return;updateFinishClock(now/1000);controls.update(); renderer.render(scene, camera); });
  dialog.addEventListener('close', () => {
    closed = true;removeEventListener('pagehide',pageExit);unsubscribeLanguage(); ++serial; handle?.release(); observer.disconnect(); controls.dispose();
    renderer.setAnimationLoop(null); env.dispose(); renderer.dispose(); renderer.forceContextLoss(); dialog.remove();
  }, { once: true });
  void select(selected);
}
