# Parhelion · 项目展示与代码导览

## 展示从这里开始

1. 用 VS Code 打开根目录的 `Parhelion.code-workspace`。此工作区隐藏依赖、构建产物、本机备份和临时实验目录，不改变文件本身。
2. 双击根目录的 `启动 Parhelion.command`，在浏览器打开 `http://127.0.0.1:4173/`。正式展示前先启动、加载要演示的区域。
3. 先演示 World 探索、场景与战斗，再展示 Arena 的配装和对局。
4. 回到编辑器，按下表打开少数关键文件，解释实现；需要展示建模时再用 Blender 打开原生场景。

| 要讲的内容 | 建议打开的文件 | 可以说明什么 |
|---|---|---|
| 游戏如何启动 | `world/src/main.ts` | 场景、玩家、战斗与剧情如何接入 |
| 大世界如何制作 | `world/tools/build-world.ts`、`world/tools/gen/layout.ts`、`world/tools/gen/terrain.ts` | 设计布局，用高度函数生成地形，再组装建筑和植被 |
| 五个区域如何连接 | `world/src/map/regions.ts` | 统一世界坐标、区域偏移与连接通道 |
| 大世界如何控制加载量 | `world/src/map/regionVisualStreaming.ts` | 当前与临近区域的美术按需加载、远离后释放 |
| 玩家如何移动 | `world/src/player/player.ts`、`world/src/player/skinnedCharacter.ts` | 移动碰撞与骨骼动画 |
| 战斗如何实现 | `world/src/combat/combat.ts`、`world/src/combat/combatView.ts` | 战斗规则与画面表现的分工 |
| 联机如何实现 | `arena-game/src/network/session.ts`、`arena-game/worker/index.ts` | 客户端连接与服务器处理 |
| 地图建模源文件 | `arena/assets/aster_research_station.blend` | ASTER 原生 Blender 场景 |
| 角色建模源文件 | `assets/characters/player_v2/authoring/Chaldea_Editable_Master.blend` | 可编辑主角模型、服装与骨骼 |

技术介绍可以围绕实际实现展开：TypeScript + Three.js 负责游戏运行与 World 程序化地图生成；Blender 保存部分角色、地图的可编辑源资产；GLB 是运行时使用的模型格式。现有自动测试不能代替浏览器 GPU 画面或实际设备帧率验收。

## 根目录分工

```text
Parhelion/
├── README.md                  项目说明与展示入口
├── Parhelion.code-workspace   VS Code 展示工作区
├── package.json               统一安装、启动、构建与测试命令
├── 启动/停止/部署*.command     本机与发布快捷入口
├── world/                     World 开放探索游戏与地图生成器
├── arena-game/                Arena 客户端、规则、服务器与联机 Worker
├── shared-client/             两个游戏共用的语言和输入设置
├── site/                      首页、整站构建和本机启动服务
├── arena/                     ASTER 地图源场景与制作工具
├── arena-maps/                其他竞技场地图与共享地图制作工具
├── assets/                    角色、敌人、武器的源文件和导出资产
├── docs/                      设计说明、发布说明与验收证据
└── _local/                    本机历史备份与研究资料（不参与发布）
```

## World 代码分工

`world/src/` 根层只放启动入口、类型声明和模块说明，功能代码按以下目录维护：

| 目录 | 职责 |
|---|---|
| `core/` | 基础类型、布局读取、数值、进度保存与启动错误 |
| `map/` | 区域坐标、连接、地图界面、流式加载、地形网格与天气过渡 |
| `rendering/` | 模型解码、材质风格、后期效果、裁剪、画质和渲染资源管理 |
| `environment/` | 地区材质、环境生物、场景设施和地标美术 |
| `player/` | 玩家移动、碰撞支撑、瞄准、骨骼动画与动作 |
| `weapons/` | 武器资产、装备、涂装和武器数值目录 |
| `combat/` | 伤害、敌人行为、Boss、战技与战斗特效 |
| `companions/` | 从者契约、跟随、外观与骑乘动作 |
| `characters/` | 共享角色资产加载与角色专用动画辅助 |
| `cinematics/` | 终结技演出、镜头、舞台与演出美术 |
| `story/` | 主线、支线、遭遇、旅行、任务条件与导航 |
| `ui/` | HUD、面板、日志、操作界面和通用界面样式 |
| `settlements/` | 聚落数据、居民、美术与行走 |
| `exploration/` | 探索内容、机关、委托、挑战与探索界面 |
| `coop/` | World 合作会话、伙伴与标记 |

