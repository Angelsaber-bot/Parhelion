# Musashi remaster — 2026-10-31

## First playable motion checkpoint

The established face, blue-violet costume, rose-white swept hair and two differently sized katana remain the design authority. No damage, target, charge, cooldown, cancellation or contact clock is changed.

- Ordinary Attack now has low-carry entrance/recovery, deliberately loaded preparation and faster two-cut travel. Both complete native contact samples remain exact at 19/30 and 33/30; existing shared ally cooldown still applies to the second contact.
- Native face uses its existing Blink/Angry morphs for a restrained idle blink and combat focus; all states own both channels, avoiding stuck expressions after interruption.
- `musashiUltimatePerformance.ts` is a private-clone, Musashi-only performance: two-stage stance opening, planted release feet, weighted hips, right/left anticipations, separate crossed finish and low recovery. It derives anticipation from the existing skill remap but only consumes actual strike notifications. Reset/dispose restore captured transforms exactly.
- Twelve focused real-model/ordinary-HP/event/transition/geometry/expression tests and configured World typecheck passed at the first checkpoint. Maximum sampled hand step 4.57 cm at 120 Hz in the dedicated performance; native model contact poses remain unchanged. Offline poses are not GPU or full input acceptance.

## Asset refinement and final preview

Final v5 native geometry is under `assets/characters/musashi/remaster_v2`: rebuilt two-blade cross sections, selective hair curvature and embedded original fringe roots, plus demonstrated silk skin-poke clearance with matching piping. Existing face/costume/hair design is retained. See its manifest and README for precise scope, provenance and byte/triangle budgets. Five native model/motion contract tests pass. New same-camera front/side and blade macro CPU renders are in the sibling `parhelion-four-servants-evidence/musashi` evidence directory; these are fresh offline previews, not GPU footage. Runtime input QA is independently owned.

## Final fixed model and framing checkpoint

- Model commit `906e073`, model/LOD/transport proof `6a1d5b0`; runtime raw SHA-256 `8a7213975e5e71819f02037a2d311573fb5832bfbfedd0f3a5eea6d276e66213`. Catalog URL was integrated separately by the shared-system owner (`2b2c01a`). Three model tests cover both LODs and committed transport hashes.
- Root reviewed newly rendered v5 front/side views: original fringe roots now connect to the cap, experimental extra comb-like strands were removed, and silk/trim clearance remains visible. The upper fringe transition remains somewhat planar; no claim of a wholly redesigned head or perfect topology.
- `MusashiWindupCamera` only adjusts normal-effects charge progress `.3–.9`: smooth reveal is complete by `.43`, returns toward the prior camera after `.65`, and is exactly inactive by `.9`. Intro/early face focus, reduced mode, late charge, release and outro remain unchanged. A native full-vertex component audit found the former mid-charge portrait blade span exceeded NDC ±2.35; eleven charge samples from .45 to .95 plus a release sample now retain all model vertices in landscape and portrait. This is projection/geometry evidence, not occlusion, GPU or actual-input acceptance.
- Fresh v5 CPU motion export uses the final asset and current dedicated performance with production 1.2 s intro + 3.8 s charge timing. Sampled minimum ultimate foot height is −0.000000323 m (floating-point tolerance), blade height .740 m, no sampled body/cloth intersection, and maximum 60 Hz hand step .0787 m. Exact transform restoration is separately asserted by the native lifecycle test; quaternion angular diagnostic has floating-point residual ~6e−8 rad.
- Fresh ordinary contact and idle images: sibling evidence `musashi/final-v5-contact-renders/`. Final 30 fps ordinary/ultimate studio sequence is rendering from `musashi/final-v5-acting/`, not reused footage. World terrain gait, actual damage/charging/X/camera restoration and resource disposal are independently exercised by runtime QA. Studio in-place walking is not evidence of world locomotion or GPU performance.
