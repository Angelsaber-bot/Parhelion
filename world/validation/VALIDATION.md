# World viewer repair — 2026-10-26

Base: `73dc9fd11481d044c1b6da287e8a0ad3494c6164` (World PR #1 merged).
All changes are under `world/`. No Arena, generator, layout or GLB changes.

## Reproduced before fixing

The initial seven production-source tests produced **5 failures / 2 passes**:

1. Minimap arrow at world `(3,159)` was drawn at canvas `(190,613.43)` instead of `(190,190)`. Labels and markers used the same incorrect Z offset.
2. Before entering / after unlocking, W/E/R were still accepted (movement, interaction and progress reset).
3. Opening the full map left gameplay inputs active, including keys already held down.
4. Flight E also invoked interaction.
5. Teleport retained old grounded/swimming flags and allowed a stale grounded jump.

An additional targeted test reproduced a stale grounded jump after entering flight, moving upward and leaving flight. It failed before the contact-state fix and passes afterward.

The same initial seven tests pass with the fixes. The completed suite has **19 passing tests**.

## Verification performed

- `npm ci --ignore-scripts` using a workspace-local npm cache: passed. The initial attempt failed because the default `/home/agent/.npm` cache could not be created; no dependency versions were changed.
- `npm test`: 19/19 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed (production bundle).
- Input integration executes the actual event-registration section from `src/main.ts` inside a Node VM, with a simulated DOM; it is not a duplicate input implementation.
- Map tests call the real `WorldMap.draw`, recording canvas coordinates (minimap and full map).
- Player tests use the real `three-mesh-bvh` collision solver, including flat-ground settling, normal jumping, diagonal speed, teleport and flight transitions.
- Real-asset smoke parses the committed 9.4 MiB GLB, builds its collision BVHs, checks all seven teleport destinations settle on ground or water with less than 0.5 m stationary drift, and checks camp spawn walking remains on its plateau.
- Loading tests cover the committed layout, HTTP 503, malformed JSON, invalid coordinates/IDs/dependencies, and the actual bootstrap error/retry handler.

## Browser verification limitation

The Playwright suite is included but **was not executed to test results**: Chromium itself could not start in this cloud sandbox (`socket() failed: Operation not permitted`, process-singleton EPERM). This is a runner/environment block, not a passed browser test or an application failure. No user device or alternate external Work task was used.

Consequently, visual rendering, real browser Pointer Lock behavior, live reload retry, and full playthrough remain unverified. Node/VM checks do not replace those checks. Existing screenshots were not regenerated or presented as new validation.

## Running browser checks in a browser-capable environment

Install/use Playwright separately (the runtime app does not depend on it), start the local dev server, then:

```bash
npm run dev -- --host 127.0.0.1 --port 4177 --strictPort
# In a second terminal with Playwright available:
WORLD_URL=http://127.0.0.1:4177 npm run test:browser
```

If using an existing runner/browser, set `PLAYWRIGHT_MODULE` to its module path and `CHROMIUM_EXECUTABLE` to the browser path. The suite writes a JSON result and a new spawn screenshot to ignored `validation/artifacts/` (or `WORLD_TEST_OUTPUT`). It covers minimap alignment, unlocked/locked input, modal map, flight interaction, HTTP failure/retry, pointer-lock rejection, and a healthy scene load.

No performance/FPS improvement, full map traversal, combat AI or multiplayer validation is claimed.

## 2026-10-26 E／右键与移除手动飞行升降

按最新用户澄清，删除了 `descend` 设置、旧互动／上升复用和 `Player.step` 的 `up` 输入。水平飞行调试保留为 V；WASD 不受相机俯仰影响。Space 仍是正常跳跃、出水和滑翔开关，自动上升气流不变。共享设置 v2 为主／副按键“或”关系，迁移保留旧自定义键并报告单项冲突。

当前全套 World Node 测试 53/53 通过，TypeScript 检查通过；包括生产输入事件段执行、实际 Player、地图 GLB 与海岸／不列颠路线。真实浏览器交互仍未验收，沿用先前环境启动受限的说明，不将 Node 断言描述为浏览器画面测试。
