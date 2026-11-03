/**
 * 幻日探索层运行时：宝箱、日晕之羽、日晕石像、棱镜折光谜题、时层挑战与战斗据点。
 * Owns its own scene graph, one merged collider, interact markers and a small HUD.
 */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { bilingual } from '../../../shared-client/i18n';
import { SiteArt } from '../campaignSites';
import type { Collider } from '../player';
import type { Marker } from '../types';
import type { RegionId, Localized } from '../settlements/types';
import type { StoryEncounterSpec } from '../storyEncounters';
import {
  CAMPS, CHESTS, CHEST_CRYSTALS, DOMAINS, CHEST_NAMES, FEATHERS, GLIDE, PUZZLES, REGION_NAMES, STATUES, TRIALS,
  campEncounterId, feathersHeld, feathersSpare, flagCamp, flagChest, flagFeather, flagGlide, flagPuzzle, flagTrial,
  glideLevel, markerChest, markerPrism, markerStatue, markerStele, parseCampEncounter, regionExploration, solvePuzzle,
  totalCrystals, traceBeam, dirVec, type ChestDef, type PrismPuzzleDef, type TrialDef, type CampDef, type XZ,
} from './catalog';
import {
  Frame, beamGeometry, blockerPillar, campProps, chestBody, chestLid, crystalMaterial, featherMesh, FX, glint, haloStatue,
  lightPillar, orbMesh, prismHead, prismPedestal, receiverBase, receiverCrystal, sealDome, steppingStone, sunLens, sunSource,
  trialStele, waterPlatform, domainRuin, type V3,
} from './models';
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
  sound(kind: 'open' | 'pickup' | 'solve' | 'rotate' | 'fail'): void;
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
  const addMarker = (id: string, p: V3, label: string, radius = 2.4, action?: () => void, labelFn?: () => string) => {
    markers.push({ id, type: 'interact', label, p, radius });
    if (action) ownership.set(id, action);
    if (labelFn) labels.set(id, labelFn);
  };

  // ───────────────────────── HUD ─────────────────────────
  const hud = document.createElement('div'); hud.id = 'xp-hud'; hud.hidden = true;
  hud.innerHTML = '<div class="xp-region"></div><div class="xp-bar"><i></i></div><div class="xp-stats"></div>';
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
    addMarker(markerStatue(s.id), front, L(s.title), 3, () => offerFeathers(s.title), () => {
      const lvl = glideLevel(done), spare = feathersSpare(done);
      return lvl >= GLIDE.maxLevel ? bilingual(`${s.title[0]} · 滑翔翼已满级`, `${s.title[1]} · Glider maxed`)
        : bilingual(`供奉日晕之羽 ${Math.min(spare, GLIDE.feathersPerLevel)}/${GLIDE.feathersPerLevel} · 滑翔翼 Lv.${lvl}`, `Offer Halo Feathers ${Math.min(spare, GLIDE.feathersPerLevel)}/${GLIDE.feathersPerLevel} · Glider Lv.${lvl}`);
    });
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

  // ───────────────────────── chests ─────────────────────────
  interface ChestRt { def: ChestDef; lid: THREE.Group; seal: THREE.Mesh | null; sparkle: THREE.Sprite; open: number; base: THREE.Vector3 }
  const chests = new Map<string, ChestRt>();
  for (const c of CHESTS) {
    const yaw = c.yaw ?? 0, y = surface(...c.p);
    const f = new Frame(artFor(c.region), [c.p[0], y, c.p[1]], yaw);
    chestBody(f, c.tier);
    const { group: lidGroup, art: lidArt } = chestLid(c.tier); disposables.push({ dispose: () => disposeArt(lidArt) });
    const holder = new THREE.Group(); holder.position.set(c.p[0], y, c.p[1]); holder.rotation.y = yaw;
    lidGroup.position.set(0, .07 + .48 + .03, -.32); holder.add(lidGroup);
    const sparkle = glint(c.tier === 'luxurious' ? '#ffe9a0' : c.tier === 'precious' ? '#ffd1a0' : '#fff6d8', .75); sparkle.position.set(0, 1.15, 0); holder.add(sparkle);
    let seal: THREE.Mesh | null = null;
    if (c.requires) { seal = sealDome(1.05); seal.position.set(0, 0, 0); holder.add(seal); disposables.push(seal.geometry); }
    dyn(holder, 90);
    const rt: ChestRt = { def: c, lid: lidGroup, seal, sparkle, open: done.has(flagChest(c.id)) ? 1 : 0, base: holder.position.clone() };
    chests.set(c.id, rt);
    addMarker(markerChest(c.id), [c.p[0] + Math.sin(yaw) * .9, y + .9, c.p[1] + Math.cos(yaw) * .9], L(CHEST_NAMES[c.tier]), 2.2, () => openChest(rt), () =>
      done.has(flagChest(c.id)) ? bilingual('空宝箱', 'Empty chest')
        : c.requires && !done.has(c.requires) ? bilingual(`封印的${CHEST_NAMES[c.tier][0]}`, `Sealed ${CHEST_NAMES[c.tier][1]}`)
          : bilingual(`开启 ${CHEST_NAMES[c.tier][0]}`, `Open ${CHEST_NAMES[c.tier][1]}`));
  }
  function requirementText(flag: string): string {
    const p = PUZZLES.find(x => flagPuzzle(x.id) === flag); if (p) return bilingual(`解开附近的「${p.title[0]}」谜题`, `solve the nearby "${p.title[1]}" puzzle`);
    const t = TRIALS.find(x => flagTrial(x.id) === flag); if (t) return bilingual(`完成「${t.title[0]}」挑战`, `complete the "${t.title[1]}" challenge`);
    const c = CAMPS.find(x => flagCamp(x.id) === flag); if (c) return bilingual(`击败「${c.title[0]}」的全部敌人`, `defeat every enemy at "${c.title[1]}"`);
    return flag;
  }
  function openChest(rt: ChestRt) {
    const c = rt.def;
    if (done.has(flagChest(c.id))) return;
    if (c.requires && !done.has(c.requires)) { host.toast(bilingual(`宝箱被封印了：需要先${requirementText(c.requires)}。`, `The chest is sealed: first ${requirementText(c.requires)}.`)); return; }
    done.add(flagChest(c.id)); host.save(); host.sound('open');
    const n = CHEST_CRYSTALS[c.tier], ex = regionExploration(c.region, done);
    showBanner(bilingual(`获得 日晕晶 ×${n}`, `Halo Crystal ×${n}`), bilingual(`${CHEST_NAMES[c.tier][0]} · ${REGION_NAMES[c.region]?.[0] ?? ''} 探索度 ${ex.percent}%`, `${CHEST_NAMES[c.tier][1]} · ${REGION_NAMES[c.region]?.[1] ?? ''} explored ${ex.percent}%`));
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

  // ───────────────────────── domains (秘境) ─────────────────────────
  const domainSeen = new Set<string>();
  for (const d of DOMAINS) {
    let y = host.terrain(...d.center);
    for (let a = 0; a < 16; a++) for (const r of [d.radius * .5, d.radius]) y = Math.max(y, host.terrain(d.center[0] + Math.cos(a / 8 * Math.PI) * r, d.center[1] + Math.sin(a / 8 * Math.PI) * r) - .15);
    domainRuin(new Frame(artFor(d.region), [d.center[0], y, d.center[1]]), d.radius, d.region);
    platforms.push({ x: d.center[0], z: d.center[1], r: d.radius, top: y + .28 });
  }

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
    if (activeTrial || activeCamp) { host.toast(bilingual('先完成当前挑战。', 'Finish the current challenge first.')); return; }
    rt.active = true; rt.time = rt.def.seconds; rt.got = rt.got.map(() => false); rt.orbs.forEach(o => { o.visible = true; });
    activeTrial = rt; host.sound('rotate');
    showBanner(bilingual(`时层挑战 · ${rt.def.title[0]}`, `Time Echo · ${rt.def.title[1]}`), L(rt.def.hint), 'region', 3.5);
  }
  function endTrial(rt: TrialRt, success: boolean) {
    rt.active = false; activeTrial = null; rt.orbs.forEach(o => { o.visible = false; });
    if (success) {
      const first = !done.has(flagTrial(rt.def.id)); done.add(flagTrial(rt.def.id)); host.save(); host.sound('solve');
      showBanner(bilingual(`挑战成功 · ${rt.def.title[0]}`, `Challenge complete · ${rt.def.title[1]}`), first ? bilingual('奖励宝箱解除了封印。', 'The reward chest has been unsealed.') : bilingual(`剩余 ${(rt.time).toFixed(1)} 秒`, `${rt.time.toFixed(1)} s to spare`), 'solve');
    } else { host.sound('fail'); showBanner(bilingual('挑战失败', 'Challenge failed'), bilingual('回到石碑可以再试一次。', 'Return to the stele to try again.'), 'fail'); }
  }

  // ───────────────────────── camps ─────────────────────────
  interface CampRt { def: CampDef; wave: number; running: boolean; pending: number; y: number; flag: THREE.Group }
  const camps = new Map<string, CampRt>();
  let activeCamp: CampRt | null = null;
  let busyHintAt = -1e9;
  CAMPS.forEach((def, i) => {
    const y = surface(...def.anchor);
    if (def.style !== 'domain') campProps(new Frame(artFor(def.region), [def.anchor[0], y, def.anchor[1]], i * .7), i, def.region);
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
      showBanner(def.style === 'domain' ? bilingual(`秘境 · ${def.title[0]}`, `Domain · ${def.title[1]}`) : bilingual(`据点 · ${def.title[0]}`, `Outpost · ${def.title[1]}`), bilingual(`第 ${rt.wave + 1} / ${def.waves.length} 波 · 击败全部敌人`, `Wave ${rt.wave + 1} / ${def.waves.length} · Defeat every enemy`), 'region', 2.6);
    }
    return result.ok;
  }
  function victory(encounterId: string): boolean {
    const parsed = parseCampEncounter(encounterId); if (!parsed) return false;
    const rt = camps.get(parsed.camp); if (!rt) return true;
    rt.running = false;
    if (rt.wave + 1 < rt.def.waves.length) { rt.wave++; rt.pending = 1.6; host.toast(bilingual('下一波敌人来了！', 'The next wave is coming!')); return true; }
    activeCamp = null; rt.wave = 0;
    const first = !done.has(flagCamp(rt.def.id)); done.add(flagCamp(rt.def.id)); host.save(); host.sound('solve'); rt.flag.visible = false;
    showBanner(rt.def.style === 'domain' ? bilingual(`秘境净化 · ${rt.def.title[0]}`, `Domain purified · ${rt.def.title[1]}`) : bilingual(`据点肃清 · ${rt.def.title[0]}`, `Outpost cleared · ${rt.def.title[1]}`), first ? bilingual('宝箱的封印消失了。', 'The chest seal has faded.') : '', 'solve');
    return true;
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
  let lastRegion: RegionId | null = null, time = 0, hudRev = '';
  function update(dt: number, player: PlayerView, region: RegionId, active: boolean) {
    time += dt;
    const pp = player.pos;
    for (const d of dynamic) d.obj.visible = d.obj.userData.hidden ? false : Math.hypot(pp.x - d.p.x, pp.z - d.p.z) < d.range;
    // chests: lid + seal + sparkle
    for (const rt of chests.values()) {
      const isOpen = done.has(flagChest(rt.def.id));
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
        if (host.activeEncounter() !== campEncounterId(rt.def.id, rt.wave)) { rt.running = false; rt.wave = 0; activeCamp = null; host.toast(bilingual(`离开了「${rt.def.title[0]}」，据点重置。`, `You left "${rt.def.title[1]}"; the outpost resets.`)); }
        continue;
      }
      if (!active || activeCamp || activeTrial || done.has(flagCamp(rt.def.id)) || !player.onGround || player.flying) continue;
      if (rt.def.requires && !done.has(rt.def.requires)) continue;
      if (Math.hypot(pp.x - rt.def.anchor[0], pp.z - rt.def.anchor[1]) < 11 && Math.abs(pp.y - rt.y) < 6 && !host.activeEncounter()) startWave(rt);
    }
    if (activeCamp && (activeCamp.running || activeCamp.pending > 0)) {
      challenge.hidden = false;
      challenge.innerHTML = `<b>${L(activeCamp.def.title)}</b><span>${bilingual('波次', 'Wave')} ${activeCamp.wave + 1} / ${activeCamp.def.waves.length}</span>`;
    } else if (!activeTrial) challenge.hidden = true;
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
    const ex = regionExploration(region, done);
    hud.hidden = !active || ex.total === 0;
    const rev = `${region}|${ex.done}|${feathersHeld(done)}|${glideLevel(done)}|${document.documentElement.lang}`;
    if (!hud.hidden && rev !== hudRev) {
      hudRev = rev;
      hud.querySelector('.xp-region')!.textContent = `${L(REGION_NAMES[region] ?? ['', ''])} · ${bilingual('探索度', 'Explored')} ${ex.percent}%`;
      (hud.querySelector('.xp-bar i') as HTMLElement).style.width = `${ex.percent}%`;
      hud.querySelector('.xp-stats')!.textContent = bilingual(`日晕晶 ${totalCrystals(done)} · 日晕之羽 ${feathersHeld(done)} · 滑翔 Lv.${glideLevel(done)}`, `Crystals ${totalCrystals(done)} · Feathers ${feathersHeld(done)} · Glider Lv.${glideLevel(done)}`);
    }
  }
  function reset() {
    if (activeTrial) endTrial(activeTrial, false);
    for (const rt of camps.values()) { rt.running = false; rt.pending = 0; rt.wave = 0; }
    activeCamp = null;
  }
  function dispose() {
    for (const d of disposables) d.dispose();
    for (const rt of puzzles.values()) { rt.beam.geometry.dispose(); rt.glow.geometry.dispose(); }
    hud.remove(); banner.remove(); challenge.remove(); root.removeFromParent();
  }
  return {
    root, colliders, markers,
    owns: (id: string) => ownership.has(id),
    interact: (id: string) => { ownership.get(id)?.(); },
    label: (id: string) => labels.get(id)?.() ?? null,
    victory, update, reset, dispose,
    get busy() { return !!activeTrial || !!activeCamp; },
    state: { chests, puzzles, trials, camps, feathers, rotatePrism, startTrial: (id: string) => startTrial(trials.get(id)!) },
  };
}
function disposeArt(art: SiteArt) { for (const mesh of art.layers.values()) mesh.geometry.dispose(); for (const m of Object.values(art.materials)) m.dispose(); }
export type Exploration = ReturnType<typeof createExploration>;
