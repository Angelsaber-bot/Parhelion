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
