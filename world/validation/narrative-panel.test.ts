import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createNarrativePanel, paginateDialogue } from '../src/narrativePanel';
import { getCampaignClosingText } from '../src/campaignClosure';
import { ERA_IDS, ERA_OPTIONALS, ERA_STORIES, ERA_KNIGHT_DEFEATED } from '../src/eraStories';
import { setLanguage } from '../../shared-client/i18n';
import type { Localized } from '../src/settlements/types';

const record = getCampaignClosingText(new Set([...ERA_IDS.flatMap(id => [ERA_STORIES[id].core, ERA_OPTIONALS[id].id]), ERA_KNIGHT_DEFEATED]));
function fixture() {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  setLanguage('zh');
  const panel = createNarrativePanel(() => 'F'), root = dom.window.document.getElementById('world-dialogue')!;
  return { panel, root, text: root.querySelector('p')!, hint: root.querySelector('small')!, close() {
    panel.dispose(); setLanguage('zh'); dom.window.close();
    if (old) Object.defineProperty(globalThis, 'document', old); else Reflect.deleteProperty(globalThis, 'document');
  } };
}

test('long archive packs aligned bilingual paragraphs without omissions or oversized authored pages', () => {
  const pages = paginateDialogue(record);
  assert.ok(pages.length > 1);
  for (const lang of [0, 1] as const) assert.equal(pages.map(page => page[lang]).join('\n'), record[lang]);
  for (const page of pages) { assert.ok(page[0].length <= 95); assert.ok(page[1].length <= 310); }
  const blanks: Localized = ['\n甲\n\n乙\n', '\nA\n\nB\n'];
  assert.deepEqual(paginateDialogue(blanks), [blanks], 'preserve intentional paragraph spacing');
  const unaligned: Localized = ['甲\n乙', 'A single unbroken translation.'];
  assert.deepEqual(paginateDialogue(unaligned), [unaligned], 'do not match unrelated sentence fragments');
});

test('short dialogue closes with one F-equivalent advance and long archive advances without a timer', () => {
  const f = fixture();
  try {
    f.panel.show(['炉火亮了。', 'The stove is lit.']);
    assert.equal(f.panel.open, true); f.panel.advance(); assert.equal(f.panel.open, false);
    f.panel.show(record); const pages = paginateDialogue(record);
    for (let i = 0; i < pages.length; i++) {
      assert.equal(f.panel.open, true); assert.equal(f.text.textContent, pages[i][0]);
      assert.match(f.hint.textContent!, new RegExp(`${i + 1}/${pages.length}`));
      f.panel.advance();
    }
    assert.equal(f.panel.open, false); assert.equal(f.text.textContent, '');
    f.panel.advance(); assert.equal(f.panel.open, false);
  } finally { f.close(); }
});

test('language switch retains the current paired story beat; menu dismissal and replacement discard old pages', () => {
  const f = fixture();
  try {
    f.panel.show(record); f.panel.advance(); const pages = paginateDialogue(record);
    setLanguage('en'); assert.equal(f.text.textContent, pages[1][1]);
    setLanguage('zh'); assert.equal(f.text.textContent, pages[1][0]);
    f.panel.hide(); assert.equal(f.panel.open, false);
    assert.equal(f.root.ownerDocument.body.classList.contains('world-dialogue-open'), false);
    f.panel.show(record); assert.equal(f.text.textContent, pages[0][0]);
    f.panel.show(['新对话。', 'New conversation.']); assert.equal(f.text.textContent, '新对话。');
    f.panel.advance(); assert.equal(f.panel.open, false);
    f.panel.dispose(); f.panel.dispose(); f.panel.show(record); setLanguage('en');
    assert.equal(f.panel.open, false); assert.equal(f.root.isConnected, false);
  } finally { f.close(); }
});

test('an oversized single paragraph remains intact and F scrolls bounded reading windows before dismissal', () => {
  const f = fixture();
  try {
    const long: Localized = ['很长的现场记录。'.repeat(60), 'A long field record. '.repeat(60)];
    f.panel.show(long);
    Object.defineProperties(f.text, { clientHeight: { configurable: true, value: 100 }, scrollHeight: { configurable: true, value: 350 } });
    assert.equal(f.text.textContent, long[0]); assert.equal(f.text.style.maxHeight, 'min(42vh, 320px)');
    for (const expected of [80, 160, 240, 250]) {
      f.panel.advance(); assert.equal(f.text.scrollTop, expected); assert.equal(f.panel.open, true);
      assert.equal(f.text.textContent, long[0], 'no truncation');
    }
    setLanguage('en'); assert.equal(f.text.textContent, long[1]); assert.equal(f.text.scrollTop, 0);
    for (let i = 0; i < 4; i++) f.panel.advance();
    f.panel.advance(); assert.equal(f.panel.open, false);
  } finally { f.close(); }
});

test('resizing a partially read paragraph recomputes the next reading window without skipping content', () => {
  const f = fixture();
  try {
    let height = 100, contentHeight = 350;
    Object.defineProperties(f.text, {
      clientHeight: { configurable: true, get: () => height },
      scrollHeight: { configurable: true, get: () => contentHeight },
    });
    const paragraph: Localized = ['这是一段长记录。'.repeat(70), 'An extended record. '.repeat(70)];
    f.panel.show(paragraph); f.panel.advance(); assert.equal(f.text.scrollTop, 80);
    height = 60; contentHeight = 440;
    f.root.ownerDocument.defaultView!.dispatchEvent(new f.root.ownerDocument.defaultView!.Event('resize'));
    assert.match(f.hint.textContent!, /继续阅读/);
    assert.equal(f.text.scrollTop, 80, 'shrinking viewport does not jump past unread text');
    f.panel.advance(); assert.equal(f.text.scrollTop, 128);
    assert.equal(f.text.textContent, paragraph[0]);
    setLanguage('en'); assert.equal(f.text.textContent, paragraph[1]); assert.equal(f.text.scrollTop, 0);
    height = 500;
    f.root.ownerDocument.defaultView!.dispatchEvent(new f.root.ownerDocument.defaultView!.Event('resize'));
    assert.doesNotMatch(f.hint.textContent!, /Read on/);
    f.panel.advance(); assert.equal(f.panel.open, false, 'all remaining text fits after enlarging');
  } finally { f.close(); }
});
