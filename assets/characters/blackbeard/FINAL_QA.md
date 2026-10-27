# Final Blackbeard candidate validation

## Main runtime
- GLB SHA-256: `92e766c67a066357d9f8414d67da2b950494c433abc2d578e7979f0021a8b34f`
- 18,285,480 bytes; lossless gzip transport copy approximately 6.6 MiB.
- 4 skinned mesh objects, 27 material primitives, 402,274 triangles, 227,770 exported vertices, 25 materials, 6 embedded images.
- 52 joints; no unweighted exported vertices; maximum four normalized influences.
- Idle, Walk, Run, Attack, Melee are present, move geometry and begin at time zero.
- Evaluated first/last vertex drift is below 0.0003 mm for all five recovery/loop cycles; all inspected coordinates finite.
- Three.js loaded the exact repaired GLB, verified all five clips/weights/finite data, and confirmed socket local +Z against deformed barrel end-cap normals (dot >0.995; muzzle plane error ~2e-7 m). Exported hand bone name is `HandR`.
- Animated muzzle-to-hand invariant drift below 3e-7 m; socket matches the modeled barrel endpoint.

## Actual visual checks
- Native full-body three-quarter, front, profile, back, face, Attack and Run renders: `previews/runtime_*.png`.
- Independent **reimported GLB**, not a native-scene substitute: `rig/final_qa/Attack.png`, `Run.png`, 12-frame `Run-final-actual-GLB.gif`, `Run-final-contact.png`.
- Corrected detached deltoid strip, trouser-intersecting knee fragments, waistband coverage gaps and metal harness creasing. Added fitted padded knee backing after profile inspection to bridge shell-to-leg stand-off. Inspected Run bends and firearm Attack after those corrections.
- Optional tricorn has its own full-character variant and QA records under `hat/`.

## Scope of the pass
Technical interchange/rigging checks passed. This does **not** certify exact FGO likeness, Saber-quality parity, commercial character-design rights, mobile performance or user art acceptance. Hair/beard styling and facial expression remain simplified relative to the supplied illustration. Rear hair/garment construction remains simplified. The back-view audit exposed partially embedded linen boot-wrap segments; these were subsequently projected onto the actual boot shafts and the repaired back view was inspected. This remains a reconstructed art candidate, not a fully polished art sign-off. Native editable components are supplied for further art direction. No collision, projectile logic, sound, cloth simulation, facial animation or engine controller is included.

## Footplant correction
The initially observed ~21 mm rolling-sole penetration after ground offset was repaired by compensating Walk/Run ankle IK from actual weighted sole geometry. No root-height adjustment or per-frame engine masking was used. Dense native testing: Walk support-foot error <=0.67 mm, Run <=2.70 mm; independent Three 120 Hz scan: Run penetration 2.692 mm, Walk 0.157 mm. Exact untouched-channel and mesh-coordinate comparison passed. Idle/Attack/Melee remained unchanged. Static previews remain representative; Run motion evidence was regenerated from this revision.
