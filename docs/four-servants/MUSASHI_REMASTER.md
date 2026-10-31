# Musashi remaster — 2026-10-31

## First playable motion checkpoint

The established face, blue-violet costume, rose-white swept hair and two differently sized katana remain the design authority. No damage, target, charge, cooldown, cancellation or contact clock is changed.

- Ordinary Attack now has low-carry entrance/recovery, deliberately loaded preparation and faster two-cut travel. Both complete native contact samples remain exact at 19/30 and 33/30; existing shared ally cooldown still applies to the second contact.
- Native face uses its existing Blink/Angry morphs for a restrained idle blink and combat focus; all states own both channels, avoiding stuck expressions after interruption.
- `musashiUltimatePerformance.ts` is a private-clone, Musashi-only performance: two-stage stance opening, planted release feet, weighted hips, right/left anticipations, separate crossed finish and low recovery. It derives anticipation from the existing skill remap but only consumes actual strike notifications. Reset/dispose restore captured transforms exactly.
- Twelve focused real-model/ordinary-HP/event/transition/geometry/expression tests and configured World typecheck passed at the first checkpoint. Maximum sampled hand step 4.57 cm at 120 Hz in the dedicated performance; native model contact poses remain unchanged. Offline poses are not GPU or full input acceptance.

## Asset refinement and final preview

Final v5 native geometry is under `assets/characters/musashi/remaster_v2`: rebuilt two-blade cross sections, selective hair curvature and embedded original fringe roots, plus demonstrated silk skin-poke clearance with matching piping. Existing face/costume/hair design is retained. See its manifest and README for precise scope, provenance and byte/triangle budgets. Five native model/motion contract tests pass. New same-camera front/side and blade macro CPU renders are in the sibling `parhelion-four-servants-evidence/musashi` evidence directory; these are fresh offline previews, not GPU footage. Runtime input QA is independently owned.
