# Blackbeard humanoid rig / animation integration

## Scope and ownership

This is the rigging component, not a finished character deliverable. Parent modeling work owns the final head, hair, outfit, materials, and character export. `rigged_body.blend` retains the older anatomy checkpoint for weight verification; transfer its armature/actions/weights onto the parent's latest same-topology body rather than replacing the improved body.

- Skeleton and clips: original authored Blender work for Parhelion.
- Anatomical weight source: Dan Ulrich / Blender Studio Human Base Meshes v1.4.1, CC0.
- Firearm in `rig_weapon_QA.blend`: original Parhelion prop by the sibling firearm task, used read-only for actual grip validation.
- No source armature, external motion capture, downloaded animation, or executable third-party script was used.

## Files

- `rigged_body.blend`: editable `Blackbeard_Rig` with 52 bones and five original actions. Source body has 42,342 vertices.
- `body_weights.json`: normalized vertex-index weights, maximum four influences per vertex. Use only when body count and vertex order are unchanged.
- `rig_manifest.json`: exact rest-space bone coordinates, action timing, and corrected firearm rest-world matrix.
- `transfer_weights.py`: importable Blender helpers for direct body weight transfer, rigid attachments, and nearest-surface clothing weight interpolation.
- `rigged_body_test.glb`: body-only skeletal interchange test, not the final dressed character.
- `roundtrip_validation.json`: imported GLB deform/animation checks.
- `kinematic_audit.json`: connected-joint gaps, scale checks, and actual ankle paths for every frame.
- `rig_weapon_QA.blend` and `previews/FINAL_*.png`: actual mesh/gun pose inspection.
- `previews/Run-actual-render-QA.gif`: actual rendered twelve-frame running cycle, when the render job completes.

## Axes and attachment

Blender meters, Z up, character faces -Y. Standard glTF conversion maps this to glTF Y up / +Z forward.

Right hand is `Hand.R`. Source wrist is `(-0.460, -0.086, 1.022)`, palm bone tail is `(-0.482, -0.127, 0.949)`. Left mirrors X. Forearm bracers must follow the sloping forearm rest axis, not the world Z axis. Refer to the manifest for all finger joints.

For the original firearm, local muzzle is -Y, up +Z, origin near stock palm center. Transform all local firearm geometry by `weapon_attachment.rest_world_matrix`, apply transforms, then rigidly weight every vertex to `Hand.R`. This matrix was corrected against the actual curved stock and firing hand, not merely estimated from axes. Do not additionally apply the weapon creator's prior grip-origin offset; it is already baked into the prop.

Rigid parent attachments should use armature modifiers / vertex groups in a consistent rest space. Set the armature as the object parent as well; unparented skinned meshes generate exporter warnings. A direct bone-parent empty can be used instead, but requires the corresponding inverse-bind offset and Blender's bone-tail convention to be handled explicitly.

## Clips (30 fps source)

| Action | Source frames | Duration | Behavior |
|---|---:|---:|---|
| Idle | 1–91 | 3.0 s | Breathing / small head motion; firearm grip retained |
| Walk | 1–33 | 1.066667 s | In-place alternating planted-foot gait |
| Run | 1–25 | 0.8 s | In-place faster crouched gait, larger arm and swing motion |
| Attack | 1–43 | 1.4 s | Raise right flintlock, aim, recoil, recover |
| Melee | 1–43 | 1.4 s | Optional short right-hand sweeping strike; not a separate weapon asset |

Use crossfades between locomotion and one-shot clips. No locomotion root translation is embedded; gameplay moves the actor. Attack fire event is frame 18, or **0.566667 s** in the zero-based GLB. Add flash/smoke/sound/projectile events in the game. The flintlock prop's muzzle socket is local `(0, -0.467, 0.138)` before attachment transform.

## Export settings verified in Blender 4.3.2

`export_animation_mode='ACTIONS'`, `export_anim_slide_to_zero=True`, `export_force_sampling=True`, `export_frame_range=False`, `export_skins=True`, `export_all_influences=False`.

The zero-slide flag matters: otherwise source frame 1 starts at 0.033333 s, adding a small hold to repeated clips. All five test GLB clips now start at exactly 0.

## Verified and remaining limits

- Heat bind left zero unweighted vertices; weights normalized and limited to four.
- Source connected-bone gaps are zero across every sampled frame; scale deviation is under 0.000001.
- Stance ankle Z stays at 0.110 m within numerical tolerance. Walk/run swing ankles rise to about 0.185 / 0.279 m.
- Actual GLB reimport contains 52 joints, one skin, and all five moving clips. Loop first/last evaluated vertex deltas are exactly zero in the test.
- Real gun/body renders were inspected for hand position, forward aim, recovery and recoil. The grip is stylized; it is not a cinematic finger-performance rig.
- This is body/finger skeletal animation, not facial blendshapes, lip sync, cloth simulation, or a polished cinematic motion-capture set.
- Final costume, straps, fur, knee plates and boots need pose inspection after parent transfers weights. Nearest-weight transfer alone is not proof that those accessories deform correctly.
