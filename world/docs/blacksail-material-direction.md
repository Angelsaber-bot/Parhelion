# BlackSail material direction — 1718 maritime chapter

Ten exact `M_BlackSail*` identities opt in; Kyoto, Everwinter, generic terrain/foliage,
water and existing emissive story/target materials retain their own runtime paths.

| Identity suffix | Surface intent |
| --- | --- |
| Timber | Weathered marine timber, sparse drawn grain, matte sun-bleached ridges |
| Stone | Coral/limestone masonry, broad warm planes and subtly cool undersides |
| Plaster | Warm limewash, quiet broad painted variation rather than speckled noise |
| Terracotta | Matte sunbaked tile; modeled tile courses carry the silhouette |
| Shingle | Weathered wooden roofing, restrained grain rather than shiny tile |
| Thatch | Dry roof fibers, distance-filtered linear detail |
| Canvas | Linen/sail canvas, low-amplitude weave; ordinary sails remain lit cloth |
| Rope | Dry hemp fibers; actual ropes and coils belong to geometry |
| Iron | Dark rough iron, small subdued rim, never chrome |
| Brass | Small warm banded fitting glints gated by received illumination |

Salt, barnacles, age and faded dye are authored vertex colors/geometry, not a global
world-height effect that accidentally salts inland walls. No physical material emits
blue light. Ghost-fleet sails intentionally retain their existing translucent `M_Beam`
identity rather than becoming opaque physical cloth. BlackSail export marks these
beam sheets double-sided with alpha BLEND / opacity 0.28, approximating the existing
runtime visibility. glTF alpha blending cannot encode additive blending; the shared
runtime beam shader is unchanged. The old baseline GLB remains untouched, so offline
PBR comparisons include this portable-alpha correction, not a gameplay shader change. Existing narrative `M_Emissive`, `M_Target` and `M_Beam` paths are unchanged.

`blackSailMaterialProfiles.ts` carries portable roughness/metalness into exported GLBs.
`blackSailMaterials.ts` uses the existing MeshToonMaterial ramp, receiving shadows and
fog, preserving authored colors, side, opacity, alpha test and depth settings. Exported
canvas is double-sided so thin sails and awnings remain readable from both sides. Surface
hooks add no uniforms, textures, loops, passes or draw calls. Fine lines fade by screen
derivatives; wide restrained brush marks avoid photographic/noisy plastic surfaces.

## Verification boundary

`validation/blacksail-materials.test.ts` covers exact-name opt-in and other-region
opt-out, shader-chunk/source contracts, per-material cache identities and an actual
compressed fixture export/load/runtime roundtrip. A separate production-asset test
requires all ten identities on nonempty ART geometry in `world_blacksail.glb`, with
correct PBR factors, vertex colors and runtime dispatch; fixture-only coverage cannot
satisfy it. Run this test after the parent regenerates the production map.

These are CPU/source checks, **not GPU shader compilation, browser playthrough or a
visual-render pass**. The browser GPU environment is unavailable for this iteration.

Export adds only `world_blacksail` to the existing exact ART-weld allowlist. Welding
follows the existing reorder/quantize sequence, skips `M_Collision` primitives and does
not introduce another reorder, tolerance weld, simplification or material merging.
