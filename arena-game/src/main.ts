import {heroIcon} from './ui/heroIcon.ts';
import {mountLobbyShell,heroShell,modeShell} from './ui/lobbyShell.ts';
import { prepareWorldHeroes } from './player/worldHero.ts';
import { HeroLesson } from './ui/heroLesson.ts';
import { Bot, BOT_SKILL } from '../shared/bot.ts';
import { BTN } from '../shared/sim.ts';
import { HeroPreview } from './ui/heroPreview.ts';
import homewardThumb from './assets/maps/homeward.jpg';
import { arenaMatchBriefing, arenaControlHints, arenaPauseLabel } from './ui/matchBriefing.ts';
import { bilingual, getLanguage, createLanguageToggle, localizeDom, localizeText, onLanguageChange } from '../../shared-client/i18n.ts';
import { ResultsBoard, syncResultsBoardLayers } from './ui/resultsBoard.ts';
import { getMap, MAPS, mapIdOf } from '../shared/arenaMap.ts';
import { CHARACTERS, PLAYABLE_HERO_INDICES, playableHero, ABILITIES, WEAPONS, weaponIndex, type TeamLayout } from '../shared/content.ts';
import { DEFAULT_PORT, PUBLIC_SERVER, RULES_VERSION, type JoinOptions } from '../shared/protocol.ts';
import { sfx } from './rendering/audio.ts';
import { Controls } from './player/controls.ts';
import { ACTIONS, SettingsStore, createSettingsPanel } from '../../shared-client/settings.ts';
import '../../shared-client/settings.css';
import { Game } from './game.ts';
import { Hud } from './ui/hud.ts';
import { LoadoutStore, loadoutCards, displayWeaponName, UTILITY_INFO, utilityCooldownSeconds } from './ui/loadout.ts';
import { UTILITY_IDS } from '../shared/content.ts';
import {readSkinSelection,withSkinSelection} from './cosmetics/skinSelection.ts';
import {initialGraphics,mountGraphicsControl} from './rendering/graphics.ts';
import {FrameGate,worldRenderVisible} from './rendering/renderScheduling.ts';
import { ArenaScene } from './rendering/scene.ts';
import { joinOnline, startOffline, startRange, type Session } from './network/session.ts';
import { postStats } from './network/stats.ts';
import { RANGE_MAP_ID } from '../shared/trainingRange.ts';
import { GUN_IDS, MELEE_IDS, type Loadout, type UtilityId } from '../shared/content.ts';
import asterThumb from './assets/maps/aster.jpg';
import sakuraThumb from './assets/maps/sakura.jpg';
import blackflagThumb from './assets/maps/blackflag.jpg';
import frostcourtThumb from './assets/maps/frostcourt.jpg';
import camlannThumb from './assets/maps/camlann.jpg';
import lishanThumb from './assets/maps/lishan.jpg';
import suntempleThumb from './assets/maps/suntemple.jpg';
import orleansThumb from './assets/maps/orleans.jpg';

