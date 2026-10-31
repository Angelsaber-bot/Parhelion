# Three-servant continuity QA (new animation tranche)

Baseline: `6be0f8e4edd0aeb474bfc0f367dd377ff7897fa8`. This is not acceptance of later animation changes.

## Repeatable diagnostics

- `validation/three-animation-review/audit-native-continuity.ts WORLD_ROOT OUTPUT`: loads the exact selected native GLBs through the project loader, exercises all idle/walk/run/attack pairs at 30/60/120 Hz through complete clip plus recovery; records finite node motion, authored events, mount seat gap, and separately labelled synthetic nominal-root low-foot bands. Same-state forced restart is deliberately adversarial and must not be confused with normal gameplay. Bone positions are not skin sole penetration or confirmed stance contacts.
- `QA_CONTINUITY=1` adds an actual W/mouse follow loop and complete 60 Hz paid-X transform timeline to the existing `remaster-review/four-servant-input.ts` runner. Normal spawn/physical route/shooting-earned charge are unchanged; the legacy pre-boot recruitment fixture remains explicitly synthetic. No post-boot position/HP/energy/ground/damage grants. CPU host, not human/GPU proof.
- Observer checks **all ancestors** for visibility; hidden Blackbeard cannon-cutaway actor poses are not scored. It logs exact phase/strike-count transitions and distinguishes native node speeds from intentional camera cuts. Geometry exports, screenshots and heap dumps are not produced.
- `summarize-observed-feet.py REPORT` is only a low-foot-bone screening aid, excluding substantial vertical terrain motion. It does not label low bones as planted soles.

## Initial baseline evidence (external workspace)

Under `parhelion-three-animation-evidence/qa/`:

- `baseline-assets-gitblob.json`: all 230 shared asset files, 607,525,342 bytes, exactly match baseline Git blobs. Assets are shared read-only; never edit through this worktree's symlink.
- `native-continuity-6be.json`: 162 native scenarios, all nodes finite and complete attacks emit original events and return idle. Most alarming forced same-state restart deltas are artificial diagnostic commands, not confirmed product issues.
- Blackbeard ordinary raise at clip time .300 s reaches muzzle speed 30.58 m/s at 120 Hz. This is a visual-review lead, not a damage bug or automatic rejection.
- `musashi-6be-continuous-input.json`: actual-input paid X passes damage/fee/end/input restoration. 583 local follow frames plus 443 paid timeline frames. Charge progress .2982456 → .3026316 has a 1.354 m camera step at 60 Hz; report to the camera owner for explicit shot-transition classification/improvement. Strike-two left/right cut and outro cut are separately retained, not silently classified as accidental.
- Follow root's largest speed includes a real spawn-platform downward terrain step, so it must not be attributed to animation foot sliding.

Numeric material/light diagnostics cannot establish white-pixel area, bloom, tone mapping or GPU image equivalence. New owner CPU renders must retain source/version/exposure labels and actual cadence; old selected frames are not continuous-motion acceptance.

## Resource policy

Only bounded JSON/log output (less than 3 MiB per process), one actual-main boot at a time under the existing global weight-four lock and memory precheck. Root explicitly approved a QA-only 2 GiB free-disk threshold; renderer gate remains unchanged. Stop below reserve; do not delete old deliverables or evidence. No new FPS or CPU speedup claim.

## Narrow Musashi readability checkpoint

Runtime bytes measured during the genuine-input candidate run match committed `65bcf51a6bd48973e2aa638333ed379f05d3aabd` across all 177 captured source/asset files. HEAD advanced by commit-only operations during the run; this is explicitly byte-equivalent candidate evidence, not a claim that the whole checkout was immutable.

- Q delivers actual 27 + 29 HP loss. Its full event objects, directions, callback times, energy and remaining cooldown exactly match the retained 6be Q baseline. The first added combination runner incorrectly returned after Q and exhausted its authored enemy list; that harness failure is preserved separately, not attributed to the game.
- Corrected Q→X flow completes. The same natural target has only 10 HP after Q, so X causes **10 actual HP loss**, while retaining three real strike requests. No refill or injected damage. Paid energy 100→0; player/camera positions and real mouse/movement input restore.
- Source/light observations alone are not image acceptance. Independent inspection of the owner's four same-exposure CPU pairs finds less face/chest glint and a much fainter central white line, with both blades retained. In the fixed central rectangle, max-channel ≥245 pixel counts at frames 067/076 fall 255→18 / 402→33. This is encoded preview RGB, not photometry, face segmentation or WebGL bloom equivalence.
- Foot and camera continuity candidates are **not** accepted by this readability result. The original charge camera jump and simultaneous flat-foot outro slide remain separate open items.

## Independent clock and Blackbeard production verification

- Dual-clock production `c43b6e2`: optional presentation time advances only an outgoing gait and its fade. Five independent boundary tests cover split event clocks, zero-clip hold, pause/invalid input, cycle allocation at 30/60/120 Hz and 100 ms, and 900 bit-exact ordinary blend samples against the explicit 6be fixture (no external evidence/git dependency in CI).
- No-adapter actual Q reproduces the isolated improvement: left/right local foot peak speeds 7.607/9.132 → 5.440/7.190 m/s. These are bounded transition peaks, not zero foot slip. All actual Q authority fields match retained baseline exactly. Q follow receives actual RAF elapsed time; it is **not** the X release loop's fixed 1/120 s.
- Blackbeard `529d043`: independent full native 162-scenario comparison retains every authored event snapshot; Musashi and Napoleon ordinary results remain identical. In the independently sampled ±70 ms contact window at 120 Hz, free-elbow peak speed falls 7.323→1.147 m/s. The owner's wider-window result uses a different bound, not a conflicting measurement.
- Production constructor positively chooses the corrected clip, preserves source clips and exact gun contact, and is idempotent. The extra corrected track arrays occupy **62,180 backing bytes per corrected clip**; this is a constructor-time resource cost, not a zero-cost/FPS improvement claim. Only left unarmed-arm quaternion tracks change. Hermite-generated keys still use piecewise slerp: do not claim globally continuous derivatives.
- A first independent constructor test incorrectly expected two separately constructed clip UUIDs to match. Its failure log is retained; corrected test explicitly requires distinct UUIDs while every semantic clip field matches. Both independent tests pass.
