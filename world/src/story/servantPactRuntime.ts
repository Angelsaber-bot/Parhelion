import * as THREE from 'three';
import type { Marker } from '../core/types';
import type { Localized } from '../settlements/types';
import type { createNarrativePanel } from '../ui/narrativePanel';
import { orleansResidentSockets } from '../map/orleansResidents';
import { egyptResidentSockets } from '../map/egyptResidents';
import { qinResidentSockets } from '../map/qinResidents';
import { bilingual } from '../../../shared-client/i18n';
import {
  JEANNE, JEANNE_HEARD, JEANNE_WITNESSES, OZY, OZY_CARVE_SECONDS, OZY_FRAGMENTS, PACT_CLAIM, PACT_SPEAKER,
  QIN_PACT, QIN_RELAY_POSTS, QIN_RELAY_SECONDS, QIN_RELAY_START, jeanneHeard, jeanneHearingReady, jeanneNextRound,
  jeannePresent, ozyFound, ozyWarmth, pactAvailable, pactOfClaim, pactSealed, pactStep, stepRelay, type PactId, type RelayRun,
} from './servantPacts';

/** Live side of the three servant pacts (see servantPacts.ts for the rules and text). */
export interface ServantPactHost {
  scene: THREE.Scene;
  done: Set<string>;
  dialogue: ReturnType<typeof createNarrativePanel>;
  prepareDialogue(): void;
  toast(line: Localized): void;
  save(): boolean;
  changed(): void;
  player(): THREE.Vector3;
  ground(x: number, z: number): number | null;
  /** Position of a claim marker (where the servant waits). */
  marker(id: string): [number, number, number] | null;
  /** Bind the contract: the same path the old claim used (recruit, save, load the model). */
  seal(claimMarker: string): void;
  /** Safe to start a conversation or job (not in combat, not swimming). */
  safe(): boolean;
}

const positions = (() => {
  const all = [...orleansResidentSockets(), ...egyptResidentSockets(), ...qinResidentSockets()];
  return new Map(all.map(s => [s.id, s.position as [number, number, number]]));
})();
export const pactResidentPosition = (npc: string) => positions.get(npc) ?? null;
const FRAGMENT_MARKER = (id: string) => `pact_ozy_fragment_${id}`;

