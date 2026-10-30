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

18 fixed effect slots, 18 material identities, ten shared geometries totaling **48,384 bytes**, and at most 18 simultaneously visible effect meshes (48KiB geometry cap). Each slot has three prebuilt meshes (54 total): melee arc, needle/contact, and one servant motif mesh. Motif activation swaps only a shared immutable geometry reference; it does not retain eight hidden sibling meshes or allocate GPU resources. Only one mesh per slot is visible. No textures, lights, bloom, fullscreen flash, or activation-time GPU resource creation. Ordinary melee retains its small blade-aligned arc. Eight immutable servant Q/X motifs are thin corridor strokes: gold sword-wave crests, amber piercing/broadside lines, blue ground-level charge chevrons, and lavender crossed cuts. All their transformed X/Z vertices are tested against `skillContains`; strike presentation is instantaneous like the adjudicated damage, not a delayed moving projectile.

`hit(strike, point)` is separate from release and is called only for confirmed HP-loss positions. It emits a short, small local contact tick; misses never generate that tick. `WorldAudio.skillEvent` distinguishes anticipation from release, and all cues share the existing 16-source audio budget.
Reduced-flash activation caps peak opacity at 0.09. Turning the preference on mid-effect lowers its ceiling permanently for that effect, preventing a rebound flash when toggled off. Pausing clears the whole pool.

## Earlier reviewed result (before differentiated corridor revision)

Normal and reduced-flash samples were exported and inspected for the four identities, ordinary melee, and the player's separate pulse ability. Saber uses an open gold bow, Musashi uses alternating lavender slash crescents, Blackbeard uses a thin amber crossed-core tracer, and Napoleon uses sparse blue feathered travel marks. The red warning disc remains legible; the effects do not replace it with a filled attack-area panel. Actor/horse geometry may naturally occlude the target in this fixed camera, independently of VFX.

- Full frames: `/tmp/skill-vfx-review/renders/`
- Reduced-flash frames: `/tmp/skill-vfx-reduced/renders/`
- Labeled detail comparison: `/tmp/skill-vfx-review/normal-reduced-comparison.png`

Reduced samples can be reproduced by adding `reduced` after the exporter output-directory argument. All source shaders, geometry/resource tests, and action-integration tests were checked; WebGL sorting and in-game tone mapping still need browser acceptance.

## Differentiated revision verification (2026-10-30)

29 focused skill, audio, and expansion-budget tests pass. New tests verify all eight Q/X motif identities, every transformed vertex inside the authoritative footprint, no delayed projectile motion after instantaneous damage, actual-contact-only tick API, and audio/resource bounds. New real-geometry exports are in `/tmp/skill-vfx-differentiated/`; they use shipped GLB poses, not mock silhouettes. This is offline CPU evidence only, not GPU/browser acceptance. The character pose fixture still samples the original attack clips; separate in-game skill timing must be verified by actor integration tests.

The first differentiated offline render exposed an edge-on Blackbeard tracer and overly thin mounted ground strokes. The revision adds a crossed tracer core in the same mesh and widens sparse strokes without increasing opacity or adding lights. CPU silhouette inspection is not a claim about in-game animation timing, GPU sorting, or measured frame rate.

## Authored clip time-remapping (same revision)

`skillAnimationProfile.ts` remaps only explicit Q/X commands. Omitted `slot` keeps legacy 1× playback, and normal ally attacks do not call the remapper. Existing keyframe tracks and authored contact timestamps are untouched. Every contact is still emitted by the original clip event (Saber's existing normalized contact marker), with no extra damage on hold/release transitions.

- Saber Q: short raised-sword hold, quick release. X holds the **actual raised-sword peak** for 0.32s before release (Q 0.08s). GLB sampling showed that 80% of the pre-contact segment had already lowered the sword, so Saber uses 50%, around clip time 0.333s, instead.
- Blackbeard Q: aimed hold then a single shot. X: first aimed shot followed by two quicker cycles with only 0.035s hold; each shot still comes from the original muzzle event.
- Musashi Q: two original right/left contacts with a brief preparation. X: a longer initial preparation and faster recovery into the third original contact. Any fourth authored contact in the reused clip is suppressed by the command's contact budget.
- Mounted motion is not remapped here; its path/collision/contact contract remains owned by `MountedCharge`.

14 pose/profile regressions pass, including 1/120s versus 0.1s steps, 10-second input spikes (bounded by the actor host), callback-time cancellation, real GLB socket equality at contact, distinct same-wall-clock Q/X bone poses, source-track immutability, and Saber leash cancellation. Ordinary attacks retain their original event timestamps. This reuses authored clips with different timing; it is **not newly hand-authored animation**.

To reproduce the pose-only CPU comparison (no VFX, so effects cannot hide an unchanged animation):

```sh
SKILL_POSE_REVIEW_TIME=.46 node --import tsx validation/benchmarks/export-skill-vfx-review.ts /tmp/skill-pose-differentiated
blender -b -t 3 -P validation/benchmarks/render-skill-vfx-review.py -- /tmp/skill-pose-differentiated /tmp/skill-pose-differentiated/renders saber-ordinary.json,saber-skill.json,saber-ultimate.json
# Blackbeard/Musashi post-release contrast is sampled at .75s in /tmp/skill-pose-differentiated-075.
```

Saber same-time ordinary/Q/X render inspected at `/tmp/skill-pose-differentiated/saber-comparison.png`: Q has released while X retains the elevated sword. These are real skinned geometry samples, not a GPU capture or frame-rate acceptance test.

The `.75s` Blackbeard/Musashi ordinary/Q/X CPU comparison was also rendered and inspected at `/tmp/skill-pose-differentiated-075/comparison.png`. Musashi shows different sword-arm phases. Blackbeard's single-frame pose change is intentionally modest (aim/recoil); his larger distinction is the tested aim-hold and three-shot timing plus separate strike silhouette, not a newly authored firearm stance.

Final pool refinement: 54 resident meshes (three per slot), not 180 hidden alternatives. The shared geometry set remains 48,384 bytes and the visible ceiling remains 18 draws. A 4,000-activation regression switches all eight variants while toggling reduced flash and verifies unchanged object identities, prebuilt geometry references, and clearing. Final combined focused suite: **44 passed**.
