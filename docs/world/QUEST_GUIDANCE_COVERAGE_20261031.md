# Unified quest guidance — scoped coverage and authority

## Entry and ownership

The new pause-menu **任务指引 · 主线、支线与探索 / Quest guide · Main, side & exploration** opens a read-only browser. Region/type filters and “show completed” do not pin anything. Selecting **Track next step** creates one explicit active target. **Restore current main-story guidance**, including the configured main-route key, clears that pin. The existing **Story progress** panel remains the authority for False Dawn and five resident chronicles; a visible button links to it, without duplicating decisions or progress.

`questGuideCatalog.ts` projects existing flags; `questJournal.ts` owns accessible UI; `main.ts` owns physical markers, active HUD/minimap/beam, gate checks, input suspension and lifetime. No save key, mission mutation, enemy spawn, reward or new travel permission is introduced.

## Coverage audit

| Existing content | Menu coverage | Completion and next-step authority |
|---|---|---|
| Valley original main route | Main / Valley | Existing archivist introduction where applicable, then original objective steps; advanced old saves are not forced back into the introduction |
| Britain, Black Sail, Winter, Kyoto main stories | Main / corresponding region | `getEraStoryGuide`; actual current boss prerequisites and legacy post-core contracts, not obsolete optional-shard gates |
| Residence archivist | Side / Valley | Existing meet → terminal → report flow; existing legacy skip retained |
| Maintenance side-door latch | Side / Valley | Existing `valley_route_note` **done** flag, not a fabricated discovery |
| Memorial, harbor return signal, aid stove, inn route lantern | Side / corresponding region | Existing four `ERA_OPTIONALS` flags; completed services do not receive invented new tasks |
| Oathless Knight | Side / Britain | Restore memorial first; then actual knight target; only `era_britain_knight_defeated` completes it |
| Original optional fragment/treasure chains | Side / corresponding region | 12 authored chains: 3 Britain, 3 Black Sail, 3 Winter, 3 Kyoto; next real flag, with recursive marker prerequisites |
| Lights Connected epilogue | Side / Valley | Four actual resolved cores first, then Observatory terminal; no false “ready” terminal target |
| Every original authored discovery marker | Discoveries / corresponding region | **found** Set, not done/proximity prediction; target explains entering the real discovery radius |
| Five resident chronicles and optional dispatch | Existing Story progress via explicit link | Existing tested stage/choice/work/report/dispatch APIs unchanged |
| False Dawn continuation | Existing Story progress via explicit link | Existing tested branch/encounter/switch/ending APIs unchanged |

Ambient scenery, doors without a task, every flavor-only NPC conversation, and repeated services are not invented as additional completion checklists. Discoveries are shown in the selected filter; merely opening the menu does not add all their markers to the minimap.

## Actionability safeguards

- Each guide resolves an actual marker/NPC/enemy position and gives a current action plus target label. Missing/cyclic references fail closed as unavailable; they are never guessed coordinates.
- Optional fragment prerequisites redirect to the first unfinished real prerequisite; a legacy collected reward is authoritative even when old setup flags are absent.
- Shooting objectives first direct unequipped players to the original armory. Ghost boats direct an unmounted player to the **fort cannon**, never ask them to swim to boats or shoot them with a rifle. Once mounted, the current boat becomes the target.
- Cross-era tracking follows the existing summoning-circle gate check. A blocked card explains the prerequisite; restoring the current original main guide remains available. No unlock is written by the catalog/menu.
- Distances are explicitly **straight-line**, not a traversable-path promise. Existing beams and key-point minimap remain single-target. The original tower climb, dry West Ford route, and current navigation boundaries are unchanged.
- Progress updates recompute the guide; arriving at its marker is not task completion. Reset/import and old-save semantics remain with existing runtime/save owners.

## UI and evidence boundary

The panel is scrollable, wraps long text, has labeled filters, a modal role, Escape close and keyboard Tab containment. Locale refresh retains an owned track-button focus. Detached buttons from an old render/open cannot pin; callbacks revalidate current facts and gate eligibility. An unsuccessful pin keeps the panel open. Opening the resident-story link closes this panel before opening the existing one.

Focused pure tests use all five shipped merged layouts, finite targets, no mutation, actual era requirements, partial/same-size save changes, cannon mounting, legacy rewards, discovery-vs-done distinction, knight victory, epilogue prerequisites and missing/cyclic targets. UI tests cover locale, stale controls, filter/gate copy, focus return, cancellation and read-only behavior.

`quest-journal-main.test.ts` runs actual production main and DOM with explicit non-GPU rendering. It checks no auto-pin, modal gameplay blocking, gate denial, locale/stale buttons, intentional pin, guide advancement, custom main-route key, existing-story link and graphics-loss refusal. Its progression changes are synthetic saved-fact fixtures, **not a combat/travel playthrough**. Native browser pointer lock, pixel layout and GPU performance are not established by jsdom.
