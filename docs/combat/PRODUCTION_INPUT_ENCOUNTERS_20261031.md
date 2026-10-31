# Production-input encounter evidence — 2026-10-31

## Evidence boundaries

`world/validation/combat-review/run-story-input.ts` boots the real production main through the established non-GPU DOM fixture. It uses actual mouse movement/fire and keyboard movement/melee/skill/ultimate events, actual native asset loading, collision geometry, weapon heat/cooldowns, hostile HP, damage/energy accounting and encounter victory callbacks. It never writes hostile HP/positions/attack clocks, grants charge, heals the player or bypasses collision while fighting.

The setup is explicit: a migrated v1 save contains the armory flag; travel/dialogue/quest prerequisites are skipped by teleporting to each field entry and requesting the typed director spec. This older standalone matrix also sets the entry grounded flag once after teleport; it never forces grounding during combat. The later reusable helper and combined journey QA use real settling instead. Winter's second wave starts without a new travel teleport. This is **combat-policy evidence, not a complete campaign playthrough**, human playtest, browser/GPU recording, or FPS measurement. Story/interactions/save-flow tests that inject lethal damage remain separate. `story-ultimate-contact-dom.test.ts` separately uses fixture charge 100 to isolate native ultimate compatibility; it does not claim earned charge.

The controller samples target position every 150 ms, waits 300 ms to acquire a new target, caps yaw/pitch turn rate at 4.2/3 rad/s, adds 0.018 rad aiming sway and periodic 0.10 rad misses, and uses the specified tell-reaction delay before strafing. These are reproducible imperfect input assumptions, not an assertion that all humans aim this way. Input is released during cinematics and deliberately pressed again afterward, matching production input ownership.

All trials begin at 0 energy; pressing the ultimate before combat leaves energy unchanged. Fresh admission checks pointer lock, cinematic/narrative state and defeat. Every actual victory is counted once; retry generations cannot alias canceled actors, and no live story roster exceeds 3 actors.

## Measured cases

Artifacts: `artifacts/story-input/*.json` (per-frame samples, real shot rays, classification, damage sources) and `artifacts/story-input-final-matrix.log`. Times below cover the combat/control loop, including any ultimate presentation, not field-entry travel or the 45 s cold prelude.

| Case | Policy time | HP | Actual outcome |
|---|---:|---:|---|
| Warden, south entry,300ms reactive strafe |5.08s|100→100|21shots,17hits,264rifle damage |
| Warden, console entry,800ms reaction |4.78s|100→84|19shots,17hits,264rifle damage |
| Warden, close entry,1100ms reaction |4.78s|100→82|19shots,17hits,264rifle damage |
| Warden, close entry,800ms backward dodge |4.78s|100→82|19shots,17hits; backing away stays inside the long thrust lane and takes its18damage |
| Warden with naturally following Saber |5.18s|100→84|46skill+28servant+190rifle damage; no caster placement |
| Courier→harbor→array→Warden combat chain |22.18s|100→68|Four actual victories;59shots;658rifle+90legitimately earned player ultimate damage; no heal/charge grant |
| Winter two waves after cold exposure |7.28s|100→100|330rifle damage across five actors,26shots; warmth9%→0%, then actual keyboard walk to repeater restores100% |
| Warden cancel/retry after real damage |6.73s|100→100|First attempt264→168HP, canceled without victory; new generation starts264HP; only retry victory,360total legitimate damage |
| Warden, stationary behind emitterIII |22.28s|100→0|87shots:79camera-target occlusions,6aim misses,2enemy hits; defeat, no victory |

The stationary case is intentional cover, not hidden invulnerability. EmitterIII's visible post at(-52,-93) intercepts the line from the south entry. The driver separately probes the actual camera→target line and records production camera/muzzle casts. There are 0 unexplained rejected live-target hits. All 87 surface endpoints receive the existing 140 ms impact streak; only 2 enemy damage confirmations occur. Reactive movement opens the corridor; the emitter remains solid.

## Difficulty rationale, not a claim of final balance

The new Warden's264HP is the existing Oath-Knight-sized challenge tier, far below an era boss. It needs 17 normal 16-damage rifle hits, with real heat/vent timing. Its three shapes ask different movement questions: a 7.5 m locked thrust lane with 0.95 m half-width, a 3.5 m close sweep, and a 2.8 m locked impact circle. Phase1 tells are 1.2/1.3/1.4 s; phase2 still advertises at least 1.1 s. Recovery stays at least 1.55 s. Sword contact is 18 damage and burst 16; cover and locked-target escape remain authoritative.

The half-health transition is a damageable 1 s opening, not invulnerability. Existing ×2 melee recovery punishment makes a successful close counter quick; the measured policies show that competent ranged or melee play can win in roughly 4–5 s. That supports an **accessible optional continuation encounter**, not a hard-boss difficulty claim. Slow/wrong positioning can still take damage or lose behind cover. No original enemy, firearm, melee, companion or Arena/network statistics were changed to manufacture these results. Broader human playtesting remains necessary before claiming universal difficulty/fun.

## Reproduce

Run from `world/` after the normal dependencies are installed:

```sh
node --import tsx validation/combat-review/run-story-input.ts false_dawn_warden rifle-reactive .3 south
node --import tsx validation/combat-review/run-story-input.ts false_dawn_warden rifle-static .3 south
node --import tsx validation/combat-review/run-story-input.ts false_dawn_warden rifle-backstep .8 close
node --import tsx validation/combat-review/run-story-input.ts false_dawn_warden companion .5 console
node --import tsx validation/combat-review/run-story-input.ts false_dawn_courier harbor-route .7 south
node --import tsx validation/combat-review/run-story-input.ts false_dawn_winter_1 winter-route .8 south
node --import tsx validation/combat-review/run-story-input.ts false_dawn_warden retry .4 console
node --import tsx --test validation/story-ultimate-contact-dom.test.ts
```

The four companion cinematic ultimates retain reachable-target-before-payment admission. The original manually aimed directional **player** ultimate remains a paid intentional cast/miss, like other aimed attacks; this work does not add auto-targeting or refunds. Insufficient energy, duplicate activation, cancellation and damage ownership remain tested independently.

## Input driver for combined journey QA

`validation/combat-review/story-input-policy.ts` exports `createStoryInputPolicy(host, options)`. Host supplies `{world, window, nowSeconds: () => clockMs / 1000, step: () => normalFrame()}`; it owns the clock, story choices, real navigation, encounter launch and asset settling. `.tick()` only issues one frame's normal configured input events; `.run(maxSeconds)` repeatedly ticks/advances the supplied host; `.release()` releases only the bindings the policy held. Options are `reactionSeconds`, `strafe`, `mode: 'rifle' | 'melee'`, `useSkill`, and `useEarnedUltimate`. Use `strafe:false` when the journey harness owns navigation.

The reusable helper contains no teleport, grounded assignment, encounter start/cancel, HP/charge assignment or direct damage call. It resolves the current binding map and inverted-Y sensitivity, releases during modal/cinematic/visibility pauses, and re-presses after normal play resumes. A production-main smoke test clears a real Warden with remapped fire/right bindings and inverted Y; all entry positioning/admission stays visibly outside the helper. Integrated narrative→combat→physical-emitter→ending results belong to the separate journey test, not this document's earlier field-entry chain.
