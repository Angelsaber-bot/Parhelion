# Everwinter material direction

The ten `M_Winter*` identities opt in by exact name. Shared materials, Kyoto profiles,
water, emissive frost gates/targets and all other regions retain their existing paths.

- **Snow:** blue-grey undersides, softly warm upper planes, tiny broad brush variation,
  restrained rim and soft bright-light shoulder. Real caps/overhangs belong to geometry.
- **Timber / charred wood:** low-amplitude drawn grain; charred wood is almost fully matte.
- **Plaster / brick / stone:** warm authored vertex colors and broad, sparse weathering.
  No fake brick grids over arbitrary geometry.
- **Copper:** patina comes from the authored teal/green palette; a cool, broad tint
  distinguishes roofing from warm gilding without a shiny plastic response.
- **Gold:** limited warm banded glint reserved for gilded cupolas and details.
- **Iron:** rough, dark, gently edged metal, not chrome.
- **Canvas:** tiny derivative-filtered weave fading at distance, no photographic texture.

`winterMaterialProfiles.ts` defines portable PBR roughness and metalness for exported GLBs.
`winterMaterials.ts` translates the same identities into the existing `MeshToonMaterial`
lighting ramp at runtime, preserving vertex color, side, transparency, opacity, alpha test
and depth settings. The shader uses no new textures, uniforms, loops or additional passes.

## Verification boundary

`validation/winter-materials.test.ts` checks exact opt-in, runtime conversion, full Three
shader-chunk expansion/source contracts, special-case snippets, and an actual compressed
small-fixture GLB export/load/runtime roundtrip for all ten profiles. It also guards the
world-winter-only addition to exact ART vertex welding and unchanged collision ordering.
These tests **do not constitute GPU compilation or visual-render verification**. The
current browser sandbox limitation is tracked by the task owner; do not claim otherwise.

Exact welding happens after the existing reorder/quantize sequence and skips every
`M_Collision` primitive. There is no post-quantization document reorder, simplification,
tolerance-based welding, collision reordering, or material merging.
