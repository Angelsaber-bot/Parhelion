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
