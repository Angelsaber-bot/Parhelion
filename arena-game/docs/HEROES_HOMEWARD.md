# Arena v33：交火节奏与归灯回街

本地开发版。只修改 Arena 及其本地启动检查，不提交、推送或公网部署，不改 World。启动项目根目录「启动 Parhelion.command」，进入 Arena；当前打开的 127.0.0.1:4173/arena/ 已在 Chrome 中核对 v33、七位角色和新封面。旧服务器进程若用于本地联机，需重新运行启动器以载入 v33 服务端规则。

## 本地构建

```sh
npm run build:local --prefix arena-game
```

脚本只替换 Arena 客户端与本地 server.cjs，保留 World 输出并检查哈希。启动器检查源码指纹和已安装文件；源码指纹也包括 HOMEWARD 的地图数据及 GLB。规则版本 33，不能连接仍运行旧规则的服务器。

## 战斗调整

200 HP（v38 起，原 150）、5.2 m/s 基础移动、公共枪械保持原有规则。除阿尔托莉雅的主动格挡 / 风斩外，技能施放可继续射击、开镜和换弹。技能放置使用水平朝向，避免低头瞄地；常驻地面瞄准环不显示。武藏燕返可以射击，但不能同时叠加普通冲刺或跳跃。v35 起四个技能改为即时生效：炮弹、钩索、燕返都沿准星发出，技能按下后 0.3 秒内见效。

| 角色 | 当前行为 | 冷却 |
|---|---|---|
| 阿尔托莉雅 | 风王铁槌（v35）：轻点 Q：12 米 / 90° 风斩 80 伤害，把敌人推开 3 米；长按最多 0.6 秒正面格挡 150 伤害，正面飞来的炮弹和钩索也会被挡下并计入格挡，风斩随吸收量提高至 110；3 帧起手、6 帧恢复。定位：近身爆发、克制飞行技能 | 8 秒 |
| 黑胡子 | 接舷钩（v35）：3 帧起手，沿准星射出 80 m/s 钩索，24 米内钩中敌人（钩爪判定半径 0.7 米） 30 伤害，并拽到身前 2.5 米（拖拽中不能移动、冲刺、跳跃），之后减速 0.5 秒。墙和护盾挡钩；空钩返还 40% 冷却 | 10 秒 |
| 武藏 | 燕返（v35）：3 帧起手，沿准星方向 0.15 秒突进 6 米，扫过的敌人各受 70 伤害（每次施放每人一次）；斩杀立即刷新冷却。突进中可射击，全程可受伤，碰撞扫掠不穿墙 | 8 秒 |
| 拿破仑 | 战争之神（v35）：3 帧起手，沿准星轰出 70 m/s 贯穿实心弹，射程 45 米。穿过路径上每个敌人各 70 伤害并击退，直接击碎护盾，撞墙时炸开 2.5 米 35 伤害；后坐力把拿破仑向后推 3 米。与阿尔托莉雅的近身扇形风斩区分：远程、直线、可穿多人、自带后撤 | 11 秒 |
| 贞德 | 0.1 秒立旗，6 米内可见友军立即回 30 HP；随后 3 秒每 0.25 秒回 5 HP，枪伤减免 25%。100 HP 圣旗，不能复活或超额治疗 | 12 秒 |
| 奥斯曼迪斯 | 0.1 秒部署、0.25 秒预警后发出 4 次 30 伤害审判，间隔 0.4 秒，16 米 / 100°；Q 可转向。80 HP，墙、烟、盾有效 | 12 秒 |
| 秦始皇 | 定身令（v40）：0.1 秒施放 + 0.2 秒预警，御令落在准星处（18 米内，准星附近的敌人会被自动对准）。8 米内敌人定身 0.7 秒（不能移动、冲刺、跳跃，仍可射击；穿墙、穿建筑、透烟，只有上下层不算），5 秒内受到伤害 +25% 并对秦始皇一方透视（隔墙显示轮廓），与御令区域同时结束。御令区域保留 5 秒，区域内敌人减速 35%（离开后 0.1 秒恢复）。无伤害、无可破坏物 | 11 秒 |

