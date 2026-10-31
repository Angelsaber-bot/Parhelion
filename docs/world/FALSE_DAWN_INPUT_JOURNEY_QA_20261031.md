# False Dawn combined production-input journey QA

`world/validation/journey-review/run-false-dawn.ts` combines actual main dialogue, director admission, input combat, fast travel and physical emitter interaction. Run from `world` with `node --import tsx validation/journey-review/run-false-dawn.ts harbor repurpose` or `winter seal`.

## Verified runs
| Route/ending | Encounters | Shots | Actual damage sources | Final HP |
|---|---:|---:|---|---:|
| Harbor / repurpose | 4 | 52 | ranged602, skill48, companion98 | 90/100 |
| Winter / seal | 5 | 55 | ranged624, skill140, companion94 | 90/100 |

Both runs start with zero energy and end at100 through normal earned charge. The policy may request an earned ultimate only when production prerequisites are observed; these runs do **not** prove an ultimate actually activated. All choices use keyboard digits plus Interact, with real production admission. Fast travel uses the actual UI to legitimately discovered settlement destinations. All three ordered emitters are reached by ordinary movement and interacted with while the defense is active; same-field console returns are also walked. Ending flags persist in the actual progress store.

## Explicit limits and setup
- CPU synthetic operator, not a human playtest, WebGL render, FPS result or difficulty guarantee. Perception/aim/error behavior is documented in `combat-review/story-input-policy.ts`.
- Legacy storage fixture explicitly supplies HQ, armory, summoning-circle, Saber contract, receiver-work prerequisite and three previously discovered travel stops. This is **not** proof of earning those prerequisites from a fresh save.
- Three direct entry-positioning setups remain: initial recorder, remote settlement→console, and Alpha settlement→array. These are logged as `explicit-entry-positioning-not-walked`; they never occur during an active encounter. All setup spawns settle through actual physics, with no forced grounded state.
- No hostile HP writes, direct damage injection, direct director-start calls, energy grants or victory delivery injection. Read-only observers call original `hitEnemy`/`canShoot` unchanged and record their results.
- No direct replacement of combat rules to make this policy win. Native weapons/collision, companion, cooldowns, HP and resources remain production-owned.

Evidence lives in sibling `parhelion-eight-hour-evidence/qa/journey/{harbor-repurpose,winter-seal}.json` and `qa/journey-{harbor,winter}.log`. Earlier pure transaction matrices used injected damage and remain separately labeled; these runs close the dialogue-to-real-combat-to-physical-emitter-to-ending gap, not the entire world traversal gap.
