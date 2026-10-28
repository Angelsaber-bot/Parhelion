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

## 构建与运行（Node 22+）

```sh
npm ci --prefix arena-game
npm ci --prefix world
cd site && npm run build      # 构建 Arena + World + 首页 → site/dist
```

- 本机：双击 `启动 Parhelion.command`（http://127.0.0.1:4173/），`停止 Parhelion.command` 停止。
- 公网：双击 `部署到公网.command`（发布 `site/dist/public` 到 Cloudflare Pages `parhelion-game`）；联机服务器用 `部署Arena服务器.command`。两者都需要本机已登录 wrangler。
- 测试：`npm test --prefix arena-game`、`npm test --prefix world`、`npm test --prefix site`。

部署细节与注意事项见 [发布交接](docs/release/DEPLOYMENT_HANDOFF.md)。
