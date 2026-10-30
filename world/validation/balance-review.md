# World combat balance review — 2026-10-30

## What this measures (and does not)

`balance-scenarios.ts` executes the actual `WorldCombatState`, `WorldActions`, `ContractSkills`, melee/evade clocks, damage falloff, rifle heat/vent, enemy attack footprints, authored kit event schedules, and strike selection. Timing matches the production clock split: actions/movement at 1/120 s, enemy AI/terrain at 1/20 s, and held-fire attempts/companion presentation contacts at 1/60 s. The final partial evade step is weighted so displacement is exactly 13 × .24 = 3.12 m. Flat supported arena, perfect aim, immediate state-informed decisions, no obstacles. Walking/sprinting use the production 5.5/9 m/s values; evade displacement is 13 m/s for its actual duration. Contact origins and directions remain snapshotted during companion casts.

The companion scheduler uses the published clip event timestamps but does **not** model its approach path, target acquisition or turning; those have separate real-GLB and mounted-collision tests in `skill-poses.test.ts`. A simulated cavalry hit assumes an available safe charge route. This is an ideal-input diagnostic, **not** a human playtest, a visual acceptance test, or evidence of measured FPS. Perfect policy success shows an available counter, not that ordinary players will execute it reliably.

Run:

```sh
node --import tsx --test validation/balance-scenarios.test.ts
node --import tsx --input-type=module -e "import {BALANCE_SCENARIOS,runScenario} from './validation/balance-scenarios.ts'; console.log(JSON.stringify(BALANCE_SCENARIOS.map(x=>runScenario({...x,companionGun:true})),null,2))"
```

`balance-review.json` records the final scenario outputs. No random seed or external service is involved.

## Reproduced systemic problems and changes

1. **Ranged boss loop stopped after its first attack.** An `attackCount % 2` acquisition condition made the second attack require close range. A faster circling player could keep the boss chasing forever. Before repair, a 6 m/s diagnostic circle killed all four bosses in 16.82 s with zero damage and only one enemy attack. Ranged attacks can now start on every count, retaining full windup/recovery and locked, avoidable impact locations—not an artificial pursuit-speed buff.
2. **Rifle sustained DPS crowded out melee.** 16 damage / .14 s was about 114 theoretical DPS indefinitely. Real state now vents for 1.1 s after eight shots (with a visible heat/vent readout). Sustained throughput is roughly 61–62 DPS with continuous-fire cooldown remainder retained; isolated first-target shots remain responsive.
3. **King recovery could not cover retreat-and-return travel plus an authored melee contact.** Recovery increased from 1/.65 s to 1.4/1.1 s. Perfectly timed physical roll-through gives much better uptime than running entirely out and back. This distinction is intentional, but the longer tells still permit a conservative retreat counter.
4. **Earned melee punishment was under-rewarded.** With final visible-blade ranges 1.45/1.50/1.55 m, perfect roll-and-punish melee took 38.65–43.67 s, versus 30.42 s for reactive gun kiting. Actual melee damage during a natural recovery now earns 2×, versus 1.35× before. Forced stagger is excluded, so players cannot manufacture a permanent double-damage loop. Base combo damage stays 30/34/48; enemy HP was not inflated.
5. **Companion casts locked an independent player's gun and evade.** Blackbeard's normal three-contact montage spent 4.2 s dealing just 51 total damage while the player's gun was blocked. The normal skill is now one authored 51-damage Breach Shot; his ultimate retains the three-contact broadside. Summoned companion casts no longer prevent player gunfire or evade. The player's own uncontracted pulse still occupies the player action.
6. **Lifetime per-enemy energy cap blocked single-boss ultimates.** The former 60-energy cap made a fresh lone boss unable to fill a 100-energy meter. The lifetime ID cap was removed entirely: it would otherwise freeze the meter again after one ultimate or a legitimate rematch. The bounded 12-energy/s token bucket and 100-energy meter remain, with no growing per-enemy map. Regression tests prove actual boss HP can refill a second ultimate while its cooldown still blocks early release. Death/reset clears charge; cancellation/travel cannot refund resources or cooldowns. Only verified hostile HP loss from player rifle/melee generates energy, never skill/ultimate/servant damage or quest dummy hits.

