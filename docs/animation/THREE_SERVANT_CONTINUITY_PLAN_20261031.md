# Three-servant continuous animation audit

Baseline: `6be0f8e4edd0aeb474bfc0f367dd377ff7897fa8`.
Scope: Musashi, Blackbeard and Napoleon idle/walk/run/turn, attack, Q,
full ultimate, recovery and interruption. Musashi default Q/X readability is
highest priority after direct user feedback. This is cloud development only;
no publication, local Work or upload is authorized by this task.

## Ownership
- Integration: CharacterKit, KitCompanion, main, shared stage/cinematic lighting,
  shared skill presentation, integration contracts and final regression.
- Musashi: locomotion, performance, stage art, windup camera; optional blade-trace
  profile with unchanged defaults for other identities.
- Captain/cavalry: dedicated clip/performance/camera, mounted stage art and
  Blackbeard stage art.
- Independent QA: native continuous-pose measurements and actual-input scenarios.

## Acceptance
Each proposed fix must identify a reproduced baseline defect, retain original
combat event times, damage, targeting and save behavior, and show a paired
continuous result rather than an isolated favorable screenshot. Preserve Saber Q.
Check native bones, grip/weapon anchors, feet/hooves, pose transitions, interrupted
crossfades, exact contact counts, paid-cast cancellation, camera and input restore.
For brightness compare the same camera/exposure and multiple phases; CPU images
do not establish WebGL bloom or real-browser GPU performance.

The shared frozen asset directory is read-only by task policy. Original tracked
asset blobs remain in Git; the local sharing symlink must never be committed.
No asset generator is run against it. Stage explicit owned paths, never `add -A`.
Final archives must be derived from Git objects, not filesystem symlink traversal.

Rendering uses one shared lock and a task-specific bounded streaming gate:
minimum 2 GiB free, total new render evidence <=200 MiB for all owners, one frame
buffer rather than raw frame sequences. Preserve old deliveries and stop on limits.
