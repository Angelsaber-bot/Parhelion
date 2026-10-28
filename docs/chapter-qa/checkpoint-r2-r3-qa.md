# Chapter arena / World refinement — independent QA

Baseline: `a3096254ef0fff455a29932bc5fef2e57fa49f44`.
No push, deployment, production edits, desktop access, browser security bypass, or actual-GPU-performance claims.

## Acceptance checklist

- [x] Exactly five active chapter arenas: preserve observatory and Sakura; add pirate ship, snowy courtyard, and Arthur ruins. Legacy harbor source retained.
- [x] `arena/`, `arena-maps/aster/`, `arena-maps/sakura/` and retained `arena-maps/neon/` match baseline SHA-256 (72 files).
- [x] All active spawn/cover/objective anchors are grounded, collision-clear and navigable; opposing spawns are screened.
- [x] Authored routes walk in both directions using actual movement simulation; raised tiers are reached via ramps.
- [x] Collision/export alignment; real sight-blocking cover; bounded GLB budgets; all runtime asset paths present.
- [x] Offline matches and shared multiplayer map validation agree; actual network transport reported separately when unavailable.
- [x] Mounted Napoleon charge moves in a bounded collision-safe corridor, damages actual enemies once, and respects cooldown/cancellation.
- [x] Arthur walk keeps lowered natural arms; authored attack clip/contact and subsequent recovery retained.
- [x] World changes remain modest, preserve geometry/collision/quest contracts and retain baked/runtime parity.
- [x] Chinese/English chapter labels and shared locale contract pass.
- [x] World and Arena final test/typecheck/build pass; relative-base artifact routing verified.

## Verification limits identified before implementation

Browser launch did not reach a page. A normal headless launch first failed to create its headless user-data directory; one bounded retry with an explicit writable workspace profile failed:

```text
FATAL:chrome/browser/process_singleton_posix.cc:297
Check failed: . socket() failed: Operation not permitted (1)
```

The retry exited 134. No `--no-sandbox`, certificate bypass, or security-disabling flags were used. Existing optional repository browser scripts use prohibited launch flags and were not run. No further browser retries were made after the confirmed socket restriction. Offline GLB renders are asset/layout inspection, **not** proof of browser gameplay, shader parity, or GPU FPS.

The actual current unified homepage/build source is not in this Git checkout (`site/README.md` explicitly prohibits replacing it with the partial snapshot). An older `/workspace/scratch/218192752ff4/parhelion-unified` build contract was inspected read-only: it assembles the two game outputs beneath `/arena/` and `/world/`, with an independent source homepage. This old homepage is not treated as current production. Final source builds and asset routing are separable checks; unified current-production homepage/browser acceptance remains unverified.

## Reproducible evidence

- `docs/chapter-qa/protected-baseline.json`: initial SHA-256 baseline.
- `python3 docs/chapter-qa/verify_protected_assets.py`: read-only protected-file and source-asset validation.

Final results below are from the frozen R2 ship / R2 courtyard / R3 ruins and final servant/World modules.

## Issues found and resolution checks

1. **Incomplete chapter-menu English strings (resolved).** The independent test initially failed on `CAM LANN 誓约荒原`. After catalog translations were added, all 13 independent chapter tests passed, including English names/blurbs for all five active chapters.
2. **Horse rear/flank collision was not covered by forward rays (resolved).** A standing mounted footprint at the origin facing +Z incorrectly accepted a wall at Z=-0.8 despite a 1.35m half-length. The implementation now checks an oriented full horse/rider body and intermediate turn orientations. Independent regressions verify rear-wall rejection, side-wall rotation blockage and rider-height overhead blockage, in addition to real HP/contact tests.
3. **Initial arena art was not accepted.** Eye-level and overview GLB renders showed black coplanar cargo trims and Camlann path joins, with overly boxy ship/courtyard/ruins art. Initial evidence is preserved in `docs/chapter-qa/renders-initial/`; R2 ship/courtyard and R3 ruins were re-rendered and reviewed at eye level and overhead. The root accepted the result as a stylized low-poly Alpha candidate, not high-detail realism.

## Independent functional evidence so far

- `arena-game/test/chapter-qa.test.ts`: **13/13 pass**. Exactly five active chapter menu IDs in chapter order; full English translations; every actual offline session chooses the same map and cleans its timer; rematch retains map; each of five direct offline Matches matches the shared multiplayer `RoomCore` snapshot-for-snapshot for 600 ticks with movement/fire/jump/crouch/weapon inputs. This is in-process protocol/rules parity, not a hosted networking claim.
- `world/validation/mounted-combat-qa.test.ts`: **5/5 pass**. Real `WorldCombat` facade and state lose exactly 16 boss HP at mounted contact (none during anticipation); actual ally cooldown blocks immediate duplicate damage; real LOS revalidation prevents HP loss; rear footprint, lateral turning and rider-height collision checks pass. Animation clips and DOM are fixtures here; actual asset poses are covered separately by the servant worker's tests/previews and were independently inspected.
- `docs/chapter-qa/world-baseline-verification.json`: independently verifies the five World pre-edit GLB hashes against the actual committed `a309625` bytes, rather than trusting regenerated expected output.
- `docs/chapter-qa/world-polish-independent.log`: initial five-region whitelist check passed; final checks will rerun after the worker preserves quantization transforms and actual chunk budgets.