const MAP_THUMBS: Record<string, string> = { homeward:homewardThumb, aster: asterThumb, sakura: sakuraThumb, blackflag: blackflagThumb, frostcourt: frostcourtThumb, camlann: camlannThumb, lishan: lishanThumb, suntemple: suntempleThumb, orleans: orleansThumb };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const canvas = $<HTMLCanvasElement>('view');
const graphicsStorage=(()=>{try{return localStorage;}catch{return undefined;}})();
const graphicsQuality=initialGraphics(params,graphicsStorage);
const scene = new ArenaScene(canvas,graphicsQuality);
// Preserve reusable effects in the back/forward cache; release only on final page exit.
addEventListener('pagehide', (event) => { if (!event.persisted) {scene.disposeCombatEffects();heroPreview?.dispose();} });
ACTIONS.arena.find(a=>a.id==='shield')!.label='角色技能 / Hero ability';
const settings = new SettingsStore('arena');
const loadoutStore = new LoadoutStore();
const controls = new Controls(canvas, settings);
controls.force = params.has('test');
(window as unknown as { arena: unknown }).arena = { controls, scene };
const hud = new Hud();
let game: Game | null = null;
let endTitleSource = '';
let rematchRequested = false;
let errorSource: () => string = () => '';
let pointerLockFailed = false;
const pointerLockNote = document.createElement('p'); pointerLockNote.id = 'pointer-lock-note'; pointerLockNote.className = 'muted'; pointerLockNote.hidden = true; pointerLockNote.setAttribute('role', 'status');
$('resume').before(pointerLockNote);
function renderPointerLockNote() {
  pointerLockNote.hidden = !pointerLockFailed;
  pointerLockNote.textContent = pointerLockFailed ? bilingual('浏览器未锁定鼠标。点击继续重试，或返回大厅。', 'Mouse capture was not granted. Click Continue to retry, or return to the lobby.') : '';
}
const resultsBoard = new ResultsBoard();
// The range is offline too; any other value still falls back to the plain offline lobby.
let mode: 'offline' | 'online' | 'range' = params.get('mode') === 'range' ? 'range' : (params.get('mode') === 'online' ? 'online' : 'offline');
const matchMode = () => mode === 'online' ? 'online' as const : 'offline' as const;
const settingsPanel = createSettingsPanel(settings, {
  onOpen() {
    controls.blocked = true; controls.clearAll();
    if (game && !game.online) game.setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
  },
  onClose() { controls.blocked = false; controls.clearAll(); },
});
mountGraphicsControl($('arena-settings'),graphicsQuality,quality=>scene.setQuality(quality),graphicsStorage);
controls.onSettings = () => { if (!starting && !pageExited) settingsPanel.show(); };
$('settings-lobby').onclick = () => { if (!starting && !game && !pageExited) settingsPanel.show(); };
$('settings-pause').onclick = () => { if (game && !game.ended && !starting && !pageExited && !$('pause').classList.contains('hidden')) settingsPanel.show(); };
function renderControlHints() {
  const k = (action: string) => settings.label(action);
  const abilityLabel=bilingual('角色技能','Hero ability');ACTIONS.arena.find(a=>a.id==='shield')!.label=abilityLabel;
  const abilityRow=document.querySelector<HTMLElement>('#arena-settings [data-bind="shield"]')?.closest('.settings-bindings > div');
  if(abilityRow){abilityRow.setAttribute('data-no-i18n','');abilityRow.querySelector('span')!.textContent=abilityLabel;abilityRow.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button=>button.setAttribute('aria-label',`${abilityLabel} ${button.dataset.slot==='primary'?bilingual('主按键','primary binding'):bilingual('副按键','secondary binding')}`));abilityRow.querySelector('[data-clear]')!.setAttribute('aria-label',bilingual('移除角色技能副按键','Remove hero ability secondary binding'));}
  $('control-hints').textContent = arenaControlHints(k, matchMode());
  const abilityKey=document.querySelector<HTMLElement>('#hero-detail .ability-heading > kbd');if(abilityKey)abilityKey.textContent=k('shield');
  const abilityDescription=document.querySelector<HTMLElement>('[data-ability-description]');
  if(abilityDescription){const ability=ABILITIES[abilityDescription.dataset.abilityDescription as keyof typeof ABILITIES];abilityDescription.textContent=bilingual(ability.description,ability.english).replace(/\bQ\b/g,k('shield'));}
  $('dash').querySelector('kbd')!.textContent = k('dash'); $('shield').querySelector('kbd')!.textContent = k('shield'); $('utility').querySelector('kbd')!.textContent = k('throw'); $('loadout').querySelectorAll<HTMLElement>('[data-utility-key]').forEach((el) => el.textContent = k('throw'));
  $('wslots').querySelectorAll('kbd').forEach((el, i) => el.textContent = k(`weapon${i + 1}`));
  $('loadout').querySelectorAll<HTMLElement>('[data-slot-key]').forEach((el) => el.textContent = k(`weapon${Number(el.dataset.slotKey) + 1}`));
  $('end-score-hint').textContent = bilingual('按 S 查看计分板；再次按 S 或 Esc 关闭。', 'Press S to view scores; press S again or Esc to close.');
}
function renderResultsBoard() {
  controls.resultsScoreboard = resultsBoard.open;
  syncResultsBoardLayers(resultsBoard.open, $('hud'), $('endcard'));
  $('endscores').textContent = bilingual('查看计分板 (S)', 'View scoreboard (S)');
  $<HTMLButtonElement>('rematch').disabled = rematchRequested;
  $('rematch').textContent = rematchRequested ? bilingual('正在开始新一局…', 'Starting a fresh round…') : bilingual('再来一局', 'Play again');
}
$('endscores').onclick = () => { resultsBoard.toggle(); renderResultsBoard(); };
$('scoreboard').addEventListener('click', (event) => {
  if ((event.target as Element).closest('[data-close-scores]')) { resultsBoard.close(); renderResultsBoard(); $('endscores').focus(); }
});
addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const editing = !!target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable);
  if (settingsPanel.open || !resultsBoard.key(event.code, event.repeat, editing, event.ctrlKey || event.metaKey || event.altKey)) return;
  event.preventDefault(); renderResultsBoard();
  if (!resultsBoard.open) $('endscores').focus();
});
settings.subscribe(renderControlHints); renderControlHints();


// ---------- lobby ----------

