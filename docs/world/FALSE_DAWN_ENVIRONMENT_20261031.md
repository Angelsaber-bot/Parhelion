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
interaction radius. Valley's third actor could overlap a player standing by emitter III (not currently a
Warden admission origin, but an avoidable future transition hazard).
The per-field offset record now corrects that. An analytic full-disc check requires
**every actor** to be farther than `marker.radius + 2.05 m` from **every marker** in its
field, conservatively covering all interaction standing positions. Warden starts still require an
explicit array-console action; no automatic Warden spawn is claimed. Revised nine sockets pass
actual collision/ground/LOS/Player route tests again. The combat catalog must consume
`FALSE_DAWN_FIELD_ACTOR_OFFSETS[field]`, not the legacy default-offset array.

### Winter tactical warmth

The Winter console was about 189 m from the nearest existing warm source, making a
fresh player's two-wave fight vulnerable to unavoidable freezing. A small grounded
iron brazier now provides the existing cold system's ordinary 4 m warmth radius via
`false_dawn_warm_repeater` (`poi`, not an interaction). It adds no HP, energy or cooldown
recovery and does not override `winter_core`. Its fire stays visibly lit after the
array-seal ending. The actual Player reaches a resting point inside the warmth radius;
all prior field/cover/actor routes still pass. Total field markers are now eight:
seven interactions and this one passive warmth source. Winter geometry is 870 triangles.

### Observatory composition review

The Valley array now uses the observatory's ivory, blue-grey metal and aged brass
language: a broken calibration arch frames the receiver, a terrain-conforming stone
ring defines the clearing, and buried conduit strips connect the three anchors to
the console. Receiver I has a vertical ring; relay II a horizontal dish; transmitter
III a tall fork. A fallen housing provides a peripheral ruin accent. The center and
all interaction/spawn lanes remain open. Conduits and paving are visual only;
columns, plinths and housing have fixed collision. State changes never move them.

The actual shipped map crop and runtime meshes were exported by
`validation/environment-eight-hour/export-fields.ts`, then rendered with
`render-fields.py` using CPU Cycles and offline sun/sky lighting. Same-camera review
is stored outside the repository in `environment/false-dawn/renders/alpha-*.png`
(before) and `environment/false-dawn-v3/renders/alpha-*.png` (after), under the sibling
evidence directory. Views include approach, detail and a ground + 1.65 m battle eye.
Winter's visible warmth is reviewed in `environment/false-dawn-v2/renders/winter-*.png`.
These are actual geometry reviews, not runtime GPU screenshots or FPS evidence.
The revised Valley remains seven batches with no additional lights or materials.

### Crafted relay and slope-supported foundations

A second art pass adds chamfered cut-stone base courses, profiled column capitals,
recessed enamel/metal faces, restrained brass joints/fasteners, bracketed instrument
panels with inset cells, recorder ventilation and bolted emitter braces. The clearing
is a broken, terrain-set service court rather than instruments scattered on grass.
Gaps deliberately expose the original terrain; decorative paving is not collision.

Independent pixel QA noticed a possible dark gap under a column on its low slope
edge. Eight important foundations now extend below the lowest sampled footprint
corner (or octagonal rim), with tops unchanged. A synthetic slope regression tests
independent corner heights, and a FrontSide ray test verifies that service-court
surfaces face the player rather than relying on Blender's double-sided appearance.
All actual production-map actor/interaction/road routes, feet clearance and LOS still
pass after the physical foundation changes.

Valley is now **7,180 triangles / 947,760 render-geometry bytes / seven batches**.
The per-field triangle guard is 9,000, deliberately increased for crafted forms,
not a new light/material/draw-call allowance. Remote fields are unchanged. Compare
player-height `environment/false-dawn-v3/renders/alpha-battle.png` with
`environment/false-dawn-v7/renders/alpha-battle.png`; matching detail views accompany
them. Runtime GPU lighting/FPS remain outside these CPU geometry reviews.
