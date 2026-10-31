# Saber grounded locomotion: independent input QA

## Recommendation and boundary

Recommend the bounded grounded-stride candidate for the next frozen regression,
subject to root visual acceptance and that exact checkpoint's full suite. This
is not a GPU/FPS claim, human playtest, exhaustive terrain proof, or repair of
the inherited sword-floor intersection. The original relaxed carry and grip
remain the acceptance target; changed lower gait/cloth timing is intentional.

Accepted source slice: `8450f5314fbf07ff0a95a62b71be033f18a96a14`.
The recorded candidate hashes precede whitespace-only cleanup in the stride
sampler/runtime; actual-main lifecycle is rerun against this committed slice.

## Actual main versus preserved release

`world/validation/characters/saber-main-input-independent.ts` boots production
main, loads the native GLB, presses the configured summon key, and drives real
mouse/W/sprint events through ordinary physics. Legacy recruitment is explicit;
Winter and Britain each use one supported player-entry placement followed by
natural settling. No forced grounding, companion transforms, HP, target, damage,
or animation-controller writes occur. This is local traversal, not a full travel
playthrough. Both outfits are selected in the initial cosmetic-save fixture.

Each outfit records 720 matched frames against frozen `78c8ea1`:

- Player and companion root XYZ are exactly unchanged; root yaw and animation
  state are equal at each sample. Both runs contain 343 Run frames.
- Candidate support reports positive adjustments in all 720 recorded frames.
- Actual upper-rig (Spine/Neck/Head/Shoulder/Arm/Hand) local scalar difference is
  at most `3.565798323279523e-8`, below the explicit `1e-6` assertion.
- The wider non-leg bone census includes **lower clothing**. Its ~0.121 maximum
  quaternion-component difference is `RuntimeSkirtFront`, not an upper-arm/grip
  change. Armor frame 239 differs by about 13.94 degrees in that panel. Do not
  describe the entire old/new skeleton as wall-clock identical.
- New solver-only upper neutrality at identical animation timing is separately
  covered by the animation owner's positive upper-carry preservation test.

Workspace evidence: `qa/saber-main-input-{baseline,candidate}-{armor,civilian}.json`
and matching logs. Candidate reports include source hashes. Baseline is the
unchanged green frozen world, not the new class with its solver disabled.

## Input interruptions and replacement

`world/validation/saber-input-lifecycle-independent.test.ts` verifies:

1. Native support is actually queried after ordinary movement.
2. Pause freezes all bone/root/support state for 120 frames.
3. The first resumed zero-dt frame preserves every bone and root exactly.
4. Recall while the player walks freezes the hidden actor's pose and work
   counters; normal resummon remains finite and visible.
5. The actual outfit panel replaces armor with civilian, detaches the old model,
   preserves recruitment/summon state, and the new actor positively solves
   terrain without overflow after ordinary movement.

An initial assertion also required diagnostic work counters to remain identical
on the first resumed frame. That was overstrict: the zero-dt solver recomputes
96 height queries without changing any pose/root component. The original failed
log is retained; the final test checks pose/root explicitly and logs counters.
This was a test-contract correction, not a hidden product failure.

## Cache safety

`world/validation/characters/saber-terrain-patch-independent.test.ts` has four
positive cases: versioned BVH refit, oversized-list recovery, explicit clear
with relocated geometry, and index identity/version changes. It exposed a
stationary recovery bug after exceeding the 256-collider cap; the owner fixed
that before acceptance. Immutable world-space BVH contract still applies:
unannounced raw geometry writes require explicit clear or version updates.

CPU geometry/Blender temporal evidence remains separate from WebGL output.
Known inherited blade/terrain intersections and dense-mesh submillimetre sole
error are documented by the animation owner, not concealed by these tests.

## Full-suite finding and product correction

Frozen `276313d` was **not green**: World 1467/1468, with an unsupported/no-leg
rig incorrectly receiving calibrated procedural cadence although it could not
apply that stride. This was a genuine fallback gap, not an obsolete test.
`ebdc432` preserves the original nominal cadence on unsupported rigs; `0f874b0`
also guards partial rigs before procedural application. The original
`companion-motion.test.ts` is byte-identical to the failed freeze
(SHA-256 `99ae32238fb663fce0a237f1a340c35aa7cc874e53d8f6c24e71b478613307aa`).
Independent rerun of that unchanged suite plus positive native input lifecycle:
11/11 pass. Evidence: `qa/saber-fallback-original-independent-0f874b0.log`.
The frozen failed log and independent before/after source manifests remain.
A new exact-source full aggregate is still required; targeted passes do not
retroactively turn the failed checkpoint green.
