# Player lower-leg support: independent candidate review

This is candidate-only evidence until the implementation is explicitly promoted.
The controller, collision geometry and root are not replaced. The experimental
animator is in `validation/characters/.player-ground-support-candidate.ts` and
its support helper is `player-terrain-support-candidate.ts`.

## Positive lifecycle checks

`player-terrain-support-independent.test.ts` passes four native-rig cases:

- A sub-1.5 m vertical relocation with an actual visual air/land transition
  matches a fresh same-clock actor on every landing frame. The suspected stale
  base-height issue did not reproduce; no cache-policy rewrite is justified.
- Reset after missing/reintroduced ground matches a fresh actor.
- Disabled/re-enabled colliders, versioned/refitted positions and 257-to-one
  collider overflow recovery match an explicitly cleared reference. Unsupported
  states apply no cached correction; supported states positively recover.
- The entire authored melee action and ten-frame release tail remain identical
  to the accepted animator, with no support queries during that ownership.

`player-support-lifecycle-independent.ts` runs two deterministic actual-main
boots against frozen `e7b660e`. It explicitly seeds an armory save and positions
one supported Winter route entry; it is **not** a fresh progression journey.
Normal movement, jump, melee, fire, pointer unlock/resume and confirmed reset
are performed through input. There are no grounded, HP or energy writes.

The candidate adapter forwards **update, reset and prepareShot to one instance**,
not only update. Across 480 frames, player coordinates/yaw/ground state, camera,
gun matrices and all non-leg/non-cloth local bone hashes match exactly. Positive
coverage includes 1,014 adjustments, 78 excluded air/melee updates, one reset and
one prepareShot. Four component tests also pass after the swing-relaxation edit.
Workspace evidence: `qa/player-support-main-lifecycle.{json,log}` and
`qa/player-support-main-lifecycle-source.json`, plus
`qa/player-support-lifecycle-final.log`.

## Limits and acceptance boundary

The earlier walking-only adapter did not forward reset/prepareShot and must not
be cited for their lifecycle behavior. The paired test above closes that gap.
The solver preserves finite limb reach; occasional residual stance clearance is
not eliminated by moving the pelvis or controller. No universal clipping-free,
GPU pixel-identity, FPS or VRAM claim is made. Current candidate geometry/CPU
measurements and final swing-relaxed temporal images require owner/root review
before production attachment. Constructor footprint arrays are one-time; the
steady correction uses pooled vectors/quaternions. This does not claim that the
entire existing animator or invalidation path is allocation-free.

The measured final-v9 helper SHA-256 is
`4c0adf40ace804469c167fd96626e3312bdffd0d41d8469ba8b5f3721f6d358a`;
the experimental animator SHA-256 is
`4e6ae33727394dd173bfcaf492b7b43e41e01f09555e49cf8cc68988f367a9ef`.
These match the owner's stabilized swing-relaxed version, not the superseded
full-swing ground-tilt variant.

Independent visual sampling of final-v9 `travel`, `step` and `settle`
consecutive boards covers46 matched timestamps. It shows improved sole clearance
relative to the buried baseline, a restrained swing-foot angle and no obvious
single-frame snap in those sequences. Small finite-reach stance gaps remain.
The images are CPU native geometry over neutral actual collision surfaces, not
runtime shader/GPU screenshots. Fixed lower-body crops intentionally do not
establish head framing. Together with the lifecycle tests this supports the
bounded candidate, pending root's production decision and final exact-source
CPU measurement; it is not a claim of perfect terrain adaptation everywhere.


## Accepted production attachment

Source d9da884 and main hook2b0dc4475ae449329def03b64d2720b6c0f48848
promote the bounded solver. The independent four-case test now imports the
production class/helper and retains an explicitly no-helper reference.

A second480-frame pair uses **actual production main attachment with no animator
replacement or support adapter**, compared with frozen e7 main. Observation-only
wrappers count calls without changing arguments/results. Player/root/camera/gun,
non-leg/non-cloth locals, **HP and energy** are exact. One real reset, one
prepareShot,78 excluded air/melee updates and1,014 positive adjustments occur;
two unsupported startup reads correctly fall back. Logs/JSON:
`qa/player-support-main-production`; source hashes in
`qa/player-support-production-source.json` match committed2b0dc44 exactly.

Final exact-v9 isolated CPU pairs add .02556/.03108/.03606ms per update
(median .03108ms), with positive native support and no overflow. This is not FPS.
The final temporal/body limits above remain; no universal terrain-contact claim.

Durable runner arguments: frozen pre-support WORLD, output JSON, production
WORLD. Omitting the third argument deliberately uses the separate visual-only
adapter comparison; the report labels these modes distinctly.
