# Conservative static ART material reuse

## Scope
Only reuse a `toonMaterial` conversion when its **original source material object** is identical. No name-based canonicalization. Eligibility requires existing immutable ART eligibility, opaque opacity1/normal blending, and excludes names containing halo/gate/door/core/beam/target/water plus Water/Beam/Halo/Target/Emissive material families. Dynamic state, target metadata, spinning/bobbing pieces and water remain private. No geometry is merged, removed, disposed or distance-culled.

`toonMaterial` accepts only a material, not a mesh. Authored material modules derive their shader parameters from source material properties/name, so an unchanged source identity produces the same conversion. The weak cache does not strongly own source keys. Tower Halo remains explicitly excluded because its color changes on unlock and per frame.

## Controlled proof
Product baseline9e91fa7b18feb16c206156f916a98e0979f30ce7; isolated candidate changes only the ART conversion loop. QA harness525cc4c is external to that frozen product source. Runtime source is selected with `WORLD_SOURCE_QA_ROOT`; do not confuse external QA results with a frozen repository full aggregate.

- World-root material identities467→317 (150 fewer).
- All5,456 World mesh path/material-state/texture-state/generatedshader hash rows exactly equal.
- Same-camera candidate mesh/material/shader/triangle/worldsphere rows exactly equal.

| View | Candidate groups | Candidate triangles | Material identities before→after |
|---|---:|---:|---:|
| HQ |451|911,216|142→86|
| Kyoto busy |687|1,425,212|212→129|
| Kyoto south |960|1,931,168|236→123|

Actual main mutable-halo test verifies unlock animation changes its private material, all unrelated authored colors remain unchanged, and reset restores its original color. Actual capsule routes across all four gates, target visibility/raycast, reset and captured five-region anchors also pass on the isolated candidate.

An initial *test harness* reset attempt incorrectly exited pointer lock before the reset key; production correctly ignored it. Correct gameplay-active reset input passes; failed log retained rather than hidden.

## Reproduction
From world directory, use separate frozen/candidate source directories and the same external harness:

```sh
WORLD_SOURCE_QA_ROOT=/path/to/product/world node --import tsx validation/material-shader-equivalence-audit.ts material-state.json
WORLD_SOURCE_QA_ROOT=/path/to/product/world node --expose-gc --import tsx validation/scene-hotspot-audit.ts camera-candidates.json
WORLD_SOURCE_QA_ROOT=/path/to/product/world node --import tsx --test --test-concurrency=1 validation/static-material-isolation.test.ts validation/source-node-detach.test.ts
```

`static-material-reuse-audit.ts` independently measures original GLB material-identity repetition without mutating runtime. Controlled output, patch, full hashes and logs are kept outside the repository in the eight-hour evidence workspace under `qa/material-candidate`.

## Explicit limits
The production fixture uses real GLBs, collision BVHs, scene state and main input logic, but a **no-op GPU renderer**. Shader source is generated, not compiled/executed on a GPU. Material sharing does **not** reduce triangle count or candidate draw groups. No deviceFPS, GPU memory, WebGL timing, pixel identity or measured frame-rate benefit is claimed. Real cloud-browser WebGL remains unavailable; restricted access routes were not bypassed.
