# World rifle ADS elbow pass — 2026-10-31

The right elbow now settles below the rifle stock during level/upward shoulder aim. This is a bounded elbow-circle/pole adjustment, **not** a weapon redesign, shoulder displacement or change to limb length. With fixed shoulder and wrist endpoints, elbow flexion magnitude cannot change; the improvement is orientation, silhouette and sleeve/stock clearance.

The correction is `-smoothstep(adsPose, 0, .8) * smoothstep(pitch, -.5, 0)`, multiplied by existing rifle-contact and non-carry weights inside the right-arm solver. `adsPose` is the existing damped ADS state; immediate `fireAim` does not activate it. The optional solver parameter defaults to zero, retaining other callers. Pitch <= -0.5 rad retains the historical pole. No new controls, collision queries, animation clocks or state caches were added.

Production `world/src/skinnedCharacter.ts` SHA-256: `7754c07b8136697902309e235bb050df189605afe475e66052742f72f815c17b`.

## Invariants and positive verification

- Independent frozen pre-change reference: git blob `74562c4fbd3b3cc3977dd93b2d945311fb7c7348`, SHA-256 `9593a6faee25f1a16bc5e809ea40e33e6ab25d50289afd9464118a036f2d4559`; fixture records import-path-only adjustments.
- Independent 30/60/120 Hz boundary sequence: exact gun world matrix, muzzle position and non-right-arm local components; palms differ by at most 7.70e-16 m. Positive right-arm changes are required. Before ADS and at extreme downward pitch, right-arm pose remains exactly historical.
- Native 1,440-frame ADS/turn/jump-state/glide/melee/unarmed sequence preserves exact gun/muzzle and all non-right-arm bone locals, including finger locals. Palm tolerance is 1e-12 m. Reset clears corrective ownership.
- Immediate and repeated hip-fire at five pitches and three headings remains exactly historical, including all bone locals and shot origins. An earlier candidate incorrectly used immediate fire presentation and added an elbow snap; it was rejected before production.
- Positive actual-native stock/sleeve geometry regression: historical level full ADS intersects the stock; the accepted level pose has no tested stock/sleeve triangle crossings. Existing full-pitch palm/barrel/head and melee tests pass unchanged.

Commands from `world/`:

```
npm run typecheck
node --import tsx --test validation/player-skinned.test.ts validation/player-melee-pose.test.ts validation/characters/player-ads-boundary-independent.test.ts
node --import tsx --test validation/player-ads-pole.test.ts
```

## Honest limits

This is **not clipping-free**. The 341-pose settled matrix retains sleeve/receiver contacts and introduces some small contacts with previously untouched submeshes while removing much larger stock overlap. Measured summed triangle-intersection line extent improves in 198 poses, is unchanged in 141, and increases slightly in two (worst +1.56 mm total line length at pitch -0.4 / aim 0.4). These lengths are **not penetration depth or volume**. The six-second 30 Hz transition sequence improves this measure in 120/181 samples and is unchanged in 61, with no sampled increase. Still samples do not prove continuous collision absence.

World has no crouch action/state: crouch is defined for Arena only in `shared-client/settings.ts`. No crouch controls were invented for this pass.

## Temporal evidence

Sibling evidence `animation/player-ads-temporal-before-after.mp4`: 181 same-clock frames at 30 fps, no interpolation, native runtime CPU deformation. Root follows an explicitly authored ballistic QA fixture; this is **not** an actual controller traversal, WebGL/game-camera capture or GPU/FPS measurement. Consecutive boards cover aim entry, pitch boundary, jump return and aim release/turn. Focused board `player-ads-focused-before-after.jpg` shows level, +0.8 full ADS and -0.3 half aim. `player-ads-contact-location-annotations.jpg` marks projected crossing locations with explicit x-ray rings.

Player face-atlas UV1 export and static mesh-identity caching were independently corrected in the offline tools. Earlier dark-face previews are superseded material evidence, not a runtime skin defect. Accepted Saber and current player temporal payload layouts were independently audited.

The separate Saber sword-floor candidate was rejected; the approved relaxed carry remains unchanged. Its inherited terrain/blade clipping is not claimed fixed by this ADS pass or the accepted lower-body grounding work.
