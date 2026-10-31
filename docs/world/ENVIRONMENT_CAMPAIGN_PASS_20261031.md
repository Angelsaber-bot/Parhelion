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

## Resident silhouette refinement

The five named campaign residents reuse the existing six articulated render batches
and shared resident material. Their occupations now have authored costume/accessories:
receiver headphones, witness mantle/book, oilskin cape/hand lantern, stretcher harness
and blanket pack, and paper keeper's scrolls/satchel. No new actor count beyond the
five agreed story sockets, no pathfinding or lights, and existing 24 m animation /
90 m visibility ranges stay unchanged. New role poses are restrained and compatible
with the fixed-arm resident rig; no fake elbow-reaching motion is claimed.

Actual runtime geometry triangles per added resident: 6,182 / 6,242 / 5,826 / 6,230 /
5,666. `settlement-npcs.test.ts` checks six batches each, unique occupation geometry,
human scale and finite matrices after 600 updates. Actual mesh review is
`environment/campaign-residents/residents.png` in the sibling evidence directory.

### Resident profile and acting refinement

Residents now have narrower eye openings/highlights, less protruding necks and
profiled belt/robe bands. Campaign hair silhouettes use rounded locks rather than
identical pointed fringes; Ada retains silver hair and a tied-back bun, without the
initial beard that contradicted her narrative identity. Her mantle is a draped
collar instead of two round shoulder pads. Work props remain parented to the arm.

Readers occasionally glance down and lift their notes slightly; keepers make small
head-first scanning motions. Work attention eases out when the player approaches.
Dialogue gestures are reduced for the five campaign residents to avoid rigid-arm
waving. All motion still stops outside 24 m, geometry is never rebuilt during
updates, and actors remain six batches sharing one material. Seven resident tests
include a 900-frame bounded-work/gesture check, resource identity and far freeze.
Final profile geometry is reviewed in sibling evidence
`environment/campaign-residents-v4/residents.png` and `faces.png` using the committed
`render-residents.py` CPU tool. This is geometry/offline-lighting evidence, not a
runtime animation or GPU capture. Campaign actors range from 5,884 to 7,008 triangles.

### Close-range acting evidence

