# Four-servant remaster: independent QA ledger

Baseline: frozen `f6fa796fde6e6e54c27b9115f26700db182e765f`. New worktree is `remaster/four-servants-20261031`; active development is **not** a frozen acceptance claim. Final target is 16:00 UTC, with 15:30 feature freeze.

## Evidence boundaries

All current automation uses actual World main, GLBs, native skeletons, collision geometry and damage/input paths under the established NON-GPU DOM/renderer adapter. No device FPS or live WebGL image claim follows. New visuals must be reviewed in newly exported frames with current asset/source hashes; old videos cannot certify the remaster.

`validation/remaster-review/source-evidence.ts` records current runtime file hashes (including new uncommitted modules), selected GLB hashes and source status before/after each manual run. Runtime drift during a shared-tree run is explicitly detectable; it is not silently described as a frozen-source result.

## Baseline normal-input ultimate matrix

`validation/remaster-review/four-servant-input.ts` uses an **explicit synthetic legacy-unlocked save**, adding the four contract flags before boot. It does not claim to recruit all four through their quests. From normal spawn it uses physical walking, configured Y/T, actual rifle hits to earn all 100 charge, and normal X. No post-boot position/ground/HP/energy/progression/damage writes are used.

All four baseline actors passed positive native skin/bone checks, changing private cinematic-clone poses, intro/charge/release/outro phases, native ultimate contacts, actual hostile HP loss, paid energy, ended casting/private stage, restored camera and resumed mouse/movement input. The healthy ordinary target has 66 HP, so actual loss is capped at 66; this is not proof of uncapped 138/144/155/156 damage. Separate authoritative budget tests remain required.

- Saber: `qa/baseline-saber-input.*`.
- Blackbeard: `qa/baseline-blackbeard-input.*`.
- Napoleon: `qa/baseline-napoleon-input.*`.
- Musashi: `qa/baseline-musashi-input-final.*`.

Preserved Musashi operator/fixture corrections: attempting X from the shared 13 m rifle stance correctly rejected her 7 m range without payment; ordinary walking into range fixed that setup. Exact camera/player restoration then differed by only `8.88e-16 m`; the independent player-position assertion now permits less than `1e-9 m` numerical roundoff, not a meaningful teleport. Earlier failed logs remain intact.

`four-servant-remaster-switching-dom.test.ts` also passes the frozen baseline: normal Y cycles, rapid key changes, positive native models, exactly one nearby follower, warm resource-count plateau, ordinary recall and saved selection/recall reload. An initial cross-realm Array deep-equality fixture issue was corrected by copying the roster into the host realm; it was not a product failure.

## User-reported Saber Q bug

Frozen f6 actual-Q fixtures reproduce a genuine directional defect: front target takes 46 HP, but left/right/behind targets take zero; cast direction dot target is approximately −0.229/+0.229/−0.973. A moving-front case keeps the old initial direction (live-target dot 0.9864). This is observed actual strike/HP behavior, not merely a visual judgement.

`validation/remaster-review/saber-q-direction.ts` labels its controlled legacy/player/target placement, recovery/HP and scripted movement fixtures explicitly. Player grounding is obtained by real physics. It invokes the configured Q key, observes unmodified damage callbacks, and compares admission/actual native-contact/actor-yaw directions. LOS, height, no-target fallback and later selected-target invalidation are included. Initial no-target setup only set `active=false`, which normal regional activation undid; corrected setup uses a genuinely dead/pacified target. That fixture mistake is not counted as another product bug.

Integrator's scoped Q fix `729e0a6` first passed all nine actual-main direction/LOS/fallback cases, and the subsequent 12-case lock-invalidation matrix passed: death, late cover and out-of-range retain the last heading and do not rotate to a newly activated off-axis enemy. Shared presentation files were still in development, so these are scoped functional checks, not final remaster acceptance. Multi-enemy priority and final frozen reruns remain required.

Evidence is in the sibling `parhelion-four-servants-evidence/qa` directory, not copied from the earlier release's visual evidence. No runtime source is owned or changed by this QA lane.
