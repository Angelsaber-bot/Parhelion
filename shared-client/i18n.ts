/** Runtime locale shared by Home, Arena and World. No networking or simulation dependency. */
import { TEXT_PAIRS } from './locales.js';
export type Language = 'zh' | 'en';
export interface LocaleStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const LANGUAGE_KEY = 'parhelion-language-v1';
export const MESSAGES = {
  language: { zh: '语言', en: 'Language' },
  languageChanged: { zh: '已切换为中文', en: 'Language changed to English' },
  controls: { zh: '操作设置', en: 'Controls' },
  loadingMap: { zh: '加载地图… {percent}%', en: 'Loading map… {percent}%' },
  unassigned: { zh: '未设置', en: 'Unassigned' },
} as const;
export type MessageKey = keyof typeof MESSAGES;
function browserStorage(): LocaleStorage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }
export function readLanguage(storage: LocaleStorage | undefined = browserStorage()): Language {
  try { return storage?.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'zh'; } catch { return 'zh'; }
}
let current: Language = readLanguage();
const listeners = new Set<() => void>();
export const getLanguage = (): Language => current;
export function setLanguage(language: Language, storage: LocaleStorage | undefined = browserStorage()): void {
  if (language !== 'zh' && language !== 'en') return;
  try { storage?.setItem(LANGUAGE_KEY, language); } catch { /* Private browsing: in-memory selection still works. */ }
  if (language === current) return;
  current = language;
  if (typeof document !== 'undefined') document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  listeners.forEach((fn) => fn());
}
export function onLanguageChange(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
export const bilingual = (zh: string, en: string): string => current === 'en' ? en : zh;
/** Unknown keys are errors during development; never show a raw translation key in the UI. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const entry = Object.prototype.hasOwnProperty.call(MESSAGES, key) ? MESSAGES[key] : undefined;
  if (!entry) return bilingual('暂不可用', 'Unavailable');
  return entry[current].replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? '—'));
}
const exact = new Map<string, string>(TEXT_PAIRS);
const phrases = [...TEXT_PAIRS].filter(([zh]) => /[\u3400-\u9fff]/.test(zh)).sort((a, b) => b[0].length - a[0].length);
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrasePattern = new RegExp(phrases.map(([zh]) => escapeRegex(zh)).join('|'), 'g');
/** Source labels inherited in English are localized too; these are catalog/UI values, never names. */
const SOURCE_LABELS: Record<string, readonly [string, string]> = {
  '领取 Lumen AR 与弹药': ['领取突击步枪 AR 与弹药', 'Collect an AR and ammunition'],
  '领取 Lumen AR 与弹药，去靶场试试手感': ['领取突击步枪 AR 与弹药，去靶场试试手感', 'AR and ammunition collected. Try them at the firing range.'],
  '三把枪，两个技能，一次反杀': ['两把枪，一件近战，两种技能', 'Two guns. One melee weapon. Two abilities.'],
  Dawn: ['曙光', 'Dawn'], Ember: ['余烬', 'Ember'], Sakura: ['樱花', 'Sakura'], Graphite: ['石墨', 'Graphite'], Aurora: ['极光', 'Aurora'], Solar: ['日耀', 'Solar'],
  'Lumen AR': ['突击步枪 AR', 'Assault Rifle AR'], 'Corona SG': ['霰弹枪', 'Shotgun'], 'Halo DMR': ['精确射手步枪 DMR', 'Marksman Rifle DMR'],
  'PARHELION / CONTROLS': ['PARHELION / 操作设置', 'PARHELION / CONTROLS'],
  'PARHELION / WAYFARER ARMORY': ['PARHELION / 旅人武装', 'PARHELION / WAYFARER ARMORY'],
  '01 · CHOOSE YOUR BATTLEFIELD': ['01 · 选择战场', '01 · CHOOSE YOUR BATTLEFIELD'],
  '02 · LOADOUT': ['02 · 出战配装', '02 · LOADOUT'], '03 · OR SLOW DOWN': ['03 · 或者，放慢脚步', '03 · OR SLOW DOWN'],
  'PARHELION · PLAY LOCAL. WANDER FURTHER.': ['PARHELION · 此刻交锋，继续远行。', 'PARHELION · PLAY LOCAL. WANDER FURTHER.'],
};
/** Translate authored content only. User names, server URLs, input values and network IDs must not pass here. */
export function localizeText(source: string): string {
  const trimmed = source.trim();
  const label = Object.prototype.hasOwnProperty.call(SOURCE_LABELS, trimmed) ? SOURCE_LABELS[trimmed] : undefined;
  if (label) return source.replace(trimmed, bilingual(label[0], label[1]));
  if (current === 'zh') return source;
  const translated = exact.get(trimmed);
  if (translated !== undefined) return source.replace(trimmed, translated);
  // Controlled phrases cover counters, key labels and concatenated authored HUD strings.
  // One pass avoids translating a replacement again or damaging Latin identifiers.
  return source.replace(phrasePattern, (match) => exact.get(match) ?? match);
}
const textSources = new WeakMap<Text, { source: string; output: string }>();
const attrSources = new WeakMap<Element, Map<string, { source: string; output: string }>>();
const EXCLUDED = 'script,style,noscript,input,textarea,[data-i18n-ignore],[data-no-i18n],#scoreboard,#feed,#killer,#name';
/** Explicit authored DOM localization; deliberately no MutationObserver or input-value rewriting. */
export function localizeDom(root: ParentNode): void {
  if (typeof document === 'undefined') return;
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    if (!text.parentElement || text.parentElement.closest(EXCLUDED)) continue;
    const old = textSources.get(text);
    const source = old && old.output === text.data ? old.source : text.data;
    const output = localizeText(source);
    textSources.set(text, { source, output });
    if (text.data !== output) text.data = output;
  }
  const nodes: Element[] = [...root.querySelectorAll('[aria-label],[title],[alt],[placeholder]')];
  if (root instanceof Element) nodes.push(root);
  for (const el of nodes) {
    if (el.closest('[data-i18n-ignore],[data-no-i18n],#scoreboard,#feed,#killer,#name')) continue;
    const sources = attrSources.get(el) ?? new Map<string, { source: string; output: string }>();
    for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
      const value = el.getAttribute(attr); if (value === null) continue;
      const old = sources.get(attr), source = old && old.output === value ? old.source : value;
      const output = localizeText(source); sources.set(attr, { source, output }); el.setAttribute(attr, output);
    }
    attrSources.set(el, sources);
  }
}
/** A native accessible select; safe to mount inside a settings dialog or a page header. */
export function createLanguageToggle(parent: HTMLElement = document.body): HTMLElement {
  const label = document.createElement('label'); label.className = 'parhelion-language'; label.dataset.i18nIgnore = '';
  const title = document.createElement('span');
  const select = document.createElement('select'); select.setAttribute('aria-label', '语言 / Language');
  for (const [value, name] of [['zh', '中文'], ['en', 'English']]) { const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option); }
  const update = () => { title.textContent = t('language'); select.value = current; };
  select.addEventListener('change', () => setLanguage(select.value as Language));
  label.addEventListener('pointerdown', (event) => event.stopPropagation());
  label.addEventListener('click', (event) => event.stopPropagation());
  label.addEventListener('keydown', (event) => event.stopPropagation());
  label.append(title, select); parent.append(label); update();
  onLanguageChange(update);
  return label;
}
if (typeof document !== 'undefined') document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key !== LANGUAGE_KEY) return;
  const next = event.newValue === 'en' ? 'en' : 'zh';
  if (next !== current) setLanguage(next);
});
