# Distinct surface directions: Sunset Kingdom and Parhelion Valley

These additions opt in by exact material name only. Kyoto, Everwinter, Black Sail,
generic terrain, foliage, water, emissive targets and story beams retain their
existing dispatch. The new surfaces do not add textures, uniforms, animation loops,
passes or extra draw calls by themselves; the authored geometry's batching still
determines mesh count. This is not a measured GPU performance claim.

## Sunset Kingdom: carved, woven and weathered

Ten `M_Britain*` identities separate actual stone, timber, roof, cloth and fittings.
Limestone has a quiet warm mineral wash; sandstone a slightly broader dry wash.
Oak carries low-amplitude longitudinal fibers, slate restrained cleavage lines,
thatch coarse directional fibers, plaster broad clean planes and wool a coarse
woven finish. Charred wood remains authored dark timber with a smaller rim, not a
globally darkened town. Iron is rough and subdued; bronze has a small warm banded
highlight gated by received illumination.

The runtime's violet-grey shadows and warm cream accents are deliberately unlike
Black Sail's marine palette, Kyoto's timber/lacquer language and Everwinter's cold
masonry. These shaders are not a substitute for carved joints, roof courses,
silhouettes or destruction geometry. Such features belong in the generators.

The chapter is Arthurian fantasy using selected British stone/timber craft cues;
the material system makes no claim that every romantic castle form is an accurate
sixth-century reconstruction. Historical scope belongs in the architecture notes.

## Parhelion Valley: clean research campus against ancient ruins

Seven `M_Valley*` identities distinguish pale ceramic shell panels, satin metal,
tinted observation glazing, old mineral stone, timber walkways, canvas and brass
instrument fittings. Ceramic has almost no noise; metal has very subtle brushed
lines. Glass is an opaque stylized tinted panel with a restrained lit glint, not
screen-space refraction or transmission. This avoids newly introducing depth-sort
holes, and does not claim physically transparent windows. Canvas has fine weave;
old stone keeps broad mineral variation, not nautical salt or snow-height masks.

The clean blue-grey shadows and near-neutral highlights support the teal/cream
campus palette. Brass is limited to instrument hardware; physical surfaces do not
emit light. Existing target/portal materials keep their original behavior.

## Export and verification boundary

`britainMaterialProfiles.ts` and `valleyMaterialProfiles.ts` carry portable PBR
roughness/metalness into the GLBs. Wool and canvas are double-sided; the other
physical materials are opaque. Runtime conversion preserves source vertex colors,
base color, side, transparency, opacity, alpha test, depth state and fog.

Fine linear detail fades with screen derivatives. Per-material program cache keys
prevent cross-surface shader reuse. The tests expand existing Three.js shader chunks
and verify declaration ordering, lighting/fog/shadow hooks and bounded parameters.
These are source-contract checks, **not WebGL compilation or GPU visual tests**.

`validation/kingdom-valley-materials.test.ts` also exports compressed fixtures and
reloads them through the real region loader. Separate production tests require all
ten Britain and seven Valley profiles on actual nonempty ART with authored colors,
correct PBR factors and runtime dispatch. Fixtures alone cannot satisfy them.

Exact full-vertex welding now opts in for `world_britain` and `world_alpha` after
the existing reorder/quantization sequence. It always excludes `M_Collision` and
adds no second reorder, tolerance weld, simplification or triangle removal. The
parent's collision snapshot tests and real BVH/player checks still determine
whether the final exported assets preserve gameplay.

Offline GLB PBR review can validate exported geometry, silhouette and base material
properties, but does not show the runtime derivative detailing or toon shading.
Live browser, shader compilation and frame-time acceptance remain separate.

The existing Valley waterfall already exports glTF alpha `BLEND` with opacity 0.7;
it is not an opaque-material export failure. Its original broad single plane in
front of similarly colored rock can look like a solid panel in offline PBR light.
The runtime instead uses an unlit basic material at opacity 0.78, double-sided,
with depth writes disabled. No runtime or shared waterfall material setting was
changed merely to make the offline image look different. Water-flow silhouettes
and edge treatment are geometry/art concerns, and offline PBR does not certify
the appearance of the runtime transparent sheet.
