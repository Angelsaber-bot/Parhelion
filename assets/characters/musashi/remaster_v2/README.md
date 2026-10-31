# Musashi runtime model refinement v2

Project-authored geometric refinement of the existing Musashi design; not a new costume or identity. Original files remain alongside this directory unchanged.

- Rebuilt both blade sections with distinct spine, ridge, bevel, cutting edge and tapered points. Native hand attachments and longitudinal tips retained; old rounded temper tube base differs by approximately 43 micrometres.
- Selective curved hair tessellation, with 17 existing front-lock roots embedded into the head cap (1,485 vertices); etched strands follow the same displacement. Original hanging tips remain. No experimental extra comb-like strands are included.
- Upper silk receives up to 2.2 mm clearance to remove demonstrated skin poke-through; existing red piping follows the displaced cloth.
- 15 meshes, 15 materials, 65 bones, 203,994 rendered triangles (1,258 fewer than the original 205,252). Original BIN prefix retained for strict provenance; raw runtime file therefore grows by 2,085,592 bytes despite fewer rendered triangles. Final runtime is 14,497,360 bytes raw / 7,853,221 gzip. This is not an FPS or GPU benchmark.
- Nodes, rig, source animation clips, textures, materials and face morph channels are preserved. Runtime motion remaster is separately implemented in Musashi-specific TypeScript.

## Provenance and rebuild

Read and retain [original provenance](../reference/PROVENANCE.md) and [base creator terms](../reference/BASE-CREATOR-TERMS.txt). Original base anatomy/face/rig attribution and restrictions remain in force. Newly refined blade sections, project clothing and hair geometry do not imply authorization from TYPE-MOON/FGO or other character-IP holders. This private development bundle is not a publication or a relicensing claim.

From repository root, using Python standard library only:

```sh
python assets/characters/musashi/scripts/remaster_runtime.py assets/characters/musashi/Musashi_Runtime.glb assets/characters/musashi/remaster_v2/Musashi_Runtime.glb assets/characters/musashi/remaster_v2/geometry-report.json
python assets/characters/musashi/scripts/remaster_runtime.py assets/characters/musashi/Musashi_Runtime_LOD1.glb assets/characters/musashi/remaster_v2/Musashi_Runtime_LOD1.glb assets/characters/musashi/remaster_v2/lod1-report.json --lod
```

The patcher emits deterministic gzip too. Original authoring blend is unchanged; this script is the reproducible final geometry source. Manifest pins shipped byte hashes. Node-only CI loads committed GLBs and checks immutable JSON/BIN provenance, the exact seven-primitive whitelist, native sockets/tips/contact poses and collision clearance; no Blender or external evidence is required for CI. Offline CPU image previews verify selected views, not real-time GPU rendering.
