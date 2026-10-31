# Authored material intent audit — 2026-10-31

## Result

The five shipped map GLBs have **301 ART meshes / 4,035,007 triangles**. The audit found
no unnamed material assignment, invalid material slot/index, non-finite attribute,
missing normal, sampled weak normal or majority-near-black albedo group. Source
albedo is not a substitute for a runtime lighting capture. Darker authored groups
include Britain/Winter charred wood and BlackSail iron; no palette was broadly
recolored and Kyoto's established architecture remains untouched.

A separate, reproducible runtime-adapter defect was found: `toonMaterial`'s generic
fallback copied color/vertex colors but discarded authored practical emission and
sidedness. All five old hub builders feed that fallback in main.

| Hub | Source materials | Emissive materials lost before | Two-sided materials lost before |
|---|---:|---:|---:|
| Alpha | 38 | 5 | 1 |
| Britain | 54 | 4 | 1 |
| BlackSail | 17 | 1 | 1 |
| Winter | 14 | 1 | 0 |
| Kyoto | 16 | 2 | 0 |
| Total | 139 | 13 | 3 |

The narrow fallback fix preserves source emission/color, compatible diffuse/alpha/
emissive map references, sidedness, opacity/alpha-test and depth/polygon-offset flags.
The lighting model remains toon; PBR roughness/metalness are not claimed to survive a
change of lighting model. Named regional, beam, water, target and emissive special
paths remain unchanged.

After the fix, all 139 authored hub materials pass the same intent audit with **zero
losses**. Actual hub materials have no lost textures or transparent/opacity changes;
opaque assets stay opaque. No light, geometry, source texture or material instance is
added by the fix. Double-sided panels can add a legitimate shader variant/back-face
work; no GPU performance claim is made. Emission restores the surface cue, not a new
point light.

## Ownership and validation

Texture references are shared, not cloned. Converted material disposal does not
own/dispose those authored textures; their existing owner remains responsible. Tests
verify source immutability and texture ownership, actual hub glow/side counts, opaque
behavior, and exact named beam/water overrides. All 35 focused generic and regional
material tests plus typecheck pass. Shared material-cache integration should continue
to compare complete compatible material state, not assume the previously omitted
properties were intentionally zero.

Tools:
- `world/validation/environment-eight-hour/audit-materials.ts`
- `world/validation/environment-eight-hour/audit-settlement-materials.ts`
- `world/validation/look-material-intent.test.ts`

Evidence outside the repo, under sibling `parhelion-eight-hour-evidence/environment/`:
- `material-audit/production-materials.json`: all source rows, bounds and albedo samples.
- `material-audit/settlement-adapter-before.json`: reproduced property losses.
- `material-audit/settlement-adapter.json`: corrected adapter, zero losses.

These are actual source/runtime-object audits, not fabricated screenshots or a claim
that every dark on-screen surface has been visually accepted under WebGL.
