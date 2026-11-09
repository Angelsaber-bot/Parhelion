/**
 * Full-map overlay for the 幻日探索层: statues, domains, outposts, prism puzzles and trials.
 * Chests and feathers stay hidden so exploring still finds them; the legend shows each
 * region's exploration percentage. The minimap stays a pure navigation view.
 */
import { bilingual } from '../../../shared-client/i18n';
import type { RegionId } from '../settlements/types';
import { EMBER_ROUTES, FOXFIRES, SIGNALS, TREASURE_MAPS, flagDig, flagEmber, flagFox, flagSignal } from './regional';
import { CAMPS, DOMAINS, PUZZLES, REGION_NAMES, STATUES, TRIALS, flagCamp, flagElite, flagPuzzle, flagTrial, regionExploration } from './catalog';
import { MINIBOSSES } from '../combat/minibosses';
import { COMMISSION, commissionDone, huntProgress, type Commission } from './commissions';

export type MapIconKind = 'statue' | 'domain' | 'camp' | 'puzzle' | 'trial' | 'bottle' | 'ember' | 'fox' | 'duel' | 'signal' | 'elite';
export interface MapIcon { readonly id: string; readonly kind: MapIconKind; readonly x: number; readonly z: number; readonly cleared: boolean }
type Project = (x: number, z: number) => { x: number; y: number };

const domainIds = new Set(DOMAINS.map(d => d.id));
const centroid = (pts: readonly (readonly [number, number])[]): [number, number] => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

export function explorationMapIcons(done: ReadonlySet<string>): MapIcon[] {
  return [
    ...STATUES.map(s => ({ id: `statue:${s.id}`, kind: 'statue' as const, x: s.p[0], z: s.p[1], cleared: false })),
    // a domain's seal puzzle and its waves are one icon: cleared when the last wave falls
    ...DOMAINS.map(d => ({ id: `domain:${d.id}`, kind: 'domain' as const, x: d.center[0], z: d.center[1], cleared: done.has(flagCamp(d.id)) })),
    // a story vanguard shows once the road to it has opened
    ...CAMPS.filter(c => !domainIds.has(c.id) && !(c.style === 'vanguard' && c.requires && !done.has(c.requires))).map(c => ({ id: `camp:${c.id}`, kind: (c.style === 'duel' ? 'duel' : 'camp') as MapIconKind, x: c.anchor[0], z: c.anchor[1], cleared: done.has(flagCamp(c.id)) })),
    ...PUZZLES.filter(p => !domainIds.has(p.id)).map(p => { const [x, z] = centroid([p.source.p, p.receiver, ...p.prisms.map(q => q.p)]); return { id: `puzzle:${p.id}`, kind: 'puzzle' as const, x, z, cleared: done.has(flagPuzzle(p.id)) }; }),
    ...TRIALS.map(t => ({ id: `trial:${t.id}`, kind: 'trial' as const, x: t.stele[0], z: t.stele[1], cleared: done.has(flagTrial(t.id)) })),
    // treasure: only where the first map washes up; the dig sites are the hunt itself
    ...TREASURE_MAPS.filter(m => m.bottle).map(m => ({ id: `bottle:${m.id}`, kind: 'bottle' as const, x: m.bottle![0], z: m.bottle![1], cleared: TREASURE_MAPS.every(x => done.has(flagDig(x.id))) })),
    ...EMBER_ROUTES.map(e => ({ id: `ember:${e.id}`, kind: 'ember' as const, x: e.brazier[0], z: e.brazier[1], cleared: done.has(flagEmber(e.id)) })),
    ...FOXFIRES.map(f => ({ id: `fox:${f.id}`, kind: 'fox' as const, x: f.shrine[0], z: f.shrine[1], cleared: done.has(flagFox(f.id)) })),
    ...SIGNALS.map(g => ({ id: `signal:${g.id}`, kind: 'signal' as const, x: g.terminal[0], z: g.terminal[1], cleared: done.has(flagSignal(g.id)) })),
    // roaming elites: their home pocket, greyed once the one-time bounty is claimed
    ...MINIBOSSES.map(m => ({ id: `elite:${m.id}`, kind: 'elite' as const, x: m.x, z: m.z, cleared: done.has(flagElite(m.id)) })),
  ];
}

const COLORS: Record<MapIconKind, string> = { statue: '#ffe08a', domain: '#c89bff', camp: '#ff7a6b', puzzle: '#7fe6ff', trial: '#9df0b0', bottle: '#f0d9a0', ember: '#ffa54a', fox: '#8fe0ff', duel: '#ffd36b', signal: '#79e2ff', elite: '#ff5d73' };
const OUTLINE = '#1f2a44', CLEARED = '#9aa3b2';

/** Today's board as map pins: outposts and echoes get a gold ring; hunts have no single spot. */
export function commissionPins(board: { day: string; list: readonly Commission[] }, done: ReadonlySet<string>) {
  return board.list.filter(c => c.at && !commissionDone(done, board.day, c.n)).map(c => ({ n: c.n, x: c.at![0], z: c.at![1] }));
}