const saved = (() => { try { const raw = JSON.parse(localStorage.getItem('arena-lobby') ?? '{}'); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; } catch { return {}; } })();
let char = typeof saved.heroId==='string' && CHARACTERS.some(c=>c.id===saved.heroId) ? CHARACTERS.findIndex(c=>c.id===saved.heroId) : Number.isInteger(saved.char) && CHARACTERS[saved.char] ? saved.char : 0;
char = playableHero(char);
let mapId = mapIdOf(params.get('map') ?? saved.map);
const skins = readSkinSelection(saved);
const nameInput = $<HTMLInputElement>('name');
nameInput.value = typeof saved.name === 'string' ? saved.name.trim() : '';
const nameRequired = () => bilingual('请先输入你的名字。', 'Enter your name before starting.');
nameInput.addEventListener('input', () => {
  if (errorSource === nameRequired && nameInput.value.trim()) showError('');
});
// Local/LAN pages default to the Colyseus server next to them; the public (https) site defaults to the
// Cloudflare Worker, and ignores a remembered plain ws:// address that an https page can't open anyway.
const localHost = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)|\.local$/.test(location.hostname) || !location.hostname;
const savedServer = location.protocol === 'https:' && String(saved.server ?? '').startsWith('ws://') ? undefined : saved.server;
$<HTMLInputElement>('server').value = params.get('server') ?? savedServer ?? (localHost ? `ws://${location.hostname || 'localhost'}:${DEFAULT_PORT}` : PUBLIC_SERVER);
if (['1v1', '1v2', '2v2'].includes(saved.layout)) $<HTMLSelectElement>('layout').value = saved.layout;

