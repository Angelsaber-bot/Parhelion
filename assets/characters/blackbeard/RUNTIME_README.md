# Blackbeard — reconstructed character candidate

## Files
- `blackbeard.glb`: consolidated skinned character and held flintlock; embedded materials/textures.
- `blackbeard_editable.blend`: named separate editable components, studio lights/camera, rig and actions.
- `blackbeard_runtime.blend`: exact consolidated export scene.
- `hat/blackbeard_tricorn.glb`: optional complete character variant wearing the tricorn.
- `hat/blackbeard_tricorn_accessory.glb`: hat-only geometry. Bind rigidly to Head while preserving its authored rest-world placement; it is not a head-local-origin asset.
- `SOURCE_AND_LICENSE.md`: anatomy provenance and character-design rights caveat.

## Runtime conventions
- Meter-scale, approximately 2 m tall. Blender source Z-up, facing -Y; standard glTF export converts to Y-up, facing +Z. Rest sole minimum Y is approximately 0.014 m; use a -0.014 m visual-root offset if the engine ground plane is Y=0.
- 52-bone skeleton, maximum four normalized influences per vertex.
- `Blackbeard_Muzzle` is the named animated firearm VFX socket. Attach muzzle flash/projectile emission there, not at the hand origin. In the exported GLB its local **+Z is barrel-forward**, local **+Y is up**; transform those directions by the socket world matrix. This was measured against the deformed barrel triangles in Three.js. Do not reuse the source firearm’s Blender-local -Y axis. The exported parent bone is `HandR` (native Blender name `Hand.R`).
- No gameplay class assignment. No automatic damage, projectile, collision, audio or engine state machine is bundled.
- Clips are in-place, not root-motion locomotion. Apply movement speed in the engine. Gait-derived starting speeds at 1× playback: Walk **0.65625 m/s**, Run **2.23684 m/s**; scale animation playback proportionally for other speeds. These derive from stance-foot travel, not root-motion measurement. Idle, Walk and Run loop; Attack/Melee should play once.

| Clip | Length | Notes |
|---|---:|---|
| Idle | 3.000 s | Breathing/weight shift, firearm held |
| Walk | 1.066667 s | In-place walking |
| Run | 0.800 s | In-place running |
| Attack | 1.400 s | Aim, fire/recoil, recovery; emit shot at **0.566667 s** |
| Melee | 1.400 s | Optional short armed sweep; no separate sword asset |

Animations begin at time zero in GLB. In editable Blender files source actions begin at frame 1 at 30 fps; firearm event is frame 18. Five actions are independent clips, not one continuous timeline.

## Known limits and acceptance
This is the best reconstructed candidate produced in this task, **not a claim that the exact FGO face or the accepted Saber craftsmanship benchmark has been matched**. The mature face, pointed beard and stylized hair are an interpretation; close-up hair/beard strand design remains simplified. Rear hair/garment construction is simplified; the observed rear boot-wrap penetration was repaired by surface fitting. Cloth and hair are bone-driven, without cloth/hair simulation; no facial rig, lip-sync, facial expressions or cinematic mocap is provided. Hand grip and full-body actions are authored for this firearm. Very extreme engine retargeting poses require fresh garment/armor collision review. Real multi-angle renders and exported-GLB motion QA accompany the files; user art acceptance remains pending.

Materials use standard glTF PBR and embedded maps. Preserve normal maps as non-color data and color maps as sRGB. The full-quality export is intentionally not silently decimated to a mobile budget; use transport compression and profile your target device before choosing a separate lower-detail variant.

## Editing / rebuild notes
The editable `.blend` is self-contained with packed textures; no download is needed to edit it. Included Python construction files document the build rather than replacing the editable meshes. A clean rebuild additionally requires the separately downloaded official CC0 anatomy bundle at the source path in `source/base_scene.py`, and the weight/action-generation steps described in `rig/INTEGRATION.md`. Main construction order is base → form → material maps → outfit → accessories → runtime integration → final surface-clearance fix → knee padded-backing fix → boot-wrap surface fitting → footplant IK refinement. `final_surface_fix.py` and `knee_backing_fix.py` are one-time post-build operations, not an idempotent edit to rerun repeatedly. Preserve the final `.blend` as the authoritative deliverable when making manual changes.

## Footplant refinement
Walk/Run foot roll is compensated with leg IK against the actual weighted boot soles; hips, root, upper-body animation and mesh coordinates are unchanged. At the documented -0.014 m visual-root offset, independent Three sampling at 120 Hz measured Run penetration of about **2.692 mm** maximum (Walk 0.157 mm); dense quarter-frame native testing stayed below **2.70 mm**. This is below the 5 mm flat-ground target, not a claim of exact zero or terrain-adaptive IK. See `qa/footplant_surface_fix.json`, `qa/footplant_preservation.json` and `rig/final_qa/three_runtime_validation.json`.
