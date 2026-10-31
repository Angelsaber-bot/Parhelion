# General-support candidate: independent held-input check

Product baseline: frozen `487beaaab22d2567c58ee9624f94be03c146155a`.
This is candidate-only evidence, not approval or a claim that general walking
support is installed in that baseline.

`world/validation/combat-review/general-support-held-independent.ts` boots actual
main with an explicit synthetic legacy armory save and supported entry positions.
A synthetic flat collider is the control. The isolated `general` wrapper is
compared with the unchanged scoped-support production behavior. No HP, grounded
state, energy, action clock or damage values are written.

Eight cases cover downhill/flat × melee/skill × production/candidate. Each holds
one initial key press and sends browser-repeat keydown events while walking.
All passed: exactly one real contact; the first 240 actual 120 Hz action-update
snapshots are identical per pair, including melee phase/cooldown, skill
cast/guard/cooldown, energy and timestep. HP remains 100. Candidate flat controls
perform zero support queries. Each downhill candidate performs 240 support
passes, 7,200 individual BVH casts and 240 capsule recoveries.

Workspace evidence: `qa/general-support-held-independent.{json,log}` under the
sibling evidence directory. This CPU synthetic-operator test establishes held
repeat and action timing behavior only. It is not a human playthrough, GPU/FPS
measurement, universal trajectory equivalence or approval of broader support.
The separate shoreline phase difference and measured additional CPU cost remain
part of the owner's candidate decision record.

## Approved production contract and preserved history

After explicit root approval, `4f56d26` installs general prior-grounded geometric
support and `962eee0` removes main's action-authority argument. Historical
admitted-only guarantees are not claimed for that new behavior:

- `player-support-parity.test.ts` retains the original non-evade zero-query/path
  assertion against frozen `player-pre-general-support`, compared with the
  original pre-evade reference.
- `ground-action-support-independent.test.ts` retains the old action-end query
  boundary against that historical source, and adds live general ordinary-walk
  recovery plus airborne relocation, jump and zero-dt exclusions at 30/60/120 Hz.
- `admitted-ground-action-cadence-independent.test.ts` checks live two-argument
  main calls, real contact/guard timing and positive ordinary support after the
  action ends. Its prior narrower main contract remains at `f572723` and frozen
  `dbff949`; the new assertion intentionally reflects the approved change.

The held-input runner accepts `--live-general HISTORICAL_REPORT.json`: in this
mode it installs **no support wrapper**, and compares all four live held-input
cases directly with the retained historical production snapshots, rather than
comparing fixed production to another wrapper over itself.

Production verification completed at 09:25 UTC on the above source: all four
no-wrapper held-input cases exactly match historical timing/contact/HP snapshots.
The 30/120 Hz main cadence matrix also passes: one contact each, six real physics
steps of guard-only skill tail, exactly two controller arguments, and positive
support during subsequent ordinary walking. The component historical/live split
passes 12/12. Logs: `qa/general-support-held-production.{json,log}`,
`qa/general-support-cadence-production.log`, and
`qa/general-support-independent-components.log`. These runs are functional
checks during an aggregate workload, not CPU timing benchmarks.