const lobbyShell=mountLobbyShell();
let lessonRequested=false;
let heroPreview:HeroPreview|null=null;
function renderChars() {
  const focusedHero=(document.activeElement as HTMLElement|null)?.closest<HTMLButtonElement>('#chars .char')?.dataset.i;
  let version=document.getElementById('arena-version');if(!version){version=document.createElement('small');version.id='arena-version';$('chars').before(version);}version.textContent=`ARENA v${RULES_VERSION} / FRONTLINE UI`;
  $('chars').innerHTML = PLAYABLE_HERO_INDICES.map(i => { const c=CHARACTERS[i]; const a=ABILITIES[c.ability]; return `<button class="char ${i === char ? 'on' : ''}" data-i="${i}" style="--c:#${c.color.toString(16)}" aria-pressed="${i===char}"><strong class="hero-glyph">${heroIcon(i)}</strong><b>${bilingual(c.name.split(' · ')[0],c.name.split(' · ')[1]??c.name)}</b><span>${bilingual(a.name,a.en)} · ${a.cooldown/60}s</span><small>${bilingual(`HP ${c.hp} · 速度 ${c.speed}`,`HP ${c.hp} · Speed ${c.speed}`)}</small></button>`; }).join('');
  let detail=document.getElementById('hero-detail');if(!detail){detail=document.createElement('div');detail.id='hero-detail';$('chars').after(detail);}
  const selected=ABILITIES[CHARACTERS[char].ability];
  detail.innerHTML=`<div class="ability-heading"><kbd>${settings.label('shield')}</kbd><div><small>${bilingual('专属技能','SIGNATURE ABILITY')}</small><h3>${bilingual(selected.name,selected.en)}</h3></div><span>${selected.cooldown/60}<small>SEC</small></span></div><p data-ability-description="${CHARACTERS[char].ability}">${bilingual(selected.description,selected.english).replace(/\bQ\b/g,settings.label('shield'))}</p><details><summary>${bilingual('施放与枪战规则','Casting & gunplay rules')}</summary><p>${bilingual('技能键快速施放，无需低头瞄地。布设技能和武藏错身可同时射击、开镜、换弹。技能跨死亡冷却，施放结束出生保护。','Quick-cast with the ability key without aiming at the floor. Deployments and Musashi’s sidestep preserve fire, aim and reload. Cooldowns survive death; casting ends spawn protection.')}</p></details>`;
  if(!heroPreview)heroPreview=new HeroPreview($('hero-preview'));
  heroPreview.choose(char,weaponIndex(loadoutStore.value[0]),skins[weaponIndex(loadoutStore.value[0])]);
  $('hero-lesson-start').onclick=()=>{lessonRequested=true;setMode('offline');pickMap('homeward');$<HTMLSelectElement>('layout').value='1v1';$('play').click();};
  $('hero-lesson-start').textContent=bilingual('进入技能练习 ↗','Practice this ability ↗');
  heroShell(char,loadoutStore.value);
  $('chars').querySelectorAll<HTMLButtonElement>('.char').forEach((b) => b.onclick = () => { char = Number(b.dataset.i); renderChars(); });
  if(focusedHero)$('chars').querySelector<HTMLButtonElement>(`[data-i="${focusedHero}"]`)?.focus({preventScroll:true});
}
function renderMaps() {
  const focusedMap=(document.activeElement as HTMLElement|null)?.closest<HTMLButtonElement>('#maps .mapcard')?.dataset.id;
  $('maps').innerHTML = MAPS.map((m) =>
    `<button class="mapcard ${m.id === mapId ? 'on' : ''}" data-id="${m.id}" aria-pressed="${m.id===mapId}"><img src="${MAP_THUMBS[m.id] ?? ''}" alt="" /><b>${getLanguage()==='en'&&m.englishName?m.englishName:localizeText(m.name)}</b><span>${m.id==='homeward'?bilingual('家园演练','Town exercise'):bilingual(`第 ${m.chapter} 章`, `Chapter ${m.chapter}`)} · ${getLanguage()==='en'&&m.englishBlurb?m.englishBlurb:localizeText(m.blurb)}</span></button>`).join('');
  $('maps').querySelectorAll<HTMLButtonElement>('.mapcard').forEach((b) => b.onclick = () => pickMap(b.dataset.id!));
  if(focusedMap)$('maps').querySelector<HTMLButtonElement>(`[data-id="${focusedMap}"]`)?.focus({preventScroll:true});
  const chosenMap=MAPS.find(m=>m.id===mapId)!;
  const picture=$<HTMLImageElement>('field-image');picture.src=MAP_THUMBS[mapId];picture.alt=localizeText(chosenMap.name);
  $('field-description').textContent=mode==='range'?bilingual('自由练习 · 熟悉武器与从者','Free practice · Learn your weapons and heroes'):getLanguage()==='en'&&chosenMap.englishBlurb?chosenMap.englishBlurb:localizeText(chosenMap.blurb);
  $('field-chapter').textContent=mode==='range'?'TRAINING / 00':chosenMap.chapter===0?'HOMEWARD / 00':`CHAPTER / ${String(chosenMap.chapter).padStart(2,'0')}`;
  $('field-count').textContent=bilingual(`${MAPS.length} 个战场`,`${MAPS.length} FIELDS`);
 $('title').textContent = mode==='range'?bilingual('训练场','Training range'):getLanguage()==='en'&&chosenMap.englishName?chosenMap.englishName:localizeText(chosenMap.name);
}
let starting = false;
let mapReady: Promise<void>;
let mapGeneration = 0;
let mapState: 'pending' | 'ready' | 'failed' = 'pending';
let suppressMapError = false;
let pageExited = false;
function pickMap(id: string) {
  if (pageExited || starting) return;
  const generation = ++mapGeneration; mapState = 'pending'; suppressMapError = false;
  showError('');
  mapId = mapIdOf(id);
  renderMaps();
  mapReady = scene.loadMap(mapId, getMap(mapId).data.presentation?.preset ?? MAPS.find((m) => m.id === mapId)?.preset, getMap(mapId).data.presentation);
  mapReady.then(() => { if (generation === mapGeneration) mapState = 'ready'; }, (e) => {
    if (generation !== mapGeneration) return;
    mapState = 'failed';
    if (!starting && !pageExited && !suppressMapError) showError(() => bilingual(`地图加载失败：${localizeText(String(e?.message ?? e))}。可点击开始重试，或另选地图。`, `Map failed to load: ${localizeText(String(e?.message ?? e))}. Press Start to retry, or choose another map.`));
  });
}
function renderSkins() {
  $('armory').textContent=bilingual('皮肤工坊','Skin workshop');
  $('skins').innerHTML = loadoutStore.value.map((id) => {
    const i = weaponIndex(id), w = WEAPONS[i];
    return `<label>${displayWeaponName(w.id)}<select data-w="${i}">${w.skins.map((s, j) => `<option value="${j}" ${skins[i] === j ? 'selected' : ''}>${localizeText(s.name)}</option>`).join('')}</select></label>`;
  }).join('');
  $('skins').querySelectorAll<HTMLSelectElement>('select').forEach((s) => s.onchange = () => { skins[Number(s.dataset.w)] = Number(s.value); heroPreview?.choose(char,weaponIndex(loadoutStore.value[0]),skins[weaponIndex(loadoutStore.value[0])]); });
}
function renderLoadout() {
  $('loadout').innerHTML = loadoutCards(loadoutStore.value, (action) => settings.label(action)).map((card) =>
    `<label class="loadout-item"><span class="loadout-heading"><b>${card.label}</b><kbd data-slot-key="${card.slot}">${card.key}</kbd></span><select data-slot="${card.slot}" aria-label="${card.label}">${card.choices.map((choice) => `<option value="${choice.id}" ${choice.id === card.id ? 'selected' : ''} ${choice.disabled ? 'disabled' : ''}>${choice.name}${choice.disabled ? bilingual('（另一槽已选）', ' (selected in other slot)') : ''}</option>`).join('')}</select><span class="loadout-role">${card.role}</span><small>${card.stats}</small></label>`).join('');
  $('loadout').querySelectorAll<HTMLSelectElement>('select').forEach((select) => select.onchange = () => {
    const result = loadoutStore.select(Number(select.dataset.slot), select.value);
    renderLoadout(); renderSkins(); renderChars();
    $('loadout').querySelector<HTMLSelectElement>(`[data-slot="${select.dataset.slot}"]`)?.focus({preventScroll:true});
    $('loadout-status').textContent = localizeText(result ? '请选择两把不同的枪和一件近战；本次无效选择未应用。' : loadoutStore.notice);
  });
  heroShell(char,loadoutStore.value);
  // Utility slot: one grenade per life, recharging; never one of the three weapon slots.
  const u = loadoutStore.utility, info = UTILITY_INFO[u];
  $('loadout').insertAdjacentHTML('beforeend', `<label class="loadout-item"><span class="loadout-heading"><b>${bilingual('道具', 'Utility')}</b><kbd data-utility-key>${settings.label('throw')}</kbd></span><select data-utility aria-label="${bilingual('道具', 'Utility')}">${UTILITY_IDS.map((id) => `<option value="${id}" ${id === u ? 'selected' : ''}>${bilingual(...UTILITY_INFO[id].name)}</option>`).join('')}</select><small>${bilingual(...info.role)} · ${bilingual(`每条命 2 颗，每 ${utilityCooldownSeconds()}s 恢复 1 颗`, `2 per life, one back every ${utilityCooldownSeconds()}s`)}</small></label>`);
  $('loadout').querySelector<HTMLSelectElement>('[data-utility]')!.onchange = (event) => {
    loadoutStore.selectUtility((event.target as HTMLSelectElement).value); renderLoadout();
    $('loadout').querySelector<HTMLSelectElement>('[data-utility]')?.focus({preventScroll:true});
    $('loadout-status').textContent = localizeText(loadoutStore.notice);
  };
}

