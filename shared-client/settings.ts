import { bilingual, localizeText, localizeDom, createLanguageToggle, onLanguageChange } from './i18n';
/** Shared browser settings. No simulation or Three.js dependency. */
export type SettingsMode = 'arena' | 'world';
export type BindingSlot = 'primary' | 'secondary';
export interface ActionDef { id: string; label: string; binding: string; secondary?: string }
export interface InputSettings { version: 3; sensitivity: number; adsSensitivity: number; invertY: boolean; bindings: Record<string, string>; secondaryBindings: Record<string, string> }
export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const move: ActionDef[] = [
  { id: 'forward', label: '向前', binding: 'KeyW' }, { id: 'back', label: '向后', binding: 'KeyS' },
  { id: 'left', label: '向左', binding: 'KeyA' }, { id: 'right', label: '向右', binding: 'KeyD' },
  { id: 'jump', label: '跳跃', binding: 'Space' }, { id: 'fire', label: '射击 / 近战攻击', binding: 'Mouse0' },
  { id: 'aim', label: '按住瞄准', binding: 'KeyE', secondary: 'Mouse2' }, { id: 'settings', label: '设置菜单', binding: 'KeyO' },
];
export const ACTIONS: Record<SettingsMode, ActionDef[]> = {
  arena: [...move, { id: 'dash', label: '冲刺', binding: 'ShiftLeft', secondary: 'ShiftRight' }, { id: 'shield', label: '护盾', binding: 'KeyQ' },
    { id: 'reload', label: '换弹', binding: 'KeyR' }, { id: 'crouch', label: '按住下蹲', binding: 'KeyC' },
    { id: 'scoreboard', label: '按住计分板', binding: 'Tab' },
    ...[1,2,3].map((n) => ({ id: `weapon${n}`, label: n === 3 ? '近战槽 3' : `枪械槽 ${n}`, binding: `Digit${n}` })),
    { id: 'nextWeapon', label: '下一个装备槽', binding: 'WheelDown' }, { id: 'prevWeapon', label: '上一个装备槽', binding: 'WheelUp' }],
  world: [...move.map((a) => a.id === 'fire' ? { ...a, label: '射击' } : a),
    { id: 'sprint', label: '奔跑', binding: 'ShiftLeft', secondary: 'ShiftRight' }, { id: 'interact', label: '互动', binding: 'KeyF' },
    { id: 'summon', label: '召唤／收回从者', binding: 'KeyT' }, { id: 'inspectServant', label: '查看从者模型', binding: 'KeyU' }, { id: 'switchServant', label: '切换从者', binding: 'KeyY' },
    { id: 'map', label: '大地图', binding: 'KeyM' }, { id: 'guide', label: '任务指引', binding: 'KeyG' },
    { id: 'help', label: '帮助开关', binding: 'KeyH' }, { id: 'fly', label: '自由飞行调试', binding: 'KeyV' },
    { id: 'collision', label: '碰撞体调试', binding: 'KeyC' }, { id: 'reset', label: '重置进度', binding: 'KeyR' },
    ...[1,2,3,4,5,6,7].map((n) => ({ id: `teleport${n}`, label: `调试传送 ${n}`, binding: `Digit${n}` }))],
};
export function defaultSettings(mode: SettingsMode): InputSettings {
  return { version: 3, sensitivity: 1, adsSensitivity: mode === 'arena' ? .85 : .55, invertY: false,
    bindings: Object.fromEntries(ACTIONS[mode].map((a) => [a.id, a.binding])),
    secondaryBindings: Object.fromEntries(ACTIONS[mode].map((a) => [a.id, a.secondary ?? ''])) };
}
export function validBinding(binding: unknown): binding is string {
  return typeof binding === 'string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Shift(Left|Right)|Mouse[0-4]|Wheel(Up|Down)|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(binding);
}
const HOLD_ACTIONS = new Set(['forward','back','left','right','aim','crouch','scoreboard','sprint']);
export function bindingAllowed(action: string, binding: unknown): binding is string { return validBinding(binding) && !(binding.startsWith('Wheel') && HOLD_ACTIONS.has(action)); }
const clamp = (v: unknown, min: number, max: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const fallbackKeys = ['KeyP','KeyB','KeyN','KeyJ','KeyK','KeyL','KeyU','KeyI','KeyT','KeyY','KeyZ','KeyX','Mouse3','Mouse4','BracketLeft','BracketRight','Semicolon','Quote','Comma','Period','Slash','Backquote','Minus','Equal','Backslash', ...Array.from({ length: 10 }, (_, n) => `Digit${n}`)];
/** Repair only the conflicting/invalid binding, never discard unrelated custom controls. */
function normalizeSettings(mode: SettingsMode, raw: unknown): { value: InputSettings; notices: string[] } {
  const next = defaultSettings(mode), notices: string[] = [], value = record(raw);
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return { value: next, notices };
  next.sensitivity = clamp(value.sensitivity, .1, 4, next.sensitivity);
  next.adsSensitivity = clamp(value.adsSensitivity, .1, 2, next.adsSensitivity);
  next.invertY = value.invertY === true;
  const primary = record(value.bindings), secondary = record(value.secondaryBindings);
  const legacy = value.version === 1;
  const assignments: { action: string; slot: BindingSlot; binding: string; custom: boolean; order: number }[] = [];
  for (const [order, a] of ACTIONS[mode].entries()) {
    const oldDefault = a.id === 'aim' ? 'Mouse2' : mode === 'world' && a.id === 'interact' ? 'KeyE' : mode === 'world' && a.id === 'fly' ? 'KeyF' : a.binding;
    const old = primary[a.id], custom = bindingAllowed(a.id, old) && (!legacy || old !== oldDefault);
    if (old !== undefined && !bindingAllowed(a.id, old)) notices.push(`「${a.label}」的无效主按键已修复。`);
    assignments.push({ action: a.id, slot: 'primary', binding: custom ? old as string : a.binding, custom, order });
    const second = secondary[a.id];
    const sprintAction = a.id === 'dash' || a.id === 'sprint';
    // v2 wrote an empty alternate even for untouched defaults. Add the new alias only
    // to an unchanged left-Shift action. Existing custom primary/alternate keys win.
    const addShiftAlias = sprintAction && value.version !== 3 &&
      (old === undefined || old === 'ShiftLeft') && (second === undefined || second === '');
    const preserveCustomSprint = sprintAction && value.version !== 3 && !addShiftAlias;
    const secondBinding = addShiftAlias ? 'ShiftRight' : !legacy && (second === '' || bindingAllowed(a.id, second))
      ? second as string : preserveCustomSprint ? '' : a.secondary ?? '';
    assignments.push({ action: a.id, slot: 'secondary', binding: secondBinding, custom: !addShiftAlias && !legacy && second !== undefined, order });
  }
  // Preserve customized slots first. Remaining defaults get a free key (primary) or are omitted (secondary).
  assignments.sort((a, b) => Number(b.custom) - Number(a.custom) || Number(a.slot === 'secondary') - Number(b.slot === 'secondary') || a.order - b.order);
  const used = new Map<string, string>();
  for (const a of assignments) {
    const target = a.slot === 'primary' ? next.bindings : next.secondaryBindings;
    if (!a.binding) { target[a.action] = ''; continue; }
    let binding = a.binding;
    const other = used.get(binding);
    if (other) {
      if (other === a.action && a.slot === 'secondary') { target[a.action] = ''; continue; }
      binding = a.slot === 'secondary' ? '' : [ACTIONS[mode].find((d) => d.id === a.action)!.binding, ...fallbackKeys].find((key) => !used.has(key) && bindingAllowed(a.action, key)) ?? '';
      const label = ACTIONS[mode].find((d) => d.id === a.action)!.label;
      notices.push(`按键冲突：${bindingLabel(a.binding)} 已保留给「${ACTIONS[mode].find((d) => d.id === other)!.label}」；「${label}」${a.slot === 'secondary' ? '副按键已留空' : `改为 ${bindingLabel(binding)}`}，请在设置中确认。`);
    }
    target[a.action] = binding;
    if (binding) used.set(binding, a.action);
  }
  if (legacy) {
    const keys = (action: string) => [next.bindings[action], next.secondaryBindings[action]].filter(Boolean).map(bindingLabel).join(' / ');
    notices.unshift(mode === 'world'
      ? `操作已更新：${keys('aim')} 按住瞄准，${keys('interact')} 互动，${keys('fly')} 自由飞行调试；已移除手动飞行升降，跳跃、滑翔和上升气流保留。自定义按键已保留。`
      : `操作已更新：${keys('aim')} 均可按住瞄准；自定义按键已保留。`);
  }
  if (value.version !== 3) {
    const action = mode === 'arena' ? 'dash' : 'sprint';
    if (next.bindings[action] === 'ShiftLeft' && next.secondaryBindings[action] === 'ShiftRight')
      notices.push('冲刺操作已更新：左 Shift 或右 Shift 均可使用；自定义按键已保留。');
  }
  return { value: next, notices };
}
export function sanitizeSettings(mode: SettingsMode, raw: unknown): InputSettings { return normalizeSettings(mode, raw).value; }
export function bindingLabel(code: string) {
  const labels: Record<string,string> = { '': '未设置', Space: '空格', Tab: 'Tab', ShiftLeft: '左 Shift', ShiftRight: '右 Shift', Mouse0: '鼠标左键', Mouse1: '鼠标中键', Mouse2: '鼠标右键', Mouse3: '鼠标侧键 1', Mouse4: '鼠标侧键 2', WheelUp: '滚轮上', WheelDown: '滚轮下', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
  return localizeText(labels[code] ?? code.replace(/^Key|^Digit/, ''));
}
function browserStorage(): SettingsStorage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }
export class SettingsStore {
  value: InputSettings;
  saved = true;
  readonly notices: string[];
  private listeners = new Set<() => void>();
  readonly key: string;
  constructor(readonly mode: SettingsMode, private storage: SettingsStorage | undefined = browserStorage()) {
    this.key = `parhelion-input-${mode}-v3`;
    let raw: unknown;
    try { raw = JSON.parse(storage?.getItem(this.key) ?? storage?.getItem(`parhelion-input-${mode}-v2`) ?? storage?.getItem(`parhelion-input-${mode}-v1`) ?? 'null'); }
    catch { raw = null; }
    const normalized = normalizeSettings(mode, raw);
    this.value = normalized.value; this.notices = normalized.notices;
    if (record(raw).version === 1 || record(raw).version === 2) this.persist();
  }
  bindingsFor(action: string) { return [this.value.bindings[action], this.value.secondaryBindings[action]].filter((v): v is string => !!v); }
  label(action: string, slot?: BindingSlot) { return slot ? bindingLabel((slot === 'primary' ? this.value.bindings : this.value.secondaryBindings)[action] ?? '') : this.bindingsFor(action).map(bindingLabel).join(' / ') || localizeText('未设置'); }
  action(binding: string) { return ACTIONS[this.mode].find((a) => this.bindingsFor(a.id).includes(binding))?.id; }
  isDown(pressed: Set<string>, action: string) { return this.bindingsFor(action).some((binding) => pressed.has(binding)); }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  update(options: Partial<Pick<InputSettings, 'sensitivity' | 'adsSensitivity' | 'invertY'>>) {
    this.value = sanitizeSettings(this.mode, { ...this.value, ...options }); this.changed();
  }
  /** Returns a conflict action or validation error. Swaps are explicit and preserve the other slot. */
  bind(action: string, binding: string, swap = false, slot: BindingSlot = 'primary'): string | null {
    if (!ACTIONS[this.mode].some((a) => a.id === action) || !validBinding(binding)) return 'reserved';
    if (!bindingAllowed(action, binding)) return 'hold';
    const field = slot === 'primary' ? 'bindings' : 'secondaryBindings';
    const conflict = this.action(binding), old = this.value[field][action];
    const conflictField = conflict && this.value.bindings[conflict] === binding ? 'bindings' : 'secondaryBindings';
    if (conflict && conflict !== action && ((!old && conflictField === 'bindings') || (old && !bindingAllowed(conflict, old)))) return 'swapHold';
    if (conflict && conflict !== action && !swap) return conflict;
    this.value = { ...this.value, bindings: { ...this.value.bindings }, secondaryBindings: { ...this.value.secondaryBindings } };
    if (conflict === action && conflictField === 'bindings' && field === 'secondaryBindings' && !old) return null;
    if (conflict === action && conflictField !== field) {
      // Moving a primary into its secondary swaps rather than leaving an essential primary empty.
      this.value[conflictField][action] = old;
    }
    this.value[field][action] = binding;
    if (conflict && conflict !== action) this.value[conflictField][conflict] = old;
    this.changed(); return null;
  }
  clearSecondary(action: string) { if (ACTIONS[this.mode].some((a) => a.id === action)) { this.value.secondaryBindings[action] = ''; this.changed(); } }
  reset() { this.value = defaultSettings(this.mode); this.changed(); }
  private persist() {
    try { if (this.storage) this.storage.setItem(this.key, JSON.stringify(this.value)); this.saved = !!this.storage; } catch { this.saved = false; }
  }
  private changed() { this.persist(); this.listeners.forEach((fn) => fn()); }
}

export function createSettingsPanel(store: SettingsStore, hooks: { onOpen(): void; onClose(): void }) {
  const dialog = document.createElement('dialog'); dialog.className = 'input-settings'; dialog.id = `${store.mode}-settings`;
  dialog.setAttribute('aria-label', `${store.mode === 'arena' ? 'Arena' : 'World'} ${localizeText('操作设置')}`);
  dialog.innerHTML = `<header><div><small>PARHELION / CONTROLS</small><h2>操作设置</h2></div><button type="button" data-close>关闭 ✕</button></header>
    <p class="settings-note">设置只影响当前浏览器的本模式。主按键／副按键任意一个按住即生效，并非组合快捷键；Esc 始终用于取消／关闭。</p>
    <p class="settings-note" data-migration></p>
    <div class="settings-sliders"><label>普通灵敏度 <output data-normal-value></output><input data-normal type="range" min="0.1" max="4" step="0.05" /></label><label>开镜灵敏度 <output data-ads-value></output><input data-ads type="range" min="0.1" max="2" step="0.05" /></label><label class="settings-check"><input data-invert type="checkbox" /> 反转垂直视角</label></div>
    <div class="settings-bindings">${ACTIONS[store.mode].map((a) => `<div><span>${a.label}</span><div class="binding-pair"><button type="button" data-bind="${a.id}" data-slot="primary" aria-label="${a.label}主按键"></button><button type="button" data-bind="${a.id}" data-slot="secondary" aria-label="${a.label}副按键"></button><button type="button" data-clear="${a.id}" aria-label="移除${a.label}副按键">×</button></div></div>`).join('')}</div>
    <p data-status role="status" aria-live="polite"></p><div class="settings-actions"><button type="button" data-cancel hidden>取消改键</button><button type="button" data-swap hidden>交换这两个动作的按键</button><button type="button" data-reset>恢复默认设置</button></div>`;
  document.body.append(dialog);
  createLanguageToggle(dialog.querySelector('header')!);
  localizeDom(dialog);
  const $ = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  $('[data-migration]').textContent = localizeText(store.notices.join('\n'));
  if (store.notices.length) {
    const notice = document.createElement('aside'); notice.className = 'control-migration'; notice.setAttribute('role', 'status');
    const message = document.createElement('span'); message.textContent = localizeText(store.notices.join('\n'));
    const close = document.createElement('button'); close.type = 'button'; close.textContent = localizeText('知道了'); close.onclick = () => notice.remove();
    notice.append(message, close); document.body.append(notice);
    onLanguageChange(() => { message.textContent = localizeText(store.notices.join('\n')); close.textContent = localizeText('知道了'); });
  }
  let ignoreClick = false;
  let capturing: { action: string; slot: BindingSlot } | null = null, conflict: { action: string; slot: BindingSlot; binding: string } | null = null;
  const status = (text: string) => { $('[data-status]').textContent = localizeText(text); };
  const cancelCapture = () => { capturing = null; conflict = null; $<HTMLButtonElement>('[data-cancel]').hidden = true; $<HTMLButtonElement>('[data-swap]').hidden = true; render(); };
  function render() {
    const v = store.value;
    $<HTMLInputElement>('[data-normal]').value = String(v.sensitivity); $('[data-normal-value]').textContent = `${v.sensitivity.toFixed(2)}×`;
    $<HTMLInputElement>('[data-ads]').value = String(v.adsSensitivity); $('[data-ads-value]').textContent = `${v.adsSensitivity.toFixed(2)}×`;
    $<HTMLInputElement>('[data-invert]').checked = v.invertY;
    dialog.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach((b) => {
      b.textContent = capturing?.action === b.dataset.bind && capturing?.slot === b.dataset.slot ? localizeText('按下新按键…') : `${b.dataset.slot === 'primary' ? bilingual('主', 'Primary') : bilingual('副', 'Secondary')}: ${store.label(b.dataset.bind!, b.dataset.slot as BindingSlot)}`;
    });
    dialog.querySelectorAll<HTMLButtonElement>('[data-clear]').forEach((b) => { b.disabled = !store.value.secondaryBindings[b.dataset.clear!]; });
  }
  const bind = (binding: string) => {
    if (!capturing) return;
    const { action, slot } = capturing, result = store.bind(action, binding, false, slot);
    if (result === 'reserved') { status('此按键为浏览器／退出功能保留，请选普通按键。'); return; }
    if (result === 'hold') { status('此动作需要可按住的键盘／鼠标按键，不支持滚轮。'); return; }
    if (result === 'swapHold') { conflict = null; $<HTMLButtonElement>('[data-swap]').hidden = true; status('不能把滚轮或空副按键交换给需要主按键／按住的动作。请先为冲突动作选择另一按键。'); return; }
    if (result) {
      conflict = { action, slot, binding };
      status(bilingual(`${bindingLabel(binding)} 已用于「${ACTIONS[store.mode].find((a) => a.id === result)!.label}」。可交换，或按其他键。`, `${bindingLabel(binding)} is assigned to ${localizeText(ACTIONS[store.mode].find((a) => a.id === result)!.label)}. Swap bindings or press another key.`));
      $<HTMLButtonElement>('[data-swap]').hidden = false; return;
    }
    cancelCapture(); status(store.saved ? '已保存到本机。' : '已应用；当前浏览器无法持久保存。');
  };
  dialog.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach((b) => b.onclick = () => {
    cancelCapture(); capturing = { action: b.dataset.bind!, slot: b.dataset.slot as BindingSlot }; $<HTMLButtonElement>('[data-cancel]').hidden = false;
    status('按下新按键、点击鼠标键或滚动滚轮。Esc 取消。'); render();
  });
  dialog.querySelectorAll<HTMLButtonElement>('[data-clear]').forEach((b) => b.onclick = () => { cancelCapture(); store.clearSecondary(b.dataset.clear!); });
  dialog.addEventListener('keydown', (e) => {
    e.stopPropagation(); if (!capturing) return; e.preventDefault();
    if (e.code === 'Escape') { cancelCapture(); status('已取消改键。'); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) { status('不支持系统组合快捷键，请使用单个普通按键。'); return; }
    if (!e.repeat) bind(e.code);
  });
  dialog.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (!capturing || (e.target as Element).closest('[data-cancel],[data-close],[data-swap],[data-clear]')) return;
    e.preventDefault(); ignoreClick = e.button === 0; bind(`Mouse${e.button}`);
  });
  dialog.addEventListener('click', (e) => { if (ignoreClick) { ignoreClick = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  dialog.addEventListener('wheel', (e) => { e.stopPropagation(); if (capturing) { e.preventDefault(); bind(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); } }, { passive: false });
  dialog.addEventListener('contextmenu', (e) => e.preventDefault());
  dialog.addEventListener('auxclick', (e) => { e.preventDefault(); e.stopPropagation(); });
  $('[data-cancel]').onclick = () => { cancelCapture(); status('已取消改键。'); };
  $('[data-swap]').onclick = () => { if (conflict) { store.bind(conflict.action, conflict.binding, true, conflict.slot); cancelCapture(); status(store.saved ? '已交换并保存。' : '已交换；当前浏览器无法持久保存。'); } };
  $('[data-close]').onclick = () => dialog.close();
  $('[data-reset]').onclick = () => { cancelCapture(); store.reset(); status(store.saved ? '已恢复默认并保存。' : '已恢复默认；当前浏览器无法持久保存。'); };
  $<HTMLInputElement>('[data-normal]').oninput = (e) => store.update({ sensitivity: Number((e.target as HTMLInputElement).value) });
  $<HTMLInputElement>('[data-ads]').oninput = (e) => store.update({ adsSensitivity: Number((e.target as HTMLInputElement).value) });
  $<HTMLInputElement>('[data-invert]').onchange = (e) => store.update({ invertY: (e.target as HTMLInputElement).checked });
  store.subscribe(() => { render(); status(store.saved ? '已保存到本机。' : '已应用；当前浏览器无法持久保存。'); });
  dialog.addEventListener('cancel', (e) => { if (capturing) { e.preventDefault(); cancelCapture(); status('已取消改键。'); } });
  dialog.addEventListener('close', () => { cancelCapture(); hooks.onClose(); });
  onLanguageChange(() => {
    // Clear a language-specific transient prompt; do not disturb bindings or active key capture.
    localizeDom(dialog);
    $('[data-migration]').textContent = localizeText(store.notices.join('\n'));
    status(''); render();
  });
  render();
  return { get open() { return dialog.open; }, show() { if (dialog.open) return; hooks.onOpen(); cancelCapture(); status(''); dialog.showModal(); }, close() { dialog.close(); } };
}
