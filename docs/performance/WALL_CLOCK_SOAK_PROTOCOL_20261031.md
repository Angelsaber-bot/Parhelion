# Host-paced lifecycle soak protocol

This is a manual acceptance runner, not an automatic CI timing test. `validation/lifecycle-review/run-wall-clock-soak.ts` boots exact accepted source `67f6a1a65b93daa137f004cf7f4e07241588fe3d` with the legitimately earned final seal save from the fresh gameplay chain. No progression, position, HP or energy is constructed after boot.

Requested observation window: approximately 11:08:38–12:15:00 UTC on 2026-10-31. **That is a plan, not a completed-duration claim.** The runtime receipt records actual start/end, elapsed host time, frame count, cycles, boots, minute samples and any early failure. First three observed minutes passed before this protocol was committed; monitoring remained active.

- Host pacing requests 30 frames/second and forwards actual elapsed host milliseconds into the deterministic-seed fixture clock; it does not fast-forward simulation. Real JavaScript timeouts and promise callbacks are retained. Rendering is the established NON-GPU stub, not a browser/device measurement.
- Each minute alternates ordinary active idle, pointer-lock exit/pause, actual Settings open, actual Settings close and explicit Start/resume. No movement or combat is injected in this stationary safe-spawn soak.
- Every five minutes, capture exact localStorage bytes, close the actual main harness, and reload those bytes at the normal production spawn. Earned flags/discoveries must remain identical.
- Warm retained scene/geometry/material/texture/connected-listener/DOM counts must plateau. Player terrain cache stays bounded; Warden cue pool must remain inactive and fixed-size. Paused player position and HP cannot change. No unsolicited story encounter, defeat, narrative or captured error/warning is accepted.
- Output is one small numeric sample per minute plus a bounded summary and save hashes. No raw heap, environment dump, browser state or credentials are recorded.
- Stop immediately on assertion/error and retain the failure. If the 11:45 release freeze changes runtime/assets, stop/rebase explicitly; do not silently treat an older-source soak as new-source proof. QA/document-only changes may be linked by an explicit runtime-identity comparison.

Evidence location: workspace `qa/final-wall-clock-soak-67f6a1a.{json,log}` and `.json.jsonl`. The final receipt, not this plan, determines achieved duration and outcome. This is neither hours of human play nor GPU/FPS evidence; the accelerated 20-cycle stress and genuine-input progression runs are separate complementary tests.
