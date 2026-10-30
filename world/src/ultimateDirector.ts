import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import { CONTRACT_SKILLS } from './contractSkills';

export type UltimateMode = 'full' | 'short' | 'off';
export type UltimatePhase = 'intro' | 'charge' | 'release' | 'outro';
export interface UltimateFrame {
  identity: string; phase: UltimatePhase; progress: number; elapsed: number; pulse: number; reduced: boolean;
}
export const ULTIMATE_MODE_KEY = 'parhelion-world-ultimate-mode-v1';
type ModeStorage = Pick<Storage, 'getItem' | 'setItem'>;
const isMode = (value: unknown): value is UltimateMode => value === 'full' || value === 'short' || value === 'off';

/** Presentation time only. Never owns damage, costs, activation, or simulation time. */
export class UltimateClock {
  private identity: string | null = null;
  private presentation: UltimateMode = 'full';
  private phase: UltimatePhase = 'intro';
  private elapsed = 0; private phaseTime = 0; private pulse = 0; private outroTime = .45;
  get active() { return this.identity !== null; }
  get showing() { return this.active && this.presentation !== 'off'; }
  get releasing() { return this.active && this.phase === 'release'; }
  get frame(): UltimateFrame | null {
    if (this.identity === null) return null;
    const duration = this.phase === 'intro' ? this.intro : this.phase === 'charge' ? this.charge : this.phase === 'outro' ? this.outro : 2.9;
    return { identity: this.identity, phase: this.phase, progress: Math.min(1, this.phaseTime / duration), elapsed: this.elapsed, pulse: this.pulse, reduced: this.presentation !== 'full' };
  }
  private get intro() { return this.presentation === 'full' ? .65 : .1; }
  private get charge() { return this.presentation === 'full' ? 1.9 : .15; }
  private get outro() { return this.outroTime; }
  begin(identity: string, mode: UltimateMode): boolean {
    if (this.active) return false;
    this.identity = identity; this.presentation = mode; this.phase = mode === 'off' ? 'release' : 'intro';
    this.elapsed = this.phaseTime = this.pulse = 0; return true;
  }
  tick(dt: number, suspended = false): void {
    if (!this.active || suspended || !Number.isFinite(dt) || dt <= 0) return;
    // Deliberately discard stalled-frame debt; never replay a hidden tab's elapsed time.
    const step = Math.min(.1, dt); this.elapsed += step; this.phaseTime += step; this.pulse = Math.max(0, this.pulse - step * 3);
    if (this.phase === 'intro' && this.phaseTime + 1e-9 >= this.intro) { this.phaseTime -= this.intro; this.phase = 'charge'; }
    if (this.phase === 'charge' && this.phaseTime + 1e-9 >= this.charge) { this.phaseTime = 0; this.phase = 'release'; }
    if (this.phase === 'outro' && this.phaseTime + 1e-9 >= this.outro) this.abort();
  }
  notifyStrike(): void { if (this.releasing) this.pulse = 1; }
  complete(): void {
    if (!this.releasing) return;
    if (!this.showing) this.abort();
    else { this.outroTime = this.presentation === 'full' ? Math.max(.45, 5.2 - this.elapsed) : .15; this.phase = 'outro'; this.phaseTime = 0; }
  }
  skip(): void {
    if (!this.active) return;
    this.presentation = 'off';
    if (this.phase === 'outro') this.abort();
    else if (this.phase !== 'release') { this.phase = 'release'; this.phaseTime = 0; }
  }
  abort(): void { this.identity = null; this.elapsed = this.phaseTime = this.pulse = 0; }
}

