# Valley story interaction prototype — A Light to Return To

This small additive prototype uses the existing Observatory terminal and residence
archivist. It is not a completed five-chapter campaign or a measured 15–20 minute
player experience. No new economic system, escort AI, crowds or world simulation.

## Player flow

1. New players receive one clear Alpha-local objective: meet the archivist outside
   the residence maintenance entrance. The original central entrance remains open.
2. Speaking with the archivist triggers a bounded gesture and opens the secondary
   maintenance gate. This changes the actual collision, not only a message.
3. Activate the existing `hq_terminal`. The new maintenance-frame strips and court
   guidance inlays illuminate. Existing building lamps were already lit; this does
   **not** claim to restore electricity to the entire residence or valley.
4. Return to the archivist for acknowledgment and the existing armory lead. The
   original nine-step Valley progression then resumes. Following a later excursion,
   the archivist can be found inside the court; relocation waits until BOTH positions
   are more than 90 m from the player, avoiding visible teleportation.
5. Optional: use the physical maintenance panel. Before meeting the archivist it
   manually opens the gate; afterward it still independently switches on the green
   passage indicator. It never gates the main quest or grants extra gun damage.

## Persistence and compatibility

`valley_story_met`, `valley_story_resolved`, and `valley_route_note` are ordinary
`WorldProgress.done` flags. The existing `hq_terminal` remains authoritative for
power and `armory_rack` for weapon ownership. No save-schema change is required.
Advanced old saves do not get a new mandatory introduction, lose equipment or invent
terminal completion. Reset clears the added state with the existing progress reset;
controls, language, graphics preferences and other chapters remain untouched.

The normal F interaction binding is reused (and remains remappable). NPC and panel
selection respects distance and line of sight. Paused, unfocused, unlocked, defeated
and free-flight input cannot advance these interactions. Prompts and guidance are
bilingual. Guide coordinates follow the NPC's live position rather than stale sockets.
If browser storage is unavailable, an interaction remains session-local and warns that
progress was not saved.

## Technical scope

- Five added render meshes, below 500 triangles, four materials, no added lights,
  textures, shadow casters or per-frame story-art update.
- Two authored colliders; the optional gate changes its own collision only.
- Reuses one of the existing twelve residents; no new NPC population.
- Existing armory, chapter gates, combat, bosses, saves and Arena rules are preserved.
- Base includes the newer Arena/automatic deployment commits. Do not overwrite them.

## Verification

Tests exercise real Alpha GLB and installed settlement collision with Player movement:
closed secondary gate blocks passage, opening it allows traversal, and the original
central entrance stays available. Automated state/runtime checks cover meeting,
terminal power, acknowledgment, manual-first discovery, repeated actions, blocked
interaction, reload, reset, older saves and other-chapter guide isolation.

Offline before/after art is generated from actual kit/story/NPC geometry, with a local
terrain crop and neutral Blender lighting. It omits surrounding objects and depicts
NPC relocation on a later return. It is NOT a browser screenshot or GPU/FPS validation.
Actual browser feel, player motivation and frame-rate acceptance remain unverified.

## Release boundary

Current main now automatically runs a deployment workflow on qualifying pushes. It
can deploy Arena Worker and Pages when configured secrets exist. The user reports the
Mac auto-sync agent is installed; a main push can also trigger its fast-forward/rebuild.
Treat publication as the combined release, not merely remote source storage. This
prototype itself has not been pushed or deployed at the time of packaging.
