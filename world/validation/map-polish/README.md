# Five-world micro-detail QA

Baseline: `a3096254ef0fff455a29932bc5fef2e57fa49f44`. `baseline.json` was captured
from its unmodified production GLBs before authoring, not from the revised output.
It retains each original file SHA-256, layout-byte SHA-256, material properties,
every scene node and hashes of all decoded accessor/index arrays. The earlier
`kingdom-valley/five-world-baseline.json` remains unchanged.

The original micro-detail-only edits are ten explicitly named ART batches in
`../map-polish.test.ts`. Every other node—including terrain, COLLISION, MARKERS,
quest/dynamic objects, parent child order and unrelated ART—is exactly frozen.
The later explicitly authorized seam-alignment task additionally changes exactly
four named Alpha `COL_Seam_*_Gate` nodes and adds their four matching dynamic ART
fields. `seam-barrier.test.ts` independently verifies actual exported triangle
equality, pylon alignment, Player blocking/unlock/reset and endpoint closure.
No baseline hashes were regenerated. Prepared ART increases by exactly four
dynamic meshes (no added outlines); all unrelated chunk distributions stay frozen.

Edited micro-detail batches also retain their exact quantization transforms, metadata and
material assignments. No layout JSON, gameplay source or material shader changes.

The runtime's actual decoder, `bakeQuantized`, `isStaticArtEligible` and
`chunkMesh(mesh, 64)` are used by `chunk-budget.ts`. `chunk-baseline.json` records
the unchanged original per-source prepared chunk counts. The test prevents a
small detail pass from accidentally crossing the 4,000-triangle split threshold.
These are **prepared mesh counts, not visible draw calls or FPS measurements**.

## Reproduce

From `world/` (dependencies installed):

```sh
# Same entry points as build:* npm scripts, without the tsx CLI's IPC server.
node --import tsx tools/build-world.ts
node --import tsx tools/build-britain.ts
node --import tsx tools/build-blacksail.ts
node --import tsx tools/build-winter.ts
node --import tsx tools/build-kyoto.ts
node --import tsx --test validation/map-polish.test.ts

# Optional before-directory must contain the original production files + layouts.
node --import tsx validation/map-polish/chunk-budget.ts BEFORE_DIR public/assets report.json

# Offline actual-asset comparison, not a browser screenshot or synthetic concept.
node validation/kingdom-valley/decode.mjs public/assets/world_alpha.glb alpha-decoded.glb
WORLD_REVIEW_SAMPLES=48 blender -b -t 2 -P validation/kingdom-valley/render.py -- \
  alpha-decoded.glb REVIEW_DIR validation/map-polish/cameras.json alpha-hatch
```

Repeat the decode/render command for `britain-standard`, `blacksail-cleat`,
`winter-curtains`, `kyoto-joinery` and their matching GLBs. Both sides use the
same camera manifest, 1,200×800 output, fixed lighting, and 48 samples.

Sandboxed Chromium failed before opening a page (`socket() EPERM` in
`process_singleton_posix`). No sandbox disabling or browser retry was used.
Blender verifies the exported shapes/attachments and palette, **not runtime toon
lighting, animation, WebGL correctness, browser interaction or performance**.

Visual evidence and metrics: [World micro-detail report](../../../docs/world/WORLD_MICRO_DETAIL_PASS.md).
