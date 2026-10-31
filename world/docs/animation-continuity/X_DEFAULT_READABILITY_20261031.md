# Musashi and Napoleon: further default X readability

Baseline: `3d4884ed8f541a39b441bd58aac4f22702abe05f`.
Scope: these two identities' private ultimate-stage lighting, bloom and effect materials only. No global exposure, Q, Saber, Blackbeard, camera, pose, event, damage or save changes. Model assets remain byte-identical.

## Shared stack changes

| Parameter | Musashi before → after | Napoleon before → after |
| --- | --- | --- |
| Hemisphere / key / rim | 1.6 / 2.4 / 1.5 → 1.1 / 1.4 / 0.6 | 2.8 / 3.5 / 3 → 1 / 1.5 / 0.75 |
| Bloom strength / radius / threshold | 0.24 / 0.28 / 0.92 → 0.06 / 0.18 / 1.15 | 0.75 / 0.48 / 0.72 → 0.06 / 0.18 / 1.15 |
| Cinematic fill | 0.35 → 0.18 | 0.7 → 0.18 |
| Cinematic contact light (normal) | 0.9 → 0.35 | 2.2 → 0.45 |
| Cinematic charge light | 0.15 + 0.25p → 0.08 + 0.12p | 0.25 + 0.5p → 0.08 + 0.16p |
| Cinematic intro/outro light | 0.1 → 0.05 | 0.1 → 0.05 |

Identity settings are reapplied when a shared compositor is reused. Saber remains 0.28 / 0.30 / 0.90 bloom; Blackbeard remains 0.75 / 0.48 / 0.72. Reduced-effects continues to bypass bloom, but the default mode itself is subdued.

## Compositing distinction

The stage uses RenderPass → UnrealBloomPass → OutputPass. Most blade planes use normal alpha blending, not additive blending. Bloom's composite creates the additive halo. Unlit MeshBasicMaterial effects previously bypassed tone mapping; lowering scene lights alone could not lower those planes. Dedicated material opacity/color/mapping changes therefore accompany the lighting changes. The world compositor is not layered again over the private stage. No unused generic-beam parameter is presented as a fix.

## Verification boundary

Focused tests and independent phase/identity census inspect the real scene, material and compositor configuration. Same-exposure offline previews are visual approximations, not proof of the browser's final GPU output. Chromium could not establish a WebGL context in this cloud environment (socket permission/startup restriction); no restriction bypass was attempted. Final test counts and exact accepted commit belong in the delivery receipt, not an early all-green claim here.

Manual check: keep reduced flashes **off**, cast X in each identity, inspect charge, each impact and recovery. Faces, white horse contours, colored blade movement and scene structure should remain readable without a white wash. Check switching to Saber/Blackbeard and Q to ensure their established appearance remains unchanged.
