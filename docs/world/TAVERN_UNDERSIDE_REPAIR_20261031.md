# Nassau tavern underside — integrated narrow repair, 2026-10-31

## Reproduced defect

The original hip roof is six outward-facing triangles. Actual runtime material is
FrontSide. At X=590.5/593.5, Z=126/130, upward interior art rays from Y=5 miss,
while downward art rays hit `Nassau_Craft_Terracotta` and upward authoritative
collision rays hit the solid roof at Y=8.4035921. The authored roof has no skylight
opening; its chimney is a solid decorative block, not an open shaft.

## Candidate contract

Six inward/downward timber faces, 0.04 m beneath the original hip surface, using
existing `M_BlackSailTimber`. No roof silhouette, original normal/index/vertex,
material, texture, light, marker, collider or gameplay change. One additional ART
primitive (one visible draw; at most one existing-sun shadow draw under main's
current ART policy), 18 non-indexed vertices, 648 binary bytes. Runtime material
identity is shared, FrontSide, and main assigns `castShadow=true`; closing the
light leak may affect lighting and is not claimed to be pixel-identical.

The source helper is tavern-only; all 96 prior generated pieces and 36 markers
remain exact. The shipped candidate is an append-only GLB patch, NOT a full
regeneration. Removing precisely the added node/mesh, three accessors/views, ART
child reference and updated buffer length recovers original JSON exactly. Original
4,605,988-byte BIN is an exact prefix, including all compressed mesh/collider data.

- Original GLB SHA256: `1a9bc4b360464f0783917c6ed6ec98e63c955a4f9ef9874fbc9766e6787faf35`
- Candidate GLB SHA256: `99ac7a70792b95d381123df44f03bea47863620234f612b7a587b9869dd86d00`
- Original BIN SHA256: `2973f0a1ad46e5ff9e094139527f37d05598f76c4b9d09099fd8b838f51ce2af`

Shipped low/normal actual-main upward art rays hit the lining in all four samples;
downward roof/physical rays remain exact. All 28 original landmark entry/exit walk
legs pass without forced grounding. Paired native TPS approach/interior CPU frames
show the ceiling closing while keeping beams, lamps and doorway; see lighting and
render limitations in `ORIGINAL_LANDMARK_REVIEW_20261031.md`.

## Reproduction and future builds

From `world/`:

```sh
node --import tsx validation/environment-eight-hour/export-tavern-lining.ts LINING.json
python validation/environment-eight-hour/patch-tavern-underside.py ORIGINAL.glb LINING.json CANDIDATE.glb PROOF.json
node --import tsx validation/environment-eight-hour/audit-tavern-source-parity.ts PROOF.json
WORLD_REVIEW_ROOT=ISOLATED_WORLD node --import tsx validation/environment-eight-hour/audit-tavern-roof.ts OUTPUT --expect-lined
```

The patch pins the original hash and refuses input/output identity. Do not repatch
an already patched asset or loosen its whitelist blindly. Matching source geometry
is in `tools/gen/blacksail/architecture.ts` and appended in `build.ts`, so a future
source rebuild retains the repair. Full compression/regeneration can change unrelated
bytes; it requires its own audit and is not evidence for this narrow repair.

Evidence: sibling `environment/tavern-roof-before/` preserves the original GLB,
source geometry and original rays; `tavern-roof-candidate/` contains the candidate,
strict patch/source proofs, runtime material metadata, route results and paired
`med/renders/blacksail-{approach,interior}.png`. Root and independent QA reviewed both pairs; root approved the narrow patch. The
shipped GLB now matches the candidate hash above. No broad regeneration was used.

`validation/tavern-underside.test.ts` runs automatically in World CI: it checks the
complete original BIN prefix hash (including all collider bytes), single ART-only
lining, reused FrontSide material intent, six inward faces and four upward ray hits.
This cheap fixture does not boot main or regenerate assets. Future intentional
asset rebuilds must explicitly re-audit this pinned preservation contract.
