# Parhelion · ASTER 研究站竞技场 0.3.0 + 输入修复

Arena 位于仓库的 `arena/` 目录，独立于 Claude 负责的 World。72 × 56 米，1 Blender 单位 = 1 米，支持为未来 1v1／1v2／2v2 布局检查。此版本完成第一轮模型美术细化，尚非最终美术或战斗平衡验收。

模型采用原创非写实研究站风格：HELIOS 中央实验装置、分层护甲掩体、观察窗与通风口、模块墙板、结构肋、坡道防滑条、金属收边与克制发光标记。材质区分涂装金属、裸露钢、混凝土、橡胶和不透明的深色玻璃。玻璃当前用不透明 PBR 表面表现，避免透明排序与过度叠绘。没有使用外购贴图或商业地图资产。

**已实现：** 第一人称行走、简化墙体/掩体碰撞、重力、三条坡道、地图和路线巡检；浏览器实际读取 Blender 导出的视觉 GLB 及其 PBR 材质。**未实现：** 枪械、伤害、AI、联机、冲刺、技能、可破坏护盾、战斗重生及 World。竞技平衡和跨设备性能仍需后续验证。

## 方向键锁死 / 滑行修复（2026-10-26）

窗口或标签页切换、鼠标锁切换、Esc、俯视/出生点切换、菜单和表单焦点变化会清空移动与转向按键。恢复后须松开并重新按键；旧的自动重复事件不会重新激活方向。连续正常按住不设超时，WASD 步速、斜向归一化、碰撞和重力保持不变。超过 1 秒的渲染中断也会清空输入。

自动巡检在上述中断时暂停，需要重新点击“步行巡检”，不会在切回窗口后自行滑行。鼠标锁不可用时仍支持 WASD 和方向键。

本次 37 项输入单测与 45 项模拟 DOM 的实际 app/物理集成检查通过；原版在同一 45 项集成断言中有 30 项失败。真实浏览器未能在当前云端启动，不能把这些自动化检查称为真实键盘/指针锁验收。详见 [输入修复记录](docs/INPUT_FIX_2026_10_26.md)。

## 本机启动

双击 `Open-Aster-Map.command`，或在本目录执行：

```sh
python3 serve.py --open
```

默认 `http://127.0.0.1:8744/runtime/`，仅监听本机。端口属于其他目录、旧版本或其他进程时退出提示，不结束任何已有会话；可运行 `python3 serve.py --open --port 8745`。相同目录的同版本已运行时只打开已有查看器。不要直接打开 HTML 文件。

WASD 移动，鼠标锁定后观察，方向键也能转向，Esc 释放鼠标。1／2 返回出生区，M 俯视，R 路线。自动巡检仅为查看工具，不是敌人 AI。0.3.0 美术版的 Mac 内嵌浏览器验证属于历史记录；本次输入补丁的真实浏览器检查尚未运行。

## 编辑与导出

- `assets/aster_research_station.blend`：原生 Blender 场景。`VISUAL` 为 57 个基础实体；`DETAIL_*` 保留 883 个独立命名细节；`COLLISION` 为 36 个简化代理；`ANCHORS` 为游戏锚点；`PRESENTATION` 为灯光和相机。`EXPORT_BATCHES` 是隐藏的导出用合批副本。
- `assets/station_visual.glb`：73 个网格（57 个基础实体 + 16 个细节材质批次），98,004 三角形，16 个 PBR 材质，约 5.33 MB。没有外部纹理依赖。
- `assets/station_collision.glb`：36 个代理，432 三角形，约 57 KB。装饰无碰撞；运行时仍用 `map.json` 与原 0.2 碰撞求解器。
- `source/make_map.py`：游戏布局；`source/build_blender.py`：可重复生成的完整美术建模源。
- `previews/`：三张原生 Blender 设计预览；不包含浏览器截图。
- `validation/`：几何、移动、GLB 和细节净空检查及报告。

脚本重建会覆盖本目录的输出。手工编辑 `.blend` 前请另存副本，避免重建丢失手工修改。当前导出批次由脚本生成，直接编辑细节后须重新合批导出。通用 glTF 导入器可读取 GLB；附带查看器只支持本项目使用的静态、无压缩、内嵌缓冲及纯因子 PBR 子集，遇到不支持的纹理等特性会明确报错。

```sh
python3 source/make_map.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python-exit-code 1 --python source/build_blender.py
node validation/offline_check.cjs
node validation/movement_audit.cjs
python3 validation/check_exports.py
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 2 assets/aster_research_station.blend --python validation/audit_model.py
node validation/detail_clearance.cjs
```

只重建模型/导出、不重渲预览时，在建模命令末尾加 `-- --no-render`。本次 Mac 沙箱内 Blender 在 Metal 初始化阶段崩溃；授权的正常本机执行成功，未改变安全设置、权限或安装软件。

## 0.3.0 历史美术验证与限制

游戏对象、路线、玩家参数和 `physics.js` 与已修复的 0.2 基线相同，仅更新版本号。保留 4.775 米坡侧通道、5.2 米出生转弯、6 米庭院入口、8／6 米坡宽及 4.2 米/秒步速。48 项基础与 164 项扩展检查通过，14,330 个通行节点完全连通，10,204 条高台至出生点视线射线均被遮挡。

实际按键复测：西出生区至庭院、中央坡道到 3 米高台、东西侧坡道、侧缘跌落后逃离、坡前/坡后窄通道、东出生区转弯、南侧地面侧翼及外边界。视觉基础实体与碰撞体边界误差小于 0.000001 米；3,129 个路线采样点未与装饰占用发生交叉，57 处坡道防滑条的表面高度偏差小于 6 厘米。

本机内嵌浏览器 1280 × 720 CSS 视口、像素比例上限 1.5 的样本约 60 fps，帧时 p50 16.7 ms、p95 17.4–17.6 ms，俯视约 79 次绘制。固定场景阴影缓存、单个方向阴影贴图 1536²；不承诺通用帧率。动态物体将来加入时需更新阴影刷新逻辑。装饰按材质整图合批减少绘制调用，细节批次的空间剔除粒度较大。还没有武器和敌人，不能据此声称战斗场景性能或平衡完成。

上面的美术与 Mac 浏览器数据来自原 0.3.0 包，不是本次云端重测。输入修复只修改 `arena/`，不修改 World 或 SABLE DIVIDE；地图、物理、Blender 与 GLB 资产保持原样。完整 Arena 代码、资产和回归测试随本次修复一起提交。

在任意安装 Node.js 18+ 与 Python 3 的系统可运行（不需要 npm 包或 Blender）：

```sh
sh validation/run_checks.sh
```