export function drawExplorationIcons(ctx: CanvasRenderingContext2D, done: ReadonlySet<string>, project: Project, unit: number, width: number, board?: { day: string; list: readonly Commission[] }) {
  ctx.save();
  for (const icon of explorationMapIcons(done)) {
    const { x, y } = project(icon.x, icon.z), u = unit;
    if (x < -10 || y < -10 || x > width + 10 || y > width + 10) continue;
    const color = icon.cleared ? CLEARED : COLORS[icon.kind];
    ctx.beginPath();
    switch (icon.kind) {
      case 'statue': { // sun disc with eight rays
        ctx.arc(x, y, 4.2 * u, 0, Math.PI * 2);
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(x + Math.cos(a) * 6 * u, y + Math.sin(a) * 6 * u); ctx.lineTo(x + Math.cos(a) * 8.5 * u, y + Math.sin(a) * 8.5 * u); }
        break;
      }
      case 'domain': // gate: double diamond
        ctx.moveTo(x, y - 8 * u); ctx.lineTo(x + 7 * u, y); ctx.lineTo(x, y + 8 * u); ctx.lineTo(x - 7 * u, y); ctx.closePath();
        ctx.moveTo(x, y - 4 * u); ctx.lineTo(x + 3.5 * u, y); ctx.lineTo(x, y + 4 * u); ctx.lineTo(x - 3.5 * u, y); ctx.closePath();
        break;
      case 'camp': // crossed blades
        ctx.moveTo(x - 6 * u, y - 6 * u); ctx.lineTo(x + 6 * u, y + 6 * u); ctx.moveTo(x + 6 * u, y - 6 * u); ctx.lineTo(x - 6 * u, y + 6 * u);
        ctx.moveTo(x - 6 * u, y + 2 * u); ctx.lineTo(x - 2 * u, y + 6 * u); ctx.moveTo(x + 6 * u, y + 2 * u); ctx.lineTo(x + 2 * u, y + 6 * u);
        break;
      case 'puzzle': // prism triangle with a ray
        ctx.moveTo(x, y - 6.5 * u); ctx.lineTo(x + 6 * u, y + 5 * u); ctx.lineTo(x - 6 * u, y + 5 * u); ctx.closePath();
        ctx.moveTo(x - 9 * u, y - 1 * u); ctx.lineTo(x - 2.5 * u, y + 1 * u);
        break;
      case 'bottle': // bottle on its side
        ctx.moveTo(x - 7 * u, y - 2.5 * u); ctx.lineTo(x + 3 * u, y - 2.5 * u); ctx.lineTo(x + 5 * u, y - 1 * u); ctx.lineTo(x + 8 * u, y - 1 * u);
        ctx.lineTo(x + 8 * u, y + 1 * u); ctx.lineTo(x + 5 * u, y + 1 * u); ctx.lineTo(x + 3 * u, y + 2.5 * u); ctx.lineTo(x - 7 * u, y + 2.5 * u); ctx.closePath();
        break;
      case 'ember': // flame
        ctx.moveTo(x, y - 8 * u); ctx.quadraticCurveTo(x + 6 * u, y - 1 * u, x + 4 * u, y + 4 * u); ctx.quadraticCurveTo(x, y + 8 * u, x - 4 * u, y + 4 * u); ctx.quadraticCurveTo(x - 6 * u, y - 1 * u, x, y - 8 * u);
        break;
      case 'fox': // fox head
        ctx.moveTo(x - 6 * u, y - 7 * u); ctx.lineTo(x - 3 * u, y - 2 * u); ctx.lineTo(x + 3 * u, y - 2 * u); ctx.lineTo(x + 6 * u, y - 7 * u); ctx.lineTo(x + 6 * u, y);
        ctx.lineTo(x, y + 7 * u); ctx.lineTo(x - 6 * u, y); ctx.closePath();
        break;
      case 'duel': // heater shield
        ctx.moveTo(x - 6 * u, y - 6 * u); ctx.lineTo(x + 6 * u, y - 6 * u); ctx.lineTo(x + 6 * u, y); ctx.quadraticCurveTo(x + 5 * u, y + 5 * u, x, y + 8 * u);
        ctx.quadraticCurveTo(x - 5 * u, y + 5 * u, x - 6 * u, y); ctx.closePath(); ctx.moveTo(x, y - 6 * u); ctx.lineTo(x, y + 8 * u);
        break;
      case 'signal': // mast with two radio arcs
        ctx.moveTo(x - 2 * u, y + 7 * u); ctx.lineTo(x, y - 3 * u); ctx.lineTo(x + 2 * u, y + 7 * u);
        ctx.moveTo(x - 4 * u, y - 6 * u); ctx.quadraticCurveTo(x, y - 9.5 * u, x + 4 * u, y - 6 * u);
        ctx.moveTo(x - 7 * u, y - 8 * u); ctx.quadraticCurveTo(x, y - 13.5 * u, x + 7 * u, y - 8 * u);
        break;
      case 'elite': // horned crest: a crown of two horns over a shield
        ctx.moveTo(x - 5 * u, y - 2 * u); ctx.lineTo(x + 5 * u, y - 2 * u); ctx.lineTo(x + 5 * u, y + 2 * u); ctx.quadraticCurveTo(x + 4 * u, y + 6 * u, x, y + 8 * u);
        ctx.quadraticCurveTo(x - 4 * u, y + 6 * u, x - 5 * u, y + 2 * u); ctx.closePath();
        ctx.moveTo(x - 4 * u, y - 2 * u); ctx.quadraticCurveTo(x - 8 * u, y - 6 * u, x - 6 * u, y - 10 * u);
        ctx.moveTo(x + 4 * u, y - 2 * u); ctx.quadraticCurveTo(x + 8 * u, y - 6 * u, x + 6 * u, y - 10 * u);
        ctx.moveTo(x - 2 * u, y + 2 * u); ctx.lineTo(x + 2 * u, y + 2 * u);
        break;
      case 'trial': // stele
        ctx.moveTo(x - 3.5 * u, y + 7 * u); ctx.lineTo(x - 3.5 * u, y - 4 * u); ctx.lineTo(x, y - 7 * u); ctx.lineTo(x + 3.5 * u, y - 4 * u); ctx.lineTo(x + 3.5 * u, y + 7 * u); ctx.closePath();
        break;
    }
    ctx.lineWidth = 5 * u; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = color; ctx.stroke();
  }
  if (board) drawCommissions(ctx, board, done, project, unit, width);
  // legend: exploration percentage per region, bottom-left
  const regions: RegionId[] = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'];
  const line = 17 * unit, pad = 10 * unit, boxW = 190 * unit, boxH = pad * 2 + line * regions.length;
  const bx = 14 * unit, by = width - boxH - 14 * unit;
  ctx.fillStyle = '#141c30cc'; ctx.fillRect(bx, by, boxW, boxH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `600 ${12 * unit}px system-ui, sans-serif`;
  regions.forEach((region, i) => {
    const ex = regionExploration(region, done), name = REGION_NAMES[region];
    const y = by + pad + line * (i + .5);
    ctx.fillStyle = '#e8ecf2'; ctx.fillText(name ? bilingual(name[0], name[1]) : region, bx + pad, y);
    ctx.textAlign = 'right'; ctx.fillStyle = ex.percent >= 100 ? '#ffe08a' : '#b8c4d6'; ctx.fillText(`${ex.percent}%`, bx + boxW - pad, y); ctx.textAlign = 'left';
  });
  ctx.restore();
}

