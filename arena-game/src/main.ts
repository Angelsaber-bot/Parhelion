import { CHARACTERS, WEAPONS, type TeamLayout } from '../shared/content.ts';
import { DEFAULT_PORT, type JoinOptions } from '../shared/protocol.ts';
import { sfx } from './audio.ts';
import { Controls } from './controls.ts';
import { Game } from './game.ts';
import { Hud } from './hud.ts';
import { ArenaScene } from './scene.ts';
import { joinOnline, startOffline } from './session.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const canvas = $<HTMLCanvasElement>('view');
const scene = new ArenaScene(canvas, params.has('low') ? 'low' : 'high');
const controls = new Controls(canvas);
controls.force = params.has('test');
(window as unknown as { arena: unknown }).arena = { controls, scene };
const hud = new Hud();
let game: Game | null = null;
let mode: 'offline' | 'online' = params.get('mode') === 'online' ? 'online' : 'offline';

// ---------- lobby ----------

const saved = (() => { try { return JSON.parse(localStorage.getItem('arena-lobby') ?? '{}'); } catch { return {}; } })();
let char = saved.char ?? 0;
const skins: number[] = saved.skins ?? WEAPONS.map(() => 0);
$<HTMLInputElement>('name').value = saved.name ?? 'Max';
$<HTMLInputElement>('server').value = params.get('server') ?? saved.server ?? `ws://${location.hostname || 'localhost'}:${DEFAULT_PORT}`;
if (saved.layout) $<HTMLSelectElement>('layout').value = saved.layout;

function renderChars() {
  $('chars').innerHTML = CHARACTERS.map((c, i) =>
    `<button class="char ${i === char ? 'on' : ''}" data-i="${i}" style="--c:#${c.color.toString(16)}"><b>${c.name}</b><span>HP ${c.hp} · 速度 ${c.speed}</span></button>`).join('');
  $('chars').querySelectorAll<HTMLButtonElement>('.char').forEach((b) => b.onclick = () => { char = Number(b.dataset.i); renderChars(); });
}
function renderSkins() {
  $('skins').innerHTML = WEAPONS.map((w, i) =>
    `<label>${w.name}<select data-w="${i}">${w.skins.map((s, j) => `<option value="${j}" ${skins[i] === j ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>`).join('');
  $('skins').querySelectorAll<HTMLSelectElement>('select').forEach((s) => s.onchange = () => { skins[Number(s.dataset.w)] = Number(s.value); });
}
function setMode(m: typeof mode) {
  mode = m;
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.classList.toggle('on', t.dataset.mode === m));
  document.body.classList.toggle('online', m === 'online');
  if (m === 'offline' && $<HTMLSelectElement>('team').value === 'auto') $<HTMLSelectElement>('team').value = 'A';
}
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.onclick = () => setMode(t.dataset.mode as typeof mode));
renderChars();
renderSkins();
setMode(mode);

const mapReady = scene.loadMap();

function showError(msg: string) {
  $('error').textContent = msg;
  $('error').classList.toggle('hidden', !msg);
}

$('play').onclick = async () => {
  sfx.unlock();
  showError('');
  const opts: JoinOptions = {
    layout: $<HTMLSelectElement>('layout').value as TeamLayout,
    team: $<HTMLSelectElement>('team').value as JoinOptions['team'],
    name: $<HTMLInputElement>('name').value.trim() || 'Player',
    char, skins: skins.slice(),
    // only sent when on: the matchmaker can't filter on a false value
    bots: $<HTMLInputElement>('bots').checked || undefined,
  };
  const server = $<HTMLInputElement>('server').value.trim();
  try { localStorage.setItem('arena-lobby', JSON.stringify({ name: opts.name, layout: opts.layout, char, skins, server })); } catch { /* private mode */ }
  $('loading').classList.remove('hidden');
  try {
    await mapReady;
    const session = mode === 'online'
      ? await joinOnline(server, opts)
      : startOffline(opts, $<HTMLSelectElement>('difficulty').value as 'easy' | 'normal' | 'hard');
    $('lobby').classList.add('hidden');
    hud.show(true);
    game = new Game(session, scene, controls, hud, (reason) => backToLobby(reason));
    (window as unknown as { game: unknown; session: unknown }).game = game;
    (window as unknown as { session: unknown }).session = session;
    controls.lock();
  } catch (e) {
    showError(mode === 'online' ? `连接失败：${(e as Error).message}。确认服务器已启动（npm run server）。` : String(e));
  } finally {
    $('loading').classList.add('hidden');
  }
};

function backToLobby(reason: string) {
  game = null;
  hud.show(false);
  $('pause').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  if (reason) showError(reason);
}

controls.onLockChange = (locked) => {
  if (!game) return;
  $('pause').classList.toggle('hidden', locked);
};
$('resume').onclick = () => controls.lock();
canvas.addEventListener('click', () => { if (game && !controls.locked) controls.lock(); });
$('leave').onclick = () => game?.stop();

// idle render behind the lobby
(function idle(t: number) {
  if (!game) {
    const a = t / 9000;
    scene.setView(Math.sin(a) * 30, 18, Math.cos(a) * 24, a, -0.5);
    scene.render(false);
  }
  requestAnimationFrame(idle);
})(0);

if (params.has('autostart')) $('play').click();
