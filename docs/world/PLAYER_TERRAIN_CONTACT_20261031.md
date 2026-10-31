# Native player lower-leg terrain presentation — 2026-10-31

## Accepted scope

Root approved the v9 visual-only production slice after matched temporal review and independent lifecycle verification. `SkinnedCharacterAnimator(rig, optionalSupport)` keeps its original no-helper path. Main supplies `new PlayerTerrainSupport(rig, colliders)`. The helper changes only lower-leg targets and foot orientation; controller/root, hips, upper body, rifle, hands, aim and damage are not changed. Reset delegates to the CPU cache. There are no GPU resources, listeners or timers requiring separate disposal.

The native sole calibration contains 33 extrema per foot, selected from 1,441 Foot/Toe-weighted vertices per foot. Regenerate it when the approved native player mesh changes; this is not a generic arbitrary-scale rig solver. Existing `SaberTerrainPatch` and `SaberFootSupport` supply bounded cached collision surfaces, not new physics or fresh terrain rays every frame. The patch caps 256 colliders, 512 triangles, 2,048 bounds and 4,096 visited nodes and fails closed on overflow. Existing geometry identity/version invalidation applies; raw CPU geometry refits without version updates require explicit cache clear.

Grounded stance follows the cached surface, while the existing swing weight progressively relaxes the ankle toward its authored orientation. Target height is bounded to −0.10/+0.22 m, with a finite five-step orientation compromise and the original finite limb reach. No root/hip lift, universal foot locking or limb stretching is introduced. Flat/absent/overflow surfaces retain authored poses. Jump, glide, swim, flight, melee and its complete 180 ms release tail exclude support. Scratch vectors/quaternions are reused; per-frame loops and cached height queries are bounded.

## Verification

- Existing player/character family: **105/105 passed**; configured World TypeScript check passed. Original wrist/weapon/shot constraints remain unchanged.
- Dense same-controller 30/60/120 Hz route comparison: 1,776 matched frames, all 2,882 native foot-weighted vertices per frame. Root/controller, hips/upper/gun and contact phase invariants remained exact. Worst measured grounded sole penetration was **0.675 mm**, within the declared 1 mm tolerance.
- Independent actual-main **default production attachment, without an animator adapter**: 480 exact paired controller/HP/energy/camera/gun/non-leg frames versus frozen e7 baseline; 1,014 positive adjustments, 78 excluded air/melee updates, and real reset/prepareShot calls. Two unsupported startup reads safely retained fallback.
- Independent cache/lifecycle tests cover first-frame vertical air-to-land relocation, reset after invalid support, collider enable/refit/overflow recovery, and the entire melee release tail. Synthetic 512-triangle support passes; 513 triangles fail closed. Cached height queries stay at or below 500/update in the tested worst-case fixture.
- Root and independent QA reviewed final v9 matched travel, step and settle consecutive frames; no obvious sampled snap, with clearer boots and restrained swing ankle rotation. The first 0–0.017 s diagnostic frames are terrain-occluded and are **not** visual contact proof.

## Costs and limits

Quiet, globally gated CPU native-animator replay used actual collision geometry and recorded controller positions, with reconstructed animation speed/heading: three 12,000-update pairs measured **+0.02556 / +0.03108 / +0.03606 ms/update**, median **+0.03108 ms**. This is a bounded quality cost, not an optimization or a WebGL/GPU/FPS result. There were 44 active cached triangles, 791 refresh/shapecasts per measured 12,000 updates, no overflow and no new BVH floor rays. Synthetic maximum-triangle tests establish bounds, not a quiet worst-case timing claim.

Brief finite-reach stance gaps remain (Winter maximum about 31–41 mm across measured rates, improved from about 56–59 mm). Intentional run flight is not forced into planted contact. Airborne step intersections are deliberately unchanged (including the inherited Kyoto overlap); this is not universal clipping elimination. CPU renders use actual collision terrain and optionally actual camera projection, but neutral lighting and explicit omission of GPU-extruded outlines: they are not captured game frames. Saber sword-floor clipping is a separate inherited limitation and was not changed.

## Reproduction and evidence

From `world/`:

```sh
node --import tsx --test validation/player-terrain-support.test.ts
node --import tsx --test --test-concurrency=2 validation/player*.test.ts validation/character*.test.ts
npx tsc --noEmit
node --import tsx validation/characters/audit-player-real-foot-contact.ts /workspace/path/report.json --dense
node --expose-gc --import tsx validation/characters/profile-player-terrain-support.ts /workspace/path/profile.json /workspace/path/report.json
node --import tsx validation/characters/inspect-player-sole-bind.ts /workspace/path/recalibrated-sole.ts
```

The optional audit `--candidate` adapter is for walking export only; it does not establish lifecycle forwarding. The independent default-production lifecycle runner is the stronger reset/shot proof. Freeze or select an explicitly old `--world-root` for baseline comparisons; current main now attaches support by default.

Evidence remains in sibling `parhelion-eight-hour-evidence/animation/`: `player-support-v9-{30,60,120}hz.json`, `player-support-v9-rate-summary.json`, `player-support-v9-quiet-profile.json`, `player-support-v9-ankle-envelope.json`, `player-support-v9-{start,travel,stop,settle,rest,step}-consecutive.jpg`, and `player-support-production-full-family.log`. Independent reports are under `qa/player-support-main-production*` and the companion QA document. Earlier v8/prototype outputs remain historical, not the final ankle-motion proof.

## Committed-source closure

Source `d9da884`, real main hook `2b0dc44`, and independent lifecycle evidence `c59950e` are durable. A post-commit default-main replay (no adapter) measured 559 dense Winter/Britain/Kyoto frames: root, upper, gun and contact states exactly match the approved v9 sequence, with **zero difference in every recorded sole minimum** and positive production support. Reports: `animation/player-support-production-committed.json` and `player-support-production-committed-parity.json`.

An additional 681 matched sprint and 180-degree turn frames preserve root/upper/gun/contact exactly. Grounded minima improve to +0.14–0.67 mm; excluded airborne overlaps remain exactly baseline, including the roughly −138 mm turning/airborne overlap. This residual is not a new grounded support claim. See `player-support-v9-sprint-turn-pair-summary.json`.

The full-rate matched offline video is `animation/player-support-winter-v9-before-after.mp4`: baseline left, v9 right; 161 frames at 60 fps, 960×480. Consecutive stills were inspected; encoding a full-rate video is not itself a claim of independent animated playback review. The first two diagnostic frames remain terrain-occluded.
