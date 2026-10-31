# Inhabited campaign spaces and grounded hub approaches

Cloud development checkpoint, 2026-10-31. Not a publication or target-device FPS claim.

## Scope

Existing five map GLBs, landmarks, boundaries, settlement structures, travel arrivals and
main mission gates are unchanged. Five small authored workspaces use previously open
parts of the living-hub courtyards. They share story metadata with `campaignEpisodes.ts`.

- Valley: instrument kiosk, receiver, dispatch board and selected radio aerial.
- Britain: oak witness shelter, wax-sealed record and named tablet / returning seats.
- Blacksail: striped tide-watch awning, manifest and two-shutter signal mast.
- Winter: windbreak canopy, canvas stretcher, hot-water flask and route board.
- Kyoto: paper-preservation veranda, drying ledger, archival cases / refuge mats.

Two interaction positions and one resident socket per workspace. State changes toggle
existing visual-only prop batches; they never rebuild geometry, move collision, change
rewards or create another mandatory campaign gate. Resident metadata comes from the
narrative module. Geometry uses authored vertex colors rather than unassigned materials.

## Cost checkpoint

| Workspace | Triangles (all states) | Meshes | Materials | Geometry attribute bytes |
|---|---:|---:|---:|---:|
| Valley | 1,404 | 7 | 3 | 185,328 |
| Britain | 1,168 | 7 | 3 | 154,176 |
| Blacksail | 1,044 | 7 | 3 | 137,808 |
| Winter | 800 | 7 | 3 | 105,600 |
| Kyoto | 1,416 | 7 | 3 | 186,912 |

These count all mutually exclusive branch props; visible draws can be lower. No new
lights, textures, render targets, post effects or shadow-casting meshes. Sites cull at
150 m. Colliders join the authoritative static BVH before player creation.

Grounded visual approaches connect existing authored roads to original entry ramps:
52 / 60 / 112 / 56 / 20 m respectively. Five material-batched meshes share one material;
6,240 triangles total. There is no collision or artificial ground: routes are planned
against the existing height grid, slopes and prop BVH, then walked through real Player
physics. If no safe route exists the planner returns an explicit skipped result, never
paints a road through obstacles. The approach layer culls at 205 m.

## Verification

- `validation/campaign-sites.test.ts`: 16 tests covering bounded geometry and material
  budgets, finite vertices, original footprints, two separated interaction sockets,
  all progress branches, 1,000 state changes without resource replacement, idempotent
  disposal, culling and actual Player routes to new **and original** hub interactions.
- `validation/settlement-approaches.test.ts`: clear route, obstacle detour, missing-road
  fallback, geometry/lifecycle budgets.
- `validation/environment-eight-hour/audit-approaches.ts`: actual five shipped maps,
  original settlement placement, old story colliders and new site collision. All five
  road-to-ramp-to-hub walks pass without jumping. Evidence is outside the repository:
  `../parhelion-eight-hour-evidence/environment/approaches/audit.json`.
- Typecheck passes at the checkpoint; aggregate tests belong to the integration lead.

## Visual evidence boundaries

`validation/environment-eight-hour/export-review.ts` exports the **actual runtime
builders**, not an illustrated interpretation. `render-review.py` creates CPU Blender
exterior/interior/workspace views. Evidence is under the sibling environment folder.
The exporter carries vertex colors and material base colors; the revised Blender
shader multiplies both, rather than accidentally whitening old vertex-colored props.
Small procedural surface textures are not reproduced. Lighting is explicit offline
studio lighting, including a review fill; these images are not WebGL captures or
proof of runtime illumination/FPS. Original charred Kyoto art is untouched.
