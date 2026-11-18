# Post-processing pipeline pass — 2026-11-18

## Harness

`tools/perf/bench.py` (also `npm run perf -- …`) drives the built site (`site/dist/public`) in silent headless Chromium. It uses the real GPU through ANGLE Metal with vsync and the frame cap off.

- **World:** visits all ten safe-travel stops.
- **Arena:** plays every map with `Math.random` seeded, so bots always field the same heroes and kits.
- **Compare:** `bench.py compare before.json after.json` prints the differences.
- **Output:** `--shots DIR` saves a screenshot per view.

Machine for the numbers below: Apple M2, 1600×900, DPR 1.

Measurement caveats, learned the hard way:

- **Per-pass timers:** `EXT_disjoint_timer_query_webgl2` spans overlap on ANGLE Metal, so per-pass GPU timings are unreliable. Use only the whole-frame span, and trust the uncapped frame interval more than either.
- **Throttling:** the fanless M2 throttles within minutes, and the same build drifted from 40 to 117 ms. Compare builds by interleaving them (A, B, A, B on the same views) and comparing paired medians. Never compare against a baseline recorded earlier.
- **CPU limit:** World med and low are limited by the JS frame (about 13–15 ms in the rAF callback) as much as by the GPU. Turning bloom off cut GPU time by 4 ms but frame time by only 0.6 ms.

## Changes

| Change | Where | Measured |
|---|---|---|
| High quality multisamples only the scene pass (`world/src/rendering/msaaScenePass.ts`). The composer's buffers are single-sample. | World `?q=high` | Five paired rounds. Frame-time median 43.5 → 29.8 ms (Valley HQ) and 32.6 → 22.7 ms (Egypt). GPU span roughly halved. |
| GTAO normal pre-pass, AO and denoise run at half resolution (`POST_SCALE.ao`). | World high | Included above. In live toggles it took about 7 ms per view off the GPU span on top of the MSAA change. |
| Bloom mip chain starts at a quarter of the frame. | Arena high | Same-page toggle: 0.5–0.8 ms per frame (about 10–15%). |

Arena high was already at 4–6 ms per frame uncapped.

## Rejected after measuring

- **Half-resolution bloom in World:** no gain, because the cost is fixed per-pass overhead, not pixels.
- **Single-sample composer for World med (2× MSAA):** no gain within noise, plus an extra full-screen copy. Medium and low keep their exact previous pipeline.

## Image check

World high before/after screenshots at four stops differ by 0.7–2.4 mean grey levels. Most of that is animated grass and characters; AO is slightly softer at crevices.

Arena full- vs half-resolution bloom differs by 0.2–1.1 grey levels.

`world/validation/post-scale.test.ts` pins the helper and the per-quality wiring.

## Follow-up: heroes, maps and the World CPU frame (same day)

### P3: Arena maps are not the problem
With the bot lineup pinned, all nine maps cost 3.5–5.8 ms (low) and 7–14 ms (high) of GPU time.
The earlier "heavy" Lishan / Orleans / Sun Temple numbers came from which heroes the bots happened to pick.

### P2: lighter Arena hero copies
Hero meshes are the real Arena cost. Three Artoria bots on screen cost about 3.4 ms of GPU time at low quality (917k triangles each, drawn again for shadows).

`world/tools/build-arena-heroes.ts` builds Arena-only copies of the World masters:
- meshoptimizer simplification toward 120k triangles, bounded by 0.2% geometric error, seams kept;
- textures capped at 1024 px as WebP;
- quantized geometry with meshopt compression;
- Napoleon's hidden horse left out.

The skeleton, clips, morph targets and materials are unchanged.

| Measure | Before | After |
|---|---|---|
| Artoria triangles | 917k | 128k |
| Three Artoria bots, GPU time | 3.4 ms | 0.7 ms |
| Hero downloads | 91 MB | 39 MB |
| Built Arena | 162 MB | 113 MB |

Lobby close-ups of all seven heroes look the same side by side. World keeps the masters for its close-ups and cinematics.

A lossless meshopt copy of the masters was also tried and dropped. The masters are already shipped gzipped, so it would have grown the download (118.9 MB vs 104.4 MB) and only reached 92 MB with gzip on top.

### P4: World CPU frame
Profiling World at medium quality at a tiny viewport (so the GPU is idle) put about 40% of the JS frame inside collision raycasts:
- `nearestInteract` ran a line-of-sight test for every field-chapter marker in the World, every frame, before checking distance. That alone was 34% of all CPU samples.
- Every ray called into all 366 collider BVHs.

The fixes:
- Distance is checked first. Every branch already required the marker to be within its radius, so behaviour is unchanged.
- `castAgainst` skips colliders whose live BVH root bounds the segment never enters. A test checks 4000 random rays plus moving, refit, toggled and inside-the-box cases against brute force.

JS frame: 13.0 → 5.9 ms at Valley HQ and 13.7 → 6.3 ms in Britain.

The remaining CPU cost is mostly three.js matrix updates for gameplay content (exploration items, field sites, residents and enemies, about 0.9 ms). Region art is already frozen. The rest animate their own parts, so freezing them needs per-module care.

### P4b: arriving in a region
Fast travel used to freeze for one long frame on the first arrival in a region. The cause was the streamed art install: de-quantization, per-mesh landscape carving, chunking and outlines all ran as one task.

After boot, the install now runs in 8 ms slices. It yields between meshes and chunk pieces, and checks disposal or abort after each slice. `chunkMesh` also uses integer cell keys.

Worst frame on first arrival (prod build):

| Region | Before | After |
|---|---|---|
| Britain | 458 ms | 174 ms |
| Kyoto | 377 ms | 216 ms |
| Winter | 217 ms | 36 ms |
| Qin | 206 ms | 31 ms |
| BlackSail | 174 ms | 74 ms |
| Orleans | 109 ms | 27 ms |
| Egypt | 106 ms | 30 ms |

Left over:
- **Britain:** one mesh's runtime landscape clearance (`relocateFarCamelot` and `editComponents`, about 300 ms in one call). Precomputing it in `build-stream-assets` would remove it.
- **Kyoto:** a shader's first use (program link).

### P5: visuals
Arena map textures now use up to 8× anisotropic filtering, so distant floor tile seams stay crisp. World terrain is mostly vertex-coloured, so this matters less there.

### Measurement caveats
- On ANGLE Metal, a JS frame that blocks on the GPU looks like CPU time. Separate the two by shrinking the viewport, as in the P4 profile above.
- Heavy benchmarks running alongside the World DOM tests slow them enough to time out: two graphics-recovery tests failed that way and pass alone (about 14 s each).
