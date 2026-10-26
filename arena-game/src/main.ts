import { getMap, MAPS, mapIdOf } from '../shared/arenaMap.ts';
import { CHARACTERS, WEAPONS, weaponIndex, type TeamLayout } from '../shared/content.ts';
import { DEFAULT_PORT, PUBLIC_SERVER, type JoinOptions } from '../shared/protocol.ts';
import { sfx } from './audio.ts';
import { Controls } from './controls.ts';
import { SettingsStore, createSettingsPanel } from '../../shared-client/settings.ts';
import '../../shared-client/settings.css';
import { Game } from './game.ts';
import { Hud } from './hud.ts';
import { LoadoutStore, loadoutCards, sanitizedSkins } from './loadout.ts';
import { ArenaScene } from './scene.ts';
import { joinOnline, startOffline } from './session.ts';
import asterThumb from './assets/maps/aster.webp';
import zenithThumb from './assets/maps/zenith.webp';
import sakuraThumb from './assets/maps/sakura.webp';
import neonThumb from './assets/maps/neon.webp';

const MAP_THUMBS: Record<string, string> = { aster: asterThumb, zenith: zenithThumb, sakura: sakuraThumb, neon: neonThumb };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const canvas = $<HTMLCanvasElement>('view');
const scene = new ArenaScene(canvas, params.has('low') ? 'low' : 'high');
const settings = new SettingsStore('arena');
const loadoutStore = new LoadoutStore();
const controls = new Controls(canvas, settings);
controls.force = params.has('test');
(window as unknown as { arena: unknown }).arena = { controls, scene };
const hud = new Hud();
let game: Game | null = null;
let mode: 'offline' | 'online' = params.get('mode') === 'online' ? 'online' : 'offline';
const settingsPanel = createSettingsPanel(settings, {
  onOpen() {
    controls.blocked = true; controls.clearAll();
    if (game && !game.online) game.setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
  },
  onClose() { controls.blocked = false; controls.clearAll(); },
});
controls.onSettings = () => settingsPanel.show();
$('settings-lobby').onclick = () => settingsPanel.show();
$('settings-pause').onclick = () => settingsPanel.show();
function renderControlHints() {
  const k = (action: string) => settings.label(action);
  $('control-hints').textContent = `${k('forward')}/${k('left')}/${k('back')}/${k('right')} 移动 · ${k('fire')} 射击 / 近战 · ${k('aim')} 按住瞄准 · ${k('jump')} 跳 · ${k('dash')} 冲刺 · ${k('shield')} 护盾 · ${k('reload')} 换弹 · ${k('crouch')} 按住下蹲 · ${k('weapon1')}/${k('weapon2')}/${k('weapon3')} 切换配装 · ${k('prevWeapon')}/${k('nextWeapon')} 循环切换 · ${k('scoreboard')} 计分板 · ${k('settings')} 设置 · Esc 暂停`;
  $('dash').querySelector('kbd')!.textContent = k('dash'); $('shield').querySelector('kbd')!.textContent = k('shield');
  $('wslots').querySelectorAll('kbd').forEach((el, i) => el.textContent = k(`weapon${i + 1}`));
  $('loadout').querySelectorAll<HTMLElement>('[data-slot-key]').forEach((el) => el.textContent = k(`weapon${Number(el.dataset.slotKey) + 1}`));
  $('end-score-hint').textContent = `按 ${k('scoreboard')} 可查看计分板。`;
}
settings.subscribe(renderControlHints); renderControlHints();


// ---------- lobby ----------

