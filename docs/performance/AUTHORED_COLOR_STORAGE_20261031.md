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
