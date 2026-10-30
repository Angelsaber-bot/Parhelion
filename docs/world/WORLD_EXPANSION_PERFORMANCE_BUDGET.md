# World expansion: performance and acceptance budget

Baseline asset inventory: `350f564`, 2026-10-30. Cloud development only; no
publication, target-device browser acceptance or FPS improvement is established.
The user's observed 27–40 FPS remains the real device report, not a lab baseline.

## Preserve the recovered renderer

`RENDER_PERFORMANCE_20261030.md` describes a withdrawn experiment, not current
recommendations. Do not reapply hidden shader warmup, divergent grass early exits,
an eight-light pool, broad actor changes or material caches as a bundle. Current
main already contains static ART transform freezing, squared-distance tests and a
fixed 1.25× default DPR. Those are later changes than the conservative recovery
report; its historical byte-parity claim does not describe this entire baseline.

## Measured inventory (not visible draw calls)

Run from `world/`:

```sh
node --import tsx validation/world-expansion-baseline.ts /tmp/world-baseline.json
node --import tsx validation/render-cpu-benchmark.ts /tmp/world-transforms.json
```

| Region | Source ART meshes | Chunk meshes | Potential outlines | ART triangles | ART backing arrays, MiB |
|---|---:|---:|---:|---:|---:|
| Valley | 77 | 533 | 368 | 508,268 | 19.72 |
| Britain | 33 | 753 | 463 | 805,375 | 40.87 |
| Blacksail | 94 | 564 | 299 | 631,002 | 27.26 |
| Winter | 59 | 681 | 412 | 720,732 | 41.82 |
| Kyoto | 38 | 741 | 447 | 1,369,630 | 89.35 |
| Total | 301 | 3,272 | 1,989 | 4,035,007 | 219.02 |

These are parsed production ART trees using the runtime 64 m chunk policy, before
runtime duplicate-water removal and frustum/distance/shadow culling. They exclude
settlements, actors, collision BVHs, post targets, grass and textures. Array storage
deduplicates backing buffers within each region but can include non-ART bytes in a
shared backing buffer; this is **not GPU memory or total JS heap**. Outlines reuse
geometry but still produce additional draws when visible. Compressed map GLBs total
33,572,332 bytes. Layouts contain 210 markers, 42 areas and 13 authored point lights,
plus the existing cave light (14 total).

Existing static freezing measured approximately 0.498 ms → 0.074 ms for an isolated
Node matrix-update pass across the five trees. This saving is already in main and
cannot be presented as an expansion improvement. Seven batches after warmup; shared
cloud CPU noise applies. No GL draw submission or shading is measured.

Real map-presentation code with a no-op canvas proxy emitted 37 canvas operations
for the selected Valley minimap view and 202 for the full map. Median JS work was
about 0.010 ms / 0.031 ms respectively. This excludes rasterization, browser layout,
GPU upload and compositing. Scheduling is a bounded work-count improvement, not
evidence that map JS accounts for the reported low FPS.

## Additive feature budgets

These are conservative review gates, not measured device capacity. Exceptions need
an explicit scene-cost report and reviewer agreement, not silent budget increases.

- No new PointLight/SpotLight/shadow map, postprocessing pass or render target.
- New local interaction sites: aim for ≤12 material-batched meshes, ≤5,000 triangles
  and ≤7 materials per site. Cull at local range; no map-wide combined batch that
  defeats culling. At most two sites should be visible together by placement.
- No new textures for environmental indicators; prefer existing/emissive materials.
- Preserve the original Valley story's separate ≤6 meshes/1,000 triangles/4 material
  test. Do not hide expansion cost by relaxing it.
- No extra resident population or detailed-enemy quota by default. Role variety
  should use existing actors. Effects use shared geometry/materials and fixed pools.
- Interaction states should change existing objects only. No geometry/material/BVH
  construction in per-frame updates or repeated interaction. Dispose owned resources
  once and prove repeated reset/rechallenge does not grow scene/resource counts.
- Provisional total additive geometry-buffer budget: 4 MiB, excluding no existing
  assets. Record precise unique buffer counts; browser heap/GPU memory remain separate.
