# Fresh original-mainline continuation (CPU actual input)

Product: exact frozen `e7b660ede943097233a11b70cebf7fb887f1e7bc`.
External driver: `world/validation/journey/fresh-mainline-continuation.ts`, extending
its original empty-save opening route. No teleport, forced grounding, velocity,
HP/energy, progression or damage writes occur in this journey. Waypoints and
correct answers are known operator inputs, not human discoverability evidence.

Successful attempt8 starts at the normal spawn with empty storage and earns:
archivist/HQ/report, armory, receiver work, courier victory and harbor lead, all
six range/ruin targets, Relay A, Relay B, tower activation and northern seam.
HP remains100; energy14.52 is earned through real rifle combat. Runtime532.467
simulated seconds, 555 swimming frames, no runtime errors. Remote summon remains
locked until the other three seams are legitimately inspected. This is not yet
a complete fresh optional branch or a GPU/FPS claim.

## Actual traversal findings

- Armory rear wall correctly blocks a straight shortcut: use west exit/exterior
  to the firing line. Camp's steep west edge is avoided via its northern slope.
- Relay B has no enemy-kill prerequisite in shipped behavior: ordinary F repairs
  and pacifies its relay actors. A stationary optional shooting policy timed out
  inside the building; its target/cast was not logged, so cover is only a likely
  explanation, not a proved obstruction or a kill-gate failure.
- Tower walking/single-jump access is difficult. The unchanged original collar
  rises from about26m at radius18 to30m at radius15; ordinary radial approaches
  fail in independent component and actual-input diagnostics. **Global
  unreachability is disproved:** a supported sprint/jump, fresh airborne Space
  to deploy glider, natural landing on the28.56m side perch, and a second genuine
  grounded jump reach the30.5m deck. The fresh run reproduces this without any
  diagnostic positioning, then walks around pillars and presses F at the console.
- The northern ice approach includes real swimming. A lunge from3m away falls
  short; a fresh normal jump press near z=-252.2 reaches the ice and the seam.
  No geometry or controller changes were made to pass these routes.

The separate `tower-input-diagnostic.ts` uses an explicitly positioned supported
west entry to measure input mechanics. It is **not** the fresh-route proof.
Normal spawn free-jump rise is1.1479m. Staged diagnostic climb reaches30.496m;
the fresh path's first deck landing is30.456m. No grounded/velocity writes.

Workspace evidence is retained separately: `qa/fresh-mainline-e7b660e-attempt1`
through `attempt8` logs/earned synthetic save summaries and matching driver
snapshots; `qa/tower-input{,-runup,-glider,-staged}-e7b660e` diagnostics. Failures
are retained and classified, not overwritten. Attempt8 is the successful scope
above; earlier attempts do not establish completion.

## Remaining-seam continuation (in progress)

Attempt9 subsequently earned all four original seams with HP100. Its return
shortcut approached the original campus plateau's steep southern face and was
correctly blocked. Attempt10 instead used the source-authored eastern/northern
approach and reached the summon rotunda with all prerequisites. The operator
then incorrectly tried to walk within1m of the marker at the center of a solid
pedestal, rather than press F from the real4m interaction radius. The run stopped
at1.73m without pressing F. These are retained waypoint failures, not claims of
product progression failure. A corrected east-frontage interaction replay is
underway; summon completion is not inferred from proximity alone.


## Completed original gate chain

Attempt12 now passes the uninterrupted original-world route from empty storage
through **all four seams and real summon-circle activation**. It records the
actual eligible `[F]` prompt and authored3D radius before endpoint interactions.
The summon frontage uses (-163,256) with0.2m arrival tolerance: feet stop at
(-162.8275,10.2519,255.9998), safely within4m of the elevated marker. Attempt11's
loose1m arrival had stopped just outside the actual3D radius; that failed input
is preserved, not rewritten as completion.

Final exact-e7 result:981.516667 simulated seconds, HP100, earned energy14.52,
753 swimming frames,25 earned flags and zero runtime errors. No teleport,
forced ground, progress/resource grants or injected damage. This establishes
original mainline unlock coexistence with the new receiver/courier/harbor lead,
not yet a full fresh optional ending. Evidence: `qa/fresh-mainline-e7b660e-attempt12`
JSON/log and `qa/fresh-mainline-attempt12-driver.ts`; exact earned save bytes are
retained in the JSON for explicit normal save/reload continuation.

## Separate optional-ramp regression

The immutable later source12e5158 adds walking access; it is not used in the
successful original proof. Its independently repeated fresh route fails before
Relay B: the new solid ramp wedge blocks the old side crossing from(10,-142)
toward(-18,-160), stopping at(-18,26.0091,-157.35). Environment confirmed the new
wedge occupies this formerly traversable space. This is a genuine added-geometry
regression, not an operator center-target error, and was reported before
acceptance. Do not reroute around it and claim old-route parity. Frozen source
before/after:1,660 files,614,494,820 bytes, zero drift. Evidence:
`qa/fresh-mainline-ramp-12e5158.{json,log}` and `qa/checkpoint-tower-12e5158`.