const saved = (() => { try { const raw = JSON.parse(localStorage.getItem('arena-lobby') ?? '{}'); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; } catch { return {}; } })();
let char = Number.isInteger(saved.char) && CHARACTERS[saved.char] ? saved.char : 0;
let mapId = mapIdOf(params.get('map') ?? saved.map);
const skins = sanitizedSkins(saved.skins);
$<HTMLInputElement>('name').value = saved.name ?? 'Max';
// Local/LAN pages default to the Colyseus server next to them; the public (https) site defaults to the
// Cloudflare Worker, and ignores a remembered plain ws:// address that an https page can't open anyway.
const localHost = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)|\.local$/.test(location.hostname) || !location.hostname;
const savedServer = location.protocol === 'https:' && String(saved.server ?? '').startsWith('ws://') ? undefined : saved.server;
$<HTMLInputElement>('server').value = params.get('server') ?? savedServer ?? (localHost ? `ws://${location.hostname || 'localhost'}:${DEFAULT_PORT}` : PUBLIC_SERVER);
if (saved.layout) $<HTMLSelectElement>('layout').value = saved.layout;

function renderChars() {
  $('chars').innerHTML = CHARACTERS.map((c, i) =>
    `<button class="char ${i === char ? 'on' : ''}" data-i="${i}" style="--c:#${c.color.toString(16)}"><b>${c.name}</b><span>HP ${c.hp} · 速度 ${c.speed}</span></button>`).join('');
  $('chars').querySelectorAll<HTMLButtonElement>('.char').forEach((b) => b.onclick = () => { char = Number(b.dataset.i); renderChars(); });
}
function renderMaps() {
  $('maps').innerHTML = MAPS.map((m) =>
    `<button class="mapcard ${m.id === mapId ? 'on' : ''}" data-id="${m.id}"><img src="${MAP_THUMBS[m.id] ?? ''}" alt="" /><b>${m.name}</b><span>${m.blurb}</span></button>`).join('');
  $('maps').querySelectorAll<HTMLButtonElement>('.mapcard').forEach((b) => b.onclick = () => pickMap(b.dataset.id!));
  $('title').textContent = MAPS.find((m) => m.id === mapId)!.name;
}
let mapReady: Promise<void>;
function pickMap(id: string) {
  mapId = mapIdOf(id);
  renderMaps();
  mapReady = scene.loadMap(mapId, getMap(mapId).data.presentation?.preset ?? MAPS.find((m) => m.id === mapId)?.preset);
  mapReady.catch((e) => showError(`地图加载失败：${(e as Error).message}`));
}
function renderSkins() {
  $('skins').innerHTML = loadoutStore.value.map((id) => {
    const i = weaponIndex(id), w = WEAPONS[i];
    return `<label>${w.name}<select data-w="${i}">${w.skins.map((s, j) => `<option value="${j}" ${skins[i] === j ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>`;
  }).join('');
  $('skins').querySelectorAll<HTMLSelectElement>('select').forEach((s) => s.onchange = () => { skins[Number(s.dataset.w)] = Number(s.value); });
}
function renderLoadout() {
  $('loadout').innerHTML = loadoutCards(loadoutStore.value, (action) => settings.label(action)).map((card) =>
    `<label class="loadout-item"><span class="loadout-heading"><b>${card.label}</b><kbd data-slot-key="${card.slot}">${card.key}</kbd></span><select data-slot="${card.slot}" aria-label="${card.label}">${card.choices.map((choice) => `<option value="${choice.id}" ${choice.id === card.id ? 'selected' : ''} ${choice.disabled ? 'disabled' : ''}>${choice.name}${choice.disabled ? '（另一槽已选）' : ''}</option>`).join('')}</select><span class="loadout-role">${card.role}</span><small>${card.stats}</small></label>`).join('');
  $('loadout').querySelectorAll<HTMLSelectElement>('select').forEach((select) => select.onchange = () => {
    const result = loadoutStore.select(Number(select.dataset.slot), select.value);
    renderLoadout(); renderSkins();
    $('loadout-status').textContent = result ? '请选择两把不同的枪和一件近战；本次无效选择未应用。' : loadoutStore.notice;
  });
}

function setMode(m: typeof mode) {
  mode = m;
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === m));
  document.body.classList.toggle('online', m === 'online');
  if (m === 'offline' && $<HTMLSelectElement>('team').value === 'auto') $<HTMLSelectElement>('team').value = 'A';
}
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.onclick = () => setMode(t.dataset.mode as typeof mode));
$('armory').onclick = async () => {
  try { (await import('./armory.ts')).openArmory(); }
  catch (error) { showError(`武器展示无法打开：${String(error)}`); }
};
renderChars();
renderLoadout();
renderSkins();
if (loadoutStore.notice) $('loadout-status').textContent = loadoutStore.notice;
setMode(mode);
pickMap(mapId);

function showError(msg: string) {
  $('error').textContent = msg;
  $('error').classList.toggle('hidden', !msg);
}

let starting = false;
$('play').onclick = async () => {
  if (starting) return;
  starting = true; $<HTMLButtonElement>('play').disabled = true;
  sfx.unlock();
  showError('');
  const opts: JoinOptions = {
    layout: $<HTMLSelectElement>('layout').value as TeamLayout,
    team: $<HTMLSelectElement>('team').value as JoinOptions['team'],
    name: $<HTMLInputElement>('name').value.trim() || 'Player',
    char, skins: skins.slice(), loadout: loadoutStore.value,
    map: mapId,
    // only sent when on: the matchmaker can't filter on a false value
    bots: $<HTMLInputElement>('bots').checked || undefined,
  };
  const server = $<HTMLInputElement>('server').value.trim();
  try { localStorage.setItem('arena-lobby', JSON.stringify({ name: opts.name, layout: opts.layout, char, skins, server, map: mapId })); } catch { /* private mode */ }
  $('loading').classList.remove('hidden');
  try {
    await mapReady;
    const session = mode === 'online'
      ? await joinOnline(server, opts)
      : startOffline(opts, $<HTMLSelectElement>('difficulty').value as 'easy' | 'normal' | 'hard');
    $('lobby').classList.add('hidden');
    hud.show(true);
    game = new Game(session, scene, controls, hud, (reason) => backToLobby(reason));
    game.onEnded = (title) => {
      $('endtitle').textContent = title;
      $('pause').classList.add('hidden');
      $('endcard').classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    };
    game.onRestart = () => { $('endcard').classList.add('hidden'); controls.lock(); };
    (window as unknown as { game: unknown; session: unknown }).game = game;
    (window as unknown as { session: unknown }).session = session;
    controls.lock();
  } catch (e) {
    showError(mode === 'online' ? `连接失败：${(e as Error).message}。确认服务器地址正确（本地需先 npm run server）。` : String(e));
  } finally {
    starting = false; $<HTMLButtonElement>('play').disabled = false;
    $('loading').classList.add('hidden');
  }
};

function backToLobby(reason: string) {
  game = null;
  hud.show(false);
  $('pause').classList.add('hidden');
  $('endcard').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  if (reason) showError(reason);
}

controls.onLockChange = (locked) => {
  if (!game || game.ended) return;
  $('pause').classList.toggle('hidden', locked);
  // offline: Esc freezes everything (bots, bullets, clock, effects); online the server keeps going
  game.setPaused(!locked && !game.online);
};
$('resume').onclick = () => controls.lock();
canvas.addEventListener('click', () => { if (game && !game.ended && !controls.locked && !settingsPanel.open) controls.lock(); });
$('rematch').onclick = () => game?.rematch();
$('endleave').onclick = () => game?.stop();
$('leave').onclick = () => game?.stop();

// idle render behind the lobby
(function idle(t: number) {
  if (!game) {
    const a = t / 9000, [bx, , bz] = getMap(mapId).data.bounds.max;
    scene.setView(Math.sin(a) * bx * 0.83, 18, Math.cos(a) * bz * 0.86, a, -0.5);
    scene.render(false);
  }
  requestAnimationFrame(idle);
})(0);

if (params.has('autostart')) $('play').click();
