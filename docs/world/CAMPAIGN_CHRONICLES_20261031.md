# Chronicles of the Way Home — campaign content

These are **original stories for this fan-game adaptation**, not official source-canon scenarios. They deepen the existing campaign through the people keeping its roads usable. They do not replace its accepted progression or require resetting a save.

## Playable sequence

The five hub stories can be undertaken in any order. Every story has an in-person introduction, two physical workstation operations, an explicit planning choice, a main-world outcome to observe, and an in-person conclusion. The original campaign remains playable without them. A completed old campaign satisfies its already-earned world outcomes, **not** the new conversations, work or decisions.

| Hub / resident | New physical work | Plan and visible consequence | Existing world evidence |
|---|---|---|---|
| Valley — Lan, Signal Keeper (`alpha_signal_keeper`) | Ground the receiver, then tune to the repeating return signal rather than the loudest noise | Broadcast directions home / keep a listening watch; receiver-board treatment changes | `relay_a`, `relay_b` |
| Britain — Ada, Oath Witness (`britain_oath_witness`) | Recover the original roll beneath a muster order; preserve unreadable names for verification rather than inventing them | Display names / make room on benches | `sun_core` (the opening Saber pact alone is insufficient) |
| Black Sail — Mara, Tide Watcher (`blacksail_lamplighter`) | Compare cargo against missing crew rations; signal a safe holding line rather than the cold lamp | First returning passage for passengers / provisions | `sea_core`; legacy `blackbeard_contract` also establishes the old victory |
| Winter — Mikhail, Stretcher Bearer (`winter_stretcher_bearer`) | Insulate the underside, then secure the ends clear of the marked wound | Shelter first / rejoin the aid party | All three `beacon_*` flags; a legacy cleared Winter world is accepted |
| Kyoto — Sumi, Copyist (`kyoto_paper_keeper`) | Separate soaked pages at loose edges; weight them with air space rather than heat or tight binding | Drying racks / resting mats, preserving the rescued record either way | All three `kikyo_banner_*` flags; a legacy cleared Kyoto world is accepted |

Wrong workstation approaches receive a resident's explanation before damage is done. They consume no item, warmth, HP or progress; the same stage remains retryable. Correct operations are saved individually, so interruptions do not erase completed work. These are deliberately small authored interactions, not medical training or a physical radio/restoration simulation.

Once all five spoken conclusions are complete, return to the Valley dispatch board. **Five Lights, One Answer** offers a final explicit choice: broadcast the route lessons without private names, or preserve the detailed account for conversations at the residence. The closing scene reflects the actual five saved plans. It does not invent rescue counts, arriving ships, completed battles or NPC pathfinding that was not simulated.

Estimated new-content reading, interactions and hub travel: **15–30 minutes**, depending on travel already discovered and reading pace. This is a design estimate, **not a measured player walkthrough**. Existing main battles and exploration are not included in that estimate.

## Interaction and navigation

- Interact/continue retains the player's existing **F** default; **E / right mouse remain aiming**, not conversation.
- Choices appear only after their paired bilingual pages have been read. Select with arrow or number keys, then confirm with the current Interact binding. No answer is implicitly selected. Clickable choice buttons are also explicit confirmation.
- Closing, leaving focus, changing menus or resetting dismisses unconfirmed choices. A stale callback is revalidated against current episode stage and physical reach by the runtime.
- The pause-menu **Chronicles of the Way Home** journal is read-only. Its initial entries reveal only location, speaker and a short invitation, not the full dialogue. Tracking is opt-in and does not replace the main guide until requested. Restore the main guide at any time.
- Keep the established character-centered, key-points-only minimap: show the deliberately tracked next target rather than flooding it with every workstation and resident.

## Save contract

All new progress uses the existing `WorldProgress.done` Set and existing storage key. No new schema, secret profile or network service:

```
campaign_REGION_met
campaign_REGION_work_step_1
campaign_REGION_worked
campaign_REGION_choice_CHOICE
campaign_REGION_complete
campaign_dispatch_recorded
campaign_dispatch_shared | campaign_dispatch_private
```

Branch IDs are finite: `broadcast/listen`, `names/seats`, `families/supplies`, `shelter/convoy`, `records/refuge`. Work IDs include their stage, so a delayed stage-one action cannot advance stage two. New work never writes original equipment, contract, boss-core or gate flags. Cosmetic unlocks may derive from the saved `campaign_REGION_complete` flag; do not award currency or grant it repeatedly in interaction handlers.

Reset clears the same Sets as before. Old ready or complete worlds remain authoritative. New chronicle tasks are still fresh until the player undertakes them. Finishing a world event does not remotely complete a chronicle: the resident conclusion must still be spoken.

## Ownership / integration

- `campaignEpisodes.ts`: authored bilingual story, pure stage derivation, guarded interaction/choice mutation, optional guide and final dispatch.
- `campaignWorkTasks.ts`: ten authored physical operation decisions and safe retry explanations.
- `campaignSites.ts`: five physical sites, residents, station positions, collision and branch presentation (environment module).
- `narrativePanel.ts`: paired page flow, explicit keyboard/click choice, stale callback disposal.
- `campaignJournal.ts`: read-only localized journal, explicit track callback, focus/escape handling.
- `main.ts`: owns range/LOS/alive/gameplay guards, saving, scene synchronization, menu/input and guide integration.

No handler is a replacement for physical validation. `chooseCampaignEpisode(region, id, done)` must only be called after confirming the player still reaches the same physical source and is eligible to interact. Rejected or stale actions do not mutate progress. Call the same rendering helper for returned choices, including retry results.

## Validation status at first content checkpoint

Passed locally in the cloud workspace:

```
node --import tsx --test validation/campaign-episodes.test.ts \
  validation/campaign-choice-panel.test.ts validation/narrative-panel.test.ts
# 17/17 passing
```

Coverage: all ten branch routes; individual work-stage persistence; rejected/skipped/repeated actions; legacy core/contract-only snapshots; reset; unchanged main boss requirements; unknown IDs; bilingual paired paragraphs; unselected-choice safety; dismissal and stale buttons; callback replacement; journal focus trap/restore; locale switching; final dispatch truthfulness and single recording.

These are state and DOM tests. They are **not** a claim of GPU rendering, device performance or human playtest acceptance. Actual production-main, traversal and render evidence are maintained separately by integration/QA.
