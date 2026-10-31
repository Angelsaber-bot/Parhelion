# Three-servant 3D cinematic remake, 2026-10-31

This pass replaces the legacy portrait-dependent presentation with actual character geometry throughout the cinematic. It reuses the existing character assets rather than claiming three newly sculpted production characters. No source/public deployment is part of this cloud iteration.

## Implemented

- `eraCinematicRemake.ts`: identity-specific face, reveal, action and recovery camera shots; clone-private material finish; real morph-target facial acting on Musashi; limited physical eye/jaw deformation on the two authored male models; restrained secondary hair and cloth motion. No 2D actor/face overlays are generated.
- Blackbeard: private stage-only reuse of the existing authored tricorn, optimized to 2,681 triangles. Its rigid skin weights follow the cloned Head bone. The default gameplay costume is unchanged. Detailed quarterdeck, helm, rope coils, lanterns and ocean surface; staged three-wave broadside; individual barrel recoil. The existing true 3D cannon-row insert is preserved.
- Napoleon: rider portrait, low horse tracking shot, mounted charge and cavalry cut; suspension through the rider seat while the private horse gallops; rein-hand constraint and outboard saber path retained. The white horse and saber remain, with no firearm. Snow avenue, stone gateway, pines and wind-bent banners form a spatial set.
- Musashi: existing full facial morphs drive closed/open eyes, resolve and vocal mouth movement; asymmetric planted stance uses analytic leg chains while body and dual blades perform alternating cuts and crossed finish. Timber dojo, dimensional shoji, sword racks and lanterns replace floating background panels.
- Cinematic-only lights respond to accepted strike notifications. These notifications never originate damage or energy events. Existing gameplay timing, skip behavior and source ownership remain the responsibility of the director/main combat code.

## Resource ownership

The stage source is never mutated. Expression geometry and materials are copied for the private stage clone, then restored/disposed on end. The hat only owns its generated geometry/materials; it borrows the clone skeleton without disposing it. New geometry is allocated at begin, not every frame. Reduced-effects mode damps secondary motion and keeps light effects restrained.

## Validation

Focused coverage lives in `validation/era-cinematic-remake.test.ts` and `validation/era-ultimate-performance.test.ts`. It checks actual expression channels, finite vertices/cameras, original source preservation, cleanup, muzzle direction, dual-blade motion continuity, rein constraint and mounted saber/neck clearance. Stage resource, renderer-state and portrait fallback tests remain in `validation/ultimate-stage.test.ts`.

`validation/characters/export-era-ultimate-sequence.ts` now samples the production `UltimateClock` rather than hard-coded legacy durations. It advances the authored skill contact timeline and exports CPU-skinned geometry with exact phase, contact, source hashes and camera data. Full actor cut-ins are explicitly disabled in exported manifests.

Rendered evidence is an offline Blender Cycles interpretation of actual scene geometry, not a GPU/FPS benchmark or full-game capture. Browser/WebGL capture could not launch because the execution environment disallowed its singleton socket. Hardware playback quality still requires later verification; no claim of exact FGO reproduction is made.
