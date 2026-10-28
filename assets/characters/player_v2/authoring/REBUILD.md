# Self-contained authoring / reproduction

No scratch path, network request, add-on installation, external reference image or cache is required. Tested with **Blender4.3.2**, which includes the glTF importer/exporter and NumPy used here.

From the repository root:

```bash
blender -b -t 4 \
  --python assets/characters/player_v2/authoring/scripts/rebuild.py -- \
  --workdir /tmp/chaldea-rebuild \
  --output-dir /tmp/chaldea-rebuild/export
```

`--asset-root` optionally points to another copy of `player_v2/`; without it, inputs resolve relative to the scripts themselves. `--workdir` contains intermediate `.blend` files and JSON evidence. `--output-dir` receives the neutral runtime GLB and its manifest. The default output directory is this asset directory; use an explicit temporary output for a non-mutating reproduction check.

Stages:

1. Import bundled CC0 `Base_Male.vrm` with Blender's normal glTF importer and retain its source67-bone humanoid/finger skeleton.
2. Independently import bundled CC0 `HairSample_Male.vrm`; map original source-index weights through the frozen head's audited correspondence, check all ambiguous seams for compatibility, and evaluate design/subdivision weights. The stored approved weight data is included for audit and body-only rebuilds.
3. Build the fitted uniform, source-derived continuous skinned body/hands/trousers, new low-shoe surfaces, cloth bones and surface-conforming right-hand seal. Append the frozen portable head; assert each evaluated vertex matches its approved geometry before whole-head assembly translation.
4. Save editable art; combine only same-material body pieces on the same skeleton. Compare actual deformed triangles before/after batching in bind/run/glide. The9 frozen head surfaces/material boundaries are not merged.
5. Export one75-joint skin/17material batches, explicitly preserve iris/lid MASK behavior, and run limited authored garment-versus-pants triangle-crossing checks.

## Inputs and native editing

- `source/vrm/{Base_Male,HairSample_Male}.vrm`: original verified CC0 source binaries, hashes/provenance documented at package root. These are authoring inputs, not runtime network dependencies.
- `source/head/approved_head_art.glb`: exact frozen static head with original SHA256 `9c549ab70055f5139070936bd95f2782a89c5b5fa04fec6f0ebee8c28a4b7a72`.
- `source/head/approved_head_design.blend`: frozen editable head design master, including reversible art layers—not54 expression targets.
- `source/head/approved_head_portable.blend`: visible frozen geometry/materials/maps, with only unused datablocks purged and lossless Blender-file compression. The original approved GLB above remains unchanged.
- `source/head/source_vertex_correspondence.json`, `approved_evaluated_weights.json`: indexed provenance and recovered neutral binding data.
- `authoring/Chaldea_Editable_Master.blend`: current editable body/garment/rig, separate small details, packed textures. Only unused datablocks were removed from this packaged copy. Generated files/backup `.blend1`/renders are deliberately excluded.

## Evidence and limitations

`evidence/reproduction.json` records an actual independent-directory rebuild and the output hash comparison. The frozen ea211 candidate and that reconstruction are **not byte-identical**: three head/neck vertices have equivalent equal-weight joint slots in the opposite order (6JOINTS_0 bytes). Every glTFJSON field and every non-joint buffer is byte-identical, and every per-vertex bone→weight map is exactly equal. `evidence/reproduction-pose-parity.json` compares every evaluated vertex in bind/neutral/run/swim/glide with bent fingers, neck and eyes: maximum error **0m**. No old af7e byte-parity result is applied to this final candidate. Reproduction is checked with the stated Blender version, not promised across arbitrary exporter versions. `evidence/material-batch-pose-parity.json` compares real positions, not only counts. `evidence/cloth-pants-clearance.json` covers specific authored poses and does not establish full cloth physics.

Actual runtime material conversion, hand/gun contacts, glide handles, transitions, bounds, frame time and root visual acceptance remain separate integration gates. The neutral-only expression policy and static Head-weighted hair are explicit in the package's expression manifest.
