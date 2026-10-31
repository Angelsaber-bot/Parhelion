# False Dawn / 伪晓回声 — original campaign continuation

**Original fan-game story, not an official source-canon scenario.** Dialogue is authored text/captions, not a promise of recorded voice acting. This continuation extends the inhabited hub stories with an escalating investigation and action sequence; it does not replace the original four era campaigns.

## Three acts

1. **A voice too early.** After repairing Lan's receiver (only its two work operations, not all five chronicles), inspect the abandoned field receiver in the Valley. The distress recording appears to answer before the player speaks. Intercept its courier and recover two possible relay traces. Original armory equipment is required; this does not grant weapons for free.
2. **A real answer takes time.** Choose one route, not both:
   - **Harbor interception:** use the tide station's cover against the ranged/interception group, then distinguish the delayed return signal from a perfect recording.
   - **Snowfield defense:** deliberately connect and defend two repeater stages. The second wave does not spawn until the player confirms it. Read the surviving return cadence afterwards.
   The choice is saved and the other route is not falsely marked complete. Main-story seams still require the existing summoning-circle progression. No new lead unlocks an old gate.
3. **Cut the route, not the voice.** Return to the Valley array. Start its defenders, then physically disable **I Receive → II Relay → III Transmit**. Switches remain usable during the encounter and do not open a modal or pause combat. Once both the three switches and the actual defenders are resolved, the console can expose the **Echo Warden**. Its identity comes from readable alternating thrust/sweep behavior and the arena sequence, not an inflated HP pool. After victory, explicitly choose whether to repurpose the de-copied channel for real rescue responses or seal the copying device.

Actual nearby, summoned companions can add short contextual text reactions. The runtime must check their real presence; the content function does not summon or pretend they are present. Saber emphasizes accountable promises, Blackbeard practical seafaring judgment, Napoleon timing and held ground, and Musashi reading spacing and recovery. All lines are original adaptation writing.

## Physical identifiers

| Object | ID |
|---|---|
| Valley field recorder | `false_dawn_recorder` |
| Harbor tide station | `false_dawn_harbor_console` |
| Snowfield repeater | `false_dawn_winter_console` |
| Valley array console | `false_dawn_array_console` |
| Ordered emitter switches | `false_dawn_emitter_1`, `_2`, `_3` |

Encounter IDs: `false_dawn_courier`, `false_dawn_harbor`, `false_dawn_winter_1`, `false_dawn_winter_2`, `false_dawn_array`, `false_dawn_warden`.

Environment placement is authored and collision-audited in `falseDawnSites.ts`. Combat reserves at most three live mission actors and does not grow the overworld population with dormant copies. No story mutation is permission to bypass safe spawn, player range, active-boss, defeat or hostile-pressure checks.

## Failure, interruption and save rules

- **Opening or dismissing a launch choice:** no encounter-start flag and no implicit start. The physical runtime must accept the complete bounded spawn first.
- **Blocked/unsafe spawn:** no start flag. Clear the immediate problem and deliberately retry the same console; a failed attempt does not skip ahead or consume a reward.
- **Leaving the encounter leash or being defeated:** the runtime cancels the unfinished encounter, **not** a victory. The current stage remains incomplete; return to the same console and restart it.
- **Reload while an encounter is unfinished:** live enemies, HP and action timers are not restored. Completed investigation/route flags remain; restart the current unfinished encounter.
- **Partial array switches:** each accepted switch has its own saved flag. A completed I switch remains completed after leaving, defeat or reload. Unfinished II/III switches remain blocked while the array fight is dormant; restart at the array console first. During an active array fight the guide points to the next ordered switch.
- **Defenders beaten before all switches:** the actual victory remains saved. Finish the remaining switches in order without inventing another victory. The Warden remains unavailable until both conditions are satisfied.
- **Warden defeated before final decision:** victory remains saved. The console offers the ending, not another compulsory Warden fight.
- **Reset:** all continuation flags are in the existing progress Sets and are cleared with the original reset. Delayed old callbacks cannot resurrect them because both accepted-start and expected-stage validation fail.
- **Repeated interaction, duplicate victory, alternate ending callback:** no duplicate clear, reward or second ending. The unchosen route remains uncompleted.

The guide takes optional live encounter context: `getFalseDawnGuide(done, {activeEncounter: combat.storyEncounter?.id})`. Without the active array encounter, unfinished-defense guidance points to the **retry console**, not an unusable switch. The journal is read-only and tracking remains an explicit action. Only the currently selected next target belongs on the key-points-only minimap.

## Runtime transaction contract

