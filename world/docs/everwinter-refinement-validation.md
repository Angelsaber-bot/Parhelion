# Everwinter 1812 refinement — validation record

Date: 2026-10-27. Immutable baseline: `8bce3bae`. Final geometry: checkpoint 11.

## Exact exported artifact

| Measurement | Baseline | Final |
|---|---:|---:|
| GLB bytes | 3,045,276 | 6,536,424 |
| ART triangles | 385,210 | 720,348 |
| Collision triangles | 284,916 | 284,916 |
| Total triangles | 670,126 | 1,005,264 |
| ART meshes before runtime chunking | 31 | 59 |
| Total meshes | 37 | 65 |

Final `world/public/assets/world_winter.glb` SHA-256:
`62692beb46f8405165cbe163ac3e8a02bd5b2be4bbe0aae1179760c94a933b28`.
Baseline SHA-256:
`ff1c70313617a4fc3ff381c43a47174f05a1fdd1700892f5d6dcf1d3adb4bbdb`.

Final binary is below the 12.4 MB transfer ceiling and ART is below two million triangles. Mesh counts are **not measured runtime GPU draw calls**.

## Automated results

Commands executed directly with installed dependencies from `world/`:

```sh
node --import tsx --test validation/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

Final candidate: **194 tests passed, 0 failed, 0 skipped**; TypeScript and production build exited successfully. Logs are retained in the review `final/` directory. This suite includes:

- Exact decoded, ordered world-space collision triangle stream, matrices and gameplay extras against the immutable baseline. Triangle/index reordering is not accepted as equivalent. All six collision meshes match; an independent snapshot file comparison also passed.
- Complete ordered 51-marker array and six-route array unchanged; objectives and seven area teleport positions preserved. Full current area data also matched the baseline during inspection.
- Real `Player` collision-BVH traversal: spawn, river, teleports, bridge, command tent, three beacons/eagle, Moscow, bell scaffold, frost seals and cavern route. Cold/combat regressions remain covered.
- Finite actual GLB attributes/transforms, valid indices and export size/triangle budgets.
- Geometry fingerprints prove five distinct ordinary-house families and eight distinct dome variants, not only color or placement swaps.
- Actual decoded triangle ray tests verify gate lintels have no overlapping coplanar pier faces, open Ivan belfry arcades, eight surrounding Basil domes below the central tower, and one visible scaffold landing surface.
- Visual-only additive fieldworks, clear imperial entrance, preserved broken bridge gap, deterministic frozen marcher variants.
- Winter shader source-hook contracts, profile roundtrips and unaffected shared/Kyoto/water/emissive paths. These are CPU/export/source tests, not GPU shader compilation.

## Authored scope and limits

Moscow architecture, landmark hierarchy, wall rhythm, house families, roofs, domes and fieldwork geometry are refined. The cavern is a **bounded low-poly rock-overhang refinement**, not a wholesale cavern rebuild or naturalistic geology reconstruction. Its original terrain, gate bars, frost-seal gameplay and collision remain unchanged. Artificial cliff ribbons from an intermediate candidate were rejected and removed.

The actual final GLB uses all ten Winter-specific surface identities: stone, snow, timber, charred wood, brick, plaster, copper, gold, canvas and iron. Production export assertions verify real canvas/iron/gold fieldwork assignment, not only synthetic fixture support. The last correction only regrouped existing visual geometry into material batches; an exact source geometry/normal/color/index multiset comparison against checkpoint 10 passed. There was no geometry, collision or RNG change in that material correction.

Historical research and uncertainty are recorded separately in `everwinter-historical-art-notes.md`. The map remains a stylized gameplay compression of the campaign, not a surveyed or exact 1812 reconstruction.

## Fixed-view visual evidence

Sixteen matched before/after cameras: overview; city street; ground street; Kremlin/bell; Basil square and detail; Ivan detail; imperial tent; Napoleon camp; canvas detail; Berezina crossing and bridge detail; beacon snowfield and detail; gorge; cavern mouth.

Source: actual decoded exported GLB geometry and exported PBR fallback materials. Both sides use identical camera JSON and render script: Cycles **256 samples**, no denoising, cool world strength **0.45**, warm sun energy **1.5**, exposure **−0.35**, 1200 × 800 source PNGs. Conditional dynamic effects are hidden consistently. Board assembly only places unretouched renders and adds labels; no AI images, replacement scene geometry or pixel retouching.

The review is **offline PBR fallback rendering, not runtime toon screenshots**. Browser execution could not start in the validation environment. No claims are made about live WebGL shader compilation, pointer lock, browser traversal, GPU memory, measured draw calls or FPS.

Canonical editable source is the TypeScript generator plus GLB. Any saved Blender scene is a local editable offline review copy, not the canonical source or an implied Library upload.

Reproduce and verify using `validation/winter/README.md`, `render.py`, `comparison-boards.py` and `verify-review.py`. The completed review manifest records both GLB hashes, camera/script hashes, each PNG hash, dimensions and renderer log evidence for all 32 frames.
