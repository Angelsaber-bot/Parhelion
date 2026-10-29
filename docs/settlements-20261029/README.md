# Parhelion: Five Lived-in Chapter Hubs

Cloud source delivery, 29 October 2026. Base repository revision: `06852c65060e6edab68bb1aaed5662106e667ceb`.

## Included

- Phantom Sun Valley: companion residence, dining/lounge, sleeping wings, library shelves, courtyard pergolas and two residents.
- Sunset Kingdom: royal forge, stable yard, compact ruined abbey and three residents.
- Blacksail: customs office, inspection hall, bonded cargo room, rear cargo passage and three residents.
- Eternal Winter: aid house, recovery cots, asymmetrical canvas supply shelter, sled courtyard and two residents.
- Kyoto: swordsmith workshop, inn sleeping alcoves, entrance canopy, bamboo garden and two residents.
- Twelve lightweight background NPCs with chapter-specific clothing, simple idle motion, proximity prompts and cycling Chinese/English dialogue.
- Runtime placement against the actual shipped terrain/collision, physical floors/walls and access ramps. Nearby quests retain interaction priority; walls block dialogue line of sight. Random wilderness spawn placement excludes the new hubs.
- One contextual location per chapter, not a marker for each NPC or furnishing.

These are code-authored runtime THREE meshes. They are not new hand-sculpted Blender assets. NPCs are background residents rather than servant-quality hero characters.

## Applying the source patch

1. Use an existing checkout containing the base revision and its existing assets/dependencies. This ZIP is an incremental source package, not the complete game.
2. Back up or commit local edits first. Copy the included repository-relative paths into the checkout. If the checkout has changed in any of the existing replacement files, merge their changes rather than overwriting blindly.
3. The existing replacement paths are `world/src/main.ts`, `world/src/combatTerrain.ts` and `world/validation/input.test.ts`. The settlements modules, their tests and review helpers are new.
4. From `world/`, run `npm test`, `npm run typecheck` and `npm run build`.
5. The canonical unified website build is `npm run build --prefix site`, producing `site/dist/public`. Do not use the retired `Parhelion-Website` copy as the build root.

No publish/deploy script is automatically executed by this package. GitHub, Desktop and public deployment are not part of this cloud-only delivery.

## Scope and limits

- NPC interaction currently means contextual dialogue only. There is no new shop economy, crafting transaction, healing service, inn-rest save mechanic or relationship-event system.
- The additional buildings do not replace or remodel existing major landmarks. The existing shipyard was not rebuilt; the customs house adds a separate exploration building.
- The rear port route is an open physical service passage, not a scripted smuggling quest or a secret-door puzzle.
- Images are offline CPU renders of actual runtime geometry and vertex colors with studio fill lighting for readability. They are not screenshots of the running browser game and do not establish WebGL lighting or FPS.
- Physical entrance checks use the game's real Player controller against the shipped collision geometry. They are not a substitute for a complete keyboard/mouse play-through on every device.
- Historical styling follows the game's fictional chapter settings. It is not a claim of documentary reconstruction.

See `VERIFICATION.md` and the source manifest for the exact tested scope.

## Finding the hubs

The safe-placement pass placed these as auxiliary chapter outposts near existing routes, not necessarily inside the old dense city/port blocks. In particular, the Britain court is near the Camlann approach and the Blacksail customs outpost is on an inland trail/wreck-area approach, not inside the existing harbor streets.

| Chapter | Region-local X, Z | World X, Y, Z |
| --- | --- | --- |
| Valley residence | -166, 212 | -166, 10.04, 212 |
| Britain craft court | -178, 152 | -898, 5.48, 152 |
| Blacksail customs outpost | -202, -124 | 518, 12.73, -124 |
| Winter aid post | 8, 116 | 8, 4.53, -604 |
| Kyoto craft lane | -172, 92 | -172, 4.49, 812 |

Each hub has one named area entry. Placement is recalculated against the existing shipped terrain/collision at load time; changes to those assets can change the safe location.