export function createServantPacts(host: ServantPactHost) {
  const d = host.done;
  const root = new THREE.Group(); root.name = 'ServantPacts'; host.scene.add(root);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  let disposed = false;

  // ── HUD: one small panel for timers and progress, one sun for Ozymandias's sense of light ──
  const hud = typeof document !== 'undefined' ? document.createElement('div') : null;
  const sun = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (hud && sun) {
    hud.id = 'pact-hud'; hud.hidden = true; hud.setAttribute('role', 'status');
    Object.assign(hud.style, { position: 'fixed', top: '64px', left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', background: 'rgba(20,32,40,.82)', color: '#f3e5c8', border: '1px solid #c9a35d', borderRadius: '8px', font: '600 15px system-ui,sans-serif', zIndex: '40', pointerEvents: 'none', textAlign: 'center', minWidth: '220px' });
    sun.id = 'pact-sun'; sun.hidden = true; sun.title = 'Solar sense';
    Object.assign(sun.style, { position: 'fixed', right: '28px', bottom: '150px', width: '54px', height: '54px', borderRadius: '50%', background: 'radial-gradient(circle,#fff5c8 0%,#f2b440 45%,rgba(242,180,64,0) 70%)', zIndex: '40', pointerEvents: 'none', opacity: '.15', transition: 'opacity .2s' });
    document.body.append(hud, sun);
  }

  // ── Ozymandias: hidden fragments beside residents, and a stele at the oasis ──
  const fragmentAt = new Map<string, THREE.Vector3>();
  const markers: Marker[] = [];
  for (const f of OZY_FRAGMENTS) {
    const base = positions.get(f.near); if (!base) continue;
    const x = base[0] + f.off[0], z = base[2] + f.off[1], y = host.ground(x, z) ?? base[1];
    fragmentAt.set(f.id, new THREE.Vector3(x, y, z));
    markers.push({ id: FRAGMENT_MARKER(f.id), type: 'interact', label: '王名残片', p: [x, y + .6, z], radius: 2.4, note: 'Ozymandias cartouche fragment' });
  }
  const sandstone = new THREE.MeshStandardMaterial({ color: 0xd9b77e, roughness: .85 }), glow = new THREE.MeshStandardMaterial({ color: 0xf6d27a, emissive: 0xe0a630, emissiveIntensity: 0, roughness: .4 });
  materials.push(sandstone, glow);
  const shards: THREE.Mesh[] = [];
  for (const [id, at] of fragmentAt) {
    const g = new THREE.BoxGeometry(.42, .32, .1); geometries.push(g);
    const shard = new THREE.Mesh(g, glow); shard.position.copy(at).add(new THREE.Vector3(0, .22, 0)); shard.rotation.set(-.5, .7, .2); shard.name = `PactFragment_${id}`; root.add(shard); shards.push(shard);
  }
  const stele = new THREE.Group(); stele.name = 'OzymandiasStele'; root.add(stele);
  const ozyClaim = host.marker(PACT_CLAIM.ozymandias);
  const slots: THREE.Mesh[] = [];
  if (ozyClaim) {
    const sx = ozyClaim[0] + 2.6, sz = ozyClaim[2] - 1.2;
    stele.position.set(sx, host.ground(sx, sz) ?? ozyClaim[1], sz);
    const body = new THREE.BoxGeometry(1.1, 2.4, .4); geometries.push(body);
    const slab = new THREE.Mesh(body, sandstone); slab.position.y = 1.2; stele.add(slab);
    for (let i = 0; i < 3; i++) { const g = new THREE.BoxGeometry(.32, .5, .06); geometries.push(g); const m = new THREE.MeshStandardMaterial({ color: 0x8b6a3c, emissive: 0xe0a630, emissiveIntensity: 0 }); materials.push(m); const slot = new THREE.Mesh(g, m); slot.position.set(0, 1.85 - i * .6, .22); stele.add(slot); slots.push(slot); }
  }

  // ── Qin: relay beacons, shown only while the edict is being carried ──
  const beaconGeometry = new THREE.CylinderGeometry(.55, .55, 26, 16, 1, true); geometries.push(beaconGeometry);
  const beacons = [...QIN_RELAY_POSTS.map(p => p.npc), 'end'].map((npc, i) => {
    const m = new THREE.MeshBasicMaterial({ color: 0xf2c25a, transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide }); materials.push(m);
    const b = new THREE.Mesh(beaconGeometry, m); b.visible = false; b.name = `QinRelayBeacon_${i}`;
    const at = npc === 'end' ? host.marker(PACT_CLAIM.qin) : positions.get(npc) ?? null;
    if (at) b.position.set(at[0], at[1] + 13, at[2]);
    root.add(b); return b;
  });
  let relay: RelayRun | null = null, clock = 0;
  const target = (i: number): THREE.Vector3 | null => { if (i < QIN_RELAY_POSTS.length) { const p = positions.get(QIN_RELAY_POSTS[i].npc); return p ? new THREE.Vector3(...p) : null; } const e = host.marker(PACT_CLAIM.qin); return e ? new THREE.Vector3(...e) : null; };
  const flat = (a: THREE.Vector3, b: THREE.Vector3 | null) => b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;

  // ── Ozymandias carving job ──
  let carving = -1;

  const commit = (...flags: string[]) => { for (const f of flags) d.add(f); host.save(); host.changed(); apply(); };
  const say = (line: Localized, who: Localized) => { host.prepareDialogue(); host.dialogue.show(line, who); };
  const ask = (line: Localized, who: Localized, choices: { id: string; label: Localized }[], pick: (id: string) => void) => { host.prepareDialogue(); host.dialogue.showChoices(line, who, choices, pick); };
  const near = (p: readonly number[] | null, r = 6) => !!p && Math.hypot(host.player().x - p[0], host.player().z - p[2]) < r;
  const later = { id: 'later', label: ['先去准备一下。', 'Let me prepare first.'] as Localized };
  const join = (a: Localized, b: Localized): Localized => [`${a[0]}\n\n${b[0]}`, `${a[1]}\n\n${b[1]}`];

  function apply() {
    const hunting = d.has(OZY.open) && !pactSealed('ozymandias', d);
    let i = 0;
    for (const f of OZY_FRAGMENTS) { const shard = shards[i++]; if (shard) shard.visible = hunting && !d.has(f.flag); }
    slots.forEach((s, k) => { const lit = d.has(OZY.carved) || (k < ozyFound(d).length && d.has(OZY.open)); (s.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? (d.has(OZY.carved) ? 1.4 : .5) : 0; });
    stele.visible = d.has(OZY.open) || pactSealed('ozymandias', d);
  }
  apply();

  function seal(id: PactId, flag: string, closing: Localized) {
    commit(flag);
    host.seal(PACT_CLAIM[id]);
    say(closing, PACT_SPEAKER[id]);
  }

  // ───────── Jeanne ─────────
  function jeanneAtMarket() {
    const who = PACT_SPEAKER.jeanne;
    if (!d.has(JEANNE.open)) {
      ask(['“城得救了，可记录官说那面旗是妖术、是谎言，墙画上还多出一个我不认识的持旗人。我不求你相信我。去问那些在场的人——问他们看见了什么。等你听够了，我们在这里开庭。”', '“The town is saved, yet the record-keepers call that banner witchcraft and lies, and the mural now shows a standard-bearer I do not know. I do not ask you to believe me. Ask the people who were there what they saw. When you have heard enough, we hold the hearing here.”'],
        who, [{ id: 'take', label: ['我去听他们怎么说。', 'I will hear what they say.'] }, later], c => { if (c === 'take') { commit(JEANNE.open); host.toast(['证言审理开始：询问城里的证人，听够 4 位即可开庭。', 'The tribunal begins: question the townspeople; four testimonies open the hearing.']); } });
      return;
    }
    if (!jeanneHearingReady(d)) { say([`“已经听了 ${jeanneHeard(d).length} 位。记录官只认人证——再多问几位吧。”`, `“You have heard ${jeanneHeard(d).length}. The record-keepers only accept witnesses; ask a few more.”`], who); return; }
    hearing(null);
  }
  function hearing(prefix: Localized | null) {
    const round = jeanneNextRound(d);
    if (!round) {
      const flawless = !d.has(JEANNE.miss);
      seal('jeanne', JEANNE.sealed, flawless
        ? ['记录官在簿上写下：所述指控，均无人证。贞德把旗杆交到你手里一瞬，又接了回去。“你只听人说了什么，没有替他们说话。这样的人，我愿意跟着走。”', 'The record-keeper writes: no witness supports the charges. Jeanne puts the banner pole in your hands for a moment, then takes it back. “You listened to what people said and never spoke for them. I will walk with someone like that.”']
        : ['记录官在簿上写下：所述指控，均无人证。贞德笑了一下。“你也拿错过证言，可你没有改掉别人说过的话，只是再去问。这样的人，我愿意跟着走。”', 'The record-keeper writes: no witness supports the charges. Jeanne smiles. “You presented the wrong testimony once, but you never changed what anyone said; you went and asked again. I will walk with someone like that.”']);
      return;
    }
    const cards = jeanneHeard(d).map(w => ({ id: w.id, label: w.card }));
    ask(prefix ? join(prefix, round.claim) : round.claim, ['奥尔良 · 审理', 'Orleans · Hearing'], [...cards, { id: 'adjourn', label: ['暂停审理，再去找证人。', 'Adjourn and look for more witnesses.'] }], card => {
      if (card === 'adjourn' || !near(host.marker(PACT_CLAIM.jeanne), 9)) return;
      const result = jeannePresent(card, d);
      if (result === 'won') { host.save(); host.changed(); hearing(round.rebuttal); }
      else if (result === 'wrong') { host.save(); hearing(['记录官摇头：“这段证言是真的，可它回答的不是这条指控。”', 'The record-keeper shakes his head: “That testimony is true, but it does not answer this charge.”']); }
    });
  }
  function witness(npc: string, role: Localized): boolean {
    if (!d.has(JEANNE.open) || pactSealed('jeanne', d)) return false;
    const w = JEANNE_WITNESSES.find(x => x.npc === npc); if (!w || d.has(JEANNE_HEARD(w))) return false;
    ask(['关于那面旗，你想问点什么？', 'What will you ask about the banner?'], role, [{ id: 'ask', label: w.ask }, { id: 'later', label: ['改天再问。', 'Another time.'] }], c => {
      if (c !== 'ask') return;
      commit(JEANNE_HEARD(w));
      say(join(w.testimony, [`【证言已记录：${w.card[0]}】（${jeanneHeard(d).length}/5）`, `[Testimony recorded: ${w.card[1]}] (${jeanneHeard(d).length}/5)`]), role);
    });
    return true;
  }

  // ───────── Ozymandias ─────────
  function ozyAtOasis() {
    const who = PACT_SPEAKER.ozymandias;
    if (!d.has(OZY.open)) {
      ask(['“你让河水回来了，这很好。但王中之王不与需要地图的人同行。我的王名被时间敲成三块，散在太阳照得到的地方。不给你标记——只给你谜语，和太阳的温度。找齐了，回来把它刻上这块碑。”', '“You brought the river back. Good. But the King of Kings does not travel with one who needs a map. Time broke my name into three pieces, scattered where the sun can see them. No markers: only riddles and the warmth of the sun. Find them all, then carve them on this stele.”'],
        who, [{ id: 'take', label: ['我会用自己的眼睛找。', 'I will find them with my own eyes.'] }, later], c => { if (c === 'take') { commit(OZY.open); host.toast(['王名寻迹：谜语写在任务指引里；靠近残片时，右下角的日轮会变亮。', 'The name hunt: the riddles are in the quest guide; the sun at the lower right brightens as you near a fragment.']); } });
      return;
    }
    const missing = OZY_FRAGMENTS.filter(f => !d.has(f.flag));
    if (missing.length) { say([`“还差 ${missing.length} 块。”他没有看你，看的是太阳。“${missing.map(f => f.riddle[0]).join('')}”`, `“${missing.length} still missing.” He looks at the sun, not at you. “${missing.map(f => f.riddle[1]).join(' ')}”`], who); return; }
    if (!d.has(OZY.carved)) {
      ask(['三块残片在你手里拼成一个完整的椭圆。石碑上留着三个空槽。', 'In your hands the three fragments fit into one oval. The stele has three empty slots.'], ['绿洲石碑', 'Oasis stele'],
        [{ id: 'carve', label: [`把王名刻上石碑（站在碑前 ${OZY_CARVE_SECONDS} 秒）`, `Carve the name into the stele (stay ${OZY_CARVE_SECONDS} s)`] }, later], c => { if (c === 'carve') { carving = 0; host.toast(['开始刻字：留在石碑前，不要走开。', 'Carving: stay at the stele.']); } });
      return;
    }
    ask(['石碑上的王名在日光下发亮。奥斯曼迪斯走下台阶，伸出手。“现在，你如何站在王的面前？”', 'The name on the stele shines in the sun. Ozymandias steps down and holds out his hand. “Now: how do you stand before the king?”'], who,
      [{ id: 'kneel', label: ['单膝跪下，接受王的邀请。', 'Kneel and accept the king’s invitation.'] }, { id: 'stand', label: ['站着，握住他的手。', 'Stand and take his hand.'] }], c => {
        if (c === 'kneel') seal('ozymandias', OZY.knelt, ['“礼数周全。可在路上，你不必再跪。”他把你扶起来。“王名已经立在碑上，现在，王与你同行。”', '“Courteous. But on the road you need not kneel again.” He lifts you up. “My name stands on the stele; now the king walks with you.”']);
        else if (c === 'stand') seal('ozymandias', OZY.stood, ['他大笑起来。“好！能找回王名的人，就有资格站着跟王说话。”他握紧你的手。“走吧，太阳在前面。”', 'He laughs aloud. “Good! Whoever can recover a king’s name may speak to him standing.” He grips your hand. “Come. The sun is ahead.”']);
      });
  }
  function takeFragment(id: string) {
    const f = OZY_FRAGMENTS.find(x => FRAGMENT_MARKER(x.id) === id);
    if (!f || !d.has(OZY.open) || d.has(f.flag)) return;
    commit(f.flag);
    say(join(f.found, [`【王名残片 ${ozyFound(d).length}/3】`, `[Cartouche fragment ${ozyFound(d).length}/3]`]), ['王名残片', 'Cartouche fragment']);
  }

  // ───────── Qin ─────────
  function qinAtRelay() {
    const who = PACT_SPEAKER.qin;
    if (!d.has(QIN_PACT.open)) {
      ask([`“天下统一，不是一道诏书写完就算。车同轨、书同文——诏书要靠人送到。驿丞那里有朕的诏，${QIN_RELAY_SECONDS} 秒内经过五座驿站盖印，再送回朕面前。晷影移过刻线，诏书便作废。”`, `“Unity is not finished when an edict is written. Same axle, same script: an edict must be carried. The post master holds my edict. Take it through five posts for their seals within ${QIN_RELAY_SECONDS} seconds and bring it back to me. Once the sundial shadow passes the mark, the edict is void.”`],
        who, [{ id: 'take', label: ['我去驿丞那里接诏。', 'I will take the edict from the post master.'] }, later], c => { if (c === 'take') { commit(QIN_PACT.open); host.toast(['驰道传诏：到骊山驿丞处接诏开始计时。', 'The imperial road: take the edict from the Lishan post master to start the clock.']); } });
      return;
    }
    if (!d.has(QIN_PACT.delivered)) { say(['“诏在驿丞手里。去接，去送。”', '“The edict is with the post master. Take it; carry it.”'], who); return; }
    seal('qin', QIN_PACT.sealed, ['他展开诏书，五个驿印一个不缺，墨还没干。“准时。天下的路通了，朕的令才算出了宫门。”他收起竹简。“从今往后，朕的路，你一起走。”', 'He unrolls the edict: all five seals, the ink still wet. “On time. Only when the roads carry it has my order truly left the palace.” He rolls the slips up. “From now on, you walk my roads with me.”']);
  }
  function postMaster(npc: string, role: Localized): boolean {
    if (npc !== QIN_RELAY_START || !d.has(QIN_PACT.open) || d.has(QIN_PACT.delivered) || pactSealed('qin', d)) return false;
    if (relay && !relay.finished && !relay.failed) { say(['“诏书已经在你手上了，快走！”', '“The edict is already in your hands. Go!”'], role); return true; }
    ask([`“诏书在此。从这里出发，依次过${QIN_RELAY_POSTS.map(p => p.name[0]).join('、')}，最后回到陛下面前。限时 ${QIN_RELAY_SECONDS} 秒。”`, `“Here is the edict. From here, pass ${QIN_RELAY_POSTS.map(p => p.name[1]).join(', ')} in order, then return to His Majesty. ${QIN_RELAY_SECONDS} seconds.”`], role,
      [{ id: 'go', label: ['接诏，出发！', 'Take the edict and go!'] }, { id: 'later', label: ['等我准备好。', 'When I am ready.'] }], c => {
        if (c !== 'go' || !host.safe()) return;
        relay = { started: clock, next: 0, finished: false, failed: false }; showBeacons();
        host.toast(['诏书在手，计时开始。金色光柱是下一座驿站。', 'Edict in hand; the clock is running. The gold beam marks the next post.']);
      });
    return true;
  }
  function showBeacons() { beacons.forEach((b, i) => { b.visible = !!relay && !relay.finished && !relay.failed && i >= relay.next; (b.material as THREE.MeshBasicMaterial).opacity = relay && i === relay.next ? .55 : .14; }); }

  return {
    root, markers,
    owns(id: string) { return !!pactOfClaim(id) || markers.some(m => m.id === id); },
    /** Fragment markers answer only while the hunt is open and they are still missing. */
    ready(id: string) {
      const f = OZY_FRAGMENTS.find(x => FRAGMENT_MARKER(x.id) === id);
      if (f) return d.has(OZY.open) && !d.has(f.flag) && !pactSealed('ozymandias', d);
      return true;
    },
    label(id: string): Localized | null {
      if (markers.some(m => m.id === id)) return ['拾起王名残片', 'Take the cartouche fragment'];
      const pact = pactOfClaim(id); if (!pact || pactSealed(pact, d)) return null;
      const who = PACT_SPEAKER[pact];
      if (!pactAvailable(pact, d)) return [`${who[0]} · 尚未到来`, `${who[1]} · Not yet`];
      if (pact === 'jeanne') return jeanneHearingReady(d) ? ['开庭 · 圣旗下的证言', 'Open the hearing'] : [`与贞德交谈`, 'Talk to Jeanne'];
      if (pact === 'ozymandias') return d.has(OZY.carved) ? ['觐见奥斯曼迪斯', 'Stand before Ozymandias'] : ozyFound(d).length === 3 ? ['把王名刻上石碑', 'Carve the name'] : ['觐见奥斯曼迪斯', 'Attend Ozymandias'];
      return d.has(QIN_PACT.delivered) ? ['呈上诏书', 'Present the edict'] : ['觐见始皇帝', 'Attend the First Emperor'];
    },
    /** True when the pact handled the interaction (an unsealed servant's point, or a fragment). */
    interact(id: string): boolean {
      if (disposed) return false;
      if (markers.some(m => m.id === id)) { takeFragment(id); return true; }
      const pact = pactOfClaim(id); if (!pact || pactSealed(pact, d)) return false;
      if (!host.safe()) { host.toast(['先脱离危险，再去觐见。', 'Leave danger before you meet them.']); return true; }
      if (!pactAvailable(pact, d)) { say(pactStep(pact, d)!.text, PACT_SPEAKER[pact]); return true; }
      if (pact === 'jeanne') jeanneAtMarket(); else if (pact === 'ozymandias') ozyAtOasis(); else qinAtRelay();
      return true;
    },
    /** Residents who take part: Jeanne's witnesses and Qin's post master. */
    talk(npc: string, role: Localized): boolean { if (disposed) return false; return witness(npc, role) || postMaster(npc, role); },
    update(dt: number) {
      if (disposed) return;
      clock += dt;
      const me = host.player();
      // Qin relay.
      if (relay && !relay.finished && !relay.failed) {
        const before = relay.next;
        relay = stepRelay(relay, clock, flat(me, target(relay.next)), flat(me, target(QIN_RELAY_POSTS.length)));
        if (relay.next > before) { host.toast([`驿印 ${relay.next}/5：${QIN_RELAY_POSTS[before].name[0]}`, `Seal ${relay.next}/5: ${QIN_RELAY_POSTS[before].name[1]}`]); showBeacons(); }
        if (relay.finished) { const t = clock - relay.started; commit(QIN_PACT.delivered); showBeacons(); host.toast([`诏书准时送到：${t.toFixed(1)} 秒。去呈给始皇帝。`, `Delivered on time: ${t.toFixed(1)} s. Present it to the First Emperor.`]); }
        else if (relay.failed) { showBeacons(); host.toast(['晷影移过刻线，诏书作废。回驿丞处重新接诏。', 'The shadow passed the mark; the edict is void. Take a new one from the post master.']); }
        if (hud) { const left = Math.max(0, QIN_RELAY_SECONDS - (clock - relay.started)); hud.hidden = relay.finished || relay.failed; hud.textContent = bilingual(`驰道传诏 · 驿印 ${relay.next}/5 · 剩余 ${left.toFixed(1)} 秒`, `Imperial road · Seals ${relay.next}/5 · ${left.toFixed(1)} s left`); }
      }
      // Ozymandias carving: stay at the stele.
      if (carving >= 0) {
        const at = host.marker(PACT_CLAIM.ozymandias);
        if (!near(at, 6) || !host.safe()) { carving = -1; if (hud) hud.hidden = true; host.toast(['离开了石碑，刻字中断。', 'You left the stele; the carving stopped.']); }
        else {
          carving += dt;
          if (hud) { hud.hidden = false; hud.textContent = bilingual(`刻写王名 ${Math.min(100, carving / OZY_CARVE_SECONDS * 100).toFixed(0)}%`, `Carving the name ${Math.min(100, carving / OZY_CARVE_SECONDS * 100).toFixed(0)}%`); }
          if (carving >= OZY_CARVE_SECONDS) { carving = -1; if (hud) hud.hidden = true; commit(OZY.carved); host.toast(['王名刻成。再去觐见奥斯曼迪斯。', 'The name is carved. Stand before Ozymandias.']); }
        }
      }
      // Ozymandias solar sense: brighter near the closest missing fragment.
      if (sun) {
        let warmth = 0;
        if (d.has(OZY.open) && !pactSealed('ozymandias', d)) for (const f of OZY_FRAGMENTS) { const at = fragmentAt.get(f.id); if (at && !d.has(f.flag)) warmth = Math.max(warmth, ozyWarmth(me.distanceTo(at))); }
        const hunting = d.has(OZY.open) && ozyFound(d).length < 3 && !pactSealed('ozymandias', d);
        sun.hidden = !hunting;
        if (hunting) { sun.style.opacity = String(.15 + warmth * .85); sun.style.transform = `scale(${1 + warmth * .5 + (warmth > .6 ? Math.sin(clock * 8) * .08 : 0)})`; }
      }
      for (const s of shards) if (s.visible) s.rotation.y += dt * .8;
    },
    /** Reset a run on death or travel; progress flags stay. */
    interrupt() { if (relay && !relay.finished) { relay = null; showBeacons(); if (hud) hud.hidden = true; } if (carving >= 0) { carving = -1; if (hud) hud.hidden = true; } },
    get relay() { return relay; },
    apply,
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent(); hud?.remove(); sun?.remove();
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    },
  };
}
export const PACT_FRAGMENT_MARKER = FRAGMENT_MARKER;
