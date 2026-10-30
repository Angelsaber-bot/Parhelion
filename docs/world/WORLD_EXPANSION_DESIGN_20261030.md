# Parhelion: five distinct chapters, first playable expansion

Date: 2026-10-30. Audit baseline: `350f564`. Scope: an eight-hour **development** iteration, not eight hours of new player content and not a claim of AAA completeness. This document is design, not proof of implementation. Preserve the five maps, terrain, roads, settlement footprints, regional offsets, existing historical silhouettes and Arena. Cloud development/test only; no publication, deployment or desktop execution is implied.

## Decisions implementers can use immediately

1. Replace four compulsory three-shard tours with **one characteristic playable route per era**, plus two optional landmark adventures. Do not add another token collection system on top.
2. Keep Valley's working `valleyStory` light/physical-shortcut interaction. Extend its clarity, not its errands. The player should see a result before another instruction appears.
3. Use existing `done` flags and existing actors. Four eras keep their antagonist bosses; Arthur/Artoria, Blackbeard, Napoleon and Musashi remain allies. Do not make recruitment a fight against the ally.
4. A mainline objective must agree with marker requirements, combat requirements, dynamic bridge collision, visible state and the guide. A shorter checklist alone is not a shorter campaign.
5. No additional crowd population. The baseline already has 145 ordinary enemies, five elites, 24 detailed eligible enemy models and unresolved reported 27–40 FPS. Differentiate the behavior of the existing population.
6. Ship two tiers honestly: P0 = coherent branching routes, persistent outcomes and readable combat; P1 = additional optional interactions/ally commands only if integration and regression evidence exist. Cut additions before cutting validation.

## Evidence-based design principles

These are primary developer accounts, not claims that Parhelion implements these games' systems. No assets, story or branded abilities should be copied.

