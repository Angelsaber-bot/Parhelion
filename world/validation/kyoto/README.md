# Kyoto asset review

These scripts inspect and render the **actual exported GLB**, not generated concept artwork.

From `world/`:

```sh
node --import tsx validation/kyoto/audit.ts public/assets/world_kyoto.glb /tmp/kyoto-audit.json
node validation/kyoto/decode.mjs public/assets/world_kyoto.glb /tmp/kyoto-decoded.glb
blender -b -t 6 -P validation/kyoto/render.py -- /tmp/kyoto-decoded.glb /tmp/kyoto-renders validation/kyoto/cameras.json
node --import tsx --test validation/kyoto*.test.ts
```

The GLB decode uses the installed official glTF Transform and meshoptimizer dependencies. It removes meshopt compression and quantization only in a review copy. Production assets are unchanged. `cameras.json` fixes every eye/target in region-local coordinates; both before and after use the same manifest. Blender converts Y-up coordinates to Z-up. Geometry, vertex colors, glTF PBR material values, perspective, sunlight, world lighting, exposure and render resolution remain controlled. Quest-dependent `showWhen` objects are hidden to match the initial quest state. `KYOTO_RENDER_SAMPLES=256` selects final-review sampling; `KYOTO_SAVE_BLEND=1` also saves an editable review `.blend` beside the images.

**Blender is a geometry/material-export review, not a substitute for the game's toon shader.** It does not run runtime outlines, custom shader grain, fog, bloom, particles, player controls or renderer chunking. Screenshots must be labeled accordingly. Art draw calls from the audit are pre-runtime-chunking counts, not measured game FPS or runtime draw calls. The overview and Arashiyama comparison are elevated; street cameras cover city, Kinkaku, Kiyomizu, Inari, Sannenzaka and Honnō-ji.

For actual runtime validation, start Vite on port 4177 and use an installed, authorized Playwright + Chromium:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_EXECUTABLE=/path/to/chromium \
  node validation/kyoto/browser-render.mjs /tmp/kyoto-runtime
```

`WORLD_URL` can select another local server. The script captures browser errors, shader diagnostics, runtime render statistics and the same camera views. It must finish successfully and its PNG pixels must be inspected before claiming a runtime visual pass. Do not work around execution-security denials.

`baseline-contract.json` records the original world identity, quest markers/objective, existing area teleports and six quest paths. Additive districts are allowed; original gameplay contracts cannot silently move. Existing `kyoto.test.ts` tests real exported collision/quest traversal, so regenerate the production GLB before running final QA.

To assemble review boards from completed, unmodified 1200×800 renders:

```sh
python3 validation/kyoto/comparison-boards.py /absolute/path/to/kyoto-review
```

The directory must contain `before/final-render/` and `final/render/`, each with the eight `cameras.json` shots plus three `landmark-cameras.json` shots. The assembler does not retouch or replace scene pixels. All eleven source views must have actually finished at 256 samples before using its 256-sample captions.

For a lossless index/vertex-reuse export optimization, retain the previously rendered GLB and compare it against the optimized production asset:

```sh
node --import tsx validation/kyoto/equivalence.ts /path/to/rendered-snapshot.glb public/assets/world_kyoto.glb /tmp/kyoto-equivalence.json
```

This checks exact decoded attribute values and oriented triangle multisets per mesh, world transforms, node extras, and material properties. Collision triangle sequence is additionally required to remain exact: even geometrically equivalent collision reordering can change BVH contact resolution. A pass is not a substitute for rerunning traversal tests.
