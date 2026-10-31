import { arenaMatchBriefing, arenaControlHints, arenaPauseLabel } from './matchBriefing.ts';
import { bilingual, createLanguageToggle, localizeDom, localizeText, onLanguageChange } from '../../shared-client/i18n.ts';
import { ResultsBoard, syncResultsBoardLayers } from './resultsBoard.ts';
import { getMap, MAPS, mapIdOf } from '../shared/arenaMap.ts';
import { CHARACTERS, WEAPONS, weaponIndex, type TeamLayout } from '../shared/content.ts';
import { DEFAULT_PORT, PUBLIC_SERVER, type JoinOptions } from '../shared/protocol.ts';
import { sfx } from './audio.ts';
import { Controls } from './controls.ts';
import { SettingsStore, createSettingsPanel } from '../../shared-client/settings.ts';
import '../../shared-client/settings.css';
import { Game } from './game.ts';
import { Hud } from './hud.ts';
import { LoadoutStore, loadoutCards, sanitizedSkins, displayWeaponName } from './loadout.ts';
import { ArenaScene } from './scene.ts';
import { joinOnline, startOffline, type Session } from './session.ts';
import asterThumb from './assets/maps/aster.webp';
import sakuraThumb from './assets/maps/sakura.webp';
import blackflagThumb from './assets/maps/blackflag.webp';
import frostcourtThumb from './assets/maps/frostcourt.webp';
import camlannThumb from './assets/maps/camlann.webp';

const MAP_THUMBS: Record<string, string> = { aster: asterThumb, sakura: sakuraThumb, blackflag: blackflagThumb, frostcourt: frostcourtThumb, camlann: camlannThumb };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const canvas = $<HTMLCanvasElement>('view');
const scene = new ArenaScene(canvas, params.has('low') ? 'low' : 'high');
// Preserve reusable effects in the back/forward cache; release only on final page exit.
addEventListener('pagehide', (event) => { if (!event.persisted) scene.disposeCombatEffects(); });
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
let mode: 'offline' | 'online' = params.get('mode') === 'online' ? 'online' : 'offline';
const settingsPanel = createSettingsPanel(settings, {
  onOpen() {
    controls.blocked = true; controls.clearAll();
    if (game && !game.online) game.setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
  },
  onClose() { controls.blocked = false; controls.clearAll(); },
});
controls.onSettings = () => { if (!starting && !pageExited) settingsPanel.show(); };
$('settings-lobby').onclick = () => { if (!starting && !game && !pageExited) settingsPanel.show(); };
$('settings-pause').onclick = () => { if (game && !game.ended && !starting && !pageExited && !$('pause').classList.contains('hidden')) settingsPanel.show(); };
function renderControlHints() {
  const k = (action: string) => settings.label(action);
  $('control-hints').textContent = arenaControlHints(k, mode);
  $('dash').querySelector('kbd')!.textContent = k('dash'); $('shield').querySelector('kbd')!.textContent = k('shield');
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
let char = Number.isInteger(saved.char) && CHARACTERS[saved.char] ? saved.char : 0;
let mapId = mapIdOf(params.get('map') ?? saved.map);
const skins = sanitizedSkins(saved.skins);
$<HTMLInputElement>('name').value = saved.name ?? 'Max';
// Local/LAN pages default to the Colyseus server next to them; the public (https) site defaults to the
// Cloudflare Worker, and ignores a remembered plain ws:// address that an https page can't open anyway.
const localHost = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)|\.local$/.test(location.hostname) || !location.hostname;
const savedServer = location.protocol === 'https:' && String(saved.server ?? '').startsWith('ws://') ? undefined : saved.server;
$<HTMLInputElement>('server').value = params.get('server') ?? savedServer ?? (localHost ? `ws://${location.hostname || 'localhost'}:${DEFAULT_PORT}` : PUBLIC_SERVER);
if (['1v1', '1v2', '2v2'].includes(saved.layout)) $<HTMLSelectElement>('layout').value = saved.layout;

