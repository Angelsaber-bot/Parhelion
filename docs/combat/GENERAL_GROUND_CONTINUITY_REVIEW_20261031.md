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
route duration, final position and HP match. The executable preserved-output comparator is `compare-general-ground-routes.ts`. Maximum transient Y difference is
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

`general-ground-continuity-candidate.test.ts`: 17 component cases cover
0/3/6/12-degree slopes, 30/60/120 Hz, true jump/glide/air teleport, ledge fall,
swimming, updraft/nonwalkable slope, disabled floor, step, corner and low roof. A separate 5/9/12/25 mm step-down matrix recovers only the two sub-centimetre cases; 12/25 mm gaps reject without a capsule retry.
Flat obstacle controls preserve complete baseline states. Deep retry rollback,
thin-edge, collision-barrier and exception contracts remain those of the
unchanged production support helper. A 9 mm airborne teleport remains airborne on its first step with zero recovery queries; only later natural capsule contact may land.

### Explicit shoreline tradeoff

A synthetic 5.73-degree shoreline enters swimming on the same physics step 251
in both runs; no support queries occur after entering water. The small inherited
vertical difference shifts the existing 1.15 m buoyancy threshold by one step
later: one body briefly uses swimming speed while the other uses walking speed,
then vice versa on the next step. Maximum transient X difference is 2.0625 cm;
final X is identical, with no sustained speed increase. Do not claim exact
water trajectory parity or introduce an arbitrary water-margin workaround.
The actual eleven dry routes remain exact horizontally.

## Quiet paired CPU evidence

`measure-general-ground-support.ts` ran under the shared exclusive weight-4 gate
at 09:16:49–09:17:02 UTC after aggregate termination. Sixty measured trials per
case after six warmups, 72 fixed-120-Hz component steps each, alternate pair
order; setup, settling and diagnostic reads are outside timed steps. Each arm
has 4,320 measured samples. The candidate still includes its validation wrapper. Frozen baseline Player blob is `765ba51b6ca9324b77e0bf7a5d2f58ada2ae0226`; the harness now preserves it explicitly and reserves `--production` for a later no-wrapper replay, not evidence already obtained.

| Case | Baseline median / p95 ms | Candidate median / p95 ms | Candidate observed max ms |
|---|---:|---:|---:|
| Actual Alpha downhill | .034 / .089 | .077 / .164 | 2.677 |
| Synthetic flat control | .035 / .083 | .035 / .067 | .901 |
| Actual field + 64 noncontacting annular BVHs | .101 / .176 | .222 / .394 | 7.482 |

All downhill candidate steps in this window recover; flat has zero queries.
Maximum individual BVH casts are 31 actual / 95 dense, one support pass and one
capsule retry. Dense geometry does not alter either body's trajectory, asserted
exactly. The 7.482 ms tail is retained, not explained away or presented as a
worst-case guarantee. These are CPU component timings, not a device frame budget,
GPU/FPS measurement or whole-world runtime. General recovery adds measurable work
on every affected ordinary walking step; it is not free.

## Pending before recommendation

- Independent held-key/repeat/cooldown check and parent review.
- Explicit parent acceptance before any production generalization.

Route replay accepts `--output=PATH` and refuses to overwrite an existing evidence file. Raw evidence remains under repository `artifacts/general-ground/`,
`artifacts/downhill-actions/` and `artifacts/general-ground-*.log`; these are
cloud CPU/DOM/component evidence, not GPU/FPS or human-playtest claims.
