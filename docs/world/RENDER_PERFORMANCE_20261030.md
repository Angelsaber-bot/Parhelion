# World rendering and performance pass — 2026-10-30

Base: `a5b3290f6be719867bdf847be8faa0a29d7982fe`.
This is a cloud development change, not a deployment. It preserves all 145 ordinary
enemies, five elites, model geometry, resolution presets and existing draw distances.
Arena gameplay is unchanged.

## What changed

- Cache skinned-mesh lists, animation clips and shadow state instead of repeatedly
  traversing models. Skip unchanged paused animation and guardian matrix uploads.
- Create at most two ordinary detailed enemy instances per frame, nearest first,
  rather than cloning an entire crowd at once. The target budget remains 24; regional
  fallbacks remain visible, existing LOD stays visible during replacement, and
  chapter bosses bypass the ordinary creation quota.
- Use a spatial broad phase for the exact same chunk/outline distance tests.
  Prepare the culling tree before entering play.
- Skip the full-screen sun-shaft pass when it contributes nothing. Grass vertices
  already masked out stop before height/wind work; visible grass density is unchanged.
- Replace 14 simultaneous world point lights with eight fixed shader slots, choosing
  all nearby influencing lights first. Shader light count stays stable across region
  changes. All authored lights remain in the data; some distant lights can be omitted.
- Snap the directional shadow center in light-space texels to reduce camera-motion
  shadow crawl without lowering map resolution, coverage or shadow update rate.
- Share immutable converted map materials by source-object identity. Mutable water,
  halos, targets and beams remain isolated; their original conversion factory is unchanged.
- Reuse third-person camera scratch vectors; cache companion reflection-material lists,
  invalidating when an outfit model is replaced.
- Avoid redundant DOM writes. Limit map painting to 30 Hz while moving or pulsing a
  quest marker; stationary maps without a target do not repaint. The 3D game frame and
  physics rates are not limited by this UI schedule. Stats update at 4 Hz.
- Loading yields between heavy material/geometry stages so the browser can paint progress
  and process input. Individual geometry/BVH operations are still synchronous.
- Optional parallel-shader preparation runs before normal entry. Unsupported drivers
  skip it. Failure or a six-second asynchronous timeout continues to normal rendering.
  A timer cannot preempt synchronous driver compilation submission.
- Runtime diagnostics expose frame P95 and mean main-thread submission time. Visible
  long stalls remain in the samples; only hidden/resume intervals are excluded. These
  are browser frame/main-thread observations, **not a GPU timer**.

## Measured evidence

These measurements use the same source assets and Node CPU workloads before/after.
They do not measure a player's GPU, interactive game FPS or battery usage.

| Scope | Before | After | Meaning |
|---|---:|---:|---|
| Cold crowd clone burst | 4.831 ms / 24 clones | 0.651 ms / 2 clones | Work is spread over frames, not eliminated |
| 24 active GLB animation updates | 0.1076 ms | 0.0762 ms | Isolated CPU update median |
| 16 active guardian updates | 0.1405 ms | 0.0884 ms | Isolated CPU update median |
| 3,043 map chunks, distance culling | 0.04061 ms | 0.00953 ms | Small absolute CPU saving; exact visibility parity |
| Immutable material instances | 466 | 284 | 182 allocations avoided; not draw-call reduction |
| Point-light shader loop terms | 14 | 8 | Work-count reduction, not measured GPU speedup |

Culling was compared at 1,200 camera positions. Camera scratch refactoring was compared
against the original camera-arm block in 1,000 real-BVH configurations. The local-light
budget was checked at 12,129 world/path samples: at most four nearby influencing
sources, none dropped by the eight-slot pool. Far lighting is intentionally budgeted.

Reproduction sources and raw CPU results are in `world/validation/benchmarks/` and
`world/validation/enemy-render-cpu.bench.ts`. Counts cover five shipped map ART trees
and five settlement kits before placement foundations where noted in the script.

## Verification and limitations

Final cloud verification: 530 World tests and 13 site tests passed; typecheck and the
whole-site build passed. Independent camera/targeted audit passed. Re-run these checks
if later changes are merged.
Regression tests cover input/entry, save reset, outfit cache invalidation, paused models,
load retries, nearest-first clone budgets, shadow/light state, exact culling, target-marker
animation and visible long-frame reporting.

Actual browser/GPU/FPS comparison remains unverified in this round. Direct Chromium
launch was unavailable in the execution sandbox; the provided cloud browser could not
connect to the workspace's loopback development server. Neither a failed connection nor
CPU microbenchmarks establish that the game is visually correct or faster on a Mac.

Use identical hardware, viewport, quality, DPR, route, cache warmup and enemy activity
for a later baseline-versus-candidate browser comparison. Record median/P95 frame time,
frame spikes, renderer identity, draw calls and visible output. Never report the CPU
percentages above as whole-game FPS improvements.

## Follow-up: unobtrusive hit feedback

Removed the enemy-attached wireframe polyhedron entirely. Hits now emit small
camera-facing tapered spark streaks at the computed raycast endpoint, at most
0.28 m wide and 140 ms long (160 ms for companion contact). The muzzle flash no
longer uses faceted geometry either. Geometry/materials are shared, impact capacity
stays at 20, and model materials are not mutated. Damage numbers and crosshair hit
feedback remain. Automated hit-position/lifetime/disposal tests pass; no rendered
browser acceptance is claimed.
