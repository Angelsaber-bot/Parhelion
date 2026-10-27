# Optional Blackbeard tricorn

Original editable tricorn accessory for the selected bare-chested Blackbeard costume. It is **optional**, not a replacement for the user's chosen core costume or a default visibility decision.

## Files
- `blackbeard_tricorn_editable.blend`: hat-only asset collection plus separate studio lights/camera.
- `blackbeard_tricorn_accessory.glb`: hat-only runtime interchange, no studio objects.
- `blackbeard_tricorn.glb`: complete optional hat-enabled character runtime variant, preserving all five actions and the named muzzle socket.
- `blackbeard_tricorn_runtime.blend`: losslessly compressed native scene for the complete optional variant.
- `source/build_tricorn.py`: original construction source.
- `previews/`: actual Blender standalone, on-head and exported roundtrip renders.
- `qa/tricorn_on_character_QA.blend`: append-only private fit check; the main character source was not modified.

## Fit and attachment

Coordinates are **character rest-world coordinates**, Z up, all parented to `Blackbeard_Optional_Tricorn_ROOT` at `(0,0,0)`. Do not move the asset to the head's bone origin before binding: preserve world placement and bind to `Head` (or assign full rigid Head weights). The hat was designed around the provided scalp centered at X 0, Y approximately 0.015 m, top approximately 2.00 m, with room for existing hair. All hat objects include `optional_accessory=True` and `bind_bone='Head'` metadata.

The crown, single continuous folded brim, red ribbon, narrow brass edge, fine saddle stitches and original compass emblem are separate editable meshes. The curve source is retained in the script; curves have been converted to mesh for export. Small decorative details may be merged by material for runtime draw-call reduction without changing their shape.

## Authorship and rights

All hat geometry, material assignments and the small compass symbol were authored specifically for Parhelion. No third-party meshes or image textures were downloaded or embedded. The on-head preview includes the parent's authored-base character solely for fit verification; the hat-only deliverables do not contain that character.

## Scope

The hat-only accessory is static, with no cloth simulation or independent animation rig. It should move rigidly with the character's head. The complete optional character variant includes the main rig and animations as documented below. The user/parent retains the decision whether it is equipped by default. Keep the un-hatted character variant available.

## Final validation

Actual standalone, front and three-quarter on-head views were inspected. The brim clears the eyes/face; the existing fringe remains visible beneath it. A fresh GLB import was rendered and visually matched against the native accessory. All 15 mesh components imported with finite coordinates and no studio cameras/lights.

- Hat-only accessory triangles: 38,684.
- Hat-only accessory GLB size: 771,440 bytes.
- Bounds minimum: `(-0.214615, -0.150687, 2.000719)` m.
- Bounds maximum: `(0.212004, 0.245394, 2.155759)` m.
- Width: 0.4266 m; height: 0.1550 m.

The optimized export reduces excessive crown/trim tessellation from the initial 82,212 triangles without replacing the brim/crown silhouette with a lower-detail shape. Source geometry and subdivision remain editable in the native file.


## Complete optional character variant — final main revision

`blackbeard_tricorn_runtime.blend` and `blackbeard_tricorn.glb` were rebuilt from the final padded-knee, surface-fitted boot-wrap and footplant-refined main runtime scene, not the earlier interim snapshot. Main-source SHA-256: `9ca0308a93a76d0b069906ad9f4b3904100a515644aaa38c807cb10a2a334d16`. The source-main hash remained unchanged throughout this operation. The native optional variant is saved with lossless Blender compression.

The joined `Blackbeard_optional_tricorn` mesh is rigidly weighted to `Head`; every exported nonzero hat weight was checked against the Head joint. The complete GLB preserves `Idle`, `Walk`, `Run`, `Attack`, and `Melee`, all beginning at 0 seconds, plus the named `Blackbeard_Muzzle` socket. There are 5 meshes, 33 material primitives, 31 materials and 1 skin. Complete GLB size is 19,647,152 bytes. The hat adds 38,684 triangles; it does not change the main body or costume topology.

Final actual full-body preview: `previews/05_runtime_variant_full.png`, refreshed at 32 samples from the boot-wrap repair revision. `previews/06_runtime_variant_face.png` is retained from the immediately preceding revision because the head/hat geometry was unchanged by the knee-backing and boot-wrap repairs. Hat/forehead/fringe clearance was visually inspected; no obvious hat/hair clipping appears in these views. This is not a claim that all possible character poses or the whole character's artistic quality have been independently accepted.

Structural validation: `qa/runtime_variant_native.json` and `qa/runtime_variant_glb.json`. The complete character variant inherits the main character's Blender Studio/Dan Ulrich CC0 base credits and FGO-reference derivative-design limitations; the hat itself adds no third-party asset dependency. Preserve the main project's source/license manifest when redistributing the complete variant.

Final complete-variant GLB SHA-256: `c7055fe4a7d7daea936bdee00f8ba812edeeb3e80e456fce1bbdc612041496d7`. Native compressed scene SHA-256: `42fa49bff782262f7996a5a2ee7d25f28f4d8a94b04769b6e956e1bf41ca9a77`. Total complete-variant triangles: 440958.

An optional deterministic `blackbeard_tricorn.glb.gz` transfer sidecar is included (7500677 bytes), with exact decompression equality verified. A raw GLB loader must decompress it first or receive correct HTTP Content-Encoding; it is not a separate glTF format.

The final footplant refinement changes only Walk/Run leg animation. Hat/body mesh coordinates and Idle pose are exactly unchanged, so the inspected static hat previews are retained; the complete variant GLB and native actions were re-exported from the refined main.
