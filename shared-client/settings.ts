/** Shared browser settings. No simulation or Three.js dependency. */
export type SettingsMode = 'arena' | 'world';
export interface ActionDef { id: string; label: string; binding: string }
export interface InputSettings { version: 1; sensitivity: number; adsSensitivity: number; invertY: boolean; bindings: Record<string, string> }
export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const move: ActionDef[] = [
  { id: 'forward', label: '向前', binding: 'KeyW' }, { id: 'back', label: '向后', binding: 'KeyS' },
  { id: 'left', label: '向左', binding: 'KeyA' }, { id: 'right', label: '向右', binding: 'KeyD' },
  { id: 'jump', label: '跳跃', binding: 'Space' }, { id: 'fire', label: '射击', binding: 'Mouse0' },
  { id: 'aim', label: '按住瞄准', binding: 'Mouse2' }, { id: 'settings', label: '设置菜单', binding: 'KeyO' },
];
export const ACTIONS: Record<SettingsMode, ActionDef[]> = {
  arena: [...move, { id: 'dash', label: '冲刺', binding: 'ShiftLeft' }, { id: 'shield', label: '护盾', binding: 'KeyQ' },
    { id: 'reload', label: '换弹', binding: 'KeyR' }, { id: 'crouch', label: '按住下蹲', binding: 'KeyC' },
    { id: 'scoreboard', label: '按住计分板', binding: 'Tab' },
    ...[1,2,3].map((n) => ({ id: `weapon${n}`, label: `武器 ${n}`, binding: `Digit${n}` })),
    { id: 'nextWeapon', label: '下一把武器', binding: 'WheelDown' }, { id: 'prevWeapon', label: '上一把武器', binding: 'WheelUp' }],
  world: [...move, { id: 'sprint', label: '奔跑', binding: 'ShiftLeft' }, { id: 'interact', label: '互动 / 飞行上升', binding: 'KeyE' },
    { id: 'descend', label: '飞行下降', binding: 'KeyQ' }, { id: 'map', label: '大地图', binding: 'KeyM' },
    { id: 'guide', label: '任务指引', binding: 'KeyG' }, { id: 'help', label: '帮助开关', binding: 'KeyH' },
    { id: 'fly', label: '飞行调试', binding: 'KeyF' }, { id: 'collision', label: '碰撞体调试', binding: 'KeyC' },
    { id: 'reset', label: '重置进度', binding: 'KeyR' },
    ...[1,2,3,4,5,6,7].map((n) => ({ id: `teleport${n}`, label: `调试传送 ${n}`, binding: `Digit${n}` }))],
};
export function defaultSettings(mode: SettingsMode): InputSettings {
  return { version: 1, sensitivity: 1, adsSensitivity: mode === 'arena' ? .85 : .55, invertY: false,
    bindings: Object.fromEntries(ACTIONS[mode].map((a) => [a.id, a.binding])) };
}
export function validBinding(binding: unknown): binding is string {
  return typeof binding === 'string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Shift(Left|Right)|Mouse[0-4]|Wheel(Up|Down)|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(binding);
}
const HOLD_ACTIONS = new Set(['forward','back','left','right','aim','crouch','scoreboard','sprint','descend','interact']);
export function bindingAllowed(action: string, binding: unknown): binding is string { return validBinding(binding) && !(binding.startsWith('Wheel') && HOLD_ACTIONS.has(action)); }
const clamp = (v: unknown, min: number, max: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export function sanitizeSettings(mode: SettingsMode, raw: unknown): InputSettings {
  const next = defaultSettings(mode);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
  const value = raw as Partial<InputSettings>;
  if (value.version !== 1) return next;
  next.sensitivity = clamp(value.sensitivity, .1, 4, next.sensitivity);
  next.adsSensitivity = clamp(value.adsSensitivity, .1, 2, next.adsSensitivity);
  next.invertY = value.invertY === true;
  if (value.bindings && typeof value.bindings === 'object') {
    const bindings = { ...next.bindings };
    for (const a of ACTIONS[mode]) if (bindingAllowed(a.id, value.bindings[a.id])) bindings[a.id] = value.bindings[a.id];
    // Corrupt duplicate bindings must never leave movement/shooting sharing an action.
    if (new Set(Object.values(bindings)).size === Object.keys(bindings).length) next.bindings = bindings;
  }
  return next;
}
export function bindingLabel(code: string) {
  const labels: Record<string,string> = { Space: '空格', Tab: 'Tab', ShiftLeft: '左 Shift', ShiftRight: '右 Shift', Mouse0: '鼠标左键', Mouse1: '鼠标中键', Mouse2: '鼠标右键', Mouse3: '鼠标侧键 1', Mouse4: '鼠标侧键 2', WheelUp: '滚轮上', WheelDown: '滚轮下', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
  return labels[code] ?? code.replace(/^Key|^Digit/, '');
}
function browserStorage(): SettingsStorage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }
export class SettingsStore {
  value: InputSettings;
  saved = true;
  private listeners = new Set<() => void>();
  readonly key: string;
  constructor(readonly mode: SettingsMode, private storage: SettingsStorage | undefined = browserStorage()) {
    this.key = `parhelion-input-${mode}-v1`;
    let raw: unknown; try { raw = JSON.parse(storage?.getItem(this.key) ?? 'null'); } catch { /* recover defaults */ }
    this.value = sanitizeSettings(mode, raw);
  }
  label(action: string) { return bindingLabel(this.value.bindings[action] ?? ''); }
  action(binding: string) { return ACTIONS[this.mode].find((a) => this.value.bindings[a.id] === binding)?.id; }
  isDown(pressed: Set<string>, action: string) { return pressed.has(this.value.bindings[action]); }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  update(options: Partial<Pick<InputSettings, 'sensitivity' | 'adsSensitivity' | 'invertY'>>) {
    this.value = sanitizeSettings(this.mode, { ...this.value, ...options }); this.changed();
  }
  /** Returns a conflict action, or a validation error. Explicit swap avoids unbound essential controls. */
  bind(action: string, binding: string, swap = false): string | null {
    if (!ACTIONS[this.mode].some((a) => a.id === action) || !validBinding(binding)) return 'reserved';
    if (!bindingAllowed(action, binding)) return 'hold';
    const conflict = this.action(binding);
    const old = this.value.bindings[action];
    if (conflict && conflict !== action && !bindingAllowed(conflict, old)) return 'swapHold';
    if (conflict && conflict !== action && !swap) return conflict;
    this.value = { ...this.value, bindings: { ...this.value.bindings, [action]: binding } };
    if (conflict && conflict !== action) this.value.bindings[conflict] = old;
    this.changed(); return null;
  }
  reset() { this.value = defaultSettings(this.mode); this.changed(); }
  private changed() {
    try { if (this.storage) this.storage.setItem(this.key, JSON.stringify(this.value)); this.saved = !!this.storage; } catch { this.saved = false; }
    this.listeners.forEach((fn) => fn());
  }
}

export function createSettingsPanel(store: SettingsStore, hooks: { onOpen(): void; onClose(): void }) {
  const dialog = document.createElement('dialog'); dialog.className = 'input-settings'; dialog.id = `${store.mode}-settings`;
  dialog.setAttribute('aria-label', `${store.mode === 'arena' ? 'Arena' : 'World'} 操作设置`);
  dialog.innerHTML = `<header><div><small>PARHELION / CONTROLS</small><h2>操作设置</h2></div><button type="button" data-close>关闭 ✕</button></header>
    <p class="settings-note">设置只影响当前浏览器的本模式。按键可使用键盘、鼠标或滚轮；Esc 始终用于取消／关闭。</p>
    <div class="settings-sliders"><label>普通灵敏度 <output data-normal-value></output><input data-normal type="range" min="0.1" max="4" step="0.05" /></label><label>开镜灵敏度 <output data-ads-value></output><input data-ads type="range" min="0.1" max="2" step="0.05" /></label><label class="settings-check"><input data-invert type="checkbox" /> 反转垂直视角</label></div>
    <div class="settings-bindings">${ACTIONS[store.mode].map((a) => `<div><span>${a.label}</span><button type="button" data-bind="${a.id}"></button></div>`).join('')}</div>
    <p data-status role="status" aria-live="polite"></p><div class="settings-actions"><button type="button" data-cancel hidden>取消改键</button><button type="button" data-swap hidden>交换这两个动作的按键</button><button type="button" data-reset>恢复默认设置</button></div>`;
  document.body.append(dialog);
  const $ = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  let ignoreClick = false;
  let capturing: string | null = null, conflict: { action: string; binding: string } | null = null;
  const status = (text: string) => { $('[data-status]').textContent = text; };
  const cancelCapture = () => { capturing = null; conflict = null; $<HTMLButtonElement>('[data-cancel]').hidden = true; $<HTMLButtonElement>('[data-swap]').hidden = true; render(); };
  function render() {
    const v = store.value;
    $<HTMLInputElement>('[data-normal]').value = String(v.sensitivity); $('[data-normal-value]').textContent = `${v.sensitivity.toFixed(2)}×`;
    $<HTMLInputElement>('[data-ads]').value = String(v.adsSensitivity); $('[data-ads-value]').textContent = `${v.adsSensitivity.toFixed(2)}×`;
    $<HTMLInputElement>('[data-invert]').checked = v.invertY;
    dialog.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach((b) => { b.textContent = capturing === b.dataset.bind ? '按下新按键…' : store.label(b.dataset.bind!); });
  }
  const bind = (binding: string) => {
    if (!capturing) return;
    const action = capturing, result = store.bind(action, binding);
    if (result === 'reserved') { status('此按键为浏览器／退出功能保留，请选普通按键。'); return; }
    if (result === 'hold') { status('此动作需要可按住的键盘／鼠标按键，不支持滚轮。'); return; }
    if (result === 'swapHold') { conflict = null; $<HTMLButtonElement>('[data-swap]').hidden = true; status('不能把滚轮交换给需要按住的动作。请先为冲突动作选择另一个键盘／鼠标按键。'); return; }
    if (result) {
      conflict = { action, binding };
      status(`${bindingLabel(binding)} 已用于「${ACTIONS[store.mode].find((a) => a.id === result)!.label}」。可交换，或按其他键。`);
      $<HTMLButtonElement>('[data-swap]').hidden = false; return;
    }
    cancelCapture(); status(store.saved ? '已保存到本机。' : '已应用；当前浏览器无法持久保存。');
  };
  dialog.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach((b) => b.onclick = () => {
    cancelCapture(); capturing = b.dataset.bind!; $<HTMLButtonElement>('[data-cancel]').hidden = false;
    status('按下新按键、点击鼠标键或滚动滚轮。Esc 取消。'); render();
  });
  dialog.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (!capturing) return;
    e.preventDefault();
    if (e.code === 'Escape') { cancelCapture(); status('已取消改键。'); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) { status('不支持系统组合快捷键，请使用单个普通按键。'); return; }
    if (!e.repeat) bind(e.code);
  });
  dialog.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (!capturing || (e.target as Element).closest('[data-cancel],[data-close],[data-swap]')) return;
    e.preventDefault(); ignoreClick = e.button === 0; bind(`Mouse${e.button}`);
  });
  dialog.addEventListener('click', (e) => { if (ignoreClick) { ignoreClick = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  dialog.addEventListener('wheel', (e) => { e.stopPropagation(); if (capturing) { e.preventDefault(); bind(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); } }, { passive: false });
  dialog.addEventListener('contextmenu', (e) => e.preventDefault());
  dialog.addEventListener('auxclick', (e) => { e.preventDefault(); e.stopPropagation(); });
  $('[data-cancel]').onclick = () => { cancelCapture(); status('已取消改键。'); };
  $('[data-swap]').onclick = () => { if (conflict) { store.bind(conflict.action, conflict.binding, true); cancelCapture(); status(store.saved ? '已交换并保存。' : '已交换；当前浏览器无法持久保存。'); } };
  $('[data-close]').onclick = () => dialog.close();
  $('[data-reset]').onclick = () => { cancelCapture(); store.reset(); status(store.saved ? '已恢复默认并保存。' : '已恢复默认；当前浏览器无法持久保存。'); };
  $<HTMLInputElement>('[data-normal]').oninput = (e) => store.update({ sensitivity: Number((e.target as HTMLInputElement).value) });
  $<HTMLInputElement>('[data-ads]').oninput = (e) => store.update({ adsSensitivity: Number((e.target as HTMLInputElement).value) });
  $<HTMLInputElement>('[data-invert]').onchange = (e) => store.update({ invertY: (e.target as HTMLInputElement).checked });
  store.subscribe(() => { render(); status(store.saved ? '已保存到本机。' : '已应用；当前浏览器无法持久保存。'); });
  dialog.addEventListener('cancel', (e) => { if (capturing) { e.preventDefault(); cancelCapture(); status('已取消改键。'); } });
  dialog.addEventListener('close', () => { cancelCapture(); hooks.onClose(); });
  render();
  return { get open() { return dialog.open; }, show() { if (dialog.open) return; hooks.onOpen(); cancelCapture(); status(''); dialog.showModal(); }, close() { dialog.close(); } };
}
