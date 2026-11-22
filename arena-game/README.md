# Parhelion · Arena game (Alpha)

可以打的 Arena：1v1 / 1v2 / 2v2 对战，服务器权威，单机可对 bot。大厅依次提供五章地图：ASTER 研究站、CAM LANN 誓约荒原（亚瑟王）、BLACKFLAG 黑帆战舰（黑胡子）、FROSTCOURT 永冬庭院（拿破仑）、SAKURA 樱庭（本能寺章节沿用）。未知或已删除的地图 ID 会回到 ASTER。

地图和美术**不在这里**：直接读取各地图目录的 `runtime/map.json`（碰撞与锚点）和视觉 GLB，不复制、不修改：

- ASTER：`../arena/runtime/map.json` + `../arena/assets/station_visual.glb`
- SAKURA / CAM LANN / BLACKFLAG / FROSTCOURT：`../arena-maps/<id>/runtime/map.json` + `../arena-maps/<id>/assets/<id>_visual.glb`，ID 为 `sakura` / `camlann` / `blackflag` / `frostcourt`（共享工具在 `../arena-maps/_lib/`）。可编辑 Python 源 `source/build.py` 一次生成布局、视觉与碰撞代理；不是仅渲染的场景外壳。

每张图可在 `map.json` 的 `presentation.preset` 里选氛围（`src/rendering/atmosphere.ts`：day / noon / dusk / night），控制天空、太阳、雾、曝光、辉光和环境粒子。

地图在 `shared/arenaMap.ts` 的 `MAPS` 里注册；`CHAPTER_MAPS` 只筛选五章菜单，经典图仍在总注册表。新增地图同时登记 `scene.ts` 的 GLB 路径、预览缩略图与共享中英文本。离线、Colyseus、Worker 都通过 `getMap`/`RoomCore` 取同一碰撞数据。各地图的生成流程在自己的目录维护。

## 运行

```sh
cd arena-game
npm install
npm run dev          # 客户端 http://localhost:5174
npm run server       # 联机服务器 ws://localhost:2567（单机模式不需要）
npm test             # 规则、bot 对战、Colyseus 端到端测试
```

大厅里先选地图，再选「单机 vs Bot」直接开打；选「联机」填服务器地址，同一服务器、地图、layout 和补 Bot 选项用于匹配房间（还受房间容量限制）。局域网玩家使用同一台 LAN 服务器地址，不是各自的 localhost。勾「空位用 Bot 补齐」可以一个人开 2v2。地址栏参数：`?low` 关阴影（低端机/软件渲染），`?map=aster` 预选地图，`?mode=online&server=ws://host:2567`。

