# Armory service-yard tactical pocket

One 46 x 36 m pocket beside the original armory, not a second distant map.
The original helipad/H, armory, range, west-campus road and all old progression
remain unchanged. Original assets are not regenerated. The abandoned station
is only a voluntary reward landing; no new station guards or geometry.

`compactRelaySitesData.ts` is the pure coordinate/ID contract. The scene factory
samples terrain, returns three markers, two enemy sockets, channel standing
point and destination arrival. Static collisions are installed once before BVH
construction; active/channel/completion state only changes non-emissive visible
indicators. No new lights or shadow casters.

## Spatial decisions

- Start: (-70, 228), within the unchanged 12 m encounter admission radius;
  its 1.5 m interaction disc also remains inside. The deployment board at
  (-82, 231) is separate so it cannot steal the start prompt.
- Controller standing point: (-60, 226). Its cabinet is 1.2 m north, not underfoot.
- Direct route uses the low entry plinth and then the tall eastern equipment
  baffle to deny the musketeer's line while leaving the breaker able to approach.
- North flank is longer but reaches a 1.2 m maintenance deck with a clear firing
  line to the musketeer. North and south 8 m ramps make a walking loop; no jump,
  ladder, forced grounding or altered physics is required.
- Three distinct cover structures, not scattered crate spam. The flank cable
  plinth stays outside the original helipad footprint.

## Actual collision evidence

`validation/compact-relay/audit-candidate-pocket.ts` loads all five shipped maps,
settlements, campaign fields and story colliders, adds the candidate solids,
and runs actual Player.step at 120 Hz. Only initial diagnostic placement is
explicit; ground and movement thereafter belong to normal physics. This is
not a fresh-save or combat-success claim.

Initial physically valid candidate v2: approach 7.19 s, short route 2.31 s, flank 20.08 s, return 9.10 s.
All finish settled, dry and clear. Maximum horizontal movement is 5.5 m/s.
Both deck directions pass in 5.78 s with four transient airborne substeps each;
these are disclosed, not called perfectly grounded motion. Breaker-to-controller
walking path passes in 1.76 s. Chest-height rays confirm controller protected,
high deck sees musketeer, exposed southern peek sees musketeer. Actual combat
telegraph/cooldown/channel strategy validation remains independent QA's job.

All five yard standing sockets are at actual ground Y=10.003314018249512.
Station arrival (-140, 8.014726638793945, -12) is supported; ordinary walking
through the south gate succeeds in 2.42 s. The station's existing Relay B gates
and enemies are not changed.

The first entry-cover candidate overlapped the start socket and failed actual
approach. That log is retained externally; v2 moved only this low cover west to
x=-74.8. Source tests now forbid new-solid overlap with standing sockets.

No claim that successful routes alone establish fun, final visual quality,
GPU performance or all combat outcomes. Those require review in the integrated
playable slice.

## Final bounded corrections

The active replay uses actual channel progress even after permanent completion;
only the separate deployment indicator stays unlocked. Start radius is 1.5 m
so the +0.9 m marker does not demand a 0.436 m horizontal stance. The full
interaction disc remains inside the original 12 m encounter admission limit.

The second existing cover is relocated to (-49, 224.7), 1.45 m high, rather
than adding a fourth. Isolated full-map collision replay preserved every route
and tested a blocked low eye ray versus a clear raised-deck ray. A local CI
ray pair additionally compares the actual adjacent ground lane (-47, 218)
and the deck (-44, 218): the cable housing blocks the former and not the latter.
Thus height has a measured use rather than being decorative. The original
1.25 m candidate's grazing low ray remained clear; its failed diagnostic is
retained. The final shelf/cover change still awaits integrated combat review.

The approach route now explicitly leaves the armory via (-66,246),(-82,246),
(-90,246), avoiding the original central workbench. The previous component
approach started outside on the street and was never proof of a straight
weapon-rack-to-street route.
