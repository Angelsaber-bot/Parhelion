# Four-servant remaster: scope and acceptance contract

Base: `f6fa796fde6e6e54c27b9115f26700db182e765f` (published stable release).
Branch: `remaster/four-servants-20261031`. This round is cloud development/testing
and private delivery only; its source/resources are not authorized for publication.
UTC milestones: baseline review 14:25; character integration 15:20; feature freeze
15:30; tested private handoff 16:00 on 2026-10-31. Existing stable assets and save
schema remain available. A deadline does not establish commercial-reference parity.

## Ownership

| Owner | Exclusive files/scope |
|---|---|
| Integration | `main.ts`, `servant.ts`, `characters/characterKit.ts`, `ultimateStage.ts`, `eraUltimatePerformance.ts`, shared cinematic routing; aggregate/build/package |
| Saber | New `artoria_refined/runtime_revision2` assets/tools; `ultimatePerformance.ts` implementation with compatible interface; `saberCinematicRemake.ts`, `saberCinematicFace.ts`, `saberStageArt.ts`; dedicated tests |
| Musashi | Dedicated ultimate performance; `musashiStageArt.ts`, `characters/musashiLocomotion.ts`; dedicated tests; preserve established face/clothes/hair identity |
| Blackbeard/Napoleon | Dedicated captain/cavalry art, clip and performance modules; `mountedStageArt.ts`, `cinematicTricorn.ts`; dedicated tests; Napoleon remains white-horse/longsword charge |
| Independent QA | Real-main four-character input/target/contact/cancel/reload/outfit/resource checks and fresh evidence; no runtime ownership |

Shared files require explicit integration agreement. No direct edits to the prior
stable worktree; no wholesale staging of experiments or raw preview caches.

## Acceptance matrix (fill with actual evidence, not promises)

For each of Saber, Musashi, Blackbeard and Napoleon separately record:

1. **Model:** exactly what geometry/material/attachment changed, asset provenance,
   byte/triangle/draw-resource cost, native loaded model evidence. Preserved model
   identity is labeled preserved, not rebuilt.
2. **Idle/walk/run:** actual skeletal or attachment motion; ground/carry/contact
   bounds; in-place clips; unchanged controller path and speed budget.
3. **Ordinary attack:** preparation/contact/recovery are visible and distinct;
   original event timestamps and hit socket snapshots remain authoritative.
4. **Ultimate:** new native temporal frames for intro/charge/release/outro, face,
   weapon/horse/ship action and readable effects; still a real private 3D actor,
   not a substituted portrait or recycled preview.
5. **Hit and recovery:** positive actual-main damage, no target/insufficient charge
   admission, one-time cost, pause/skip/cancel/late event safeguards, exact camera
   and source actor recovery, no resource growth over repeated casts.

Reduced-effects and portrait framing must remain functional. No extra damage,
range, recruitment, reward, save migration or network protocol changes are part
of this visual remaster. Existing durations/contact authorities remain the source
of truth; presentation must follow them rather than synthesize new hits.

## Evidence and delivery

Use new, timestamped native-mesh evidence. Offline rendering is not a browser/GPU
capture. Reference footage access failures must be disclosed; do not assert its
exact timing was observed when unavailable. New assets must include source/license
notes; do not import unverified extracted game assets. Dependency copies and large
frame caches are avoided because workspace capacity is bounded.

Final delivery: exact tested commit, incremental source bundle against the base,
resource/provenance manifest, per-character acceptance table and small representative
new previews. Public deployment and user-device work require new authorization.

## Added user requirements (14:17–14:21 UTC)

- Saber Q: manual aimed valid hostile wins; otherwise current engaged target then nearest valid nearby hostile. Select once at cast, follow only that target with bounded actual-root turning, and use the actor's actual contact direction for damage. Lost/dead/occluded/out-of-range targets do not cause a midcast target switch. Existing damage, cooldown, geometry and admission remain authoritative.
- Other quest guidance: narrative owner supplies read-only prerequisite-aware catalog and explicit-pin journal. Existing continuation/chronicle journal remains intact. No progression flags, gates or automatic quest takeover.
- Each character's acceptance sheet must separately name new/preserved model details, idle/walk/run, ordinary attack/Q, ultimate, and recovery. Preserved appearance is not described as newly authored geometry.
