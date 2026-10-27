# Kyoto refinement — validation record

## Scope and source of truth

The deliverable is the deterministic TypeScript Kyoto generator plus its exported production `world_kyoto.glb` and layout. The editable Blender file is a review copy of that actual GLB, **not** the canonical game source. Nothing in the preview boards is concept art or a substituted image.

Art direction: [Kyoto material direction](kyoto-material-direction.md). Historical references and deliberate interpretation: [Historical art notes](kyoto-historical-art-notes.md). This is a stylized gameplay environment, not an exact reconstruction of Kyoto in 1582. Modular craft, deterministic variation, and composed districts reduce repetition; not every building is individually hand-sculpted.

## Audited production asset

| Metric | Before | Refined |
|---|---:|---:|
| Compressed GLB bytes | 6,114,148 | 12,319,412 |
| ART triangles | 555,836 | 1,368,094 |
| Collision triangles | 300,668 | 300,996 |
| All mesh triangles | 856,504 | 1,669,090 |
| ART meshes before runtime chunking | 28 | 38 |
| All meshes | 33 | 43 |

Before SHA-256: `6f19cd5b85c07f214f67fa92f4cf586f0c28bb9b6522b5bff78ae497731eceb0`.

Refined production SHA-256: `e7a6009921b89872ba97c2e1d8a1db719ee099b1c099bdd7a4a039c63a4f730b`.

Refined layout SHA-256: `a785a5372f599396a137faea0052659295de650f229ad98b827ff3172e3e0f73`.

The refined compressed asset is approximately 11.75 MiB, below the explicit 25 MiB asset ceiling. ART triangles remain below the 2 million review ceiling. These are export budgets, **not FPS or measured runtime draw-call claims**.

Materials actually present in the refined GLB: `M_Terrain`, `M_Water`, `M_KyotoRoof`, `M_Emissive`, `M_KyotoArchitecture`, `M_Beam`, `M_KyotoGold`, `M_Target`, `M_KyotoTimber`, `M_KyotoPlaster`, `M_KyotoStone`, `M_KyotoBamboo`, `M_Foliage`, `M_KyotoFabric`, `M_Toon`, `M_Collision`. The ten available Kyoto surface profiles are additionally tested through an actual compressed GLB roundtrip; not every profile has to appear in this scene. Shared exporter/runtime hooks opt in by exact Kyoto material name, preserving generic material behavior.

## Lossless deployment-size optimization

The rendered refinement snapshot (`1972a1c7e7b250b2e1d4f8895515e37251c5954d08b2b58367e6b2aa429349cd`, 16,242,732 bytes) was subsequently reduced to 12,319,412 bytes by Kyoto-only reuse of bitwise-identical complete ART vertices. No simplification, tolerance-based merge, triangle removal, or material change was applied. Collision primitives were excluded to retain their original triangle ordering and contact behavior.

`validation/kyoto/equivalence.ts` compared both actual compressed GLBs through the game decoder: exact decoded attributes and oriented triangle multisets match for every mesh; world transforms, node extras, and material properties match; collision ordered triangle streams also match. All 43 meshes are equivalent and triangle counts are unchanged. Existing rendered previews and the editable Blender review copy therefore remain geometry/material-valid for the optimized production asset; no replacement previews were invented or rerendered. The layout file hash is unchanged.

## Automated verification

Both the rendered refinement snapshot and the final losslessly optimized production asset passed **169/169 tests** (zero failures, skips, or cancellations), including the last added landmark-geometry regressions. The final aggregate rerun used the installed local Node test runner, TypeScript compiler, and Vite build entry points without network access. Type checking and production build completed with exit code 0 on the optimized production asset; `git diff --check` also passed.

Coverage includes:

