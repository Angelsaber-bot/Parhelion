# Parhelion · 幻日

动漫风 3D 网页射击游戏（Alpha）：**Arena 竞技场**（第一人称对战）和 **World 世界**（第三人称开放探索）。

公网：https://parhelion-game.pages.dev · 联机服务器：Cloudflare Worker `parhelion-arena`

## 目录

| 分类 | 目录 | 内容 |
|---|---|---|
| 游戏 | `arena-game/` | Arena 运行时：Three.js 客户端、Colyseus / Worker 服务器、共享确定性规则、Bot、测试 |
| | `world/` | World：幻日谷、落日王国、黑帆尽头、永冬之城、业火京都 |
| | `shared-client/` | 两边共用的中英文本、按键与灵敏度设置 |
| 地图 | `arena/` | 第 1 章 ASTER 研究站（Blender 流程） |
| | `arena-maps/` | 第 2–5 章：`camlann/`、`blackflag/`、`frostcourt/`、`sakura/`；`aster/` 是 ASTER 美化层，`_lib/` 是共享 GLB 工具 |
| 资源 | `assets/` | 武器（5 枪 + 3 近战）与角色模型 |
| 网站 | `site/` | 首页（`web/`）、整站构建与本机启动服务（`scripts/`）、测试（`test/`） |
| 文档 | `docs/` | `arena/`、`world/`、`characters/`、`combat/`、`release/` 分类说明；其余子目录是验收截图与数据 |

## 竞技场地图

| 章 | 地图 | 主题 |
|---|---|---|
| 1 | ASTER 研究站 | 极光研究站 · 长廊高台 |
| 2 | CAM LANN 誓约荒原 | 亚瑟王 · 石垒废墟 |
| 3 | BLACKFLAG 黑帆战舰 | 黑胡子 · 双舷甲板 |
| 4 | FROSTCOURT 永冬庭院 | 拿破仑 · 雪庭拱廊 |
| 5 | SAKURA 樱庭 | 黄昏神社 · 经典三路 |

## 世界

| 区域 | 年代 | 入口 |
|---|---|---|
| 幻日谷 | 2026 | `/world/` |
| 落日王国 | 537 | `/world/?region=britain` |
| 黑帆尽头 | 1718 | `/world/?region=blacksail` |
| 永冬之城 | 1812 | `/world/?region=winter` |
| 业火京都 | 1582 | `/world/?region=kyoto` |

## World 玩法迭代

新增分章节主线与探索互动、敌人职责、近战连击/闪避、从者战技与终结技、安全据点旅行。
默认新增按键：B 近战、Z 闪避、Q 战技、X 终结技、N 据点旅行、P 返回主线指引；自定义绑定优先保留。
详见 [World 操作与玩法说明](docs/world/WORLD_EXPANSION_GUIDE_20261030.md)。

## 新内容从哪里开始（当前源码）

- **World「伪晓回声」**：暂停菜单打开「主线续篇与归路纪事 · 故事进度」，主动追踪续篇；先在幻日谷与守频员岚交谈，完成接收机检修并领取原主线武器，再到旧收讯阵调查。旧存档无需重置，跨时层仍遵守原主线的召唤阵条件。
- **五处居民纪事**是可选内容，不必全部做完才能进入续篇。完成一处纪事的最终回报对话，才解锁对应「旅途涂装」；在 World 操作设置中选择，只改枪械与近战外观，不加数值。详见 [World 入门](world/README.md) 与 [续篇说明](docs/world/FALSE_DAWN_CAMPAIGN_20261031.md)。
- **Arena**：大厅选两把不同枪与一件近战，查看随模式/队伍变化的对局说明；1v2 中西·青为单人侧，东·橙为双人侧。Esc 暂停单机对局，但联机只打开菜单、服务器仍继续。详见 [Arena 玩法与运行](arena-game/README.md)。

以上是原创同人游戏续写与当前源码功能说明，不代表官方剧情或已发布到公网。自动化状态/输入测试、离线几何图与真实 GPU/人工游玩证据分开记录；不据此承诺游玩时长或设备帧率。

## 构建与运行（Node 22+）

完整 World DOM 验证使用 Node 22.22.2+（22 LTS）或 24.15.0+（24 LTS）；GitHub Actions 跟随最新 Node 22。

```sh
npm ci --prefix arena-game
npm ci --prefix world
cd site && npm run build      # 构建 Arena + World + 首页 → site/dist
```

- 本机：双击 `启动 Parhelion.command`（http://127.0.0.1:4173/），`停止 Parhelion.command` 停止。
- 常规发布：推送 main 后由 GitHub Actions 依次测试、部署 Worker、冒烟测试和发布 Pages。World 回归测试失败也会阻止发布。
- 手动公网发布：双击 `部署到公网.command`（发布 `site/dist/public` 到 Cloudflare Pages `parhelion-game`）；联机服务器用 `部署Arena服务器.command`。两者都需要本机已登录 wrangler。
- 测试：`npm test --prefix arena-game`、`npm test --prefix world`、`npm test --prefix site`。

部署细节与注意事项见 [发布交接](docs/release/DEPLOYMENT_HANDOFF.md)。

### World gameplay polish

See [the latest World interaction, combat-readability and craft polish](docs/world/WORLD_POLISH_20261030.md) for player-visible changes, offline model comparisons, validation evidence and remaining GPU/FPS limits. Existing saves are supported; a progress reset is not required.

See [companion combat/following and enemy-state repairs](docs/world/COMPANION_RELIABILITY_20261030.md) for the next World reliability iteration and its validation limits.
