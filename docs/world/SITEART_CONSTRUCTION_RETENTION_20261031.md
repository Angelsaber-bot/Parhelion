# SiteArt construction reference cleanup — 2026-10-31

Root-approved, reviewer-identified narrow CPU memory cleanup: after every layer has
successfully merged, `SiteArt.finish()` clears its private construction bins.
Existing per-part `dispose()` calls stay unchanged. No final render/collision buffer,
material, borrowed primitive, state layer or scene object is disposed by this clear.

Before/after source census across five campaign builders plus three False Dawn
builders (normal-quality split):

- 935 disposed construction geometries still referenced before the cleanup.
- 3,740 distinct backing stores, totaling 2,385,240 bytes (about 2.275 MiB).
- All construction stores are disjoint from final render and collision stores.
- After cleanup: zero retained bins/construction geometries/backing bytes.
- All eight final render and collision SHA256 digests remain exactly equal.

This removes references that could otherwise prevent collection. It is **not** a
measured JavaScript heap/GC reduction, GPU-memory result, frame-time gain or FPS claim.
Counts use the audited preview-height sampler; byte ownership/topology is independent
of those sampled heights. Original scene geometry and live collision are unchanged.

Validation: 35 focused tests pass (campaign sites, False Dawn sites, and two new
CI tests); typecheck passes. Four actual-main fresh saved-choice boots across low/
normal, 40 alternating visual projections each and production R reset also pass.
Resource identities, branch/world bounds, old materials/colors and collision hashes
remain stable. No new render is needed for a byte-identical geometry change.

Evidence under sibling `parhelion-eight-hour-evidence/environment/`:
`siteart-before.json`, `siteart-after.json`, `siteart-tests.log`,
`siteart-typecheck.log`, `siteart-branch-reset/branch-scene-consistency.json`.
The independent reviewer's original census remains untouched in `review-runtime/`.

Reproduction from `world/`:

```sh
node --import tsx --test validation/siteart-retention.test.ts
node --import tsx validation/environment-eight-hour/audit-siteart-retention.ts AFTER.json --expect-cleared --compare BEFORE.json
```

The baseline JSON must come from the pre-cleanup source. The audit's own temporary
references are instrumentation, not production retention; it never claims to measure
heap reclamation. `SiteArt.finish()` remains a one-time construction operation, as
before; this patch does not add rebuild/reuse semantics.