function renderMatchBriefing() {
  const briefing = arenaMatchBriefing({ layout: $<HTMLSelectElement>('layout').value as TeamLayout,
    team: $<HTMLSelectElement>('team').value as 'A' | 'B' | 'auto', mode: matchMode(), bots: $<HTMLInputElement>('bots').checked });
  $('match-rules').textContent = briefing.rules;
  $('match-teams').textContent = briefing.teams;
  $('match-connection').textContent = briefing.connection;
  $('pause-title').textContent = mode === 'range' ? bilingual('训练场', 'Training range') : arenaPauseLabel(matchMode());
  if (mode === 'range') {
    $('match-rules').textContent = bilingual('训练场：假人不会还击，倒下 1 秒后回到原位。有 10/20/30/45 米固定靶、横移靶、掩体探头靶、护盾靶、手雷坑和近战靶。', 'Training range: dummies never shoot back and return to their posts a second after they fall. Static targets at 10/20/30/45 m, strafing, peeking and shield dummies, a grenade pit and melee dummies.');
    $('match-teams').textContent = bilingual('按 Esc 打开训练场菜单，随时更换武器、皮肤和道具；左上角显示命中率、秒伤和击杀用时。', 'Press Esc for the range menu to swap weapons, finishes and utility at any time; accuracy, DPS and time-to-kill show top left.');
    $('match-connection').textContent = bilingual('离线 · 不计战绩', 'Offline · not ranked');
  }
}
for (const id of ['layout', 'team', 'bots']) $(id).addEventListener('change', renderMatchBriefing);

function setMode(m: typeof mode) {
  if (starting || game || pageExited) return;
  mode = m; modeShell(m);
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === m));
  document.body.classList.toggle('online', m === 'online');
  document.body.classList.toggle('range', m === 'range');
  renderMaps(); // refreshes the title for the chosen mode
  if (m === 'offline' && $<HTMLSelectElement>('team').value === 'auto') $<HTMLSelectElement>('team').value = 'A';
  renderMatchBriefing(); renderControlHints();
}
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.onclick = () => setMode(t.dataset.mode as typeof mode));
$('armory').onclick = async () => {
  const generation = attemptGeneration;
  const eligible = () => !starting && !game && !pageExited && generation === attemptGeneration;
  if (!eligible()) return;
  try { const armory = await import('./weapons/armory.ts'); if (eligible()) armory.openArmory({skins,equip:(weapon,skin)=>{skins[weapon]=skin;renderSkins();try{const prior=JSON.parse(localStorage.getItem('arena-lobby')??'{}');localStorage.setItem('arena-lobby',JSON.stringify(withSkinSelection(prior,skins)));return{saved:true};}catch{return{saved:false};}}}); }
  catch (error) { console.error('Arena armory failed to open',error); if (eligible()) showError(() => bilingual('皮肤工坊暂时无法打开。页面可能已更新，请刷新后重试。', 'The skin workshop could not open. The page may have updated; refresh and try again.')); }
};
renderChars();
renderLoadout();
renderSkins();
if (loadoutStore.notice) $('loadout-status').textContent = localizeText(loadoutStore.notice);
setMode(mode);
pickMap(mapId);

