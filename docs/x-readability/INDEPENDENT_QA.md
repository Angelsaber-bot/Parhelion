# Independent two-X readability QA

Baseline: public `3d4884ed8f541a39b441bd58aac4f22702abe05f`.
Scope: Musashi and Napoleon X only; no general exposure, Q, action authority, animation or camera redesign.

## Why earlier reductions were not sufficient proof

The normal stage uses RenderPass → UnrealBloomPass (including additive full-screen bloom blending) → OutputPass. The world composer is not rendered on top of the private stage. The two actors' dedicated trails/crosses are principally normal-blended unlit Basic materials: reducing actor lights does not directly reduce those surfaces. The four standard identities have zero generic energy-beam instances, so changing an unused generic beam would not address their effects.

Napoleon retained the standard `.75/.48/.72` bloom profile and a contact point-light peak of 9. Musashi's earlier lower profile still accompanied paired blade lights, four lanterns, two traces and crossing/central finisher surfaces. These identify contributing code paths, not a measured decomposition of the user's display.

## Reproducible checks

Run from `world/`, with source and output paths explicitly supplied:

```
node --import tsx validation/x-readability-review/audit-stage-stack.ts WORLD_ROOT OUTPUT.json
```

The script runs 132 synthetic-actor, actual-stage phase/identity cases: normal/reduced, intro, charge, every strike, decay, outro, and repeated identity changes. It exercises 66 mocked-composer and 66 direct-render calls, asserting exact target/viewport/scissor/clear/exposure/tone-mapping restoration and complete stage-resource release. It captures source hashes before and after; no images or native assets are exported.

Independent baseline/candidate comparison found:
- All 88 Saber/Blackbeard rows exactly unchanged, including materials/lights/bloom.
- Only the 44 Musashi/Napoleon rows differ.
- All camera arrays and resource counts unchanged.
- Main/exposure, Q presentation, ultimate director and action authority source hashes unchanged.
- Eleven focused actual-stage/profile/fallback/material tests passed independently.

Matched Musashi CPU previews retain identical cameras and asset hashes. The center finisher and blade glints are visibly less prominent while body and blades remain readable. In a fixed subject-area rectangle, max-channel ≥245 counts at four selected phases fall 19→1, 35→0, 50→4 and 39→5. This is encoded image data in an explicitly chosen ROI, not photometry, automatic face segmentation, exhaustive temporal evaluation or a subjective comfort guarantee.

## WebGL limitation

Installed Chromium/Playwright could not create a browser GL context in this cloud execution environment: the normal route failed at process socket creation, and the formal approval route failed in the execution wrapper before Chromium started. No restricted path was read and no alternative route was used to bypass the restriction. Browser/WebGL, GPU bloom pixels, device FPS and the user's display remain unverified. CPU offline previews do not execute UnrealBloomPass and must not be described as proof of final browser bloom intensity.

Numeric settings, source isolation, compositor-routing spies and CPU preview checks support this bounded reduction; they do not prove that the user's subjective brightness complaint is resolved on every device.
