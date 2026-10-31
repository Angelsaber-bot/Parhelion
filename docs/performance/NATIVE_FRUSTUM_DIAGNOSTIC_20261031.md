# Native frustum potential — read-only diagnostic, not a runtime proposal

`validation/native-frustum-potential-audit.ts` measures actual native instances in
frozen green78c8ea1. It does not change visibility, frustumCulled, geometry bounds,
AI code or contact rules. Its synthetic scene setup positions the player and
restores fixture HP while advancing normal frames; it is not a gameplay journey.

Forty camera samples cover five existing landscape viewpoints, four headings and
16:9/9:16 aspects. Existing per-mesh candidate eligibility/material draw ranges
are respected. Native roots with **any currently visible shadow-casting mesh**
are excluded from potential removal; this is stronger than assuming a distance
alone guarantees shadow safety. Active cinematics are also excluded. Current
posed skinned vertices are measured directly, with a0.5m inclusion margin.

| Hypothetical world-space radius | Samples with nonzero potential /40 | Maximum groups | Maximum triangles |
|---|---:|---:|---:|
|3m|14|16|45,304|
|5m|13|16|45,304|
|10m|13|16|45,304|
|20m|13|16|45,304|
|40m|11|16|45,304|

The maximum is two BlackSail native actors. Current Winter/Kyoto nearby native
shadow casters remain excluded from removal. No missing geometry bounds required
an estimated fallback. The largest **sampled current-pose** radius is1.99m, but
this does not establish full clip, weapon, acting, transition or cinematic bounds.
Existing native export sets are sampled, not conservative continuous envelopes.
Even the40m column is hypothetical, not a proof that every future pose fits it.

**Decision: no runtime culling change on this evidence alone.** Potential is
modest in these viewpoints, and full animation/shadow/camera-boundary equivalence
has not been established. Counts are not WebGL calls saved, GPU time or FPS.
If revisited, first prove a conservative complete envelope (including scales,
weapons, deformation and interpolation), then test camera boundaries and actual
shadow/cinematic behavior. Do not reinterpret previous broken headless skin
culling as a browser performance regression.

External evidence: `qa/native-frustum-potential-78c8ea1.{json,log}`. The gate admitted
one bounded non-timing run after the combat benchmark released its window.
