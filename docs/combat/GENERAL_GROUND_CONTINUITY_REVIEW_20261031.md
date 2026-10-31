# General physical support continuity — isolated review

Status: **validation-only, not accepted into production**. Production remains the
already-admitted evade/melee/skill support closure (`b21719a`, `86758f0`,
`66ba6c0`, `c8b91c9`). This is an independent comparison requested after that fix
left three of six moving downhill melee requests rejected while apparently
standing on the floor.

## Alternatives

1. General prior-grounded physical continuity: reuse the identical <=1 cm floor
   predicate and real capsule retry after ordinary collision loses ground. No
   timer, coyote grace, admission override, forced grounded bit or additional
   history. Jump, flight, water, glide, updraft, upward movement, unsupported
   gaps and nonwalkable support remain excluded. Existing evade owns its own
   single retry; validation wrapper excludes it to avoid duplicate work.
2. Admission-time retry: retain only the immediately preceding genuinely
   grounded failed-step position/velocity, retry genuine support when an
   otherwise-ready melee/Q request arrives, then use ordinary admission. The
   isolated prototype clears on teleport and exact state mismatch. It admits
   five of six fixed-policy downhill requests, versus six with general
   continuity. Extending history to recover the sixth would introduce more
   state and is not recommended. This prototype is not a production proposal.

## Functional evidence

`validation/combat-review/audit-downhill-actions.ts` uses actual main input,
clocks and contact callbacks; one explicit supported entry teleport per case,
no hostile HP/energy/cooldown/ground/action-state writes. General comparison
produces six admitted melee requests/six contacts, one Q/one contact, matching
flat controls. True jump and ledge still cancel the admitted first action.
These are empty-lane contact emissions, not claimed enemy kills.

`audit-general-ground-routes.ts` compares eleven representative normal-keyboard
routes (Alpha exit/uphill/peek, harbor exit/peek, Winter exit/peek/slope, Britain,
Kyoto and HQ). Both runs contain 2,884 fixed physics records: every XZ coordinate,
route duration, final position and HP match. Maximum transient Y difference is
3.973312 mm. Alpha exit airborne render frames decrease 111 to zero. This is
not universal slope snapping: Britain 38, Kyoto four and HQ four airborne frames
remain unchanged. Strict 1 cm support rejects those gaps. Synthetic 12-degree
slope likewise retains baseline oscillation because stance geometry plus
movement exceeds the existing limit; the limit is not increased.

Query counts on Alpha exit: 334 support passes, 10,354 individual BVH rays
(31 enabled colliders/pass), 334 real capsule retries. Flat/uphill/most routes
have zero extra queries; harbor peek has 62 recoveries not visible as airborne
at render cadence. Each affected step remains capped at one floor pass and one
capsule retry. A floor pass is not a single BVH query.

`general-ground-continuity-candidate.test.ts`: 15 component cases cover
0/3/6/12-degree slopes, 30/60/120 Hz, true jump/glide/air teleport, ledge fall,
swimming, updraft/nonwalkable slope, disabled floor, step, corner and low roof.
Flat obstacle controls preserve complete baseline states. Deep retry rollback,
thin-edge, collision-barrier and exception contracts remain those of the
unchanged production support helper.

### Explicit shoreline tradeoff

A synthetic 5.73-degree shoreline enters swimming on the same physics step 251
in both runs; no support queries occur after entering water. The small inherited
vertical difference shifts the existing 1.15 m buoyancy threshold by one step
later: one body briefly uses swimming speed while the other uses walking speed,
then vice versa on the next step. Maximum transient X difference is 2.0625 cm;
final X is identical, with no sustained speed increase. Do not claim exact
water trajectory parity or introduce an arbitrary water-margin workaround.
The actual eleven dry routes remain exact horizontally.

## Pending before recommendation

- Quiet paired actual-world and bounded dense-collider CPU measurements via
  `measure-general-ground-support.ts`; no timing claims during aggregate tests.
- Independent held-key/repeat/cooldown check and parent review.
- Explicit parent acceptance before any production generalization.

Raw evidence remains under repository `artifacts/general-ground/`,
`artifacts/downhill-actions/` and `artifacts/general-ground-*.log`; these are
cloud CPU/DOM/component evidence, not GPU/FPS or human-playtest claims.
