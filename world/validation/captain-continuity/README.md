# Captain / cavalry continuous-motion review

Baseline assets are the final `6be0f8e` catalog GLBs, read-only. This folder's first tranche is diagnostics and an isolated unarmed-left-arm candidate; no model copies or generated model assets are committed.

`capture.ts ID OUT` runs the real CharacterKit mixer on a synthetic state schedule. The stationary-root schedule isolates poses and does **not** prove walking gameplay. `--follow` instead drives the actual KitCompanion/MountedCharge on one explicit flat collider with a scripted player path, target and Q command; it is not an actual enemy-HP or skill-admission playthrough. `--reuse-static=DIR` shares static buffers; `--compact` and follow mode gzip the matrices. `--fps=60` captures every real fixed-60 Hz sample, never image interpolation.

`render.py CAPTURE OUT START END [--front]` imports original GLB materials, reconstructs actual captured Three skin matrices, verifies three vertices per mesh/frame against `getVertexPosition` (<10µm), preserves vertex colors, and streams one working PNG at a time into ffmpeg. It uses CPU Cycles, low resolution/four samples; no GPU/FPS claim. Skinning data and frame metadata remain available for deterministic replay. The first renderer experiment omitted vertex colors and is rejected as material evidence; the corrected `colour` and subsequent video outputs include them.

`audit-joints.ts` compares original authored assets with final 6be baked clips. Fast Blackbeard muzzle raising (~30m/s peak at .3s) already exists in original assets and must not be misattributed to the refinement. The confirmed new left-elbow contact/end key reset is separate.

`free-arm-candidate.ts` only changes UpperArmL/ForearmL/HandL quaternion samples around the reset and final recovery. Hermite endpoint tangents guide the resampling, but runtime remains the original key-grid piecewise slerp: **not** a global mathematical C1 guarantee. Entrance remains untouched after a first candidate worsened actual mixer-fade startup speed. Right arm/muzzle, spine/head/root/feet, all times and event snapshots remain exact. `free-arm-candidate.test.ts` and `audit-free-arm-boundaries.ts` cover full-cycle and interrupted cadence traces.

The private resource gate is an uncommitted local tool approved for this particular cloud tranche: it uses the old global locks, serial execution, total new evidence ≤200MiB and ≥2GiB free disk throughout. Do not use an old 4GiB gate threshold bypass or delete old delivery assets to make a render fit.
