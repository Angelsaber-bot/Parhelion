# Bounded lifecycle retention stress

Exact tested product: frozen `27134ed01c2957cb8c0ed82ee41626ec6d3c6467`.
Runner: `world/validation/lifecycle-review/run-long-session.ts` (external newer QA
harness, not misrepresented as part of that frozen aggregate).

## Scope

Twenty measured cycles across four sequential actual-main boots, plus explicit
warmup of every measured region/outfit combination. Five discovered settlement
travel stops and both Saber outfits give ten comparison states. A synthetic
legacy save supplies recruitment, mainline evidence and travel discoveries.
All subsequent travel, pause/resume, recall/summon and outfit selection use
actual DOM/input handlers. No HP, energy, grounding, actor-root or combat-clock
writes. Native GLBs and ordinary physics run; renderer/image upload remain the
explicit CPU fixture adapters.

The first run and an identical-source/seed repeat produce exactly equal parsed
reports. The final strengthened run also checks complete done/found sets,
outfit preference and summon state across each reload, and exact saved sets
against memory before shutdown. Repeating this bounded test is not evidence of
hours of human play.

## Observed bounds

- Matching location/outfit structural scene, geometry, material, texture and DOM
  counts repeat exactly after warmup. Counts legitimately differ by outfit and
  region; there is no unjustified single global-node constant.
- Connected DOM listener count remains **231**, including **20 pagehide**
  listeners. This is a read-only census using the pinned JSDOM implementation;
  it does not prove reachability/collection of all detached objects or a real
  browser heap.
- Warden contact cue pool stays **3 slots / 55,296 bytes / 0 active**.
- Each measured travel click calls player teleport exactly once and does not
  heal. Each summon key invokes the real toggle once, never twice.
- Measured outfit replacements produce **780 geometry/material disposal
  observations**, each owned resource exactly once. Old native model roots
  detach. Texture graph counts plateau, but this is not GPU texture/VRAM proof.
- Every measured cycle ends with no narrative/journal/travel modal or active
  cast stuck open. No console errors/warnings. HP remains 100.
- Energy remains zero. Twenty actual ultimate inputs therefore verify only
  insufficient-charge rejection: no cast and no cost. **No paid-ultimate or
  positive damage stress is claimed here.** Paid cast/cancellation and native
  damage are covered by separate recovery and production-combat tests.

## Evidence and limitations

Workspace `qa/lifecycle-20-cycle-27134ed.{json,log}` is the initial run;
`qa/lifecycle-20-cycle-exact-save-27134ed.{json,log}` is its identical replay
(the filename was chosen before the stronger whole-set assertions were added).
`qa/lifecycle-whole-progress-final-27134ed.{json,log}` is the final whole-set
save/reload check. Originals are retained.

No raw heap snapshots were created. These are retained scene/connected-DOM
counts, not post-GC process/native allocation or GPU memory accounting. No FPS,
visual shader equivalence, long-duration human endurance, or paid-ultimate
balance conclusion follows from this bounded lifecycle scenario.
