# World upgrade integration — 2026-10-31

This is an in-progress cloud-development checkpoint, not a deployment or a claim that the eight-hour upgrade is complete.

## First playable slice

- Five physical resident chronicles: speak to a named resident, perform two deliberate workstation operations, choose a local plan, and return after the original main-story evidence exists. Old saves retain their original gates, contracts and discoveries; completed old cores do not silently complete the new conversations.
- Open **Way Home Chronicles** from the pause menu to read progress and explicitly track a chronicle. The original main-route control restores normal guidance. Closed era seams remain closed. The minimap retains its existing sparse landmark design and one active target, not a new icon for every resident or workstation.
- Choices have no default answer. Arrow keys or number keys select; the player's custom Interact control confirms. A remapped Interact key takes priority over convenience selection keys. Leaving range, losing focus, dismissing the dialogue or resetting cannot commit a stale choice.
- Five authored workspaces, grounded visual approaches and role-specific resident silhouettes are integrated without replacing old settlement entrances, NPCs, route colliders or task stations.
- Five story-earned weapon finishes are visual only. Settings show unlock conditions. Original damage, weapon ownership, grip anchors, muzzle aim and slots are unchanged. Reset/import can deactivate an unearned finish without deleting its cosmetic preference.
- Save failures now remain visible. Settings offer retry, a local JSON backup, and strict validated restore with explicit confirmation. A failed write does not replace live progress; a newer file selection supersedes an older pending read. Preferences are separate from progress.
- Player movement has grounded recovery/weight transfer and air-pose improvements. Reduced-effects cinematics use calmer staging. Enemy visuals consume actual attack-contact events rather than guessing from recovery mode. See the owning animation and combat notes for their measured tests.

## Bounded runtime changes

The fourteen authored global point-light sources use eight fixed visible light slots with distance-to-influence ranking, stable slot assignments, 20 m selection hysteresis and fades during reassignment. Settlement lamps and isolated cinematic lighting are not pooled. Nearby authored colors/intensities/ranges are preserved. Distant lighting can differ; this is not a pixel-equivalence or device-FPS claim.

Consumed imported `COLLISION` and `MARKERS` scene nodes are detached only after world-space layout and authoritative BVHs are built. No geometry/material disposal is performed by that helper. Numeric-only diagnostics do not retain the detached nodes. Real route, target/reset and all-region anchor checks cover the optimization.

## Validation and boundaries

Focused unit/DOM/capsule tests are run during development; aggregate milestone tests must run against a frozen local git checkpoint. Source changing during a long shared-tree run is reported as integration smoke, not an exact-revision baseline.

CPU scene exports, Blender previews and no-GPU production-DOM tests are **not** screenshots of a verified browser/WebGL playthrough. They cannot establish GPU rendering, actual frame rate, browser pointer-lock permissions or real-device performance. Arena rules, offline/LAN choices, controls and existing progress remain protected by regression suites.

All commits are local. No push, public deployment, credentials, purchases or user-computer work is part of this checkpoint.

## Second playable slice: False Dawn

The pause journal now includes an explicitly tracked continuation. Its lead appears after the Alpha receiver's physical work and requires the original armory equipment. The player investigates a recorder, chooses a harbor interception or two-wave Winter defense, returns for three ordered physical array switches, confronts the Echo Warden, then deliberately chooses an ending. This does not unlock original era seams or replace the original story guide.

Encounter admission uses the player's current physical position and playable state. At most three transient actors are active; only the authoritative director's real victory callback advances encounter flags. Leaving, death, reset and reload do not invent victories. Partial physical array work persists, while unfinished fights must be restarted. The Winter field has a visible ordinary warming brazier, not invisible cold immunity or free health/energy.

Narrative choices revalidate range, line of sight, focus and current quest state. Accepted switches give an immediate sound/toast and scene change without pausing or canceling held movement/attack inputs. Optional companion reactions require the actual summoned nearby companion. Remote guidance rechecks closed seams after each story transition rather than pointing through a locked route.

The actual-main DOM progression tests cover both branches, retry, partial switch persistence, held movement, authoritative victory and save rehydration. Their injected encounter damage verifies integration only; it is **not** a balanced end-to-end combat playthrough. Separate combat timing/fairness tests and physical site-route tests cover their narrower claims. The first frozen checkpoint `2633e8f3245e209b35738213eac4c6aec7067a31` passed 1,227 World tests, 325 Arena tests, 13 site tests, typecheck and the unified build with unchanged tracked source hashes. Later work requires its own frozen regression checkpoint.

### Construction-memory retention

A controlled comparison of frozen `97df676` versus that same source with only two construction-array clears measured V8 native backing-store totals of 534,048,880 and 481,917,144 bytes respectively (52,131,736 bytes fewer). The authoritative static BVH's 83,831,232 backing bytes were unchanged. The change drops the `staticGeos` and `existingPropGeos` array references after copied BVH capture; it does not dispose geometry. Independent route, marker, gate, target, reset and four route/ending transaction checks passed on the controlled candidate. This is a measured retained-buffer reduction, not a browser GPU-memory or FPS claim. A proposed broad distant-architecture cutoff was rejected because useful savings included authored horizon landmarks; the genuinely safe decor-only subset was too small to justify that visual risk.

### Explicit tracking readability

An explicitly pinned continuation or chronicle now adds one compact current instruction beside the original objectives, with the custom original-route key shown. Active continuation fights display the actual director's remaining count. Closed routes show an actionable main-story prerequisite instead of a remote combat instruction. Journal opening alone never pins anything. Updates use the existing 10 Hz HUD budget and skip unchanged DOM content; original-objective and language rerenders immediately restore the same contextual node. Actual-main tests cover deliberate pinning, custom-key unpinning, counts, cancellation/retry, completion, unchanged original objectives and journal/locale lifecycle stability.