- Exact original world identity, original marker IDs/positions/types/unlock conditions, objective, existing teleport coordinates, and all six established quest routes.
- Actual compressed-GLB collision traversal for Kyoto quests, teleports, and the added Arashiyama bridge/bamboo/riverfront routes. Authored collision changes are intentional where old house blockers would obstruct new courtyards or the cleared Kiyomizu stage; collision bytes are not claimed unchanged.
- Finite geometry, bounded district coordinates, real architectural layers, eight distinct geometry fingerprints, and four composed courtyard types.
- Surface identities, exported PBR values, vertex colors, runtime toon conversion, shader-source chunk compatibility, and non-Kyoto opt-out behavior.
- Actual exported Kinkaku balcony bounds and supported decks on all four sides; 17 hillside garden-fence posts meet exported terrain within 3 cm. The measured maximum positive base gap was 3.3 mm, not a floating balcony.
- Ten ray probes across both Kiyomizu curved upper gables confirm opaque infill rather than a sky-through hole.
- English coverage for the added Arashiyama area and discoveries.

## Visual evidence and limits

The before/after comparison uses the actual old/new GLBs, identical fixed camera manifests, 1200×800 output, 256 Cycles samples, no denoising, and controlled sunlight/world/exposure. The eleven camera views are overview, city, Kinkaku, Kiyomizu, Inari, Arashiyama, Sannenzaka, Honnō-ji, Yasaka, Inari gate, and Kinkaku close-up. The overview deliberately exposes the finite map boundary; boundary cliffs and the water plane are not concealed.

**These are Blender PBR-fallback renders, not in-game toon screenshots.** Blender does not reproduce runtime outline passes, shader brush grain, fog, bloom, particles, or renderer chunking. Preview boards explicitly label this distinction.

Runtime browser validation was attempted but blocked: Chromium could not launch in this execution environment; both normal execution and the approved retry failed. GPU shader compilation, in-game visual appearance, gameplay interaction in a live browser, and FPS remain **unverified**. Shader-source assertions and Blender images do not close that gap.

## Reproduce

From `world/`:

```sh
npm ci
npm run build:kyoto
npm test
npm run typecheck
npm run build
node --import tsx validation/kyoto/audit.ts public/assets/world_kyoto.glb /tmp/kyoto-audit.json
node validation/kyoto/decode.mjs public/assets/world_kyoto.glb /tmp/kyoto-decoded.glb
KYOTO_RENDER_SAMPLES=256 KYOTO_SAVE_BLEND=1 blender -b -t 6 \
  -P validation/kyoto/render.py -- /tmp/kyoto-decoded.glb /tmp/kyoto-review validation/kyoto/cameras.json
KYOTO_RENDER_SAMPLES=256 blender -b -t 6 \
  -P validation/kyoto/render.py -- /tmp/kyoto-decoded.glb /tmp/kyoto-review validation/kyoto/landmark-cameras.json
```

See [review script README](../validation/kyoto/README.md) for controlled before/after assembly and the authorized browser-validation entry point. A future runtime pass must actually complete, inspect its PNG pixels, and review captured browser/shader diagnostics before updating the unverified status.

## Completion note

Automated checks on the final optimized production asset are complete: **169/169 tests**, type checking, production build, whitespace validation, and exact geometry/collision-order equivalence passed. All **eleven before and eleven after views** finished at **256/256 samples** and the eleven refined views were visually inspected. Four before/after boards and a labeled overview were assembled from those exact images; no scene pixels were retouched. The editable Blender review file reopened successfully with 43 mesh objects, 17 material datablocks, and the recorded 1200×800/256-sample settings.

The pass verifies the improved landmark geometry, connected Kinkaku gallery, grounded garden fence, filled Kiyomizu gables, cleared stage, district composition, and preserved tested traversal. It is acceptance of this refinement pass, not a claim of pixel-perfect art, historically exact reconstruction, exhaustive inspection of every terrain contact, or verified runtime/GPU behavior.

A minor inherited terrain-contact ambiguity remains at the cropped red gate on the far left of the Yasaka view: a dark gap/shadow at the downhill foot is visible in both the baseline and refined image. This specific foot-to-slope contact was not numerically resolved; it is not represented as a verified grounding pass. No geometry change was made for that ambiguous observation.
