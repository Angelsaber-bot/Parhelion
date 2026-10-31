import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import type { Localized, RegionId } from './settlements/types';
import { getCampaignDispatchState, getCampaignDispatchGuide, getCampaignEpisodeJournal, type CampaignEpisodeStage } from './campaignEpisodes';

const STAGES: Record<CampaignEpisodeStage, Localized> = {
  briefing: ['等待交谈', 'Awaiting conversation'], work: ['现场工作', 'Work in progress'],
  decision: ['等待你的安排', 'Awaiting your decision'], 'follow-through': ['等待主线路况变化', 'Awaiting the main-story outcome'],
  report: ['可以返回交谈', 'Ready to report'], complete: ['已落实', 'Resolved'],
};
const REGIONS: Record<RegionId, Localized> = {
  alpha: ['幻日谷', 'Parhelion Valley'], britain: ['落日王国', 'Sunset Kingdom'],
  blacksail: ['黑帆尽头', 'Black Sail’s End'], winter: ['永冬之城', 'Winter City'], kyoto: ['业火京都', 'Kyoto Ablaze'],
};
export interface CampaignJournalOptions {
  done(): ReadonlySet<string>;
  onOpen(): boolean | void;
  onClose?(): void;
  pin(region: RegionId): boolean | void;
  restoreMain(): void;
}
/** Read-only field journal. Only the explicit track button changes the caller's
 * pin. Reading never starts, completes or chooses an episode from afar.
 */
