# Fixed-snapshot CPU comparison — explicitly no GPU / FPS claim

## Method

Baseline is `350f5640c722f1013e4f598c669c558c529dc6eb`, extracted with
`git archive` to `/tmp/world-cpu-baseline-350f564`. Expansion is a fixed copy
at 2026-10-30 05:15 UTC, `/tmp/world-cpu-current-snapshot`, based on that commit.
Tracked binary diff SHA-256:
`3db6564973e9e931e20e16d93a7b7e458a32f4e8d7e7e0ebc501e676893dac33`.
The complete source/asset/index/package manifest SHA-256 is
`a50a3adbb68519deca0b62ea8b1923ab9533e0cc20a647e60007c2ce1abf51b4`.
Untracked expansion source is included in that manifest and snapshot. Subsequent
working-tree changes are not included in these results.

- Same Node v24.22.1, dependency directory, jsdom, production main, real GLBs,
  decompressed character models, collision BVHs, player physics, AI and animations.
- Same pre-existing smoke-harness URL `?nopost&q=low`, 1024×768 jsdom window,
  no-op Canvas2D and renderer/PMREM, 1×1 texture bitmaps. The renderer still performs
  real scene/camera world-matrix updates. No production configuration was edited.
- Deterministic synthetic animation clock and seeded window Math.random. Both
  versions receive 60 Hz frame timestamps and run their production fixed steps.
- Five fresh processes per version, alternating order B/C, C/B, B/C, C/B, B/C.
  Three sequential positions per process: Valley HQ (-118,229.6), winter wilderness
  (-120,-680), Kyoto wilderness (100,560). Ground height is real geometry-derived.
- Each position: 180 warmup frames, 600 measured frames. Every 60 frames, allow
  10 ms outside timing for real lazy-loader promises. Player HP is restored to 100
  outside timing to avoid death changing the workload. No attack/movement input;
  active-enemy counts are respectively 0/2/3 in both versions. This is passive
  encounter load, not active skill/VFX stress coverage.
- End memory is measured after explicit GC. Profiles use separate runs and are
  excluded from the five timing samples. Root build/test and art renders were
  paused for the formal comparison; shared-host noise remains possible.
- Earlier unfrozen / missing-DecompressionStream probes were discarded. Formal
  runs expose Node's native decompressor in jsdom and have zero captured errors
  and warnings. Three's CJS deprecation message is identical harness/tool noise.

## Results

All times are **CPU milliseconds per simulated frame**, not frame delivery time.
Each column is the median across five independent process statistics; p95 is the
median of the five per-process frame p95s, not a pooled percentile.

| Position | Baseline median | Expansion median | Delta | Baseline p95 | Expansion p95 |
|---|---:|---:|---:|---:|---:|
| Valley HQ | 3.101 | 3.423 | +10.4% | 5.202 | 5.527 |
| Winter wilderness | 3.401 | 3.729 | +9.7% | 5.341 | 5.921 |
| Kyoto wilderness | 3.312 | 3.941 | +19.0% | 5.646 | 6.580 |

Paired median deltas (five runs): Valley +10.4/+9.4/+9.1/+29.1/+8.1%;
winter +10.8/+9.3/+17.1/+3.9/+5.9%; Kyoto +13.1/+6.0/+50.2/+36.8/+13.6%.
This is a consistent direction of additional CPU work, with significant process
variance. Kyoto exceeds 10% in four of five pairs and warrants investigation;
there is no basis to declare the expansion CPU-regression-free. Median 60-frame
block averages are baseline/expansion 3.454/3.706, 3.639/4.114, 3.708/4.140 ms.
These values must not be inverted into FPS or used as CI pass/fail thresholds.

## Resident resource / memory inventory

Scene resources are invariant across the five runs per version. These counts are
whole scene inventories, not visible draw calls or triangles submitted to a GPU.

