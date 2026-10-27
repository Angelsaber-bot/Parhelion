# Everwinter 1812 art validation

The source baseline is commit `8bce3bae`. `baseline-contract.json` is the original full layout; tests preserve its identity, markers (including warmth, enemy, and quest triggers), objective graph, area teleports and original path arrays. `baseline-collision.json` freezes exact ordered decoded world-space collision triangle positions, world transforms and gameplay extras. Collision index/triangle reordering is **not** treated as equivalent.

## Tests

From `world/` with installed dependencies:

```sh
node --import tsx --test validation/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

`winter.test.ts` drives the actual `Player` against production decoded GLB collision BVHs: seam lock, frozen river entry, all teleports, bridge, Napoleon's tent, three beacons/eagle, Moscow/core, bell scaffold and frost-seal gate/cavern. Other full-suite tests cover combat/cold and English localization.

`winter-export.test.ts` checks actual decoded export attributes/transforms for finite values, index bounds, ART budget under 2 million triangles, binary budget under 12.4 MB, and exact collision preservation.

## Reproducible geometry review

```sh
node validation/winter/decode.mjs input.glb decoded.glb
node --import tsx validation/winter/audit.ts input.glb audit.json
WINTER_RENDER_SAMPLES=256 blender -b -t 6 -P validation/winter/render.py -- decoded.glb output-directory validation/winter/cameras.json
python validation/winter/comparison-boards.py /path/to/review-root
python validation/winter/verify-review.py /path/to/review-root
```

The review root contains immutable `before/world_winter.glb`, `before/final-render/`, `final/world_winter.glb`, and `final/render/`. The camera and illumination definitions are identical for baseline and refined exports. Blender imports actual dequantized production GLB triangles and their exported PBR fallback materials; no AI image generation, replacement geometry, retouching or different before/after lighting is used. Winter lighting uses cool ambient and low warm sun with reduced exposure to preserve snow relief. Dynamic conditional effects are hidden in both scenes.

These are **offline PBR fallback renders**, not runtime toon screenshots. Node tests and production bundling do not prove WebGL shader compilation, pointer lock, live browser traversal, GPU draw calls, memory or FPS. Browser execution remains unverified because Chromium launch is blocked by the known sandbox restriction; it is not retried or bypassed.
