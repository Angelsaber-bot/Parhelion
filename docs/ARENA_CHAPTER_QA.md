# Chapter Arena / World refinement — independent QA

Baseline: `a3096254ef0fff455a29932bc5fef2e57fa49f44`.

**Final consolidated status:** Arena **275/275** and World **388/388** tests pass; both typechecks and production builds pass. Final art, input/animation, reset, minimap, pillar-barrier alignment and combined local routing checks are consolidated below. Earlier R2/R3 acceptance is preserved separately at `docs/chapter-qa/checkpoint-r2-r3-qa.md`, not presented as final.

This report records cloud checks only. GitHub publication is established separately by repository commit history; it does not establish desktop synchronization, public deployment, browser validation or actual GPU performance.

## Results

| Check | Current result | Evidence under `docs/chapter-qa/` |
|---|---|---|
| Arena complete suite, including spawn immunity | **275/275 passed**, 19 files | `../spawn-protection/arena-full-final.log` |
| Arena client + Worker TypeScript | **passed** | `../spawn-protection/arena-build-final.log` |
| Arena production build | **passed**, refreshed final previews + immunity HUD included | `../spawn-protection/arena-build-final.log` |
| World complete suite / types / build | **388/388 passed; types/build passed** | `../publication-20261028/world-{tests,types,build}.log` |
| Independent full-map preservation | **36 scenarios exactly match committed baseline** | `full-map-independent.log` |
| New GLBs, authoritative proxy/UV structure | **1,336 checks passed** | `glb-final.log` |
| Independent GLB image/accessor/UV/resource audit | **all 3 + unchanged Sakura passed** | `material-assets-consolidated-final.json` |
| Protected/retained source hashes | **72/72 unchanged** | `protected-consolidated-final.json` |
| Relative source asset references | **33/33 present** | `protected-consolidated-final.json` |
| Arena static routing / real local HTTP | **25 references + 27 HTTP files pass** | `build-routing-arena-final-world-checkpoint.json`, `http-routing-arena-final-world-checkpoint.json` (World rows remain checkpoint) |
| Final combined World/Arena routing | **35/35 static references; 48/48 HTTP files pass** | `build-routing-consolidated-final.json`, `http-routing-consolidated-final.json` |
| Site localization non-destructive patch tests | **2/2 passed** | `site-localization-sakura-final.log` |

The 275 Arena and 388 World totals already include the independent tests; do not add focused counts again. The earlier 244-test Arena checkpoint remains at `arena-sakura-final-*`; the later 275-test immunity run supersedes it. The final World run fingerprinted 247 source/tool/test/asset files with no changes during the run; subsequent README and offline Blender evidence-helper updates (no runtime/asset/test changes) are separately recorded in `world-final-input-stability.json`. Final Arena source GLB, built GLB and preview provenance hashes agree in `final-arena-artifact-identity.json`. Initial new-test TypeScript `unknown` bitmap errors were corrected with a test-only type annotation; preserved in `arena-sakura-initial-types.log`.

## Active lineup and real playability

Exactly five main chapter entries, in order: **ASTER observatory, Camlann ruins, Blackflag ship, Frostcourt snowy courtyard, Sakura**. `zenith` and `neon` remain available by legacy ID; original harbor source is retained. `arena/`, `arena-maps/aster/`, `arena-maps/sakura/` and `arena-maps/neon/` match the committed baseline byte-for-byte.

The all-map suite uses actual shared movement/rules, not only JSON inspection:

- All spawn/cover/objective anchors grounded and collision-clear; opposing spawns screened.
- Authored routes traversed in **both directions**, including raised tiers and ramps.
- Navigation connects every spawn/cover/objective anchor.
- Actual four-bot matches produce kills on every registered map.
- Independent offline sessions select all five maps, retain map on rematch and clear their timers.
- For each active map, direct offline `Match` and multiplayer `RoomCore` produce equal snapshots for **600 ticks** of movement/fire/jump/crouch/weapon inputs.
- Chinese/English names and descriptions pass; no raw chapter labels remain.