- New non-render simulation work: target <0.5 ms median and <1 ms P95 per active
  frame in the same deterministic CPU workload. Record measurements, not timing-test
  assertions vulnerable to shared-host scheduling. Far/inactive work should be bounded
  and perform no raycasts, pathfinding or allocation loops for every world marker.
- Combat/input/physics stay every frame or at their existing fixed step. Presentation
  tasks alone may use `FrameWorkBudget`: maps ≤30 Hz while moving/pulsing, stats 4 Hz;
  progress, language, resize, map opening and final stopped position invalidate at once.

Existing ART is already material-batched merged geometry; settlement art also batches
by material. Naive conversion to instances is not an established optimization and
risks geometry/material/culling differences. Build new repeated objects efficiently
at authoring time instead of rewriting the accepted world asset pipeline.

### Candidate resource checks

The four authored optional stations each use seven meshes/materials, zero shadow
casters and zero lights/textures. Measured ART geometry: Britain 1,604 triangles /
122,608 bytes; Blacksail 1,412 / 92,108; Winter 876 / 72,984; Kyoto 1,744 / 125,824.
Combined 5,636 triangles and 413,524 backing-array bytes (collision BVHs excluded).
Seven rather than six material batches preserve distinct paper, cloth and mutable
signal/completion semantics; the independent test caps that count explicitly.
Visibility is limited to 180 m. These counts describe the candidate at audit time;
the tests must be rerun after later art revisions.

The skill presentation pool has 18 slots, two shared geometries, 18 materials and
at most 18 visible effect meshes (each slot switches between a bar and a ring).
Its geometry buffers occupy under 8 KiB (the tapered RGBA refinement uses 6,984 bytes, approximately 6.82 KiB). Independent tests repeat 1,000 activations
and 1,000 station state updates, proving object/resource identity stays fixed,
collider BVHs are reused, clearing hides effects, and disposal occurs exactly once.
See `validation/world-expansion-budget.test.ts`.

An isolated Node stress proxy (one skill show/update, all four station visibility
checks and scene-matrix propagation per iteration) measured about 0.0048 ms median
per iteration over seven batches of 10,000 after 1,000 warmups. It excludes combat,
the existing world, rendering and browser costs, and is not a whole-frame budget
result or evidence of FPS improvement.

## Regression hotspots and acceptance

Audit `main.ts` repeated map drawing/DOM writes, guide selection, servant-material
traversal, collision raycasts, actor animation and per-frame allocation separately.
Prefer one isolated change with deterministic equivalence tests. No shader/lighting
claim is accepted from Node measurements. Current 14-light PBR shading, shadows,
postprocessing/MSAA and pixel count can be GPU costs, but bottleneck attribution is
unverified without an actual frame capture.

Browser comparison must use baseline and candidate on the **same device**, browser,
viewport, quality, DPR, route, cache state and combat population. Record renderer
identity, median/P95 frame interval, >50/>100 ms spikes, whole-frame draw calls and
triangles, retained geometry/texture counts and screenshots. Test Valley spawn,
residence interaction, tower view, each chapter hub, ordinary combat, an elite, boss
rechallenge and repeated teleport/reset. Separate cold-load shader/asset spikes from
warm sustained routes. Preserve all hidden/resume exclusions identically.

Acceptance: no reproducible degradation >5% median or >10% P95 against baseline on
the same route, and no extra sustained hitching. These thresholds are acceptance
targets, not achieved results. At 27–40 FPS the observed frame interval is roughly
25–37 ms; a 60 FPS claim needs ≤16.7 ms sustained target-device evidence.

## Cloud verification boundary

The available cloud browser opened the public World page but could not create a
WebGL graphics context. This prevents GPU image and target-device FPS acceptance;
it is not evidence that the user's website is down. The production DOM/input boot
harness uses explicitly substituted non-GPU rendering and must be reported separately.

See `WORLD_CPU_VISIBILITY_FOLLOWUP_20261030.md` for the independently measured
hidden-enemy transform optimization. It preserves content/lighting and does not
convert a CPU proxy measurement into a delivered frame-rate claim.
