# Skill VFX offline review

This fixture evaluates **the shipped character GLBs and the real `SkillPresentation` geometry** in a small inspection layout. It is not a map screenshot, browser acceptance, frame-rate measurement, or exact GPU trail capture.

- Ordinary over-shoulder perspective: 75° vertical FOV, approximately 3.6m arm.
- Actual player, each relevant companion, and shipped Sunward Guard model.
- Red enemy warning disc uses CombatView's color, opacity, and geometry dimensions.
- Blackbeard and Musashi emissions use their authored muzzle/katana nodes; Saber and mounted-charge emissions use the existing feet-origin contract.
- Melee direction is sampled from the visible blade root; gameplay samples may precede the current animation by one frame. This is a short directional contact accent, **not** an exact swept hitbox.

Run from `world/` after other CPU performance sampling has finished:

```sh
node --import tsx validation/benchmarks/export-skill-vfx-review.ts /tmp/skill-vfx-review
blender -b -t 4 -P validation/benchmarks/render-skill-vfx-review.py -- /tmp/skill-vfx-review /tmp/skill-vfx-review/renders
node --import tsx --test validation/skill-presentation.test.ts validation/world-expansion-budget.test.ts
```

The offline material multiplies the vertex RGB and alpha by the runtime material RGB and opacity, matching Three's `USE_COLOR_ALPHA` math. It uses emission plus transparent shader mixing; it does **not** reproduce WebGL transparency sorting, depth-write behavior, or runtime tone mapping. Those remain browser acceptance concerns.

## Resource contract

18 fixed effect slots, 18 material identities, two shared geometries totaling **6,984 bytes**, and at most 18 simultaneously visible effect meshes. The 8KiB test cap replaces the previous 4KiB cap to allow two pre-batched tapered ribbons and feathered end caps plus one pre-batched crossed tracer core. No textures, lights, bloom, fullscreen flash, or activation-time GPU resource creation. Every slot uses only one visible mesh, even when its shared geometry contains a secondary accent.

Reduced-flash activation caps peak opacity at 0.09. Turning the preference on mid-effect lowers its ceiling permanently for that effect, preventing a rebound flash when toggled off. Pausing clears the whole pool.

## Reviewed result (2026-10-30)

Normal and reduced-flash samples were exported and inspected for the four identities, ordinary melee, and the player's separate pulse ability. Saber uses an open gold bow, Musashi uses alternating lavender slash crescents, Blackbeard uses a thin amber crossed-core tracer, and Napoleon uses sparse blue feathered travel marks. The red warning disc remains legible; the effects do not replace it with a filled attack-area panel. Actor/horse geometry may naturally occlude the target in this fixed camera, independently of VFX.

- Full frames: `/tmp/skill-vfx-review/renders/`
- Reduced-flash frames: `/tmp/skill-vfx-reduced/renders/`
- Labeled detail comparison: `/tmp/skill-vfx-review/normal-reduced-comparison.png`

Reduced samples can be reproduced by adding `reduced` after the exporter output-directory argument. All source shaders, geometry/resource tests, and action-integration tests were checked; WebGL sorting and in-game tone mapping still need browser acceptance.