Tests: `arena-game/test/maps.test.ts`, `chapter-qa.test.ts`, `chapter-network-qa.test.ts`.

### Actual multiplayer defect found and corrected

Local real Colyseus sockets reproduced both explicit `bots:false` and `bots:true` clients failing to pair. Installed Colyseus 0.18 `setMetadata({layout,map})` replaced the `bots` matchmaking metadata. Failure evidence is preserved in `arena-bot-filter-initial.log` and `arena-network-explicit-false-initial.log`.

The authorized bounded fix retains `bots: core.fillBots` in server metadata and normalizes omitted official online session options to boolean false. Tests verify true/true pairing, false/false pairing, default clients excluded from bot-filled rooms, all five map IDs, welcome/rules versions and authoritative input over actual Colyseus sockets. All five maps also pass a real local Worker-style JSON WebSocket transport using production `RoomCore`.

These are **local network tests**, not a hosted Cloudflare deployment or hosted-worker execution claim. Offline rules and Worker room-key semantics were not changed.

## Arena spawn / respawn protection

The final suite includes 2.5 s / 150 authoritative ticks of first-spawn, mid-match join, live-round start and actual respawn protection. Guns, melee, bots and deployed-shield damage obey the current server tick; firing does not cancel immunity. Chinese/English HUD and real Colyseus / Worker-format local JSON WebSocket lifecycle tests pass. See [full implementation, boundary coverage and limits](ARENA_SPAWN_PROTECTION.md). Rules v3 is preserved with an optional additive snapshot field. Public play requires deploying the updated Worker as well as the client; these local socket checks are not a hosted Cloudflare verification.

## Final Arena art and materials

All compared captures import the **actual exported GLBs**, use the same neutral CPU Cycles settings, and place lane cameras **1.7 m above authored ground**. They do not compare flat new-map previews to a richer old browser screenshot.

| Frozen asset | Triangles | GLB bytes | Material primitives | Embedded image bytes | Collision nodes |
|---|---:|---:|---:|---:|---:|
| Blackflag | 41,612 | 3,804,560 | 94 | 105,430 | 26 |
| Frostcourt | 34,562 | 2,957,840 | 79 | 160,282 | 29 |
| Camlann | 41,015 | 4,735,596 | 195 | 886,333 | 66 |
| Unchanged Sakura benchmark | 20,810 | 1,627,752 | 119 | 0 | — |

Final SHA-256:

- Blackflag: `755887aa8b05cc41681b6bbe0c722d680934f65b36ea5b58c52df364c3fe6572`
- Frostcourt: `b53e5944613dde564c0200fce7e5acc6ab2947b47ba1004ee45524a0cdac69a9`
- Camlann: `dc539d1b11c86cf32baad21fa5c0c0eb0d59171e57d0d998442a504574f38626`
- Sakura: `83f504ce7db5b0242979b2bb76a817ef7d39e22479b1c57344fd7be9a7f52ee3`

Final independently inspected neutral captures:

- `renders-art1/blackflag-{overview,lane}.png`: crafted hull/stern, heraldic curved sail/rigging, wood/brass surfaces, shaped cannons, draped cargo cover.
- `renders-art2-frostcourt/frostcourt-{overview,lane}.png`: layered frozen fountain, pediment/windows/doors, framed arcade, wagons and restrained warm accents.
- `renders-art3/camlann-{overview,lane,hero,sword}.png`: uneven masonry, continuous landscape, feathered ground trail, broken substantial thatch, blue/gold hall banner and clear sword-in-stone identity.
- `sakura-neutral/sakura-{overview,lane}.png`: unchanged bridge/water/koi/lantern/tree/shrine composition.

Root reviewed and accepted these final revisions at the comparative art gate. Camlann intentionally remains more subdued and open than Sakura; this is **not** a claim of photorealism, perfect aesthetic equivalence or user preference certainty.

Separate archived `runtime-informed-art1/`, `runtime-informed-art2-frostcourt/`, `runtime-informed-art3/` and `sakura-runtime-informed/` captures (not committed in the trimmed GitHub publication) approximate source atmosphere sun/ambient/exposure. They **do not exactly reproduce** Three PBR/cel hooks, fog, sky, particles, postprocessing or browser shadows. Every final manifest records imported SHA and `sourceStillMatches:true`.

