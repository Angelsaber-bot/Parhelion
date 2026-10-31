# Napoleon X: lower default layered glare

Baseline: `3d4884e`. This pass changes only private X lighting and effect
materials. White horse, sword, clothing, poses, camera, exposure, timing,
contact ownership, Q and gameplay remain unchanged. No model assets change.

| Mounted X local source | Previous | Current |
| --- | ---: | ---: |
| Contact point-light peak | 9 | 1.6 |
| Ground impact opacity, default / reduced | .65 / .30 | .20 / .10 |
| Ground impact color | #f4dfac | #9c8050 |
| Trail opacity multiplier | 1 | .32 |
| Blade edge opacity multiplier | 1 | .35 |
| Tip glint opacity multiplier | 1 | .22 |
| Tip glint color | #fff2dc | #a38d64 |
| Blade effect toneMapped | false | true |

Actual default trail/edge/glint contact opacity peaks are .24/.28/.176.
Geometry, trail sample positions, widths, contact gating and decay windows
are unchanged. Reduced effects remain quieter, not the only way to enable
the lower default brightness. The shared identity-local Napoleon profile
also reduces hemisphere/key/rim to 1.0/1.5/.75 and bloom to .06/.18/1.15
(strength/radius/threshold); nearby cinematic lamps are separately reduced.
Saber, Blackbeard, Q and global exposure do not opt into these profiles.

Eleven focused stage tests pass, including default/reduced exact peaks,
no fabricated effect before contact, unchanged travel, bounded resources,
fade and repeat-reset/disposal. Configured TypeScript passes.

Four paired 360x202 CPU previews cover intro, late charge, contact and outro.
Camera, asset hash, phase and strike count are identical between each pair.
At contact, mean display-RGB luma is .6023 → .4294, its 95th percentile
1.0 → .7134, and pixels with every RGB channel >=245/255 decline from
18.409% to .0055%. White horse and rider remain visible while broad snow
highlight clipping substantially recedes in these images.

These are same-exposure CPU Cycles diagnostic images with no compositor
bloom. They do not reproduce WebGL tone mapping, UnrealBloomPass, fog or
all blending details, and are not GPU/display luminance acceptance.
Actual browser startup was blocked before a GL context; no bypass was
attempted. External `napoleon-paired-review.json` and per-frame manifests
retain image/source hashes and the complete pixel-metric definitions.
