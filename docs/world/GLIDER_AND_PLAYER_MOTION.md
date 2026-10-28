# World player: fast glider stow, natural travel, unarmed reset

Local cloud changes, 2026-10-28. No deployment or desktop/browser validation.

## What changed

- Glider opening keeps its existing 7/s damped deployment. Closing now has a finite **0.34 s** travel budget rather than a slow 4/s asymptotic tail. Rifle recovery shares that budget; reopening interrupts the current amount without restarting or permanently scaling the model. The frame is never scaled.
- Landing clears `Player.gliding` in the same collision step. Press-edge toggle, key release/held-key behavior, updraft opening, glide movement, camera, input bindings and combat cadence are unchanged.
- Swimming and unarmed landing release the handles across the close, not in the final disappearing frame.
- Armed walking/running uses a lowered right-hand carry, muzzle down/outside the leading knee, with a relaxed swinging left arm. Idle keeps the existing ready pose. ADS smoothly regains both hands; firing still raises/aligns immediately before querying the actual muzzle, with no invented delay. That immediate shot takeover can intentionally change pose in one input event.
- Only visual gait speed is smoothed on starts/stops; controller displacement and movement response are unchanged. The actual right-hand grip stays attached while carrying; two-palm contact is required during full ADS/fire, **not** during ordinary one-handed travel.
- `PlayerAnimationState.armed?: boolean` defaults to true for compatibility. `false` hides the rifle immediately, ignores stale weapon aim/fire ownership and gives both arms free natural gait while retaining glider use. `anim.reset(armed, facing)` clears old phase, glide, carry, fire, bank and weapon-ready state synchronously. Progression and main-loop wiring are owned by the new-game/reset change.

## Measured close responsiveness

Actual production animator + committed player/Dawn GLBs; 3 s settled glide followed by idle landing or airborne stow. “Rifle contact” means **both anatomical palm sockets within 2 mm of actual grip/support anchors**. These timings apply to idle/airborne recovery, not the deliberately one-handed moving carry.

| Animation rate | Canopy hidden before | Canopy hidden after | Rifle contact before | Rifle contact after |
|---|---:|---:|---:|---:|
| 30 Hz | 1.067 s | 0.367 s | 0.767 s | 0.333 s |
| 60 Hz | 1.050 s | 0.350 s | 0.750 s | 0.317 s |
| 120 Hz | 1.050 s | 0.342 s | 0.742 s | 0.317 s |

The finite 0.34 s close is sampled on render steps, hence the small rate-dependent hide threshold. At 60 Hz, maximum close hand travel is **6.76 cm/frame**, retaining the existing 7 cm regression bound. Unarmed close is **5.89 cm/frame**. A faster 0.28 s trial was rejected because it exceeded the existing smoothness bound.

Raw [baseline metrics](../glider-retraction/before.json), [final metrics](../glider-retraction/after.json), and [focused test output](../glider-retraction/runtime-tests.tap).

## Natural-movement evidence

- Right grip error below 2 mm at 30/60/120 Hz; full ADS and input-event shots restore both grips below 2 mm.
- Free left hand has approximately **23.5 cm** fore/aft stride range.
- Actual muzzle's minimum model-local height is approximately **0.574 m** in sampled walk/run strides; the complete rifle remains above the model-local ground plane. This is not a claim about every terrain slope or grounded foot contact.
- CPU triangle intersections are checked over **48 walk/run pose samples**, against all Dawn meshes and six uniform/harness/trouser/shoe mesh groups. No intersections in the accepted carry. This caught and removed a stock-to-sleeve intersection in an earlier candidate; deliberate hand/grip contact is excluded from clothing clearance checks.
- Repeated moving ADS/start-stop transitions stay within the test's timestep-normalized travel bound; 60 Hz observed maximum is **7.10 cm/frame**. First-shot alignment is separately tested at large free-look yaw and extreme pitch, including a production input event starting in moving carry.

Actual CPU-skinned runtime stills use the original GLB materials, not generated concept art:

The expanded delivery archive contains the before/after walk, running carry, moving ADS, unarmed idle/walk, deployed glider and 167 ms / 350 ms stow stills. These large individual pose PNGs are deliberately not committed; the quantitative metrics, focused test output and exact reproduction scripts above/below remain in this repository.

These are isolated pose reviews with no ground plane, not browser gameplay, live animation smoothness, terrain-foot-contact, WebGL or FPS validation. Before/after use the same model and input duration; visual gait filtering changes phase slightly.

## Verification / reproduction

Focused final run: **34/34 passed**. World typecheck and `git diff --check` passed. Aggregate World/build results are tracked by the independent round QA; this focused run is not a substitute for them.

```bash
cd world
node --import tsx --test validation/glider-retraction.test.ts \
  validation/player-natural-movement.test.ts validation/player-skinned.test.ts \
  validation/shooting-free-look.test.ts validation/shooting-integration.test.ts \
  validation/regression.test.ts
npm run typecheck
node --import tsx validation/benchmarks/export-player-motion.ts /tmp/player-poses after
blender -b -t 4 --python validation/benchmarks/render-player-motion.py -- \
  /tmp/player-poses /tmp/player-pose-images
```

Coverage includes same-step landing; toggle/release/held jump; rapid partial open/close reversals; swimming; updraft; debug-flight cancellation; ADS/fire interruption; zero-dt first shots; 30/60/120 Hz; finite transforms; actual unarmed reset/reacquisition; no lingering canopy or scale state. No browser retry or sandbox bypass was attempted: the previously established Chromium process-singleton `EPERM` restriction remains.
