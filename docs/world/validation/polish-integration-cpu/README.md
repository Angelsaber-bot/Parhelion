# Final polish whole-iteration CPU regression probe

Read-only run on 2026-10-30 12:43:45–12:44:52 UTC. Node 24.22.1; fresh processes in expansion/polish/polish/expansion order. The same final polish `world-cpu-comparison.ts` and `world-dom-boot.fixture.ts` loaded the two real source/asset trees. No CPU_* diagnostic injections. No source changes or extra source copies.

Source A: published `b3a230c62d8271f4c04baebb6e2a8f55c1e050de` source tree, verified against its original 745-file source manifest and all 120 published changed-file hashes.
Source B: the final polish tree, verified against the 976-file source manifest accompanying this release.

## Method and boundaries

Actual production main, real assets/BVHs and simulation, deterministic no-GPU renderer/DOM harness. Each of three locations gets 180 warmup and 600 measured frames at fixed 1/60 simulated seconds. HP is kept alive outside timing; real asset promises yield outside measured frames. GC before final memory measurement. This is a CPU proxy, not a GPU frame-time or FPS benchmark. Two samples per version are a limited cloud-noise regression screen, not a robust speedup estimate. jsdom cost and asset arrival differ from browsers; raw object geometry totals are resident inventory, not visible draw count. The script does not inventory GPU texture memory.

## Results

Each table number is the median of two process-level statistics; it is not a pooled frame percentile.

| Location | Old median ms | New median ms | Old p95 ms | New p95 ms |
|---|---:|---:|---:|---:|
| Valley HQ | 2.981 | 2.191 | 6.050 | 4.760 |
| Winter pack | 3.648 | 2.764 | 7.260 | 7.165 |
| Kyoto node | 2.726 | 2.428 | 5.761 | 6.028 |

No consistent significant regression observed. First-pair Winter median regressed 2.807→3.244 ms, but reverse-order pair improved 4.489→2.283; Kyoto p95 aggregate was slightly worse. Therefore do not promote a whole-frame percentage or FPS claim. All four processes exited 0 with zero harness-captured application errors/warnings. Each stderr contains the same Node `THREE_CJS_DEPRECATED` loader deprecation warning; this is not a new-version-only failure. Final positions and active-enemy counts matched exactly at every location (0/2/3 enemies).

Both trees: 11030 objects, 9384 meshes, 20 lights, 5149 geometry identities, 1318 materials. New authored art adds 1160 resident unique-geometry triangles (7941333→7942493) and 150148 geometry backing bytes (409919360→410069508). These counts exclude textures; station texture cost is separately documented in the art budget. Median post-GC heap increased approximately 3.82 MiB (112.21→116.04 MiB), consistent with guarded static-traversal bookkeeping. RSS and external/ArrayBuffer memory have asset/GC timing noise; retain raw values rather than attributing their delta.

`summary.json` includes statistics, resources, memory, and raw-file SHA256. `expansion-{1,2}.json`, `polish-{1,2}.json` are the published raw measurement evidence. The original stderr logs are retained separately and contain the identical loader deprecation quoted above. No runtime or tests were modified for this probe.