function renderChars() {
  $('chars').innerHTML = CHARACTERS.map((c, i) =>
    `<button class="char ${i === char ? 'on' : ''}" data-i="${i}" style="--c:#${c.color.toString(16)}"><b>${c.name}</b><span>${bilingual(`HP ${c.hp} · 速度 ${c.speed}`, `HP ${c.hp} · Speed ${c.speed}`)}</span></button>`).join('');
  $('chars').querySelectorAll<HTMLButtonElement>('.char').forEach((b) => b.onclick = () => { char = Number(b.dataset.i); renderChars(); });
}
function renderMaps() {
  $('maps').innerHTML = MAPS.map((m) =>
    `<button class="mapcard ${m.id === mapId ? 'on' : ''}" data-id="${m.id}"><img src="${MAP_THUMBS[m.id] ?? ''}" alt="" /><b>${localizeText(m.name)}</b><span>${bilingual(`第 ${m.chapter} 章`, `Chapter ${m.chapter}`)} · ${localizeText(m.blurb)}</span></button>`).join('');
  $('maps').querySelectorAll<HTMLButtonElement>('.mapcard').forEach((b) => b.onclick = () => pickMap(b.dataset.id!));
  $('title').textContent = localizeText(MAPS.find((m) => m.id === mapId)!.name);
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
  $('skins').innerHTML = loadoutStore.value.map((id) => {
    const i = weaponIndex(id), w = WEAPONS[i];
    return `<label>${displayWeaponName(w.id)}<select data-w="${i}">${w.skins.map((s, j) => `<option value="${j}" ${skins[i] === j ? 'selected' : ''}>${localizeText(s.name)}</option>`).join('')}</select></label>`;
  }).join('');
  $('skins').querySelectorAll<HTMLSelectElement>('select').forEach((s) => s.onchange = () => { skins[Number(s.dataset.w)] = Number(s.value); });
}
function renderLoadout() {
  $('loadout').innerHTML = loadoutCards(loadoutStore.value, (action) => settings.label(action)).map((card) =>
    `<label class="loadout-item"><span class="loadout-heading"><b>${card.label}</b><kbd data-slot-key="${card.slot}">${card.key}</kbd></span><select data-slot="${card.slot}" aria-label="${card.label}">${card.choices.map((choice) => `<option value="${choice.id}" ${choice.id === card.id ? 'selected' : ''} ${choice.disabled ? 'disabled' : ''}>${choice.name}${choice.disabled ? bilingual('（另一槽已选）', ' (selected in other slot)') : ''}</option>`).join('')}</select><span class="loadout-role">${card.role}</span><small>${card.stats}</small></label>`).join('');
  $('loadout').querySelectorAll<HTMLSelectElement>('select').forEach((select) => select.onchange = () => {
    const result = loadoutStore.select(Number(select.dataset.slot), select.value);
    renderLoadout(); renderSkins();
    $('loadout-status').textContent = localizeText(result ? '请选择两把不同的枪和一件近战；本次无效选择未应用。' : loadoutStore.notice);
  });
}

function renderMatchBriefing() {
  const briefing = arenaMatchBriefing({ layout: $<HTMLSelectElement>('layout').value as TeamLayout,
    team: $<HTMLSelectElement>('team').value as 'A' | 'B' | 'auto', mode, bots: $<HTMLInputElement>('bots').checked });
  $('match-rules').textContent = briefing.rules;
  $('match-teams').textContent = briefing.teams;
  $('match-connection').textContent = briefing.connection;
  $('pause-title').textContent = arenaPauseLabel(mode);
}
for (const id of ['layout', 'team', 'bots']) $(id).addEventListener('change', renderMatchBriefing);

