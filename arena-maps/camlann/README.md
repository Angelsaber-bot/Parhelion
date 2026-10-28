# CAM LANN · 誓约荒原

Arthur chapter arena: **64 × 48 m** early-medieval-inspired fictional battlefield.
Low fractured stone courses, exposed timber hall frames, worn turf/soil, a broken
palisade and one torn banner replace later Gothic/castle imagery. Three original ruins plus western baggage, central fallen-timber and southern
stone-outwork cover islands make a loose figure-eight, with a broad central breach and a 1.2 m
hall foundation reached from both sides by 5 m ramps.

## Editable source / rebuild

```sh
python3 arena-maps/camlann/source/build.py
python3 arena-maps/_lib/check_glb.py arena-maps/camlann camlann
cd arena-game && npx vitest run test/maps.test.ts test/chapter-qa.test.ts
```

The complete editable layout and art are `source/build.py`, original material
generator `source/surfaces.py`, and shared dependency-free `chapterkit.py` /
`glbkit.py`. Surface generation uses Python's standard library only. Eighteen
256px base-colour / ORM / normal PNG channels plus one 512×384 painted ground atlas
are saved under `assets/materials/` and embedded in the actual GLB, not substituted
just for offline pictures. Worn paths are painted into that continuous floor
surface: no raised/coplanar path or grass-patch sheets cast paper-like edge shadows.
Generated `runtime/map.json` contains
actual collision/ramp geometry, anchors and four routes. Varying-height wall
fragments are separate authoritative solids, not invisible rectangular walls
under an irregular render shell. Small masonry chips, turf and heath are visual
details; main movement lanes have no micro-collider rubble scatter.

`camlann` is registered in the common offline/LAN/server/Worker map registry. Its
`oathfield` atmosphere does not change any existing map preset. Opposing spawns are
occluded and all key anchors are connected by real nav; routes are tested in both
directions using actual movement with no required jumping.

The thick shattered-thatch hall, splintered oak roof joints, blue/gold oath cloth and
single broad-bladed sword-in-stone
form the focal group. Varied oak crowns, low layered hills and textured earth/turf
frame the surrounding field. Worn fieldstone, wood, iron and linen retain their
actual roughness, metal, AO and normal channels in the three new maps' runtime
PBR/cel-tint path; ASTER/SAKURA retain the old renderer path unchanged.

This is a stylized fictional setting, not an archaeological or historical battle
reconstruction. No rideable terrain system or new combat rules are added. Human
PvP balance and target-device performance still need playtesting.

Previews are actual exported GLB renders with Blender CPU Cycles, **not browser
screenshots**. See `../../docs/arena/ARENA_CHAPTER_QA.md` for final evidence and limits.

## 2026-10-28 Arena density and perimeter repair

Added three deliberately placed fighting islands (baggage breastwork, fallen hall
timbers and dry-stone outwork) with matching solid collision and additional bot
cover anchors. Existing spawn/objective positions and four route polylines are
unchanged. Continuous 1.4m timber crest protection sits on the 2.8m perimeter
banks, at the authored ±32m/±24m edges; shared simulation bounds also prevent
jumping/dashing outside. No new textures or lights.

Final visual export: 42,283 triangles; 4,853,328 bytes including 886,333 embedded
texture bytes (3,966,995 geometry/JSON bytes, below the established 4MB budget).
GLB structural/proxy checks: 820 passed. All 65 focused map/chapter checks passed,
including both-way real movement, spawn occlusion, anchor connectivity and bots.
Fresh preview evidence is recorded separately by the independent QA pass.

## 2026-10-28 evening light, war dressing and collision audit

- **Light:** `oathfield` is now an amber evening (sun ~30° from the west) with the
  room environment dimmed to 0.45 so ruins, stakes and the hall cast readable
  shadows. 15 braziers/watch fires and 18 crest torches are emissive under bloom and
  carry runtime halos, ground light pools and rising embers (`presentation` block,
  drawn by `arena-game/src/chapterEffects.ts`; client-only, never collision).
- **Art:** sharpened-stake palisade on a solid backing board, stacked hall timbers,
  dropped shields/spears/arrows (all < 0.35 m), planted swords at the stone, team
  banners, two army camps with tents and smoking fires, a standing-stone ring and a
  distant Camelot landmark, smouldering pyres on the horizon, wall-foot grass/flowers.
- **Collision:** corner moss mounds that overlapped the playable rectangle (1.7 m
  walk-through hills) now sit outside the banks; the sword and the three braziers on
  reachable tops have real colliders. `python3 arena-maps/_lib/audit_collision.py
  arena-maps/camlann camlann` reports no ghost art in the body band.
- 69,320 triangles / 7.37 MB GLB (chapter budget raised to 110k / 9MB geometry).

## 2026-10-28 rebuild: the ruined town

max: players got stuck in the corners, the map was too empty and looked generated;
CAMLANN should be buildings and ruins. The layout is new and point-symmetric
((x, z) -> (-x, -z)); each side has:

- **Great hall** (NW / SE): roofless 5 m stone walls, a timber loft along the
  square-facing wall reached by a stair, three high windows from the loft over the
  square, two ground doors, a west door to spawn and an east door plus a vaultable
  breach to the north lane. Flagstone floor, hearth fire, table cover, banners.
- **Watch tower**: 2.4 m plinth with broken parapets, climbed by a stepped rubble
  slope from the square. The only high ground per side.
- **Market square** round the sword in the stone: stall with canopy, cart, well.
- **Cottage lanes**: four half-timbered houses (two roofed, one half-roofed, one
  fallen in) with doors on two sides and shoot-through windows.
- **Chapel** against the bank (arched door, west breach, lancets, glass over the
  altar), a **barn** in the spawn court and a burned house with its chimney.

Close quarters in the lanes and the hall, mid range across the square. The old inner
turf berm ramps are gone: their overlap left 0.5 m pits in all four corners that
nobody could walk or jump out of. `arena-game/test/stuck.test.ts` now scans every
map for such traps.

Town pieces carry `batch: "town"`: `chapterkit.save` checks each piece's art stays
inside its own collider, then merges them into one `BATCH_town` node (one draw per
material). 313 solids; 84,600 triangles / 8.26 MB GLB; ~95 draw calls in view.
