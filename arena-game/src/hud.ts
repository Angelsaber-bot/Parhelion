// DOM HUD. Reads state, never changes it.

import { CHARACTERS, DASH, SCORE_LIMIT, SHIELD, TICK_HZ, WEAPONS, type Team } from '../shared/content.ts';
import type { PlayerSnap, Snapshot } from '../shared/match.ts';
import type { PlayerState } from '../shared/sim.ts';

const $ = (id: string) => document.getElementById(id)!;
const TEAM_NAME: Record<Team, string> = { A: '西 · 青', B: '东 · 橙' };

export class Hud {
  private feed = $('feed');
  private banner = $('banner');
  private bannerT = 0;
  private hitT = 0;
  private hurtT = 0;

  show(on: boolean) { $('hud').classList.toggle('hidden', !on); }

  update(dt: number, me: PlayerState | null, snap: Snapshot | null, myId: string, scoreboard: boolean, ping: string) {
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
      snap.phase === 'countdown' ? `开始倒计时 ${secs}` :
      snap.phase === 'ended' ? '本局结束' : '等待对手…';
    $('limit').textContent = `${snap.layout} · 先到 ${limit} 杀`;
    $('ping').textContent = ping;

    const self = snap.players.find((p) => p.id === myId);
    if (me && self) {
      const maxHp = CHARACTERS[me.char].hp;
      ($('hpfill') as HTMLElement).style.width = `${(100 * me.hp) / maxHp}%`;
      $('hptext').textContent = `${Math.ceil(me.hp)}`;
      const w = WEAPONS[me.weapon];
      $('ammo').textContent = me.reload > 0 ? '装填中' : `${me.ammo[me.weapon]}`;
      $('mag').textContent = `/ ${w.mag}`;
      $('wname').textContent = `${w.name} · ${w.skins[self.skins[me.weapon] ?? 0].name}`;
      document.querySelectorAll<HTMLElement>('.wslot').forEach((el, i) => el.classList.toggle('on', i === me.weapon));
      cooldown($('dash'), me.dashCd / DASH.cooldown, me.dashCd);
      cooldown($('shield'), me.shieldCd / SHIELD.cooldown, me.shieldCd);
      const dead = !me.alive;
      $('dead').classList.toggle('hidden', !dead);
      if (dead) $('respawn').textContent = `${Math.ceil(self.respawn / TICK_HZ)}`;
    }

    $('scoreboard').classList.toggle('hidden', !scoreboard && snap.phase !== 'ended');
    if (!$('scoreboard').classList.contains('hidden')) this.renderBoard(snap, myId);
  }

  private renderBoard(snap: Snapshot, myId: string) {
    const rows = (team: Team) => snap.players.filter((p) => p.team === team)
      .sort((a, b) => b.kills - a.kills)
      .map((p: PlayerSnap) => `<tr class="${p.id === myId ? 'me' : ''}"><td>${esc(p.name)}${p.bot ? ' <i>BOT</i>' : ''}</td><td>${CHARACTERS[p.char].name}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`)
      .join('');
    $('scoreboard').innerHTML = (['A', 'B'] as Team[]).map((t) =>
      `<div class="team t${t}"><h3>${TEAM_NAME[t]} <b>${snap.score[t]}</b></h3><table><tr><th>玩家</th><th>角色</th><th>击杀</th><th>死亡</th></tr>${rows(t)}</table></div>`,
    ).join('');
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

  kill(killer: string, victim: string, weapon: number, head: boolean, kTeam: Team, vTeam: Team) {
    const row = document.createElement('div');
    row.innerHTML = `<span class="t${kTeam}">${esc(killer)}</span> <em>${WEAPONS[weapon].name}${head ? ' ◎' : ''}</em> <span class="t${vTeam}">${esc(victim)}</span>`;
    this.feed.prepend(row);
    setTimeout(() => row.remove(), 5000);
    while (this.feed.children.length > 5) this.feed.lastChild!.remove();
  }

  deathBy(name: string) { $('killer').textContent = name; }

  /** Centre-screen kill confirmation with streak name, re-triggering its pop animation. */
  killPop(head: boolean, streak: number) {
    const el = $('killpop');
    const names = ['', '击杀', '双杀', '三杀', '四杀', '五杀'];
    el.innerHTML = `<b>${names[Math.min(streak, 5)] || `${streak} 连杀`}</b>${head ? '<i>爆头</i>' : ''}`;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /** Crosshair spread from recoil and movement, 0..1. */
  bloom(v: number) { ($('crosshair') as HTMLElement).style.setProperty('--bloom', v.toFixed(3)); }

  announce(text: string, secs = 2) {
    this.banner.textContent = text;
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
