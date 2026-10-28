# Chaldea skinned protagonist — private art candidate

`player_v2.glb` is a genuine GPU-skinned character, not the earlier segmented rigid body or CPU cloth patch.

## Assembly contract

- Physical meters; glTF Y up, character faces **−Z**, unmirrored. Runtime wraps the entire asset in a proper +π Y rotation to face game +Z. Do not rotate/mirror the head separately.
- One skin, 75 bones: original 67-bone VRoid humanoid hierarchy (including all 30 finger joints) plus `UniformFront_L/R`, `UniformBack_L/R`, and each `_Tip`.
- Imported rest quaternion frames must be captured from the actual GLB; do not assume raw-source identity rotations or old procedural −Y bone directions.
- Anatomical right is source +X. It grips the weapon and bears the red dorsal seal; source hand dorsal +Y / palm −Y in glTF bind space.
- 17 material batches: frozen head 9 unchanged; body 8. Material distinctions, head UV1 skin atlas, image maps and masked iris/lid layers must survive runtime material conversion.
- Neutral facial expression only. See `EXPRESSION_MANIFEST.json`; no claim that 54 expressions or blink were recovered.

## Authorship and provenance

The approved head is a derivative of legally verified VRoid Project CC0 `HairSample_Male`. The underlying continuous weighted torso/arms/hands/trouser topology and 67-bone skeleton derive from the verified CC0 `Base_Male`, not from a commercial game extraction. The fitted uniform shaping, curved split tunic, collar/harness/belt/hardware, shoe last, right-hand seal treatment, materials and additional garment rig are new private fan-character adaptation work. This is **not entirely modeled from zero**. CC0 base permission does not license the FGO character identity or trademarks. Official references are private comparisons, not production textures and are not bundled.

## Editable source and checks

The private authoring workspace contains:

- `body-studio/sculpt/02_chaldea_skinned_master.blend`: editable separate body details and formal rig, approved portable head.
- `body-studio/sculpt/03_chaldea_game_export.blend`: same appearance/rig, equivalent body details combined by material.
- `body-studio/sculpt/01_head_design_source_weights.blend`: approved reversible head design layers with independently restored source weights, no expression recovery claim.
- `body-studio/qa/material-batch-pose-parity.json`: actual skinned triangle coordinates before/after batching in bind/run/glide; all material maximum errors 0.
- `body-studio/qa/head-exact-geometry-transfer.json`: exact approved head geometry transfer before assembly translation.
- `body-studio/qa/cloth-pants-clearance.json`: limited authored-pose triangle-crossing checks, not a cloth physics/collision simulation guarantee.

The source GLB is frozen at SHA256`ea211c2e34b980fb8ec372346a1e4d22279171543d861b7102c062ebdfdc05d5`. Root accepts the few sub-millimeter seal-corner discontinuities visible in extreme hand closeups as a nonblocking polish item; the art is not described as flawless. This package remains a candidate until actual runtime weapon/glider/deformation QA and final root review pass. Offline previews are not proof of browser material or frame-time parity.
