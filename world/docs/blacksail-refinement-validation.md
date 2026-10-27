# Black Sail 1718 refinement: validation record

Date: 2026-10-27. Baseline: `4016eef6d93a659984d3567a8ecf9ee2bc6c51c8`.
This record covers the Black Sail map and scoped material/export additions, not a
new game release or a browser performance certification.

## Frozen exported asset

- File: `world/public/assets/world_blacksail.glb`
- SHA-256: `4bacb5d599d8d4367b366c54ad43379245f6faf4c82504d43f77f813a701c1d4`
- Size: 4,753,832 bytes (baseline 5,727,508).
- ART: 630,018 triangles (baseline 503,746).
- COLLISION: 283,452 triangles, unchanged, in six meshes.
- ART meshes before runtime chunking: 94. This is not a measured GPU draw-call count.
- Ten BlackSail physical material profiles occur on nonempty production ART.

The GLB is regenerated from the TypeScript sources. Exact ART welding reduces
storage without simplifying, tolerance-welding, reordering or merging collision
geometry. The existing reorder/quantize sequence is retained; a second global
reorder is deliberately not added.

## Automated checks

The full world suite passed **219 tests, 0 failures, 0 skipped**. TypeScript
`tsc --noEmit` and the Vite production build also passed. Commands are in
`validation/blacksail/README.md`.

Regression coverage verifies the complete world identity, all 36 ordered markers,
objective graph, regions, teleports, ordered routes and updraft definitions.
Each original COLLISION mesh preserves its decoded ordered world-space triangle
stream, matrix and gameplay extras, not merely an unordered geometric set.
Actual production-GLB BVH/player tests cover the Nassau entry, gliding/updraft
route, cannon/ghost targets, reef and wreck paths, lighthouse climb and boss bridge.

Additional checks cover the eight authored house families, varied ship silhouettes,
finite geometry and indices, chapter-only material dispatch and export roundtrip,
and production-material identity. Ray tests prevent the observed W4 bow-deck
coplanar overlap, lighthouse gallery disk/sector overlap and opaque raised bow
wall across the bridge approach.

## Art review

The fixed review uses 16 matching camera views before and after, Cycles CPU,
256 samples, 1200 × 800 pixels, identical cool sea ambient and warm sun, no
denoising. Both sides hide `showWhen` objects and their descendants consistently.
Comparison boards contain original scene pixels plus labels, not generated or
retouched replacement architecture. `verify-review.py` checks every successful
256-sample render write, image dimensions and records SHA-256 hashes.

Views cover overview, Nassau street, tavern, fort, piers, small boats, flagship
approach/deck and hull, sky wrecks, windmill, reef, lighthouse, canvas/rigging,
cannon, boss deck and wreck interior. Review boards group these into Nassau,
fleet, islands and craft.

Observed defects corrected before the frozen export include overlapping bow
faces, see-through seams in intact hulls, unsupported lighthouse poles, fort
coplanar parapet strips, inward-facing cannon barrel/rings, visually blocked
flagship approach and invisible upper wreck-mast collision. Visible upper spars
now agree with the preserved old collision. Roof ART silhouettes are richer than
old coarse roof proxies; these decorative roofs are not authored walking routes.

## Boundaries and remaining acceptance

These are **offline exported-GLB PBR fallback renders**, not runtime toon screenshots.
The runtime derivative-based surface detailing, WebGL shader compilation, live
controls, GPU memory, frame time and FPS have not been verified in a browser.
The known browser sandbox restriction was not bypassed. A successful Node suite
and build are not substitutes for this remaining live-play acceptance.

Ghost sails retain their existing runtime `M_Beam` additive material. The
BlackSail-only GLB fallback uses alpha BLEND, opacity 0.28 and double-sided sheets;
portable glTF alpha blending approximates, but does not reproduce, runtime
additive composition. Ordinary cloth remains lit double-sided canvas.

Nassau architecture and maritime craft use documented period cues rather than
claiming to reconstruct the entire real town. The floating wrecks, ghost fleet,
reef skull and lighthouse challenge remain deliberate fantasy. See
`blacksail-historical-art-notes.md` for historical scope and sources.

Desktop synchronization, public deployment and their smoke tests are separate
operations and are not claimed by this cloud asset validation record.
