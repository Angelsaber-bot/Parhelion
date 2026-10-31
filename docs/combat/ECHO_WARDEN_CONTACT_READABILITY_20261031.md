# Echo Warden contact readability — 2026-10-31

## Scope

The optional False Dawn Warden remains the accessible 264 HP miniboss. This change does not alter attack timing, damage, target locks, footprint dimensions, collision, root movement, energy payment or ordinary enemy mechanics.

A Warden-only `attackContact` snapshot carries its story pattern and, for thrust, the accepted length. A bounded presentation pool draws the complete accepted signal footprint **at contact**, including whiffs. It is not a projectile, delayed damage wave, hit confirmation or additional gameplay clock. Enemy hit markers and player hurt feedback still require actual simulation damage.

- Thrust: three narrow ground rails plus a low central signal blade along the existing 7.5 m × 1.9 m lane.
- Sweep: two low rings centered on the immutable attacker origin, within its existing 3.5 m radius.
- Discharge: two low rings centered on the locked target, within its existing 2.8 m radius.
- Ground samples conform to walkable-height surfaces. Conservative corner line-of-sight clipping omits strips behind opaque cover or unsupported/steep ground; ordinary depth testing remains enabled. No wall-through rendering or added lights.
- No expansion, strobing or screen wash. Normal contact fades over 240 ms. Existing reduced-effects preference removes the vertical blade/inner circle, retains lane boundary rails, lowers opacity and fades over 120 ms.
- Three fixed meshes, three fixed materials, 1,536 vertices per slot: 55,296 bytes of position storage. Saturation reuses the next slot, never allocates another mesh. Geometry is rebuilt only at actual contact; ordinary frames only fade visible slots.
- Duplicate sequence suppression, death, cancellation, reset and disposal are covered. A presentation pause freezes lifetime and cannot advance combat.

## Cross-module native-acting correction

Actual-main CPU contact review exposed a silent evidence-path fallback: GLTF objects loaded through the headless host's CJS loader did not pass ESM `instanceof SkinnedMesh` checks. Native-unit tests used one constructor and therefore did not expose it. The browser's single-module path was **not** demonstrated broken.

Checkpoint `6d3551b` uses Three's `isMesh`, `isSkinnedMesh` and `isTexture` brands for enemy calibration and owned-resource teardown. The actual-main regression now verifies all three blade axes on loaded assets, not only isolated native fixtures:

| Actual contact | Blade axis in native root space |
|---|---|
| Thrust | approximately `(0, 0, 1)` |
| Sweep | `(.0194, -.2425, .9700)` |
| Discharge | `(-.1505, -.9835, .1004)` |

It also verifies the native musket contact socket (`z ≈ 1.1063 m`) through the same host. Earlier `live-warden-renders` exports are retained as **superseded native-only pose evidence**, not proof of the full-body acting overlay. Direct native acting tests and their separate posed sheets remain valid.

## Actual temporal/contact evidence

`world/validation/combat-review/export-live-warden.ts` executes production main, AI, BVH, loaded native assets and real HP. Entry positioning and typed encounter admission are explicit fixture setup. The stationary player deliberately neither attacks nor dodges; this is not a balanced human playthrough or complete quest journey.

Actual contact timestamps and HP are unchanged by the visual feature:

| Time | Contact | Player HP |
|---|---|---:|
| 1.5333 s | Thrust | 82 |
| 4.7833 s | Sweep | 64 |
| 8.2833 s | Discharge | 48 |

Corrected detail frames: `artifacts/live-warden-signal-brand-renders/live-warden-{0091,0286,0496}.png`. The detail camera crops part of the footprint; use the supplementary `artifacts/live-warden-signal-wide-renders` frames for complete spatial review. Source snapshots and timestamps are under `artifacts/live-warden-signal-final-contact`.

