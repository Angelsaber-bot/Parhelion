# Quick World / Arena QA — 2026-10-28

Independent verification against published baseline `5c90ffa421b33163f8248db55c15e9ebf7ead428`. No Work, desktop access, push or deployment was performed by QA.

## Final results

| Check | Result |
| --- | --- |
| World complete Node suite | **393 / 393 passed** |
| World TypeScript + production build | **Passed** |
| Arena complete Vitest suite | **302 / 302 passed** |
| Arena client + Worker TypeScript + production build | **Passed** |
| Independent small-map differential | **240 command streams exactly match published baseline** |
| Full-map ordinary-marker/enemy/completion invariance | **72 cases passed** |
| Rectangular/offset full-map player projection | **72 cases passed** |
| Full-map label/landmark layout stress | **8,320 cases, no overlapping or out-of-frame labels** |
| Independent Camlann / Blackflag edge movement | **0 escapes / 208 cases**, versus **72 / 208 baseline failures** |
| Protected original inputs | **319 files unchanged**, including ASTER/SAKURA assets, World terrain/generators, character/weapon assets and shared settings |

### M full map

The actual before/after renderer replay visibly removes the rainbow interaction/discovery/spawn/enemy dots. Player and current goal remain distinct; existing chapter entrances and selected hubs use muted symbols. The terrain and small map are preserved. World controls, progression, fast-travel data and preference persistence are unchanged; the only HUD change raises the full-map overlay above help/combat panels.

Independent stress covers Chinese/English, actual long English location names, player/goal overlap and clearing/switching, square/wide/tall grids, shifted origins, CSS widths 280/320/540/640/880 and 1/1.25/2/3 backing ratios. All five region headings remain in tested cases at 320px and above. An extreme crowded **280px English** case safely omits one heading rather than overlapping the player or goal; this is an accepted compact-layout limit, not a universal five-heading guarantee.

### Arena edges and cover

The independent perimeter matrix uses the real shared simulation, all four edges, seven positions per edge, walking/jumping/dashing/jump-dashing, and checks every tick for six seconds. The unmodified baseline reproduced **56 Camlann + 16 Blackflag escapes**; final code/assets produce none in the same 208 valid-start scenarios. The repository suite additionally covers crouching, all seven maps, corners, authoritative queued inputs, deterministic two-minute replays, navigation and spawn protection.

Fresh Blender CPU renders of the final exported Camlann and Blackflag GLBs show the added cover and higher visible edge barriers. Overview/lane cameras, targets and lighting match the verified baseline renders. Routes remain visibly open; automated authored-route, spawn, navigation and bot-match checks pass. Original ASTER and SAKURA source/assets are byte-identical; the shared edge rule intentionally applies consistently to all maps.

## Evidence and limits

- Logs and independent results: `docs/quick-arena-qa/`.
- Exact final Arena input digests: `docs/quick-arena-qa/verified-inputs.json`.
- Actual GLB renders: `docs/quick-arena-qa/after/`; baseline images in `before/` are explicitly **reused historical 5c90ffa renders**, not newly captured gameplay. Each final render's asset SHA and same-camera provenance were verified.
- Full-map replay and provenance: `docs/world-full-map/`.
- PNG evidence may remain local to this QA checkout in a source-only quick publication; the tracked refreshed map previews carry their own provenance.

These are production-source tests, offline Canvas-command replay (approximate font metrics), and Blender CPU GLB inspection—not browser/WebGL, real-device FPS, human PvP balance or hosted-deployment validation. Browser startup was already known blocked in this environment; QA did not retry it with unsafe flags. HUD stacking is source-checked, not a browser screenshot claim. The user's private reference screenshot was inspected only and was never copied into the repository or deliverables.
