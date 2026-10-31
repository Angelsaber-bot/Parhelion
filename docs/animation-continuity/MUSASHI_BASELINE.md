# Musashi continuous-animation baseline (2026-10-31)

Frozen source: `6be0f8e`, read-only `four-servants-clean-20261031/final-source`. New work never writes its assets. Independent QA and the component scripts separate native in-place clone behavior from actual World root/input.

## Confirmed findings; not all fixed by brightness

- Default X stacks two reflected blade lights (up to intensity 9 each), white tip glints, colored traces and a central finishing cut whose opacity reaches 1. Shared stage bloom/light parameters also contribute; there is no evidence for an independent full-screen flash to claim removed.
- Actual-input charge progress .298 to .303 has a non-contact camera jump of 1.354 m in one 60 Hz frame. The existing .3 portrait/windup branch is discontinuous. Contact-triggered left/right shot changes are a separate deliberate design choice.
- Native private-clone right shoe sole remains 22.655 mm above its captured floor during charge, and 10.759–22.655 mm during release. This is independently sampled skinned Foot/Toe-weighted vertices, not merely ankle height; the prior global minimum hid it behind the planted left foot.
- Outro returns the left foot 144.985 mm horizontally at essentially unchanged sole height. Actual scaled-stage QA independently measures 233.873 mm left-foot bone travel without lifting. These are different coordinate scales, not contradictory results.
- Intro overlaps both stepping feet above 5 mm for approximately .242 s. Terminal third-cut arms finish sweeping around .11 s after contact then hold around .28 s before outro. Their visual quality requires the full sequence, not one accepted still.

## First narrow default-readability candidate

`EraBladeTrace` now supports explicit opt-in visual multipliers; omitted options preserve other identities. Musashi reduces trace/glint opacity and width, uses normal alpha for the two large crossing surfaces, caps the central white surface at .25, and reflected blade lights at 1.6. No model, contact clock, damage, charge cost, target, cancellation or input authority is changed. Shared identity-only stage/Q changes belong to the integrator.

Paired samples are charge, first-cut peak, third central-white peak and outro. Original and candidate use the same source camera and 360×202 / 16-sample CPU exposure. The actor-region PNG 99th RGB percentile changes from 234→205 at the first cut and 244→203 at the finishing peak. This is an offline pixel comparison, not WebGL bloom, photometry or GPU performance. Additive compositing, fog and UnrealBloomPass are not faithfully reproduced by the CPU renderer; the separate runtime material/light checks cover property wiring only.

## Bounded evidence pipeline

`validation/musashi-continuity/render-x-stream.py` consumes one native frame at a time, reusing a ~7 MiB working buffer. It stores selected PNGs or streams directly into a 30 fps video; it does not save a raw frame sequence. It runs only through the tranche's shared four-lock/2 GiB/200 MiB-total gate. Per-role budget ≤40 MiB. Full-cycle movies use 360×202 / 4 samples and retain phase/time/hash metadata. Old images and the former incomplete 111-frame video remain untouched and are not this tranche's complete-cycle acceptance.