function showError(message: string | (() => string)) {
  errorSource = typeof message === 'function' ? message : () => localizeText(message);
  const text = errorSource(); $('error').textContent = text;
  $('error').classList.toggle('hidden', !text);
}

type StartPhase = 'map' | 'models' | 'equipment' | 'join' | 'game';
let attemptGeneration = 0;
let activeStart: { id: number; phase: StartPhase; mode: typeof mode } | null = null;
function renderStartupStatus() {
  const phase = activeStart?.phase;
  $('loading-status').textContent = phase === 'join' ? activeStart?.mode==='online'?bilingual('正在连接服务器…', 'Connecting to server…'):bilingual('正在准备对局…','Preparing match…')
    : phase === 'models' ? bilingual('正在准备出战从者…', 'Preparing your heroes…') : phase==='equipment' ? bilingual('正在准备装备…','Preparing your equipment…') : phase === 'game' ? bilingual('正在准备对局…', 'Preparing match…') : bilingual('加载地图…', 'Loading map…');
  $('cancel-start').textContent = bilingual('取消并返回大厅', 'Cancel and return to lobby');
  $('loading-note').textContent = bilingual('首次进入需要稍多时间。按 Esc 可返回大厅。', 'Your first visit may take a little longer. Press Esc to return to the lobby.');
}
function restoreStartUi() {
  starting = false; $('lobby').inert = false;
  controls.blocked = settingsPanel.open; controls.clearAll();
  $<HTMLButtonElement>('play').disabled = false; $('loading').classList.add('hidden');
}
function cancelStart() {
  if (!activeStart) return;
  ++attemptGeneration; activeStart = null; suppressMapError = true;
  restoreStartUi(); $('play').focus();
}
$('cancel-start').onclick = cancelStart;
addEventListener('keydown', event => { if (starting && event.code === 'Escape') { event.preventDefault(); cancelStart(); } });
addEventListener('pagehide', event => {
  cancelStart();
  if (!event.persisted) { pageExited = true; game?.stop(); game = null; }
});
$('play').onclick = async () => {
  if (starting || game || pageExited || settingsPanel.open || (document.getElementById('armory-dialog') as HTMLDialogElement|null)?.open) return;
  const name = nameInput.value.trim();
  if (!name) {
    showError(nameRequired);
    nameInput.focus();
    return;
  }
  // A deliberate new Start retries a rejected asset load; an unresolved load is reused.
  if (mapState === 'failed') pickMap(mapId);
  const attempt = { id: ++attemptGeneration, phase: 'map' as StartPhase, mode };
  activeStart = attempt; starting = true; $('lobby').inert = true;
  controls.blocked = true; controls.clearAll();
  $<HTMLButtonElement>('play').disabled = true;
  showError(''); renderStartupStatus(); $('loading').classList.remove('hidden'); $('cancel-start').focus();
  const opts: JoinOptions = {
    layout: $<HTMLSelectElement>('layout').value as TeamLayout,
    team: $<HTMLSelectElement>('team').value as JoinOptions['team'],
    name,
    char, heroId:CHARACTERS[char].id, skins: skins.slice(), loadout: loadoutStore.value, utility: loadoutStore.utility, map: mapId,
    bots: $<HTMLInputElement>('bots').checked || undefined,
  };
  const server = $<HTMLInputElement>('server').value.trim();
  const difficulty = $<HTMLSelectElement>('difficulty').value as 'easy' | 'normal' | 'hard';
  const current = () => activeStart?.id === attempt.id && !pageExited;
  let ownedSession: Session | null = null;
  const closeOwned = () => { const session = ownedSession; ownedSession = null; try { session?.close(); } catch { /* best effort for a failed/stale startup */ } };
  try { localStorage.setItem('arena-lobby', JSON.stringify(withSkinSelection({ name: opts.name, layout: opts.layout, char, heroId:CHARACTERS[char].id, server, map: mapId },skins))); } catch { /* private mode */ }
  try {
    sfx.unlock();
    await (attempt.mode === 'range' ? scene.loadMap(RANGE_MAP_ID, 'day') : mapReady);
    if (!current()) return;
    attempt.phase = 'models'; renderStartupStatus();
    await prepareWorldHeroes();
    if (!current()) return;
    attempt.phase='equipment';renderStartupStatus();
    await scene.prepareLoadout(loadoutStore.value.map(weaponIndex),skins);
    if (!current()) return;
    attempt.phase = 'join'; renderStartupStatus();
    ownedSession = attempt.mode === 'online' ? await joinOnline(server, opts) : attempt.mode === 'range' ? startRange(opts) : startOffline(opts, difficulty);
    if (attempt.mode === 'offline' && !localHost) ownedSession.onStats = postStats;
    if (!current()) { closeOwned(); return; }
    attempt.phase = 'game'; renderStartupStatus();
    const session = ownedSession;
    rangeSession = session.practice ? session : null;
    if (rangeSession) { rangeChoice = { loadout: loadoutStore.value, utility: loadoutStore.utility, skins: skins.slice() }; renderRangePanel(); }
    game = new Game(session, scene, controls, hud, (reason) => backToLobby(reason));
    if(lessonRequested&&session.match){
      const m=session.match,bot=[...m.slots.values()].find(s=>s.info.bot);if(bot){bot.info.char=bot.state.char=8;bot.state.ability.readyAt=0;const brain=new Bot(41,BOT_SKILL.easy);bot.controller={think(match,id){const i=brain.think(match,id),p=match.player(id)!,enemy=match.player(session.id)!;if(p.alive&&enemy.alive&&match.heroes.visible([p.x,p.y+1,p.z],[enemy.x,enemy.y+1,enemy.z])&&Math.hypot(p.x-enemy.x,p.z-enemy.z)<16&&p.shieldCd===0&&!(p.prevButtons&BTN.SHIELD)){i.buttons=BTN.SHIELD;i.pitch=0;}return i;}};}
      game.lesson=new HeroLesson(session.id);lessonRequested=false;
    }
    ownedSession = null; // Game now owns exactly one session.
    $('lobby').classList.add('hidden'); hud.show(true);
    game.onEnded = (title) => {
      rematchRequested = false; resultsBoard.setEnded(true); renderResultsBoard();
      endTitleSource = title; $('endtitle').textContent = localizeText(endTitleSource);
      $('pause').classList.add('hidden');
      $('endcard').classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    };
    game.onRestart = () => { rematchRequested = false; resultsBoard.setEnded(false); renderResultsBoard(); $('endcard').classList.add('hidden'); controls.lock(); };
    (window as unknown as { game: unknown; session: unknown }).game = game;
    (window as unknown as { session: unknown }).session = session;

    controls.blocked = false; controls.onLockChange(controls.locked); controls.lock();
  } catch (e) {
    closeOwned();
    if (!current()) return;
    if (game) { game.stop(); game = null; }
    $('lobby').classList.remove('hidden'); hud.show(false);
    const message = String((e as Error)?.message ?? e), phase = attempt.phase;
    showError(() => phase === 'map'
      ? bilingual(`地图加载失败：${localizeText(message)}。可点击开始重试，或另选地图。`, `Map failed to load: ${localizeText(message)}. Press Start to retry, or choose another map.`)
      : phase === 'join' && attempt.mode === 'online'
        ? bilingual(`连接失败：${localizeText(message)}。请检查服务器地址，或自行选择单机模式。`, `Connection failed: ${localizeText(message)}. Check the server address, or choose Offline yourself.`)
        : bilingual(`无法开始对局：${localizeText(message)}。请在大厅重试。`, `Could not start the match: ${localizeText(message)}. Retry from the lobby.`));
  } finally {
    if (current()) { activeStart = null; restoreStartUi(); }
  }
};

