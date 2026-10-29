# Saber normal-follow carry correction

## Cause
The previous carry layer applied to Idle and Walk only. Actual player walking speed is 5.5 m/s; Saber switches from Walk to Run above 1.34568 m/s. Normal follow therefore used the unchanged raised-sword Run upper body. This was a runtime state-coverage bug, not evidence of stale models. The previous 1 m/s follow test did not cover normal travel.

## Change
Idle, Walk and Run now share the accepted original stationary upper-body carry and its independent breathing clock. Only locomotion hips/legs/lower garments use Walk/Run curves. Attack remains authored and blends out of the carry layer normally. No model assets, travel speed, damage, targets, or other characters changed.

## Verification
- New test exercises actual ContractServant.update on collidable ground, both armor and civilian models, at player speeds 0 → 1 → 5.5 → 9 → 0 m/s.
- Regression reproduced in the pre-fix version for both outfits immediately after entering Run.
- Fixed normal-follow state: 239 of 240 normal travel frames used Run; all 180 sprint frames used Run. All 54 animated upper-body quaternion tracks stay within 8.43e-8 radians of the original idle reference, including acceleration and stopping. Separate reference checks cover all 55 upper nodes, positions and scales, at Run rates 1 and 3.
- Interrupted Idle/Walk/Run/Attack blending, original attack poses, lower-body tracks and unchanged source assets passed regression checks.
- World: 424 tests passed. TypeScript and Vite production build passed.
- Actual runtime normal-follow snapshots were CPU-skinned after 180 public update calls at player speed 5.5 m/s, using the pre-fix source for comparison. They are offline material renders, not browser/GPU or public-site acceptance.

See [normal-follow comparison](saber-follow-fix-20261029/normal-follow-before-after.jpg).

No GitHub publication or deployment is included in this validation step.
