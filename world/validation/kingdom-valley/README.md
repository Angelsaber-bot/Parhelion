# Kingdom and Valley art validation

Baseline: `36936478839311d00e29babcb9a0b2f844c7a6e8`. Full five-world layouts
and three untouched chapter asset hashes are frozen in `five-world-baseline.json`.
The two per-region collision baselines retain exact ordered decoded world-space
triangle positions, transforms and extras. Triangle-set equivalence is not enough:
BVH traversal and contacts can depend on triangle order.

Run from `world/`:

```sh
node --import tsx --test validation/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

For each region `alpha` or `britain`, decode the original production GLB without
altering its geometry, then render 16 fixed views at 1200 × 800 and 256 samples:

```sh
node validation/kingdom-valley/decode.mjs input.glb decoded.glb
node --import tsx validation/kingdom-valley/audit.ts input.glb audit.json
WORLD_REVIEW_SAMPLES=256 blender -b -t 4 -P validation/kingdom-valley/render.py -- decoded.glb output-dir validation/kingdom-valley/alpha-cameras.json
python3 validation/kingdom-valley/comparison-boards.py review-root alpha
python3 validation/kingdom-valley/verify-review.py review-root alpha
```

Review roots use `before/world_alpha.glb`, `before/final-render/`,
`final/world_alpha.glb`, `final/render/` (substitute `britain`). Both sides use
identical camera and light settings. `showWhen` objects and their descendants
are hidden on both sides, not assigned an invented gameplay completion state.
Boards add labels but never invent or retouch scene pixels.

This proves offline PBR geometry/material fallback appearance only. It does not
prove live WebGL shader compilation, toon surface details, controls, GPU memory,
frame time or FPS. Browser acceptance and deployment are separate stages.
