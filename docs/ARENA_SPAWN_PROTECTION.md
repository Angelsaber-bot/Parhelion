# Arena 出生 / 复活保护 · 2026-10-28

## 行为

- 首次出生、进行中的对局新加入、每次真正复活、每局重新开始，均获得 **2.5 秒（150 个 60 Hz 权威 tick）**无敌。
- 倒计时结束进入 `live` 时重新出生并重置保护，所以大厅 / 开局倒计时不会吃掉正式开战后的保护时间。
- 开火、近战、开盾、移动和追赶输入包均不取消、不缩短保护。缺少输入包不会延长保护；离线暂停冻结整个对局 tick。
- 在 `tick < spawnProtectedUntilTick` 时，所有五种枪械、三种近战及 Bot 攻击均不能降低玩家 HP 或其部署护盾的 HP，不产生该目标的 hit / kill / shieldBreak 或额外计分。正常攻击动画仍然可见。
- 在到达 expiry tick 时恢复正常伤害。命中判定可回溯位置，但保护只看当前服务器 tick，不使用玩家输入中的 `view`、包数量或客户端时间。
- 原 **3 秒死亡等待**、全部伤害与武器数值未修改。既有代码会在死亡当 tick 的结尾扣掉一次复活倒计时，保持原行为。
- 左下角技能上方有小型中英提示：`◇ 出生无敌 · 2.5s` / `◇ Spawn protected · 2.5s`，按快照 tick 递减。死亡、结束、到期、回合重置和缺失快照时隐藏 / 清空。

## 实现与兼容

保护状态只由 `shared/match.ts` 的 `spawn()` 和权威 Match tick 决定；共享的 HP 与护盾扣血入口检查保护，离线、Colyseus 和 Worker 的 RoomCore 复用同一实现。

快照新增可选 `PlayerSnap.spawnProtectedUntilTick`。没有修改输入位、已有字段或消息格式，保持 **rulesVersion 3**：旧 v3 客户端会忽略附加字段，新客户端面对旧服务器不会凭空显示保护。**公网必须部署更新后的 Cloudflare Worker，只有静态站点更新不会改变旧服务器的伤害规则**。客户端也应一并部署以显示 HUD。此轮云端检查不等于已部署或已验证托管 Durable Object。

## 验证

最终云端检查：

| 检查 | 结果 |
|---|---|
| 完整 Arena `npm test -- --reporter=dot` | **275 / 275**，19 文件 |
| `npm run build` 内的客户端 / Colyseus TypeScript 与 Worker TypeScript | 通过 |
| Vite 生产构建 | 通过 |
| 独立真实 Colyseus / Worker 格式 JSON WebSocket + HUD 聚焦检查 | **16 / 16** |
| 专项规则 + 既有 combat / crouch / sim 聚焦检查 | **92 / 92** |

覆盖：8 种武器在第 149 / 150 tick 的边界；8 种武器对部署盾；保护中开火；真实 Bot；追赶输入和伪造输入字段；无输入 tick；首次 / 中途加入；每局 `live` 刷新；两次实际死亡 / 复活；重复 rematch；真实 offline session；中英文 HUD、死亡隐藏、到期隐藏和重置；两种真实 socket 的初生、开火、精确到期致死、实际复活和 rematch。

旧武器伤害、近战接触与下蹲回溯测试原本在出生后立即攻击；其 fixture 现先自然推进过保护窗口，再执行原有断言，没有削弱伤害 / 命中断言。网络测试 fixture 使用 ASTER 南侧无遮挡通道；曾使用的朝向会被中央 z=18.5 掩体挡住，已修正测试站位，仍要求到期当 tick 击杀。

证据：[完整测试](spawn-protection/arena-full-final.log)、[类型与构建](spawn-protection/arena-build-final.log)、[真实 sockets 与 HUD](spawn-protection/network-hud-final.log)。本次未运行真实浏览器截图 / GPU UI 验证，HUD 通过实际 Hud 类 DOM 单元测试及生产构建；未访问或使用 Mac 上未验证的候选代码。
