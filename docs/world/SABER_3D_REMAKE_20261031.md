# Saber full-3D cinematic iteration, 2026-10-31

This is a cloud development iteration, not a published release or an assertion of FGO-equivalent art quality.

## Implementation

- All visible acting remains real 3D geometry. The production director no longer loads the old 2D cut-in images by default.
- The existing approved Artoria base mesh is retained, not falsely described as a newly sculpted replacement. Its actual facial morph geometry now performs closed eyes, opening eyes, determination and an open-mouth release. Hair and ribbon motion use private cloned geometry and restore their original resources on disposal.
- The full presentation uses a 3-second introduction, 4.4-second charge, the unchanged accepted combat action, and a 2.4-second aftermath. Short and Off retain their existing fast behavior.
- New measured-head camera compositions establish the figure, hold the face and sword, show the raised two-handed sword, reveal the releasing face, follow the downstroke and show the forward beam/vertical aftermath.
- The sword performance uses two-bone arm targeting and a left-hand support grip. The raised wrist is constrained to remain reachable. Release is triggered by the existing accepted strike, never by a presentation timer.
- World-space layered energy volumes, restrained partial spiral trails and small 3D motes replace the flat portrait emphasis. Full-mode WebGL cinematics add a bounded 720p bloom and output pass; reduced mode bypasses this pass. Normal gameplay does not pay the cinematic postprocessing cost.
- New synthesized charge/rise/aftermath cues follow presentation phase edges. Existing impact sounds and damage continue to follow authoritative skill strike events. There is no copied FGO dialogue or soundtrack.

## Ownership and safety

Only the stage clone is animated or deformed. Source meshes, source pose, gameplay hit clocks and energy cost are unchanged. Shared source geometries and materials are not disposed. Stage-specific geometry and compositor buffers have explicit disposal. Skip, focus loss, interruption, repeated casts, invalid targets and end-of-battle behavior remain covered by the existing lifecycle suite.

## Verification limits

The offline preview is a CPU rendering of the actual animated stage geometry and cameras. Blender approximates Three.js lighting, additive materials and bloom; it is not a browser screenshot, GPU validation, or a claim about real-time FPS. The deployed game has not changed. Source publication and deployment require a separate user confirmation.

## Energy-art V2, 02:28:48 UTC freeze

The delivered V1 preview is retained as a separate artifact. V2 replaces straight conical energy shells and regular hoop geometry with an animated turbulent white core, low-opacity outer volumes, feathered three-dimensional flow ribbons and irregular outward wisps. The beam begins at the actual animated sword-tip position, not a fixed point near the actor's feet. The release side camera was widened and moved to retain the complete actor in frame.

Synthetic-stage budget: 68 owned geometry resources and 18,504 triangles excluding the production character. A 600-update synthetic CPU sample averaged approximately 0.30 ms; this is not a real-character benchmark or a GPU/FPS measurement. Hidden energy geometry avoids per-frame deformation before contact.

The first accepted-contact frame of the 12 fps preview is frame 097 at 8.083 seconds. A direct comparison of frame 095 in V1 and V2 found all 70 visible mesh buffers/materials, camera, lighting and background identical. Earlier acting remains unchanged; the updated preview can reuse the unchanged initial sequence and replace the contact/aftermath segment with new renders, recording that boundary explicitly. All source changes remain unpublished.
