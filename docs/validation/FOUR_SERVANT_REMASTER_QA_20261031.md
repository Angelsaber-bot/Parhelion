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

## Subsequent scoped checks (14:37 UTC, not final assets)

The 14-case Q matrix additionally passes camera-target priority over a closer side enemy and engaged-target priority over a closer newly introduced enemy. The three invalidation cases retain the original target identity/last heading. Final frozen rerun remains required.

Actor resource and disposal checks now positively observe BFCache preservation and exactly-once geometry/material disposal on repeated final pagehide. Frozen f6 totals after all four actors load: 103 geometries, 98 materials, 28 textures, 1,872,132 triangles and 67,030,576 bytes of attached geometry backing stores. A mutable captain-presentation iteration measured 114 geometries, 115 materials, 28 textures, 1,880,941 triangles and 67,449,862 backing bytes; Saber/Musashi asset URLs were still baseline. This is **not** the final remaster budget. Source manifests and both logs are retained in `qa/*resource*`.

These counters cover attached actor graphs, not hidden original geometries retained by reversible sculpt adapters, process heap, decoded image memory, GPU VRAM or FPS. They expose added presentation cost rather than asserting a performance improvement.

## New captain assets: first positive input and camera defect

With catalog `5b2d289`, actual-input Blackbeard and Napoleon both pass native X damage, paid charge, private clone/pose activity, ended casting and exact camera/player restoration plus resumed mouse/movement. Their new physical tailoring is asserted positively, and Napoleon's horse crest is also required. These are shared-source iteration results, not the final frozen gate.

`QA_NATIVE_PROJECTION=1` adds a full posed-vertex audit of visible native clone meshes at selected charge/release frames for both 16:9 and 9:16, restoring the original camera aspect afterward. This is numerical clipping evidence, not occlusion/shader/GPU rendering or exhaustive temporal coverage. The independent audit caught Napoleon's raised sword clipping at a normal-aspect charge frame (20 vertices, maximum NDC Y 1.024594). The failed frame report is retained; owner fix `31373bf` must be rerun before visual acceptance. Blackbeard's selected charge/release frames had no out-of-viewport vertices.

`QA_REDUCED=1` boots the ordinary saved reduced-effects preference; it does not directly mutate the stage. Source manifests now record compressed and decompressed GLB bytes. Captain asset decoded sizes rise from 18,285,480 to 19,161,552 bytes and mounted cavalry from 28,670,192 to 29,748,904 bytes. These are file-payload costs, not total runtime memory.

The corrected cavalry camera passes independent normal and reduced actual-input reruns: selected middle/late charge and release vertices remain in both aspects. The reduced run has identical runtime/asset hashes before and after. Subsequent garment candidates still require their own final asset rerun.

Saber revision 2 normal X positively loads `Saber_R3_Crown_Strands`, `Saber_R3_Layered_Breast_Keel` and the 1.412 blade calibration. Damage and recovery pass with identical runtime/asset hashes before/after. Mid-charge and pre-hit release are intentional facial close-ups: Face/hair/crown remain entirely within both aspects, while lower body/sword cropping is recorded, not falsely classified as a full-body framing defect. Late charge includes the whole actor/sword. Numerical framing cannot prove effects do not obscure the face.

The projection helper now filters actual index/drawRange/material-group references (including a positive undrawn-vertex regression), rather than treating unused attribute vertices as rendered geometry. Earlier all-attribute reports remain conservative diagnostics and are retained unchanged. The current driver also asserts actual stage reduced-state, records phase progress, samples post-contact release, and rejects Y/T source swapping/refunds during the paid cast.

## All new model resource/outfit gate (15:02 UTC)

With final captain garments `375eaea`, Saber revision 2 and Musashi v5 loaded, the independent main test passes 12 warm roster cycles plus rapid switching, actual outfit UI armor→civilian→armor with positive different geometry and exact returned armor signature, recall/legacy save reload, BFCache preservation and exactly-once final disposal of all 237 attached geometry/material resources. The initial added outfit assertion mistakenly referenced an unexposed debug field; it was replaced with the actual DOM dialog's `open` property. The failed fixture log remains intact.

| Actor | Geometries | Materials | Textures | Triangles | Attached backing bytes |
|---|---:|---:|---:|---:|---:|
| Saber armor |32|31|6|917,370|29,562,424|
| Blackbeard |39|36|7|407,633|17,477,712|
| Napoleon/horse |35|34|10|353,188|13,446,316|
| Musashi |15|15|7|203,994|7,440,942|
| Total |121|116|28|1,882,185|67,927,394|

Versus identically counted f6 actor graphs: **+18 geometries, +18 materials, unchanged 28 textures/262 bones, +10,053 triangles and +896,818 backing bytes**. Saber civilian separately loads 77,648 triangles and 3,263,884 backing bytes. This is an added-content budget, not an FPS/VRAM/process-memory claim.

One earlier Musashi input process was reported `Killed` by the shell before X and produced no final JSON; cause was not established. It is inconclusive, not a passing run or a product assertion failure. Log and a small process-result receipt are retained. Subsequent runs use exclusive render-gate admission, and ordinary checkpoints record numeric RSS/heap/external/ArrayBuffer counters only (no raw heap/environment dumps).