HERO_COMBAT 是权威规则、预测及特效预警共用的数值源，内容指纹包含该表。成功施放取消出生保护；冷却在死亡 / 复活期间继续。攻击检查队伍、保护、碰撞和视线。可摧毁物在该 tick 被打碎后不再施效。

## 地图与美术

HOMEWARD 的封面改为 shipped GLB 的真实 Three.js 渲染 JPG，移除占位 SVG。地图补充瓦顶、木构立面、窗框、烟囱、信息亭、石砖、木纹和瓦面；材质内嵌 baseColor / ORM / normal，并采用保留材质通道的渲染路径。远山与镇屋位于场地外。材质由仓库现有 erakit 数学生成器生成，配方与 provenance 在 homeward/assets/materials 中。

地图生成：使用安装 Pillow 的 Python 运行 arena-maps/homeward/source/build.py（本机 /opt/anaconda3/bin/python）。缩略图构图源在 homeward/source/preview.ts，选用「灯院近景」。

78 个碰撞对象、15 个锚点、10 条路线保持不变。644 个高台视点检查、两侧寻路时间差小于 0.25 秒、地面采样最长视线小于 40 米均通过。

## 角色模型

沿用 World 的七个原模型，不改原资产。Arena 独立骨骼、动画、持枪姿势和缩放适配；拿破仑提取骑手并复用黑胡子步行动画。贞德的两份 gzip 分片在 prebuild/predev 合为单一资源，额外 UV4 材质在 Arena 声明并绑定。

原模型适配不代表人工动画、衣摆 / 武器穿插、性能与动作观感已达到最终验收标准。

## 验证边界

TypeScript、Vite、本地安装通过。50 份非 socket Arena 测试共 837 项：首次全量 836 通过，1 个新测试错误地假设横向冲刺能立刻离开宽幅齐射；改为沿浅炮击带纵深冲刺的反制场景后，该文件 10 项补测通过。另 4 项本地版本 / HTTP 测试通过。测试包括移动目标、首次起效时间、冷却防连发、枪战兼容、领域摧毁、地图寻路与材质。

实际 Chrome 验证 v33 新封面、角色冷却及技能演示，检查无浏览器错误。没有新增多人 / LAN 试玩或 GPU 帧率验收，不能将数值测试视为统计平衡已完成。6 份 socket 文件未跑：chapter-network-qa、server、session-rematch、spawn-protection-network、worker-protocol、colyseus-session-lifecycle。

## Arena Frontline UI — local build

The lobby now uses three keyboard-accessible preparation tabs: Battlefield, Heroes, and Loadout. Desktop keeps deployment controls in a fixed right column; narrow windows stack the controls without horizontal scrolling. Map selection updates the featured scene photograph. The hero page uses a dedicated World-model stage, monochrome character insignia, live loadout/finish preview, readable ability details, and the existing deterministic eight-second demonstration.

The HUD separates health, ability controls, and ammunition. Cooldown values no longer cover ability names or bindings. The site home overlay is hidden during play so it cannot obscure the score. Crosshair contrast is strengthened without changing aim behavior. Settings, workshop, loading, pause, and result panels share the same ink/brass palette. Ability rebinding updates visible instructions; language changes keep current preparation state.

Validation: 837 non-socket Arena tests passed; 94 related tests passed again after the final behavior edits; four local-install checks passed. Production typecheck/build completed and the local install fingerprint/hashes matched. Browser checks covered tab and map selection, weapon selection, skin workshop, Chinese/English, narrow layout, rebinding and restoring Q, model/ability previews, pause/return, and the actual training HUD via the existing `?test&autostart&mode=range` entry. Normal browser automation could not acquire pointer lock, so this is not a manual full-match playthrough. No online regression or deployment was performed. World build preservation check: 76 files.

Local visual evidence and exact installed-build verification are in `.scratch/arena-frontline-*.jpg` and `.scratch/local-verification.json`.
