# Admitted dodge support audit — 2026-10-31

> Historical checkpoint: the narrow evade-only eligibility described below was superseded by approved general physical support continuity in `4f56d26`. The same bounded geometric helper remains, but support is no longer exclusive to an active evade. Original evidence is retained; WorldActions/evade clocks remain unchanged. See [General ground continuity review](GENERAL_GROUND_CONTINUITY_REVIEW_20261031.md) for the current production contract and subsequent no-wrapper verification.

## Reproduced production behavior

`validation/combat-review/run-defense-input.ts` runs real main, ordinary configured keyboard dodge, real Player/BVH and actual Warden contacts. Entry teleport and typed encounter admission are explicit setup; grounding is settled by physics. No HP, energy, grounded, hostile position or attack-clock assignments. Reading the remaining tell is a deterministic timing oracle for a mechanics probe, **not human reaction or balanced-playthrough evidence**.

- Backward dodge 100 ms before contact: player remains inside all three accepted footprints, invulnerability is active and HP stays100.
- Backward dodge 200 ms early: original invulnerability correctly expires, HP100→82→66→50.
- Side dodge 100 ms before contact across the actual alpha slope: accepted while grounded, but later attempts truncate to approximately154 mm and HP ends66.
- A following Saber independently lands four genuine14damage contacts on this field, with no observed stuck timer in this short probe. This does not prove all companion terrain paths.

Exact failing stance: `(-54.3037204157,3.9185068459,-105.2040747411)`, facing the Warden at `(-53.8739507009,3.7102091535,-102.1539371039)`. The first120Hz side-dodge step leaves feet3.7677mm above the actual surface, normalY`.994461` (about6°). `Player.collide` reports no contact for that tiny gap; `WorldActions.update` then cancels the entire admitted `.24s` evade while ordinary gameplay remains enabled. No invisible wall or environmental collider defect was found.

## Controls

The historical checkpoint3d66e31 `probe-evade-support.ts` pairs production terrain with explicitly synthetic flat/ledge controls (one temporary collider at height20). It uses actual main keyboard/physics, never forced grounding.

| Case | Baseline | Isolated candidate |
|---|---|---|
| Production slope | .154167m, cancels at first step | 3.120000m, remains supported |
| Synthetic flat | 3.120000m | Identical3.120000m |
| Ledge departure, floor below16.07m | Cancels at .541667m | Identical cancellation/distance |
| Jump then dodge | Airborne admission rejected | Still rejected |

After stopping movement at a ledge, the original capsule can settle back onto its rim; that is not evidence that a continued fall remains airborne. The thin-ledge unit control therefore continues ordinary directional movement after dodge cancellation and verifies an actual fall with exact baseline trajectory, rather than asserting a false final-state assumption.

Artifacts: `artifacts/defense-input/support-controls.json`, `support-controls-candidate.json`, and the per-policy JSON files. The environment worker independently sampled the exact stance and found the center aim line clear; architecture occlusion is separate from this support failure.

## Candidate contract

`validation/combat-review/evade-support-candidate.ts` is **not imported by production main**. It wraps one Player instance for controlled tests:

1. Only prior-grounded, valid admitted evade input is eligible. Ordinary movement, jump, flight, swimming, gliding, updraft and upward motion are excluded.
2. A bounded downward ray must find genuine walkable support directly below the feet within1cm. This rejects rim grabs and nonwalkable surface normals.
3. Retry the existing capsule collision solve at most1cm lower. Accept only actual grounded contact with no lateral or upward displacement; otherwise restore original position, velocity and grounded state exactly.
4. No `onGround=true` assignment, timer grace, air-dodge admission, cooldown change, invulnerability extension or extra horizontal displacement.
5. At most one support-ray pass and one additional capsule solve per affected physics step. No additional mesh, material, texture or gameplay clock. Candidate diagnostics count actual queries/recoveries; production installation remains pending review.

The source is World-only. Arena, network authority and remote inputs are untouched.

## Verification boundary

Own candidate tests cover30/60/120Hz component steps, exact3.12m distance/original evade clocks, ten downhill evades totaling31.2m without accumulated boost, thin ledges, solid corners, low ceilings, jump/water/updraft/glide exclusion and a60°nonwalkable slope. Independent QA additionally compares ordinary movement/sprint/jump in dry/water cases at30/60/120Hz for eight seconds each: every position/velocity/contact-state snapshot matches baseline, with zero support queries.