## Final results — 2026-10-28

| Check | Result | Evidence |
|---|---:|---|
| World complete test suite | **328/328 passed** | `docs/chapter-qa/world-full-final.log` |
| World TypeScript / production build | **passed / passed** | `world-typecheck-final.log`, `world-build-final.log` |
| Arena complete test suite | **234/234 passed**, 16 files | `docs/chapter-qa/arena-full-final.log` |
| Arena + Worker TypeScript / production build | **passed / passed** | `arena-typecheck-final.log`, `arena-build-final.log` |
| Homepage localization non-destructive patch tests | **2/2 passed** | `site-localization-final.log` |
| Protected/retained file hashes | **72/72 unchanged** | `protected-final.json` |
| Source asset references | **33/33 present** | `protected-final.json` |
| Built relative-base asset references | **35/35 present** | `build-routing-final.json` |
| Actual local one-origin HTTP mounts | **48/48 files available**: `/arena/` 27, `/world/` 21 | `http-routing-final.json` |
| New GLB validation | **638 checks, zero failures** | per-map `validation/glb_report.json` |
| Whitespace / patch hygiene | **`git diff --check` passed** | final command run |

The 234 and 328 totals already include the independent tests; do not add those counts again.

### Actual multiplayer correction discovered by QA

Real Colyseus sockets uncovered an existing incompatibility with the installed 0.18 metadata behavior: `setMetadata({layout,map})` replaced the `bots` matchmaking filter. Both explicit `bots:false` and `bots:true` clients created separate rooms instead of pairing. The initial failures are retained in `arena-bot-filter-initial.log`.

With root authorization, the narrow correction adds `bots: core.fillBots` to server metadata and normalizes the official online session's omitted value to boolean `false`. No gameplay numbers, offline rules or Worker room-key semantics changed. Regression verification passes for:

- both false clients sharing their chapter room;
- both true clients sharing their chapter room;
- an official default client staying out of an existing bot-filled room;
- a second false client joining the default client's room;
- all five chapter IDs, welcome versions and authoritative inputs over actual Colyseus sockets;
- all five chapter IDs and inputs over actual local Worker-style JSON WebSocket transport using the production `RoomCore`.

This is local protocol/transport evidence, not a deployment or a claim about hosted Cloudflare execution.

### Final playable map and asset evidence

The active order is `aster`, `camlann`, `blackflag`, `frostcourt`, `sakura`. `zenith` and `neon` remain available for legacy IDs/deep links without replacing the five primary chapter cards. ASTER base/overlay and Sakura assets are unchanged; legacy Neon source is retained byte-for-byte.

The existing all-map suite passed grounding/collision-clear anchors, hidden opposing spawns, authored routes traversed in both directions by actual player movement, nav connectivity from spawn to every spawn/cover/objective, and four-bot matches producing kills on every registered map.

| Final asset | Visual triangles | GLB bytes | Collision nodes |
|---|---:|---:|---:|
| Blackflag ship | 15,078 | 1,038,516 | 26 |
| Frostcourt | 12,846 | 850,664 | 29 |
| Camlann ruins | 35,389 | 2,743,156 | 66 |

Final independently inspected images:

- `docs/chapter-qa/renders-r2/blackflag-{overview,lane}.png`
- `docs/chapter-qa/renders-r2/frostcourt-{overview,lane}.png`
- `docs/chapter-qa/renders-r3/camlann-{overview,lane}.png`

Their render manifests contain the exact final GLB SHA-256. The menu thumbnails and per-map JPEGs were produced from these revisions; provenance is in `arena-maps/chapter-preview-sources.json`. Initial failed/rejected previews remain separate in `renders-initial/`.

Arthur armor/civilian walking and attack stills plus Napoleon mounted contact were independently inspected in `docs/servant-motion/`. Actual-asset tests cover sustained walk arm directions and subtle swing, authored attack quaternion preservation, animated horse hoof movement and invariant saddle/seat relative position. These are stronger than source assertions but do not substitute for continuous browser playback review.

All five World before/after comparisons in `docs/world-micro-detail/` were independently inspected. The committed-baseline whitelist locks all layouts/materials/unrelated decoded nodes/accessors/transforms and exact prepared mesh/outline chunk counts, while permitting only the ten specified visual batches. Changes remain micro-details, not a scene rewrite.

## Remaining acceptance boundaries

- **Browser/WebGL interaction and continuous animation review remain unverified** because normal sandboxed Chromium failed before page creation with the exact socket error above. No bypass was attempted.
- **Actual GPU FPS and cross-device performance were not measured.** Cycles renders and CPU navigation timings are not GPU measurements.
- **The current complete unified production homepage/build source is absent.** Both final game builds were mounted and verified over real local HTTP under their intended one-origin paths, and homepage patch safety tests passed; this does not claim the current production homepage was rebuilt or visually verified.
- **No hosted Worker, publication, push, commit, or deployment was performed by QA.**
