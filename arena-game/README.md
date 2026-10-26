# Parhelion · Arena game (Alpha)

可以打的 Arena：1v1 / 1v2 / 2v2 对战，服务器权威，单机可对 bot。四张风格各不相同的地图，在大厅里选：ASTER 研究站（极光暮色，开阔中庭 + 长廊高台）、ZENITH 日冕天台（正午，三层阶梯 + 下沉日晷池）、SAKURA 樱庭（黄昏，经典三路 + 室内拜殿）、NEON 夜港（夜晚，集装箱迷宫 + 吊车甲板）。

地图和美术**不在这里**：直接读取各地图目录的 `runtime/map.json`（碰撞与锚点）和视觉 GLB，不复制、不修改：

- ASTER：`../arena/runtime/map.json` + `../arena/assets/station_visual.glb`
- ZENITH / SAKURA / NEON：`../arena-maps/<id>/runtime/map.json` + `../arena-maps/<id>/assets/<id>_visual.glb`（生成脚本在各自 `source/`，共享工具在 `../arena-maps/_lib/`）

每张图可在 `map.json` 的 `presentation.preset` 里选氛围（`src/atmosphere.ts`：day / noon / dusk / night），控制天空、太阳、雾、曝光、辉光和环境粒子。

地图在 `shared/arenaMap.ts` 的 `MAPS` 里注册（加新图只需同格式的数据 + 在这里加一行，`scene.ts` 里加 GLB 路径）。各地图的生成流程照旧在自己的目录维护，改了这里自动生效。

## 运行

```sh
cd arena-game
npm install
npm run dev          # 客户端 http://localhost:5174
npm run server       # 联机服务器 ws://localhost:2567（单机模式不需要）
npm test             # 规则、bot 对战、Colyseus 端到端测试
```

大厅里先选地图，再选「单机 vs Bot」直接开打；选「联机」填服务器地址，同一地图、同一 layout 的玩家进同一个房间。勾「空位用 Bot 补齐」可以一个人开 2v2。地址栏参数：`?low` 关阴影（低端机/软件渲染），`?map=zenith` 预选地图，`?mode=online&server=ws://host:2567`。

操作：WASD 移动 · 鼠标瞄准 · 左键射击 · 空格跳 · Shift/E 冲刺 · Q 护盾 · 右键按住开镜 · R 换弹 · 1/2/3/滚轮 切枪 · Tab 计分板 · C 按住下蹲 · O 设置 · Esc 暂停。

### 公网联机（Cloudflare）

公网站点 https://parhelion-game.pages.dev 是纯静态的，联机服务器是单独的 Cloudflare Worker `parhelion-arena`（`worker/index.ts`，Durable Objects：一个 Lobby 负责配对，每个房间一个 DO 跑 60 Hz 对局）。规则和本地 Colyseus 服务器完全一样（两边都包装 `shared/room.ts`），协议是普通 JSON WebSocket。公网页面默认连 `shared/protocol.ts` 里的 `PUBLIC_SERVER`；地址带 `/arena` 路径就走 Worker 协议，不带就是 Colyseus。

```sh
npm run worker:dev                     # 本地 Worker ws://127.0.0.1:8787/arena
npm run worker:deploy                  # 部署（需要 wrangler 登录，只部署 parhelion-arena 这个 Worker）
npx tsx test/worker-smoke.ts <wss-url> # 两个客户端进同一房间的冒烟测试
```

## 内容

| | |
|---|---|
| 对局 | 1v1 / 1v2 / 2v2，自由选队（满了自动分到另一边），先到 7 / 10 / 12 杀或 5 分钟，3 秒重生，出生点避开敌人 |
| 角色 | Aster（150 HP，5.2 m/s：白色长外套、浅蓝长发、头顶幻日光环）· Vega（125 HP，5.7 m/s：深色紧身服、橙色双马尾、鳍形耳饰）。程序化动漫比例人物（`src/fighter.ts`），队伍色在饰边/腰带/手套上，带跑步、待机、跳跃的程序动画，上半身和枪跟随瞄准俯仰 |
| 技能 | 冲刺：0.15 秒 ~2.6 m，冷却 3.5 秒 · 护盾：2.4×2 m，300 HP 可被打碎，只挡敌方子弹，10 秒，冷却 14 秒 |
| 枪械 | Lumen AR（全自动）· Corona SG（9 弹丸霰弹）· Halo DMR（高伤半自动，爆头 ×2），各 2 款皮肤 |
| Bot | 规则型基线，刻意做得像人：反应时间随距离变长，瞄准有滞后和首发偏差、移动时更不准，自动枪点射+停顿；三种性格（突击/架点/绕后）决定去哪、蹲多久、多近开打、何时撤退。网格寻路（含多层高台和坡道）。三档难度；`npx tsx test/bench/duel.ts` 可对比强度 |