export function createCampaignJournal(options: CampaignJournalOptions) {
  const root = document.createElement('section'); root.id = 'world-campaign-journal'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'world-campaign-journal-title');
  const style = document.createElement('style');
  style.textContent = `#world-campaign-journal{position:fixed;inset:0;z-index:1200;background:#080e18e8;display:flex;align-items:center;justify-content:center;padding:16px;color:#e8edf5;font:14px/1.55 system-ui,sans-serif}#world-campaign-journal[hidden]{display:none}#world-campaign-journal .campaign-journal-card{width:min(850px,100%);max-height:90vh;overflow:auto;background:#132131;border:1px solid #506276;border-radius:14px;padding:22px;box-shadow:0 16px 80px #0008}#world-campaign-journal h2{margin:0 0 8px;color:#f0d69b}#world-campaign-journal article{border-top:1px solid #405065;padding:16px 0}#world-campaign-journal h3{margin:0 0 7px;font-size:16px}#world-campaign-journal p{margin:7px 0;white-space:pre-line}#world-campaign-journal .campaign-status{color:#b9cbe0;font-size:12px}#world-campaign-journal .campaign-choice{color:#ecd29b}#world-campaign-journal button{background:#293c51;border:1px solid #7589a0;border-radius:6px;color:inherit;padding:8px 14px;margin:7px 8px 0 0;cursor:pointer}#world-campaign-journal button:focus-visible{outline:3px solid #f1d69b;outline-offset:2px}#world-campaign-journal button:disabled{opacity:.5;cursor:default}#world-campaign-journal footer{position:sticky;bottom:-22px;background:#132131;padding:10px 0 18px}`;
  const card = document.createElement('div'); card.className = 'campaign-journal-card';
  const title = document.createElement('h2'); title.id = 'world-campaign-journal-title';
  const intro = document.createElement('p'), summary = document.createElement('p'), list = document.createElement('div'), footer = document.createElement('footer');
  const main = document.createElement('button'), close = document.createElement('button'); main.type = close.type = 'button';
  main.dataset.journalAction = 'main'; close.dataset.journalAction = 'close';
  footer.append(main, close); card.append(title, intro, summary, list, footer); root.append(style, card); document.body.append(root);
  let disposed = false, returnFocus: HTMLElement | null = null;
  const focusable = (element: HTMLElement | null): element is HTMLElement => {
    if (!element?.isConnected || element.closest('[hidden],[inert]') || element.matches(':disabled')) return false;
    if (!element.matches('button,input,select,textarea,a[href],[tabindex]')) return false;
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      const css = getComputedStyle(node); if (css.display === 'none' || css.visibility === 'hidden') return false;
    }
    return true;
  };
  const hide = () => {
    if (root.hidden) return;
    const ownedFocus = root.contains(document.activeElement) || document.activeElement === document.body;
    root.hidden = true; options.onClose?.();
    const current = document.activeElement;
    if (ownedFocus && (!current || current === document.body || root.contains(current)) && !document.querySelector('dialog[open]')) {
      const target = focusable(returnFocus) ? returnFocus : document.getElementById('world-campaign-journal-open');
      if (focusable(target)) target.focus();
    }
    returnFocus = null;
  };
  function render() {
    if (disposed) return;
    const focused = document.activeElement as HTMLElement | null;
    const focusRegion = focused && list.contains(focused) ? focused.dataset.campaignRegion : undefined;
    const entries = getCampaignEpisodeJournal(options.done());
    title.textContent = bilingual('归路纪事', 'Chronicles of the Way Home');
    intro.textContent = bilingual('五处灯火，五个留下守候的人。这些现场故事伴随主线发生，不会锁住原来的道路；已完成主线也能回来亲手安排。', 'Five lights, five people keeping watch. These field stories accompany the main campaign without locking its roads. You can undertake them even after finishing the main story.');
    summary.textContent = bilingual(`已落实 ${entries.filter(entry => entry.state.completed).length}/5 · 追踪只设置路标；安排必须到现场确认。`, `Resolved ${entries.filter(entry => entry.state.completed).length}/5 · Tracking only sets a waypoint; decisions must be made at the site.`);
    main.textContent = bilingual('返回主线指引', 'Restore main-story guidance'); close.textContent = bilingual('返回', 'Back');
    list.replaceChildren();
    for (const { definition: def, state, guide } of entries) {
      const article = document.createElement('article'); article.dataset.campaignEntry = def.region;
      const heading = document.createElement('h3'), status = document.createElement('p'), body = document.createElement('p');
      heading.textContent = bilingual(...def.title);
      status.className = 'campaign-status'; status.textContent = `${bilingual(...REGIONS[def.region])} · ${bilingual(...def.speaker)} · ${bilingual(...STAGES[state.stage])}`;
      body.textContent = state.completed ? bilingual(...def.complete) : state.stage === 'briefing'
        ? bilingual('先与驻守者交谈，了解这里正在等待什么。', 'Speak with the resident to learn what this place is waiting for.')
        : bilingual(...guide!.text);
      article.append(heading, status, body);
      if (state.stage === 'work') {
        const progress = document.createElement('p'); progress.className = 'campaign-status';
        progress.textContent = bilingual(`工作台操作 ${state.workProgress}/2 · 可随时中断，已完成的步骤会保留。`, `Workstation operations ${state.workProgress}/2 · You may leave at any time; completed steps are retained.`); article.append(progress);
      }
      const choice = def.choices.find(choice => choice.id === state.choice);
      if (choice) {
        const chosen = document.createElement('p'); chosen.className = 'campaign-choice';
        chosen.textContent = bilingual(`你的安排：${choice.label[0]}`, `Your plan: ${choice.label[1]}`); article.append(chosen);
      }
      const track = document.createElement('button'); track.type = 'button'; track.dataset.campaignRegion = def.region;
      track.disabled = !guide; track.textContent = state.completed && !guide ? bilingual('已落实', 'Resolved') : bilingual('追踪这段纪事', 'Track this chronicle');
      track.addEventListener('click', () => { if (!disposed && !root.hidden && options.pin(def.region) !== false) hide(); });
      article.append(track); list.append(article);
    }
    const dispatch = getCampaignDispatchState(options.done());
    if (dispatch !== 'waiting') {
      const article = document.createElement('article'), heading = document.createElement('h3'), note = document.createElement('p');
      heading.textContent = bilingual('收束 · 五盏灯，一条回声', 'Closing · Five Lights, One Answer');
      note.textContent = dispatch === 'ready' ? bilingual(...getCampaignDispatchGuide(options.done())!.text) : bilingual('五处归路记录已归档。可在幻日谷发信板重读，不会重复奖励。', 'The five return records are filed. Reread them at the Valley dispatch board; there is no repeat reward.');
      article.append(heading, note);
      if (dispatch === 'ready') {
        const track = document.createElement('button'); track.type = 'button'; track.textContent = bilingual('追踪归路发信板', 'Track the return dispatch');
        track.onclick = () => { if (!disposed && !root.hidden && options.pin('alpha') !== false) hide(); }; article.append(track);
      }
      list.append(article);
    }
    if (focusRegion) {
      const next = Array.from(list.querySelectorAll<HTMLButtonElement>('button')).find(button => button.dataset.campaignRegion === focusRegion && !button.disabled);
      (next ?? close).focus();
    }
  }
  main.addEventListener('click', () => { if (!disposed && !root.hidden) { options.restoreMain(); hide(); } });
  close.addEventListener('click', hide);
  root.addEventListener('click', event => { event.stopPropagation(); if (event.target === root) hide(); });
  const key = (event: KeyboardEvent) => {
    if (disposed || root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); hide(); }
    else if (event.key === 'Tab') {
      const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.shiftKey ? (current <= 0 ? buttons.length - 1 : current - 1) : (current + 1) % buttons.length;
      event.preventDefault(); buttons[next]?.focus();
    } else event.stopPropagation();
  };
  document.addEventListener('keydown', key, true);
  const unsubscribe = onLanguageChange(() => { if (!root.hidden) render(); });
  return {
    get open() { return !disposed && !root.hidden; },
    show() {
      if (disposed || !root.hidden) return;
      const opener = document.activeElement as HTMLElement | null;
      if (options.onOpen() === false) return;
      returnFocus = opener; render(); root.hidden = false; close.focus();
    }, hide,
    refresh() { if (!disposed && !root.hidden) render(); },
    dispose() {
      if (disposed) return;
      hide(); disposed = true; returnFocus = null; unsubscribe(); document.removeEventListener('keydown', key, true); root.remove();
    },
  };
}
