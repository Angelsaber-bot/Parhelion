# Saber ultimate: targeting repair and second visual pass

## Scope

This revision is limited to Saber/Artoria. Other servants retain their previous presentation. It is cloud-developed work; a build or CPU render is not evidence of browser GPU quality or frame rate.

## Actual combat defect

The aim resolver intentionally supplies a finite free-aim direction when it cannot select a hostile. Previously the Saber ultimate accepted that fallback, consumed 100 energy, and played a full cinematic even though no enemy satisfied its range, height, facing and line-of-sight tests.

The paid Saber ultimate now requires a resolved hostile ID and target point before starting its actor pose or consuming resources. Failure explains the existing 18 m caster-relative range and visibility constraints in Chinese and English. Damage values, penetration rules, cooldown costs and the authored contact event remain unchanged. A wall appearing after acceptance can still block the hit; this is not a guaranteed-damage override.

Production DOM tests cover natural companion pursuit rather than only placing the caster beside a stationary target: varied distances, facing, target movement before input, transition from ordinary attacks, an actual Boss, out-of-range targets, another floor, real BVH cover and no hostile. Accepted, unobstructed cases deliver one 138-damage ultimate. Invalid preflight cases preserve 100 energy and zero cooldown without playing the cinematic.

## Visual changes

- Original illustrated Saber cut-in, followed by real-time character performance rather than a full-duration still image.
- Private-clone two-arm grip and authored anticipation poses; gameplay rig and contact clock remain authoritative.
- Saber-specific framing, ground contact and depth cues; the old decorative halo is removed.
- Sword-space energy and contact-triggered release effects instead of an unrelated fixed beam behind the character.
- Per-cast presentation strike count, bounded synthesized audio, reduced-motion support and immediate skip cleanup.

The image provenance and runtime encoding are documented in `world/assets/cinematics/README.md`. Existing source character assets are reused. This is not a claim of newly hand-animated commercial-quality character assets or a frame-for-frame recreation of FGO.

## Viewed visual references

Actual screenshots, not measured video timing:

- [FGO hybrid portrait and battle sprite, screenshot published by AppMedia](https://appmedia.jp/wp-content/uploads/2021/09/81ba2032fdc394839387086ea6f304a9.webp): a large expressive portrait plus an active weapon-bearing figure, strong horizontal motion and gold ground light.
- [FGO raised-sword charge, screenshot published by AppMedia](https://appmedia.jp/wp-content/uploads/2015/08/63b1e938dea459122853a5e57067b44a.jpg): light originates at the raised sword, with a dominant character silhouette rather than a distant idle model.
- [FGO close expression, screenshot published by AppMedia](https://appmedia.jp/wp-content/uploads/2015/08/497eaf7be141b04708be39f9e9cd4454.jpg): diagonal face framing and asymmetric golden light.
- [Raiden burst community screenshot hosted on HoYoLAB](https://upload-os-bbs.hoyolab.com/upload/2022/09/04/242477667/f678f0503e0ec50c3d899f5624bd515e_5093544629925110186.jpg): low-angle upper body, luminous weapon/hand focus and environmental depth.

These are reference observations only. The screenshots, commercial footage, music and voices are not redistributed as game assets. Official video playback was unavailable during this review, so no continuous-video or frame-timing analysis is claimed.

## Verification boundary

Runtime behavior is checked with the production non-GPU DOM/GLB/BVH test harness. Offline temporal renders inspect pose continuity, grips and composition, but cannot certify WebGL transparency, shader compilation, actual audio playback or user-device FPS. A final aggregate result should identify the exact tested source snapshot and clearly separate later documentation changes.
