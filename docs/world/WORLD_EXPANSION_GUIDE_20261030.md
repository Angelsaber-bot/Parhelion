# Parhelion World — gameplay expansion

This release keeps the five existing regions and Arena layouts. It builds on the approved characters and environment models rather than replacing the world.

## Play

Default controls below can be changed in **Settings**. Existing customized bindings take precedence when new defaults conflict.

| Action | Default |
|---|---|
| Move / sprint | WASD / either Shift |
| Aim / fire | E or right mouse / left mouse |
| Interact / continue dialogue | F |
| Three-cut melee | B; press again during the later part of each cut to chain |
| Evade | Z; directional with movement, backward when stationary |
| Current contract skill / ultimate | Q / X |
| Summon / select companion | T / Y |
| Map / story guidance | M / G |
| Return from an optional clue to main guidance | P |
| Discovered settlement travel | N |
| Settings / leave mouse capture | O / Esc |

Equipment is still earned at the starting camp. A fresh reset does not grant a gun or contracts. Skills and melee require that equipment; a contracted and summoned companion replaces the explorer's basic skill kit.

### Combat

- Enemies have six readable roles: stalker, duelist, breaker, bombardier, musketeer and lancer. Their tells describe their actual damage footprint. Kyoto spear and sword roles use the corresponding authored weapons.
- Move out of locked thrusts and impact areas, use cover against musket shots, and watch for the second cut of a duelist.
- Melee can interrupt eligible ordinary windups, but repeated hits cannot permanently stun an enemy. A hit during a natural recovery window receives a **Punish** bonus.
- The rifle keeps its normal close-range responsiveness, with distance falloff and an eight-shot heat cycle followed by a short automatic vent. The HUD shows heat and vent time.
- Ultimates charge only from actual hostile HP lost to the player's normal gun or melee. Companion and ability damage do not charge themselves. Changing companion, opening menus or traveling does not refresh cooldowns.
- Contract abilities use the delivered characters' attack clips and contact events. Mounted charge validates the horse's path; a failed start does not consume the ability. These are in-world attacks with a short title presentation, not pre-rendered cinematic cutscenes.
- Boss first-clear rewards remain one-time. Completed bosses can be challenged again.

## Five regions, different routes

**Valley**: meet the archivist, reconnect the Observatory and see the residence respond. The repaired outpost relay can peacefully deactivate its nearby mechanical sentinels instead of requiring their destruction.

**Britain**: form the sword pact and answer the oath hearth before the Vacant King. The tower and old fragments remain optional. Restoring the memorial points to a separate knight trial; its first victory makes the road wardens stand down. The trial can be requested again.

**Black Sail**: meet Blackbeard and operate the fort cannon against three ghost boats. The cannon has its own firing origin, traverse limits and reload; a rifle cannot bypass it. The harbor return signal provides the next treasure-map clue. The main fleet passage no longer requires collecting all optional fragments.

**Winter**: meet Napoleon and connect the beacon route. The aid-post stove restores warmth and grants thirty seconds of retained warmth for the next departure. A more exposed road offers a different combat choice. Optional bells and ice-gorge exploration do not gate the core.

**Kyoto**: meet Musashi and break the encampment's banner signals. The direct approach has an authored sword/spear pair; the inn lanterns point toward a walkable, quieter firing slope. Kinkaku and Kiyomizu exploration remains optional. The Honnō-ji bridge lip now has a visible timber approach apron.

After the four era cores are restored, the Observatory offers a short **optional** closing record when you return to the Valley. Its text reflects what you actually repaired. Companions and unfinished discoveries remain available.

## Travel and interaction

- NPC dialogue stays readable until you continue; opening a map/menu or leaving focus clears it safely.
- Visit a settlement entrance on foot to register it. Only discovered settlement entrances can be selected for fast travel.
- Travel rechecks combat, pursuit, five seconds out of danger, grounded state and the actual landing clearance. It cannot be used while defeated, swimming, gliding, flying, mounted at the cannon or performing an action.
- Travel keeps health, skill energy, cooldowns, equipment and progress. Reset still returns to the original unarmed start.
- Combat audio has separate volume and mute controls. It starts only after user interaction and stops on loss of focus.

## Validation scope

Automated validation includes real GLB/BVH traversal, old/new save paths, reset, repeated interactions, authored character contacts, collision-constrained evades, four-frame-rate fairness, damage/energy budgets, and production DOM/startup/input integration with an explicitly stubbed non-GPU renderer. Offline Blender renders were used to inspect added props and melee poses.

These checks are not a claim of real-device FPS, WebGL image quality or human playtest acceptance. The available cloud browser could not create a WebGL context. Device rendering/performance remains a separate acceptance item.
