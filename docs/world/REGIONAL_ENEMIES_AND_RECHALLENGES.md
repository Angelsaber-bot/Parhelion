# Regional enemies and repeatable encounters

This change targets World only. Arena, player damage, chapter progression requirements,
servant models and existing map geometry are unchanged.

## Regional models

Enemy appearance is fixed from its home region, not its current position. Kyoto uses
samurai and spear ashigaru; Winter uses Napoleonic Russian musketeers and officers;
Britain uses shield knights; Black Sail uses pirate raiders. Valley uses articulated white/teal mechanical Prism Hounds instead of the old purple
humanoids. Chapter bosses use larger region-specific champions with a gold crest. Blender-authored high and LOD1 GLBs are stored in
`world/public/assets/enemies/`. Sources were delivered separately in the four regional
asset ZIPs; no downloaded third-party character mesh is introduced here.

Skinned instances clone skeletons but share immutable geometry/material resources.
The nearest 24 eligible enemies receive animated models, with distance-based LOD and
shadow limits. Historical human silhouette fallbacks remain visible while loading,
when a load fails or when the detailed-model budget is full. Enemies must not attack
while invisible. Asset loading does not block world boot.

## Boss rematches

After completing any of the four existing chapter bosses, return to its original core
and use the interaction key (default F). A bilingual rematch prompt remains available.
The battle starts at full boss health, phase one, with attack timers and cooldowns reset.
Only one chapter encounter can run at a time. Walking away or being defeated resets
that encounter; saved chapter completion, weather changes and contracts stay intact.

First-clear keepsakes and progression callbacks run only once. Repeated victory is
explicitly announced as a rematch, not as another first-clear reward. Old completed
saves remain eligible without a new save schema or a progress reset.

## Wilderness elites

One optional elite is placed in each region through the existing terrain, settlement,
water and quest-safe placement filter. These are not progression requirements and do
not add dots to the full map. Placement rejects unsafe ground and keeps separation
from ordinary spawns. Gold identifiers and attack warnings distinguish them nearby. The valley sentinel uses
locked-point crystal bursts; the knight has a deliberate wide sweep; the pirate closes
quickly and leaves a long recovery window; the officer makes a faster sabre approach;
the samurai warns separately before each of two slashes, then pauses longer. Human
elites do not use magical distant ground explosions. Russian musketeers aim at a
fixed point for 1.2 seconds before firing, with line-of-sight checks, 14 damage and a
2-second recovery window. Moving out of the marked spot avoids the shot.

## Verification boundaries

Run `npm test --prefix world`, `npm run typecheck --prefix world`, and
`npm run build --prefix world`. Browser validation scripts additionally exercise the
interaction prompt, repeated victory and saved rematches. CPU GLB/mixer validation
checks actual delivered assets and lifecycle limits, but is not a frame-rate or rendered
visual acceptance test. A blocked browser launch must never be reported as a pass.

This development round does not itself publish to GitHub, synchronize a desktop or
deploy a public website.

## Visibility and encounter-density follow-up

- Ordinary spawn count on the complete map including settlements: 113 -> 145, plus
  five optional elites. Sixteen route-side pairs fill measured exploration gaps.
- Cap 160 logical wilderness enemies; detailed animated models remain capped at 24.
- Ordinary respawn 35 seconds, still only when the player is more than 30 m away;
  elites retain the longer 120-second respawn. Safe camps, hubs and quest areas remain excluded.
- All five elites are placed within 12 m of authored exploration paths. A single
  nearby direction/distance hint uses the actual alive elite position within 150 m.
  It does not add ordinary-enemy dots to either map.
- Terrain-only height sampling rejects rooftops more than 1.5 m above terrain.
  Three new Kyoto roof candidates are repicked onto walkable ground.
- Display visibility no longer depends on whether AI has previously activated.
  Paused/free-flight viewing can reveal enemies without ticking combat or damaging
  the player. Dead/dormant chapter bosses remain hidden.
- Transient asset failures retry with bounded backoff rather than permanently
  locking the session into fallback art. Exhaustion is reported once, without spam.

Validation uses real map geometry, settlements, exported character assets and scene
objects. Offline art preview is not a browser screenshot. Browser/GPU/FPS acceptance
remains outstanding; no deployment is implied by this cloud-only change.
