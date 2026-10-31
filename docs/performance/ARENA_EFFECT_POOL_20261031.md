# Arena transient-effect resource reuse — 2026-10-31

Cloud-only presentation prototype. No server events, v8 rules, protocol, simulation, hit authority, loadout slots, controls, offline/LAN routing or weapon statistics are changed.

## Measured CPU resource inventory

The baseline invokes the actual `ArenaScene.tracer`, `impact` and `update` methods without constructing WebGL: 100 nine-pellet bursts, 30 frames between bursts. It created **7,200 distinct Three.js materials and 900 line geometries**, despite only **72 simultaneous effect objects** and zero remaining scene objects after expiry.

The same production-method workload after pooling creates **72 materials and nine line geometries**, with the same peak 72 active objects and zero remaining after expiry. Normal-case saturation is zero. This measures resource identities/allocation churn, **not GPU memory, rendered image equivalence or frame rate**. Evidence is recorded in the private task workspace under `parhelion-eight-hour-evidence/arena-vfx/`.

## Bounded ownership

| Quality | Tracers | Impact sprites | Damage labels |
|---|---:|---:|---:|
| Normal | 96 | 384 | 48 |
| Low | 48 | 192 | 32 |

Resources are allocated lazily, then reused. Inactive objects are detached from the scene. If a burst exceeds a category's ceiling, its oldest cosmetic is recycled; no gameplay event, hit indicator or damage calculation is filtered. Existing lifetimes, colors, opacity progression, sprite growth, debris gravity and label font/placement are retained. Reused tracer geometry recomputes its bounds, avoiding stale frustum culling.

Each damage-label slot exclusively owns one reusable canvas texture. Active labels never share an evictable texture; identical repeated glyph/style skips repaint. Reusing a slot redraws only that slot after replacing its previous cosmetic. A missing 2D canvas is handled as an unavailable cosmetic rather than throwing during hit delivery.

Round/disconnect `clearCombatEffects` removes active effects and retains bounded resources for reuse. Explicit `disposeCombatEffects` disposes each owned material, tracer geometry and label texture once; the shared glow texture and Three.js shared Sprite geometry are borrowed and are not disposed. The pagehide hook skips persisted BFCache navigation.

## Validation

Focused tests exercise the actual Arena scene delegation, 100 normal bursts, 1,000-event saturation in both qualities, long pauses, repeated rounds, texture independence, glyph painting, stale geometry bounds and idempotent teardown. Existing Arena rules/network tests run separately. No browser/WebGL or device-FPS improvement is claimed from these CPU tests.

A separate follow-up makes the existing 60 ms muzzle light's decay time-based: the original multiplier of 0.6 at 60 Hz is preserved, while equal elapsed times at 30/60/144 Hz now produce equal brightness (tested to 1e-12). Duration, source position, starting intensity and event ownership are unchanged; this corrects refresh-rate-dependent presentation rather than adding lighting work.
