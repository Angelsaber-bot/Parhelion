/**
 * 幻日探索层运行时：宝箱、日晕之羽、日晕石像、棱镜折光谜题、时层挑战与战斗据点。
 * Owns its own scene graph, one merged collider, interact markers and a small HUD.
 */
import { RESONANCE, flagResonance, resonanceLevel, resonanceMaxHp, resonanceReady, nextResonanceCost } from '../story/resonance';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { WORLD_RIFLE } from '../core/worldBalance';
import { bilingual } from '../../../shared-client/i18n';
import { SiteArt } from '../story/campaignSites';
import type { Collider } from '../player/player';
import type { Marker } from '../core/types';
import type { RegionId, Localized } from '../settlements/types';
import type { StoryEncounterSpec } from '../story/storyEncounters';
import {
  CAMPS, CHESTS, CHEST_CRYSTALS, DOMAINS, CHEST_NAMES, FEATHERS, GLIDE, PUZZLES, REGION_NAMES, STATUES, TRIALS,
  ELITE_BOUNTY, campEncounterId, feathersHeld, feathersSpare, flagCamp, flagChest, flagElite, flagFeather, flagGlide, flagPuzzle, flagTrial,
  glideLevel, markerChest, markerPrism, markerStatue, markerStele, parseCampEncounter, regionExploration, solvePuzzle,
  totalCrystals, traceBeam, dirVec, type ChestDef, type PrismPuzzleDef, type TrialDef, type CampDef, type XZ,
} from './catalog';
import {
  Frame, beamGeometry, blockerPillar, campProps, chestBody, chestLid, crystalMaterial, featherMesh, FX, glint, haloStatue,
  lightPillar, orbMesh, prismHead, prismPedestal, receiverBase, receiverCrystal, sealDome, steppingStone, sunLens, sunSource,
  trialStele, waterPlatform, domainRuin, type V3, dynamicArt, messageBottle, bottleGlass, digMound, emberBrazier, emberBeacon, beaconFlame, emberCarry,
  foxShrine, hokora, foxWisp, duelRing, signalTerminal,
} from './models';
import {
  DUEL_RING, EMBER_ROUTES, FOXFIRES, TREASURE_MAPS, FOX_GRACE, FOX_LEASH, FOX_PAUSE, canDig, emberIdle, emberKindle, emberTake, emberTick, flagDig, flagEmber, flagFox, flagMap,
  foxAt, foxLength, mapHeld, markerBeacon, markerBottle, markerBrazier, markerDig, markerFoxShrine, type EmberRouteDef, type FoxfireDef, type TreasureMapDef,
  SIGNALS, flagSignal, markerCache, markerTerminal, signalBars, signalPing, type SignalDef,
} from './regional';
import { MINIBOSSES } from '../combat/minibosses';
import { camlannArena, flagshipDeckArena, honnojiArena, redSquareArena } from './bossArenas';
import { COMMISSION, commissionDone, dayKey, flagCommission, flagCommissionBonus, flagHuntKill, huntProgress, todaysBoard, type Commission } from './commissions';
import './exploration.css';

export interface ExplorationHost {
  done: Set<string>;
  save(): boolean;
  toast(text: string): void;
  /** terrain height (no props) */
  terrain(x: number, z: number): number;
  waterLevel: number;
  startEncounter(spec: StoryEncounterSpec): { ok: boolean; reason: string };
  activeEncounter(): string | null;
  cancelEncounter(): void;
  onGlideLevel(level: number): void;
  /** A Halo Resonance level was awakened (max health rises). */
  onResonance?(level: number): void;
  sound(kind: 'open' | 'pickup' | 'solve' | 'rotate' | 'fail'): void;
  /** loads rifle rounds; returns how many fit */
  refillAmmo?(rounds: number): number;
}
interface PlayerView { pos: THREE.Vector3; onGround: boolean; gliding: boolean; flying: boolean; swimming: boolean }

type Dyn = { obj: THREE.Object3D; p: THREE.Vector3; range: number };
const L = (t: Localized) => bilingual(t[0], t[1]);

