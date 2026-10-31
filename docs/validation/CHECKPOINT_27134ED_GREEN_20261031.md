# Physics, stride and navigation checkpoint — 27134ed

Exact frozen source: `27134ed01c2957cb8c0ed82ee41626ec6d3c6467`.
The detached checkout was tested without modifying tracked source.

| Gate | Result |
| --- | --- |
| World TypeScript | Pass |
| World tests | 1,491 / 1,491 |
| Arena tests | 343 / 343 |
| Unified build, including World/Arena/worker types | Pass |
| Site integration tests, after build | 13 / 13 |

The runner completed with status zero. Before/after HEAD and tracked-state
records match. Independent per-file verification is recorded separately by QA.

This checkpoint includes the previously green story, environment, combat,
save-safety, Arena presentation/startup, graphics-interruption and resume-clock
work, plus:

- A strictly bounded support correction for an already-admitted grounded World
  dodge crossing a sub-centimeter support gap. Normal movement, airborne
  admission, action duration and cooldown authority are unchanged.
- Saber procedural stride and local terrain support, with private-stage/action
  ownership and both-outfit lifecycle checks. Unsupported rigs retain original
  authored cadence; the original regression assertion remains unchanged.
- Bounded companion local-heading recovery from actual rejected movement,
  preserving accepted-step collision checks and target/attack authority.

The prior `276313d` result remains red and is classified separately. This is a
new full run, not a promotion based solely on targeted repairs. The later tavern
underside repair and subsequent animation candidates are not in this source.

Local recovery tag: `checkpoint/physics-stride-nav-green-20261031`.
The cumulative bundle requires the original `9c6cd86` base and contains no
node_modules, render caches, credentials or unrelated untracked experiments.
No public deployment or publication was performed. CPU/DOM/source checks and
native-mesh offline renders do not establish GPU frame rate or browser rendering
fidelity.
