# Musashi X: second default readability pass

Baseline: 3d4884e. This pass changes only Musashi private X artwork. No Q,
camera, pose, phase/contact clock, exposure, actor asset or gameplay change.

| Local visual | Previous | Candidate |
| --- | ---: | ---: |
| Sampled trail opacity multiplier | .56 | .28 |
| Blade edge opacity multiplier | .55 | .24 |
| Tip glint opacity multiplier | .30 | .08 |
| Tip glint size multiplier | .65 | .45 |
| Default third-cut colored opacity | .38 | .14 |
| Reduced third-cut colored opacity | .18 | .07 |
| Default central-cut opacity | .25 | .06 |
| Reduced central-cut opacity | .12 | .03 |
| Blade reflected light, charge | .35 | .08 |
| Blade reflected light, maximum | 1.6 | .40 |
| Four lanterns, each | 1.8 | .45 |
| Shoji paper emissive intensity | .20 | .08 |

The central near-white layer and white tip spark become restrained blue-gray
`#899ab0`. Musashi energy surfaces now opt into the renderer's existing tone
mapping; renderer exposure is unchanged. Red/blue blade identity, geometry,
contact gates, decay duration, petals and object counts remain unchanged.

`EraBladeTrace` optional profile fields default to the previous values:
`toneMapped=false`, `glintColor=0xfff2dc`. Callers that omit these fields retain old defaults; Napoleon has its own
separate explicit profile in this round.

Source-level local tests (11) and configured TypeScript check pass. These
parameter reductions are not GPU luminance measurements or visual acceptance.
Same-exposure rendered and actual-input QA are separate integration steps.

Four phases (late charge, first contact, third crossing, outro) have paired
360-pixel CPU previews against immutable 3d4884e. All eight images completed;
per-pair camera and actor-asset hashes are exact, with unchanged exposure and
action source. The center stripe and reflected face/chest highlights visibly
reduce while the two blades and clothing remain readable. These CPU images
do not implement the actual WebGL bloom/additive pipeline and are not GPU
acceptance or a quantitative claim about the user's display. Paired metadata
and image hashes are retained in external `musashi-paired-review.json`.