export function createExploration(host: ExplorationHost) {
  const root = new THREE.Group(); root.name = 'SunwardExploration';
  const markers: Marker[] = [], ownership = new Map<string, () => void>(), labels = new Map<string, () => string>();
  const dynamic: Dyn[] = [], disposables: { dispose(): void }[] = [];
  const done = host.done;
  const arts = new Map<RegionId, SiteArt>();
  const artFor = (region: RegionId) => { let a = arts.get(region); if (!a) { a = new SiteArt(); arts.set(region, a); } return a; };
  /** Tops of structures we build, so items can stand on them. */
  const platforms: { x: number; z: number; r: number; top: number }[] = [];
  const surface = (x: number, z: number) => {
    let y = host.terrain(x, z);
    for (const p of platforms) if (Math.hypot(x - p.x, z - p.z) <= p.r && p.top > y) y = p.top;
    return y;
  };
  const dyn = (obj: THREE.Object3D, range = 140) => { root.add(obj); const d = { obj, p: obj.position.clone(), range }; dynamic.push(d); return d; };
  const markerRadius = new Map<string, number>();
  /** Markers live in layout.markers; a zero radius takes one out of interaction without rebuilding the list. */
  const enableMarker = (id: string, on: boolean) => { const m = markers.find(x => x.id === id); if (m) m.radius = on ? markerRadius.get(id) ?? 2.4 : 0; };
  const addMarker = (id: string, p: V3, label: string, radius = 2.4, action?: () => void, labelFn?: () => string) => {
    markers.push({ id, type: 'interact', label, p, radius }); markerRadius.set(id, radius);
    if (action) ownership.set(id, action);
    if (labelFn) labels.set(id, labelFn);
  };

  // ───────────────────────── HUD ─────────────────────────
  const hud = document.createElement('div'); hud.id = 'xp-hud'; hud.hidden = true;
  hud.innerHTML = '<div class="xp-region"></div><div class="xp-bar"><i></i></div><div class="xp-stats"></div><div class="xp-comm"><b></b><span></span></div>';
  const banner = document.createElement('div'); banner.id = 'xp-banner'; banner.hidden = true;
  const challenge = document.createElement('div'); challenge.id = 'xp-challenge'; challenge.hidden = true;
  document.body.append(hud, banner, challenge);
  let bannerTimer = 0;
  const showBanner = (title: string, sub = '', kind: 'region' | 'reward' | 'solve' | 'fail' = 'reward', seconds = 3.2) => {
    banner.className = `xp-${kind}`; banner.innerHTML = `<strong></strong><span></span>`;
    banner.querySelector('strong')!.textContent = title; banner.querySelector('span')!.textContent = sub;
    banner.hidden = false; bannerTimer = seconds;
  };

  // ───────────────────────── statues ─────────────────────────
  for (const s of STATUES) {
    const y = host.terrain(...s.p), f = new Frame(artFor(s.region), [s.p[0], y - .05, s.p[1]], s.yaw);
    haloStatue(f);
    const front = [s.p[0] + Math.sin(s.yaw) * 2.6, y + 1, s.p[1] + Math.cos(s.yaw) * 2.6] as V3;
    addMarker(markerStatue(s.id), front, L(s.title), 3, () => { if (!awakenResonance()) offerFeathers(s.title); }, () => {
      const lvl = glideLevel(done), spare = feathersSpare(done), rl = resonanceLevel(done), crystals = totalCrystals(done);
      if (resonanceReady(rl, crystals)) return bilingual(`日晕共鸣 Lv.${rl + 1} 可觉醒 · 生命上限 +${RESONANCE.hpPerLevel}`, `Awaken Halo Resonance Lv.${rl + 1} · Max HP +${RESONANCE.hpPerLevel}`);
      const cost = nextResonanceCost(rl), res = cost === null ? bilingual('共鸣已满', 'Resonance maxed') : bilingual(`共鸣 ${crystals}/${cost}`, `Resonance ${crystals}/${cost}`);
      return lvl >= GLIDE.maxLevel ? bilingual(`${s.title[0]} · 滑翔翼已满级 · ${res}`, `${s.title[1]} · Glider maxed · ${res}`)
        : bilingual(`供奉日晕之羽 ${Math.min(spare, GLIDE.feathersPerLevel)}/${GLIDE.feathersPerLevel} · 滑翔翼 Lv.${lvl} · ${res}`, `Offer Halo Feathers ${Math.min(spare, GLIDE.feathersPerLevel)}/${GLIDE.feathersPerLevel} · Glider Lv.${lvl} · ${res}`);
    });
  }
  /** Halo Resonance: crystals gathered across the world deepen it one level at a time, at any statue. */
  function awakenResonance() {
    const rl = resonanceLevel(done);
    if (!resonanceReady(rl, totalCrystals(done))) return false;
    done.add(flagResonance(rl + 1)); host.save(); host.onResonance?.(rl + 1); host.sound('solve');
    const next = nextResonanceCost(rl + 1);
    showBanner(bilingual(`日晕共鸣 Lv.${rl + 1} · 生命上限 ${resonanceMaxHp(rl + 1)}`, `Halo Resonance Lv.${rl + 1} · Max HP ${resonanceMaxHp(rl + 1)}`),
      next === null ? bilingual('共鸣已达到最深。', 'The resonance is as deep as it goes.') : bilingual(`下一级需要累计日晕晶 ${next}。`, `Next level at ${next} Halo Crystals gathered.`), 'solve');
    return true;
  }
  function offerFeathers(title: Localized) {
    const lvl = glideLevel(done), spare = feathersSpare(done);
    if (lvl >= GLIDE.maxLevel) { host.toast(bilingual('滑翔翼已经达到最高等级。', 'The glider is already at its highest level.')); return; }
    if (spare < GLIDE.feathersPerLevel) {
      host.toast(bilingual(`${title[0]}：还需要 ${GLIDE.feathersPerLevel - spare} 枚日晕之羽（已收集 ${feathersHeld(done)}）。`, `${title[1]}: ${GLIDE.feathersPerLevel - spare} more Halo Feathers needed (collected ${feathersHeld(done)}).`));
      return;
    }
    done.add(flagGlide(lvl + 1)); host.save(); host.onGlideLevel(lvl + 1); host.sound('solve');
    showBanner(bilingual(`滑翔翼强化 Lv.${lvl + 1}`, `Glider upgraded · Lv.${lvl + 1}`), bilingual('滑翔更快，下坠更慢。', 'Faster glide, slower descent.'), 'solve');
  }

  /** A roaming elite's first defeat pays once: crystals, a full resupply's worth of rounds, exploration credit. */
  function eliteDefeated(id: string) {
    const elite = MINIBOSSES.find(m => m.id === id);
    if (!elite || done.has(flagElite(id))) return false;
    done.add(flagElite(id)); host.save(); host.sound('open');
    const region = elite.region as RegionId, ex = regionExploration(region, done), rounds = host.refillAmmo?.(ELITE_BOUNTY.rounds) ?? 0, n = ELITE_BOUNTY.crystals;
    showBanner(bilingual(`精英讨伐 · ${elite.name[0]} · 日晕晶 ×${n}` + (rounds ? ` · 弹药 +${rounds}` : ''), `Elite bounty · ${elite.name[1]} · Halo Crystal ×${n}` + (rounds ? ` · Ammo +${rounds}` : '')), bilingual(`${REGION_NAMES[region]?.[0] ?? ''} 探索度 ${ex.percent}%`, `${REGION_NAMES[region]?.[1] ?? ''} explored ${ex.percent}%`));
    return true;
  }

  // ───────────────────────── 日晕委托 · daily commissions ─────────────────────────
  let board = todaysBoard(done);
  let boardCheck = 0;
  const openCommission = (kind: Commission['kind'], target: string) => board.list.find(c => c.kind === kind && c.target === target && !commissionDone(done, board.day, c.n)) ?? null;
  const commissionsLeft = () => board.list.filter(c => !commissionDone(done, board.day, c.n));
  function completeCommission(c: Commission) {
    if (commissionDone(done, board.day, c.n)) return;
    done.add(flagCommission(board.day, c.n));
    const rounds = host.refillAmmo?.(COMMISSION.rounds) ?? 0, left = commissionsLeft().length;
    let n = COMMISSION.crystals;
    if (!left && !done.has(flagCommissionBonus(board.day))) { done.add(flagCommissionBonus(board.day)); n += COMMISSION.bonus; }
    host.save(); host.sound('solve');
    showBanner(bilingual(`委托完成 · ${c.title[0]}`, `Commission complete · ${c.title[1]}`),
      bilingual(`日晕晶 ×${n}${rounds ? ` · 弹药 +${rounds}` : ''} · ${left ? `今日还剩 ${left} 件委托` : '今日委托全部完成，额外奖励已发放'}`,
        `Halo Crystal ×${n}${rounds ? ` · Ammo +${rounds}` : ''} · ${left ? `${left} left today` : "Today's board is clear: bonus paid"}`), 'solve', 4);
  }
  /** Wild kills count toward a hunt in the region the player is standing in. */
  function enemyDefeated(id: string) {
    if (!id.startsWith('wild_') || !lastRegion) return;
    const hunt = openCommission('hunt', lastRegion); if (!hunt) return;
    const k = huntProgress(done, board.day, hunt.n);
    done.add(flagHuntKill(board.day, hunt.n, k));
    if (k + 1 >= COMMISSION.hunt) completeCommission(hunt); else host.save();
  }

  // ───────────────────────── domains (秘境) ─────────────────────────
  const domainSeen = new Set<string>();
  for (const d of DOMAINS) {
    let y = host.terrain(...d.center);
    for (let a = 0; a < 16; a++) for (const r of [d.radius * .5, d.radius]) y = Math.max(y, host.terrain(d.center[0] + Math.cos(a / 8 * Math.PI) * r, d.center[1] + Math.sin(a / 8 * Math.PI) * r) - .15);
    domainRuin(new Frame(artFor(d.region), [d.center[0], y, d.center[1]]), d.radius, d.region);
    platforms.push({ x: d.center[0], z: d.center[1], r: d.radius, top: y + .28 });
  }

  // ───────────────────────── boss arenas ─────────────────────────
  camlannArena(artFor('britain'), (x, z) => host.terrain(x, z));
  redSquareArena(artFor('winter'), (x, z) => host.terrain(x, z));
  honnojiArena(artFor('kyoto'), (x, z) => host.terrain(x, z));
  flagshipDeckArena(artFor('blacksail'));

  // ───────────────────────── prism puzzles ─────────────────────────
  interface PuzzleRt { def: PrismPuzzleDef; orient: number[]; heads: THREE.Group[]; crystals: THREE.Mesh[]; shown: number[]; beam: THREE.Mesh; glow: THREE.Mesh; recv: THREE.Group; pillar: THREE.Mesh; heights: number[]; sourceY: number; recvY: number; solved: boolean }
  const puzzles = new Map<string, PuzzleRt>();
  for (const def of PUZZLES) {
    const art = artFor(def.region);
    // structures that raise things (towers, platforms) first so surface() sees them
    const heights: number[] = [];
    def.prisms.forEach((prism) => {
      const g = surface(...prism.p);
      if (g < host.waterLevel + .3) {
        const top = host.waterLevel + 1.0; waterPlatform(new Frame(art, [prism.p[0], 0, prism.p[1]]), top, g - .5);
        platforms.push({ x: prism.p[0], z: prism.p[1], r: 2.6, top });
        // stepping stones back to the nearest dry ground along -x/+x
        const toShore = [1, -1].map(sx => { for (let d = 3; d < 40; d += 1) if (host.terrain(prism.p[0] + sx * d, prism.p[1]) > host.waterLevel + .2) return { sx, d }; return { sx, d: 99 }; }).sort((a, b) => a.d - b.d)[0];
        for (let d = 4.4; d < toShore.d - 1; d += 4.2) {
          const sx = prism.p[0] + toShore.sx * d, sz = prism.p[1] + Math.sin(d) * .8, gb = host.terrain(sx, sz);
          steppingStone(new Frame(art, [sx, 0, sz]), host.waterLevel + .55, gb - .3); platforms.push({ x: sx, z: sz, r: 1.0, top: host.waterLevel + .55 });
        }
        heights.push(top);
      } else if (prism.raise) {
        platforms.push({ x: prism.p[0], z: prism.p[1], r: 2.5, top: g + prism.raise });
        heights.push(g + prism.raise);
      } else heights.push(g);
    });
    const sourceY = surface(...def.source.p), recvY = surface(...def.receiver);
    const srcFrame = new Frame(art, [def.source.p[0], sourceY, def.source.p[1]], -def.source.dir * Math.PI / 4);
    sunSource(srcFrame); sunLens(srcFrame);
    receiverBase(new Frame(art, [def.receiver[0], recvY, def.receiver[1]]));
    for (const bl of def.blockers) if (!DOMAINS.some(d => d.center[0] === bl.p[0] && d.center[1] === bl.p[1])) blockerPillar(new Frame(art, [bl.p[0], surface(...bl.p) - .2, bl.p[1]]), bl.r, bl.h);
    const heads: THREE.Group[] = [], crystals: THREE.Mesh[] = [];
    def.prisms.forEach((prism, i) => {
      const base = heights[i] - (prism.raise ? prism.raise : 0);
      prismPedestal(new Frame(art, [prism.p[0], prism.raise ? base : heights[i], prism.p[1]]), prism.raise ?? 0);
      const { group, art: headArt, crystal } = prismHead(); disposables.push({ dispose: () => disposeArt(headArt) });
      group.position.set(prism.p[0], heights[i] + .1, prism.p[1]);
      dyn(group, 160); heads.push(group); crystals.push(crystal);
      const id = markerPrism(def.id, i);
      addMarker(id, [prism.p[0], heights[i] + 1.1, prism.p[1]], bilingual('转动棱镜柱', 'Turn prism'), 2.6, () => rotatePrism(def.id, i), () =>
        puzzles.get(def.id)!.solved ? bilingual(`${def.title[0]} · 已解开`, `${def.title[1]} · Solved`) : bilingual(`转动棱镜柱 · ${def.title[0]}`, `Turn prism · ${def.title[1]}`));
    });
    const recv = receiverCrystal(); recv.position.set(def.receiver[0], recvY, def.receiver[1]); dyn(recv, 160);
    const pillar = lightPillar(); pillar.position.set(def.receiver[0], recvY + 15, def.receiver[1]); pillar.visible = false; dyn(pillar, 400);
    const beam = new THREE.Mesh(new THREE.BufferGeometry(), FX.beamCore), glow = new THREE.Mesh(new THREE.BufferGeometry(), FX.beamGlow);
    beam.frustumCulled = glow.frustumCulled = false; root.add(beam, glow);
    const solved = done.has(flagPuzzle(def.id));
    let orient = def.prisms.map(p => p.start);
    if (solved) orient = solvePuzzle(def)[0] ?? orient;
    const rt: PuzzleRt = { def, orient, heads, crystals, shown: orient.map(k => k * Math.PI / 4), beam, glow, recv, pillar, heights, sourceY, recvY, solved };
    heads.forEach((h, i) => { h.rotation.y = -rt.shown[i]; });
    puzzles.set(def.id, rt); refreshBeam(rt);
  }
  function headPoint(rt: PuzzleRt, kind: string, index: number, p: XZ): THREE.Vector3 {
    if (kind === 'source') return new THREE.Vector3(p[0], rt.sourceY + 3.25, p[1]);
    if (kind === 'prism') return new THREE.Vector3(p[0], rt.heights[index] + 1.6, p[1]);
    if (kind === 'receiver') return new THREE.Vector3(p[0], rt.recvY + 1.5, p[1]);
    const last = new THREE.Vector3(p[0], 0, p[1]);
    return last;
  }
  function refreshBeam(rt: PuzzleRt) {
    const trace = traceBeam(rt.def, rt.orient);
    const pts: THREE.Vector3[] = [];
    trace.nodes.forEach((n, i) => {
      const v = headPoint(rt, n.kind, n.index, n.p);
      if (n.kind === 'open' || n.kind === 'blocker') v.y = pts[i - 1]?.y ?? rt.sourceY + 3;
      pts.push(v);
    });
    // the source emits from its lens rather than from its sun disk
    if (pts.length > 1) { const [dx, dz] = dirVec(rt.def.source.dir); pts[0] = new THREE.Vector3(rt.def.source.p[0] + dx * .8, rt.sourceY + 1.6, rt.def.source.p[1] + dz * .8); }
    for (const m of [rt.beam, rt.glow]) m.geometry.dispose();
    rt.beam.geometry = beamGeometry(pts, .05) ?? new THREE.BufferGeometry();
    rt.glow.geometry = beamGeometry(pts, .17) ?? new THREE.BufferGeometry();
    rt.crystals.forEach((c, i) => { c.material = crystalMaterial(trace.lit.has(i)); });
    const solvedNow = trace.solved;
    rt.recv.children.forEach(c => { (c as THREE.Mesh).material = crystalMaterial(solvedNow); });
    rt.pillar.visible = solvedNow;
    return solvedNow;
  }
  function rotatePrism(puzzleId: string, index: number) {
    const rt = puzzles.get(puzzleId)!;
    if (rt.solved) { host.toast(bilingual(`「${rt.def.title[0]}」已经解开。`, `"${rt.def.title[1]}" is already solved.`)); return; }
    rt.orient[index] = (rt.orient[index] + 1) % 8; host.sound('rotate');
    if (refreshBeam(rt)) {
      rt.solved = true; done.add(flagPuzzle(rt.def.id)); host.save(); host.sound('solve');
      showBanner(bilingual(`谜题解开 · ${rt.def.title[0]}`, `Puzzle solved · ${rt.def.title[1]}`), bilingual('附近的宝箱解除了封印。', 'A nearby chest has been unsealed.'), 'solve');
    } else if (!hintShown.has(rt.def.id)) { hintShown.add(rt.def.id); host.toast(L(rt.def.hint)); }
  }
  const hintShown = new Set<string>();

  // Build all supporting platforms before placing rewards; otherwise lake and
  // tower chests spawn below the very structures meant to carry them.
  // ───────────────────────── chests ─────────────────────────
  interface ChestRt { def: ChestDef; holder: THREE.Group; rise: number; lid: THREE.Group; seal: THREE.Mesh | null; sparkle: THREE.Sprite; open: number; base: THREE.Vector3 }
  const chests = new Map<string, ChestRt>();
  for (const c of CHESTS) {
    const yaw = c.yaw ?? 0, y = c.y ?? surface(...c.p), scale = c.scale ?? 1;
    const holder = new THREE.Group(); holder.position.set(c.p[0], y, c.p[1]); holder.rotation.y = yaw;
    holder.scale.setScalar(scale);
    if (c.buried) { const body = dynamicArt(f => chestBody(f, c.tier)); holder.add(body.group); disposables.push({ dispose: () => disposeArt(body.art) }); }
    else chestBody(new Frame(artFor(c.region), [c.p[0], y, c.p[1]], yaw, scale), c.tier);
    const { group: lidGroup, art: lidArt } = chestLid(c.tier); disposables.push({ dispose: () => disposeArt(lidArt) });
    lidGroup.position.set(0, .07 + .48 + .03, -.32); holder.add(lidGroup);
    const sparkle = glint(c.tier === 'luxurious' ? '#ffe9a0' : c.tier === 'precious' ? '#ffd1a0' : '#fff6d8', .75); sparkle.position.set(0, 1.15, 0); holder.add(sparkle);
    let seal: THREE.Mesh | null = null;
    if (c.requires && !c.buried) { seal = sealDome(1.05); seal.position.set(0, 0, 0); holder.add(seal); disposables.push(seal.geometry); }
    dyn(holder, 90);
    const rt: ChestRt = { def: c, holder, lid: lidGroup, seal, sparkle, open: done.has(flagChest(c.id)) ? 1 : 0, base: holder.position.clone(), rise: c.buried && !done.has(c.requires!) ? 0 : 1 };
    chests.set(c.id, rt);
    addMarker(markerChest(c.id), [c.p[0] + Math.sin(yaw) * .9*scale, y + .9*scale, c.p[1] + Math.cos(yaw) * .9*scale], L(CHEST_NAMES[c.tier]), 2.2, () => openChest(rt), () =>
      done.has(flagChest(c.id)) ? bilingual('空宝箱', 'Empty chest')
        : c.requires && !done.has(c.requires) ? bilingual(`封印的${CHEST_NAMES[c.tier][0]}`, `Sealed ${CHEST_NAMES[c.tier][1]}`)
          : bilingual(`开启 ${CHEST_NAMES[c.tier][0]}`, `Open ${CHEST_NAMES[c.tier][1]}`));
  }
  function requirementText(flag: string): string {
    const p = PUZZLES.find(x => flagPuzzle(x.id) === flag); if (p) return bilingual(`解开附近的「${p.title[0]}」谜题`, `solve the nearby "${p.title[1]}" puzzle`);
    const t = TRIALS.find(x => flagTrial(x.id) === flag); if (t) return bilingual(`完成「${t.title[0]}」挑战`, `complete the "${t.title[1]}" challenge`);
    const c = CAMPS.find(x => flagCamp(x.id) === flag); if (c) return bilingual(`击败「${c.title[0]}」的全部敌人`, `defeat every enemy at "${c.title[1]}"`);
    const m = TREASURE_MAPS.find(x => flagDig(x.id) === flag); if (m) return bilingual(`按「${m.title[0]}」挖出宝藏`, `dig up the treasure from "${m.title[1]}"`);
    const e = EMBER_ROUTES.find(x => flagEmber(x.id) === flag); if (e) return bilingual(`点亮「${e.title[0]}」的全部烽火`, `light every beacon of "${e.title[1]}"`);
    const sg = SIGNALS.find(x => flagSignal(x.id) === flag); if (sg) return bilingual(`用扫描仪找到「${sg.title[0]}」的讯号匣`, `track down the "${sg.title[1]}" signal cache`);
    const el = MINIBOSSES.find(x => flagElite(x.id) === flag); if (el) return bilingual(`讨伐精英「${el.name[0]}」`, `defeat the elite "${el.name[1]}"`);
    const fx = FOXFIRES.find(x => flagFox(x.id) === flag); if (fx) return bilingual(`跟随「${fx.title[0]}」走到终点`, `follow "${fx.title[1]}" to its end`);
    return flag;
  }
  function openChest(rt: ChestRt) {
    const c = rt.def;
    if (done.has(flagChest(c.id))) return;
    if (c.requires && !done.has(c.requires)) { host.toast(bilingual(`宝箱被封印了：需要先${requirementText(c.requires)}。`, `The chest is sealed: first ${requirementText(c.requires)}.`)); return; }
    done.add(flagChest(c.id)); host.save(); host.sound('open');
    const n = CHEST_CRYSTALS[c.tier], ex = regionExploration(c.region, done), rounds = host.refillAmmo?.(WORLD_RIFLE.ammoChest) ?? 0;
    showBanner(bilingual(`获得 日晕晶 ×${n}` + (rounds ? ` · 弹药 +${rounds}` : ''), `Halo Crystal ×${n}` + (rounds ? ` · Ammo +${rounds}` : '')), bilingual(`${CHEST_NAMES[c.tier][0]} · ${REGION_NAMES[c.region]?.[0] ?? ''} 探索度 ${ex.percent}%`, `${CHEST_NAMES[c.tier][1]} · ${REGION_NAMES[c.region]?.[1] ?? ''} explored ${ex.percent}%`));
  }

  // ───────────────────────── feathers ─────────────────────────
  interface FeatherRt { id: string; obj: THREE.Group; p: THREE.Vector3; region: RegionId }
  const feathers: FeatherRt[] = [];
  for (const x of FEATHERS) {
    const obj = featherMesh(); const y = x.y ?? surface(...x.p) + 1.5 + (x.lift ?? 0);
    obj.position.set(x.p[0], y, x.p[1]); obj.visible = !done.has(flagFeather(x.id));
    dyn(obj, 260);
    feathers.push({ id: x.id, obj, p: obj.position.clone(), region: x.region });
  }

  // ───────────────────────── trials ─────────────────────────
  interface TrialRt { def: TrialDef; orbs: THREE.Group[]; got: boolean[]; time: number; active: boolean }
  const trials = new Map<string, TrialRt>();
  let activeTrial: TrialRt | null = null;
  for (const def of TRIALS) {
    const y = host.terrain(...def.stele);
    // face the first orb
    const yaw = Math.atan2(def.orbs[0].p[0] - def.stele[0], def.orbs[0].p[1] - def.stele[1]);
    trialStele(new Frame(artFor(def.region), [def.stele[0], y - .05, def.stele[1]], yaw));
    const orbs = def.orbs.map(o => { const g = orbMesh(); g.position.set(o.p[0], o.y ?? host.terrain(...o.p) + 1.3, o.p[1]); g.visible = false; root.add(g); return g; });
    const rt: TrialRt = { def, orbs, got: orbs.map(() => false), time: 0, active: false };
    trials.set(def.id, rt);
    addMarker(markerStele(def.id), [def.stele[0] + Math.sin(yaw) * 1.4, y + 1, def.stele[1] + Math.cos(yaw) * 1.4], L(def.title), 2.6, () => startTrial(rt), () =>
      rt.active ? bilingual('挑战进行中', 'Challenge in progress') : done.has(flagTrial(def.id)) ? bilingual(`再次挑战 · ${def.title[0]}`, `Retry · ${def.title[1]}`) : bilingual(`开始挑战 · ${def.title[0]}`, `Start challenge · ${def.title[1]}`));
  }
  function startTrial(rt: TrialRt) {
    if (activeTrial || activeCamp || ember.route || fox) { host.toast(bilingual('先完成当前挑战。', 'Finish the current challenge first.')); return; }
    rt.active = true; rt.time = rt.def.seconds; rt.got = rt.got.map(() => false); rt.orbs.forEach(o => { o.visible = true; });
    activeTrial = rt; host.sound('rotate');
    showBanner(bilingual(`时层挑战 · ${rt.def.title[0]}`, `Time Echo · ${rt.def.title[1]}`), L(rt.def.hint), 'region', 3.5);
  }
  function endTrial(rt: TrialRt, success: boolean) {
    rt.active = false; activeTrial = null; rt.orbs.forEach(o => { o.visible = false; });
    if (success) {
      const first = !done.has(flagTrial(rt.def.id)); done.add(flagTrial(rt.def.id)); host.save(); host.sound('solve');
      const echo = openCommission('trial', rt.def.id);
      if (echo) { completeCommission(echo); return; }
      showBanner(bilingual(`挑战成功 · ${rt.def.title[0]}`, `Challenge complete · ${rt.def.title[1]}`), first ? bilingual('奖励宝箱解除了封印。', 'The reward chest has been unsealed.') : bilingual(`剩余 ${(rt.time).toFixed(1)} 秒`, `${rt.time.toFixed(1)} s to spare`), 'solve');
    } else { host.sound('fail'); showBanner(bilingual('挑战失败', 'Challenge failed'), bilingual('回到石碑可以再试一次。', 'Return to the stele to try again.'), 'fail'); }
  }

  // ───────────────────────── camps ─────────────────────────
  interface CampRt { def: CampDef; wave: number; running: boolean; pending: number; y: number; flag: THREE.Group }
  const camps = new Map<string, CampRt>();
  let activeCamp: CampRt | null = null;
  const vanguardHailed = new Set<string>();
  let busyHintAt = -1e9;
  CAMPS.forEach((def, i) => {
    const y = surface(...def.anchor);
    if (def.style === 'duel') {
      duelRing(new Frame(artFor(def.region), [def.anchor[0], y, def.anchor[1]]), DUEL_RING, i);
      addMarker(`xpm_${def.id}`, [def.anchor[0], y + 1.1, def.anchor[1] + DUEL_RING + .2], L(def.title), 2.8, () => challengeDuel(def.id), () =>
        done.has(flagCamp(def.id)) ? bilingual(`再次决斗 · ${def.title[0]}`, `Duel again · ${def.title[1]}`)
          : def.requires && !done.has(def.requires) ? bilingual(`${def.title[0]} · 先战胜上一位骑士`, `${def.title[1]} · defeat the previous knight first`)
            : bilingual(`接受决斗 · ${def.title[0]}`, `Accept the duel · ${def.title[1]}`));
    } else if (def.style !== 'domain' && def.style !== 'vanguard') campProps(new Frame(artFor(def.region), [def.anchor[0], y, def.anchor[1]], i * .7), i, def.region);
    const flag = new THREE.Group(); const fl = glint('#ff5a5a', 2.4); fl.position.y = 7; flag.add(fl); flag.position.set(def.anchor[0], y, def.anchor[1]); flag.visible = !done.has(flagCamp(def.id)); dyn(flag, 220);
    camps.set(def.id, { def, wave: 0, running: false, pending: 0, y, flag });
  });
  function startWave(rt: CampRt) {
    const def = rt.def, id = campEncounterId(def.id, rt.wave);
    const result = host.startEncounter({ id, anchor: { x: def.anchor[0], y: rt.y, z: def.anchor[1] }, actors: def.waves[rt.wave].map(a => ({ role: a.role, offset: a.offset, title: a.title, ...(a.pattern ? { pattern: a.pattern } : {}) })) });
    if (!result.ok && result.reason === 'busy' && performance.now() - busyHintAt > 6000) {
      busyHintAt = performance.now();
      host.toast(bilingual('附近还有敌人在交战，先击退它们，据点才会迎战。', 'Enemies nearby are still fighting; drive them off before the outpost engages.'));
    }
    if (result.ok) {
      rt.running = true; activeCamp = rt;
      if (def.lines && rt.wave === 0) host.toast(L(def.lines.start));
      showBanner(def.style === 'duel' ? bilingual(`决斗 · ${def.title[0]}`, `Duel · ${def.title[1]}`) : def.style === 'domain' ? bilingual(`秘境 · ${def.title[0]}`, `Domain · ${def.title[1]}`) : def.style === 'vanguard' ? bilingual(`主线 · ${def.title[0]}`, `Main story · ${def.title[1]}`) : bilingual(`据点 · ${def.title[0]}`, `Outpost · ${def.title[1]}`), bilingual(`第 ${rt.wave + 1} / ${def.waves.length} 波 · 击败全部敌人`, `Wave ${rt.wave + 1} / ${def.waves.length} · Defeat every enemy`), 'region', 2.6);
    }
    return result.ok;
  }
  function challengeDuel(id: string) {
    const rt = camps.get(id)!;
    if (rt.running || rt.pending > 0) return;
    if (rt.def.requires && !done.has(rt.def.requires)) { host.toast(bilingual('这道残影只回应战胜过上一位骑士的人。', 'This echo answers only those who bested the previous knight.')); return; }
    if (activeCamp || activeTrial || ember.route || fox || host.activeEncounter()) { host.toast(bilingual('先完成当前挑战。', 'Finish the current challenge first.')); return; }
    rt.wave = 0;
    if (startWave(rt)) host.toast(bilingual('决斗规则：一对一，离开决斗圈即判负。', 'Duel rules: one on one; leaving the ring forfeits.'));
    else if (performance.now() - busyHintAt > 6000) host.toast(bilingual('站稳脚跟、身边没有别的敌人时才能开始决斗。', 'Stand firm with no other enemies around to begin the duel.'));
  }
  function victory(encounterId: string): boolean {
    const parsed = parseCampEncounter(encounterId); if (!parsed) return false;
    const rt = camps.get(parsed.camp); if (!rt) return true;
    rt.running = false;
    if (rt.wave + 1 < rt.def.waves.length) { rt.wave++; rt.pending = 1.6; host.toast(bilingual('下一波敌人来了！', 'The next wave is coming!')); return true; }
    activeCamp = null; rt.wave = 0;
    const first = !done.has(flagCamp(rt.def.id)); done.add(flagCamp(rt.def.id)); host.save(); host.sound('solve'); rt.flag.visible = false;
    const regroup = openCommission('camp', rt.def.id);
    if (regroup) { completeCommission(regroup); if (first) host.toast(bilingual('据点的宝箱解除了封印。', "The outpost's chest has been unsealed.")); return true; }
    if (rt.def.lines) { showBanner(bilingual(`主线战斗胜利 · ${rt.def.title[0]}`, `Story fight won · ${rt.def.title[1]}`), L(rt.def.lines.end), 'solve', 5.5); return true; }
    showBanner(rt.def.style === 'duel' ? bilingual(`决斗胜利 · ${rt.def.title[0]}`, `Duel won · ${rt.def.title[1]}`) : rt.def.style === 'domain' ? bilingual(`秘境净化 · ${rt.def.title[0]}`, `Domain purified · ${rt.def.title[1]}`) : bilingual(`据点肃清 · ${rt.def.title[0]}`, `Outpost cleared · ${rt.def.title[1]}`), first ? bilingual('宝箱的封印消失了。', 'The chest seal has faded.') : '', 'solve');
    return true;
  }


  // ───────────────────────── 黑帆尽头 · treasure maps ─────────────────────────
  const parchment = document.createElement('div'); parchment.id = 'xp-map'; parchment.hidden = true;
  parchment.innerHTML = '<canvas width="240" height="240"></canvas><b></b><p></p>';
  document.body.append(parchment);
  let parchmentFor = '';
  /** Deterministic offset so the X is never simply in the middle of the sketch. */
  const sketchOffset = (id: string): [number, number] => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const a = (h % 360) * Math.PI / 180; return [Math.cos(a) * 22, Math.sin(a) * 22]; };
  function drawParchment(def: TreasureMapDef) {
    const canvas = parchment.querySelector('canvas')!, g = canvas.getContext('2d'); if (!g) return;
    const W = canvas.width, R = 80, [ox, oz] = sketchOffset(def.id), cx = def.dig[0] + ox, cz = def.dig[1] + oz;
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#e8d6a8'; g.fillRect(0, 0, W, W);
    contourSketch(g, W, cx, cz, R, (x, z) => host.terrain(x, z), host.waterLevel);
    // camps and statues the sketcher would have drawn as landmarks
    g.fillStyle = 'rgba(60,35,15,.8)'; g.font = '700 13px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const c of CAMPS) { const sx = W / 2 + (c.anchor[0] - cx) / R * W / 2, sz = W / 2 + (c.anchor[1] - cz) / R * W / 2; if (sx > 14 && sz > 14 && sx < W - 14 && sz < W - 14) g.fillText('⚔', sx, sz); }
    for (const st of STATUES) { const sx = W / 2 + (st.p[0] - cx) / R * W / 2, sz = W / 2 + (st.p[1] - cz) / R * W / 2; if (sx > 14 && sz > 14 && sx < W - 14 && sz < W - 14) g.fillText('☼', sx, sz); }
    // ink wash, burnt edges and a compass rose
    const edge = g.createRadialGradient(W / 2, W / 2, W * .3, W / 2, W / 2, W * .72); edge.addColorStop(0, 'rgba(120,80,30,0)'); edge.addColorStop(1, 'rgba(70,40,10,.85)');
    g.fillStyle = edge; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(60,35,15,.75)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(26, 46); g.lineTo(26, 14); g.moveTo(20, 22); g.lineTo(26, 12); g.lineTo(32, 22); g.stroke();
    g.fillStyle = 'rgba(60,35,15,.85)'; g.font = '700 11px serif'; g.textAlign = 'center'; g.fillText('N', 26, 58);
    const px = W / 2 + (def.dig[0] - cx) / R * W / 2, pz = W / 2 + (def.dig[1] - cz) / R * W / 2;
    g.strokeStyle = '#9b1c1c'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(px - 9, pz - 9); g.lineTo(px + 9, pz + 9); g.moveTo(px + 9, pz - 9); g.lineTo(px - 9, pz + 9); g.stroke();
    g.setLineDash([3, 5]); g.lineWidth = 1.6; g.strokeStyle = 'rgba(155,28,28,.7)'; g.beginPath(); g.moveTo(W * .12, W * .9); g.quadraticCurveTo(W * .3, pz + 30, px - 12, pz + 8); g.stroke(); g.setLineDash([]);
    parchment.querySelector('b')!.textContent = L(def.title); parchment.querySelector('p')!.textContent = L(def.clue);
  }
  function refreshParchment() {
    const held = TREASURE_MAPS.find(m => mapHeld(m, done));
    const key = held ? `${held.id}|${document.documentElement.lang}` : '';
    if (key === parchmentFor) return; parchmentFor = key;
    if (held) drawParchment(held);
  }
  interface BottleRt { def: TreasureMapDef; obj: THREE.Group }
  const bottles: BottleRt[] = [];
  for (const def of TREASURE_MAPS) {
    const art = artFor(def.region);
    if (def.bottle) {
      const y = surface(...def.bottle); messageBottle(new Frame(art, [def.bottle[0], y, def.bottle[1]], .6));
      const obj = bottleGlass(); obj.position.set(def.bottle[0] + .3, y + .25, def.bottle[1] + .5); dyn(obj, 120); bottles.push({ def, obj });
      addMarker(markerBottle(def.id), [def.bottle[0], y + .8, def.bottle[1]], bilingual('漂流瓶', 'Message bottle'), 2.6, () => {
        if (done.has(flagMap(def.id))) return;
        done.add(flagMap(def.id)); host.save(); host.sound('pickup'); refreshParchment();
        showBanner(bilingual(`获得 ${def.title[0]}`, `Found: ${def.title[1]}`), bilingual('对照地形找到 X，挖出宝藏。图会一直显示在右侧。', 'Match the sketch to the land, find the X and dig. The map stays on the right.'), 'reward', 4.5);
      }, () => bilingual('打开漂流瓶', 'Open the message bottle'));
    }
    const dy = surface(...def.dig); digMound(new Frame(art, [def.dig[0], dy, def.dig[1]], 1.1));
    addMarker(markerDig(def.id), [def.dig[0], dy + .6, def.dig[1]], bilingual('松软的沙土', 'Loose sand'), 2.8, () => {
      if (done.has(flagDig(def.id))) return;
      if (!canDig(def, done)) { host.toast(bilingual('沙土被翻动过……可没有藏宝图，挖哪儿都是瞎碰运气。', 'The sand was turned over… but without a map you would be digging blind.')); return; }
      done.add(flagDig(def.id)); host.save(); host.sound('open');
      const next = TREASURE_MAPS.find(m => m.after === def.id); refreshParchment();
      showBanner(bilingual('挖到了宝箱！', 'Treasure unearthed!'), next ? bilingual(`箱盖上钉着另一张图：「${next.title[0]}」。`, `Another chart is nailed to the lid: "${next.title[1]}".`)
        : bilingual('最后一张图拼完整了。沉没金库的封印松动了。', 'The last chart is complete. The Sunken Vault seal has loosened.'), 'solve', 4.5);
    }, () => canDig(def, done) ? bilingual('挖掘', 'Dig') : bilingual('松软的沙土', 'Loose sand'));
  }

  // ───────────────────────── 永冬之城 · ember relay ─────────────────────────
  interface EmberRt { def: EmberRouteDef; flames: THREE.Group[]; lit: boolean[]; next: THREE.Mesh }
  const embers = new Map<string, EmberRt>();
  let ember = emberIdle();
  const carry = emberCarry(); carry.visible = false; root.add(carry);
  for (const def of EMBER_ROUTES) {
    const art = artFor(def.region), by = surface(...def.brazier);
    emberBrazier(new Frame(art, [def.brazier[0], by, def.brazier[1]]));
    const fire = beaconFlame(); fire.position.set(def.brazier[0], by + .15, def.brazier[1]); fire.scale.setScalar(1.3); dyn(fire, 220);
    const solved = done.has(flagEmber(def.id));
    const flames = def.beacons.map(p => { const y = surface(...p); emberBeacon(new Frame(art, [p[0], y, p[1]])); const f = beaconFlame(); f.position.set(p[0], y + 3.05, p[1]); f.visible = solved; f.userData.hidden = !solved; dyn(f, 260); return f; });
    const next = lightPillar(); next.scale.set(.35, 18, .35); next.visible = false; next.userData.hidden = true; root.add(next);
    const rt: EmberRt = { def, flames, lit: def.beacons.map(() => solved), next };
    embers.set(def.id, rt);
    addMarker(markerBrazier(def.id), [def.brazier[0], by + 1, def.brazier[1]], bilingual('取火种', 'Take an ember'), 3, () => takeEmber(rt), () =>
      done.has(flagEmber(def.id)) ? bilingual(`${def.title[0]} · 已全部点亮`, `${def.title[1]} · All lit`) : ember.route === def.id ? bilingual('火种在手', 'Ember in hand') : bilingual(`取火种 · ${def.title[0]}`, `Take an ember · ${def.title[1]}`));
    def.beacons.forEach((p, i) => addMarker(markerBeacon(def.id, i), [p[0], surface(...p) + 1.2, p[1]], bilingual('烽火台', 'Beacon'), 3, () => kindle(rt, i), () =>
      rt.lit[i] ? bilingual('烽火正在燃烧', 'The beacon is burning') : ember.route === def.id && ember.leg === i ? bilingual('点燃烽火', 'Kindle the beacon') : bilingual('冰冷的烽火台', 'A frozen beacon')));
  }
  function showNextBeacon(rt: EmberRt | null) {
    for (const r of embers.values()) { r.next.visible = false; r.next.userData.hidden = true; }
    if (!rt || !ember.route) return;
    const p = rt.def.beacons[ember.leg], y = surface(...p);
    rt.next.position.set(p[0], y + 3 + 18 * .5, p[1]); rt.next.userData.hidden = false; rt.next.visible = true;
  }
  function takeEmber(rt: EmberRt) {
    if (done.has(flagEmber(rt.def.id))) { host.toast(bilingual('这条路上的烽火都已经点亮了。', 'Every beacon on this road is already lit.')); return; }
    if (activeTrial || activeCamp || fox) { host.toast(bilingual('先完成当前挑战。', 'Finish the current challenge first.')); return; }
    rt.lit = rt.lit.map(() => false); rt.flames.forEach(f => { f.userData.hidden = true; f.visible = false; });
    ember = emberTake(rt.def); host.sound('rotate'); showNextBeacon(rt);
    showBanner(bilingual(`火种 · ${rt.def.title[0]}`, `Ember · ${rt.def.title[1]}`), L(rt.def.hint), 'region', 3.6);
  }
  function kindle(rt: EmberRt, i: number) {
    if (rt.lit[i]) return;
    const r = emberKindle(rt.def, ember, i);
    if (!r.ok) { host.toast(r.reason === 'wrong-beacon' ? bilingual('火种不够撑到那里——按顺序点燃最近的烽火。', 'The ember will not last that far: kindle the beacons in order.') : bilingual('烽火台被冻住了。先到篝火那里取火种。', 'The beacon is frozen. Fetch an ember from the campfire first.')); return; }
    rt.lit[i] = true; rt.flames[i].userData.hidden = false; host.sound('pickup');
    ember = r.state;
    if (r.finished) {
      done.add(flagEmber(rt.def.id)); host.save(); host.sound('solve'); showNextBeacon(null);
      showBanner(bilingual(`烽火相连 · ${rt.def.title[0]}`, `Beacons joined · ${rt.def.title[1]}`), bilingual('冰封解除了，附近的宝箱露了出来。', 'The ice gives way; a nearby chest is revealed.'), 'solve');
    } else showNextBeacon(rt);
  }
  function failEmber() {
    const rt = ember.route ? embers.get(ember.route) : null; ember = emberIdle(); showNextBeacon(null);
    if (rt && !done.has(flagEmber(rt.def.id))) { rt.lit = rt.lit.map(() => false); rt.flames.forEach(f => { f.userData.hidden = true; f.visible = false; }); }
    host.sound('fail'); showBanner(bilingual('火种熄灭了', 'The ember died'), bilingual('烽火也随之冷却。回到篝火重新取火。', 'The beacons cool with it. Return to the campfire for another.'), 'fail');
  }

  // ───────────────────────── 业火京都 · fox-fire ─────────────────────────
  interface FoxRt { def: FoxfireDef; wisp: THREE.Group; length: number }
  const foxes = new Map<string, FoxRt>();
  let fox: { rt: FoxRt; s: number; pause: number; lost: number; lastSeg: number } | null = null;
  for (const def of FOXFIRES) {
    const art = artFor(def.region), sy = surface(...def.shrine);
    const a = def.path[1], yaw = Math.atan2(a[0] - def.shrine[0], a[1] - def.shrine[1]) + Math.PI;
    foxShrine(new Frame(art, [def.shrine[0] - Math.sin(yaw) * 2.5, sy, def.shrine[1] - Math.cos(yaw) * 2.5], yaw));
    const end = def.path[def.path.length - 1];
    if (def.id === 'bamboo_shrine') hokora(new Frame(art, [end[0] - 2.5, surface(...end), end[1] - 2], .4));
    const wisp = foxWisp(); wisp.visible = false; wisp.userData.hidden = true; dyn(wisp, 320);
    const rt: FoxRt = { def, wisp, length: foxLength(def) }; foxes.set(def.id, rt);
    addMarker(markerFoxShrine(def.id), [def.shrine[0], sy + 1, def.shrine[1]], L(def.title), 3, () => startFox(rt), () =>
      fox?.rt === rt ? bilingual('狐火正在引路', 'The fox-fire is leading') : done.has(flagFox(def.id)) ? bilingual(`再跟一次 · ${def.title[0]}`, `Follow again · ${def.title[1]}`) : bilingual(`唤出狐火 · ${def.title[0]}`, `Call the fox-fire · ${def.title[1]}`));
  }
  function startFox(rt: FoxRt) {
    if (fox) return;
    if (activeTrial || activeCamp || ember.route) { host.toast(bilingual('先完成当前挑战。', 'Finish the current challenge first.')); return; }
    fox = { rt, s: 0, pause: 1.6, lost: 0, lastSeg: 0 }; rt.wisp.userData.hidden = false; host.sound('rotate');
    showBanner(bilingual(`狐火 · ${rt.def.title[0]}`, `Fox-fire · ${rt.def.title[1]}`), L(rt.def.hint), 'region', 3.6);
  }
  function endFox(success: boolean) {
    if (!fox) return; const rt = fox.rt; fox = null; rt.wisp.userData.hidden = true; rt.wisp.visible = false;
    if (success) {
      const first = !done.has(flagFox(rt.def.id)); done.add(flagFox(rt.def.id)); host.save(); host.sound('solve');
      showBanner(bilingual(`狐火归巢 · ${rt.def.title[0]}`, `The fox-fire rests · ${rt.def.title[1]}`), first ? bilingual('它停下的地方，封印消失了。', 'Where it stopped, the seal is gone.') : '', 'solve');
    } else { host.sound('fail'); showBanner(bilingual('狐火消散了', 'The fox-fire faded'), bilingual('跟得太远了。回到狐神社再唤它一次。', 'You fell too far behind. Call it again at the fox shrine.'), 'fail'); }
  }
  // ───────────────────────── 幻日谷 · lost signals ─────────────────────────
  const signalHud = document.createElement('div'); signalHud.id = 'xp-signal'; signalHud.hidden = true; document.body.append(signalHud);
  let scan: { def: SignalDef; ping: number; bars: number } | null = null;
  for (const def of SIGNALS) {
    const art = artFor(def.region), ty = surface(...def.terminal);
    const yaw = Math.atan2(def.cache[0] - def.terminal[0], def.cache[1] - def.terminal[1]);
    signalTerminal(new Frame(art, [def.terminal[0], ty, def.terminal[1]], yaw + Math.PI));
    addMarker(markerTerminal(def.id), [def.terminal[0], ty + 1.1, def.terminal[1]], L(def.title), 2.6, () => {
      if (done.has(flagSignal(def.id))) { host.toast(bilingual('这台中继已经安静了。', 'This relay has gone quiet.')); return; }
      scan = { def, ping: 0, bars: 0 }; host.sound('rotate');
      showBanner(bilingual(`扫描仪已调到「${def.title[0]}」`, `Scanner tuned to "${def.title[1]}"`), L(def.clue) + bilingual(' 信号格越满越近，满格时就在脚下。', ' More bars means closer; full bars means it is right under you.'), 'region', 5);
    }, () => scan?.def === def ? bilingual('正在追踪这个讯号', 'Tracking this signal') : done.has(flagSignal(def.id)) ? bilingual(`已找回 · ${def.title[0]}`, `Recovered · ${def.title[1]}`) : bilingual(`调谐中继 · ${def.title[0]}`, `Tune the relay · ${def.title[1]}`));
    const cy = surface(...def.cache);
    addMarker(markerCache(def.id), [def.cache[0], cy + .6, def.cache[1]], bilingual('讯号源', 'Signal source'), 2.6, () => {
      if (done.has(flagSignal(def.id)) || scan?.def !== def) return;
      done.add(flagSignal(def.id)); host.save(); host.sound('open'); scan = null; signalHud.hidden = true;
      showBanner(bilingual(`找回讯号匣 · ${def.title[0]}`, `Signal cache recovered · ${def.title[1]}`), bilingual('匣子从土里升了起来。', 'The case rises out of the ground.'), 'solve', 4);
    }, () => bilingual('挖出讯号匣', 'Dig out the signal cache'));
  }
  function signalUpdate(dt: number, pp: THREE.Vector3, active: boolean) {
    for (const def of SIGNALS) enableMarker(markerCache(def.id), scan?.def === def);
    if (!scan || !active) { signalHud.hidden = true; return; }
    const d = Math.hypot(pp.x - scan.def.cache[0], pp.z - scan.def.cache[1]), bars = signalBars(d);
    if (bars !== scan.bars || signalHud.hidden) {
      scan.bars = bars; signalHud.hidden = false; signalHud.dataset.bars = String(bars);
      signalHud.innerHTML = `<b>${L(scan.def.title)}</b><span class="bars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= bars ? 'on' : ''}" style="height:${4 + i * 3}px"></i>`).join('')}</span><em>${bars === 0 ? bilingual('无信号', 'No signal') : bars === 5 ? bilingual('就在脚下！', 'Right here!') : bilingual('信号', 'Signal')}</em>`;
    }
    const every = signalPing(bars);
    if (every > 0) { scan.ping -= dt; if (scan.ping <= 0) { scan.ping = every; signalHud.classList.remove('ping'); void signalHud.offsetWidth; signalHud.classList.add('ping'); if (bars >= 3) host.sound('pickup'); } }
  }
  function regionalUpdate(dt: number, player: PlayerView, active: boolean) {
    const pp = player.pos;
    for (const b of bottles) { const got = done.has(flagMap(b.def.id)); b.obj.userData.hidden = got; enableMarker(markerBottle(b.def.id), !got); if (!got) b.obj.rotation.y += dt * .6; }
    for (const def of TREASURE_MAPS) enableMarker(markerDig(def.id), !done.has(flagDig(def.id)));
    signalUpdate(dt, pp, active);
    refreshParchment(); parchment.hidden = !active || !parchmentFor;
    // ember
    if (ember.route) {
      if (active) { const t = emberTick(ember, dt); ember = t.state; if (t.expired) failEmber(); }
      carry.visible = !!ember.route; carry.position.set(pp.x, pp.y + 1.35 + Math.sin(time * 6) * .04, pp.z);
      if (ember.route) {
        const rt = embers.get(ember.route)!;
        challenge.hidden = false;
        challenge.innerHTML = `<b>${L(rt.def.title)}</b><span>${bilingual('烽火', 'Beacon')} ${ember.leg} / ${rt.def.beacons.length}</span><em class="${ember.time < 4 ? 'low' : ''}">${Math.max(0, ember.time).toFixed(1)}s</em>`;
      }
    } else carry.visible = false;
    for (const rt of embers.values()) for (const f of rt.flames) if (!f.userData.hidden) { const fl = f.getObjectByName('Flame'); if (fl) fl.scale.y = 1.2 + Math.sin(time * 9 + f.position.x) * .15; }
    // fox
    if (fox) {
      const f = fox, def = f.rt.def;
      const here = foxAt(def, f.s), dist = Math.hypot(pp.x - here.x, pp.z - here.z);
      if (active) {
        if (f.pause > 0) f.pause -= dt;
        else {
          // the fox keeps a steady pace; it slows a little when you are close behind so it reads as leading, never waiting
          f.s += def.speed * (dist < 4 ? .85 : 1) * dt;
          const seg = foxAt(def, f.s).segment; if (seg !== f.lastSeg) { f.lastSeg = seg; if (seg % 4 === 0) f.pause = FOX_PAUSE; }
        }
        f.lost = dist > FOX_LEASH ? f.lost + dt : 0;
      }
      const at = foxAt(def, f.s), ahead = foxAt(def, f.s + 1.5);
      f.rt.wisp.position.set(at.x, surface(at.x, at.z) + 2.0 + Math.sin(time * 4) * .25, at.z);
      f.rt.wisp.rotation.y = Math.atan2(ahead.x - at.x, ahead.z - at.z);
      const tail = f.rt.wisp.getObjectByName('Tail'); if (tail) tail.scale.y = .9 + Math.sin(time * 12) * .2;
      challenge.hidden = false;
      challenge.innerHTML = `<b>${L(def.title)}</b><span>${bilingual('跟紧狐火', 'Keep up')} · ${Math.round(Math.min(100, f.s / f.rt.length * 100))}%</span><em class="${dist > FOX_LEASH * .7 ? 'low' : ''}">${Math.round(dist)} m</em>`;
      if (at.end && dist < 6) endFox(true);
      else if (f.lost > FOX_GRACE) endFox(false);
    }
  }

  // ───────────────────────── finalize static art & collider ─────────────────────────
  const colliders: Collider[] = [];
  for (const [region, art] of arts) {
    art.finish(region); art.root.name = `SunwardExploration_${region}`; root.add(art.root);
    if (art.solids.length) {
      let count = 0; for (const g of art.solids) count += g.attributes.position.count;
      const pos = new Float32Array(count * 3); let o = 0;
      for (const g of art.solids) { pos.set(g.attributes.position.array as Float32Array, o); o += g.attributes.position.array.length; g.dispose(); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      colliders.push({ name: `COL_SunwardExploration_${region}`, bvh: new MeshBVH(geo), enabled: true });
      disposables.push(geo);
    }
    disposables.push({ dispose: () => disposeArt(art) });
  }

  // ───────────────────────── per-frame ─────────────────────────
  let lastRegion: RegionId | null = null, time = 0, hudRev = '', hudPeekUntil = 0;
  function update(dt: number, player: PlayerView, region: RegionId, active: boolean) {
    time += dt;
    const pp = player.pos;
    for (const d of dynamic) d.obj.visible = d.obj.userData.hidden ? false : Math.hypot(pp.x - d.p.x, pp.z - d.p.z) < d.range;
    // chests: lid + seal + sparkle
    for (const rt of chests.values()) {
      const isOpen = done.has(flagChest(rt.def.id));
      if (rt.def.buried) {
        const up = done.has(rt.def.requires!); rt.holder.userData.hidden = !up && rt.rise <= 0;
        if (up && rt.rise < 1) { rt.rise = Math.min(1, rt.rise + dt * .7); rt.holder.position.y = rt.base.y - 1.1 * (1 - rt.rise) ** 2; }
        enableMarker(markerChest(rt.def.id), up && rt.rise >= 1);
      }
      rt.open = THREE.MathUtils.damp(rt.open, isOpen ? 1 : 0, 6, dt);
      rt.lid.rotation.x = -rt.open * 1.75;
      rt.sparkle.visible = !isOpen; rt.sparkle.material.opacity = .35 + Math.sin(time * 3 + rt.base.x) * .25;
      if (rt.seal) { const sealed = !!rt.def.requires && !done.has(rt.def.requires) && !isOpen; rt.seal.visible = sealed; if (sealed) rt.seal.rotation.y += dt * .4; }
    }
    // feathers
    for (const f of feathers) {
      const have = done.has(flagFeather(f.id));
      f.obj.userData.hidden = have; if (have) { f.obj.visible = false; continue; }
      f.obj.position.y = f.p.y + Math.sin(time * 1.8 + f.p.x) * .18; f.obj.rotation.y += dt * 1.4;
      if (active && pp.distanceTo(f.obj.position) < 1.7) {
        done.add(flagFeather(f.id)); host.save(); host.sound('pickup');
        const spare = feathersSpare(done);
        showBanner(bilingual('获得 日晕之羽', 'Halo Feather obtained'), bilingual(`已收集 ${feathersHeld(done)} 枚 · ${spare >= GLIDE.feathersPerLevel ? '可以到日晕石像供奉了' : `再收集 ${GLIDE.feathersPerLevel - spare} 枚可强化滑翔翼`}`, `${feathersHeld(done)} collected · ${spare >= GLIDE.feathersPerLevel ? 'offer them at a Halo Statue' : `${GLIDE.feathersPerLevel - spare} more to upgrade the glider`}`));
      }
    }
    // prism head easing
    for (const rt of puzzles.values()) {
      rt.heads.forEach((h, i) => {
        const target = rt.orient[i] * Math.PI / 4;
        let cur = rt.shown[i]; let diff = target - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        cur += diff * Math.min(1, dt * 9); rt.shown[i] = cur; h.rotation.y = -cur;
      });
      rt.recv.rotation.y += dt * (rt.solved ? 1.2 : .25);
      FX.beamGlow.opacity = .26 + Math.sin(time * 4) * .06;
    }
    // trials
    if (activeTrial) {
      const rt = activeTrial;
      if (active) rt.time -= dt;
      rt.orbs.forEach((o, i) => {
        if (rt.got[i]) return;
        o.rotation.y += dt * 2; const ring = o.getObjectByName('OrbRing'); if (ring) ring.lookAt(pp.x, o.position.y, pp.z);
        if (active && pp.distanceTo(o.position) < (rt.def.orbs[i].y ? 2.3 : 1.9)) { rt.got[i] = true; o.visible = false; host.sound('pickup'); }
      });
      const n = rt.got.filter(Boolean).length;
      challenge.hidden = false;
      challenge.innerHTML = `<b>${L(rt.def.title)}</b><span>${bilingual('光点', 'Lights')} ${n} / ${rt.got.length}</span><em class="${rt.time < 6 ? 'low' : ''}">${Math.max(0, rt.time).toFixed(1)}s</em>`;
      if (n === rt.got.length) endTrial(rt, true);
      else if (rt.time <= 0 || Math.hypot(pp.x - rt.def.stele[0], pp.z - rt.def.stele[1]) > 260) endTrial(rt, false);
    }
    // camps
    for (const rt of camps.values()) {
      if (rt.pending > 0) {
        if (active) rt.pending -= dt;
        if (rt.pending <= 0) { rt.pending = 0; if (!startWave(rt)) { rt.wave = 0; activeCamp = null; host.toast(bilingual('离开了据点，敌人重新集结。', 'You left the outpost; the enemies regroup.')); } }
        continue;
      }
      if (rt.running) {
        if (rt.def.style === 'duel' && Math.hypot(pp.x - rt.def.anchor[0], pp.z - rt.def.anchor[1]) > DUEL_RING + .6) {
          host.cancelEncounter(); rt.running = false; rt.wave = 0; activeCamp = null; host.sound('fail');
          showBanner(bilingual('判负 · 离开了决斗圈', 'Forfeit · you left the ring'), bilingual('回到木桩前可以再次挑战。', 'Return to the stake to challenge again.'), 'fail');
          continue;
        }
        if (host.activeEncounter() !== campEncounterId(rt.def.id, rt.wave)) { rt.running = false; rt.wave = 0; activeCamp = null; host.toast(bilingual(`离开了「${rt.def.title[0]}」，据点重置。`, `You left "${rt.def.title[1]}"; the outpost resets.`)); }
        continue;
      }
      const regrouped = !!openCommission('camp', rt.def.id);
      rt.flag.visible = !done.has(flagCamp(rt.def.id)) || regrouped;
      if (!active || activeCamp || activeTrial || ember.route || fox || (done.has(flagCamp(rt.def.id)) && !regrouped) || !player.onGround || player.flying) continue;
      if (rt.def.requires && !done.has(rt.def.requires)) continue;
      if (rt.def.style === 'duel') continue;
      // the road calls out the next stand once it is in sight, so a player heading for the Sun Core finds it
      if (rt.def.style === 'vanguard' && !vanguardHailed.has(rt.def.id) && Math.hypot(pp.x - rt.def.anchor[0], pp.z - rt.def.anchor[1]) < 70) {
        vanguardHailed.add(rt.def.id);
        host.toast(bilingual(`前方的红色战旗下有亡骑列阵 · ${rt.def.title[0]}`, `Wraiths are forming up under the red banner ahead · ${rt.def.title[1]}`));
      }
      if (Math.hypot(pp.x - rt.def.anchor[0], pp.z - rt.def.anchor[1]) < 11 && Math.abs(pp.y - rt.y) < 6 && !host.activeEncounter()) startWave(rt);
    }
    regionalUpdate(dt, player, active);
    if (activeCamp && (activeCamp.running || activeCamp.pending > 0)) {
      challenge.hidden = false;
      challenge.innerHTML = `<b>${L(activeCamp.def.title)}</b><span>${bilingual('波次', 'Wave')} ${activeCamp.wave + 1} / ${activeCamp.def.waves.length}</span>`;
    } else if (!activeTrial && !ember.route && !fox) challenge.hidden = true;
    for (const d of DOMAINS) {
      if (!active || domainSeen.has(d.id) || Math.hypot(pp.x - d.center[0], pp.z - d.center[1]) > d.radius + 2) continue;
      domainSeen.add(d.id); showBanner(L(d.title), L(d.story), 'region', 6);
    }
    // region banner + HUD
    if (region !== lastRegion) {
      if (lastRegion !== null && REGION_NAMES[region] && active) {
        const ex = regionExploration(region, done);
        showBanner(L(REGION_NAMES[region]!), ex.total ? bilingual(`探索度 ${ex.percent}%`, `Explored ${ex.percent}%`) : '', 'region', 3.4);
      }
      lastRegion = region;
    }
    if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) banner.hidden = true; }
    if ((boardCheck -= dt) <= 0) { boardCheck = 20; if (dayKey() !== board.day) { board = todaysBoard(done); if (active) showBanner(bilingual('日晕委托已刷新', 'New commissions'), bilingual('今天的四件委托已经送到，打开地图查看。', "Today's four commissions are in. Open the map to see them."), 'region', 4); } }
    const ex = regionExploration(region, done);
    hud.hidden = !active || ex.total === 0;
    const left = commissionsLeft(), next = left.find(c => c.region === region) ?? left[0];
    const rev = `${region}|${ex.done}|${totalCrystals(done)}|${feathersHeld(done)}|${glideLevel(done)}|${document.documentElement.lang}|${board.day}|${next?.n}|${next ? huntProgress(done, board.day, next.n) : ''}`;
    // The panel only surfaces for a few seconds when something in it changes (new region,
    // a find, a commission step), then gets out of the way.
    const now = typeof performance === 'undefined' ? time * 1000 : performance.now();
    if (hudPeekUntil && now > hudPeekUntil) { hudPeekUntil = 0; hud.classList?.remove('xp-peek'); }
    if (!hud.hidden && rev !== hudRev) {
      hudRev = rev; hudPeekUntil = now + 5000; hud.classList?.add('xp-peek');
      hud.querySelector('.xp-region')!.textContent = `${L(REGION_NAMES[region] ?? ['', ''])} · ${ex.percent}%`;
      (hud.querySelector('.xp-bar i') as HTMLElement).style.width = `${ex.percent}%`;
      hud.querySelector('.xp-stats')!.textContent = bilingual(`日晕晶 ${totalCrystals(done)} · 日晕之羽 ${feathersHeld(done)} · 滑翔 Lv.${glideLevel(done)}`, `Crystals ${totalCrystals(done)} · Feathers ${feathersHeld(done)} · Glider Lv.${glideLevel(done)}`);
      const total = board.list.length, finished = total - left.length;
      hud.querySelector('.xp-comm b')!.textContent = bilingual(`今日委托 ${finished}/${total}`, `Commissions ${finished}/${total}`);
      hud.querySelector('.xp-comm span')!.textContent = !next ? bilingual('全部完成', 'All done')
        : next.kind === 'hunt' ? `${L(next.title)} ${huntProgress(done, board.day, next.n)}/${COMMISSION.hunt}` : L(next.title);
    }
  }
  function reset() {
    if (activeTrial) endTrial(activeTrial, false);
    for (const rt of camps.values()) { rt.running = false; rt.pending = 0; rt.wave = 0; }
    activeCamp = null;
    if (ember.route) { ember = emberIdle(); showNextBeacon(null); }
    if (fox) { const rt = fox.rt; fox = null; rt.wisp.userData.hidden = true; }
    scan = null; signalHud.hidden = true;
  }
  function dispose() {
    for (const d of disposables) d.dispose();
    for (const rt of puzzles.values()) { rt.beam.geometry.dispose(); rt.glow.geometry.dispose(); }
    hud.remove(); banner.remove(); challenge.remove(); parchment.remove(); signalHud.remove(); root.removeFromParent();
  }
  return {
    root, colliders, markers,
    owns: (id: string) => ownership.has(id),
    interact: (id: string) => ownership.get(id)?.(),
    label: (id: string) => labels.get(id)?.() ?? null,
    victory, update, reset, dispose, eliteDefeated, enemyDefeated,
    get commissions() { return board; },
    get busy() { return !!activeTrial || !!activeCamp || !!ember.route || !!fox; },
    state: { chests, puzzles, trials, camps, feathers, embers, foxes, get ember() { return ember; }, get fox() { return fox; }, rotatePrism, startTrial: (id: string) => startTrial(trials.get(id)!) },
  };
}
/** Hand-drawn survey sketch from heights: ink contours every 2 m (bold every 10 m), a heavy coastline and hatched sea. */
function contourSketch(g: CanvasRenderingContext2D, W: number, cx: number, cz: number, R: number, height: (x: number, z: number) => number, water: number) {
  const N = 72, step = (R * 2) / N, cell = W / N, h = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) h[j * (N + 1) + i] = height(cx - R + i * step, cz - R + j * step);
  const at = (i: number, j: number) => h[j * (N + 1) + i];
  g.save(); g.lineCap = 'round';
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = at(i, j), r = at(i + 1, j), d = at(i, j + 1), x = i * cell, y = j * cell;
    if (a < water) { if ((i + j) % 3 === 0) { g.strokeStyle = 'rgba(70,90,110,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + cell); g.lineTo(x + cell, y); g.stroke(); } }
    for (const [b, x2, y2, x3, y3] of [[r, x + cell, y, x + cell, y + cell], [d, x, y + cell, x + cell, y + cell]] as const) {
      const shore = (a < water) !== (b < water);
      const ka = Math.floor(a / 2), kb = Math.floor(b / 2);
      if (!shore && (ka === kb || a < water)) continue;
      const bold = shore || Math.floor(a / 10) !== Math.floor(b / 10);
      g.strokeStyle = shore ? 'rgba(55,32,12,.95)' : bold ? 'rgba(70,42,18,.7)' : 'rgba(90,60,30,.38)';
      g.lineWidth = shore ? 2.4 : bold ? 1.5 : .9;
      g.beginPath(); g.moveTo(x2, y2); g.lineTo(x3, y3); g.stroke();
    }
  }
  g.restore();
}
function disposeArt(art: SiteArt) { for (const mesh of art.layers.values()) mesh.geometry.dispose(); for (const m of Object.values(art.materials)) m.dispose(); }
export type Exploration = ReturnType<typeof createExploration>;
