# Ground-required action continuity — 2026-10-31

> Historical checkpoint: the action-only ownership flag described below was superseded by approved general physical support continuity in `4f56d26` and two-argument main integration `962eee0`. The original measurements and scope decisions are retained as historical evidence, not the current production contract. See [General ground continuity review](GENERAL_GROUND_CONTINUITY_REVIEW_20261031.md) for the live predicate, ordinary admission improvements, exclusions, costs and shoreline caveat.

## Reproduced failure, not a visual-only airborne metric

The production Alpha exit runs from XZ `(-45,-98.8)` to `(-52,-85)`. At its real grounded start Y3.8492087461, normal forward+melee or forward+Q is admitted. The first120Hz physics step ends at `(-45.0207339063,3.8476809683,-98.7591245847)`, only **1.552239mm** above actual walkable floor Y3.8461287290, normalY.99829863 (~3.3°). `Player.collide` loses contact and `WorldActions.update` cancels the admitted action before its first pulse.

Actual-main read-only probe `validation/combat-review/audit-downhill-actions.ts` uses normal resolved keyboard/mouse inputs, real grounding and original clocks. One supported entry placement per case and synthetic flat/ledge geometry are explicitly fixtures. No hostile HP, grounded flag, velocity, cooldown, charge or action state is written. Empty-lane contact emissions distinguish cancellation from a normal attack miss; this is not a balanced combat playthrough or GPU animation review.

| Control | Melee admissions / emitted contacts | Q result |
|---|---|---|
| Production downhill, six fixed presses | 3 / 2; first admitted cut canceled immediately | Admitted, cast/guard emitted, zero strike; 7s cooldown retained |
| Synthetic flat, same movement/presses | 6 / 6 | Normal strike at .25s |
| Real synthetic ledge departure | First admitted action canceled; floor gap16.07m | No strike, no cooldown refund |
| Actual held jump | First admitted action canceled; initial rise5.847cm | No strike, no cooldown refund |

The corrected jump control holds the key through a real frame, rather than releasing it before physics. All reported final controls use that real jump.

## Compared options and deliberately limited scope

Two validation-only wrappers reuse the accepted `EvadeGroundSupport` geometric predicate unchanged:

- **Already-admitted actions only:** preserves all3 admitted melee contacts and the normal Q pulse, while retaining the same3/6 initial melee admissions. It does not make a rejected airborne keypress valid. Six component parity cases at30/60/120Hz×dry/water and all2,160 actual-main no-action physics records match baseline exactly, with zero extra support queries.
- **General walking continuity (contrast only, not included):** removes all227 downhill airborne physics steps and admits6/6 cuts, but adds334 support passes/10,020 BVH casts to ordinary traversal and changes ordinary support/admission behavior. It is a separate possible follow-on, not silently bundled here.

The original casting-only comparison required60 melee /72 Q recoveries, plus one rejected ledge probe across the full control suite. Exact original Q guard ownership extends5 physics steps beyond casting: cast duration.60s, guard duration.65s. Casting-only support leaves72 guarded samples versus flat77. Including the **existing** `skills.guarding` tail restores the exact77-sample flat guard trace, with identical contact and cooldown. Root explicitly approved retaining that original tail; no new defense duration or cast is introduced.

## Approved API and main ownership contract

`Player.step(dt,input,admittedGroundAction=false)` adds one optional, default-false coordinator bit. The coordinator may pass true only for already-active melee, casting, or the existing skill guard tail while gameplay is active. Held/queued input alone is not ownership. All old callers and ordinary movement remain identical by default.

Eligibility still requires prior-grounded state, finite positive dt≤.1, no jump and no flight. The reused helper independently excludes upward motion, swimming, gliding/updrafts, nonfinite state, missing/steep support and gaps>1cm. It retries the existing capsule collision once, accepts only genuine support with no lateral/upward displacement, and rolls back unsupported/corner/exception cases. Evade and admitted-action ownership share one combined condition, so they cannot issue duplicate recovery passes.

Main wiring is owned by the integration lead. `WorldActions` input admission, damage, costs, cooldowns, native contacts, pause/cancel and defense timers are unchanged. Ownership ending must stop recovery immediately. Actual jump and ledge departures still cancel actions. The remaining rejected moving inputs outside any admitted action are documented, not claimed fixed.

Historical pre-action Player reference: git blob `8c12ffc9d2ca47e97328d470154a933041a6c29c`, preserved in `validation/fixtures/player-pre-ground-actions.ts` with only header/import relocation. Production API tests use that reference for default-false parity, plus real WorldActions contact/cooldown integration on synthetic geometry. Candidate helpers are validation-only.

## Evidence preservation

Historical actual-main baseline JSONs remain `artifacts/downhill-actions/*-production-diagnosis.json`. New default runs write `*-current-production.json`; `--output=PATH` supports independent destinations. Candidate modes have separate filenames. No-wrapper production main validation must follow main wiring before claiming end-to-end closure.

## Production closure

API `b21719a` (Player blob `765ba51b6ca9324b77e0bf7a5d2f58ada2ae0226`) plus coordinator `86758f0` now execute the approved ownership predicate in real main. Lead test `66ba6c0` positively observes the existing guard-only tail; independent API transition tests are `dc1ae1d`. The main test failed with zero contacts before wiring and passes with exactly one real melee/Q contact afterward.

Own full **no-wrapper** production replay:

- Downhill melee: unchanged3/6 input admissions, all3 admitted contacts, zero cancellations;60 support passes/1,800 individual BVH raycasts/60 capsule retries.
- Downhill Q: one admitted pulse, zero cancellations, original guard tail;78 passes/2,340 BVH raycasts/78 retries. The pre-update ownership lasts78 steps while the post-update guard observation has77 true samples, exactly as on flat ground; this is not an extension.
- Flat controls: original contacts and zero support queries.
- Ledge controls: one rejected support pass, no capsule retry, admitted action canceled as before. Jump controls: zero recovery queries and normal cancellation.
- No-action downhill/flat/ledge/jump: all2,160 physics records exactly match the preserved historical baseline, with zero support queries in every case.

Current evidence is `artifacts/downhill-actions/{melee,skill,none}-current-production.json` and matching logs. The diagnostic script now treats the legacy `evadeSupport` counter as shared admitted-action support, asserting zero only when no action owns it. General walking continuity remains a separate validation-only contrast.