function setMode(m: typeof mode) {
  if (starting || game || pageExited) return;
  mode = m;
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === m));
  document.body.classList.toggle('online', m === 'online');
  if (m === 'offline' && $<HTMLSelectElement>('team').value === 'auto') $<HTMLSelectElement>('team').value = 'A';
  renderMatchBriefing(); renderControlHints();
}
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.onclick = () => setMode(t.dataset.mode as typeof mode));
$('armory').onclick = async () => {
  const generation = attemptGeneration;
  const eligible = () => !starting && !game && !pageExited && generation === attemptGeneration;
  if (!eligible()) return;
  try { const armory = await import('./armory.ts'); if (eligible()) armory.openArmory(); }
  catch (error) { if (eligible()) showError(() => bilingual(`武器展示无法打开：${localizeText(String(error))}`, `Could not open the armory: ${localizeText(String(error))}`)); }
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

type StartPhase = 'map' | 'join' | 'game';
let attemptGeneration = 0;
let activeStart: { id: number; phase: StartPhase; mode: typeof mode } | null = null;
function renderStartupStatus() {
  const phase = activeStart?.phase;
  $('loading-status').textContent = phase === 'join' ? bilingual('正在连接服务器…', 'Connecting to server…')
    : phase === 'game' ? bilingual('正在准备对局…', 'Preparing match…') : bilingual('加载地图…', 'Loading map…');
  $('cancel-start').textContent = bilingual('取消并返回大厅', 'Cancel and return to lobby');
  $('loading-note').textContent = bilingual('取消会停止本次进入；已发出的资源或连接请求可能稍后结束。', 'Cancel stops this entry attempt; pending asset or connection requests may finish later.');
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
  if (starting || game || pageExited || settingsPanel.open) return;
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
    name: $<HTMLInputElement>('name').value.trim() || 'Player',
    char, skins: skins.slice(), loadout: loadoutStore.value, map: mapId,
    bots: $<HTMLInputElement>('bots').checked || undefined,
  };
  const server = $<HTMLInputElement>('server').value.trim();
  const difficulty = $<HTMLSelectElement>('difficulty').value as 'easy' | 'normal' | 'hard';
  const current = () => activeStart?.id === attempt.id && !pageExited;
  let ownedSession: Session | null = null;
  const closeOwned = () => { const session = ownedSession; ownedSession = null; try { session?.close(); } catch { /* best effort for a failed/stale startup */ } };
  try { localStorage.setItem('arena-lobby', JSON.stringify({ name: opts.name, layout: opts.layout, char, skins, server, map: mapId })); } catch { /* private mode */ }
  try {
    sfx.unlock();
    await mapReady;
    if (!current()) return;
    attempt.phase = 'join'; renderStartupStatus();
    ownedSession = attempt.mode === 'online' ? await joinOnline(server, opts) : startOffline(opts, difficulty);
    if (!current()) { closeOwned(); return; }
    attempt.phase = 'game'; renderStartupStatus();
    const session = ownedSession;
    game = new Game(session, scene, controls, hud, (reason) => backToLobby(reason));
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

function backToLobby(reason: string) {
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
  if (!game || game.ended || pageExited) return;
  if (locked) { pointerLockFailed = false; renderPointerLockNote(); }
  $('pause').classList.toggle('hidden', locked);
  // offline: Esc freezes everything (bots, bullets, clock, effects); online the server keeps going
  game.setPaused(!locked && !game.online);
};
controls.onLockError = () => {
  if (!game || game.ended || pageExited || settingsPanel.open) return;
  pointerLockFailed = true; renderPointerLockNote(); controls.onLockChange(false);
};
$('resume').onclick = () => { if (game && !game.ended && !pageExited && !settingsPanel.open) controls.lock(); };
canvas.addEventListener('click', () => { if (game && !game.ended && !controls.locked && !settingsPanel.open) controls.lock(); });
$('rematch').onclick = () => { if (game?.rematch()) { rematchRequested = true; renderResultsBoard(); } };
$('endleave').onclick = () => game?.stop();
$('leave').onclick = () => game?.stop();

const languageToggle = createLanguageToggle();
document.addEventListener('pointerlockchange', () => { languageToggle.hidden = !!document.pointerLockElement; });
localizeDom(document.body);
onLanguageChange(() => {
  renderChars(); renderMaps(); renderLoadout(); renderSkins(); renderControlHints(); renderResultsBoard(); renderMatchBriefing(); renderStartupStatus(); renderPointerLockNote();
  if (loadoutStore.notice) $('loadout-status').textContent = localizeText(loadoutStore.notice);
  $('endtitle').textContent = localizeText(endTitleSource);
  $('error').textContent = errorSource();
  localizeDom(document.body);
});

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
