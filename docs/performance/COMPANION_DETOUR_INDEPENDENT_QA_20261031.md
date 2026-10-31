# Companion local detour: independent QA

Production source slice: `91b0f10` (`world/src/companionNavigation.ts` only).
No attack, target selection, terrain collision, or travel-speed authority change
is asserted by this review. Failed local headings are bounded to nine records,
expire after 0.4 seconds of valid simulation, and temporarily shorten planning
reach to 0.65 m. Original nine directions and actual step rollback remain.

## Independent production checks

`world/validation/companion-detour-independent.test.ts`: 3/3 pass.

- Actual observed failure remains frozen through zero, negative, NaN and infinite
  dt. Disabling the obstructing beam then recovers and expires all records.
- A gate enabled during a previously valid planning interval blocks movement;
  every accepted step passes the normal path check. Reopening recovers.
- Reset after a real failure gives exactly the same next 300 positions, numeric
  quaternion components, and stuck timers as a fresh navigator.

The initial candidate reset assertion distinguished +0 from -0 introduced by
copying a quaternion into a fresh object. Final component `===` comparison keeps
exact numeric equality (no tolerance). Both logs remain. Candidate-only cases
were committed separately in `97338c9`; production root-CI cases in `a74f74a`.

## Actual-main replay

The combat owner's production driver was independently executed with no
historical, candidate-navigation, or pursuit replacement flags:

```
node --import tsx validation/combat-review/audit-companion-engagement.ts \
  winter --diagnose --seconds=60 --output=<workspace QA path>
```

Result: 23.75 simulated seconds, ten native companion contacts, player HP 59,
encounter completed, no companion root jumps, maximum blocked time 0.183333 s.
Observed 21 rejected directions, at most three concurrent failure records; none
remain at completion. No console errors/warnings.

Boundary: legacy recruitment, initial player placement and direct catalog
admission are explicit fixture setup. Ground settles normally; summon/dodge
keys and native attack/contact paths are real. Dodge timing reads enemy tells,
so this is a synthetic mechanics operator, not human reaction or story journey
evidence. No hostile HP, charge, companion placement or contact clock writes.
No GPU execution or frame-rate claim.

Separate workspace evidence `qa/companion-winter-production-independent.json`
and `.log` preserves earlier baseline artifacts. CPU cost measurements belong
to the combat owner's paired benchmark and are not inferred from this run.