// ---------- training range menu (inside the pause card) ----------
let rangeSession: Session | null = null;
let rangeChoice: { loadout: Loadout; utility: UtilityId; skins: number[] } = { loadout: loadoutStore.value, utility: loadoutStore.utility, skins: skins.slice() };
function renderRangePanel() {
  const panel = $('range-panel');
  if (!rangeSession) { panel.innerHTML = ''; return; }
  const c = rangeChoice, option = (value: string, label: string, on: boolean, disabled = false) => `<option value="${value}" ${on ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${label}</option>`;
  const slotSelect = (slot: number) => `<label>${slot === 2 ? bilingual('近战', 'Melee') : bilingual(`枪械 ${slot + 1}`, `Gun ${slot + 1}`)}<select data-range-slot="${slot}">${(slot === 2 ? MELEE_IDS : GUN_IDS).map((id) => option(id, displayWeaponName(id), c.loadout[slot] === id, slot < 2 && c.loadout[1 - slot] === id)).join('')}</select></label>`;
  const skinSelect = (slot: number) => { const i = weaponIndex(c.loadout[slot]), w = WEAPONS[i]; return `<label>${displayWeaponName(w.id)}<select data-range-skin="${i}">${w.skins.map((s, j) => option(String(j), localizeText(s.name), c.skins[i] === j)).join('')}</select></label>`; };
  panel.innerHTML = `<div class="range-row">${slotSelect(0)}${slotSelect(1)}</div><div class="range-row">${slotSelect(2)}<label>${bilingual('道具', 'Utility')}<select data-range-utility>${UTILITY_IDS.map((id) => option(id, bilingual(...UTILITY_INFO[id].name), c.utility === id)).join('')}</select></label></div>`
    + `<div class="range-row">${skinSelect(0)}${skinSelect(1)}</div><div class="range-row">${skinSelect(2)}<span></span></div>`
    + `<div class="range-row"><button type="button" data-range-reset>${bilingual('重置假人', 'Reset dummies')}</button><button type="button" data-range-stats>${bilingual('清零数据', 'Clear stats')}</button></div>`;
  const apply = () => { if (rangeSession?.practice?.apply(rangeChoice)) void scene.prepareLoadout(rangeChoice.loadout.map(weaponIndex), rangeChoice.skins); renderRangePanel(); };
  panel.querySelectorAll<HTMLSelectElement>('[data-range-slot]').forEach((s) => s.onchange = () => { const next = [...c.loadout] as Loadout; next[Number(s.dataset.rangeSlot)] = s.value as never; if (next[0] !== next[1]) { rangeChoice = { ...c, loadout: next }; apply(); } else renderRangePanel(); });
  panel.querySelectorAll<HTMLSelectElement>('[data-range-skin]').forEach((s) => s.onchange = () => { const next = c.skins.slice(); next[Number(s.dataset.rangeSkin)] = Number(s.value); rangeChoice = { ...c, skins: next }; apply(); });
  panel.querySelector<HTMLSelectElement>('[data-range-utility]')!.onchange = (e) => { rangeChoice = { ...c, utility: (e.target as HTMLSelectElement).value as UtilityId }; apply(); };
  panel.querySelector<HTMLButtonElement>('[data-range-reset]')!.onclick = () => rangeSession?.practice?.resetDummies();
  panel.querySelector<HTMLButtonElement>('[data-range-stats]')!.onclick = () => game?.rangeStats?.reset();
}