Rejected/intermediate images from `renders-initial/`, `renders-r2/`, `renders-r3/`, and earlier art folders are not part of the GitHub publication. Camlann art1 checkerboard landscape/cutoffs and art2 raised zigzag path shadows were found by independent visual review and corrected before art3. One generic Sakura test camera was inside a wall; `sakura-lane-invalid-camera.png` is explicitly excluded from acceptance, not treated as an asset defect.

### Shader and material checks

`chapter-material-qa.test.ts`: **10/10 passed**. These tests prove:

- Original `toCel` and its fully expanded actual Three toon shaders match committed baseline SHA; protected/legacy maps are excluded from the new PBR path.
- New crafted conversion preserves base/normal/AO/roughness/metalness/emissive/alpha/bump/displacement texture identity, UV transforms/channels, colorspace, scalar values and ownership.
- Actual Three `ShaderLib.standard` hook inserts once, and every installed shader include resolves without missing chunks.
- Actual `GLTFLoader` parses each final map and the converted material retains its real parsed channels and UV attributes. Only browser image decode is substituted with a header-sized bitmap in this Node test; actual embedded PNG decoding is separately checked with PIL.

The independent binary audit checks all embedded buffer/image ranges, valid index bounds, finite matching UVs, PNG decode and resource limits. Static resource estimates are approximately **13 MiB / 1.5 MiB / 7 MiB** RGBA+mip texture memory for ship/courtyard/ruins. These and primitive counts are **not measured GPU FPS**. Geometry+JSON remains below 4,000,000 bytes and embedded images below 1,000,000 per new map; total Camlann GLB is transparently larger because it includes textures.

No native GLSL compiler or GLES tooling is installed. Include expansion/channel checks are **not GPU shader compilation**.

## World checks

Original completed work is independently covered by:

- `world/validation/mounted-combat-qa.test.ts`: real WorldCombat facade removes exactly 16 boss HP at contact, never in anticipation; immediate repeat blocked by actual ally cooldown, LOS revalidated. Fixtures supply animation/DOM. A discovered rear/flank footprint hole was corrected with full oriented horse/rider and swept-turn collision; rear-wall, side-turn and rider-height regressions pass.
- Actual-asset Arthur/Napoleon pose and event tests; armor/civilian lowered walking arms, authored attack quaternion/contact, horse hoof motion and saddle/seat relationship. Sampled CPU-skinned images were independently inspected and retained in the expanded delivery preview archive; GitHub retains their generation scripts and numeric evidence, not the large individual PNGs.
- Five World baseline GLBs independently checked against committed bytes in `world-baseline-verification.json`. Final micro-detail whitelist preserves all layouts/materials/unrelated decoded nodes/accessors/transforms and exact prepared chunk/outline counts, changing only ten intended art batches. All five before/after pairs in `docs/world-micro-detail/` inspected.
- New minimap: no ordinary/live enemy colored dots, one player/active target, at most three monochrome travel/entrance landmarks, circular target clamping. Independent `full-map-qa.test.ts` runs **36 exact baseline command comparisons** across both languages, square/wide/tall grids with shifted origins, absent/arrived/distant targets, completion states and live enemies; full map unchanged.
- Sampled actual protagonist carry/aim/stow and Musashi opposite gait/attack images were independently inspected; they show lowered travel carry and distinct combat poses. All are included in the final 388-test aggregate. Glider canopy hides in **0.342–0.367 s**, versus roughly **1.05–1.067 s** before; 30/60/120 Hz rapid reversals, armed/unarmed stow, ADS/fire interruption, hand contact and finite transforms pass. Player lowered carry clears actual clothing/leg triangles in 48 sampled walk/run poses. Musashi original attack contacts/damage remain unchanged and ten repeated locomotion/attack cycles show no drift. These are CPU/runtime correctness measurements, not browser FPS.

### Fresh-start reset and requested pillar-barrier checks

