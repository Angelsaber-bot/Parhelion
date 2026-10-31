# Independent grounded-evade candidate audit

As of this proof the helper in `validation/combat-review/evade-support-candidate.ts`
is **isolated validation code**, not a production movement change. Its source
checkpoint is3d66e31. Root approval and equivalent production-path verification
are still required before integration.

Independent controls:
- `evade-support-independent.test.ts`:30/60/120Hz × dry/water, eight seconds of
  ordinary movement/sprint/jump each. Every position, velocity and contact-state
  sample matches unwrapped Player exactly. Zero extra queries; helper disposal
  restores original method ownership and is idempotent.
- `evade-main-cadence-independent.ts`: actual main with normal evade/right input
  under30/60/120Hz synthetic RAF and production120Hz physics. Explicit entry
  positioning and a temporary synthetic flat control collider isolate support.
  No forced grounded state, HP, evade timer, cooldown or damage writes.

| RAF cadence | Original production-slope distance | Candidate distance | Flat control |
|---|---:|---:|---:|
|30Hz|0.245833m|3.120000m|3.120000m|
|60Hz|0.154167m|3.120000m|3.120000m|
|120Hz|0.108333m|3.120000m|3.120000m|

Remaining-time, cooldown and invulnerability traces from actual main are exactly
equal to flat baseline at each cadence. Each slope evade uses16 bounded support
recoveries; flat uses none. Differences in original truncated distance include
ordinary held movement until the synthetic operator releases Right after its
first rendered frame. These are gameplay simulation results, **not FPS, human
reaction, GPU performance or full combat-difficulty evidence**.

The combat owner separately covers real ledges, steep slopes, corners, roofs,
jump/water/updraft/glide exclusion and repeated distance. Evidence is external
`qa/evade-main-cadence-independent.{json,log}` and
`qa/evade-support-independent-candidate.log`. Production acceptance must repeat
these invariants through the final Player path rather than only the wrapper.

## Production verification after approval

Root-approved production checkpoint0120fd9 was independently exercised with
**no recovery wrapper installed**. All six flat/slope ×30/60/120Hz actual-main
runs traveled3.120000m and exactly matched every recorded remaining/cooldown/
invulnerability/contact-state sample from the prior proven candidate. Numeric
reference fixture `validation/fixtures/evade-support-proven-main-traces.json`
contains only sanitized synthetic traces and the historical Player blob hash.
The production runner defaults to this comparison and writes a separate
`qa/evade-main-cadence-independent-production.json`; historical evidence is not
overwritten. `--capture-historical-wrapper` is only for an appropriate old source.

`validation/evade-support-independent.test.ts` now runs in ordinary World CI and
compares production Player directly to the frozen pre-support Player for ordinary
dry/water movement at all three rates. Every sample remains exactly equal, with
zero support passes/capsule retries off-evade. Historical wrapper disposal checks
remain separate. The source runtime helper reports individual BVH raycasts
separately from one support-ray pass; one pass may query multiple enabled BVHs.
No CPU timing or GPU improvement is inferred from these functional results.
