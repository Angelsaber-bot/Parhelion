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
