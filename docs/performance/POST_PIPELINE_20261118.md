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
