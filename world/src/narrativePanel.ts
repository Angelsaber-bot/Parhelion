import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import type { Localized } from './settlements/types';

/** Pair paragraphs before packing pages: switching language never changes which
 * story beat the player is reading. Unaligned copy remains intact on one page. */
export function paginateDialogue(line: Localized): Localized[] {
  const zh = line[0].split('\n'), en = line[1].split('\n');
  if (zh.length !== en.length) return [[...line]];
  const pages: Localized[] = [];
  let page: Localized | null = null;
  for (let i = 0; i < zh.length; i++) {
    const pair: Localized = [zh[i], en[i]];
    if (!page) { page = pair; continue; }
    const joined: Localized = [`${page[0]}\n${pair[0]}`, `${page[1]}\n${pair[1]}`];
    if (joined[0].length > 95 || joined[1].length > 310) {
      pages.push(page); page = pair;
    } else page = joined;
  }
  pages.push(page ?? ['', '']);
  return pages;
}

/** No timers or typewriter lockout. F reads/advances; hide always dismisses all
 * pages for menus, focus loss and reset. Long unbroken paragraphs use bounded
 * text scrolling on F, not truncation or mismatched bilingual sentence splits. */
export function createNarrativePanel(interactLabel: () => string) {
  const root = document.createElement('section');
  root.id = 'world-dialogue'; root.className = 'hud'; root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', 'world-dialogue-title');
  root.setAttribute('aria-describedby', 'world-dialogue-text world-dialogue-hint');
  const title = document.createElement('strong'), text = document.createElement('p'), hint = document.createElement('small');
  title.id = 'world-dialogue-title'; text.id = 'world-dialogue-text'; hint.id = 'world-dialogue-hint';
  text.setAttribute('aria-live', 'polite');
  text.style.maxHeight = 'min(42vh, 320px)'; text.style.overflowY = 'hidden';
  root.append(title, text, hint); document.body.append(root);
  let pages: Localized[] = [], page = 0, disposed = false;
  let speaker: Localized = ['交谈', 'Conversation'];
  const moreText = () => text.clientHeight > 0 && text.scrollTop + text.clientHeight < text.scrollHeight - 1;
  const renderHint = () => {
    const count = pages.length > 1 ? `${page + 1}/${pages.length} · ` : '';
    hint.textContent = bilingual(
      `${count}[${interactLabel()}] ${moreText() ? '继续阅读' : page < pages.length - 1 ? '下一页' : '继续'} · Esc 返回菜单`,
      `${count}[${interactLabel()}] ${moreText() ? 'Read on' : page < pages.length - 1 ? 'Next page' : 'Continue'} · Esc for menu`,
    );
  };
  const render = () => {
    if (disposed || !pages.length) return;
    root.setAttribute('aria-label', bilingual('对话', 'Dialogue'));
    title.textContent = bilingual(...speaker); text.textContent = bilingual(...pages[page]);
    text.scrollTop = 0; renderHint();
  };
  const unsubscribe = onLanguageChange(render);
  const viewport = document.defaultView;
  const resized = () => { if (!disposed && !root.hidden) renderHint(); };
  viewport?.addEventListener('resize', resized);
  const hide = () => {
    root.hidden = true; pages = []; page = 0; text.textContent = ''; text.scrollTop = 0;
    document.body.classList.remove('world-dialogue-open');
  };
  return {
    get open() { return !disposed && !root.hidden; },
    show(line: Localized, name: Localized = ['交谈', 'Conversation']) {
      if (disposed) return;
      pages = paginateDialogue(line); page = 0; speaker = [...name];
      root.hidden = false; document.body.classList.add('world-dialogue-open'); render();
    },
    advance() {
      if (disposed || root.hidden) return;
      if (moreText()) {
        text.scrollTop = Math.min(text.scrollHeight - text.clientHeight, text.scrollTop + Math.max(1, text.clientHeight * .8));
        renderHint();
      } else if (page < pages.length - 1) { page++; render(); }
      else hide();
    },
    hide,
    dispose() { if (disposed) return; hide(); disposed = true; unsubscribe(); viewport?.removeEventListener('resize', resized); root.remove(); },
  };
}
