# False Dawn encounter authority

`WorldCombat.startStoryEncounter(spec, {position, playable})` admits a physical story encounter only after fresh caller gameplay/position checks plus local validation. Narrative owns the pure encounter catalog and persistent stage flags; combat never grants arbitrary stage/reward flags. At most three transient actors share the existing enemy ray/strike/companion/damage pipeline. They do not add a permanently active wilderness population.

Admission is atomic: namespace, role, title, finite coordinates, bounded offsets, player distance/height, boss/other encounter conflicts, nearby actual hostile pressure, terrain and clearance all pass before actors appear. A separate `safeStorySpawn` exempts only the new `false_dawn_*` interaction markers from the random-wilderness marker exclusion. All original marker, hub, water, slope, roof, edge and clearance rules remain intact; ordinary `safeSpawn` behavior is unchanged.

Each attempt has new actor IDs, so a stale companion/strike target cannot hit the retry's actor. Cancellation/reset/death/leash are never victories. Only actual final hostile defeat yields one encounter-completion callback; paused presentation cannot advance a mission. Native asset templates are shared, but canceled old roots cannot resurrect when pending loads finish. Per-attempt roots/tells/materials/geometries/textures are cleaned up; role-label caching remains world-owned and bounded.

## Echo Warden

The new, explicitly named pattern has 264 HP (existing Oath Knight elite tier), not the 1800 HP era-boss budget. Its three shapes are a close sweep, narrow fixed thrust lane and locked distant impact. Tells are 1.1–1.4 seconds; recoveries 1.55–1.8 seconds. The single half-health stance break gives a one-second, damageable melee punish window. No hidden invulnerability, healing phase, arbitrary caller-stat overrides or changes to old enemies.

Ideal uninterrupted offense simulation (player damage disabled only to isolate attack timing; **not** observed playtest TTK):

| Input | Time | Contacts | Enemy attacks begun |
|---|---:|---:|---:|
| Existing rifle burst/vent | 4.20 s | 17 shots | 2 |
| Rifle + existing 14 damage / 1.1 s companion assist | 2.95 s | 15 shots + 2 assists | 2 |
| Actual `PlayerMelee` combo contact clock | 4.008 s | 7 melee contacts | 3 |

Both phases of all three attacks allow a 5.5 m/s walking dodge after a 0.3 s reaction delay. Cover blocks contact. A stationary exposed target receives exactly one bounded hit, never lingering damage.

## Verification

179 focused combat/boss/enemy/story tests passed, including actual-main DOM execution of both False Dawn routes. Dedicated ownership tests repeat 30 start/cancel/retry cycles, reject stale IDs, and complete an asynchronous old-model load after cancellation and same-encounter restart. These are deterministic/CPU/DOM checks, not a browser render or balanced full real-time playthrough. Root integration owns the final aggregate check and main narrative flow.

## Echo Warden identity (05:55 UTC)

The new Warden alone receives three back-mounted signal vanes attached to the native chest rig. They are decorative, not targetable weak points: no collision meshes, point lights, stats, native material changes or independent animation clocks. Half-health stance break opens their silhouette and switches cyan inlay to amber; an active tell adds a small constant emissive edge. Ordinary guards retain their original appearance.

Budget: six opaque meshes, 72 added triangles, two shared BoxGeometries (1,680 attribute/index bytes) and two private materials, released synchronously and once on death, cancel, LOD replacement or world disposal. Pure paused-repeat, original-resource identity and exact disposal tests pass. Actual runtime CPU snapshots are `artifacts/warden-visual-v2-renders/echo-warden-phase{1,2}-*.png`; first floating-looking placement was lowered to the shoulder/back before acceptance. These are offline CPU images, not browser/GPU evidence.
