# Sun-shaft update cleanup and rejected pass elision

## Accepted narrow change
`makeSunShafts` reuses one direction vector for `camera.getWorldDirection` instead of allocating one each update. Uniform math, NaN behavior, pass enablement and the entire shader remain unchanged. The production unit regression checks 33 camera/aspect/facing cases plus NaN and verifies a single target identity. Integration separately gates updates when the immutable low-quality/no-post configuration never installs this pass.

This is allocation/unused-update cleanup, **not a measured FPS improvement**.

## Isolated candidate — not integrated
An isolated candidate disables the pass only at the shader's exact sampled-base branch (`strength <= .001`) and restores it on re-entry. CPU audit verifies 36 exact uniform cases, unchanged shader hash, and 30 real `EffectComposer` routing cases with target MSAA settings 0/2/4. OutputPass remains last. Renderer-call counts drop from two to one only when this candidate skips the nominal identity pass; the renderer is a call recorder, not WebGL.

However, a nominal identity `ShaderPass` still performs a real texture sample and HalfFloat target write. Removing it can remove resampling, rounding/conversion and multisample-resolve work. Three's target clones preserve HalfFloat type/filtering, default target color space is NoColorSpace, the shaft shader contains no tone/color conversion chunks, and OutputPass retains output transfer/tone mapping; these source facts still do not prove GPU pixel equivalence. Root therefore rejected production pass elision pending actual GPU equivalence. The 32 taps and spatial decay `.935` were never changed.

The isolated tree `parhelion-qa-shafts-candidate-0158c2d` remains separate. Numeric/source-contract evidence: sibling `parhelion-eight-hour-evidence/qa/sun-shafts/`. No GPU pixel, VRAM, MSAA execution or device-FPS claim is made.
