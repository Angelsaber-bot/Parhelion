/** Training-range readout, built only from authoritative match events: accuracy, headshot
 * rate, damage per second over the last few seconds, last time-to-kill and kills. */
import { bilingual } from '../../../shared-client/i18n.ts';
import type { NetEvent } from '../../shared/match.ts';

const WINDOW = 3; // seconds of damage averaged for DPS

export class RangeStats {
  shots = 0; hits = 0; heads = 0; kills = 0; lastTtk: number | null = null; bestTtk: number | null = null;
  private damage: { at: number; dmg: number }[] = [];
  private firstHit = new Map<string, number>();

  event(e: NetEvent, me: string, now: number) {
    if (e.t === 'shot' && e.id === me) this.shots++;
    else if (e.t === 'hit' && e.shooter === me && e.victim !== me) {
      this.hits++; if (e.head) this.heads++;
      this.damage.push({ at: now, dmg: e.dmg });
      if (!this.firstHit.has(e.victim)) this.firstHit.set(e.victim, now);
    } else if (e.t === 'kill' && e.killer === me && e.victim !== me) {
      this.kills++;
      const start = this.firstHit.get(e.victim);
      if (start !== undefined) { this.lastTtk = now - start; this.bestTtk = this.bestTtk === null ? this.lastTtk : Math.min(this.bestTtk, this.lastTtk); }
      this.firstHit.delete(e.victim);
    } else if (e.t === 'spawn') this.firstHit.delete(e.id);
  }
  dps(now: number) {
    this.damage = this.damage.filter((d) => now - d.at <= WINDOW);
    return this.damage.reduce((n, d) => n + d.dmg, 0) / WINDOW;
  }
  reset() { this.shots = this.hits = this.heads = this.kills = 0; this.lastTtk = this.bestTtk = null; this.damage = []; this.firstHit.clear(); }
  render(now: number) {
    const pct = (a: number, b: number) => b ? `${Math.round(Math.min(1, a / b) * 100)}%` : '—';
    const s = (t: number | null) => t === null ? '—' : `${t.toFixed(2)}s`;
    return `<div class="range-title">${bilingual('训练场', 'Training range')}</div>`
      + `${bilingual('命中率', 'Accuracy')} <b>${pct(this.hits, this.shots)}</b> · ${bilingual('爆头', 'Headshots')} <b>${pct(this.heads, this.hits)}</b><br>`
      + `${bilingual('秒伤', 'DPS')} <b>${Math.round(this.dps(now))}</b> · ${bilingual('击杀', 'Kills')} <b>${this.kills}</b><br>`
      + `${bilingual('击杀用时', 'Time to kill')} <b>${s(this.lastTtk)}</b> · ${bilingual('最快', 'Best')} <b>${s(this.bestTtk)}</b><br>`
      + `<span style="opacity:.7">${bilingual('Esc 打开训练场菜单：换武器、皮肤、道具', 'Esc: range menu (weapons, finishes, utility)')}</span>`;
  }
}
