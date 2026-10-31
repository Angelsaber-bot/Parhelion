# Regional enemy liveness — bounded read-only audit

**Result:** no genuine inactive/stuck AI defect reproduced in this sample; no
runtime change warranted. This does not establish exhaustive reachability for
all145 ordinary actors or GPU/pixel visibility.

The actual-main CPU/DOM harness uses existing enemies, production perception,
collision, attack clocks and presentation flags. Only player entry placement is
an explicit teleport fixture; ground settles naturally. Between samples the
player returns to a quiet entry and heals through existing gameplay recovery.
No enemy position/HP, player HP/ground, AI state, clock or population is written.

## Positive ordinary-role samples

Each listed enemy produced a visible-tell flag and an actual attack-contact
event. Melee actors physically approached; ranged actors correctly held position
inside their attack range instead of being required to walk needlessly.

| Area | Role / actor | Movement before observation ends |
|---|---|---:|
| Alpha | Bombardier `wild_49` | 0 m, ranged contact |
| Alpha | Breaker `wild_0b` | 5.04 m |
| Alpha | Stalker `wild_0` | 6.08 m |
| Britain | Breaker `wild_3` | 5.04 m |
| Britain | Duelist `wild_4` | 5.60 m |
| Blacksail | Bombardier `wild_6b` | 0 m, ranged contact |
| Blacksail | Duelist `wild_6` | 5.60 m |
| Winter | Breaker `wild_12b` | 5.04 m |
| Winter | Musketeer `wild_12` | 0 m, ranged contact |
| Kyoto | Duelist `wild_17b` | 5.60 m |
| Kyoto | Lancer `wild_17` | 3.135 m |

Ten validated outer controls at28 m were active/visible but intentionally idle
outside their20 m perception range, with HP bars hidden. The high Alpha
bombardier site had no validated28 m outer entry in the bounded angular scan;
its8 m positive contact case still passed. Entry selection requires real clear
floor/body space and LOS; this is deliberately a positive-control sample, not a
claim that every surrounding obstacle arrangement is traversable.

## Peaceful and dormant states

Saved-state fixtures containing `relay_b` and `era_britain_knight_defeated`
exercise existing pacification: `wild_48`, `wild_48b`, `wild_56`, `wild_56b` each
remain still for8 s, emit no contact, hide HP bars and show their mint peace
marker. This is an explicit completed-save fixture, not a claimed quest journey.

Dormant original bosses remain inactive with their roots hidden. A child's
cached `bar.visible=true` does **not** imply it is displayed when its ancestor
root is hidden; effective visibility includes both flags. No unnecessary child
visibility rewrite was made.

## The apparent “HP bar but no attack” state

Two existing ordinary ranged actors were tested with actual W/mouse movement
from a clear position into adjacent cover, a5 s hold, then back out—no mid-fight
teleport or actor movement injection:

- Winter musketeer `wild_13b`: remains in chase after its accepted shot meets
  blocked LOS, deals0 from that shot, does not begin a new tell while occluded.
  Walking back out triggers a new tell/contact dealing14.
- Blacksail bombardier `wild_6b`: same honest cover hold; blocked contact0,
  re-peek contact16.

Both retained enabled HP bars during the blocked chase state because they remain
living/damageable opponents. They were not inactive: physical re-peeking resumed
attacks. Other pack members could still deal damage from their own clear angles;
this is not a claim that the chosen cover grants global immunity. Target-specific
contact/hurt attribution preserves event order in the real simulation.

## Reproduction and limits

- `validation/combat-review/audit-regional-enemy-liveness.ts`
- same runner with `--pacified`
- `validation/combat-review/audit-enemy-cover-liveness.ts`
- `validation/combat-review/summarize-regional-liveness.ts`

Raw retained files: `artifacts/regional-liveness/{ordinary-first,pacified-first,cover-first,summary}.json`.
All three actual-main runs have no harness errors/warnings. Bounded cover-entry
search is audit-only (32 angles ×3 radii, at most30 existing actors per role),
not a new gameplay pathfinder or per-frame query budget. Natural input/collision
then confirms the selected local route is executable.

Audited runtime blobs: combat `2706c7702ef044fe9edb47e08543d0b9ce0f23a7`,
combatView `18f3776234b3f1fb5d239be97bfb9af66b938793`,
enemyTactics `bc0bddfd31539087a9baf6ce8c2ad576bea3eff1`.
This tranche modifies validation/reporting only, not enemy behavior or balance.
