# Arena perimeter safety

The shared simulation treats authored `bounds.min/max` X/Z as the supported outer
floor edge. A player's horizontal capsule is kept inside this edge by its radius
plus a 1 mm solver margin (larger than position quantization). The same rules run
in offline play, server authority and client prediction/replay.

Horizontal movement clips each collision substep to this capsule-safe rectangle;
normal solid collision still decides whether the clipped destination is reachable.
Outward velocity stops while tangential velocity remains available. A final guard
also prevents collision recovery from pushing the capsule outside the perimeter.
This is not respawning or teleporting to a safe point: Y, HP, ammo, cooldowns and
spawn protection are not reset. Interior ledges and multi-level ramps remain free
of artificial barriers. Bot navigation omits nodes outside these same limits.

## Reproduced defects

- CAM LANN: jumping/dashing across the walkable perimeter berm could clear the
  2.8 m earthbank and leave the finite battlefield floor.
- BLACKFLAG: the 2.4 m raised bow/stern decks were higher than the 1.8 m side
  bulwarks. Walking or crouching off their side left the main deck, then fell to
  the solver's no-ground sentinel (-100 m).
- Neither defect was constrained by map metadata: movement previously never
  consulted `bounds`.

The fix relies on supported floors through the authored rectangle, not an
invisible floor under empty space. Visible perimeter geometry is authored in the
map generators; the horizontal guard remains effective above climbable rails.
ASTER and SAKURA assets, map geometry and atmosphere are unchanged.

## Repeatable verification

```sh
cd arena-game
node --import tsx test/arena-boundary-repro.ts
npm test -- --run test/arena-boundary.test.ts test/maps.test.ts \
  test/spawn-protection.test.ts test/crouch.test.ts
npm run typecheck
```

`arena-boundary.test.ts` covers all seven registered maps: every spawn, full
perimeter/corner sweeps using walking/crouching/jumping/jump-dashing, compatible
bot navigation, two-minute deterministic escape-route replays, and server input
queues that cannot inject positions. Focused synthetic checks preserve interior
deck drop-offs, vertical height, tangential motion and existing player resources.
The existing map suite additionally walks authored routes in both directions,
connects every tactical anchor and runs two-minute 2v2 bot matches.
