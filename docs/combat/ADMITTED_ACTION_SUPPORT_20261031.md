# Ground-required action continuity — 2026-10-31

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
