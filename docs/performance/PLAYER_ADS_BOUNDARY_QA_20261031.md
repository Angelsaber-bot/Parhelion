# Independent native player ADS boundary proof

The production animator is compared with a durable pre-change source fixture,
not against itself with a hidden production toggle. Fixture original git blob:
`74562c4fbd3b3cc3977dd93b2d945311fb7c7348`; SHA-256:
`9593a6faee25f1a16bc5e809ea40e33e6ab25d50289afd9464118a036f2d4559`.
Only relative imports/asset paths and provenance comments differ from that
historical file. It is never imported by production.

`validation/player-ads-boundary-independent.test.ts` includes the matrix in the
normal World CI glob. Native loaded rigs run six seconds at each30/60/120Hz,
with ADS ramp, pitch sweep through -0.5, firing pulses, and airborne/moving
animation states. These are controlled animation states, not a controller
traversal or a human/GPU playtest.

Independent production result:

- Positive right-arm pose changes occur at all three rates.
- Every non-right-arm joint's local components stay exactly equal.
- Physical gun world matrix and muzzle position stay exactly equal.
- Palm position difference is at most `7.70e-16 m`.
- Firing before ADS and downward pitch at/below -0.5 preserve the original
  right-arm pose exactly (71/141/281 excluded-state frames respectively).

The focused correctly UV-mapped CPU board shows reduced full-ADS elbow flare
without visible gun shift. It does not establish universal sleeve/stock
clearance; the animation owner's dense residual-contact and temporal evidence
remain separate. Earlier UV0-only player material renders are superseded, not
proof of a runtime dark-face defect.

Workspace proof: `qa/player-ads-boundary-production-independent.log`.
Candidate-only and fixture-development logs are retained separately. No GPU
frame-rate, damage/hitbox, or all-clipping-eliminated claim is made.

## Anatomical correction after red dbff949 checkpoint

Anchor invariants are necessary but insufficient: the unchanged native wrist
regression exposed 44.926652° settled ADS metacarpal/forearm bend, versus
7.157869° on frozen pre-change 487beaa. Walk/run and non-ADS idle remained
identical. Both independent reproductions are retained in
`qa/ads-wrist-positive-{frozen487-baseline,current-before}.log`. This was a real
pose constraint failure, not a stale assertion or an accepted relaxed threshold.

The subsequent anatomical cap preserves the original <13° neutral constraint.
`player-ads-wrist-grid-independent.test.ts` compares the actual native hand and
forearm across 36 settled speed/ADS/pitch combinations and 1,152 sampled poses
against the frozen animator. It requires each new bend to stay below
max(original same-frame bend,12.5°), exact gun transforms, palm equality within
1e-12 m, and a positively observed correction (not a no-op).

The reviewed capped source passes that grid, the unchanged full wrist suite,
and the earlier boundary matrix: 6/6 tests. Neutral ADS is 12.499995°, maximum
excess over the per-pose bound is zero, palm delta ≤7.66e-16 m; 499 sampled arm
comparisons positively differ. Evidence `qa/ads-anatomical-cap-independent.log`.
This is a settled anatomical/anchor check plus the existing temporal continuity
suite, not proof that every sleeve/stock intersection is eliminated. The capped
pose's visual severity and residual intersection findings remain separately
reviewed by the animation owner/root.
