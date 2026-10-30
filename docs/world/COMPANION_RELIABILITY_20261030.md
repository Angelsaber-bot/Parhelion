# Companion combat, following and enemy-state repairs

Increment over `6dd4a2051397316cd0ebfa385756815435de3ada`. World only; no Arena or map-layout changes.

## Confirmed problems and repairs

- Blackbeard's configured 12 m acquisition was incorrectly clamped to the generic 5 m melee query. Explicit ranged queries now have their own bounded range. Read-only tracking never spends the shared ally damage cooldown.
- A blocked nearest enemy could monopolize acquisition. Selection now checks the actual companion's height and line of sight and continues looking for another valid nearby target. Melee companions approach, turn and track during early anticipation; the last contact window remains committed and still checks the same live target, range, facing and cover.
- Skills previously copied the player's heading even when the caster stood on the other side of the target. A visible, same-floor hostile near player aim is now selected, and the skill is aimed from the actual caster. This is a snapshot, not homing or guaranteed damage through cover.
- Napoleon's skill could complete after his root passed the target by a few centimetres, placing it behind the forward-only skill corridor. Skill staging now includes a 0.35 m contact lead on the real collision-checked route. The actual authored contact, target and hit origin are retained. Cancelling a mounted skill recovers in place rather than treating the actor as newly summoned.
- Foot followers use bounded local obstacle steering and supported regroup slots. Normal sustained following has a 14 m separation threshold with a short delay; combat retains its longer leash. Failed return attempts back off. Narrow bridges can use a safe centreline slot; unsupported gaps and low ceilings are rejected. Horse-sized checks remain distinct.
- Twenty seconds of actual 9 m/s Player sprint with a 90° turn on a controlled runway remain bounded to about 15.2–15.4 m for all four rigs. This uses four safe regroup placements in that stress scenario, not a claim that a 6 m/s authored gait can continuously outrun the player. An in-game status confirms regrouping without repeated global toasts.
- Ordinary enemies hit from 35–82 m no longer instantly regain full HP on a leash return. Damage remains until genuine despawn/death/respawn. The pursuit radius was not expanded.
- Enemy HP bars now respect depth. Story-pacified enemies have a distinct peace marker and no hostile HP bar. Inactive bosses remain hidden and cannot be damaged before activation.

## Skills visibly differ without falsifying contacts

Q/X use short role-specific anticipation, release and recovery time maps over the delivered clips. These are not newly hand-authored GLB animations. Saber holds a raised sword for X; Blackbeard has aimed/volley timing; Musashi has distinct chained-cut timing. Original event socket poses and ordinary attack timing are preserved.

Each servant's Q/X also has a separate open effect silhouette matched to the actual adjudicated corridor, and release audio distinct from ordinary attacks. Hit feedback is emitted only for real positive HP damage. The fixed pool has 54 resident meshes, 18 maximum visible draws, ten shared geometries totalling 48,384 bytes, no lights/textures and no activation-time GPU allocations. Reduced flashing remains supported.

Controlled production-DOM tests record damage source separately: Saber Q/X 46/138, Blackbeard 51/144, Napoleon 56/155, Musashi 56/156, including every expected pulse. Tests use explicit synthetic recruitment/placement and full ultimate energy to isolate contact correctness; they are not a natural progression or human-play acceptance.

## Performance and limits

A zero-length line-of-sight query at a target's own position caused a degenerate BVH ray, approximately 55 ms per call in the measured cloud scene. Empty segments now bypass BVH safely, invalid endpoints are rejected, and normal finite-range queries preserve their collision semantics. [Detailed CPU evidence](validation/COMPANION_CPU_20261030.md) distinguishes this defect from GPU/FPS claims.

Navigation uses conservative cached bounds and finite rays, retaining live collider enable state, foot support and headroom. Caches assume the existing immutable world-space BVHs; replacing a BVH is supported, but future in-place refits require invalidation.

Final aggregate validation passed: World **931/931 on Node 22.22.2 and Node 24.22.1**, Arena **322/322**, site **13/13**, whole-site build and typechecks. Local build ID: `5ace34711324`. See [validation metadata](validation/companion-final-validation-20261030.json) and the [989-file source manifest](validation/companion-source-manifest-20261030.sha256). Runtime and tests were unchanged throughout the clean final run. Actual browser GPU appearance, device FPS and desktop synchronization are not established by these cloud checks. This revision must not be described as already public before an approved push and verified deployment.
