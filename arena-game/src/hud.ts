import { bilingual, getLanguage, localizeText } from '../../shared-client/i18n.ts';
// DOM HUD. Reads state, never changes it.

import { CHARACTERS, DASH, SCORE_LIMIT, SHIELD, TICK_HZ, WEAPONS, type Team } from '../shared/content.ts';
import type { PlayerSnap, Snapshot } from '../shared/match.ts';
import type { PlayerState } from '../shared/sim.ts';
import { displayWeaponName, weaponHud } from './loadout.ts';

const $ = (id: string) => document.getElementById(id)!;
const TEAM_NAME: Record<Team, string> = { A: '西 · 青', B: '东 · 橙' };

export class Hud {
  private feed = $('feed');
  private banner = $('banner');
  private bannerT = 0;
  private hitT = 0;
  private hurtT = 0;
  private bannerText = '';
  private boardMarkup = '';
  private feedRows: { element: HTMLElement; killer: string; victim: string; weapon: number; head: boolean; kTeam: Team; vTeam: Team }[] = [];
  private pop: { head: boolean; streak: number } | null = null;
  private language = getLanguage();

  aim(value: number, scoped: boolean) {
    const scope = $('scope');
    scope.style.opacity = String(scoped ? Math.max(0, (value - 0.7) / 0.3) : 0);
    scope.classList.toggle('hidden', !scoped || value < 0.7);
    $('crosshair').classList.toggle('ads', value > 0.8);
    $('crosshair').classList.toggle('scoped', scoped && value > 0.9);
  }

  show(on: boolean) { $('hud').classList.toggle('hidden', !on); }
  resetRound() {
    this.bannerT = this.hitT = this.hurtT = 0; this.bannerText = ''; this.pop = null;
    this.banner.textContent = ''; this.banner.classList.add('hidden');
    $('scoreA').textContent = '0'; $('scoreB').textContent = '0'; $('clock').textContent = '—';
    $('limit').textContent = ''; $('ping').textContent = ''; $('ammo').textContent = '—';
    $('mag').textContent = ''; $('wname').textContent = ''; $('hptext').textContent = '—';
    $('hpfill').style.width = '0%';
    $('wslots').querySelectorAll<HTMLElement>('.wslot').forEach((slot) => slot.classList.remove('on'));
    this.aim(0, false);
    this.feedRows.forEach((row) => row.element.remove()); this.feedRows = [];
    this.boardMarkup = ''; $('scoreboard').innerHTML = ''; $('scoreboard').classList.add('hidden');
    $('killpop').innerHTML = ''; $('killpop').classList.remove('pop');
    $('killer').textContent = ''; $('dead').classList.add('hidden');
    $('hitmarker').style.opacity = '0'; $('hurt').style.opacity = '0';
  }

