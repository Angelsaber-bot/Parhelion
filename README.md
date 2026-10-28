# Parhelion

动漫风 3D 网页游戏（Alpha）：**Arena 竞技场**（第一人称对战）和 **World 幻日谷**（开放探索）。

本轮云端整合改动、交付范围及验收限制：[2026-10-28 更新说明](docs/CLOUD_ROUND_20261028.md)。

## 一键启动（Mac）

双击 `启动 Parhelion.command`，浏览器会打开 http://127.0.0.1:4173/ ；停止时双击 `停止 Parhelion.command`，或在启动终端按 Ctrl+C。网站本体在 `Parhelion-Website/`（本机构建产物，不在 Git 里）。

## 目录

| 目录 | 内容 |
|---|---|
| `arena-game/` | Arena 可玩运行时：TypeScript + Three.js 客户端、Colyseus 服务器、共享确定性规则、Bot、测试 |
| `arena/` | 第 1 张 Arena 地图 ASTER 研究站（Blender 流程，ChatGPT 制作） |
| `arena-maps/` | 章节竞技场：`blackflag/`（船战）、`frostcourt/`（雪庭）、`camlann/`（战场废墟）、`sakura/`（樱庭）；旧 `zenith/`、`neon/` 保留兼容；`_lib/` 是共享 GLB 工具 |
| `world/` | World 幻日谷、落日王国、黑帆尽头、永冬之城与业火京都（第三人称探索） |
| `assets/weapons/` | 8 件武器 GLB 与外观登记表；5 枪＋3 近战，均为可选战斗装备 |
| `shared-client/` | Arena / World 共用的本机按键与灵敏度设置 |
| `Parhelion-Website/` | 本机一键网站（首页 + Arena + World），`npm run build` 重建 |
| `_local/` | 本机备份、旧工作区、日志、截图（不在 Git 里） |

## Arena 地图

| 地图 | 时间 | 打法 |
|---|---|---|
| ASTER 研究站 | 极光暮色 | 开阔中庭 + 北侧长廊高台，镜像对称；美化层在 `arena-maps/aster/` |
| BLACKFLAG 黑帆战舰 | 海上 | 黑胡子章节：舰船甲板、桅杆与船尾高台 |
| FROSTCOURT 永冬庭院 | 雪景 | 拿破仑章节：庭院、廊道与喷泉掩体 |
| CAM LANN 誓约荒原 | 战后 | 亚瑟王章节：残墙、木构遗迹与开阔缺口 |
| SAKURA 樱庭 | 黄昏 | 经典三路：鸟居参道长枪 / 室内拜殿近战 / 锦鲤池拱桥，镜像对称 |

大厅展示以上五个章节入口。ZENITH 日冕天台和 NEON 夜港暂不放在主要选择列表中，但保留资源和旧地图 ID 兼容；并未删除港口文件。研究站与樱庭本轮不改动。

本轮云端修改的检查结果与未验证项见 [章节验收记录](docs/ARENA_CHAPTER_QA.md)。源代码和离线检查完成不代表已经部署到公网或完成真人试玩。

每张图的说明、重建命令和测试在各自目录的 README 里；`arena-game/README.md` 说明运行、联机和测试。

## 武器与操作更新

武器模型、Arena FPS 开镜与权威下蹲、World TPS 肩射、两端自定义按键/灵敏度：见 [接入与验证说明](docs/WEAPON_INTEGRATION.md)。新下蹲规则要求同版本客户端与服务器，不能只更新静态页面。部署步骤与当前认证限制见 [发布交接](docs/DEPLOYMENT_HANDOFF.md)。

## 自选双枪＋近战（规则 v3）

大厅自选两把不同枪与一件近战；E／右键均可按住开镜。World 已按要求删除手动飞行升降，F 互动，保留跳跃、滑翔和气流。实现、原型数值及验证边界见 [当前更新说明](docs/LOADOUT_CONTROLS_V3.md)。

## 落日王国可玩迭代（未发布）

V 三维自由飞行、World 可见射击与荒野遭遇、落日王国 Boss／第一契约从者、中英切换，以及 Arena 赛后积分板／重赛清理／双 Shift：见 [本次接入与验证边界](docs/KINGDOM_ITERATION.md)。首页采用非破坏式语言注入，不替换现有视觉资源。

## 三角色资产接入套件

黑胡子、武藏与白马拿破仑的精修运行时/可编辑资产、动画映射、附件约定及验证边界见 [角色接入说明](docs/CHARACTER_KITS.md)。资产默认不改变现有场景或玩法，需开发者显式选用。