export interface UltimateDirectorOptions {
  document?: Document; storage?: ModeStorage | null; reducedMotion?: boolean;
  onRelease?: () => void; onEnd?: () => void;
}
/** DOM shell around the deterministic clock. Main retains the one accepted cast. */
export class UltimateDirector {
  readonly settingsControl: HTMLDivElement;
  readonly overlay: HTMLDivElement;
  private clock = new UltimateClock();
  private doc: Document; private storage: ModeStorage | null;
  private selected: UltimateMode; private disposed = false; private released = false;
  private title: HTMLHeadingElement; private caption: HTMLParagraphElement; private skipButton: HTMLButtonElement;
  private select: HTMLSelectElement; private settingsTitle: HTMLSpanElement; private note: HTMLParagraphElement;
  private previousFocus: HTMLElement | null = null; private removeLocale: () => void;
  private hadBodyClass = false;
  constructor(private options: UltimateDirectorOptions = {}) {
    this.doc = options.document ?? document;
    this.storage = options.storage ?? null;
    if (options.storage === undefined) { try { this.storage = this.doc.defaultView?.localStorage ?? null; } catch { /* denied storage */ } }
    let reduced = options.reducedMotion ?? false;
    if (options.reducedMotion === undefined) { try { reduced = !!this.doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* no matchMedia */ } }
    this.selected = reduced ? 'short' : 'full';
    try { const saved = this.storage?.getItem(ULTIMATE_MODE_KEY); if (isMode(saved)) this.selected = saved; } catch { /* session default */ }
    this.overlay = this.doc.createElement('div'); this.overlay.className = 'ultimate-overlay'; this.overlay.hidden = true;
    this.overlay.setAttribute('role', 'dialog'); this.overlay.setAttribute('aria-modal', 'true'); this.overlay.setAttribute('aria-label', bilingual('终结技演出', 'Ultimate cinematic'));
    this.title = this.doc.createElement('h2'); this.title.className = 'ultimate-title';
    this.caption = this.doc.createElement('p'); this.caption.className = 'ultimate-caption';
    this.skipButton = this.doc.createElement('button'); this.skipButton.type = 'button'; this.skipButton.className = 'ultimate-skip';
    this.skipButton.onclick = () => this.skip(); this.overlay.append(this.title, this.caption, this.skipButton); this.doc.body.append(this.overlay);
    this.settingsControl = this.doc.createElement('div'); this.settingsControl.className = 'settings-sliders ultimate-settings';
    const label = this.doc.createElement('label'); this.settingsTitle = this.doc.createElement('span'); this.select = this.doc.createElement('select');
    for (const value of ['full', 'short', 'off']) { const option = this.doc.createElement('option'); option.value = value; this.select.append(option); }
    this.select.value = this.selected; this.select.onchange = () => { if (isMode(this.select.value)) this.setMode(this.select.value); };
    label.append(this.settingsTitle, this.select); this.note = this.doc.createElement('p'); this.note.className = 'settings-note'; this.settingsControl.append(label, this.note);
    this.renderLocale(); this.removeLocale = onLanguageChange(() => this.renderLocale());
    for (const type of this.events) this.doc.defaultView?.addEventListener(type, this.capture, { capture: true, passive: false });
  }
  private readonly events = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'contextmenu'] as const;
  private capture = (event: Event) => {
    if (!this.active) return;
    // Preserve native browser/system shortcuts. Main's modifier guard clears held
    // gameplay inputs without cancelling this accepted cast.
    const keyboard = event as KeyboardEvent;
    if ((event.type === 'keydown' || event.type === 'keyup') && (keyboard.metaKey || keyboard.ctrlKey || keyboard.altKey)) return;
    if (event.type === 'keydown') {
      const key = keyboard.key;
      if (([' ', 'Escape', 'Enter'].includes(key) || ['Space', 'Escape', 'Enter'].includes(keyboard.code)) && !keyboard.repeat) this.skip();
      if (key === 'Tab' && this.showing) this.skipButton.focus({ preventScroll: true });
    }
    if (event.type === 'click' && event.target === this.skipButton) this.skip();
    event.preventDefault(); event.stopImmediatePropagation();
  };
  get active() { return this.clock.active; }
  get showing() { return this.clock.showing; }
  get releasing() { return this.clock.releasing; }
  get frame() { return this.clock.frame; }
  get mode() { return this.selected; }
  setMode(mode: UltimateMode): void {
    if (this.disposed || !isMode(mode)) return;
    this.selected = mode; this.select.value = mode;
    try { this.storage?.setItem(ULTIMATE_MODE_KEY, mode); } catch { /* keep in-memory preference */ }
  }
  begin(identity: string): boolean {
    if (this.disposed || !this.clock.begin(identity, this.selected)) return false;
    this.released = false; this.previousFocus = this.doc.activeElement as HTMLElement | null;
    this.hadBodyClass = this.doc.body.classList.contains('ultimate-showing');
    this.renderLocale(); this.sync(true); if (this.showing) this.skipButton.focus({ preventScroll: true }); return true;
  }
  tick(dt: number, suspended = false): void { const active = this.active; this.clock.tick(dt, suspended); this.sync(active); }
  notifyStrike(): void { this.clock.notifyStrike(); }
  complete(): void { const active = this.active; this.clock.complete(); this.sync(active); }
  skip(): void { const active = this.active; this.clock.skip(); this.sync(active); }
  abort(): void { const active = this.active; this.clock.abort(); this.sync(active); }
  private sync(wasActive: boolean): void {
    if (!wasActive && !this.active) return;
    this.overlay.hidden = !this.showing;
    const phase = this.frame?.phase ?? 'idle';
    if (this.overlay.dataset.phase !== phase) this.overlay.dataset.phase = phase;
    if (this.showing) this.doc.body.classList.add('ultimate-showing');
    else if (!this.hadBodyClass) this.doc.body.classList.remove('ultimate-showing');
    if (this.releasing && !this.released) { this.released = true; this.options.onRelease?.(); }
    if (wasActive && !this.active) {
      const focus = this.previousFocus; this.previousFocus = null;
      if (focus?.isConnected && typeof focus.focus === 'function') focus.focus({ preventScroll: true });
      this.options.onEnd?.();
    }
  }
  private renderLocale(): void {
    const identity = this.frame?.identity ?? 'player';
    const key = identity === 'napoleonMounted' ? 'napoleon' : identity;
    const skill = CONTRACT_SKILLS[key as keyof typeof CONTRACT_SKILLS]?.ultimate ?? CONTRACT_SKILLS.player.ultimate;
    this.title.textContent = bilingual(skill.name, skill.nameEn);
    this.overlay.setAttribute('aria-label', bilingual('终结技演出', 'Ultimate cinematic'));
    this.caption.textContent = bilingual('终结技 · 蓄势与释放', 'ULTIMATE · CHARGE AND RELEASE');
    this.skipButton.textContent = bilingual('跳过演出 · 空格 / Esc / Enter', 'Skip cinematic · Space / Esc / Enter');
    this.settingsTitle.textContent = bilingual('终结技全屏演出', 'Ultimate cinematics');
    [bilingual('完整', 'Full'), bilingual('简短（减少动态效果）', 'Short (reduced motion)'), bilingual('关闭特写（保留大招动作）', 'Off (keep ultimate action)')].forEach((label, i) => this.select.options[i].textContent = label);
    this.note.textContent = bilingual('下次释放生效。关闭或跳过只省略演出，不取消技能、不返还能量，也不改变伤害。', 'Applies to the next cast. Off and Skip omit presentation only: no cancellation, energy refund, or damage change.');
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.abort(); this.removeLocale();
    for (const type of this.events) this.doc.defaultView?.removeEventListener(type, this.capture, true);
    this.skipButton.onclick = null; this.select.onchange = null; this.overlay.remove(); this.settingsControl.remove();
  }
}
