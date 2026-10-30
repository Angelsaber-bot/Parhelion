# World encounter pass — 2026-10-30 (gameplay iteration)

## Playable differences

- Existing wilderness actors have six stable roles: stalker, two-cut duelist, heavy breaker, bombardier, musketeer, and Yari lancer. No HP or population inflation: regular HP remains 66/88; wilderness cap remains 160; actual accepted wilderness roster remains 145 plus five sparse elites.
- Lancer damage and the rendered rectangular tell share the same locked forward footprint. Ground bursts and musket shots retain locked impact points; every hit rechecks cover and vertical separation. Duelist follow-ups each receive a full tell.
- Chapters now have different boss rhythms: royal sweep/burst; admiral broadside/cold-lamp shot; winter thrust/frost burst; hellfire paired cuts and thrust. Distant players no longer disable further boss attacks through the old attack-count parity condition. Boss HP is unchanged.
- Ordinary windups can be interrupted by melee, with a four-second per-enemy lockout to prevent permanent stunlock. Natural recovery gives melee double damage with explicit PUNISH feedback; forced stagger does not compound this bonus. Bosses/elites cannot be cheaply interrupted.
- Rifle damage is 16; full enemy damage within 18m, linearly falling to 45% at 65m. Quest targets retain their original ray range and progression. Eight shots trigger a visible automatic 1.1-second vent; short deliberate fire can cool during idle. No inventory/ammo save schema was introduced.
- Guard reduces incoming damage to 55%; evade immunity comes from the player's actual timed action. Both clear on pause/reset/death.

## Authored route choices

`authorEncounters` reserves existing IDs, never spawns an additional pack. All relocated positions pass the original `safeSpawn`; there is no global or camp-specific terrain-validator bypass.

- **Akechi camp:** `wild_35d` and `wild_35e` move from a remote Kyoto pack to `(-202, 882)` and `(-206, 908)` as a Yari lancer and a two-cut samurai. Direct camp approach is threatened in the real BVH simulation. The ground-accessible quiet ledge `(-224, 11.56, 840)` stays outside their 35m leashes. Restoring `kyoto_lantern_route` narrows their perception in the western approach corridor, not everywhere.
- **Oathless Knight:** the existing safely placed elite keeps its authored home. First victory persists `era_britain_knight_defeated`, retires the knight, and pacifies the nearby road pair. A memorial rematch queues the same knight at its home when the player arrives within 8–28m. It never teleports to the player or grants chapter rewards. Nearby actors yield during the first duel and remain peaceful after completion.
- **Relay B:** `relay_b` puts `wild_48`/`wild_48b` into visible `pacified` state: dimmed mechanical shells/lights, gray bar, dormant message, stationary animation. This is not death. It emits no damage, kill or energy events and cannot be farmed. Reset restores the encounter.

## Integration APIs

- `combat.damageEnemy(id, amount?, {source, origin?})` preserves a boolean result. Sources: `ranged`, `melee`, `servant`, `skill`, `ultimate`.
- `combat.applyStrike({origin,direction,range,halfWidth,damage,maxTargets,losOffset?,casterFeetY?}, source)` revalidates live targets, planar corridor, height and LOS at contact; returns `{damage,hits:[{id,damage}],kills}`. It is contact-only work, not an ambient per-frame scan.
- `WorldCombatOptions.onDamage({id,damage,source,eligible:true})` receives actual capped HP loss, never raw administrative state damage. Only ranged/melee should feed player ultimate energy. `onKill(id)` allows the runtime integration to persist world changes.
- `combat.setDefense({guard,invulnerable})`, `syncWorldProgress(done)`, `requestKnightTrial()`, `knightTrialPoint()` and `recoverAtSettlement(amount)` cover player actions and story integration.
- Boss requirements come from `eraStories`; they are refreshed before every challenge. Legacy ready/completed saves remain accepted, and post-core contracts count as completed to avoid duplicate first-clear rewards.

## Resources and verification

One shared thrust plane and at most six shared role-label textures; no new lights, population, or detailed-model budget. Existing 24-detail model, 18-shot, and 20-impact caps remain. Relay materials are changed only on those two independently owned procedural actors; shared GLB clothing materials are not mutated. Role-aware model selection uses actual Yari/samurai/musket assets. All six delivered GLBs were also rendered and visually inspected in a cloud Blender review.

Focused tests cover deterministic roles, actual tell geometry in five directions, dodging/cover, fair follow-ups, source-aware damage, guard/evade interruption, heat/pause/reset, boss range pressure, repeated rewards, real-BVH camp placement/threat/quiet bypass, optional trial retirement/replay, peaceful relay state, GLB lifecycle/LOD/resource budgets and matching weapon kits. These are code/physics/offline-render checks; browser acceptance is tracked separately from these automated checks.

## Weapon-origin height safety

Strike payloads explicitly distinguish feet origins (`losOffset:1`, the default) from real muzzle/katana sockets (`losOffset:0` plus finite `casterFeetY`). Socket coordinates are never moved or raised to fix collision. The independent caster-feet height enforces the original2.6m floor-to-floor hit band, so a high weapon cannot hit an otherwise unreachable raised platform. Invalid offsets or socket metadata missing its floor reference fail closed. Blackbeard/Musashi forward their actual event socket; current Saber and mounted-charge root fallbacks truthfully remain feet-origin. Real low-wall BVH tests reproduce and block the former double-height ray.
