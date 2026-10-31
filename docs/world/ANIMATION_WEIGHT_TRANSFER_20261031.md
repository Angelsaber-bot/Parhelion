# Animation weight-transfer and accessibility checkpoint

## Runtime changes
- Explorer jump: takeoff-side-aware knee gather persists toward apex; falling legs reach toward support instead of continuing the grounded running cycle. Free arms balance the jump. Walking off an edge does not fabricate a takeoff.
- Landing: a velocity-dependent, critically damped, bounded hip load; no controller/root translation and no camera shake. Confirmed ground contact owns foot IK immediately, including while the glider is still visually stowing.
- Turning: subtle body weight transfer and head counterbalance. Exact integration of the exponentially changing heading rate preserves existing strict 30/60/120 Hz pose equivalence.
- Rifle/ADS, melee, swimming, glider and reset retain pose ownership. Muzzle queries at zero elapsed time never generate landing events.
- Reduced-effects era cinematics use stable wide shots, including portrait aspect handling. Source actors remain untouched.
- Musashi and mounted Napoleon have private-clone aftermath recovery. Authored damage contacts and source clips remain unchanged; Napoleon keeps his saber and left rein.
- Confirmed hits use four small tapered splinters instead of reusing the release tracer. The existing 18-slot pool and one visible draw per slot remain; total shared geometry remains below 48 KiB.

## Verification at this checkpoint
75 focused tests passed across player locomotion, aiming/rig contacts, melee, inertia, mixed transitions, VFX, era performance and cinematic lifecycle. A separate companion batch verified approved Saber idle/walk/run carry and Musashi transitions; a strict player rate-equivalence failure discovered in that batch was fixed by analytic integration, not by weakening its tolerance.

Mixed 30/60/120 Hz transition matrix: minimum sampled actual shoe surface is +2.69 mm above the flat support plane; maximum rifle palm/socket discrepancy below 1.1e-15 m, muzzle angular discrepancy below 2.2e-8 rad. These are CPU geometry metrics, not GPU performance or terrain/slope foot-lock claims.

The initial jump sheet was rejected for clipped apex framing and weak pose readability. A larger fixed camera and same-time front/side baseline comparisons now show the actual knee/arm change. Offline sequence source is `world/validation/characters/export-player-acting-sequence.ts`; renderer is `render-player-acting-review.py`.

## Evidence workflow
Run the exporter with a workspace output directory, then Blender with that directory and a separate frame destination. It samples 24 actual runtime poses plus front/side close-ups. `--baseline-module=/absolute/module.ts` accepts a preserved baseline animator module whose relative dependencies resolve; it must export `SkinnedCharacterAnimator`. Each new export records its runtime source SHA-256.

The baseline comparison for this checkpoint comes from the original checkout HEAD before edits. The complete preserved source, raw poses and rendered sequences are kept in the cloud evidence directory, not added to the source tree. Cycles CPU material/lighting is an offline approximation; no browser, WebGL, game-camera or FPS acceptance is claimed.

## Stage start-pose isolation follow-up
The private stage now evaluates its idle action before measuring framing or caching performance rest transforms. Previously, starting Musashi's ultimate while running/attacking could capture the lifted foot and shifted hips: an actual-asset comparison measured a 0.41885 m maximum intro-joint deviation between idle/run/attack entry. The corrected comparison is 0 m, with every source transform unchanged. Twenty-five focused era-performance and stage lifecycle tests pass. This changes only clone initialization, not release timing, contacts, energy or skip behavior.
