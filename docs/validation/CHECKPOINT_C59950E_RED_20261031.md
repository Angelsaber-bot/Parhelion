# Integrated checkpoint c59950e — red

Exact frozen source: `c59950e18943d788ed5f7b8fe0e931495af33dc6`.

| Gate | Result |
|---|---|
| Configured World types | Pass |
| World tests | **1,594 / 1,595 — fail** |
| Arena tests | 351 / 351 |
| Unified World/Arena/Worker/site build | Pass |
| Site tests after build | 13 / 13 |

The sole failure is the historical full-layout assertion in
`kingdom-valley-contract.test.ts`: three approved Alpha instruction strings differ
from its original snapshot. This is a stale test contract, not evidence that
geometry, gates or marker coordinates changed. The optional tower ramp was
rejected and reverted before this freeze; original Alpha GLB bytes are restored.

Correction `7b70eef` asserts the exact new strings at the exact Relay B objective,
Relay B marker note and tower objective fields, reverses only those fields, then
retains the complete historical deep equality assertion. It does not regenerate
the baseline or exempt any other data. The corrected source requires a new full
frozen run; this checkpoint remains red regardless of focused follow-up results.

Accepted player terrain support and its default-main hook are present. This
record does not claim browser/GPU visual validation or measured FPS improvement.