## 结构

```
shared/   客户端和服务器共用，纯 TS，无 Three.js
  map.ts        碰撞（AABB + 坡道楔形）、射线、视线；移植自 arena/runtime/physics.js 已验证的 0.2 求解器
  arenaMap.ts   地图注册表：getMap(id)，服务器按房间选图
  sim.ts        applyInput(map, state, input) → events：移动/跳/冲刺/护盾/开火/换弹，确定性
  match.ts      权威对局：输入队列、命中判定与延迟补偿、护盾、计分、阶段、重生、快照
  content.ts    tick、角色、枪械、皮肤、规则数值
  hit.ts nav.ts bot.ts protocol.ts arenaMap.ts
server/   Colyseus 房间：包装 Match，60 Hz 模拟，20 Hz 广播快照
src/      Three.js 客户端：本地预测 + 服务器校正、其他玩家 100 ms 插值、HUD、音效
test/     vitest
```

### 网络模型

- 客户端每 tick（60 Hz）采样输入，立刻用同一个 `applyInput` 预测自己，再把输入发给服务器。
- 服务器按序消费每个玩家的输入（每 tick 1 个，最多追 8 个，防加速），命中只在服务器结算。
- 快照带每个玩家 `lastSeq`；客户端收到后从服务器状态重放未确认的输入，误差平滑消掉。
- 开火输入带 `view`（客户端当时看到的服务器 tick），服务器把其他玩家回滚到那一刻判定命中，最多回滚 250 ms。
- 单机模式在浏览器里跑同一个 `Match`，走同一条代码路径。

状态都量化到 1/4096 m，弧度量化到 1e-4，同一 JS 引擎内完全可复现（有测试）。不同浏览器引擎的 `Math.sin` 可能有最低位差异，由服务器校正兜底。

## 已知限制 / 下一步

- 枪械外观已接入曙光 AR、余辉 SG、子午线 DMR；失败时保留旧几何体模型。角色仍是程序化模型。另 5 件武器只在大厅「旅人武装」展示，不是新增战斗类别。
- 玩家之间没有碰撞体积。
- 训练型掩体 AI 还没做：`Controller` 接口是接入点，`Bot` 是评估基线。
- 软件渲染（无 GPU）下帧率很低，用 `?low`；真实 GPU 未做跨设备测速，Safari 未测。
- 地图高台没有护栏碰撞，可以从边上走下去（原地图设计如此）。

## 武器外观 / 开镜 / 下蹲 / 设置（本地源码集成）

- Lumen AR → 曙光、Corona SG → 余辉、Halo DMR → 子午线；保留已有武器名称、皮肤选项和全部枪械数值。
- Arena 始终第一人称；默认按住右键瞄准。AR / SG 对齐瞄具，DMR 使用 24° 真实视野缩放及镜内十字；不增加精度/伤害奖励。Q 仍为护盾。
- 默认按住 C 下蹲：碰撞高度 1.2m、眼高 1.05m、移动速度为站立的55%；头/身体命中体随姿态缩小。头顶空间不足保持蹲下，离开后才能起身；蹲下不保留冲刺高速。
- 大厅、暂停页或默认 O 打开设置，分别保存本模式按键、普通/开镜灵敏度、反转Y。改键检查冲突，可明确交换，Esc 保留取消/关闭；可恢复默认。
- 大厅展示8件模型，一次只载入一件。战斗只载入当前装备；同款几何共享、实例材质/动画独立，切换和退出会释放资源。
- **规则版本2：** 下蹲输入与快照姿态需要本次客户端、Colyseus服务端、Cloudflare Worker保持一致。旧版本会明确报不兼容，不会悄悄退化成站立判定。公网发布需要成套更新；见 `../docs/DEPLOYMENT_HANDOFF.md`。

完整基线、覆盖与未完成的浏览器/Worker实机检查见 [WEAPON_INTEGRATION.md](../docs/WEAPON_INTEGRATION.md)。
