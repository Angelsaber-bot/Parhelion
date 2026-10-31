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