操作：WASD 移动 · 鼠标瞄准 · 左键射击 · 空格跳 · Shift 冲刺 · Q 护盾 · G 投掷道具 · F 检视武器 · E/右键按住开镜 · R 换弹 · 1/2 枪械、3 近战、滚轮循环配装 · Tab 计分板 · C 按住下蹲 · O 设置 · Esc 暂停单机 / 打开联机菜单（联机对局继续）。这些是默认按键，自定义设置优先；结算页固定按 S 查看/关闭计分板，Esc 关闭计分板。

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
| 对局 | 1v1 / 1v2 / 2v2，自由选队（满了自动分到另一边），团队先到 7 / 10 / 12 杀获胜；5 分钟到时比分高者胜，同分平局。1v2 的西·青为 1 人、东·橙为 2 人；单机其余位置补 Bot。3 秒重生，初生 / 每次复活后 2.5 秒无敌（开火不取消），出生点避开敌人 |
| 角色 | Aster（150 HP，5.2 m/s：白色长外套、浅蓝长发、头顶幻日光环）· Vega（125 HP，5.7 m/s：深色紧身服、橙色双马尾、鳍形耳饰）。程序化动漫比例人物（`src/player/fighter.ts`），队伍色在饰边/腰带/手套上，带跑步、待机、跳跃的程序动画，上半身和枪跟随瞄准俯仰 |
| 技能 | 冲刺：最多存 3 次，每 5 秒恢复 1 次。每段约 0.15 秒，期间可提前按键，按下时的方向会随下一段接上。护盾：2.4×2 m，300 HP 可被打碎，只挡敌方子弹（近战和手雷都挡不住），10 秒，冷却 14 秒 |
| 道具 | 开局在破片手雷与烟雾弹中选一种，每条命 2 颗，两次投掷间隔 0.4 秒，每 14 秒恢复 1 颗。破片手雷：可反弹，保留 1.6 秒引信；到时仍在空中则等下一次触地再爆炸。半径 6 m 内的敌人必死，并被炸飞；墙和护盾都挡不住（范围内的敌方护盾直接炸碎），不伤队友，自己固定受 50 伤害且不会致死。烟雾弹：首次触地展开 5 m 烟幕 12 秒，遮挡视线和敌方名牌；烟内的人受烟外枪击伤害 -25%。撞墙或撞到天花板不算触地，斜坡和高台顶面可以触发。单机和联机使用同一规则（v19）。 |
| 瞄准镜 | 狙击枪（5.8×，米位双粗十字）与射手步枪（3.8×，发光人字形＋弹道落点刻度）开镜后，周围黑屏、中间是一片镜片：镜筒暗影、边缘渐暗与色散、镜面反光和尘点，开镜时由暗变亮；发光准星随皮肤主色变化，镜内显示倍率和测距。纯视觉效果，不晃动、不改变瞄准。十款狙击枪/射手步枪皮肤各有动态镜框主题（`src/ui/scopeThemes.ts`）：星渊轨炮赤红闪电、冰川勘探冰棱飞雪、绯夜蔷薇荆棘玫瑰、鲸落深蓝气泡波光、时序之钥黄铜齿轮、黄铜地平线火焰日环、青瓷山海水墨金浪、夜枭圣咏月光羽毛、螺钿夜雨彩虹雨幕、残樱刃鞘樱吹雪；准星线条随主题变色并带火焰闪烁、电弧、冰晶等样式，始终保留一条精确的细芯线。 |
| 训练场 | 大厅第三个标签。离线、不限时、不计战绩：10/20/30/45 米固定靶、15/30 米横移靶、20 米掩体探头靶、25 米护盾靶、手雷坑和三个近战靶；假人不还击，倒下 1 秒后回到原位。Esc 打开训练场菜单，随时换武器、皮肤和道具，或重置假人；左上角实时显示命中率、爆头率、秒伤和击杀用时。地图在 `arena-maps/range/`（`source/make_map.py` + `source/build_glb.py`），规则在 `shared/trainingRange.ts`，从不出现在联机房间或地图列表里。 |
| 配装 | 五种枪：突击步枪 AR、霰弹枪、精确射手步枪 DMR、冲锋枪 SMG、狙击步枪；三种近战：单手剑、长枪、战锤。大厅选择两把不同枪＋一件近战，默认 1/2/3 切换对应槽位；各武器外观在大厅选择，数值以配装卡为准 |
| Bot | 单机普通和困难在残血受压或弹药紧张时运行训练过的掩体模型。三档均使用分级的反应延迟、瞄准误差、点射节奏和网格寻路。联机补位使用规则型 Bot。 |

## 结构

