# Skill entry presentation clock (candidate)

The unchanged skill profile remaps elapsed time into the target attack clip.
Previously the same remapped delta also advanced the still-visible outgoing walk
or run action and its fade. A high-rate gait could therefore accelerate again as
Q began. Native 30/60/120 Hz diagnostics reproduce this, and the observed actual
Q entry is driven by the RAF delta, not the ultimate-release fixed-step loop.

`CharacterKit.update(clipDt, paused, presentationDt?)` retains the old default
behavior. The optional clock is used only while a walk/run action fades out.
The target action and authored event cursor still consume clip time. Outgoing
presentation and fade weights consume the supplied elapsed time. Skill playback
partitions that time across exact event slices and clip-cycle boundaries; a hold
can advance presentation without advancing the target clip or emitting events.
Saber's separate live actor path and ordinary no-argument calls are unchanged.

Validation so far: 108 native entry cases preserve existing contact time,
position and direction exactly; idle/attack entry diagnostic rows also match.
Five independent boundary tests cover holds, pause/invalid delta, cancellation,
30/60/120 Hz and .1s cycles, split time conservation, and 900-frame bit-identical
legacy default blending. An isolated actual-main adapter reduced observed foot
speeds, but residual motion remains; it is not a no-pop or GPU-performance claim.

The no-adapter production Musashi Q replay also preserves all observed authority
fields exactly. Its local-foot speed peaks change from 7.607/9.132 to
5.440/7.190 m/s. These are measured bone diagnostics, not a claim of zero sliding.

This source remains a production candidate, not final integrated acceptance.
Paired entry-only CPU visual review and the other actors' Q/X regressions plus
full aggregate checks remain required. Guarantees apply
to the tested current profiles; a hypothetical earlier event during the fade
would need a new socket-pose audit rather than an assumed invariant.