1. Validate real physical origin, line of sight, range, grounded/alive/focused interaction state.
2. `interactFalseDawn(origin, done, context)` or `chooseFalseDawn(origin, choiceId, done, context)` produces a result.
3. If `result.encounter` exists, ask the combat director to start its authored spec. Only on success call `confirmFalseDawnEncounterStart(id, done)` and save/apply.
4. When the director reports actual victory, call `recordFalseDawnEncounterVictory(id, done)`. It validates the expected encounter and its saved accepted-start flag before recording the clear.
5. Save and synchronize changed results. `toast` is non-modal; **do not route emitter results through the narrative panel**. Normal `dialogue` may use explicit choices and paired pages.
6. Reset/import must recompute scene state and cancel stale live director state as the integration specifies.

No state helper writes storage by itself. Combat acceptance, lifecycle, visual effects and world synchronization belong to the runtime.

## Validation checkpoint

First pure/state/UI content checkpoint: **27/27 selected tests pass**, including eight False Dawn tests covering all four route×ending combinations, rejected/stale origins and encounters, failed launch, dormant-switch protection, partial-save recovery, early defender victory, reset, companion text and unchanged original gates. The other tests cover resident chronicles and shared dialogue/journal behavior.

This is not yet end-to-end GPU or real-device gameplay evidence. Independent QA is assigned actual-production-main walkthroughs for the four route×ending combinations, plus defeat/leave/load and input interruption. Results and remaining limits should be appended after those tests, not inferred from these state tests.

### Integration evidence after the first checkpoint

- Frozen integration source **`97df676`**: independent non-GPU production-main matrix passed **5/5**, covering all four route×ending pairs with explicit keyboard selection and confirmation. The test also covers no implicit F choice, number-key selection, leave/leash cancellation, deliberate restart, rejected emitter order, partial saved switch progress and ending persistence/replay. Evidence: `parhelion-eight-hour-evidence/qa/checkpoint-97df676/independent-route-matrix.log` (sibling evidence workspace).
- This matrix teleports between locations and injects lethal damage to isolate real director-to-save progression. It **does not establish encounter balance, real traversal duration, rendering or device FPS**. Separate actual-input combat/traversal checks remain required.
- Content checkpoint **`8033848`**: 41/41 selected narrative, guide, journal, panel and existing story-copy tests pass. Added compact objective lines for every continuation stage (English ≤100 characters); route-aware resident guidance follows the original live prerequisite rather than pointing through a locked boss passage. Evidence: `parhelion-eight-hour-evidence/narrative/checkpoint-8033848-content-tests.log`.
- Offline CPU renders of actual scene geometry were visually reviewed for the recorder/console distinction, numbered emitter readability and the visible Winter brazier. These are geometry-review images, not WebGL screenshots. Remote resolved indicators now respect the chosen route; they do not claim that the unchosen encounter was defeated.

### Separate production-input combat evidence

Combat checkpoint **`fcf99f0`** adds `world/validation/combat-review/run-story-input.ts`; its explicit setup and measured policy are documented in [Production-input encounter evidence](../combat/PRODUCTION_INPUT_ENCOUNTERS_20261031.md). The log `artifacts/story-input-final-matrix.log` records a courier → harbor → array → Warden chain with four actual victories, zero starting energy, a legitimately earned player ultimate, and HP 100→68 without healing or hostile damage injection. The Winter case records both actual wave victories and keyboard movement into the repeater warmth zone, restoring observed warmth from 0% to 100%. A separate stationary cover case loses, with the visible emitter post—not hidden invulnerability—blocking shots.

These runs deliberately skip travel, dialogue and emitter interaction progression by field-entry teleport and direct typed encounter setup. They therefore establish **production combat/input and collision behavior under a reproducible controller**, not a human difficulty judgment or one continuous campaign walkthrough. They must not be combined with the injected-damage story matrix above and advertised as a single end-to-end, GPU-rendered playthrough. Recorded combat-policy seconds are not campaign playtime. Current short Warden instructions describe thrust, sweep and recovery; the visual brace is not an invulnerability promise.

### Later combined input journey and dry-route correction

Checkpoint **`ffe199c`** adds a stronger, separate returning-player journey: [actual-input journey QA](FALSE_DAWN_INPUT_JOURNEY_QA_20261031.md), reproduced with `world/validation/journey-review/run-false-dawn.ts winter seal --walk-links --dry-alpha`. This run uses actual keyboard dialogue choices, normal combat inputs, physical emitter interactions, legitimate fast-travel UI and walked settlement links through the saved seal ending. It does not write hostile HP, inject damage, force grounding or directly start encounters. Both walked links record zero swimming frames. Its explicit legacy prerequisites and **one initial recorder positioning** remain setup; this is not a fresh-save, human or GPU walkthrough, and its synthetic time is not advertised playtime.

The original **西岸渡口 / West Ford** bridge supplies the dry Alpha approach: cross it, then follow the west bank north. An earlier straight-bearing route swam through the low crossing; the bridge was missed by a conservative search's height ceiling, not absent from the map. No terrain or bridge repair was required. Entry dialogue and the first objective now name this route; retries already at the array still direct the player to the recorder rather than back over the bridge.
