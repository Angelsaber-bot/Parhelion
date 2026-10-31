# Admitted dodge support audit — validation candidate, 2026-10-31

**Status: isolated validation wrapper only. Production Player/WorldActions are unchanged.**

## Reproduced production behavior

`validation/combat-review/run-defense-input.ts` runs real main, ordinary configured keyboard dodge, real Player/BVH and actual Warden contacts. Entry teleport and typed encounter admission are explicit setup; grounding is settled by physics. No HP, energy, grounded, hostile position or attack-clock assignments. Reading the remaining tell is a deterministic timing oracle for a mechanics probe, **not human reaction or balanced-playthrough evidence**.

- Backward dodge 100 ms before contact: player remains inside all three accepted footprints, invulnerability is active and HP stays100.
- Backward dodge 200 ms early: original invulnerability correctly expires, HP100→82→66→50.
- Side dodge 100 ms before contact across the actual alpha slope: accepted while grounded, but later attempts truncate to approximately154 mm and HP ends66.
- A following Saber independently lands four genuine14damage contacts on this field, with no observed stuck timer in this short probe. This does not prove all companion terrain paths.

Exact failing stance: `(-54.3037204157,3.9185068459,-105.2040747411)`, facing the Warden at `(-53.8739507009,3.7102091535,-102.1539371039)`. The first120Hz side-dodge step leaves feet3.7677mm above the actual surface, normalY`.994461` (about6°). `Player.collide` reports no contact for that tiny gap; `WorldActions.update` then cancels the entire admitted `.24s` evade while ordinary gameplay remains enabled. No invisible wall or environmental collider defect was found.

## Controls

`probe-evade-support.ts` pairs production terrain with explicitly synthetic flat/ledge controls (one temporary collider at height20). It uses actual main keyboard/physics, never forced grounding.

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
