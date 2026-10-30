# Companion CPU diagnosis and bounded query changes

These are CPU-only diagnostics using the real production main module, Napoleon GLB and world BVHs with an explicitly stubbed renderer. They are not browser FPS measurements. Full raw measurement data is in [companion-cpu-20261030.json](companion-cpu-20261030.json); additional diagnostic scripts and full logs are retained outside the published repository.

## Confirmed degenerate ray defect

`MountedCharge.resolve` observes a stationary target through `allyTrack`. That can request line of sight from a target position to the same position. Previously `combatTerrain` normalized a zero direction and submitted it to an unbounded BVH query.

Ten same-point queries in the real scene consumed **555.302 ms**, including **551.330 ms** inside the static BVH. Ten normal 0.1 m queries consumed **1.643 ms**. The approximately 55 ms per degenerate query is a concrete defect, not the cost of checking a horse-sized collider.

The repair returns `true` for finite coincident LOS endpoints without querying BVH, returns `false` for invalid LOS endpoints, and rejects degenerate/invalid casts. Ordinary wall checks, live collider enable state, endpoint tolerance and strict range boundaries remain in force.

## Diagnostic before/after scenario

The same external diagnostic fixture ran ordinary attacks, Q/X and regroup against a controlled opponent. Prototype wrappers were added in memory only; no production profiling hook was shipped.

| Inclusive CPU measurement | Before | After |
|---|---:|---:|
| 2,053 production RAF callbacks | 111,232.762 ms | 8,226.601 ms |
| 2,042 mounted updates | 99,636.894 ms | 681.661 ms |
| Whole process, including assets | 122,099 ms | 17,776 ms |

Both runs passed eight assertions/subtests. The full horse-body work remains: before/after path calls were 1,280/1,279, ground calls 6,319/6,315 and body-clearance calls 5,110/5,107. Small count differences reflect live frame and asset work. The expensive zero query was removed; collision safety was not removed.

These are only two cloud diagnostic runs. Other code was being integrated, and wrapper overhead was not independently quantified. Timings are inclusive/nested and must not be summed. Do not turn these totals into an FPS claim or a whole-release improvement percentage. The separate degenerate-ray measurement and regression assertion that BVH is never entered establish the specific eliminated cause.

## Finite cast bounds

Normal casts now pass `far=max` to the BVH, retaining default Infinity, strict `hit.distance < max` and the original first-collider tie order. Four hundred deterministic casts across real Valley, Winter, Kyoto and arena terrain matched in hit distance, point and face index. Six alternating batches of 1,200 casts measured a median of **13.189 → 11.066 ms per batch**. This is a local query sample, not saved frame time.

Permanent tests cover zero/invalid rays, finite bounds, exact range boundaries, same-distance ordering, Infinity and live enable changes. The directed zero-ray/terrain suite passed 9/9 before aggregate release validation.

## Foot navigation: optimization versus intentional safety repairs

A separate query comparison tested conservative immutable-BVH bounds and finite ray lengths against the old equivalent algorithm: 32 actual colliders, 300 positions and 900 queries per corpus, repeated four times per batch with eight alternating batches. BVH calls changed from **459,764 to 14,924 per batch**; median batch time changed from **295.857 to 67.881 ms**. Bounds use BVH identity and read `enabled` on every query. Replacing a BVH is supported; future in-place refits require explicit invalidation.

Later behavior fixes intentionally change unsafe old results and are not included in that equivalence claim:
- Each walking floor sample checks upward head clearance of 1.65 m from a 0.12 m offset.
- Failed lateral regroup slots can use checked front/back centreline slots 1.6 m away, with lateral foot support.
- Tests cover low ceilings, a supported 1.2 m bridge, rejection of a 0.6 m/broken bridge, gate toggles and side-slot priority.

No movement/collision frequency, AI population, texture quality or rendering resolution was reduced. The existing Node loader deprecation notice remains unrelated to these changes. Actual Mac performance and browser GPU appearance are unverified.
