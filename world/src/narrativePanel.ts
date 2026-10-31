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
export interface NarrativeChoice { id: string; label: Localized; }

export function createNarrativePanel(interactLabel: () => string) {
  const root = document.createElement('section');
  root.id = 'world-dialogue'; root.className = 'hud'; root.hidden = true;
  root.style.maxHeight = '84vh'; root.style.overflowY = 'auto';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', 'world-dialogue-title');
  root.setAttribute('aria-describedby', 'world-dialogue-text world-dialogue-hint');
  const title = document.createElement('strong'), text = document.createElement('p'), hint = document.createElement('small');
  title.id = 'world-dialogue-title'; text.id = 'world-dialogue-text'; hint.id = 'world-dialogue-hint';
  text.setAttribute('aria-live', 'polite');
  text.style.maxHeight = 'min(42vh, 320px)'; text.style.overflowY = 'hidden';
  const options = document.createElement('div'); options.id = 'world-dialogue-choices'; options.setAttribute('role', 'group'); options.hidden = true;
  options.style.position = 'relative'; options.style.pointerEvents = 'auto'; options.style.maxHeight = '30vh'; options.style.overflowY = 'auto';
  root.append(title, text, options, hint); document.body.append(root);
  let pages: Localized[] = [], page = 0, disposed = false;
  let choices: NarrativeChoice[] = [], selected = -1, onChoose: ((id: string) => void) | null = null;
  let speaker: Localized = ['交谈', 'Conversation'];
  const moreText = () => text.clientHeight > 0 && text.scrollTop + text.clientHeight < text.scrollHeight - 1;
  const choicePage = () => choices.length > 0 && page === pages.length - 1 && !moreText();
  const renderChoices = () => {
    options.hidden = !choicePage(); options.replaceChildren();
    options.setAttribute('aria-label', bilingual('选择你的行动', 'Choose your action'));
    if (options.hidden) return;
    choices.forEach((choice, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `${index + 1}. ${bilingual(...choice.label)}`;
      button.dataset.choice = choice.id; button.setAttribute('aria-pressed', String(index === selected));
      button.style.cssText = `display:block;width:100%;margin:6px 0;padding:8px 12px;text-align:left;color:inherit;border:1px solid ${index === selected ? '#f2d28c' : '#687a8e'};background:${index === selected ? '#344052' : '#172231'};border-radius:5px;cursor:pointer`;
      // Clicking chooses explicitly; keyboard selection is confirmed with Interact.
      button.addEventListener('click', () => { if (!disposed && !root.hidden && button.isConnected && options.contains(button) && choicePage()) { selected = index; confirmChoice(); } });
      options.append(button);
    });
    // Keep keyboard selections visible even in short landscape windows.
    const selectedButton = options.children[selected] as HTMLElement | undefined;
    selectedButton?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  const confirmChoice = () => {
    if (!choicePage() || selected < 0 || !choices[selected] || !onChoose) return;
    const id = choices[selected].id, callback = onChoose;
    // Clear all callbacks BEFORE user code. A second key/click cannot replay it;
    // user code may immediately replace this dialog with a response.
    hide(); callback(id);
  };
  const renderHint = () => {
    renderChoices();
    if (choicePage()) {
      hint.textContent = bilingual(`↑/↓ 或数字键选择 · [${interactLabel()}] 确认 · Esc 暂不决定`, `↑/↓ or number keys to select · [${interactLabel()}] Confirm · Esc to decide later`);
      return;
    }
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
    text.scrollTop = 0; root.scrollTop = 0; renderHint();
  };
  const unsubscribe = onLanguageChange(render);
  const viewport = document.defaultView;
  const resized = () => { if (!disposed && !root.hidden) renderHint(); };
  viewport?.addEventListener('resize', resized);
  const hide = () => {
    root.hidden = true; pages = []; page = 0; text.textContent = ''; text.scrollTop = 0; root.scrollTop = 0;
    choices = []; selected = -1; onChoose = null; options.hidden = true; options.replaceChildren();
    document.body.classList.remove('world-dialogue-open');
  };
  return {
    get open() { return !disposed && !root.hidden; },
    show(line: Localized, name: Localized = ['交谈', 'Conversation']) {
      if (disposed) return;
      choices = []; selected = -1; onChoose = null; text.style.maxHeight = 'min(42vh, 320px)';
      pages = paginateDialogue(line); page = 0; speaker = [...name];
      root.hidden = false; document.body.classList.add('world-dialogue-open'); render();
    },
    showChoices(line: Localized, name: Localized, items: readonly NarrativeChoice[], callback: (id: string) => void) {
      if (disposed) return;
      const ids = new Set<string>();
      choices = items.filter(item => { if (!item.id || ids.has(item.id)) return false; ids.add(item.id); return true; })
        .slice(0, 9).map(item => ({ id: item.id, label: [...item.label] }));
      selected = -1; onChoose = choices.length ? callback : null;
      text.style.maxHeight = choices.length ? 'min(30vh, 220px)' : 'min(42vh, 320px)';
      pages = paginateDialogue(line); page = 0; speaker = [...name];
      root.hidden = false; document.body.classList.add('world-dialogue-open'); render();
    },
    get choosing() { return !disposed && !root.hidden && choicePage(); },
    selectChoice(index: number) {
      if (disposed || root.hidden || !choicePage() || !Number.isInteger(index) || index < 0 || index >= choices.length) return false;
      selected = index; renderHint(); return true;
    },
    moveChoice(delta: number) {
      if (disposed || root.hidden || !choicePage() || !Number.isFinite(delta) || delta === 0) return false;
      selected = selected < 0 ? (delta > 0 ? 0 : choices.length - 1) : (selected + (delta > 0 ? 1 : -1) + choices.length) % choices.length;
      renderHint(); return true;
    },
    advance() {
      if (disposed || root.hidden) return;
      if (moreText()) {
        text.scrollTop = Math.min(text.scrollHeight - text.clientHeight, text.scrollTop + Math.max(1, text.clientHeight * .8));
        renderHint();
      } else if (page < pages.length - 1) { page++; render(); }
      else if (choices.length) confirmChoice();
      else hide();
    },
    hide,
    dispose() { if (disposed) return; hide(); disposed = true; unsubscribe(); viewport?.removeEventListener('resize', resized); root.remove(); },
  };
}
