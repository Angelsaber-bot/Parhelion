# Net resource and modeled CPU census — 2026-10-31

## Exact comparison and limits

Baseline `9c6cd86e84f3130e0eab6dc416ec1383e520a8f0` versus accepted `67f6a1a65b93daa137f004cf7f4e07241588fe3d`, isolated immutable checkouts. Independent tracked-file hashes match before/after (baseline 1,331 files; final 1,676). The external QA harness revisions are recorded in the numeric receipt, not misrepresented as part of the historical source.

**Memory/allocation improved; this measurement does not demonstrate a frame-rate improvement.** Real WebGL, shaders, rasterization, shadow passes, postprocessing and device VRAM were unavailable. Old source has mixed-constructor native-path omissions under this headless adapter; final source restores those paths. Matching mixer counts do not establish identical browser work. We did not patch the historical baseline to hide that difference.

## Net attached resources, including added content

After the same HQ → Winter → Kyoto passive workload and asset settling:

| Metric | Baseline | Final | Net change |
|---|---:|---:|---:|
| Attached geometry backing-store bytes | 410,114,268 | 307,583,660 | −102,530,608 (25.0%) |
| Materials | 1,322 | 1,195 | −127 |
| Lights | 20 | 14 | −6 |
| Scene objects | 11,060 | 10,930 | −130 |
| Meshes | 9,410 | 9,464 | +54 |
| Geometry objects | 5,161 | 5,215 | +54 |

The exact −102,530,608 backing-byte difference also holds in **all 36 matched-camera samples** (nine views × landscape/portrait × low/normal quality). This counts unique attached JavaScript backing stores, including hidden geometry, not VRAM. Detached consumed collision/marker source geometry is not a visual triangle reduction. Per-root shared bytes are never summed.

Three fresh-process post-GC median counters:

| Counter | Baseline bytes | Final bytes |
|---|---:|---:|
| ArrayBuffers | 526,682,631 | 434,212,423 |
| External | 563,547,125 | 471,825,115 |
| Heap used | 122,356,264 | 125,696,048 |
| RSS | 1,151,049,728 | 1,051,566,080 |

These are observed process counters, not independently attributable or additive savings. Heap use increased approximately 3.34 MB. No raw heap snapshot was created or distributed. The asset adapter uses placeholder decoded image dimensions; these figures do not account for actual device texture allocation. On-demand combat peaks beyond this workload are not covered.

## Candidate rendering workload did not generally decrease

Final camera position, quaternion, FOV and aspect are copied exactly from each baseline sample. Visibility ancestry, camera layers, geometry draw ranges, material groups and instances are counted; occlusion and actual GPU passes are not. Normal-quality landscape examples:

| View | Candidate groups before → after | Candidate triangles before → after |
|---|---:|---:|
| Valley HQ | 584 → 584 | 1,115,305 → 1,115,305 |
| Britain town | 499 → 499 | 1,068,853 → 1,068,853 |
| BlackSail port | 409 → 418 | 818,661 → 843,601 |
| Winter pack | 345 → 355 | 955,179 → 996,463 |
| Kyoto node | 836 → 839 | 1,652,460 → 1,739,083 |
| Kyoto south | 1,101 → 1,103 | 2,180,977 → 2,237,969 |
| Alpha array | 460 → 464 | 869,110 → 875,462 |
| BlackSail field | 384 → 419 | 779,108 → 872,140 |
| Winter field | 350 → 353 | 652,213 → 654,823 |

Added locations and restored native presentation increase several visible candidate budgets. We do not claim material reuse reduced draw groups, nor that a lower scene-node count proves faster rendering.

## Modeled CPU result: increased work, not a claimed speedup

Exclusive admission window 11:06:17–11:07:32 UTC, six fresh processes in AB / BA / AB order; 180 warm frames and 600 measured frames per scenario. Regional native assets settle before measurement. Real simulation, animation, DOM and stub-renderer matrix traversal run; the passive player's HP is maintained solely to avoid comparing an alive scene with a cheaper defeat/menu path. This is diagnostic setup, not gameplay evidence.

| Scenario | Median of process medians, baseline → final | Baseline process p95 range | Final process p95 range |
|---|---:|---:|---:|
| HQ terminal | 1.548 → 1.699 ms | 2.223–2.612 ms | 2.437–2.951 ms |
| Winter pack | 1.703 → 2.079 ms | 2.464–2.731 ms | 2.836–3.989 ms |
| Kyoto node | 1.616 → 2.164 ms | 2.097–2.280 ms | 2.409–4.026 ms |

All three deterministic state hashes repeat within each source; HQ/Kyoto hashes also match across sources. Winter has a tiny floating-point position difference, so cross-source bit identity is not claimed. Active enemy counts and native mixer counts are 0/2/3 in both sources, with no failed/pending native assets or captured errors. Added animation/support/content and corrected native-path execution mean this is not an equivalent browser benchmark. Do not convert these times to FPS or interpret them as worst-case bounds.

## Reproduction and evidence

- `validation/world-cpu-comparison.ts`: manual modeled CPU runner; diagnostic skip/profile environment switches remain **off** in this comparison.
- `validation/runtime-scene-audit.ts`: structural-brand inventory, normalized/interleaved backing-buffer accounting and exact reference-camera option.
- Workspace evidence `qa/final-cpu-{baseline,final}-{1,2,3}.{json,log}`, `qa/final-cpu-gate.log`, `qa/final-census-{baseline,final}-{low,med}.{json,log}`, `qa/final-net-summary.json`, and before/after source hash receipts.
- Sanitized numeric summary is retained beside this document. It contains no heap contents, credentials, browser state or unrelated data.
