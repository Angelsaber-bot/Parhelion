# Black Sail 1718 art validation

Baseline: commit `4016eef6`. `baseline-contract.json` stores the complete original layout. The contract regression requires exact world identity, ordered markers, objective graph, areas, routes and updraft definitions. `baseline-collision.json` freezes each original decoded COLLISION mesh's ordered world-space triangle positions, matrix and gameplay extras. Reordering is not treated as equivalent because BVH construction and traversal can depend on it.

Run from `world/` with installed dependencies:

```sh
node --import tsx --test validation/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

`blacksail.test.ts` drives the actual Player against decoded production GLB BVHs: seam gate; entry into Nassau; all teleport destinations; sky-wreck updraft/gliding route; cannon and shootable ghost boats; reef/wreck routes; lighthouse spiral; ghost fleet bridge to the boss arena/core. Export tests check finite attributes/matrices, valid indices, ART below 2,000,000 triangles, GLB below 12,400,000 bytes, and exact collision preservation. Source-art tests compare normalized building and equal-sized ship geometry, not just colors/positions, and require finite collision-free authored craft. Production ART ray tests reject overlapping bow-deck top surfaces and overlapping lighthouse-gallery disk/sector surfaces, and opaque raised bow walls across the bridge approach, reproducing and preventing actual black coplanar defects found in the renders.

## Fixed-camera geometry review

```sh
node validation/blacksail/decode.mjs input.glb decoded.glb
node --import tsx validation/blacksail/audit.ts input.glb audit.json
BLACKSAIL_RENDER_SAMPLES=256 blender -b -t 6 -P validation/blacksail/render.py -- decoded.glb output-directory validation/blacksail/cameras.json
python validation/blacksail/comparison-boards.py /path/to/review-root
python validation/blacksail/verify-review.py /path/to/review-root
```

Review root uses immutable `before/world_blacksail.glb`, `before/final-render/`, `final/world_blacksail.glb`, `final/render/`. Sixteen matched cameras have identical cool sea ambient, warm sun and exposure. Renderer imports actual decoded exported geometry and exported PBR materials. Conditional `showWhen` objects and descendants are hidden consistently; this is not an invented completion/gameplay state. No AI generation, replacement geometry or scene-pixel retouching. Boards only place unchanged source images beside labels. Successful 256-sample frame logs and SHA-256 hashes of all 32 source images are required by the verification manifest.

These are offline PBR fallback renders, **not runtime toon screenshots**. Node tests and production bundling do not prove WebGL shader compilation, live browser controls, GPU performance or FPS. Browser execution remains unverified due to the known Chromium sandbox restriction; it is not retried or bypassed.
