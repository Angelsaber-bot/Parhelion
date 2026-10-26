# Aster Research Station — original Arena graybox

Map ID: `aster_research_station`; version: `0.2.0-graybox`; mode: `arena`.

The first deliverable is a 72 × 56 metre Arena space for later 1v1, 1v2 and 2v2 testing. The four spawn anchors accommodate two players per side. These labels describe space allocation; there is no match, team, respawn or networking system yet. The research-station theme is retained from the approved planning file; Arena now has priority over World work.

## Layout decisions

- A central reactor divides sightlines around a neutral console court. The central approach is shorter than the outer loops, with alternating 1.15 m and 1.85 m cover. No crouch mechanic is implemented; low cover is a future combat tuning input.
- A south laboratory loop offers a ground flank with staggered 3 m pods, a rear bypass, and two connections into the court. Amber marks this route.
- A north gallery loop sits 3.0 m above the court. Ordinary 10 m ramps on both ends climb at a 0.3 gradient (about 16.7°). A 6 m wide, 9 m long third ordinary ramp connects the central court to the gallery. There are three approaches to contest the high ground; retaining a high position requires watching several directions. Cyan marks this route.
- Spawn pockets have two exits each, a 16 m long × 4.4 m high screen, and four named candidate anchors. The 5.2 m gap between each screen's outer face and the nearby pocket wall permits the first turn; route tests verify the complete exits. Screens protect the four anchors after the gallery and route spacing were redesigned. The former ramp/wall slot is now 4.775 m wide; court entrances are 6 m wide. See `REPAIR_0_2_0.md` for the measured before/after table and collision repair.
- Decorative bands and floor markings do not collide. Visual meshes, solid collision proxies, and gameplay anchors are separate layers. Cover and objective anchors are independent data, ready for future runtime systems.
- Two shield reservation anchors describe nominal 2.4 m panels and intended bypasses. Dash lanes reserve space for later testing. Neither skill exists in this prototype. Actual shield placement and dash collision checks must be repeated after those mechanics are implemented.

## Public-source design research

This is a principle-level study of finished games and public code. No commercial files were extracted, no source map was imported, and no referenced game's code was copied or executed. Aster geometry, materials, importer and movement prototype were authored for this project.

| Source | Observation | Application here |
| --- | --- | --- |
| [OpenArena g_client.c](https://github.com/OpenArena/gamecode/blob/main/code/game/g_client.c) | `SpotWouldTelefrag` checks occupied spawn volumes; spawn selection tries to avoid the nearest point to a death location. | Keep spawn anchors explicit, non-overlapping and testable. Dynamic occupied-spawn rejection remains future work. |
| [Xonotic spawnpoints.qc](https://github.com/xonotic/xonotic-data.pk3dir/blob/master/qcsrc/server/spawnpoints.qc) | Spawn validation and weighted choice use valid geometry and player-distance considerations. | Validate anchor support and clearance offline; retain multiple candidates rather than one hard-coded spawn per side. LOS exclusion is our proposed additional criterion, not a claim about those source functions. |
| [Red Eclipse server.cpp](https://github.com/redeclipse/base/blob/master/src/game/server.cpp) | Spawn setup/selection contains usage and repeat-avoidance logic in relevant modes. | Keep stable anchor IDs for later usage/cooldown scoring. This map does not implement that policy. |
| [CPMA level-design guide](https://www.cpma-news.org/guides/content/leveldesign) | Research handoff emphasized interconnected spaces, offset atria and high-ground control/exposure tradeoffs. | Preserve the valid Aster blockout: two distinct loops around one court, plus a risky central ramp, rather than rebuilding a reference layout. |
| [Official Xonotic guide](https://xonotic.org/guide/#stormkeep) | Its route discussion illustrates speed/sound tradeoffs and movement knowledge. | Distinguish short exposed court access from longer bypasses. Sound propagation and resource economy are not implemented. |
| [Stormkeep mapinfo](https://gitlab.com/xonotic/xonotic-maps.pk3dir/-/raw/master/maps/stormkeep.mapinfo) | A public example of map metadata declaring supported game modes. | Declare map identity, version, units and intended team sizes separately from geometry. This is not a geometry reference to copy. |
| [CPM1a original README](https://lvlworld.com/readme/id:701) | The author forbids using the map as a base for other levels. | Do not reuse its layout, map source, geometry or textures. This package contains none of them. |

License review recorded in the research handoff: OpenArena game code GPL-2.0-or-later; Xonotic game code GPL-3.0-or-later with engine licensing separate; Red Eclipse code Zlib, with asset licenses separate. [Red Eclipse license](https://github.com/redeclipse/base/blob/master/doc/license.txt) and [per-asset license inventory](https://github.com/redeclipse/base/blob/master/doc/all-licenses.txt) reinforce the distinction. Public visibility does not grant permission to reuse every asset. No GPL game code or reference-game assets are distributed in this project. The bundled third-party code is Three.js, covered by MIT; see `THIRD_PARTY_NOTICES.md`.

## Planning input and scope

Source planning document: `Shooting_Game_Alpha_7_Week_Revised_v1_1(1).md`, Library ID `libfile_6b6b8d95e51081918c91ce81962855f1`, read in full for this task. The original planning document was not replaced.

The user's budget is 70 hours/week. Keeping the plan's included 20% test/fix/integration reserve gives 14 hours/week for that reserve and 56 hours/week for other work; seven weeks would be 490 hours of theoretical capacity. This is planning arithmetic, not a delivery guarantee or authorization for unattended seven-week execution.

This checkpoint completes only the first Arena map prototype. Multiplayer, authoritative combat, AI/training, weapons, characters, dash, destructible shields and World exploration remain outside this deliverable. Their future implementation may require substantial map changes.
