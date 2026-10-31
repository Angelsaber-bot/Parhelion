# Original landmark camera and access review — 2026-10-31

## Scope and result

Five existing authored spaces, not replacement buildings: Valley armory hangar,
Britain Round Table Hall, Nassau tavern, Kremlin south gate/court, and Honnoji
east gate/court. The HQ observatory and Honnoji main hall are intentionally solid
shells; this audit does not invent interiors for them.

Production main, low/normal settings, native 1280×720 TPS camera, normal physics:
all ten sampled poses settle on the intended floor without swimming; camera-to-head
wall checks are clear and low/normal camera/ray metadata agrees. The final route
fixture walks 28 contiguous entry/exit legs, with one explicit supported setup per
landmark, then only W/mouse/RAF. No forced grounding, health restoration, jumps or
progress writes. All legs finish grounded. Ordinary step/downhill airborne frames
are retained, not hidden; existing Winter threats can damage the player.

All sampled material references and vertex colors are assigned and finite; no
fully black vertices. Honnoji's dark timber is explicitly authored charred color
`#2e2626`, alongside visible fire/core effects. It is not a missing-material defect
and was not recolored. The corrected 60 m Honnoji crop contains the burned hall;
the earlier 42 m gate-centered crop did not and is not accepted as hall evidence.

One real defect was reproduced: Nassau tavern's outward-only hip roof has no
visible interior underside although its authoritative roof collider is solid.
See `TAVERN_UNDERSIDE_REPAIR_20261031.md` for the isolated candidate and exact proof.

## Evidence and caveats

Heavy files live in sibling `parhelion-eight-hour-evidence/environment/`:

- `native-landmarks-lit/{low,med}/`: ten native camera poses per quality (approach
  and interior), actual scene geometry/material/light metadata, CPU images.
- `native-landmarks-lit/landmark-audit.json`: initial five-region material/camera audit.
- `native-honnoji-crop/{low,med}/`: corrected angled temple court view and 60 m crop;
  32,511 triangles, 41 assigned material references, no fully black vertices.
- `tavern-roof-shipped/landmark-local-input.json`: final 28-leg ordinary-input
  routes on shipped main (also passed isolated candidate). Setup is explicit, not full travel.
- `tavern-roof-{before,candidate}/med/`: exact paired camera capture for repair.

These are source-scene CPU previews, not GPU screenshots. World geometry only:
actors, HUD, custom toon shaders, bloom and exact PCF behavior are not rendered.
Default Cycles environment lighting is occluded by roofs, unlike Three's hemisphere
light, so a dark default CPU interior alone is not evidence of a black game material.
The explicit `unoccluded-hemi-diagnostic` mode adds the exported hemisphere diffuse
term on camera-visible surfaces and labels that approximation. Direct/indirect
lighting and pointlight intensity mapping remain approximate. Frames use 32 samples
without denoising because this Blender build lacks OpenImageDenoise; visible noise
is not shipped texture detail. FrontSide primary-camera handling is preserved.

Superseded setup/crop/lighting evidence is retained, not overwritten:
`native-landmarks/` used a generic terrain query that could choose rooftop support;
`native-landmarks-supported/` corrected interior support; `native-landmarks-final/`
added wall metadata; `native-landmarks-hemi/` is an earlier diagnostic shader pass.
Use the exact accepted paths above rather than treating every export as equivalent.

## Reproduction

From `world/`, with output under the sibling evidence directory:

```sh
node --import tsx validation/environment-eight-hour/export-native-landmark-review.ts OUTPUT/low/meshes low
node --import tsx validation/environment-eight-hour/export-native-landmark-review.ts OUTPUT/med/meshes med
node --import tsx validation/environment-eight-hour/audit-native-landmark-review.ts OUTPUT
node --import tsx validation/environment-eight-hour/audit-landmark-local-input.ts OUTPUT
```

`WORLD_REVIEW_ROOT` optionally selects an isolated source/assets fixture.
Rendering must use the common admission wrapper; `render-fields.py` supports the
explicit final mode argument `unoccluded-hemi-diagnostic`. No broad map rebuild,
landmark recoloring, physics relaxation or camera/control change was made for this audit.