- **Nintendo, Tears of the Kingdom developer interview, chapter 5 (12 May 2023):** developers describe consistent object affordances and visual signs, and the value of player-chosen solutions and detours. Apply this through recognisable interactable silhouettes, actual collision changes, optional routes and one consistent F/shot vocabulary; do not attempt a new general physics sandbox in this iteration. [Nintendo developer interview](https://www.nintendo.com/au/news-and-articles/ask-the-developer-vol-9-the-legend-of-zelda-tears-of-the-kingdom-chapter-5/)
- **HoYoverse technical director Zhenzhong Yi, Natlan 5.0 (16 August 2024):** local traversal capabilities are connected to terrain, cultures and exploration; access can avoid completing every previous nation. Apply the principle, not the transformations: cannon/deck/updraft identity for Black Sail, shelter-to-shelter decisions for Winter, bridges/stepping stones for Kyoto. Preserve freedom to pick an era after Valley. [Developer-authored PlayStation article](https://blog.playstation.com/2024/08/16/genshin-impact-welcomes-the-sixth-major-nation-of-teyvat-with-version-5-0-going-live-august-28/)
- **HoYoverse, Natlan 5.2 (10 November 2024):** distinct traversal and perception abilities reveal different exploration opportunities. Apply as optional vantage-point clues and readable destinations using the existing glider, not mandatory new stamina economies. [Developer-authored PlayStation article](https://blog.playstation.com/2024/11/10/20241111-genshinimpact/)
- **Kuro Games producer Solon Li, interview hosted by Epic:** describes freedom of combat/exploration and a unified visual language across the combat loop; also discusses hardware constraints on effects. Apply through consistent windup/impact/recovery cues, complementary enemy roles and economical effects. This source does not establish any precise dodge timing or damage number below; those are Parhelion tuning proposals. [Primary developer interview](https://www.unrealengine.com/developer-interviews/exploring-the-post-apocalyptic-charm-of-asg-open-worlds-in-wuthering-waves?lang=en)

## Baseline audit: reuse and risks

Read: `world/README.md`, `world/src/main.ts`, `valleyStory.ts`, `valleyStoryScene.ts`, `combat.ts`, relevant `combatView.ts`, all five shipped layout objectives/markers, Black Sail generator bridge state, and existing Valley/enemy/render documentation.

- `main.ts` has a region-first guide that walks raw layout objective steps. `renderObjective` displays the entire objective. An optional step left in that array still captures the mainline guide. Reordering steps is insufficient.
- `interact()` reads `Marker.requires`; `combatView` separately constructs bosses with `BOSSES.requires` from `combat.ts`. Both must change together.
- Black Sail `Ghost_Bridge` has **both** `showWhen` and `solidWhen` tied to all three sea shards in `tools/gen/blacksail/build.ts`. The live GLB metadata and extracted solid state must also agree. Do not produce a visible but non-solid bridge, or require optional treasure to cross it.
- First clear adds the core flag in `onVictory`, not on merely touching the core. Keep that invariant. Weather/contract progression must not resolve on boss start, reset or defeat.
- Valley's manual panel already has distance/LOS checks, save failure feedback, persistent physical gate state, legacy-save protection and delayed offscreen archivist relocation. Use this as the local interaction pattern.
- Ordinary marker interactions currently have weaker LOS handling than the Valley panel. New props must use an explicit usable-target predicate, not enable interaction through walls.
- README sections contain historical contradictions (three vs four seams, old flight behavior); runtime and shipped layouts are authoritative. Do not base new requirements on outdated prose.
- Existing visual signals (fire, beacon, banner, bridge, treasure chest, weather) are valuable. New expensive geometry is not required to give them meaning.

## Campaign promise and structure

**Premise:** four historical moments cannot finish. The Valley is the place the player returns to; each ally wants an ordinary human outcome, not merely another glowing shard. Completing an era changes its visible conditions and leaves a small remembered trace at its existing settlement.

**Player contract:** a clear active goal; permission to ignore side landmarks; one action that affects a physical place; one distinctive encounter; no unexplained reset of what the player already achieved.

After `summon_circle`, all four era entrances remain available. Era order is a choice, not a prescribed level ladder. Avoid level-scaled damage inflation and gear gates. Finishing an era gives its existing contract/keepsake; completing all four gets a brief Valley epilogue and a visible four-part status display at the existing headquarters terminal, not a fifth grind or new final boss.

Timing is a hypothesis to test, not an advertised duration: aim for roughly 10–20 minutes of direct critical-path play per era excluding prolonged sightseeing, with 3–8 minute optional landmark detours. Map distances may exceed these estimates; measure normal movement before promising them. The eight-hour brief governs production time, not campaign length.

## Chapter 0 — Valley / 留一盏灯 · A Light to Return To

**Identity:** restore a home and learn how the world responds. Existing archivist, maintenance panel, observatory, armory, relays, tower and seams stay where they are.

**Mainline:** meet archivist or discover manual latch → restore `hq_terminal` → acknowledge lit courtyard → take weapon → learn shooting at the range → restore relay network → raise tower signal → stabilize the summon circle and choose a horizon.

- Preserve the short existing story and physical side entrance. Do not add spare-part fetching, a second report NPC, or new mobs at the residence.
- The four distant seam inspections are the largest onboarding errand. Preferred P0 refinement: tower reveals their identities; allow `summon_circle` after tower restoration, with seam inspections retained as optional discoveries. This changes access policy, not map layout. If compatibility tests cannot cover it, retain the old gate honestly and label this refinement deferred.
- Relay B text currently says “clear” despite the marker having no prerequisite. Either provide a genuine local encounter predicate using existing enemies, or change the instruction to “reach the outpost relay.” Do not promise a combat lock that does not exist.
- Keep one clear next objective, not the whole nine-step spoiler list. The tower reveal should show four destinations; it should not silently choose Britain for everyone.

**Optional meaningful exploration:** manually unlatch the maintenance entrance before meeting the archivist. Outcome is the same usable shortcut plus independently green indicator; alternate order earns a different acknowledgment, not duplicate reward. Existing forest/waterfall discoveries may remain unmarked until encountered.

**Completion evidence:** lit inlays, traversable side entrance and retained gun state after reload; returning archivist is never visibly teleported; other eras' guidance is never overridden by Valley story.

## Chapter 1 — Arthurian Britain / 空席的誓言 · The Empty Seat

**Identity:** an ally and a broken institution, not three errands for a key. At the lake the existing Saber/Artoria contract is the Arthurian alliance; do not introduce a contradictory second Arthur model.

**P0 mainline:** lake contract → light the existing oath hearth (`hall_brazier_1`) at the round table → confront `boss_vacant_king` at Camlann → witness sunset change.

**Narrative in three short beats:** “The hall is still standing. No one returns to its seats.” / “A crown cannot make this promise for us.” / “Then let the empty seat stay empty. We will carry the oath.” These are proposed English meaning lines; supply concise Chinese equivalents in the runtime localization pair, not a cutscene.

**Optional A — knight camp:** existing three dummy challenge is training, not a mainline toll. Finishing makes a small rack/banner visibly ready and unlocks one modest encounter aid (for example a one-time shield-break assist), if that aid is implemented and tested. Without an implemented aid, promise only the persistent visible restoration/keepsake.

**Optional B — tower:** climb existing spiral to the tower shard/vantage. Let a nearby optional survey interaction reveal Camlann as a destination and light a fixed signal pennant; do not reveal every hidden collectible or move a tower. A player can see and reach Camlann without doing this.

**Combat identity:** shield guard commits to a slow frontal approach, exposes flank/recovery after a wide strike; Vacant King adds a clearly telegraphed sweep/rush choice rather than unmarked unavoidable damage. Artoria's optional command is a brief guard window, not an automated boss kill.

**Persistent result:** round-table fire remains; existing core weather result persists; optional rack/signal records what the player actually did. Boss rematch never extinguishes the hearths or revokes the ally.

## Chapter 2 — Black Sail / 不再引魂的灯 · A Light for the Living

**Identity:** naval artillery and getting aboard; Blackbeard is a collaborator against the Drowned Admiral.

**P0 mainline:** meet `blackbeard_meet` → load existing `fort_cannon` and sink the three ghost boats → ghost bridge becomes visibly and physically available → board flagship and defeat Admiral → conclude contract at tavern.

The three shots are a spatial artillery challenge, not three fetch destinations. Keep loading and aiming meaningful: cannon shot origin/range must be actual gun position; targets remain readable. No ship simulation or extra fleet actors.

**Optional A — aerial wrecks:** use existing updrafts/gliding to compass vantage. Reward is an optional navigation aid/clear sightline and persistent compass mount, not permission to use the main bridge. Falling must land in safe/recoverable space; death does not clear cannon success.

**Optional B — smuggler treasure:** keep the authored three-part map/X/chest chain as one explicitly optional treasure adventure. The opened chest is already a persistent outcome. It must not appear in the active mainline queue or be required by bridge metadata.

**Combat identity:** pirate closes distance with a straight committed rush; Admiral alternates a deck-lane shot with a boarding sweep and long punishable recovery. Constrain all warnings to actual deck geometry, not sea-floor circles. Blackbeard's proposed command is one short suppressing volley that interrupts a windup; do not add persistent smoke or particle clouds.

**Narrative:** “That cold lamp is calling crews that never came home.” → “Break the pickets. I will show you the boarding route.” → warm lamp/cleared weather, not “Blackbeard defeated.”

## Chapter 3 — Winter / 让最后一队人回家 · The Last Warm Road

**Identity:** warmth and exposed movement, not a timer-driven scavenger circuit. Napoleon seeks a route out for those trapped by the winter; avoid glorifying conquest as the chapter's only motivation.

**P0 mainline:** meet `napoleon_meet` → restore existing beacon route (`beacon_1..3`) → use shelter/cold knowledge on the approach to Red Square → defeat Winter Warden → conclude at emperor's tent.

- The beacons are useful immediately: existing heat mechanics make each a safe staging point. Show “warmth restored” rather than “token 1/3.” The three sites should be visited in player-chosen order, not a long fixed zigzag.
- Cold remains legible with recovery near heat. No HP drain, hunger, consumable fuel grind or permanent failure added. Do not stack new chill slow on existing frozen movement penalties.
- P1 only: an existing camp notice changes to a lit evacuation-route signal when the beacon route completes. Reuse NPC poses/placement; no escort pathfinding or refugee crowds.

**Optional A — bell tower:** climb scaffolding for the bell shard; optional bell interaction produces a short cue and persistent struck/raised signal state. If adding a tactical benefit, explicitly display it (e.g. first Warden windup lengthened); no hidden statistical buff.

**Optional B — frost gorge:** break existing three seals; ice wall disappears with actual collision change and a cave vista/keepsake. It is a self-contained secret passage, not a compulsory third boss key.

**Combat identity:** existing musketeer locks aim for 1.2 seconds, checks LOS and has a two-second recovery; retain those readable strengths. Pair with an existing short-range officer instead of spawning a squad. Warden uses a lane volley and an exposed close-range recovery. Napoleon's proposed command marks one target for a short coordinated attack, bounded and visible rather than global damage scaling.

**Persistent result:** warmth remains at restored beacons, opened gorge remains open, first-clear weather resolves. Rematch does not restore the global cold penalty after the chapter has been saved complete.

## Chapter 4 — Kyoto / 火止于此 · Here the Fire Ends

**Identity:** choosing a line through the city and breaking a hostile command signal. Musashi is a visitor caught in the time-layer, not a claim that his mature historical self stood at the 1582 incident; make the anomaly clear in one line if needed.

**P0 mainline:** meet `musashi_meet` at existing bridge → sabotage existing Kikyo banners from playable sightlines → enter Honnoji and defeat Hellfire Lord → conclude at bridge.

**Optional A — Kinkaku:** existing stepping-stone route and shard; optional reflection-lantern interaction leaves a quiet lit alcove. Reward a respite/view and recorded memory, not a new damage tier.

**Optional B — Kiyomizu:** existing climb and stage; optional signal brazier identifies an alternate return direction toward the river. Do not add a new bridge, change hills or promise rooftop traversal that lacks collision.

**Combat identity:** existing spear ashigaru threatens a narrow forward lane; samurai double slash has separately readable warnings and a recovery after the second strike. Hellfire Lord tests these reads with two-hit commitment, not ground bursts under every footstep. Musashi's proposed command briefly creates a counter opportunity; if dodge/counter infrastructure is not ready, prefer a simple tested interrupt over an unverified parry system.

**Persistent result:** sabotaged banners stay gone; optional lamps stay lit; saved clear removes the existing city fire and shows dawn. A rematch is an encounter state, not a replay of the city's destruction.

## P0 prerequisite contract (single source of truth)

| Core | New minimum for first challenge | Explicitly optional | Existing completion/contract retained |
|---|---|---|---|
| `sun_core` | `saber_contract`, `hall_brazier_1` | All shards; other two hearths and training | core flag only after victory |
| `sea_core` | `blackbeard_meet`, `fort_cannon`, `ghost_boat_1..3` | All shards and map chain | `blackbeard_contract` after `sea_core` |
| `winter_core` | `napoleon_meet`, `beacon_1..3` | All shards and gorge seals | `napoleon_contract` after `winter_core` |
| `fire_core` | `musashi_meet`, `kikyo_banner_1..3` | All shards and landmark detours | `musashi_contract` after `fire_core` |

These are deliberate conservative first-playable routes, not the final ceiling of design. The characteristic activity itself proves readiness: no shard pickup is required. Range shorthand `1..3` in this table means all three existing concrete IDs, not a literal save flag. Britain's first hearth is the mainline oath; the two remaining hearths complete an optional round-table restoration. Mainline guidance must not show a mandatory 1/3 counter there.

Implement shared chapter metadata/pure policy functions rather than a new branching tangle in `main.ts`. The same policy must provide mainline steps, optional route descriptors, marker requirements, combat requirements and bridge readiness. Apply metadata after layouts load and before combat construction if avoiding GLB regeneration; update generator definitions as well when feasible so a rebuild cannot resurrect obsolete policy. Preserve existing coordinates/mesh geometry byte-for-byte where possible.

**Important compatibility exception:** older players can possess a core clear or all old prerequisites without the new meet flag. A cleared core is always complete/rematch eligible. Grandfather already-ready legacy saves, or infer introduction eligibility without forcing a return trip. Do not manufacture optional completion flags to simulate the new route. All already acquired discoveries, contracts and keepsakes remain valid.

## Interaction, optionality and combat contracts

### Optional means optional

- Every core must be reachable and completable in a fresh normal save with both optional landmark chains untouched.
- Optional rewards must have a visible, testable result. “+ exploration progress” alone is not enough for a newly advertised interactive feature.
- No sidequest automatically hijacks the guide. Mainline display has one active instruction plus a collapsible summary; optional discoveries appear locally and can be pinned deliberately if implemented.
- No ordinary enemy dots added to the full map. Preserve nearby elite hints without overlap. Don't turn the world into a checklist screen.
- Dialogue budget: one purpose line, one action line, optional conclusion; no more than two short screens at a stop. Let weather, doors, fire, signals and ally behavior carry exposition.

### Lightweight new prop pattern (P1)

Agreed implementation stations, at existing settlement clear sockets: `britain_memorial` (restore names/light); `blacksail_harbor_signal` (safe-harbor signal, separate from fort combat); `winter_shelter_stove` (permanent real heat source); `kyoto_lantern_route` (lit safe-return direction). These override illustrative landmark prop suggestions above for the first playable pass. No imaginary evacuation AI or invented fire solely to extinguish. Each site budget: at most 12 mesh batches and 5,000 triangles, zero new lights/textures/shadow casters; preserve Valley's separate existing budget. Prefer existing geometry/material state to new meshes. State is an idempotent `done` flag using the agreed station IDs above, with pure derived visible state. Do not invent rewards before the consuming combat/traversal system exists.

Range + LOS + active gameplay + not flying/defeated are required. Interaction writes once, applies art/collision immediately, reports save failure, and survives reload. Use remappable F, bilingual prompt and a shape/icon in addition to color. Apply visual changes on state changes, not by recreating meshes each frame. No added dynamic lights, crowds, shadow casters or texture downloads for these props.

### Encounter variation without more enemies

Change roles on existing spawns, retain safe hubs and roof-safe placement. Prefer 2 complementary enemies over 6 identical pursuers. Every attack exposes anticipation → committed action → recovery. A ranged enemy must not track the player invisibly throughout its locked shot; cover must actually block it. No attack or damage while paused, not focused, invisible, dead or free-flying in debug.

Suggested tuning envelope for new attacks (hypotheses, not verified balance): 0.7–1.2 s first-read windup, 0.8–1.5 s recovery, one obvious directional/area cue, no unavoidable overlap by more than two attackers. Use existing normal-shoot/dodge-move vocabulary. Do not add a full elemental reaction, skill tree, inventory rarity or stamina redesign in this pass.

Ally commands are P1: one mechanically distinct active per ally, explicit cooldown and cancel/reset semantics, no new key conflicts, no economy. Contracts and teammate targeting remain separate from enemy identity. If missing binding/UI/animation/AI support cannot be covered, deliver four readable enemy roles before promising four character skill kits.

## Save, interruption and migration rules

- Prefer append-only named `done` flags; existing `WorldProgress` reset clears them. Do not introduce a second localStorage save owner.
- Completed chapter stays completed after death, route departure, rematch reset and reload. First-clear reward remains exactly once.
- Out-of-order exploration is accepted. A discovered optional mechanism can work before meeting its chapter ally unless its physical requirements genuinely need the ally.
- Repeated F, holding F and stale queued inputs cannot duplicate rewards or bypass stages. Opening map/settings, Escape, focus loss and defeat stop gameplay interactions.
- All new art state derives from authoritative progress; save failure is visible and honest. No silent promise of permanent results when storage fails.
- Reset restores the original blocked/unlit state, removes new flags, and preserves language, controls and graphics preferences.

## Eight-hour production sequence and cut line

This is an integration plan, not a mandated wall-clock guarantee. Parallel agents may own isolated modules, but only one integrator owns `main.ts`/shared policies.

1. **First hour:** lock baseline/map invariants, policy/state tests, audit all core and bridge gates; establish matched-scene frame evidence if browser available.
2. **Hours 1–3:** implement distinct mainline/optional metadata and guide; integrate four gate changes; retain Valley semantics; test legacy-ready and cleared saves.
3. **Hours 2–5 in parallel:** bounded enemy-role/telegraph improvement; one persistent visible local outcome per era using existing actors/props; optional ally commands only after role coverage.
4. **Hours 5–6:** fresh-save route walkthroughs without debug flight, screenshot representative before/after, reload/reset/out-of-order checks, fix softlocks and prompt conflicts.
5. **Hours 6–8:** freeze features, full typecheck/test/build, same-scene frame comparison and artifact review. Cut incomplete P1, document gaps, prepare a source-only deliverable. No public push/deploy without the user's separately required approval.

If browser/GPU access is unavailable, continue cloud correctness tests and clearly state interactive feel/FPS were not accepted. Do not claim resolution of the reported 27–40 FPS based on Node benchmarks or build success. Do not revive withdrawn renderer experiments merely because this expansion needs performance headroom.

## Acceptance matrix (must be evidence, not prose alone)

| Test | Required outcome |
|---|---|
| Fresh save, each era | Clear chapter without optional landmark flags; normal walking/gliding/interaction only |
| Black Sail bridge | New route enables both render and collision; traversal to flagship succeeds; no water fall-through |
| Before prerequisites | Core gives meaningful missing action, not raw save-key text; combat cannot start |
| Active boss and rematch | One encounter; defeat/leave resets combat; first-clear side effects never repeat |
| Existing complete save | No new intro gate, preserved contract/weather/keepsake; rematch works |
| Existing partially advanced save | No lost flags; already-earned old route not blocked by newly required introduction |
| Optional before mainline | Visible outcome works; no false chapter clear or mainline hijack |
| Reload/reset | State and collider agree; reset clears progress, preserves preferences |
| Input interruptions | No hidden interaction/attack while map, settings, Escape, focus loss or free flight |
| Ally commands if shipped | Correct ally, target, cooldown, LOS/range; cannot damage allies; interruption covered |
| Layout invariant | Terrain/roads/region offsets/landmark positions unchanged; prop additions do not block original routes |
| Performance | Matched camera/path/settings/device before/after; report median and slow-frame metric, draws/triangles; no new crowd/effect explosion |
| Readability | Chinese and English, remapped controls, no prompt overlap, close-range prop and attack cues distinguishable |

Run the repository-prescribed World test/typecheck/build and final integrated site build; inspect actual test commands in package manifests. Source/unit success is not a browser-playability or GPU certificate. Keep remaining blockers explicit.

## Honest delivery statement template

“Delivered the first playable five-chapter expansion: differentiated critical paths, optional landmark routes, persistent interactions and tested combat changes [list actual implementations only]. Map framework preserved. Verified [exact checks]. Still unverified/deferred: [actual GPU/player-feel/P1 gaps]. No public deployment performed.”

---

## Second design pass — spatial choices, not four buttons and four heals

Added after the initial route handoff. This section **supersedes generic healing rewards and illustrative optional props**. It specifies recommended gameplay for the remaining iteration, not claims that it is already implemented. The implementation agents have the policy/station handoff; the integrator decides which recommendations pass actual play tests.

### Geometry and encounter audit method

Inspected the actual shipped layout marker positions and target meshes' generator metadata. Executed the existing `validation/enemy-live-terrain.fixture.ts`, which loads all five GLBs and installed settlement collision, then queried its actual seeded spawns, ground, terrain-only height, clearance and LOS. All coordinates below are **world X/Y/Z** unless explicitly labeled local. Britain's offset is X−720, Black Sail X+720, Winter Z−720, Kyoto Z+720.

Critical discovery: legacy layout `enemy_*` markers are **not** live defenders. `WorldCombat` builds its population from `makeWildernessSpawns` and `makeMinibossSpawns`. A story that promises guards at those marker positions without reserving real actors is fictitious. Do not add a second duplicate population; relocate/assign roles to existing IDs with a narrow authored-site validator.

### 0. Valley outpost — fight or shut down

**Actual actors:** `wild_48b` at approximately `[-130.42,8.04,-76.63]`; `wild_48` at `[-110.13,8.04,-70.71]`. They are respectively 26 m and 40 m from `relay_b` XZ `[-148,-58]`. Do not blindly raycast from the sky to place the player at that relay: its marker Y is 8 but the highest ground ray at the same XZ sees an outpost roof near 12.9.

**Recommended bounded encounter:** one committed hound charge and one locked-point ranged machine, using those existing IDs. The player may fight through them or approach the existing relay using cover. Activating `relay_b` pacifies this pair as an outcome, represented by a small settled/dormant pose or existing model tint, not disappearance and not death loot. Leave all other wilderness actors unchanged. The optional noncombat method must be physically reachable without a kill prerequisite; otherwise remove the misleading “clear outpost” objective text.

**Persistent consequence:** `relay_b` is enough to derive dormancy after reload; no extra resource flag or population. This gives a tangible network-restoration result beyond a light. Reset restores the pair's normal behavior. Don't let a pacified machine resume attacking after its old respawn timer, or count pacification as a kill/reward exploit.

**Tests:** walk both approach routes with actual Player; show first windup from cover; terminal accepted only within range/LOS; if an attack is already winding up when power returns, it is canceled; reload/reset restores correct encounter state. The route is a recommendation pending this validation, not already a proven stealth encounter.

### 1. Britain — the Oathless Knight's recovery window

**Actual site:** `elite_oath_knight` at `[-610,13.70,0]` on the lake approach. Two ordinary bystanders are currently only 22–27 m away: `wild_56b` at `[-628.60,13.21,11.39]` and `wild_56` at `[-637.39,14.55,-0.64]`. This would become a three-enemy pile-on, not a readable duel, if left unattended.

**Recommended encounter:** the memorial provides an optional clue to this named knight. Entering the duel pocket suppresses or relocates those two ordinary actors away from its 35 m fight footprint, preserving total population and never moving an actor in sight. The knight uses a frontal guarded approach, a long committed sweep and an exposed recovery. Victory can come from flank/evade-and-punish or the new ally guard command; no mandatory parry timing check and no requirement to own an optional skill. A successful recovery hit should be visually distinct from firing into the guard.

**Consequence beyond healing:** first victory records a named trial clear, keeping this short route quiet. Memorial acknowledges the restored oath; an explicit rematch at the memorial can re-enable the knight. This is optional and must not become a new prerequisite for the Sun Core. If explicit elite replay is outside the combat scope, ship the readable duel/clue and honestly defer permanent pacification rather than falsely promising it.

**Tests:** named elite missing because safe placement failed must produce a meaningful unavailable hint, never a broken required objective; ordinary neighbors cannot join the duel from behind; first-clear state and optional replay are independent of chapter-boss rematch; defender cannot block every attack from every angle.

### 2. Black Sail — operate artillery, not an AR wearing a cannon label

**Authored gun:** `fortCraft` creates a +X-facing barrel with center `[-1.4,1,0]` relative to `[cx,y+2.6,cz]`; muzzle recess is `[.106,1,0]`. With `cx=205`, `cz=-172`, fort Y=30 and region X+720, use a muzzle just beyond the recess at **`[925.12,33.6,-172]`**. Existing interaction is `[923.5,32.6,-172]`. Three boat markers are `[1020,3,-132]`, `[1032,3,-196]`, `[1012,3,-258]`, all within the existing 150 m targeting envelope.

**Problem in baseline:** `shoot()` still emits from the player's rifle and uses a saved `fort_cannon` flag plus an XZ-only 8 m check. This is not genuine mounted artillery, and XZ-only range can permit firing from below the deck.

**Recommended bounded control:** F at the gun readies/enters the mount; existing fire and aim bindings remain valid; F again or leaving its short 3D radius exits. Escape/map/settings/focus loss/death also exits and clears held fire. Do not teleport the player or forcibly snap the camera. Each valid cannon shot has a 1.3 s active-game-time reload, one bounded muzzle/tracer/impact cue and a small local recoil signal, not large smoke or camera shake. Invalid target/out-of-arc feedback is concise, not repeated every frame. The cannon must not simultaneously fire an AR shot.

Use camera aim to select an actual boat surface, then validate the ray from the gun muzzle to that surface. Exclude the target's own collider from wall tests but never terrain/parapet. Allow the broad traverse needed for the three targets (roughly ±50° in XZ around +X); do not pretend the static batched barrel physically swivels. If rigging a separate barrel is not justified, describe this as operating the battery rather than showing a blatantly mismatched moving gun. No ballistic/gravity simulation is necessary for the first pass; deterministic visible cannon shots with actual gun origin are already a substantial improvement.

**Authored approach pair:** `wild_59` `[857.09,17.92,-124.49]`, `wild_59b` `[865.97,20.69,-127.98]`, around 28–30 m from the fort road endpoint `[846,24.42,-150]`. Assign rush + aimed-shot roles, but validate ramp/slope access before claiming they defend the battery. They must not shoot through the raised wall at a mounted player.

**Optional consequence:** `blacksail_harbor_signal` provides a specific next missing treasure-map clue (`map_piece_1`, then 2/3 as appropriate, then `shard_treasure`). This is navigation information, not healing or a compulsory bridge token. Never auto-pin it over the main quest; require a deliberate optional follow action or present the landmark direction in the short response. Opened treasure remains the physical payoff.

**Tests:** below-deck cannot mount; gun ray clears parapet to all three boats; holding fire respects reload; changing modes cannot duplicate a shot; reloading while paused does not finish; sink state survives exit/reload; F still works after `fort_cannon` is already done; all-sunk gun has sensible completion/repractice behavior without duplicate quest rewards.

### 3. Winter — prepare for a dangerous road or follow the warm route

**Actual useful geography:** the new settlement is centered `[8,−604]` XZ, on the eastern travel corridor, not beside the western beacon triangle. The existing direct-road encounter is `wild_14` `[42.88,7.21,−673.85]`, `elite_frost_officer` `[40,8.94,−690]`, `wild_14b` `[22.75,9.60,−688.68]`. These actors already make the road costly to stop on. Keep this trio bounded rather than adding a squad; assign the ordinary pair different roles and stagger their windups.

The western beacon XZ positions are `[-286,−644]`, `[-168,−686]`, `[-262,−772]`. Their separations are roughly 125 m, 127 m and 130 m. Each is a real 14 m heat radius after activation. Camp/tent heat lies near `[-176,−588]`; an existing northern ember is near `[−14,−847]`. The roads and hill slopes, not a straight-line map distance, decide traversal time.

**Mechanic:** `winter_shelter_stove` gives actual warmth restoration and a **30-second warmth-retention reserve after leaving this stove**. Refreshing at the stove is allowed; leaving the region, reset and defeat clear transient reserve; timers advance only in active gameplay. It is not a stackable inventory item, not HP healing and not permanent immunity. The HUD should show the reserve while active so players understand the consequence.

The player can spend preparation time to take/contest the more direct officer road, or follow the western restored beacons and allow heat recovery. Mainline beacon completion remains the signal network objective; choice concerns travel and combat approach, not pretending those three buttons alone make survival interesting. Do not add a second forced visit to the stove. Existing warmth lasts 50 s at full charge (2/s drain); sprint is 9 m/s. A straight 300 m run is therefore survivable, but a 20 s fight eats the margin. **Do not increase cold drain merely to manufacture urgency.** Tune the encounter and explain the reserve first.

**Tests:** frozen player can recover at stove; reserve does not make a cold region permanently immune after reload; no reserve stacking by rapid F; paused time does not consume it; completed winter core still disables the global cold mechanic regardless of reserve; alternative normal-walk route survives without stove.

### 4. Kyoto — shoot the command flags from a quiet slope, or enter the camp

**Verified grounded quiet site:** **`[-224,11.56,840]`**. Terrain-only height 11.556 and full collision height 11.558 agree; standing clearance passes. From a 1.4 m eye, all three existing flag marker centers have unobstructed rays (ignoring only their target colliders) at approximately **66, 99 and 111 m**. They fit the existing 150 m rifle range.

The living hub is centered `[-172,812]` XZ with entry `[-172,835.5]`. A 0.25 m-step grounded combat-terrain walk passes from the entry through `[-190,835.5]` → `[-205,838]` → `[-224,840]`. An alternative via `[-190,850]` → `[-218,850]` also passes. This proves grounded collision continuity, **not yet full Player traversal or browser playability**; an actual Player path test remains required.

**Rejected candidate:** `[-218,10.52,825]` initially passed standing/LOS tests but is on a prop roughly 4 m above terrain. The straight approach hits an obstruction. Do not use it as the promised quiet destination. This is why standing clearance alone is not a route proof.

**Recommended authored defenders:** reserve two existing Kyoto ordinary actors at candidate XZ `[-202,882]` and `[-206,908]` using ground, normal, capsule clearance, no roof, no water, no settlement and route checks. These are candidates until combat agent validates them. Assign thrust ashigaru + double-slash samurai. The first is about 47 m from the quiet slope, outside the current 35 m leash; the second is farther. The direct camp vantage `[-216,13.95,888]` is already covered by existing Player route tests and gives all three flag shots within 82 m, but falls inside the defenders' encounter.

**Real choice:** the lantern gives the clue “leave the inn's south entrance, follow the low slope west; the three banners are visible without entering the camp.” The player may take deliberate ranged shots without fighting, or enter directly for close combat and the optional camp shard. Shooting a banner must not globally alert defenders outside range/LOS; otherwise the advertised quiet option is fake. The enemies need not be killed for mainline progress. No new stealth meter, crouch system, alarm simulation or rooftop route is required.

**Narrow spawn exception:** hostile Akechi camp may use an authored reservation policy, but safe settlements, NPC homes and other quest-safe hubs retain their exclusion. Never globally loosen `safeSpawn`. Two moved IDs replace two existing actors, not increase the roster. Validate that their 35 m leashes cannot enter the living hub or cover the quiet slope.

**Tests:** actual Player reaches slope from settlement without flight; all three shot paths hit target geometry from player muzzle as well as eye; defenders remain unaggroed on quiet route; direct route demonstrates both roles; actual actor ground/clearance tests pass; one actor's death does not respawn another copy; total population unchanged.

### Cross-cutting second-pass cut line

Priority order: (1) real artillery; (2) Kyoto validated quiet/direct choice; (3) Winter meaningful warmth reserve; (4) British readable optional duel; (5) Valley shutdown outcome. These improve the play experience more than a larger artifact list. If time runs short, retain coherent tested routes and report which of these mechanics were actually delivered. No new mesh budget is needed for most of this work; the hard work is collision, event state, input interruption and readable consequences.

Optional stations now have distinct purposes: **combat knowledge/trial**, **treasure navigation**, **thermal preparation**, **alternative route discovery**. None should grant the same generic 25 HP. Art can remain small and shared in architecture while the verbs and outcomes differ.

### Independent route validation added (2026-10-30, 04:37 UTC)

`world/validation/era-route-playability.test.ts`: **11/11 passed** using real `Player.step`, all five GLB collision trees, all installed settlements and added era/Valley story colliders. Runtime typecheck also passed at this checkpoint. This is Node physics/source validation, not browser input, visuals, feel or FPS acceptance.

Verified normal-route coverage: Kyoto inn-to-quiet-slope without jumping/flying and actual flag mesh hit rays at eye/rifle-height origins; fort-road-to-battery traversal, mounting from reached position, true authored gun-muzzle LOS/arc to all three actual boat meshes; shard-free physical bridge across all three ships to Sea Core, plus negative unearned-bridge fall test; Britain's lake pact, first hearth and Camlann core; Nassau meet/contract; Winter tent, three beacons and Red Square; Kyoto bridge ally and Honnoji core; all four seam gates physically block closed state and admit normal movement after summon stability; every mainline flag maps to a concrete marker with the correct region offset.

**Historical controller polish issue (resolved by the apron below):** a direct run into Honnoji east-bridge lip can stop near `[-47.15,4.05,765]` with `onGround=false` in the full merged BVH, preventing a jump initiated after pressing against the lip. An ordinary deliberate jump from the approach reaches the courtyard reliably, and the positive route test records that jump explicitly. This proves reachable progression, not a smooth no-jump route. Root was notified; no runtime or map edit was made by the design/test agent. If fixed, add a no-prejump regression rather than hiding the issue in a longer simulated timeout.


### Bridge-lip repair accepted (2026-10-30, 04:45 UTC)

Ownership of `world/src/traversalRepairs.ts` was delegated for the narrow geometry
fix. The initial ramp assumed a 4.425 m bridge top; decoded collision proves 4.6019 m.
Corrected the apron to a 4.63 m top reached at X−47.05 before the capsule contacts
the old X−47.5 edge, with a short overlap and road-side slope ending X−44.75.
One visible mesh / one material / 44 triangles, no new light/texture/shadow caster;
original terrain, bridge, rails, gate, world layout and global Player physics remain.

Final independent route suite: **12/12 PASS**, now including three lateral paths in
both directions at walking and sprint speeds without jump input, plus original rail
and closed temple-wall blocking. The mainline Honnoji test no longer uses a pre-jump.
Runtime typecheck and whitespace check pass. Offline actual-asset before/after PNGs
were rendered and inspected under `world/validation/traversal-review/`; the apron
visibly meets road and bridge without a floating gap. This closes the collision issue
within Node simulation, not browser feel/FPS acceptance.
