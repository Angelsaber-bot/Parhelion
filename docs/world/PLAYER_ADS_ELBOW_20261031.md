# World rifle ADS elbow pass — 2026-10-31

The right elbow now uses a **wrist-capped partial correction** during level/upward shoulder aim. Residual sleeve/stock contacts remain. This is a bounded elbow-circle/pole adjustment, **not** a weapon redesign, shoulder displacement or change to limb length. With fixed shoulder and wrist endpoints, elbow flexion magnitude cannot change; the improvement is orientation, silhouette and sleeve/stock clearance.

The correction is `-smoothstep(adsPose, 0, .8) * smoothstep(pitch, -.5, 0)`, multiplied by existing rifle-contact and non-carry weights inside the right-arm solver. `adsPose` is the existing damped ADS state; immediate `fireAim` does not activate it. The optional solver parameter defaults to zero, retaining other callers. Pitch <= -0.5 rad retains the historical pole. The requested angle is then bounded analytically to the first safe elbow-circle arc: actual metacarpal/forearm bend cannot exceed max(the original same-frame bend, 12.5°). This preserves the existing <13° neutral ADS wrist gate without making already-bent poses worse. Missing/degenerate anatomy returns the original pole. The correction uses reusable synchronous scratch vectors, no added per-frame allocations, iterations, collision queries or state caches. No new controls or animation clocks were added.

Production `world/src/skinnedCharacter.ts` SHA-256: `3580d1ad78ee26168908228efe5fec3e39c767f4504f0e3843071248bf3e28e6`.

## Invariants and positive verification

- Independent frozen pre-change reference: git blob `74562c4fbd3b3cc3977dd93b2d945311fb7c7348`, SHA-256 `9593a6faee25f1a16bc5e809ea40e33e6ab25d50289afd9464118a036f2d4559`; fixture records import-path-only adjustments.
- Independent 30/60/120 Hz boundary sequence: exact gun world matrix, muzzle position and non-right-arm local components; palms differ by at most 7.70e-16 m. Positive right-arm changes are required. Before ADS and at extreme downward pitch, right-arm pose remains exactly historical.
- Native 1,440-frame ADS/turn/jump-state/glide/melee/unarmed sequence preserves exact gun/muzzle and all non-right-arm bone locals, including finger locals. Palm tolerance is 1e-12 m. Reset clears corrective ownership.
- Immediate and repeated hip-fire at five pitches and three headings remains exactly historical, including all bone locals and shot origins. An earlier candidate incorrectly used immediate fire presentation and added an elbow snap; it was rejected before production.
- Positive native stock/sleeve geometry regression: at level full ADS, summed triangle-crossing line extent falls from 1.290106 m to 0.992374 m (>20% reduction), while the same three stock submeshes still intersect the sleeve. This is not penetration depth or volume. Original wrist, full-pitch palm/barrel/head and melee gates remain unchanged.
- Independent native wrist grid: 1,152 sampled poses across 36 settled combinations; no bend exceeds max(original,12.5°), neutral ADS maximum 12.499995°, palms <=7.66e-16 m.
- Pure analytical guard: 20,000 seeded feasible arm/anatomy cases check every sampled intermediate arc, useful positive correction, deterministic continuous request capping, and invalid/degenerate fallback.

Commands from `world/`:

```
npm run typecheck
node --import tsx --test validation/player-skinned.test.ts validation/player-melee-pose.test.ts validation/characters/player-ads-boundary-independent.test.ts
node --import tsx --test --test-concurrency=2 validation/player*.test.ts validation/character*.test.ts validation/characters/player-ads-boundary-independent.test.ts
```

## Superseded v3 and honest limits

The earlier uncapped v3 (`abd6d38`) passed endpoint/shot and sampled visual review but **failed the original anatomical wrist test**: level ADS bend rose from 7.157869° to 44.926652° (required <13°). That was a real product regression, discovered by the full aggregate; initial narrow tests omitted the wrist family. Prior v3 visual approval is superseded, not a reason to waive the gate. The original test threshold is unchanged. The correction above restores wrist safety while retaining a smaller visible improvement.

The new v3-only zero-stock assertion was replaced with a truthful measured partial-improvement assertion after root review. This is **not clipping-free**. Selected capped-pose summed crossing extent improves: level 1.290→0.992 m; +0.8 full ADS 2.216→0.547 m; −0.3 half ADS 1.074→0.830 m. Small newly touched submesh contacts remain; counts alone do not measure visual severity. No universal collision-clearance claim is made.

Full validation now includes all existing `validation/player*.test.ts` and `validation/character*.test.ts`, plus the independent ADS boundary matrix and original wrist assertion. The archived uncapped temporal and CPU profiles below are explicitly **historical v3 evidence**, not acceptance proof for the corrected pose.

World has no crouch action/state: crouch is defined for Arena only in `shared-client/settings.ts`. No crouch controls were invented for this pass.

## Corrected preview and historical temporal evidence

Corrected same-camera three-pose board: `animation/player-ads-wrist-capped-before-after.jpg`; original material atlas and gun geometry retained. Root accepted the smaller level adjustment and clearer upward stock with unchanged wrist gates. These are CPU offline snapshots, not WebGL/gameplay-camera or GPU/FPS evidence.


Sibling evidence `animation/player-ads-temporal-before-after.mp4`: 181 same-clock frames at 30 fps, no interpolation, native runtime CPU deformation. Root follows an explicitly authored ballistic QA fixture; this is **not** an actual controller traversal, WebGL/game-camera capture or GPU/FPS measurement. Consecutive boards cover aim entry, pitch boundary, jump return and aim release/turn. Focused board `player-ads-focused-before-after.jpg` shows level, +0.8 full ADS and -0.3 half aim. `player-ads-contact-location-annotations.jpg` marks projected crossing locations with explicit x-ray rings.

Player face-atlas UV1 export and static mesh-identity caching were independently corrected in the offline tools. Earlier dark-face previews are superseded material evidence, not a runtime skin defect. Accepted Saber and current player temporal payload layouts were independently audited.

The separate Saber sword-floor candidate was rejected; the approved relaxed carry remains unchanged. Its inherited terrain/blade clipping is not claimed fixed by this ADS pass or the accepted lower-body grounding work.
