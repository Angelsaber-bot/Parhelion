# Formal skinned player integration — private candidate

## Default path and scope

`main.ts` now awaits `loadSkinnedCharacter()` and the **actual Dawn AR** before gameplay. The character is a GLB SkinnedMesh actor with one 75-bone skeleton, measured imported bind frames, complete hands/fingers and eight uniform-panel bones. The old segmented `character.ts` / quantized `playerMesh.ts` remain explicitly archived regression fixtures only; the default JS no longer imports them or their CPU vertex-warp cloth path. There is no automatic rejected-body fallback. Character/required-rifle failure reaches the existing boot error/retry UI instead of enabling invisible equipment.

No map assets, controller speeds/collision, shared input settings, shoulder camera, aim limits, damage/cadence or quest rules were changed by this runtime integration. The content baseline is the reconciled `ce52f3e` tree (the copied local Git HEAD is older metadata). `protagonist-review/round2/player-skinned-main-only.diff` isolates the narrow changes against the reconciled main.ts, rather than misattributing older dirty-tree work.

## Asset and appearance contract

- Frozen character asset: `assets/characters/player_v2/player_v2.glb`, SHA256 `ea211c2e34b980fb8ec372346a1e4d22279171543d861b7102c062ebdfdc05d5`, 3,687,484 bytes.
- 77,300 character triangles, 17 material batches, 75 bones. The approved head's 47,130 triangles are preserved, not silently decimated to satisfy an obsolete 35k whole-character estimate.
- Raw asset is Y-up / −Z forward in meters. A proper Y=π wrapper gives game +Z forward; no negative-scale mirror. The actual anatomical right hand grips and bears the dorsal Command Seal; the actual left supports the handguard.
- Material clones preserve textures, color space, alpha/masking, sidedness and the skin atlas's **UV1 / texCoord 1**. The map-art material converter is deliberately not used for the player.
- Skinned outline meshes share the actor's skeleton, bind matrices, immutable geometry and any existing morph-influence array. Extrusion follows skinned/morphed normals; facial graphic layers and the seal are not independently hulled.
- **Neutral facial expression only.** The approved art head had lost the original expression rig during redesign. Source-correspondence skin-weight recovery has been performed by the asset stage; 54 expressions/blink have **not** been restored. See the asset's `EXPRESSION_MANIFEST.json` and source/provenance files. No runtime facial-expression claim is made.

## Animation and equipment

`SkinnedCharacterAnimator` preserves the existing locomotion state and `facing`, adding `firing`, presentation-only `lookYaw`, and synchronous `prepareShot()` for the real event path. Rest translations/quaternions are captured from the exported rig; there are no legacy −Y arm or fixed .27/.28m IK links. Pose rotations are expressed through each imported bind basis. Body posture, clavicles, elbows, wrists, toes, fingers and uniform panel chains are actual bones; position/normal buffers remain unchanged during animation.

Rifle scale is deliberately fixed to the existing fitted Dawn size (`.7873802602519613` after registry mount conversion). Both **palm contact transforms**, not wrist origins, are solved against the real grip/support anchors. The full camera pitch range ±1.5 rad remains. A continuous right-shoulder placement keeps the real stock/receiver outside the head/neck through low-ready and partial ADS, with modest clavicle protraction and anatomical neck limits. Muzzle queries use the production registry point transformed by that same real gun.

The glider has visible horizontal grips and braces. Normal glide uses bent elbows, a small forward torso lean, relaxed trailing knees, a restrained turn bank and folded-wing deployment. Hands transfer to real rifle contacts for ADS/firing, then smoothly back to the handles; flight physics and camera remain unchanged.

### Explicit first-shot tradeoff

The existing input handler calls `shoot()` immediately, before another animation frame may happen. The production shoot function calls `anim.prepareShot(cameraDirection)` **after the original shot-eligibility guard and before reading the muzzle**. It uses the same actual camera direction as target selection, synchronously aligns character yaw and weapon pitch, solves both hands and updates matrices. This deliberately bypasses locomotion's dt-dependent yaw interpolation, which has zero gain in an input-event dt=0 update. Held-fire frames remain aligned between eligible shots; release eases the presentation pose back without changing ADS input/FOV or shot cadence.

