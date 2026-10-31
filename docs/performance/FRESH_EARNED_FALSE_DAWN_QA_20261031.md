# Fresh earned mainline → False Dawn completion

**Product source:** frozen `e7b660ede943097233a11b70cebf7fb887f1e7bc`.
This is real production-main CPU logic/physics/native assets under a deterministic
synthetic keyboard/mouse operator, not GPU rendering, human playtime or discovery.
Known route waypoints and correct dialogue answers are explicit operator knowledge.
No teleport, forced grounding, constructed progression, gifted energy/HP or injected
damage occurs. Later player-foot visual integration needs its separate final replay.

## Continuous earned chain

1. `fresh-mainline-continuation.ts` starts with empty storage at normal spawn.
   It earns onboarding/HQ/armory, receiver repair, real courier victory and harbor
   lead, all six range/ruin rifle targets, both relays, original staged tower
   jump/glider/perch traversal, four seams and actual summon activation.
   Successful attempt12:981.516667 simulated seconds, HP100, earned energy14.52,
   753 swimming frames,25 earned flags, no errors.
2. `earned-harbor-continuation.ts` reloads those **exact saved bytes**, not a list
   of manufactured flags, at normal production spawn. Save SHA-256:
   `a0a7d55bb67a5a360f5eba1bedb96601df27ea155495436f4d822b06402d4520`.
   Normal reload starts energy0; this is not a resource grant or persistence claim
   for temporary charge. The operator physically crosses the unlocked east pass,
   reaches BlackSail for the first time, registers its safe settlement, walks the
   full hub-to-field route, wins the harbor fight and chooses the living key.
3. The actual configured travel key opens the production travel panel. Its
   legitimately discovered Alpha destination is selected, with HP unchanged.
   The operator walks the original dry bridge route, starts and wins the array
   battle, physically disables I→II→III, starts and defeats the Warden, then
   selects the **seal** ending through ordinary dialogue keys. No director start
   or damage API is invoked by the driver.
   Successful ending attempt2:309.25 simulated seconds, HP100, earned energy100,
   all three anchors and ending persisted, no errors. These numbers are not a
   difficulty/human-play estimate; the deterministic aiming policy is synthetic.
4. `verify-earned-ending-reload.ts` performs another normal production boot of
   the exact final saved bytes. Final save SHA-256:
   `54b6e13fe442a5b74b256de303c77e5aeb1210391c13ffd005c756378a9dd346`.
   All37 flags and three discoveries match, stage remains complete/seal, no
   encounter restarts, normal spawn is(3,20.494974,159), HP100/energy0, no errors.

## Genuine route findings and retained operator failures

- Direct north from(518,-30) toward the BlackSail hub met an isolated vertical
  static prop at(517.981,-55.007): forward rays at feet+.5/+1.2 hit at.353m with
  horizontal normal(.1334,0,.9911), while a surrounding ground grid is gentle.
  A deliberate ordinary4m west sidestep through(514,-50)→(514,-64) passes. Exact
  ART identity is not asserted; no collision or geometry was changed.
- A post-Warden return originally tried to walk through console housing before
  interacting. The corrected approach stops when the **exact console's rendered
  prompt, grounded state and authored3D radius** are valid. That runtime prompt
  already applies its production line-of-sight check. It then presses real F;
  there is no interaction bypass. The failed ending-stage save is retained.
- Original campus/pedestal arrival mistakes and the rejected new ramp regression
  remain separately documented in `FRESH_ORIGINAL_MAINLINE_QA_20261031.md`.

Workspace evidence (not raw heaps):
`qa/fresh-mainline-e7b660e-attempt12.{json,log}`;
`qa/earned-harbor-e7b660e-attempt{1,2,3}.{json,log}`;
`qa/earned-harbor-ending-e7b660e-attempt{1,2}.{json,log}`;
`qa/earned-ending-reload-e7b660e.{json,log}`;
matching immutable driver snapshots. Failures are preserved, not overwritten.

Reproduction: run the fresh driver with WORLD and output JSON; pass that JSON to
`earned-harbor-continuation.ts WORLD PRIOR_REPORT OUTPUT --ending`; then pass its
report to `verify-earned-ending-reload.ts WORLD PRIOR_REPORT OUTPUT`.
