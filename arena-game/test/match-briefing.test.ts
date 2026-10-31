import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { arenaControlHints, arenaLimitLabel, arenaMatchBriefing, arenaPauseLabel } from '../src/matchBriefing.ts';
import { MATCH_TICKS, SCORE_LIMIT, TEAM_CAPACITY, TICK_HZ, type TeamLayout } from '../shared/content.ts';
import { setLanguage } from '../../shared-client/i18n.ts';
import { SettingsStore } from '../../shared-client/settings.ts';
import { startOffline } from '../src/session.ts';
afterEach(() => { setLanguage('zh'); vi.useRealTimers(); });
for (const language of ['zh','en'] as const) for (const layout of ['1v1','1v2','2v2'] as TeamLayout[]) it(`${language} ${layout} briefing derives scores, duration and seats from actual rules`, () => {
  setLanguage(language);
  const copy = arenaMatchBriefing({layout, team:'A', mode:'offline', bots:false});
  expect(copy.rules).toContain(String(SCORE_LIMIT[layout])); expect(copy.rules).toContain(String(MATCH_TICKS/TICK_HZ/60));
  expect(copy.rules).toContain(language==='en'?'draw':'平局');
  expect(copy.teams).toContain(String(TEAM_CAPACITY[layout].A)); expect(copy.teams).toContain(String(TEAM_CAPACITY[layout].B));
  expect(arenaLimitLabel(layout)).toContain(String(SCORE_LIMIT[layout])); expect(arenaLimitLabel(layout)).toContain('5');
});
it('team, mode and Bot policy changes produce truthful explanations without modifying selections', () => {
  setLanguage('en');
  const opts = {layout:'1v2' as const,team:'A' as const,mode:'offline' as const,bots:false}; const before={...opts};
  expect(arenaMatchBriefing(opts).teams).toContain('You join West/Cyan');
  expect(arenaMatchBriefing({...opts,team:'B'}).teams).toContain('You join East/Orange');
  const online=arenaMatchBriefing({...opts,mode:'online',team:'auto'});
  expect(online.teams).toContain('automatic team'); expect(online.teams).toContain('full team');
  expect(online.connection).toContain('both teams have someone'); expect(online.connection).toContain('match continues');
  expect(online.connection).toContain('server, map, layout and Bot-fill');
  expect(arenaMatchBriefing({...opts,mode:'online',bots:true}).connection).toContain('Bots fill empty seats');
  expect(arenaMatchBriefing(opts).connection).toContain('pauses the entire offline match'); expect(opts).toEqual(before);
  expect(arenaPauseLabel('online')).toBe('Menu · Match continues'); expect(arenaPauseLabel('offline')).toBe('Paused');
});
it('control hints use current custom bindings and never claim online simulation pauses', () => {
  setLanguage('en'); const store=new SettingsStore('arena',{getItem:()=>null,setItem:()=>{}});
  expect(store.bind('fire','KeyK')).toBeNull(); expect(store.bind('aim','KeyJ')).toBeNull();
  const hint=arenaControlHints(action=>store.label(action),'online');
  expect(hint).toContain('K Shoot / melee'); expect(hint).toContain('J'); expect(hint).toContain('Hold aim'); expect(hint).toContain('Esc Menu (match continues)'); expect(hint).not.toContain('Esc Pause');
  expect(arenaControlHints(action=>store.label(action),'offline')).toContain('Esc Pause');
});
it('actual offline session clock and entire authoritative snapshot stay frozen until explicit resume', () => {
  vi.useFakeTimers({toFake:['setInterval','clearInterval','performance']});
  const session=startOffline({layout:'1v2',team:'B',name:'QA',char:0,skins:[]},'easy');
  try {
    vi.advanceTimersByTime(400); expect(session.match!.tick).toBeGreaterThan(0);
    expect(session.match!.snapshot().players.filter(p=>p.team==='B')).toHaveLength(2);
    session.setPaused(true); const before=session.match!.snapshot();
    vi.advanceTimersByTime(10000); expect(session.match!.snapshot()).toEqual(before);
    session.setPaused(false); vi.advanceTimersByTime(100); expect(session.match!.tick).toBeGreaterThan(before.tick);
  } finally { session.close(); }
  expect(vi.getTimerCount()).toBe(0);
});
it('production UI refreshes on locale, mode, layout, team and Bot changes without protocol edits', () => {
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  expect(main).toContain("['layout', 'team', 'bots']"); expect(main).toContain("addEventListener('change', renderMatchBriefing)");
  expect(main).toContain('renderMatchBriefing(); renderControlHints();');
  expect(main.slice(main.indexOf('onLanguageChange(() =>'))).toContain('renderMatchBriefing();');
  expect(main).toContain('arenaControlHints(k, mode)');
});

it('page-exit effect cleanup preserves BFCache and ordinary rematches', () => {
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  expect(main).toContain("addEventListener('pagehide', (event) => { if (!event.persisted) scene.disposeCombatEffects(); });");
  expect(main.match(/scene\.disposeCombatEffects\(\)/g)).toHaveLength(1);
});