function backToLobby(reason: string) {
  rangeSession = null; renderRangePanel();
  pointerLockFailed = false; renderPointerLockNote();
  game = null; rematchRequested = false; resultsBoard.setEnded(false); renderResultsBoard();
  hud.show(false);
  $('pause').classList.add('hidden');
  $('endcard').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  if (reason) showError(reason);
}

controls.onLockChange = (locked) => {
  if (!game || game.ended || pageExited || settingsPanel.open) {
    // A browser can grant an earlier request after Leave or a modal opens.
    // Physical capture must not outlive the gameplay session that requested it.
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    return;
  }
  if (locked) { pointerLockFailed = false; renderPointerLockNote(); }
  $('pause').classList.toggle('hidden', locked);
  // offline: Esc freezes everything (bots, bullets, clock, effects); online the server keeps going
  game.setPaused(!locked && !game.online);
};
controls.onLockError = () => {
  if (!game || game.ended || pageExited || settingsPanel.open || (document.getElementById('armory-dialog') as HTMLDialogElement|null)?.open) return;
  pointerLockFailed = true; renderPointerLockNote(); controls.onLockChange(false);
};
$('resume').onclick = () => { if (game && !game.ended && !pageExited && !settingsPanel.open) controls.lock(); };
canvas.addEventListener('click', () => { if (game && !game.ended && !controls.locked && !settingsPanel.open) controls.lock(); });
$('rematch').onclick = () => { if (game?.rematch()) { rematchRequested = true; renderResultsBoard(); } };
$('endleave').onclick = () => game?.stop();
$('leave').onclick = () => game?.stop();

const languageToggle = createLanguageToggle($('lobby-language'));
document.addEventListener('pointerlockchange', () => { languageToggle.hidden = !!document.pointerLockElement; });
const renderNamePlaceholder = () => { nameInput.placeholder = bilingual('请输入你的名字', 'Enter your name'); };
renderNamePlaceholder();
localizeDom(document.body);
onLanguageChange(() => {
  lobbyShell.language(); modeShell(mode); renderNamePlaceholder();
  renderChars(); renderMaps(); renderLoadout(); renderSkins(); renderControlHints(); renderResultsBoard(); renderMatchBriefing(); renderStartupStatus(); renderPointerLockNote();
  if (loadoutStore.notice) $('loadout-status').textContent = localizeText(loadoutStore.notice);
  $('endtitle').textContent = localizeText(endTitleSource);
  $('error').textContent = errorSource();
  localizeDom(document.body);
});

// idle render behind the lobby
const lobbyFrames=new FrameGate(24);
(function idle(t: number) {
  if (!game && worldRenderVisible(document) && lobbyFrames.allow(t)) {
    const a = t / 9000, [bx, , bz] = getMap(mapId).data.bounds.max;
    scene.setView(Math.sin(a) * bx * 0.83, 18, Math.cos(a) * bz * 0.86, a, -0.5);
    scene.render(false);
  }
  requestAnimationFrame(idle);
})(0);

if (params.has('autostart')) {
  if (controls.force && !nameInput.value) nameInput.value = 'Test Player';
  $('play').click();
}
