# Kyoto surface direction

## Intent

A restrained, painted anime city — not photographic PBR, noisy procedural dirt, plastic yellow gold, or uniformly glowing outlines. Silhouette, roof curvature, timber joinery, individual lattice/slat geometry and intentional color blocking do most of the work. Surface shaders support those shapes rather than pretending to replace them.

The shared exporter only changes **exactly named `M_Kyoto…` materials**. Other regions retain roughness 1 / metalness 0 and their existing runtime material path. Kyoto names survive GLB compression and loading, then `look.ts` selects the Kyoto toon material. The material's white base preserves authored vertex colors.

| Material | Use | Portable GLB roughness / metalness | Runtime intent |
| --- | --- | --- | --- |
| `M_KyotoArchitecture` | Legacy mixed-material architectural batches | .87 / 0 | Neutral, subtle broad brush variation; **no wood grain** |
| `M_KyotoTimber` | Timber posts, lattices, decks | .84 / 0 | Warm authored palette, thin low-contrast directional grain |
| `M_KyotoCharredWood` | Burnt timber | .98 / 0 | Almost matte, exceptionally low rim; retain dark vertex palette |
| `M_KyotoRoof` | Ceramic roof facets, ridge caps, tile seams | .64 / 0 | Subtle cool planes; detail must be authored geometry, not a fake grid |
| `M_KyotoPlaster` | Separate wall panels | .96 / 0 | Soft diffuse warm color; very low broad variation |
| `M_KyotoGold` | Gold-leaf panels and gold ornaments only | .38 / .72 | Non-emissive gold; restrained, banded warm glint |
| `M_KyotoStone` | Stone foundations, lanterns, paving | .93 / 0 | Broad color breakup and cool sides / warmer upward planes |
| `M_KyotoVermilion` | Painted torii and shrine structure | .58 / 0 | Clean painted color, not charred wood grain |
| `M_KyotoFabric` | Individual noren panels and awnings | 1 / 0 | Extremely subtle derivative-filtered weave; palette is authored per cloth |
| `M_KyotoBamboo` | Bamboo stalks, not leaves | .72 / 0 | Subtle longitudinal lines; nodes should be actual mesh collars |

## Authoring contract

Set `Piece.material` to one of these names; use the same name on `Batch` for clarity. One `Batch` exports one material. Separate roof, plaster, timber, gold and cloth geometry where possible; **do not apply timber or gold to a whole mixed building**. `M_KyotoArchitecture` is the neutral fallback for existing composite batches. Keep foliage as `M_Foliage` to retain wind behavior. Do not relabel flames or lantern cores; those retain `M_Emissive`.

Use warm/cool palette variants at the building or panel level, not random colors per triangle. Gold should be muted ochre in shadow with cream-gold edging, never an entire emissive building. Stone needs silhouette/bevel changes; shader variance alone cannot create chipped edges. Fabric variety comes from separate lengths, gaps, scalloped silhouettes, folds and a small controlled palette.

## Pipeline decisions and limitations

- `Batch.colored()` strips UVs, so adding a texture to the shared exporter would not yield a correct mapped surface. No canvas/image-export dependency was introduced. The GLB is self-contained through vertex colors and native PBR fallback parameters, not embedded bitmap textures.
- The browser uses `MeshToonMaterial`, **not** the GLB's PBR lighting. Portable roughness/metalness are meaningful for external viewers; the runtime translates surface identity into a drawn anime treatment instead of claiming MeshToonMaterial supports roughness.
- Fine grain and fabric weave fade using `fwidth` before they can alias strongly under minification. No animation/time-dependent surface noise.
- Surface rims are tinted by the authored base color and much weaker than the old generic white rim, preserving dark wood and avoiding glowing plaster.
- World-space procedural detail is intentionally low-contrast; it is not a physically exact local wood-grain mapping. Beam/post orientation and joinery remain mesh-authoring responsibilities.

## Verification

`node --import tsx --test validation/kyoto-materials.test.ts` checks exact-name opt-in, unchanged generic-region material behavior, material properties and shader injection using Three's real shader templates, and an **actual shared exporter → meshopt-compressed GLB → region loader → runtime toon material** roundtrip for every profile. It does not substitute for browser GPU compilation or visual review.

The cloud Chromium launch was blocked by socket permissions during this work. Browser GPU shader compilation and final in-game appearance must therefore be labeled unverified unless a later authorized run succeeds. Blender GLB images verify geometry and portable PBR material behavior, not the browser's toon shader.
