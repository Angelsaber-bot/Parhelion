# Authored normalized color storage QA — 2026-10-31

## Scope
Isolated candidate based on `21092767b3e05399391efd4ea2ebb4bbee575851`: `bakeQuantized` preserves only authored normalized Uint8 color attributes, including their interleaving/stride/offset. Position, normal, tangent, UV and index conversion/transform behavior remains unchanged. No material, draw-call, triangle or visibility change is proposed.

## Evidence
- All 15,192,414 source color components produce exactly the same Float32-rounded `getComponent` values as the expanded baseline.
- Actual loaded World: 5,456 mesh rows have identical decoded color hashes, other attribute/index bytes, groups, bounds and paths.
- Complete unique backing buffers, not merely logical views: 236,837,270 → 196,324,166 bytes, saving **40,513,104 bytes**. Counting complete retained decode slabs includes their padding and avoids overstating savings.
- All 5,456 material/generated-shader input rows identical; 317 material identities in both.
- No cross-named color-attribute aliases introduced. Synthetic shared-geometry meshes with distinct transforms retain independent color buffers after cloning; mutating one color does not affect its sibling. Dense and interleaved layouts tested, including padding and normalization.
- Actual-main regression passes all five regions' 210 markers, 42 area/teleport anchors, 4 bosses and 150 encounter homes, four open/closed gate capsule paths, three target rays/reset, and private animated Halo/reset.

Evidence: sibling `parhelion-eight-hour-evidence/qa/color-candidate/`, including geometry/material reports, comparisons, and route-isolation test log. Tests are the current external QA harness against the isolated frozen product; this is not a claim that a full candidate repository aggregate ran.

## Limits
No WebGL execution, shader GPU compilation, pixel identity, device FPS or driver allocation measurement is established. Normalized integer GPU fetch replaces a Float32 color buffer; CPU-decoded equivalence and unchanged shader source do not substitute for actual GPU validation. The measured saving is loaded geometry backing-store accounting, not a measured total-process RSS reduction. Original authored color format is preserved rather than introducing lossy quantization.

## Mutation consumers and retained native backing follow-up
A production-source audit finds `bakeQuantized` called only for loaded region scenes. The region color consumer is `WorldGrid`, which reads `getX/Y/Z` into independent Float32 grid arrays; `chunkMesh` shares unchanged attributes. No direct float writes into loaded region color `.array` were found. Procedural sites, cinematic trails, character and skill effects construct their own color attributes outside this loader. A packed-vs-expanded grid regression verifies exact height/normal/color outputs and unchanged source bytes. Future mutable consumers must use normalized setters or explicitly make their own floating-point copy.

Two isolated same-source post-GC V8 snapshots additionally measured native backing stores of 484,294,752 bytes before and 443,693,456 after (40,601,296 observed reduction). Only the exact 40,513,104 geometry-backed reduction is attributed to the change; the additional 88,192-byte difference is not. This is a single controlled retention pair, not a stable total-RSS benchmark. Raw snapshots and native-category comparison are retained in the evidence folder. All other native categories match; the measured difference occurs in JS ArrayBuffer backing data.
