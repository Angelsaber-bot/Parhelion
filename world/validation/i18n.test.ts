import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { LANGUAGE_KEY, MESSAGES, bilingual, getLanguage, localizeText, onLanguageChange, readLanguage, setLanguage, t } from '../../shared-client/i18n';
import { TEXT_PAIRS } from '../../shared-client/locales';
import { ACTIONS, bindingLabel, SettingsStore } from '../../shared-client/settings';

const chinese = /[\u3400-\u9fff]/;
afterEach(() => setLanguage('zh'));
test('language selection persists, tolerates broken storage, and notifies once per change', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(readLanguage(storage), 'zh');
  let calls = 0; const unsubscribe = onLanguageChange(() => calls++);
  setLanguage('en', storage); setLanguage('en', storage);
  assert.equal(values.get(LANGUAGE_KEY), 'en'); assert.equal(readLanguage(storage), 'en'); assert.equal(getLanguage(), 'en'); assert.equal(calls, 1);
  unsubscribe(); setLanguage('zh', storage); assert.equal(calls, 1);
  const blocked = { getItem(): never { throw Error('blocked'); }, setItem(): never { throw Error('blocked'); } };
  assert.equal(readLanguage(blocked), 'zh'); setLanguage('en', blocked); assert.equal(getLanguage(), 'en');
  values.set(LANGUAGE_KEY, 'not-a-language'); assert.equal(readLanguage(storage), 'zh');
});
test('typed dictionary has paired entries, interpolation never leaks raw keys, and source fallback is safe', () => {
  for (const [key, entry] of Object.entries(MESSAGES)) { assert.ok(entry.zh, key); assert.ok(entry.en, key); }
  const seen = new Map<string, string>();
  for (const [zh, en] of TEXT_PAIRS) {
    assert.ok(zh.length); assert.equal(typeof en, 'string');
    if (seen.has(zh)) assert.equal(en, seen.get(zh), `conflicting duplicate: ${zh}`);
    seen.set(zh, en);
  }
  setLanguage('en'); assert.equal(t('loadingMap', { percent: 63 }), 'Loading map… 63%');
  assert.equal(t('loadingMap'), 'Loading map… —%');
  assert.equal(t('missing_key' as never), 'Unavailable');
  assert.equal(t('__proto__' as never), 'Unavailable');
  assert.equal(localizeText('constructor'), 'constructor');
  assert.equal(localizeText('Unregistered authored fallback'), 'Unregistered authored fallback');
  assert.equal(bilingual('胜利', 'Victory'), 'Victory');
  setLanguage('zh'); assert.equal(localizeText('幻日谷'), '幻日谷'); assert.equal(bilingual('胜利', 'Victory'), '胜利');
});
test('all current World region names, quests, markers and discovery notes have English coverage', () => {
  setLanguage('en');
  for (const region of ['alpha', 'britain', 'blacksail', 'winter', 'kyoto']) {
    const layout = JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`, import.meta.url), 'utf8'));
    const texts = [layout.world.name, layout.objective.name, ...layout.objective.steps.map((s: { text: string }) => s.text),
      ...layout.areas.map((a: { name: string }) => a.name), ...layout.markers.flatMap((m: { label: string; note?: string }) => [m.label, m.note].filter(Boolean))];
    for (const source of texts) assert.doesNotMatch(localizeText(source), chinese, `${region}: ${source}`);
  }
});
test('current Arena, World and captured Home templates have English text and accessibility coverage', () => {
  setLanguage('en');
  for (const path of ['../../arena-game/index.html', '../index.html', '../../site/web/index.html']) {
    const html = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    const values = [...html.matchAll(/>([^<>]+)</g)].map(m => m[1].trim());
    values.push(...[...html.matchAll(/(?:aria-label|title|alt|placeholder)="([^"]*)"/g)].map(m => m[1]));
    for (const source of values.filter(value => chinese.test(value))) assert.doesNotMatch(localizeText(source), chinese, `${path}: ${source}`);
  }
});
test('all input actions and binding labels translate without changing stored input values', () => {
  setLanguage('en');
  for (const defs of Object.values(ACTIONS)) for (const action of defs) assert.doesNotMatch(localizeText(action.label), chinese, action.label);
  for (const code of ['', 'Space', 'ShiftLeft', 'ShiftRight', 'Mouse0', 'Mouse2', 'WheelUp']) assert.doesNotMatch(bindingLabel(code), chinese);
  const store = new SettingsStore('world'); const before = JSON.stringify(store.value);
  assert.match(store.label('sprint'), /Left Shift.*Right Shift/);
  setLanguage('zh'); assert.match(store.label('sprint'), /左 Shift.*右 Shift/); assert.equal(JSON.stringify(store.value), before);
});

test('explicit DOM localization restores source text and never rewrites usernames or input values', async () => {
  const { localizeDom } = await import('../../shared-client/i18n');
  const previous = { document: globalThis.document, Element: globalThis.Element, NodeFilter: globalThis.NodeFilter };
  class ElementFixture {
    attrs = new Map<string, string>();
    tagName: string;
    value = '';
    constructor(readonly skip = false, tag = 'SPAN') { this.tagName = tag; }
    closest(_selector: string) { return this.skip ? this : null; }
    getAttribute(name: string) { return this.attrs.get(name) ?? null; }
    setAttribute(name: string, value: string) { this.attrs.set(name, value); }
    querySelectorAll() { return []; }
  }
  const title = new ElementFixture(), username = new ElementFixture(true), input = new ElementFixture(true, 'INPUT');
  title.setAttribute('aria-label', '按键与灵敏度设置'); input.value = '幻日谷';
  const texts = [{ parentElement: title, data: '幻日谷' }, { parentElement: username, data: '幻日谷' }, { parentElement: input, data: '胜利' }];
  const root = new ElementFixture(); root.querySelectorAll = () => [title, username, input] as never;
  const fakeDocument = { documentElement: { lang: '' }, createTreeWalker() { let index = 0; return { nextNode: () => texts[index++] ?? null }; } };
  Object.assign(globalThis, { document: fakeDocument, Element: ElementFixture, NodeFilter: { SHOW_TEXT: 4 } });
  try {
    setLanguage('en'); localizeDom(root as unknown as ParentNode);
    assert.equal(texts[0].data, 'Parhelion Valley'); assert.equal(title.getAttribute('aria-label'), 'Controls & sensitivity');
    assert.equal(texts[1].data, '幻日谷'); assert.equal(input.value, '幻日谷'); assert.equal(texts[2].data, '胜利');
    setLanguage('zh'); localizeDom(root as unknown as ParentNode); assert.equal(texts[0].data, '幻日谷');
    assert.equal(title.getAttribute('aria-label'), '按键与灵敏度设置');
    texts[0].data = '落日王国'; setLanguage('en'); localizeDom(root as unknown as ParentNode); assert.equal(texts[0].data, 'Sunset Kingdom');
    setLanguage('zh'); localizeDom(root as unknown as ParentNode); assert.equal(texts[0].data, '落日王国');
  } finally { Object.assign(globalThis, previous); }
});

test('legacy control migrations, recovery notices and English-source catalog labels are localized', () => {
  setLanguage('en');
  for (const mode of ['arena', 'world'] as const) {
    for (const version of [1, 2]) {
      const storage = { getItem: (key: string) => key.endsWith(`v${version}`) ? JSON.stringify({ version, bindings: { forward: 'BadKey', back: 'KeyW' } }) : null, setItem() {} };
      const store = new SettingsStore(mode, storage);
      assert.ok(store.notices.length);
      for (const notice of store.notices) assert.doesNotMatch(localizeText(notice), chinese, notice);
    }
  }
  assert.equal(localizeText('Lumen AR'), 'Assault Rifle AR');
  setLanguage('zh'); assert.equal(localizeText('Dawn'), '曙光'); assert.equal(localizeText('Lumen AR'), '突击步枪 AR');
  setLanguage('en'); assert.equal(localizeText('Dawn'), 'Dawn');
});