A close portrait review exposed the original mouth line intersecting the face surface;
it is now in front of the skin and protected by a front-ray regression. Campaign eyes
are relaxed further (Ada's elder profile is narrower), and held witness/archive pages
now have ruled entries and seals rather than a blank face. Actor batches stay at six.

The exporter can simulate an explicit 0–60 second timestamp using the actual idle
update and records head/arm rotations. Same-camera Ada poses at rest and 5.12 seconds
are in `environment/resident-acting-v2/{rest,read}/ada.png`, under sibling evidence.
The bounded head-down/note-lift is runtime pose geometry under offline studio lighting;
two stills do not claim runtime frame pacing or a full motion capture. Final campaign
residents span 5,972–7,008 triangles. Eight NPC tests pass.

### Hard-roof collision consistency

An upward ray reproduced missing collision on the visible Alpha kiosk roof. Alpha's
hard canopy, Britain's oak/slate shelter and Kyoto's tile veranda now use their actual
roof panel/ridge geometry as fixed collision (14 small boxes, 168 collision triangles;
render geometry unchanged). Soft canvas/sail shelters retain their existing behavior.
A real Player capsule jumping from a test-only raised standing pad cannot pass through
these three roofs and lands normally. All five original/new interaction routes and
all five actual production-map road→ramp→hub walks pass again; see
`environment/roof-approach-regression.log`. No progress-dependent collider is added.

### Interior, travel and interaction follow-through (06:51 UTC)

- Hard roof changes remain limited to the Alpha kiosk, Britain witness shelter and Kyoto refuge veranda. These are single-storey annexes, without stairs/lofts. Original settlement buildings, roof openings, canvas and original map collision were not changed.
- `validation/campaign-sites.test.ts` additionally walks 17 explicit original doorway/interior destinations with the actual Player: Alpha residence door, central hall, both sleeping-wing aisles and rear dining aisle; Britain forge door/work/rear aisles, stable front/rear aisles and abbey nave; Kyoto inn doorway/main room/both sleeping aisles and smith entry/work aisle. All pass alongside all previous task/NPC sockets and hard-roof upward capsule checks.
- `validation/environment-eight-hour/audit-hub-field-walks.ts` samples all 47 production authored/hub travel destinations using the production downward ray and ordinary gravity settling. No destination intersects a new roof. 45 land grounded; the original `lake` and `seam_n` destinations settle in ordinary swimming, not on fabricated ground.
- The same actual-map fixture includes original story colliders and physically traverses hub travel landing→False Dawn console without jumps, subsequent teleport or forced grounding. BlackSail and Winter use conservative body-clearance A* waypoints and normal Player walking (7,072 / 1,747 physics frames at 120 Hz). Alpha follows the lead's ordinary walking/swimming route: 10,377 frames, including 3,607 swimming frames. A dry-only conservative search did not find this crossing; this is not claimed to be an entirely grounded route.
- Artifact: sibling `parhelion-eight-hour-evidence/environment/hub-field-walks/audit.json`; replay from `world/` with `node --import tsx validation/environment-eight-hour/audit-hub-field-walks.ts`. This tests physics/clearance, not live enemy survival or human wayfinding; independent QA owns actual-main input journeys.
- A real-input usability review found the centrally placed Alpha keeper won the nearest-target comparison when approaching the receiver from the east. Moved only this keeper to the west side of the canopy (local `[-3.6,.02,1.2]`, yaw `.55`); no marker, collider or targeting-rule change. East receiver/dispatch and west resident standing positions now select the intended target with clear interaction LOS; all walking destinations remain reachable. Other residents retain their authored placement pending concrete evidence.

### Five-site natural stance refinement (06:57 UTC)

The follow-through audit reproduced the same briefing→station prompt overlap in all four remaining workspaces. Alpha's first side placement also retained a marginal overlap when approaching the receiver directly from the keeper. Final resident sockets are local `[-3.9,.02,1.2]` in Alpha/Britain/Winter and `[3.9,.02,1.2]` in BlackSail/Kyoto, angled toward the workspace. This keeps at least 2.5m horizontal separation from either task socket while preserving every marker, solid, state and guide target identity.

All five residents have body clearance from original furnishings and no overlap with original NPCs. Tests walk original/new task and resident sockets plus the 17 interior destinations. At natural one-metre-short stopping points between each resident and each station, the station now wins the existing nearest-distance comparison and has unobstructed interaction LOS. These are placement corrections, not automatic target switching or larger interaction radii.

Actual runtime-builder CPU context frames: `environment/campaign-side-residents/renders/{alpha,britain,blacksail,winter,kyoto}-campaign.png`. All five inspected: resident and both task props remain distinct, and no new body/furniture overlap is visible. Winter's existing courtyard wall occludes lower legs from this exterior review camera; the reachable interior standing socket itself is unobstructed. Frames use the established studio review lighting, not a WebGL screenshot or gameplay-shadow claim. The preceding `alpha-keeper-usability` render records the intermediate 3.6m placement, not final coordinates.

### Original dry Valley crossing recovered (06:59 UTC)

**Supersedes the swim-route preference above; no geometry change.** Source inspection located the original West Ford bridge centered at `(-95,61)`. The earlier conservative planner sampled floor only up to terrain+1.4m, excluding this elevated deck; its failure was not evidence that a dry route was absent.

`audit-alpha-crossing.ts` now walks the original HQ trail, bridge centerline, west bank and array with actual Player physics: 8,850 frames at 120 Hz, zero swimming, zero jumps, no teleport after the initial production travel landing and no forced grounding. Exact per-leg coordinates/feet/swim counts are in `environment/alpha-crossing/audit.json`. The full hub-field audit now uses this bridge route and requires zero swimming for Alpha; the earlier successful but unnecessary swim route is retained as `environment/hub-field-walks/initial-swim-route-audit.json` for truthful evidence history. Independent QA is replaying the dry route through actual-main input before treating it as gameplay/survival acceptance.

The bridge approach is diagonal, not the direct bearing from `(-96,82)` toward the lake. From `(-96,90)`, approach `(-81.712,83.348)`, follow the authored deck through `(-95,61)` to `(-108.288,38.652)`, then use the west-bank route `(-110,25)→(-100,0)→(-80,-30)→(-60,-60)→(-52,-85)→array`. Narrative can accurately name West Ford and the west bank; no new bridge, water immunity or altered controller is necessary.

At 07:02 UTC independent QA reported actual-main dry-route acceptance: the winter/seal journey with `--walk-links --dry-alpha` reached both Winter and Alpha consoles through keyboard locomotion with zero swimming frames, preserved normal travel HP semantics, completed real combat/emitters and persisted the ending (130.42 simulated seconds, final HP90). This closes the route verification gap; the original bridge requires no repair.