| Metric | Baseline | Expansion |
|---|---:|---:|
| Objects | 10,782 | 11,030 |
| Meshes | 9,310 | 9,384 |
| Lights (all types) | 20 | 20 |
| Unique geometries | 5,109 | 5,149 |
| Unique materials | 1,263 | 1,318 |
| Geometry backing bytes | 408,675,576 | 409,918,412 |
| Unique-geometry triangle inventory | 7,919,887 | 7,941,301 |
| Median process RSS, MiB | 1,075.96 | 1,086.41 |
| Median heap used after GC, MiB | 109.94 | 112.17 |
| Median external, MiB | 532.86 | 534.19 |
| Median ArrayBuffers, MiB | 499.75 | 515.43 |

Memory fields overlap, are sampled by Node, and must not be summed or interpreted
as GPU residency. Backing buffers may contain other portions of a GLB. The stable
increment is 74 meshes / 40 geometries / 55 materials / 21,414 unique triangles and 1.19 MiB
geometry backing storage. No new light inventory appears in this snapshot.

## Reproduction and limits

From `world/`, with an extracted baseline and a frozen current copy each linked
to the same `world/node_modules`:

```sh
node --expose-gc --import tsx validation/world-cpu-comparison.ts /tmp/world-cpu-baseline-350f564/world baseline
node --expose-gc --import tsx validation/world-cpu-comparison.ts /tmp/world-cpu-current-snapshot/world current
# Independent diagnostic run, not mixed into timing results:
CPU_PROFILE=1 node --expose-gc --import tsx validation/world-cpu-comparison.ts /tmp/world-cpu-current-snapshot/world current
```

Repeat in the alternating order above. Raw samples and source identity are stored
in the accompanying JSON evidence. `/tmp/world-cpu-fixed/` contains execution
stderr and intermediate summaries. The script is manual, not a timing CI test.

jsdom DOM costs are not browser DOM/layout/paint costs. No GL submissions, shader
work, texture decoding, rasterization, postprocessing or browser compositing is
measured. No real input permission, visual/UI acceptance, GPU memory or target
hardware FPS result is established. The supported cloud-browser data-URL UI preview
was refused by browser protocol policy and was not bypassed; DOM/CSS mathematical
checks are not a browser visual pass.

## Attribution and bounded optimization recommendation

Independent inclusive method timing (milliseconds per frame):

| Component | Baseline Valley/Winter/Kyoto | Expansion Valley/Winter/Kyoto |
|---|---|---|
| Player fixed steps | .070/.076/.081 | .076/.088/.092 |
| Combat combined simulation/presentation | .255/.350/.338 | .285/.369/.393 |
| Player animation | .370/.376/.349 | .391/.382/.384 |
| WorldActions update, including nested flush | absent | .021/.019/.018 |
| WorldActions presentation | absent | .005/.005/.004 |
| Stub renderer matrix traversal | 1.905/2.385/2.149 | 2.280/2.336/2.445 |

WorldActions flush timing is nested in update and must not be added again. Extra
standalone flush adds only a few microseconds. Untracked main-loop work in this
profile is approximately .68–.85 ms baseline and .69–.78 ms expansion, not a
consistent new .6 ms cost. Repeated context/DOM getters are therefore not supported
as the dominant cause, and authorization caching should not be introduced on this
hypothesis alone.

A second, reverse-order top-level scene-tree profile found Kyoto renderer traversal
**2.195 ms baseline versus 2.066 ms expansion**, reversing the first diagnosis.
The unchanged World tree alone varied from .689 to 1.074 ms across these runs.
This demonstrates substantial timing/JIT/host variance. The five-process primary
signal is retained, but a stable .6–.8 ms source has **not** been established.

A separate three-process-per-version diagnostic replaced only renderer.render with
an empty function after boot. It is not mixed into the primary result and does not
model rendering or preserve all downstream transform-update behavior. Its median
CPU values are baseline→expansion: Valley 1.066→1.089 ms, winter 1.098→1.242 ms,
Kyoto .998→1.110 ms. This suggests a much smaller logic increment (.02–.14 ms),
not proof that all remaining difference is a production renderer regression.

Candidate changes were tested **individually**, without changing production code,
using `validation/world-matrix-candidates.ts`. Ten alternating normal/frozen
batches, 300 warmup and 3,000 measured forced subtree updates per batch:

| Isolated subtree | Nodes | Normal median ms | Frozen median ms | Local saving |
|---|---:|---:|---:|---:|
| Four static optional stations | 32 | .001720 | .000303 | 1.42 µs |
| Traversal apron | 2 | .000132 | .000041 | .09 µs |
| Enemy role sprites, local matrix only | 145 | .015188 | .009923 | 5.26 µs |
| Entire inactive skill pool | 55 | .005315 | .001393 | 3.92 µs |

These isolated microbenchmarks are not additive measured frame savings. Reasonable
minimal follow-ups are the existing `freezeStaticArt` utility on immutable stations
and apron after world placement, plus role sprites' fixed local matrices
(`updateMatrix(); matrixAutoUpdate=false`), while retaining
`matrixWorldAutoUpdate=true` so labels follow enemies. Do not freeze character
skeletons or moving actors. Station state changes affect materials, not transforms.
The inactive FX saving is too small here to justify adding activation/reuse
lifecycle complexity solely for performance. All candidates together are far too
small to explain the apparent .6 ms primary delta.

**Acceptance:** CPU overhead risk is documented, not declared solved. Keep the
recovered renderer/lighting/material semantics. No blind shader warmup, light-pool
or quality reductions. Recheck the final frozen build on an authorized GPU browser
and the user's target device before making performance or visual acceptance claims.

## Node compatibility verification

The full DOM harness depends on jsdom 30.1.3, whose installed engine declaration
is `^22.22.2 || ^24.15.0 || >=26.0.0`. Do not describe all Node 22 releases as
supported. Use at least Node 22.22.2 on the 22 LTS line, or 24.15.0 on the 24 line.
Node 24.22.1 was used for the CPU study; 24.15.0 itself was not separately tested.

Official npm `node@22.22.2` was installed only into
`/tmp/parhelion-node22-qa`, with a `/tmp` npm cache; no system Node, user machine
or CI major was changed. The explicit binary reports `v22.22.2` and passes
**44/44** targeted tests, including production DOM boot and its five event-chain
subtests, WorldActions, audio, frame scheduler and input tests. Log:
`/tmp/world-node22-tests.log`. The latest Node 24 boot smoke also passes **6/6**
after native decompression was exposed in the harness. This does not replace
CI's complete test/build run or GPU acceptance.

### Full-suite Node 22 locale identity finding

A later full Node 22 run uncovered a real loader-identity difference not covered by
the earlier 44 targeted checks. With no `shared-client/package.json`, Node 22.22.2
and tsx loaded both `i18n.ts?tsx-commonjs-export-preparse=1` and ordinary `i18n.ts`
CJS cache entries. Direct `setLanguage('en')` changed the first singleton while
`settings.bindingLabel('')` read the second still in Chinese. Their `getLanguage`
functions were different objects; an explicit `.ts` import selected the second.
Node 24.22.1 did not exhibit that split.

The fix declares only the shared package's existing ESM intent in
`shared-client/package.json` (`private:true`, `type:"module"`), with no locale API,
storage or assertion weakening. Both supported Node versions then return the same
module-function identities and English binding label. An added regression checks
extensionless, `.ts` and emitted `.js` specifiers plus settings' imported function
identity. The original seven tests and new identity check pass on Node 22 (8/8).
Final full-suite results after the last authored-content freeze are tracked by the
release validation pass, not inferred from this focused success.

Final frozen-source release verification completed at 2026-10-30 06:05 UTC:
World **754/754 on both Node 22.22.2 and 24.22.1**; Arena **322/322 on both**;
Node 22 complete site build (including both client typechecks) passes, then site
**13/13** passes. The 745-file runtime/asset/test/build manifest remains unchanged
throughout that pass: SHA-256
`c5078e2d2f0e54cccb804356938d1c861e00d26e0cb230debe1a05b91bb31d30`.
Build identifier: `5a8cc65202a5`. Full evidence paths and the test matrix are in
`validation/final-validation-20261030.json`. No deployment, GPU/FPS or browser
visual acceptance is implied by these checks.
