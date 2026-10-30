# Consumed-source and hidden-enemy CPU follow-up (no GPU/FPS claim)

This follows, and does not overwrite, the original expansion CPU comparison's
Kyoto +19% risk signal. The first study did not establish a stable .6–.8 ms source.
This follow-up tests two independent candidates, without changing quality,
materials, lighting, collision geometry or authored content.

## Fixed experiment

Source snapshot: `/tmp/world-cpu-source-snapshot`, 2026-10-30 05:40 UTC;
source/asset/index manifest SHA-256:
`20473124fdb7f4355c87adb1ba3dc0782286c94d81e30642c885e8d7f1b46137`.
It includes the small static-station/apron/local-label freezing already integrated
before this snapshot. No source-node removal or hidden-enemy guard was in it.

Same production-main harness, Node 24.22.1, dependencies, real assets/BVHs, synthetic
60 Hz timestamps and no-GPU renderer as the original study. Each independent
process runs Valley HQ, winter wilderness and Kyoto wilderness in sequence:
180 warmup + 600 measured frames per location, 10 ms event-loop yield outside
timing every 60 frames. Restore player HP outside timing to avoid death changing
workload. Scene light inventory remains unchanged at 20; active-enemy
counts remain 0/2/3. Three repetitions per variant, balanced order:

1. control → consumed-source detach → hidden-enemy guard
2. hidden-enemy guard → control → consumed-source detach
3. consumed-source detach → hidden-enemy guard → control

Candidates are **never stacked** in these measurements. All nine runs completed
with zero captured errors/warnings. ART rendering, player/combat logic and all
real models remain present; only the explicitly named matrix work is skipped.

| CPU ms / simulated frame | Control median / p95 | Source detach median / p95 | Hidden-enemy guard median / p95 |
|---|---:|---:|---:|
| Valley HQ | 4.166 / 6.264 | 3.640 / 5.872 | 1.929 / 3.804 |
| Winter wilderness | 4.918 / 7.537 | 4.115 / 6.347 | 2.076 / 3.561 |
| Kyoto wilderness | 4.596 / 8.087 | 3.920 / 6.797 | 1.903 / 3.466 |

Values are medians of three process statistics (p95 is not a pooled percentile).
The hidden-root candidate reduces this **CPU proxy** median by about 54–59%.
It does not establish target-device FPS, GPU shading improvements or visual
acceptance. Raw per-process values and diagnostics are in the companion JSON;
control variance and shared-host/JIT/GC effects remain explicit limitations.

## Consumed-source trace and safety

`main.ts` imports every COLLISION mesh into newly allocated position/index arrays,
bakes its world transform, and builds separate static/dynamic BVHs. Dynamic doors
and targets subsequently toggle those collider records and their ART meshes.
The debug collider mesh uses merged `staticGeo`. `markers` is constructed from
layout JSON; GLB MARKERS nodes are hidden metadata. `parts` has no post-extraction
source-node reads. `byName` callers address ART gate names and Tower_Halo, not
COLLISION/MARKERS descendants.

Five COLLISION trees contain 40 nodes; five MARKERS trees contain 215 nodes:
255 nodes / 35 collision meshes total. Removing them from parents without disposing
anything leaves ART identities, BVH object/geometry references and layout markers
unchanged. Reachable scene geometry inventory drops by 66,503,496 backing bytes,
but actual Node external/ArrayBuffer medians remain unchanged (~534.19/501.07 MiB):
**do not call this reclaimed memory or a GPU triangle saving**. These hidden meshes
were not drawn. No material/geometry disposal occurs.

The isolated subtree microbenchmark measures about .0312 ms for all 255 source
nodes' forced matrix updates (.0083 ms with frozen matrices). This is smaller than
the full-frame source-detach difference; do not attribute the entire difference
to 255 matrix multiplies. Source detach is not integrated at this checkpoint, so
it cannot inflate the accepted hidden-enemy optimization's measured contribution.

### Actual production gate/target/reset validation

`validation/source-node-detach.test.ts` runs the real production main before/after
removal, with genuine HQ interactions invoking world-state application, not a
mock replacement. It passes both current and published 350f564 source roots:

- All four seam gates block a real Player capsule before summon stability and
  permit traversal after it; detached/attached numeric trajectories are identical
  within each version.
- Three Kyoto ART banner targets retain real ray intersections, visibility changes
  and matching dynamic-collider toggles. Ray distances remain 66.2071/99.1212/
  110.9872 m in both versions.
- Actual R/reset input restores closed gates and targets, clears progress and
  returns the player to [3,21,159]. All ART references remain scene-reachable and
  collider/BVH references remain identical; zero source-resource disposals.