其他目录：

- `world/tools/`：地图及角色生成入口；`tools/gen/` 按地区保存地形、建筑与布局制作代码。
- `world/public/assets/`：游戏加载的区域 GLB、布局 JSON、分流美术等输出。
- `world/assets/`：构建时处理的演出图像等资源。
- `world/validation/`：自动测试、验收脚本、对照素材与测试结果。
- `world/validation/fixtures/legacy-player/`：旧分段主角及其网格数据，仅供回归对照与旧版导出工具使用，不作为正式游戏的自动替代角色。

## Arena 代码分工

`arena-game/src/main.ts` 是启动入口，`src/game.ts` 负责对局接线，其余按功能分类：

| 目录 | 职责 |
|---|---|
| `src/player/` | 输入、瞄准、角色动作和手感 |
| `src/rendering/` | 场景、地图表现、材质、光照、音效、战斗效果与画质 |
| `src/weapons/` | 武器模型、持握、表面和军械库 |
| `src/cosmetics/` | 武器涂装、皮肤选择与收藏模型 |
| `src/ui/` | HUD、大厅配装、模式说明、结果界面与样式 |
| `src/network/` | 客户端联机和单机对局会话 |
| `src/assets/` | 构建时导入的地图预览等资源 |
| `shared/` | 客户端、服务器共用的规则、模拟、协议与地图数据 |
| `server/` | 本机 Colyseus 联机服务 |
| `worker/` | Cloudflare 联机部署入口与 World 中继 |
| `tools/` | 模型导出、浏览器验收等制作工具 |
| `test/` | 规则、联机、界面和资源验证 |

## 常用命令

在项目根目录执行：

```sh
npm run setup       # 首次安装两个游戏的锁定依赖
npm start           # 启动本机完整网站；首次使用先构建
npm run dev:world   # World 开发预览
npm run dev:arena   # Arena 开发预览
npm run typecheck   # 两个游戏的类型检查
npm run build       # 构建首页、两个游戏和本机服务器
npm test            # Arena、World 和网站测试；网站测试需要构建产物
npm run verify      # 先完整构建，再运行全部测试
```

Node 最低要求为 22.22.2；World 完整 DOM 测试在 24 LTS 上要求 24.15.0 或更新版本。正式展示使用已构建的本机完整网站，开发预览用于修改代码。

## 后续代码放置规则

- 新增功能放到相应模块目录；入口文件负责组装功能，避免继续堆放新实现。
- 两个游戏均开启 `noUnusedLocals`，类型检查会阻止新增未使用的本地变量和导入。
- 修改地图布局、地形和建筑时改 `world/tools/gen/`，生成后更新区域模型和流式资源。
- Blender 源场景与相关导出工具随资产保存在 `assets/`、`arena/` 或 `arena-maps/`，避免仅因没有运行时引用就删除制作源文件。
- 测试与对照旧实现放 `validation/` 或 `test/`；临时实验放被忽略的 `_local/`，不混入正式运行代码。
- `node_modules/` 和 `dist/` 可重新生成；历史截图、哈希证据、授权与版权文件保留其来源含义。

本次清理删除了无项目引用的一次性 `world/.scratch/` 调试脚本和页面，以及根目录中已废弃的 `Parhelion-Website/` 本机副本。历史备份仍归档于 `_local/`；旧角色的回归基线集中移入测试目录。两套正式客户端代码均已按功能归位。

## 本次整理验证（2026-11-06）

- 两个游戏的类型检查通过，包含新增的未使用变量与导入检查；整站生产构建通过。
- Arena：38 个测试文件、446 项测试全部通过；网站：13 项全部通过。
- World：完整检查 1,907 项，首次运行 1,876 项通过。30 项 Arena 界面测试需要适配重组后的模拟模块路径，已修正；另 1 项存档测试在并发完整检查中发生启动超时。随后将这 5 个文件按正式的串行方式集中复测，31 项全部通过。没有为绕过超时而放宽断言或修改存档行为。
- 相对导入和模型 URL 检查未发现新增缺失路径；正式客户端模块均能从启动入口的依赖链到达。模型、贴图与 Blender 源场景无变更。
- 上述测试包含真实规则、资产读取和无 GPU 的界面集成检查，不等同于浏览器实际画面或设备帧率验收。正式展示前仍应在演示设备打开游戏，提前加载目标场景。