These are offline Cycles CPU renders of actual mesh snapshots from a fixed review camera, **not WebGL screenshots, gameplay video or FPS evidence**. Native materials are imported; shader-only player outline extrusion and line primitives are explicitly omitted (mesh bolts/flashes are retained). `--contacts` exports only exact contact frames, not a continuous movie. The exporter honors geometry draw ranges, including pooled effects.

A first three-contact observational sample cost approximately 5.8/5.9/3.7 ms CPU and prompted a targeted optimization, not a claim that rare spikes are free. `makeCombatTerrain.contactSurface` now computes a conservative XZ candidate set from **current** BVH bounds for each contact. The box contains the full origin→footprint ray segments and vertical ground rays; Y is unbounded. Casts still check current enabled state. No persistent bounds cache, density reduction or removal of local cover is involved.

Paired actual-world measurement: 30 warm samples per attack after three warmups, alternating baseline/scoped execution order. Every emitted position float matched exactly across all 99 pairs. Local candidates were 1 of 32 world colliders (the combined local collider still contains its props and terrain).

| Contact | Full-world median / p95 ms | Scoped median / p95 ms | Unique ground+cover samples | Vertices |
|---|---:|---:|---:|---:|
| Thrust | 2.476 / 2.960 | .853 / 1.279 | 140 | 456 |
| Sweep | 3.345 / 4.356 | 1.064 / 1.283 | 192 | 576 |
| Discharge | 3.373 / 4.259 | 1.059 / 1.188 | 192 | 576 |

Twelve additional fresh-pool trials per attack measured construction separately: setup medians .040/.038/.033 ms; first-contact medians .820/1.044/1.048 ms and maxima .980/2.086/1.223 ms. “Cold” here means a newly constructed presentation pool, not flushed CPU/JIT/OS caches. Each fresh pool was disposed and its parent checked empty.

Hard work/storage limits are 256 unique ground samples and at most 256 cover casts per contact, 1,536 output vertices per slot, three persistent meshes/materials/geometries and 32 dedup IDs. Current valid profiles use 140 or 192 samples. Temporary sampled points/maps are bounded by those limits; no mesh/material/texture is allocated at emission. The conservative candidate list scales with the existing collider array (32 in this world); it is not capped by silently dropping blockers. These are CPU costs on a shared host, not a device frame-time guarantee. Source: `validation/combat-review/measure-contact-effects.ts`; data: `artifacts/enemy-performance/contact-broadphase.json`. There are no terrain casts between contact emissions. Broader native-presentation microbenchmark source and machine-readable results are `validation/combat-review/measure-enemy-presentation.ts` and `artifacts/enemy-performance/native-presentation.json`; they exclude renderer, GPU, physics and DOM.

## Verification

- `combat-contact-surface.test.ts`: full/scoped exact hit equality for thin/tall blockers, overlapping roofs, ground ceilings, moving/refitted gates and enabled-state toggles.
- `enemy-contact-effects.test.ts`: exact footprint bounds, immutable snapshots, cover, ground conformity, reduced effects, duplicate suppression, fixed-capacity saturation, paused fade and idempotent disposal.
- `story-encounter-view.test.ts`: actual AI windup/contact on a sidestep emits one signal without HP loss or hit confirmation; pause and cancel/death/reset cleanup.
- `enemy-live-acting-dom.test.ts`: actual-main native axes and socket across loader constructor boundaries.
- Existing contact lifecycle, all role timings, Warden phase/dodge/cover, director, normal-input and companion-ultimate compatibility regressions remain separate from this visual feature.

Commands (from `world/`):

```sh
node --import tsx --test validation/enemy-*.test.ts validation/echo-warden*.test.ts validation/story-encounters.test.ts validation/story-encounter-view.test.ts validation/story-input-policy-dom.test.ts validation/story-ultimate-contact-dom.test.ts
node --import tsx validation/combat-review/export-live-warden.ts ../artifacts/live-warden-signal-final-contact --contacts
```

Rendering must use the shared `parhelion-eight-hour-evidence/render_budget.py` admission wrapper, weight 2 for actual-field frames; never launch an unbudgeted render.