Actual-main30/60/120Hz render cadence tests use the normal120Hz fixed simulation and are reported separately. A proposed production implementation must reproduce the wrapper's results and pass independent action/contact timing review before integration. This audit does not authorize a general coyote window or a broader terrain step-down change.


## Narrow production implementation

`src/player.ts` captures prior-grounded valid evade admission before motion, then calls `EvadeGroundSupport` only if the normal capsule solve lost contact. The helper implements the proven≤1cm support predicate and existing capsule retry, including rollback on exceptions. It changes no action timing, cooldown, airborne admission, ordinary movement, Arena or network code. Current main probes install **no wrapper** and write separate `*-production.json` artifacts; historical baseline files are retained.

The exact historical Player is preserved as `validation/fixtures/player-pre-evade-support.ts` (header excluded from comparison): git blob`1149bd93b7be7a8813ebb61126bccb0323b86a1a`, SHA256`7e45f052a7c3e31fdfa052bb076a7edd400744ec06e3e9ccfb0df9ff6551f4ce`. This prevents an already-fixed Player from being compared to itself. A shared seven-case geometry contract runs against historical+candidate and actual production. Six additional production-versus-historical ordinary movement cases compare every state for8seconds at30/60/120Hz in dry/water conditions; all match exactly with zero support queries. Exception rollback is also tested.

The first real production three-contact probe preserves HP100 with the intended100ms side-evade timing; the two circular contacts still contain the player geometrically, but original invulnerability is active. There are no airborne-cancel observations. The paired production flat/slope/ledge/jump controls reproduce the candidate results exactly.

Query counts are explicit: one support **pass** is not one BVH call. In the current three-contact field probe,26support passes performed780individual BVH raycasts over30enabled colliders, followed by26capsule retries/recoveries. The slope-plus-control probe used17passes/511BVHraycasts/16capsule retries; the ledge was rejected before retry. Each affected step is capped at one pass and one retry; no pass occurs during unaffected/non-evade steps. No CPU timing was claimed during concurrent aggregate validation.

## Independent production and CPU handoff (08:05 UTC)

Production source checkpoint `0120fd9` and independent QA `a5be893` reproduce all six flat/slope × 30/60/120 Hz actual-main traces without installing the candidate wrapper. Every evade remaining/cooldown/invulnerability/grounded sample matches the preserved candidate reference, and distance is exactly 3.12 m. Ordinary movement is compared against the frozen historical Player, not another fixed instance.

`validation/combat-review/measure-evade-support.ts` runs production `Player.step` against actual world BVHs. Setup, real settling and diagnostic reads are outside the timer. A separate dense control adds 64 synthetic annular colliders whose bounds surround the route but whose geometry never contacts it; its final trajectory exactly equals the actual-field case. The shared weight-4 admission gate reserved both short CPU runs after other rendering/aggregate jobs finished. These are component CPU samples, **not full-frame performance, GPU FPS, WCET or device guarantees**.

| Quiet run / case | Ordinary step median / p95 (ms) | Support-affected step median / p95 / max (ms) |
|---|---:|---:|
| 60 trials, actual slope | .036 / .082 | .083 / .183 / 6.383 |
| 60 trials, dense +64 | .101 / .172 | .227 / .389 / 1.420 |
| 180 trials, instrumented actual slope | .034 / .051 | .077 / .107 / .844 |
| 180 trials, instrumented dense +64 | .099 / .131 | .224 / .293 / 2.843 |

Both runs have six untimed warmup trials per case. Instrumented helper time includes its capsule retry: actual median/p95 .043/.062 ms, dense .122/.167 ms. Capsule retry alone is .034/.050 ms actual and .100/.131 ms dense. The earlier 6.383 ms total-step outlier is retained; its cause was not measured, so it is not attributed to GC or excluded. Observed maxima are not upper bounds.

Current collider list is 32 entries, 31 enabled; dense is 96 entries, 95 enabled. Each affected step makes at most one downward pass (31 or 95 individual BVH raycasts) and one existing capsule retry. Flat controls make zero support queries. The measured ray-pass marginal median is approximately .009 ms actual / .023 ms dense; the existing capsule retry dominates. No new cache/bounds-filter optimization was added for that small potential saving. Root accepted retaining the proven narrow implementation.

Raw numeric reports: `artifacts/enemy-performance/evade-support-cpu.json` and `evade-support-cpu-instrumented.json`; gate/timing logs `artifacts/evade-support-cpu*.log`. Reproduce from `world/` with `node --import tsx validation/combat-review/measure-evade-support.ts [--instrument]`, under a quiet shared admission window.
