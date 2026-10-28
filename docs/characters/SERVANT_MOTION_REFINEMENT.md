# 从者动作修订 · 2026-10-28（云端源码与验收）

## 本次改动

- **拿破仑保持现有精修白马模型**，不替换几何、材质或资产文件。行为改为：寻找可通行的侧向起冲位 → 转向 → 直线骑马冲锋并挥刀 → 减速 → 恢复／冷却 → 再次接敌。
- 保留 `MountedAttack` 原有 **23/30 秒**的命中时刻和上半身刀法。马匹及骑手坐姿下半身采用原有 `MountedRun` 通道，按实际冲锋位移重采样，仍由同一动画 action／mixer 驱动，坐垫和骑手不会分开计时。
- 起冲速度 4.4 m/s，命中后线性减速至零；完整动画约前进 4.77 m。命中范围 2.25 m，固定最初目标；不会在冲锋中追踪转向或把已死目标的伤害转给另一只敌人。恢复 0.7 秒后才重新规划。真实 `WorldCombat.allyStrike` 继续复核敌人存活、视线、距离和原有全局盟友冷却，16 点伤害未改。
- 冲锋前检查完整路线；移动每一步继续检查地面、马匹／骑手完整有向包围体（包括后躯、两侧与头顶），转向也检查中间姿态。悬空、窄边、墙体、低顶、失去目标会安全停止或取消；不能直接到达的起冲位按间隔重新尝试，不播放原地奔跑顶墙。**这是保守的直线路径检查，不是完整绕障寻路系统。**
- **亚瑟王的 Walk 与当前 Idle 共用自然下垂手臂／剑尖向下姿态**，加少量与步态同步的摆臂。原有 Run 与 Attack 不改，攻击切入时按动画权重淡出放松修正；战甲与便服均覆盖。

## 代码

- `world/src/mountedCharge.ts`：接敌、冲锋、恢复、地面和完整身体碰撞；缓存稳定 BVH 包围盒并预筛无关碰撞体。
- `world/src/characters/mountedChargeMotion.ts`：位移曲线与单时钟的骑马攻击合成。
- `world/src/characters/characterKit.ts`：仅为带 mount 的角色使用合成攻击，其余角色不变。
- `world/src/kitCompanion.ts`：骑马行为分支与可选精确目标 ID。
- `world/src/servant.ts`：Idle/Walk 放松姿态混合。
- `world/src/main.ts`：现有 target 回调传递 targetId（主任务接线）。

## 验证

```sh
cd world
node --import tsx --test validation/mounted-charge.test.ts validation/servant-walk-pose.test.ts validation/mounted-combat-qa.test.ts
npm run typecheck
npm run build
```

覆盖：真实敌方 HP 单次减少 16、冷却、23/30 秒精确位移／刀姿、重复冲锋、死亡／替换／逃离目标、暂停／召回、静态和突然启用的墙体、后躯／侧转／低顶碰撞、悬空与不可达起冲点；真实战甲／便服 GLB 的行走下垂手臂、待机过渡和原攻击手臂；真实拿破仑骨架的坐垫同步及奔马腿部。

最终全仓汇总测试由本轮独立 QA 统一执行；本文件不把局部测试当作全仓结果。

## 实际模型预览与限制

扩展交付预览包中 `docs/servant-motion/` 的九张 PNG 是 **Three.js 实际运行时姿态的 CPU 蒙皮快照**，用原始 GLB 材质、贴图、UV 和顶点色在 Blender CPU 离线重渲染，不是概念图，也不是游戏截图。覆盖亚瑟王两套服装的 idle/walk/attack，以及拿破仑冲锋的抬刀、命中、减速三时刻。已修正离线传递的 UV V 方向及顶点色属性；金发与白马资产保持原样。GitHub 不重复提交这些大型单帧 PNG；运行时、测试、重建脚本与 `navigation-budget.json` 均保留。

可复现：

```sh
node --import tsx validation/characters/export-motion-poses.ts /tmp/parhelion-motion-poses
blender --background --threads 4 --python validation/characters/render-motion-poses.py -- /tmp/parhelion-motion-poses ../docs/servant-motion
node --import tsx validation/characters/charge-navigation-benchmark.ts ../docs/servant-motion/navigation-budget.json
```

正常沙盒 Chromium 在页面打开前因 `process_singleton_posix: socket() Operation not permitted` 失败，没有禁用沙盒或绕过限制。**未做实际 WebGL 操作、浏览器动态观感或 GPU 帧率验收**；离线静帧不能证明实时动作流畅度。

导航性能记录使用真实五地区合并碰撞 BVH 加动态碰撞体（26 个）、真实骑马角色、红场连续 600 帧，产生两次命中。包围盒预筛后，普通冲锋帧平均 15 次地面射线 + 2 次身体相交查询；恢复阶段无需导航查询。`navigation-budget.json` 保留 CPU 均值、P95、最大值和冷首帧；冷规划存在约 30 ms 峰值（同时离线渲染的云端环境），**不宣称无卡顿或达到任何实际 FPS**。
