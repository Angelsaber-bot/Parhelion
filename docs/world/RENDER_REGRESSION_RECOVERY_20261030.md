# Conservative rendering regression recovery candidate — 2026-10-30

User reports continuous 27–40 FPS after entering the published a11f349 build, worse than a5b3290. This candidate restores the pre-performance rendering paths for a controlled device comparison. It is **not evidence of improved GPU FPS**; no target-device GPU measurement has been performed here.

## Scope
- Core runtime `world/src` matches a5b3290 exactly, except the isolated combatView hit-effect correction. The nearby-elite HUD layout correction is also retained.
- combatView retains baseline enemy selection/update order and allocation behavior; removes body-attached wireframe polyhedra, uses small camera-facing impact streaks (140 ms shot impact; 160 ms ally impact), muzzle flash 45 ms, initialized bolt position, capped pools and shared resource disposal.
- 145 mobs/5 regional elites, repeatable bosses, first-clear reward protection, flight/pause visibility, asset retry handling, roof-safe placement and regional enemy assets are unchanged from a5b3290. No arena or game save/content reset.
- Withdraws shader warmup/boot scheduling, modified grass shader, pooled lighting, material caching, spatial culling, enemy update/clone changes, frame/UI scheduling and camera scratch rewrites as one diagnostic baseline. No individual change is claimed as proven cause.
- Obsolete helpers and their performance-specific tests/benchmark executables removed; original performance report and JSON benchmark results remain as historical evidence, not validation of the current candidate.

## Baseline parity (byte comparison against Git a5b3290)
| Path | SHA-256 |
|---|---|
| `world/src/main.ts` | `360b2e5514e54a7cfd9ce5cf88883d4b4962fdbd7abe9f87dc42d39af3a53e0d` |
| `world/src/chunk.ts` | `9708a6498380e7f9b1d1e71051518860c6cc6734536732d0e5045f20da1394ab` |
| `world/src/fx.ts` | `963dd636a43e8389a1694c06e80557dab4643a8e3d64871e2fd00822f202d1d0` |
| `world/src/enemyVisuals.ts` | `c989ecb853b57d0ec89dfba9e95f35458120497ccea853dae343302ffae9f6e9` |
| `world/src/valleySentinel.ts` | `0d576e3215287a828caa85215dc27c342f10a9ddb2c74429fa42f3216648693a` |
| `world/validation/input.test.ts` | `dece7320696a38f98301283100f0b41e26dfe8c53b705b011927b7070dce6629` |
| `world/validation/progress-reset.test.ts` | `d201f43709817d46e0c5e1c14cf491eb1d66bf28e365cdfae358d89bb31c53ea` |

The only runtime TypeScript difference versus a5b3290 is `world/src/combatView.ts` hit feedback; index.html also retains the HUD layout exception below. Its appended behavioral test checks impact position, bounded geometry/scale/lifetime, camera alignment, no body shell, no miss impact, and repeat-safe disposal. Existing enemy/boss/terrain tests cover retained gameplay fixes. Compile/build and CPU tests do not establish browser GPU performance; deployment and same-device scene/settings comparison remain pending.

## Retained HUD layout correction

The nearby-elite hint remains below the contract card (desktop top 375 px, mobile
bottom 82 px) rather than returning to the overlapping baseline position. Therefore
index.html is deliberately not byte-identical to a5; this is a layout-only exception.
All core rendering runtime files listed above remain baseline-identical apart from
the separately retained compact impact effect in combatView.

## Cloud checks

498 World tests and 13 site tests pass, with typecheck and the full site build. These are correctness/build checks, not a device frame-rate result. The reduction in test count removes tests for the withdrawn performance-only modules, while the original gameplay and retained hit-feedback tests remain.
