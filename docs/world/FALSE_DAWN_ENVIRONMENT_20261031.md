# False Dawn: authored action-field environment

Cloud-only implementation; no publication or GPU/FPS acceptance. Existing world map
assets, chapter gates, hubs and boss arenas are untouched.

## Audited locations (world coordinates)

| Field | Center X/Z | Terrain Y | Clear footprint | Nearest authored-road walk |
|---|---|---:|---:|---:|
| Valley array | -52 / -100 | 3.642 | 18 × 18 m | 32.2 m |
| Blacksail interception | 794 / 32 | 13.276 | 18 × 18 m | 27.8 m |
| Winter relay | 68 / -628 | 4.215 | 18 × 18 m | 21.3 m |

Candidate selection checked the actual five-region terrain and prop BVH, excluded
old interaction/enemy markers within 38 m, bosses within 95 m, safe hubs and wilderness
zone radii plus 26 m. Terrain variation within each footprint is <=1.49 m. The director
still owns actual enemy activation, home, leash and reset rules: this geometric margin
alone does not prove isolation from every existing wilderness actor.

## Set pieces and collision

- Valley: abandoned reel recorder, separate array console and three grounded emitters.
  Receive / Relay / Transmit use Roman I / II / III plates and differently oriented
  rings, not color alone. Their interaction positions face the open combat center.
- Blacksail: a salvage-built shutter relay held in broken ship ribs, plus two cargo
  cover blocks placed outside the center lane.
- Winter: a triangular open wind shelter, relay console and two snow-capped cover
  blocks, again outside the center lane.

All props sample ground independently. World-space colliders join static collision
once. Anchors and endings change existing visual layers and emissive intensity only;
no choice moves cover or changes traversability. Sealing darkens the completed array;
repurposing leaves a warm channel. No new point lights, textures, shadows or effects pool.

Pure `falseDawnSitesData.ts` exports audited centers, anchor positions and three actor
XZ offsets. Blacksail/Winter use (-2,2), (2,2), (0,5); Valley uses
(-2.5,-0.8), (2.5,-0.8), (0,0.8), avoiding the third-emitter transition. It has no Three.js/runtime imports. The scene factory
returns final grounded `sites[].spawnPoints`. Authored actors should use the director's
ground/clear/LOS checks, not weaken global `safeSpawn` protections: new interaction
markers intentionally keep random wilderness spawns away from these stations.

## Checks at initial geometry checkpoint

- `false-dawn-sites.test.ts`: pure-data dependency boundary, finite geometry, original
  footprint, <=8 meshes/3 materials/6,000 triangles per field, seven distinct IDs,
  independent/resettable anchors, nullable ending behavior, seal/repurpose visuals,
  1,000 state changes with stable resources/collision, idempotent disposal and culling.
- `environment-eight-hour/audit-false-dawn.ts`: actual production maps + old hubs +
  campaign props + final False Dawn colliders. All three road approaches, seven
  center-to-interaction routes and nine center-to-actor routes pass with actual Player,
  without jumping. All actor sockets have clear bodies, center LOS and ~0.04 m feet
  offset from actual collision terrain.
- Geometry: Valley 1,976 triangles / 7 meshes; Blacksail 852 / 4; Winter 696 / 3.
- Evidence outside repo: `../parhelion-eight-hour-evidence/environment/false-dawn-audit/`.
  `candidates.json` is the placement research; `geometry-routes.json` is the final
  collider/route report. Render review remains pending at this checkpoint.

### Interaction-disc spawn margin

The first offset audit checked feet and LOS but not every standing point inside the
interaction radius. Valley's third actor could overlap a player finishing emitter III.
The per-field offset record now corrects that. An analytic full-disc check requires
**every actor** to be farther than `marker.radius + 2.05 m` from **every marker** in its
field, covering initial starts and auto-wave transitions. Revised nine sockets pass
actual collision/ground/LOS/Player route tests again. The combat catalog must consume
`FALSE_DAWN_FIELD_ACTOR_OFFSETS[field]`, not the legacy default-offset array.