Consequently, the first airborne shot deliberately switches to rifle contact instantly (about 65cm left-hand travel in the neutral glide check). After stationary free-look, a large first-shot yaw change also turns the character and attached glider instantly, potentially up to 180°. This is a presentation-only turn: camera, physics and input do not change. Ordinary deployment/ADS return/landing is eased; the exceptional shot handoff/turn is not presented as a fully animated quickdraw. A delayed turn/draw would require a separate gameplay decision, not a hidden firing delay.

## Verification and evidence

New focused tests cover real GLB skinning/weights/anatomical laterality, UV1/alpha preservation, actual Dawn palm/muzzle contracts across full pitch and partial ADS, visible glider contacts, immutable GPU-skinned buffers, shared-skeleton outlines, bounded ordinary transfers, explicit failure handling and exact triangle-surface checks at previously failing ADS positions.

`shooting-integration.test.ts` executes the actual production `shoot()` without waiting for RAF; independent `player-qa/first-shot-regression.mts` also executes actual `press()` → `shoot()` with the real rig/weapon. The earlier failing evidence is retained. No back-slung first-shot fallback is claimed to pass from an animator-only test.

Independent review scripts under `protagonist-review/round2/player-qa/` inspect actual CPU-deformed runtime triangles and export textured static poses/video. These are **offline runtime-pose renders, not a live browser recording**. The delivered 6-second model/glide preview remains the frozen earlier animation SHA `de4fd459c857d67d1f51cc6bf7b3ee9cf4ab702ae4cd01b3c2d0a9bb4c82f927`; it is not evidence of the subsequent free-look shot correction. That candidate includes the right-rifle palm correction placing the actual index in the trigger-guard region.

The post-preview free-look correction is a separate runtime version: animator SHA `694e3ce064ea4d54603d9ba35c19ba5e2978d07b2460a9dfcb12536b662fb78d`, main SHA `7d50de38eb3c3d1223416578bc504e789fd7debf8920a0cdd0a6cea03391adfe`. `shooting-free-look.test.ts` executes actual production press/shoot/frame statements with real meshes: ±90°/±180° free-look, full pitch, ground/swim/glide, no RAF before first fire, continuous fire at 30/60/120Hz and cadence gating. It checks actual Dawn muzzle-section direction, palm contacts, shot origin and unchanged camera/input. **310/310 World tests and TypeScript + Vite build pass**; supplementary evidence is in `player-qa/free-look-first-shot/`. Earlier 308-test logs and video remain explicitly versioned rather than overwritten.

Browser execution remains unavailable under the existing environment/security restriction; no bypass or user-device session was started. Browser shader appearance, pointer lock and measured GPU/frame-time therefore remain unverified.

## Honest costs

Current visible inventory (not measured WebGL calls):

| State | Color meshes / triangles | Outline meshes / triangles |
|---|---:|---:|
| Ready, actual Dawn equipped | 43 / 117,660 | 10 / 66,652 |
| Deployed glider | 55 / 117,986 | 10 / 66,652 |

Shadow/postprocess passes are additional. The weapon itself is unchanged at 40,360 triangles / 26 material primitives / 2,553,624 bytes. Five approved head images occupy roughly **21.3MiB decoded RGBA with mipmaps**, an estimate rather than measured GPU allocation. One 75-bone texture is about 6.4KB in the pinned Three.js renderer. No expression morph texture is allocated in this neutral-only asset.

The built character GLB is ~3.69MB plus the existing ~2.55MB rifle; current main JS is ~996KB / ~280KB gzip. Both full original VRMs are authoring/provenance inputs, not runtime imports. No new runtime dependency or decoder has been introduced.

The earlier de4 candidate's Node animation/hierarchy CPU proxy with the actual rifle in both rigs measured median ~**0.042ms previous segmented / 0.135ms new skinned** (same five states, 4,000 warmup, seven × 6,000 samples). This is expected additional pose/IK work, **not a measured browser FPS/GPU result or a performance improvement claim**. See hash-stamped `player-skinned-cpu.json` and reproducible `validation/benchmarks/player-skinned-cpu.ts`; it is not silently relabeled as a benchmark of the later yaw correction.

## Remaining delivery gates

Root's model/glider preview and the later shot-facing patch are separately versioned. The authoring/source package and final report must agree on the same frozen asset. Follow the supplementary yaw-correction manifest for its independent acceptance status; the old video does not validate that new shot path. No GitHub push, deployment, Work/Mac launch or external publication is included in this work.
