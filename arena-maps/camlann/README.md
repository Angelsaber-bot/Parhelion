# CAM LANN · 誓约荒原

Arthur chapter arena: **64 × 48 m** early-medieval-inspired fictional battlefield.
Low fractured stone courses, exposed timber hall frames, worn turf/soil, a broken
palisade and one torn banner replace later Gothic/castle imagery. Three offset
cover islands make a loose figure-eight, with a broad central breach and a 1.2 m
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
screenshots**. See `../../docs/ARENA_CHAPTER_QA.md` for final evidence and limits.