## Final measured examples

Times below are to victory, except explicitly marked death. Damage is cumulative damage received; all policies use actual hit windows.

| Scenario | Time | Damage received | Boss attacks |
|---|---:|---:|---:|
| King, stationary rifle | Death at 12.10 s | 100 | 4 |
| King, walking-only circle | Death at 24.55 s | 100 | 9 |
| King, sprint when impact is telegraphed | 29.72 s | 0 | 11 |
| King, blind melee spam | Death at 12.75 s | 100 | 4 |
| King, timed roll-through + recovery melee | 31.13 s | 0 | 11 |
| Admiral, reactive rifle / timed melee | 29.72 / 35.13 s | 0 / 0 | 9 / 11 |
| Warden, reactive rifle / timed melee | 29.72 / 32.67 s | 0 / 0 | 9 / 10 |
| Hellfire Lord, reactive rifle / timed melee | 29.72 / 29.00 s | 0 / 0 | 9 / 11 |
| Four-role pack, kiting rifle | 4.82 s | 0 | — |
| Four-role pack, timed melee | 5.97 s | 20 | — |

All four bosses enter phase two and continue attacking. A walking circle alone fails against the larger phase-two King impact; reacting with sprint or timing evade is sufficient. Retreating straight backwards is the wrong counter for a locked linear thrust: that policy dies against Warden/Lord, whereas actual timed evade succeeds. Blind proximity spam also dies, so this is not a damage-only race.

With independent gunfire plus actual timed companion contacts, all four identity policies beat the King: Saber 25.07 s, Blackbeard 24.57 s, Napoleon 24.42 s, Musashi 26.47 s. First ultimate is earned from real HP damage at approximately 8.67–9.40 s, not prefilled. Every ultimate actually connects in the test. Those figures intentionally do not include companion navigation delays.

## Remaining judgement and limitations

- Melee now competes with rifle against bosses when the player earns recovery hits, but it is not universally best. Split mixed-role packs still favor ranged spacing; melee gains nearby cleave and normal-enemy windup interruption. No claim is made that every encounter needs identical times.
- Conservative full retreat is safe but slow against King/Admiral (about 93/73 s). The learned timing counter is much faster. Human testing should check whether this opportunity is legible enough; the simulation cannot establish that.
- Ideal aim, immediate telegraph recognition, and an unobstructed arena substantially favor all tested policies. Terrain, off-axis targets, camera/readability and human mistakes require browser playtesting.
- The tests guard structural properties (continued attacks, attainable ultimate, real HP limits, no forced damage for a correct counter), not exact TTK numbers. Future tuning should rerun the JSON report rather than preserving a brittle exact-time target.


## Frame-rate fairness follow-up

`action-frame-audit.ts` extracts the actual timing/movement prefix from `main.ts` and executes it with real `Player` capsule movement and `WorldActions`, rather than assuming equivalent input ordering. Before correction, the same evade at 27/30/60/120 FPS traveled 2.8167/3.0333/3.0333/2.9250 m, with 108.33/133.33/133.33/125 ms of sampled immunity.

After fixed-step input snapshots, fractional final-step strength, and epsilon-safe accumulator stepping, all four display rates produce **3.120000 m**, **240 ms movement budget**, **141.667 ms sampled iframe** (17 physics ticks), and the same two protected20Hz enemy-impact samples. The 1.667 ms immunity quantization is uniform across frame rates.

`WorldCombat.simulate` is called at120Hz but retains a20Hz accumulator: one simulated second is exactly20 AI/LOS updates, not120. `present` alone handles model/LOD work, DOM, and effects once per render. Continuous rifle cooldown carries short render overrun without banking idle shots; all four frame rates produce40 shots/10s and232 shots/60s. The visible first vent is1.111s at27FPS and1.100s at30/60/120FPS, within one display-frame sampling interval. Paused casts cancel pending/authored contacts and guard without refunding or advancing their cooldown, verified at each frame rate. Boss targets remain locked through sidestepping.

The final table/JSON above were regenerated after this correction. These timing corrections slightly change TTK but do not change the conclusions: reactive ranged and learned melee both complete fights; stationary/blind policies fail; real ultimates are attainable; AI query frequency is not increased sixfold.
