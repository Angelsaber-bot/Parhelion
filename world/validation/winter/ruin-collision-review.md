# Existing Moscow ruin collision repair — 2026-11-07

The 13 burned-open timber houses and warehouses kept full-height box colliders after their art became roofless ruins. In the shipped pre-repair GLB, a horizontal ray from local `(60.563, 14, -202.007)` toward `-Z` saw no ART for 16 m, but hit `COL_Props` after 4.460 m. The house is at world `(60.563, 12, -930.007)`. This caused invisible cover and an invisible standing surface at the former roof height.

Only those 13 boxes were removed. Their replacement uses the same solid geometry that creates the visible rubble base, surviving walls, columns, chimney and rafters. The existing 1812 retreat setting, silhouettes, materials, all ART nodes, layout, quest points and roads remain unchanged. A separate always-enabled collision mesh keeps the change auditable; it creates no rendering batch.

`ruin-collision-replacement.json` records the pre-repair asset hash, each removed house and its exact 12-triangle range. The other 24,772 ordered prop triangles retain the pre-repair byte hash. Terrain, gates and targets retain their original exact baseline. The replacement has 3,588 collision triangles; the final GLB is 6,586,660 bytes.

These ruins have a visible solid rubble base with its interior surface 1.55 m above the authored base, not a hollow room behind four walls. Automated checks use actual decoded ART/COLLISION and the real `Player` capsule. Each of the 13 interiors settles on that visible surface and has a tested no-jump exit through both ends. Where an existing tree occupies the centre line, the test follows a real lateral route around it. All 26 ordinary outside walk attempts remain blocked by the visible raised base, so the high opening is not advertised as a ground-level door.

Validation: 27 initial targeted Winter checks passed (art families, fieldworks, landmark rays, exact collision preservation, all ruin apertures/cover and capsule routes, existing bridges/camp/beacons/Moscow/bell/gorge). The added per-vertex export check compares every replacement vertex to the authored solid within 4 mm GLB quantization error. The Winter branch of `map-polish.test.ts` and TypeScript checking passed. Runtime stream generation is coordinated by the task owner after the regional GLB rebuild.

This is decoded production geometry and movement/shot verification. It does not claim GPU rendering, frame-rate measurements or a new historical reconstruction. Historical art sources remain in `world/docs/everwinter-historical-art-notes.md`.
