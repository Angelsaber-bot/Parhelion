/**
 * Boss title cards: a letterboxed name card when an era boss rises, an act card when its second
 * phase (and arena mechanic) begins, and a closing card on the kill. Presentation only: the fight
 * runs underneath, the card never takes input and never blocks the view's centre.
 */
import { bilingual } from '../../../shared-client/i18n';

type Line = readonly [string, string];
interface BossTitle { name: Line; epithet: Line; place: Line; act: Line; color: string }

export const BOSS_TITLES: Readonly<Record<string, BossTitle>> = Object.freeze({
  boss_vacant_king: { name: ['空位之王', 'The Vacant King'], epithet: ['无人加冕的王座之影', 'Shadow of an Uncrowned Throne'], place: ['落日王国 · 537 · 卡姆兰', 'Sunset Kingdom · 537 · Camlann'], act: ['第二幕 · 誓剑雨', 'Act II · Oath Blade Rain'], color: '#ffbe62' },
  boss_drowned_admiral: { name: ['梅瑞克', 'Meyrick'], epithet: ['最后一个船长', 'The Last Captain'], place: ['黑帆尽头 · 1718 · 拿骚', "Black Sail's End · 1718 · Nassau"], act: ['第二幕 · 侧舷齐射', 'Act II · Broadside'], color: '#a8fff0' },
  boss_winter_warden: { name: ['最后方阵', 'The Last Square'], epithet: ['仍在执行旧命令的队伍', 'A Column Still Obeying an Old Order'], place: ['永冬之城 · 1812 · 旧税关广场', 'City of Eternal Winter · 1812 · Old Customs Square'], act: ['第二幕 · 冻土绽放', 'Act II · Frost Bloom'], color: '#bfeaff' },
  boss_hellfire_lord: { name: ['业火之主', 'The Hellfire Lord'], epithet: ['改写结局的火', 'The Fire That Rewrites Endings'], place: ['业火京都 · 1582 · 本能寺', 'Hellfire Kyoto · 1582 · Honnō-ji'], act: ['第二幕 · 业火追迹', 'Act II · Hellfire Trail'], color: '#ff8a6a' },
});

export type TitleMoment = 'rise' | 'act' | 'fall';
const SECONDS: Record<TitleMoment, number> = { rise: 3.6, act: 2.4, fall: 3.2 };

/** The lines a card shows; exported for tests and so the copy lives in one place. */
export function titleLines(id: string, moment: TitleMoment): { top: Line; name: Line; sub: Line } | null {
  const t = BOSS_TITLES[id]; if (!t) return null;
  if (moment === 'rise') return { top: t.place, name: t.name, sub: t.epithet };
  if (moment === 'act') return { top: t.name, name: t.act, sub: ['看清地面预警', 'Read the ground'] };
  return { top: ['讨伐完成', 'Vanquished'], name: t.name, sub: t.epithet };
}

export class BossTitleCard {
  private root: HTMLElement | null = null;
  private left = 0;
  constructor(private readonly reduced: () => boolean = () => false) {}
  /** Built on first use, so headless hosts without a real DOM never touch it. */
  private element() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.id = 'boss-title'; root.hidden = true; root.setAttribute('aria-live', 'polite');
    root.innerHTML = '<i class="bt-bar bt-top"></i><i class="bt-bar bt-bottom"></i><div class="bt-card"><small></small><strong></strong><span></span></div>';
    document.body.append(root);
    return this.root = root;
  }
  show(id: string, moment: TitleMoment) {
    const lines = titleLines(id, moment); if (!lines) return;
    try {
      const root = this.element(), card = root.querySelector('.bt-card') as HTMLElement;
      card.querySelector('small')!.textContent = bilingual(...lines.top);
      card.querySelector('strong')!.textContent = bilingual(...lines.name);
      card.querySelector('span')!.textContent = bilingual(...lines.sub);
      root.style.setProperty('--bt-color', BOSS_TITLES[id].color);
      root.className = `bt-${moment}${this.reduced() ? ' bt-reduced' : ''}`;
      // restart the CSS animation even when a card is already up
      root.hidden = true; void root.offsetWidth; root.hidden = false;
      this.left = this.reduced() ? Math.min(1.6, SECONDS[moment]) : SECONDS[moment];
    } catch { this.root = null; } // presentation only: a minimal DOM simply shows no card
  }
  update(dt: number) { if (this.left > 0 && (this.left -= dt) <= 0) this.hide(); }
  hide() { this.left = 0; if (this.root) this.root.hidden = true; }
  get visible() { return !!this.root && !this.root.hidden; }
  dispose() { this.root?.remove(); this.root = null; }
}
