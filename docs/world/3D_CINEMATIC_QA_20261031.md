# Four-servant 3D cinematic QA — 2026-10-31

## Verified source and checks

- Final World command: `node --import tsx --test --test-concurrency=1 validation/*.test.ts`.
- Result: **1,118 passed, 0 failed, 0 cancelled, 0 skipped**, 403.027 seconds.
- `npm run build` passed after the suite, including TypeScript checking. Vite reports a large-chunk warning; it is not a performance validation.
- All 426 tracked runtime, validation and shared-client source files remained byte-identical throughout the final run. The standalone browser capture helper already includes the corrected era duration `5.85 + totalRelease`, and passed `node --check`.
- The 426-file verified source manifest has digest `e142886ef18c3b96684a940d112787248dbe84b1e907d6bd42650980d8685daf`. The manifest and complete logs are retained in the sibling `remake-qa-artifacts` directory. The initial suite-source digest is `1f217c379dba2bf7e9ed6a6624b78a03e6ddb57c3a39b144d639ad27f60c6142`.

## Acceptance exercised

Production NON-GPU DOM/GLB/BVH tests exercise all four servants' full/short/off modes, skip and interruption paths, rejected targets, authored damage budgets, one energy payment, repeated casts, visibility pauses, renderer failure, input capture/restoration and end-of-battle behavior. The production default does not create or preload legacy 2D cut-in portraits. Synthetic stage tests check geometry ownership, source preservation, animation and compositor fallback. These are not browser pixel tests.

## Render evidence

Saber V1 is preserved. V2 is a 129-frame, 640×360, 12 fps, 10.75-second silent preview rendered from actual animated Three.js scene geometry and camera snapshots. Frames 000–096 reuse unchanged V1 acting; contact/aftermath frames 097–128 were rerendered from V2. The lead verified frame 095 buffers, materials, camera and lights were identical. V2 MP4 SHA-256: `a5d44d030d220f173a8866be9fc67e894fba468d7a80f8a046e92303e0592281`. Full ffmpeg decode passed.

The separate era previews use the same CPU scene-snapshot pipeline. Their individual manifests record frame count, timing and source provenance.

## Limits and scope

- Blender Cycles CPU render, **not live WebGL footage or a GPU/FPS benchmark**. Three.js additive lighting, hemisphere/point lights and actual runtime bloom are approximated; fog and tone mapping differ. Mild video noise reduction is applied. Preview audio is absent even though runtime synthetic cues exist.
- Chromium launch was blocked by cloud sandbox socket restrictions. A supported cloud browser could not reach the local development server. No live browser rendering or mobile pixel framing was established.
- Site/Arena verification was not completed: site output was absent and Arena dependency installation was policy-blocked. No bypass was attempted and Arena source was not edited by this work.
- No claim of exact FGO visual parity. No copied game voice track or soundtrack.
- Cloud development and testing only. Nothing deployed or pushed; publication remains a separate approval decision.

## Final framing correction and delivery verification

The early Napoleon mounted reveal previously cropped the rider head. Its camera aim/height were corrected; a new guard projects eight head-envelope corners at 61 points through the charge. Eight actual rendered transition samples and the corrected complete video independently confirm head visibility. The final suite above includes this correction and guard.

All four final MP4s passed independent full ffmpeg decoding and temporal visual review: Saber V2 129 frames / 10.75 s, Blackbeard 93 / 7.75 s, Napoleon V2 87 / 7.25 s, Musashi 89 / 7.416667 s; all are 12 fps silent CPU previews. Individual paths, hashes and stream metadata are retained in `remake-qa-artifacts/all-four-independent-video-qa.json`. Earlier preview files remain preserved.