Independent reset/route rerun: **24/24 passed**, `reset-route-independent.log`. Actual decoded collision walking reaches camp → HQ terminal → armory → range. HQ and armory have no shooting prerequisite; the objective order acquires the weapon before targets. Production interaction clears held trigger on acquisition; unarmed production shooting yields no projectile/damage/objective/save changes and ADS is denied. Empty v2 state survives reload even when old v1 progress is reintroduced. Settings, locale, graphics/HUD, appearance and unrelated keys remain byte-identical. Tests use memory storage; no real user save was erased.

Independent `seam-qa.test.ts` passes four tests on the final barrier: real exported visible and collision surfaces meet at all four original pylon planes, sampled at five tangent offsets and three heights each. The worker suite additionally proves exact visible/collision triangle agreement, no end-run route at boundary joins, 240 radius-aware jump/glide crossing cases, updraft behavior, and unlock/reset/camp-placement parity. The old remote wall is removed. The final full suite includes these tests. Debug freeflight intentionally remains a noclip exception, not a newly imposed progression lock. A narrowly reviewed exception allows only four named gate collider streams plus four matching visible dynamic fields; all unrelated baseline assertions remain exact. The cost is +240 art triangles, +4 prepared dynamic meshes and no additional outlines. This collision change is explicitly requested later work, **not** an accidental exception silently added to the original micro-detail pass.

Final barrier evidence `docs/seam-barrier/alignment-board.jpg` (all four eye views plus cyan-new/red-removed-old overhead diagnostics) was independently inspected. Its decoded manifest exactly matches final Alpha GLB SHA-256 `1fb8d6823f2afcbdd11586d92013df4250243505a956c49db98fb14624f2e850`. The diagnostic lines are annotations, not new game geometry; additive field rendering is explicitly approximate offline.

The pre-freeze World checkpoint was 364/366 with exactly two historical-baseline failures caused by the deliberately realigned gates. Its log is preserved at `world-additions-checkpoint-tests.log`; both failures are resolved by the bounded, behavior-tested exceptions above, not by replacing historical expected hashes.

Final source/document whitespace hygiene (`git diff --check`, excluding captured `.log`/`.tap` stdout) passed. Raw test logs preserve framework banner spacing.

## Verification boundaries

Normal Chromium launch did not reach a page. An initial user-data-directory error was followed by one bounded retry with an explicit writable profile, which exited 134:

```text
FATAL:chrome/browser/process_singleton_posix.cc:297
Check failed: . socket() failed: Operation not permitted (1)
```

No `--no-sandbox`, certificate bypass or security-disabling flags were used. Existing optional scripts with such flags were not run. **Browser/WebGL interaction, continuous motion review and real GPU FPS remain unverified.** Normal local TCP socket tests succeeded; browser denial was not incorrectly generalized to all networking.

The current unified production homepage/build source is absent from Git; `site/README.md` prohibits replacing it with the partial snapshot. An older unified assembler was inspected read-only for `/arena/` and `/world/` mount contracts, not treated as current production. Both game outputs can be validated independently under one local origin; that does **not** rebuild or verify the current production homepage.

## Reproduction

```sh
cd arena-game && npm test && npm run typecheck && npm run build
cd ../world && npm test && npm run typecheck && npm run build
cd ..
python3 docs/chapter-qa/verify_protected_assets.py
python3 docs/chapter-qa/verify_glb_materials.py
python3 docs/chapter-qa/verify_build_artifacts.py
python3 docs/chapter-qa/verify_http_artifacts.py
```

Render helper: `docs/chapter-qa/render_arena_assets.py`; neutral/informed configuration and limitations are recorded per capture. No installation, publication, push or deployment is part of these checks.

## GitHub evidence scope

The repository includes runtime/source/assets/tests, authoritative map-menu preview provenance, final neutral chapter comparisons, compact motion/minimap/barrier/world-detail boards and machine-readable reports. Larger individual animation stills/GIFs and rejected/intermediate captures are intentionally omitted. References to earlier captures describe historical review, not files required to build or run the game. The expanded delivery previews remain separate; no baseline tracked evidence is removed.