```
shared/   客户端和服务器共用，纯 TS，无 Three.js
  map.ts        碰撞（AABB + 坡道楔形）、射线、视线；移植自 arena/runtime/physics.js 已验证的 0.2 求解器
  arenaMap.ts   地图注册表：getMap(id)，服务器按房间选图
  sim.ts        applyInput(map, state, input) → events：移动/跳/冲刺/护盾/开火/换弹，确定性
  match.ts      权威对局：输入队列、命中判定与延迟补偿、护盾、手雷与烟幕、计分、阶段、重生、快照
  grenade.ts    手雷弹道（逐轴反弹）、爆炸衰减、烟幕视线遮挡
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

- 五种枪械各有 5 款专属皮肤，含独立建模与能动机构（见 `../assets/weapons/structural_v1/README.md`）；失败时保留旧几何体模型。角色仍是程序化模型。SMG、狙击、折光刃、流星长兵器和断层锤均已接入真实战斗；大厅选两把不同枪＋一近战。
- 玩家之间没有碰撞体积。
- 软件渲染（无 GPU）下帧率很低，用 `?low`；真实 GPU 未做跨设备测速，Safari 未测。
- 地图高台没有护栏碰撞，可以从边上走下去（原地图设计如此）。

## 重训评测用的掩体对手

在 `arena-game` 执行 `npm run train:bot`。脚本用真实的 `Match` 在四张训练地图上从同一交火状态重跑各个候选走位。伤害、击杀和暴露时间用于拟合 16 单元隐藏层的候选动作评分网络。验证会测独立的随机种子，以及留出的樱庭和黑帆战舰。产物 `shared/botTacticsModel.json` 记录权重、特征顺序和验证统计。这个对手保留在离线评测中，供不同版本的学习策略在同一条件下对照。

### Arena 持续训练

在单机或联机大厅开启「自动贡献对局训练数据」。浏览器定期提交本局的视角变化、移动、按键、武器槽位、可见目标和游戏视口的 16×9 亮度网格。设置保存在本机，可在大厅关闭。训练数据省去名字、房间码、聊天和完整画面。

Arena Worker 在独立的 Durable Object 中排队、增量训练，并保存模型权重。每份录制整份进入训练或评估，处理后的样本批次会移除原始内容。每 5 分钟还会用真实对局模拟运行一段 Bot 对练，更新独立的模拟权重。`/training/status` 显示后台进度和留出误差。训练模型在后台做影子评估，实战表现达到上线要求后再接入 Bot。旧 JSON 仍可通过 `npm run train:human -- /path/to/parhelion-demo-*.json` 离线训练。

本机执行 `npm run worker:train --prefix arena-game` 启动训练服务。通过 localhost 打开的 Arena 会把已授权的录制发到本机 Worker，数据和模型重启后可继续使用。

搜索模型从真人没有看见敌人的片段学习。每个片段配对连续视角和移动输入、玩家朝向、近处几何以及上次实际看到敌人的方向。`/training/status` 的 `exploration` 显示训练及留出片段数和角度误差（弧度，`stillYawError` 为视角不动的参考误差）。旧版批次仍能训练原模型，新版开始提供搜索模型所需的场景特征。

Arena 使用一个 Bot 难度。单机、联机补位与英雄教学都使用直接输出玩家操作的神经网络。下载超时或不可用时，新对局使用随游戏打包的已训练权重。房间在开局时固定策略，每名角色有独立的观测历史。

随游戏发布的权重位于 `shared/directPolicy.json`。训练先使用按整局切分的真人输入，再从真实碰撞几何中独立采样转向，用射线命中和重新发现目标的结果训练。`scripts/sample-control-practice.ts` 生成试验，`tools/learn-control-practice.py` 将试验与自对弈历史配对，并从实际产生位移的操作学习移动。正式对局直接执行网络输出的视角、移动、按键与武器槽位。

### Arena 神经网络训练

Arena 的 PyTorch Transformer 用最近 8 个观测窗预测下一段视角、移动、7 个动作按键和武器槽位。每窗间隔 12 个输入步。训练窗覆盖未发现敌人、丢失目标和交战，观测包含视野内目标、附近地图几何、角色状态和上次目击方向。模型按完整录制切分训练和留出集。它能使用 CPU、Apple MPS 或 CUDA。浏览器使用同一套权重进行推理，所有输入仍由原游戏物理裁决。

从仓库根目录运行以下命令，可用独立的 Python 环境安装训练依赖：

```bash
python3 -m venv arena-game/.scratch/neural/.venv
arena-game/.scratch/neural/.venv/bin/python -m pip install 'torch>=2.5,<3'
```

在两个终端分别启动本机采集和训练：

```bash
ARENA_NEURAL_CORPUS=1 npm run worker:train --prefix arena-game
npm run train:neural --prefix arena-game -- --watch
```

在 Arena 大厅勾选「自动贡献对局训练数据」，开始至少两局。「再来一局」也会新建独立录制。获授权的本机批次进入 `arena-game/.scratch/training/corpus`。公网批次进入 Arena Worker 的私有档案，最多保留 4,096 批和 30 天。GitHub Actions 配置为每 15 分钟触发，任务实际开始时间取决于 GitHub 的调度。有新数据时更新真人参考策略；首次升级会使用已有语料学习画面。已保存参考策略后，即使没有新批次也会另行生成新对局并训练主策略。批次和训练中间文件仅在临时运行器中处理。训练不会消费或删除 Worker 档案。优化器检查点单独存放在受限的 Worker 接口，可供下一次任务续训。公网只接收通过真人留出评估和模拟对照阈值的权重。合成测试权重专用于验证。

本机操作者可用 `npm run train:neural --prefix arena-game -- --watch --public` 镜像公网语料并训练，从 `.scratch/neural/public.token` 读取专用令牌。训练完成会生成 `.scratch/neural/candidate.json`、`metrics.json`、`simulation.json` 和 `checkpoint.pt`。

本机进度见 `/__parhelion/arena-neural/status`，公网进度见 Arena Worker 的 `/training/status`。`npm run eval:neural --prefix arena-game -- /path/to/model.json` 可单独重跑模拟对照。要自定义模型尺寸或继续训练检查点，可运行虚拟环境的 `python arena-game/tools/train-arena-policy.py --help`。

### 自博弈训练和后台

在现有 Arena 大厅展开「AI 训练后台」，或打开 [训练状态](https://parhelion-game.pages.dev/arena/#training-status)。自博弈每代记录新对局、游戏物理步、优化器更新和候选 SHA。Worker 练习的 tick 采用独立计数。线上玩家使用同一难度。

周期任务每次从私有检查点续训，使用 12 分钟的训练预算，最多完成 60 代。每代原子保存，任务根据已用时间和评测耗时，在完成一代后交还运行器。训练代码推送后会先跑最多五代。每代默认 12 场、每场 45 秒游戏时间，涵盖 1v1 和 2v2。训练对手来自当前策略、历史直接控制模型和线上权重。场次足够时先保证每个对手都有出场机会，再按 1v1、2v2 各自的近期战绩增加弱势对手的出场比例。候选模型还会根据上次评测结果，用最多半批对局加练卡墙、背后搜敌或烟雾场景。

2v2 的两名队友共享策略权重。PPO 分别学习两人的动作、命中反馈与共同的比赛结果，每名队友保留自己的观察历史。每场比赛和物理步数都只计一次。训练器从真人训练集重放未接敌时的静止视角、主动转向和交火操作，并以冻结的真人策略作为参考。早期执行器使用过模拟教师的纠错标签。第四版从真人模仿权重初始化，使用新的价值网络和优化器，以真人动作为示范，自博弈奖励来自比赛分数和实际造成或承受的伤害。训练器还预测同一条命内随后一至三次决策的内部状态，并根据新旧策略的动作分布差异控制更新幅度。训练器在真人训练对局之间交叉验证转向误差，分别评估主动转向和静止观察，并限制视角输出层更新对自博弈动作分布的影响。只有一场训练对局时，使用按时间分离的片段并剔除重叠上下文。

视角、移动、开火、装备和技能由网络每秒决策五次。环境提供玩家可见的观测，并执行统一的武器、后坐、碰撞及冷却规则。训练场景可改变出生点和烟雾位置，双方自由行动。每代还会随机试验视角操作，按实际命中和重获视野的结果更新策略。烟雾遮挡观测，墙壁遮挡弹道。用 `node --import tsx scripts/evaluation/evaluate-smoke-edge.ts` 可以单独复测玩家站在烟边仅露出轮廓的场景。候选使用独立种子测试视野遮挡、重现和换边比赛。大厅的训练面板显示最近一次评测的背后搜敌时间、脱离墙角比例和换边对局成绩；小样本诊断赛与正式晋级赛分别标注。

每五代评测一次留出的真人对局。大厅显示留出对局数、操作片段数，以及候选与真人模仿基线在主动转向、静止观察时的角度误差。训练器另用独立种子抽取三张地图检查搜敌、烟雾和碰撞。背后搜敌和烟雾专项中的脚本对手使用与候选相同的视野。通过后，再用另外三张地图进行完整的换边比赛，与脚本基线和已发布的策略比较 1v1、2v2 表现。有正式神经策略时，每张地图预先分配四个种子与其对照，两种模式各自换边，共 48 场；另有 24 场脚本对照。训练、行为检查与正式对照各使用独立的种子区间。日志记录种子版本、地图、行为统计和完成场次。通过全部检查后，Worker 更新正式权重，新开的对局使用新版本。训练器从公开模型地址重新下载权重，并核对其 SHA-256 与发布记录。

以下命令从仓库根目录运行。已有本机真人检查点时，直接验证并保存三代训练；下次运行从本机上次提交代继续。常驻训练机可将 `--generations 3` 换成 `--continuous`，使用 `--cloud` 时从环境读取专用训练令牌并启用版本冲突检查。公网定时任务的两次执行之间有空档。

```bash
arena-game/.scratch/neural/.venv/bin/python arena-game/scripts/self-play-cycle.py --generations 3
```

本机单机和局域网房间默认使用公网已发布的策略。调试本机 Worker 时，在 localhost 的 Arena 地址加 `?trainer=local`，或启动局域网服务器时设置 `ARENA_TRAINER=local`。本机的对局采集仍发送给本机训练服务。

本机训练进程使用 `--continuous` 时，可以创建 `arena-game/.scratch/self-play/pause` 让它保存当前一代后退出；删除此标记并再次启动即可续训。

视觉教师使用玩家同意贡献的游戏画面和对应输入。线上策略使用蒸馏后的结构化观测，部署的客户端和无渲染的 Worker 可运行同一份权重。要验证纯画面控制，可在 Arena neural training 工作流手动勾选 pixel_audition。该实验使用临时视觉模型从 Bot 自己的摄像机直接控制角色，记录烟雾造成的画面变化和实际操作步数。

## 武器外观 / 开镜 / 下蹲 / 设置（本地源码集成）

- Lumen AR → 曙光、Corona SG → 余辉、Halo DMR → 子午线；保留已有武器名称、皮肤选项和全部枪械数值。
- Arena 始终第一人称；默认按住 E 或右键瞄准。AR / SG 对齐瞄具，DMR 使用 24° 真实视野缩放及镜内十字；不增加精度/伤害奖励。Q 仍为护盾。
- 默认按住 C 下蹲：碰撞高度 1.2m、眼高 1.05m、移动速度为站立的55%；头/身体命中体随姿态缩小。头顶空间不足保持蹲下，离开后才能起身；蹲下不保留冲刺高速。
- 大厅、暂停页或默认 O 打开设置，分别保存本模式按键、普通/开镜灵敏度、反转Y。改键检查冲突，可明确交换，Esc 保留取消/关闭；可恢复默认。
- 大厅展示8件模型，一次只载入一件。全部八件都能在对应槽选择作战；战斗只载入当前装备；同款几何共享、实例材质/动画独立，切换和退出会释放资源。
- **当前规则版本8：** 自选配装、近战与下蹲输入及快照需要本次客户端、Colyseus服务端、Cloudflare Worker保持一致。旧版本会明确报不兼容，不会悄悄退化成站立判定。公网发布需要成套更新；见 `../docs/release/DEPLOYMENT_HANDOFF.md`。

完整基线、覆盖与未完成的浏览器/Worker实机检查见 [WEAPON_INTEGRATION.md](../docs/combat/WEAPON_INTEGRATION.md)。

当前双枪＋近战、E/右键和原型参数说明：[LOADOUT_CONTROLS_V3.md](../docs/combat/LOADOUT_CONTROLS_V3.md)。

### 出生与复活无敌

初生、每次复活及每局正式开战均享有完整 2.5 秒（150 个服务器 tick）保护，开火不会取消。所有武器 / Bot 均不能降低受保护玩家或其部署盾的 HP。原 3 秒死亡等待不变。左下角显示中英保护倒计时；离线、Colyseus 和 Worker 共用权威规则。当前客户端与服务器要求规则版本8一致；公网必须同时部署匹配的 Worker 和客户端。详见 [ARENA_SPAWN_PROTECTION.md](../docs/arena/ARENA_SPAWN_PROTECTION.md)。
