# Parhelion

动漫风 3D 网页游戏（Alpha）：**Arena 竞技场**（第一人称对战）和 **World 幻日谷**（开放探索）。

## 一键启动（Mac）

双击 `启动 Parhelion.command`，浏览器会打开 http://127.0.0.1:4173/ ；停止时双击 `停止 Parhelion.command`，或在启动终端按 Ctrl+C。网站本体在 `Parhelion-Website/`（本机构建产物，不在 Git 里）。

## 目录

| 目录 | 内容 |
|---|---|
| `arena-game/` | Arena 可玩运行时：TypeScript + Three.js 客户端、Colyseus 服务器、共享确定性规则、Bot、测试 |
| `arena/` | 第 1 张 Arena 地图 ASTER 研究站（Blender 流程，ChatGPT 制作） |
| `arena-maps/` | 第 2–4 张地图：`zenith/`（日冕天台）、`sakura/`（樱庭）、`neon/`（夜港）；`_lib/` 是共享的 GLB 生成与检查工具 |
| `world/` | World 幻日谷、落日王国与星落海岸（第三人称探索） |
| `assets/weapons/` | 8 件武器 GLB 与外观登记表；5 枪＋3 近战，均为可选战斗装备 |
| `shared-client/` | Arena / World 共用的本机按键与灵敏度设置 |
| `Parhelion-Website/` | 本机一键网站（首页 + Arena + World），`npm run build` 重建 |
| `_local/` | 本机备份、旧工作区、日志、截图（不在 Git 里） |

## Arena 地图

| 地图 | 时间 | 打法 |
|---|---|---|
| ASTER 研究站 | 极光暮色 | 开阔中庭 + 北侧长廊高台，镜像对称；美化层在 `arena-maps/aster/` |
| ZENITH 日冕天台 | 正午 | 三层阶梯：高台出生、台地环、下沉日晷池、双塔悬台，点对称 |
| SAKURA 樱庭 | 黄昏 | 经典三路：鸟居参道长枪 / 室内拜殿近战 / 锦鲤池拱桥，镜像对称 |
| NEON 夜港 | 夜晚 | 集装箱迷宫 + 5 米吊车甲板，对角出生，点对称 |

每张图的说明、重建命令和测试在各自目录的 README 里；`arena-game/README.md` 说明运行、联机和测试。

## 武器与操作更新

武器模型、Arena FPS 开镜与权威下蹲、World TPS 肩射、两端自定义按键/灵敏度：见 [接入与验证说明](docs/WEAPON_INTEGRATION.md)。新下蹲规则要求同版本客户端与服务器，不能只更新静态页面。部署步骤与当前认证限制见 [发布交接](docs/DEPLOYMENT_HANDOFF.md)。

## 自选双枪＋近战（规则 v3）

大厅自选两把不同枪与一件近战；E／右键均可按住开镜。World 已按要求删除手动飞行升降，F 互动，保留跳跃、滑翔和气流。实现、原型数值及验证边界见 [当前更新说明](docs/LOADOUT_CONTROLS_V3.md)。
