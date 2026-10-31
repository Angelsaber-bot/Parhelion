# Saber grounded stride — 2026-10-31 candidate review

**Status:** approved for scoped integration after independent runtime QA, 08:17 UTC. This does not claim
FGO visual parity, WebGL/GPU performance, or a fix to the inherited sword-floor
penetration. The relaxed downward carry, original sword/grip, upper-body carry
curves and independent 2.4-second carry clock are preserved.

## What changes

- A speed-calibrated lower-body stride replaces rapid short-foot cycling without
  changing companion navigation, travel-speed limits, root trajectory or attack
  contact clocks. World-space stance anchors release at toe-off, finite reach,
  discontinuous rejoin or changed support; legitimate running flight remains.
- Lower-body targets, rather than bone quaternions, blend across gait changes.
  Skirt response is bounded rather than lifting the front panel like a board.
- A still-visible gait keeps its live phase when an interrupted fade returns to
  it. The actual 120 Hz Kyoto route exposed a 21.5 m/s foot pop from rephasing a
  31%-weighted Run action; the regression now exercises Run→Idle→Walk→Run.
- `ActionBlend` supports optional smoothstep weights. Default behavior for other
  actors remains linear; Saber opts in. Mixer/action clocks are not retimed.
- `SaberGroundedLocomotion` owns only locomotion lower-body support. It restores
  its changes before mixer evaluation and detaches terrain support immediately
  on Attack/skill ownership. Legitimate outgoing Run contribution still fades
  normally. After the fade, authored Attack lower curves own exactly.

## Support geometry and bounds

`SaberTerrainPatch` snapshots existing **world-space collider BVHs**, not a second
physics world. Stable patches perform no BVH query. Source invalidation checks
collider identity, enabled state, BVH identity, and position/index identity and
version. In-place refits must mark changed attributes `needsUpdate`, replace the
BVH, or explicitly call `clear()`; unannounced raw writes are not hashed per frame.
`clear()` also discards cached BVH bounds.

Hard bounds: 256 collider records, 512 retained walkable triangles, 2,048 visited
bounds and 4,096 visited source triangles per refresh. Triangle storage is 53,248
bytes. Overflow, missing support, nonfinite input and excessive support height are
explicitly unsupported; partial caches do not fabricate a planted foot. Unreachable
anchors release through the existing bounded recovery; the rig never stretches. Independent
QA tests cover overflow recovery, real versioned BVH refits, explicit raw-refit
notification, index identity/version changes, and finite-height selection.

A cached footprint plane supplies orientation; exact cached triangle heights
bound measured sole extrema. Fixed scratch vectors/quaternions and offset arrays
are reused after construction. No global body lift, hip lowering or leg stretching
is introduced. Idle/Walk retain their authored gait and receive bounded support.

## Evidence and honest tolerances

Evidence root (private workspace, not publication):
`parhelion-eight-hour-evidence/animation/`.

- `saber-winter-30fps-before-after.mp4` / `.webp`: 81 same-clock frames, 30 fps,
  2.7 seconds, actual Winter collision surface; neutral QA material, not game
  lighting. Root and independent QA inspected consecutive ordinary/turn/settle
  boards. Source head/feet stay framed and upper carry remains recognizable.
- `saber-britain-armor-30fps-before-after.*`: matching armor descent review.
  A post-export reproduction of frame080 matches all 30 mesh position payloads
  byte-for-byte (`saber-britain-production-source-proof.json`).
- `saber-runtime-paired-{civilian,armor}-{30,60,120}hz.json`: baseline/current
  comparisons in the **same loaded collider scene**, including HQ, Kyoto, Winter,
  Britain and False Dawn approaches. Controller roots/paths are compared directly.
- Earlier probe-only results were approximately +0.499 mm. Dense actual skinned
  vertices are the stronger boundary: 934,250 civilian samples found a worst
  **−0.406 mm**, and 16,045,870 armor samples a minimum **+0.287 mm**. We use a
  **1 mm dense-mesh tolerance**, not a false claim that every rendered vertex is
  above the proxy margin. These are CPU geometry measurements, not pixel-derived
  submillimeter assertions.
- The rejected post-process prototype achieved positive proxy clearance but
  displaced a nominally planted foot at 3.75 m/s. It was **not integrated**. Support
  now precedes anchor creation, and final targets are checked after blending.
  Older `maxTargetError` values in prototype exports meant an unused proposed
  full-Run target; `SABER_TERRAIN_PREVIEW_BOUNDARY.txt` explains that distinction.
- Three paired CPU runs across six routes: original median **0.112 ms/actor tick**,
  consolidated candidate **0.196 ms** (about **+0.084 ms**). Navigation rays were
  identical (12,029), with 98 added patch shapecasts total. This is a disclosed CPU
  visual-quality cost, **not** a claimed performance optimization or real FPS.
- 120 Hz Kyoto original peak foot velocity/acceleration: 13.93/14.03 m/s and
  1370/1032 m/s² (walk/sprint routes). Corrected candidate: 9.14/8.62 m/s and
  981/806 m/s². Stable planted drift is measured separately from swing/stop impulses.

## Ownership / safety checks

Focused tests include finite-leg slopes at30/60/120Hz, full follow routes, sharp
pivots, zero-time pose idempotence, normalized fades and exact action clocks,
unsupported cache recovery, actual-main native GLB execution, attack contacts and
no-target ultimate protection. Additional lifecycle coverage begins a private
Saber stage from grounded Run, interrupts during the180ms attack blend, confirms
source transforms are untouched, verifies exact authored Attack after fade,
cancels back to locomotion, and swaps outfits without retaining retired support.

No main/runtime API hook, enemy AI edit, shared damage rule, source asset rewrite,
public deployment or publication is part of this slice. The existing blade-floor
clearance issue remains a **separate, review-before-integration** pose candidate.

## Independent actual-main review

The normal-input armor/civilian Winter/Britain pairing against frozen `78c8ea1`
uses720 frames per outfit. Player/companion XYZ and animation states match exactly;
actual upper carry locals remain at floating-point tolerance. The intended skirt
change is reported separately (the front-panel delta is not an upper-arm change).
See independent QA reports for exact source hashes and interruption outcomes.

Pause/resume evidence preserves bones/root exactly. A first resumed zero-time
frame may recompute cached height queries without advancing pose; diagnostic work
counters are not animation clocks. Recall freezes hidden actor updates, resummon
remains finite, and the actual outfit panel replaces the retired model/support.