The old seam fixture began at ±320, inside/behind some gate bounds. Its “distance
from far endpoint > 20” assertion could falsely pass after overshooting that
endpoint. It was strengthened, not weakened: use legitimate approaches at ±280
and additionally bound **signed forward progress** below 70 m while closed.
For the west gate, bounds are x[-335.118,-309.632], y[-6.326,73.674],
z[-47.118,-12.882]. Closed capsules stop at x=-309.3500, feet y=3.6750;
opened capsules reach x=-415.0. Both versions agree. Closed east/north/south
stops likewise match. This was an inadequate old test start/assertion, not a
confirmed new production gate bug. The strengthened existing route test passes.

## Hidden-enemy semantic boundary

Only the enemy `visual.root` receives an `updateMatrixWorld(force)` visibility
check. Visible roots call the original method. `matrixAutoUpdate` remains enabled;
`updateWorldMatrix` is not overridden, so an explicit world-position query remains
correct. The scene, ART, camera, lights, player, servants, skeletons, effects and
physics are not given this behavior.

Combat hit/LOS/AI positions come from authoritative state/BVHs. Presentation first
sets visibility and positions, then the next render refreshes the now-visible
root's entire matrix tree. Hidden enemy models are released; late loads fill the
asset cache rather than relying on hidden matrices. Scene resource inventories
are identical between control and this candidate: 11,030 objects, 9,384 meshes,
5,149 geometries, 1,318 materials and 20 lights. It saves traversal, not content.

The combat audit's real WorldCombat tests cover hidden descendants not traversed,
hidden root/scene transform changes followed by first-visible-frame matrix parity,
explicit hidden getWorldPosition, real guard GLB late arrival/cache/reacquisition,
bone matrices, death release, revival with fresh instances, reset and dispose.
These passed before production integration. Post-integration verification is
recorded below once the actual dedicated root class is wired.

## Reproduce

From `world/`, against the fixed snapshot:

```sh
node --expose-gc --import tsx validation/world-cpu-comparison.ts /tmp/world-cpu-source-snapshot/world control
CPU_DETACH_SOURCE=1 node --expose-gc --import tsx validation/world-cpu-comparison.ts /tmp/world-cpu-source-snapshot/world source
CPU_SKIP_HIDDEN_ENEMIES=1 node --expose-gc --import tsx validation/world-cpu-comparison.ts /tmp/world-cpu-source-snapshot/world hidden
node --expose-gc --import tsx validation/world-matrix-candidates.ts /tmp/world-cpu-source-snapshot/world
node --import tsx --test validation/source-node-detach.test.ts
WORLD_SOURCE_QA_ROOT=/tmp/world-cpu-baseline-350f564/world node --import tsx --test validation/source-node-detach.test.ts
```

No timing thresholds are added to CI. Logs and unfiltered raw runs remain in
`/tmp/world-cpu-detach/`; no production renderer quality or shader experiment was
reintroduced. Browser WebGL/FPS and browser UI visual acceptance remain pending.

## Production integration and final directed verification

The accepted change is `src/visibleEnemyRoot.ts`, used only by
`WorldCombat.makeEnemy` for visual roots. Source-node detachment is **not** shipped.
No scene-wide override or static ART regrouping was added.

After integration:

- Combat/roles/enemy-model/encounter tests: **53/53**, including real production
  class scope, hidden/visible transforms, actual GLB load/recycle/death/revive.
- Production main DOM boot, real capsule/gate/target/reset, WorldActions,
  skill/resource budgets, authored routes, progress reset and actual travel/
  respawn integration: **57/57**. Log `/tmp/world-visible-root-integration.log`.
- Runtime typecheck and diff whitespace checks pass. Complete release testing is
  delegated to the root integration pass; these are directed checks, not a claim
  that the final complete suite already ran.

One independent confirmation process then runs the **actual integrated main**
with no experiment environment variables or method injection. Its results are:

| CPU ms / simulated frame | Median | p95 |
|---|---:|---:|
| Valley HQ | 1.762 | 2.583 |
| Winter wilderness | 1.867 | 3.614 |
| Kyoto wilderness | 1.876 | 3.108 |

This single confirmation is not mixed into the three-run candidate comparison.
It has zero captured errors/warnings and exactly the same resource inventory as
the candidate control. Its JSON flags `sourceNodesDetached:false` and
`hiddenEnemiesSkipped:false` mean **both experimental injection switches are off**;
the real production class supplies the behavior. The CPU timing window ended at
2026-10-30 05:50 UTC, before the final full build/test pass resumed.

Suggested Chinese handoff wording:

> 早期无 GPU 快照曾出现京都 CPU 中位数增加19%的风险，原始记录予以保留。
> 随后隔离确认隐藏敌人的矩阵遍历可以跳过；限定优化通过三轮独立对照、
> 真实模型生命周期测试及实际接入验证，CPU 代理负担明显下降。
> 尚未获得 WebGL／目标设备 FPS 验收，不能声称已解决原先27–40 FPS问题。