const GOLD = '#ffd36b';
function drawCommissions(ctx: CanvasRenderingContext2D, board: { day: string; list: readonly Commission[] }, done: ReadonlySet<string>, project: Project, unit: number, width: number) {
  const u = unit;
  for (const pin of commissionPins(board, done)) {
    const { x, y } = project(pin.x, pin.z);
    if (x < -10 || y < -10 || x > width + 10 || y > width + 10) continue;
    ctx.beginPath(); ctx.arc(x, y, 12 * u, 0, Math.PI * 2);
    ctx.lineWidth = 5 * u; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 2.2 * u; ctx.strokeStyle = GOLD; ctx.stroke();
    // the commission's "!" tab above the ring
    ctx.beginPath(); ctx.moveTo(x, y - 12 * u); ctx.lineTo(x - 5 * u, y - 19 * u); ctx.lineTo(x + 5 * u, y - 19 * u); ctx.closePath();
    ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = OUTLINE; ctx.stroke();
  }
  // The northwest is now Orleans. Keep its title and geography visible: on wide
  // maps the board shares the unused southwest with the exploration legend;
  // compact maps retain commission pins and the journal instead of a text box.
  if(width/u<800)return;
  const line = 17 * u, pad = 10 * u, boxW = 260 * u, boxH = pad * 2 + line * (board.list.length + 1);
  const legendH=20*u+17*u*Object.keys(REGION_NAMES).length;
  const bx = 14 * u, by = width-legendH-boxH-42*u;
  ctx.fillStyle = '#141c30cc'; ctx.fillRect(bx, by, boxW, boxH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const finished = board.list.filter(c => commissionDone(done, board.day, c.n)).length;
  ctx.font = `700 ${12.5 * u}px system-ui, sans-serif`; ctx.fillStyle = GOLD;
  ctx.fillText(bilingual(`日晕委托 ${finished}/${board.list.length}`, `Commissions ${finished}/${board.list.length}`), bx + pad, by + pad + line * .5);
  ctx.font = `600 ${11.5 * u}px system-ui, sans-serif`;
  board.list.forEach((c, i) => {
    const y = by + pad + line * (i + 1.5), ok = commissionDone(done, board.day, c.n);
    const text = bilingual(c.title[0], c.title[1]) + (c.kind === 'hunt' && !ok ? ` ${huntProgress(done, board.day, c.n)}/${COMMISSION.hunt}` : '');
    ctx.fillStyle = ok ? CLEARED : '#e8ecf2'; ctx.fillText(`${ok ? '✓' : '◆'} ${text}`, bx + pad, y);
  });
}
