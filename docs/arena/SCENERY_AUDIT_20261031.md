# Arena scenery/material audit — 2026-10-31 cloud pass

## Scope and unchanged authority

Read-only audit of all five Arena maps, followed by one separately approved visual-only Sakura tree correction. No Arena rules v8, damage/HP, inputs, spawn layout, authoritative collision, navigation, architecture or scene-pool code changes. Heavy evidence is outside the repository in sibling `parhelion-eight-hour-evidence/environment/arena-readonly/` and `arena-tree-candidate/`.

## Baseline findings

- Six visual GLBs (five maps plus ASTER overlay): **417 primitives, 331,551 triangles, 165 material definitions**. All primitives have valid material/index assignments; sampled complete position/normal/attribute streams are finite and consistent; textured primitives have UV0; no external image dependency. No source material has a near-black base factor under the audit's conservative threshold. This is source integrity, not proof of runtime lighting or GPU rendering.
- Existing Arena material contract suite: **10 passed**. Focused map spawn, two-way authored movement routes and nav connectivity suite: **28 passed**, five bot-match tests deliberately excluded from this focused pass.
- Existing Sakura/CamLann/Blackflag/Frostcourt GLB validators: **2,244 checks passed**. ASTER visual/collision bounds and ramp normals pass, maximum exported bound error approximately `8.11e-7 m`.
- ASTER decoration clearance: **3,129 route samples**, 883 editable details, 57 certified surface details, zero decorative route intersections.
- To avoid overwriting original validation reports, existing Python validators ran against workspace-only view directories with read-only asset/runtime symlinks and separate report destinations. No source or asset was changed during the audit.

The broad ghost-detail heuristic reported 20 Blackflag and 43 Sakura clusters. These are not automatically missing colliders: Blackflag includes thin cabin door/window relief just beyond the heuristic's 15cm allowance; Sakura includes rail details, door trim and boundary trees. Original authored routes and spawn cover remain valid. No blanket collider additions or removal of original architecture is justified by those counts.

## Concrete southeast tree mismatch

One Sakura decorative trunk was inside the otherwise walkable southeast corner. The actual GLB ray at player eye height hits material `trunk` between X26.336 and27.044 at Z20.581, while the production collision line is clear and ordinary `applyInput` walks through in32 frames. This is an existing visual/physics mismatch, not a blocked route or broken spawn.

The approved candidate moves **only tree index3 by +3m in Z**, outside the unchanged Z22 boundary. Its complete trunk and branch bounds become Z23.218–23.944. Blossoms retain their original form and height; no new foreground cover or solid is added. Production walk behavior stays unchanged, and **112 spawn-to-cover/objective visual ray results remain exactly identical**. Source indices, materials, normals, collision and runtime map are protected by explicit parity checks.

## Why the asset is narrowly patched

An isolated unmodified-source rebuild matched all JSON and almost every binary byte, but six unrelated `mountain2` normal components changed from ±`7.757e-17` to zero (24 bytes). That regeneration was stopped rather than silently accepting unrelated changes.

`arena-maps/sakura/validation/relocate_edge_tree.py` therefore requires the exact original SHA-256 and translates only whitelisted POSITION Z components for the one tree. It preserves every other binary byte, normal, index, material and transform. The three shared material-batch bounds remain valid because this tree is not their extremum; JSON/bounds remain byte-exact. If extrema ever change, the tool explicitly accounts for only affected Z bound fields.

The matching `source/build_glb.py` offset preserves random draw order and all other trees, so future authored rebuilds do not restore the intrusion. A full rebuild on this platform may still reproduce the documented unrelated near-zero mountain-normal differences; do not silently substitute that full asset for a reviewed byte-bounded artifact.

Reproduce from a preserved original visual asset:

```sh
python arena-maps/sakura/validation/relocate_edge_tree.py ORIGINAL.glb OUTPUT.glb REPORT.json
cd arena-game
node --import tsx ../arena-maps/sakura/validation/audit_edge_tree.mjs \
  ORIGINAL.glb OUTPUT.glb RUNTIME_REPORT.json
```

Expected original visual SHA: `83f504ce7db5b0242979b2bb76a817ef7d39e22479b1c57344fd7be9a7f52ee3`.
Candidate visual SHA: `660be7c841744125caf23f306960553fb1fdadb6b03b6260c7fa00531b324d48`.
Unchanged collision SHA: `55995f6e3cb72d2ac841bfef59a7ce431cea366eb2eb8170de6265266e994ef3`.

CPU review tool `validation/render_edge_tree.py` uses the actual GLBs, 1.65m player eye and78° vertical FOV, with identical before/after cameras. Approximate dusk lighting is not a claim of WebGL cel/sky/fog/bloom/PCF parity or FPS. All four same-camera before/after frames were inspected: the noncolliding foreground trunk is removed from the playable corner and the cherry silhouette remains behind the unchanged wall. The bounded patch is included; no broad asset regeneration is authorized. Final chapter GLB validator passes411 checks; focused spawn/route/nav checks pass28 and the full material suite passes10.

The historical `docs/chapter-qa/protected-baseline.json` is retained unchanged. The approved exception is exactly Sakura visual GLB plus its matching authored builder; new isolated validation tools/documentation accompany it. Do not update old baseline hashes or claim the historical blanket protected-file check still passes. `docs/arena/sakura-edge-tree-proof.json` records the exact exception, patch whitelist, current hashes and runtime proof. A full source rebuild now matches the patched asset except for the same six documented far-mountain near-zero normal components; tree positions are exact.