  update(dt: number, me: PlayerState | null, snap: Snapshot | null, myId: string, scoreboard: boolean, ping: string) {
    if (this.language !== getLanguage()) {
      this.language = getLanguage();
      this.banner.textContent = localizeText(this.bannerText);
      this.feedRows.forEach((row) => this.renderKill(row));
      if (this.pop) this.renderKillPop(this.pop.head, this.pop.streak);
    }
    this.bannerT -= dt;
    if (this.bannerT <= 0) this.banner.classList.add('hidden');
    this.hitT = Math.max(0, this.hitT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    $('hitmarker').style.opacity = String(Math.min(1, this.hitT * 6));
    $('hurt').style.opacity = String(Math.min(0.8, this.hurtT * 2));
    if (!snap) return;

    const limit = SCORE_LIMIT[snap.layout];
    $('scoreA').textContent = String(snap.score.A);
    $('scoreB').textContent = String(snap.score.B);
    const secs = Math.ceil(snap.phaseT / TICK_HZ);
    $('clock').textContent =
      snap.phase === 'live' ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` :
      snap.phase === 'countdown' ? bilingual(`开始倒计时 ${secs}`, `Starting in ${secs}`) :
      snap.phase === 'ended' ? bilingual('本局结束', 'Match over') : bilingual('等待对手…', 'Waiting for opponent…');
    $('limit').textContent = bilingual(`${snap.layout} · 先到 ${limit} 杀`, `${snap.layout} · First to ${limit} kills`);
    $('ping').textContent = ping;

    const self = snap.players.find((p) => p.id === myId);
    if (me && self) {
      const maxHp = CHARACTERS[me.char].hp;
      ($('hpfill') as HTMLElement).style.width = `${(100 * me.hp) / maxHp}%`;
      $('hptext').textContent = `${Math.ceil(me.hp)}`;
      const equipment = weaponHud(me, self.skins);
      $('weapon').classList.toggle('melee', equipment.melee);
      $('ammo').textContent = equipment.ammo;
      $('mag').textContent = equipment.detail;
      $('wname').textContent = equipment.name;
      $('scope').querySelector('b')!.textContent = equipment.scope;
      $('wslots').querySelectorAll<HTMLElement>('.wslot').forEach((el, i) => {
        const slot = equipment.slots[i];
        el.classList.toggle('on', slot.active);
        el.querySelector('small')!.textContent = slot.name;
        el.setAttribute('aria-label', `${el.querySelector('kbd')!.textContent} · ${slot.name}`);
      });
      cooldown($('dash'), me.dashCd / DASH.cooldown, me.dashCd);
      cooldown($('shield'), me.shieldCd / SHIELD.cooldown, me.shieldCd);
      const dead = !me.alive;
      $('dead').classList.toggle('hidden', !dead);
      if (dead) $('respawn').textContent = `${Math.ceil(self.respawn / TICK_HZ)}`;
    }

    $('scoreboard').classList.toggle('hidden', !scoreboard);
    $('scoreboard').classList.toggle('results', snap.phase === 'ended');
    if (!$('scoreboard').classList.contains('hidden')) this.renderBoard(snap, myId);
  }

  private renderBoard(snap: Snapshot, myId: string) {
    $('scoreboard').setAttribute('aria-label', bilingual('计分板', 'Scoreboard'));
    $('scoreboard').setAttribute('role', 'region');
    const rows = (team: Team) => snap.players.filter((p) => p.team === team)
      .sort((a, b) => b.kills - a.kills)
      .map((p: PlayerSnap) => `<tr class="${p.id === myId ? 'me' : ''}"><td>${esc(p.name)}${p.bot ? ' <i>BOT</i>' : ''}</td><td>${CHARACTERS[p.char].name}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`)
      .join('');
    const markup = (snap.phase === 'ended' ? `<div class="scores-close"><button type="button" data-close-scores>${bilingual('关闭计分板 (S / Esc)', 'Close scoreboard (S / Esc)')}</button></div>` : '') + (['A', 'B'] as Team[]).map((t) =>
      `<div class="team t${t}"><h3>${localizeText(TEAM_NAME[t])} <b>${snap.score[t]}</b></h3><table><tr><th>${bilingual('玩家', 'Player')}</th><th>${bilingual('角色', 'Character')}</th><th>${bilingual('击杀', 'Kills')}</th><th>${bilingual('死亡', 'Deaths')}</th></tr>${rows(t)}</table></div>`,
    ).join('');
    // Do not replace focused close buttons every frame. Usernames stay escaped, never translated.
    if (markup !== this.boardMarkup) { $('scoreboard').innerHTML = markup; this.boardMarkup = markup; }
  }

  hit(head: boolean, kill: boolean) {
    this.hitT = kill ? 0.45 : 0.25;
    const el = $('hitmarker');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    el.classList.toggle('head', head);
    el.classList.toggle('kill', kill);
  }

  hurt() { this.hurtT = 0.5; }

  private renderKill(row: typeof this.feedRows[number]) {
    row.element.innerHTML = `<span class="t${row.kTeam}" data-no-i18n>${esc(row.killer)}</span> <em>${displayWeaponName(WEAPONS[row.weapon].id)}${row.head ? ' ◎' : ''}</em> <span class="t${row.vTeam}" data-no-i18n>${esc(row.victim)}</span>`;
  }
  kill(killer: string, victim: string, weapon: number, head: boolean, kTeam: Team, vTeam: Team) {
    const row = { element: document.createElement('div'), killer, victim, weapon, head, kTeam, vTeam };
    this.renderKill(row); this.feed.prepend(row.element); this.feedRows.unshift(row);
    setTimeout(() => { row.element.remove(); this.feedRows = this.feedRows.filter((item) => item !== row); }, 5000);
    while (this.feedRows.length > 5) this.feedRows.pop()!.element.remove();
  }

  deathBy(name: string) { $('killer').textContent = name; }

  /** Centre-screen kill confirmation with streak name, re-triggering its pop animation. */
  private renderKillPop(head: boolean, streak: number) {
    const names = [['', ''], ['击杀', 'Elimination'], ['双杀', 'Double kill'], ['三杀', 'Triple kill'], ['四杀', 'Quadra kill'], ['五杀', 'Penta kill']];
    const entry = names[Math.min(streak, 5)];
    const name = entry ? bilingual(entry[0], entry[1]) : bilingual(`${streak} 连杀`, `${streak} kill streak`);
    $('killpop').innerHTML = `<b>${name}</b>${head ? `<i>${bilingual('爆头', 'Headshot')}</i>` : ''}`;
  }
  killPop(head: boolean, streak: number) {
    this.pop = { head, streak }; this.renderKillPop(head, streak);
    const el = $('killpop'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }

  /** Crosshair spread from recoil and movement, 0..1. */
  bloom(v: number) { ($('crosshair') as HTMLElement).style.setProperty('--bloom', v.toFixed(3)); }

  announce(text: string, secs = 2) {
    this.bannerText = text; this.banner.textContent = localizeText(text);
    this.banner.classList.remove('hidden');
    this.bannerT = secs;
  }
}

function cooldown(el: HTMLElement, frac: number, ticks: number) {
  el.style.setProperty('--cd', String(frac));
  el.classList.toggle('ready', ticks === 0);
  el.querySelector('b')!.textContent = ticks ? String(Math.ceil(ticks / TICK_HZ)) : '';
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export { TEAM_NAME };
