# Male player — authored game-runtime candidate

## Provenance and scope

This is newly authored fan-character geometry inspired by Fujimaru Ritsuka's classic white Chaldea uniform in the official *Fate/Grand Order -First Order-* character sheet. No commercial game mesh, downloaded fan model, Saber mesh, texture rip, or third-party model is included. It is not an official or licensed FGO asset; the underlying character design remains its owners' property. Official reference images are review-only and are not packaged as game textures.

The current deliverable is an **iterated, game-ready candidate**, not a claim of professional character-art parity with FGO, Persona, or Xenoblade. The hair silhouette and facial expression still warrant further character-art refinement. There is no facial blendshape rig or production skin-weight deformation: compatibility uses the existing articulated joint groups.

## Files

- `build_player.py`: reproducible Blender authoring/export source. Editable anatomical ring cages, sculpted hair ribbons, garment panels and seams, distinct curled fingers, command seal on the right hand, shaped boot lasts.
- `fujimaru_player_editable.blend`: editable source scene and neutral studio.
- `player-metrics.json`: actual mesh/triangle/byte counts and GLB hash. `bodyMeshCount` is not a measured GPU draw-call count; outlines, weapons, shadows and render passes are additional.
- `../../../world/src/generated/player-mesh.json`: indexed, quantized per-joint geometry, with normals and linear vertex colours.
- `../../../world/public/assets/character_explorer.glb`: equivalent exported body and compatible joint hierarchy, not the separate Dawn AR asset.

Build from repository root:

```sh
blender -b -t 6 --python assets/characters/player/build_player.py
```

The build creates six real Cycles inspection renders in the sibling `protagonist-review/player/` folder. Those are neutral-lit offline model checks, **not WebGL screenshots or FPS evidence**.

## Runtime contract

`world/src/playerMesh.ts` decodes indexed buffers synchronously into 12 body meshes sharing the existing toon material. No asynchronous character pop-in is introduced. The original Hips/Spine/Head/Arm/Forearm/Thigh/Shin joint names and lengths remain. ScarfTail/Ponytail placeholders remain empty for animation API compatibility; the male uniform has neither scarf nor ponytail. Gun and glider meshes stay in their original equipment path. Both hands preserve the existing grip/support point conventions.

The compact geometry stores positions as signed 16-bit integers at 0.1 mm resolution, normals as normalized signed 8-bit components, colours as normalized linear 8-bit components, and triangle indices as unsigned 16-bit integers. The exporter drops quantization-collapsed triangles identically in both outputs.

The short uniform skirt has deliberately limited secondary rotation, unlike the old long coat. Its 864-vertex lower panel follows the corresponding thigh with smooth weights while the waist remains fixed. Rest positions/normals are cached, offsets are never accumulated, and the bounding sphere is enlarged conservatively by 0.20 m. A small inner-waist overlap and elbow/knee fabric transitions reduce gaps in the retained rigid articulation scheme. This does not replace a full skinned cloth/character rig.

## Performance honesty

The new character has substantially more triangles than the old roughly 2.7k-triangle primitive placeholder. Quantization, indexing and one shared body material constrain that added cost; **the character itself is not a geometry-reduction optimization**. Final runtime performance must be measured in the actual game/browser, including outlines and the real weapon.
