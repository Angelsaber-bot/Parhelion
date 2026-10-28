# 宫本武藏自然移动修订 · 2026-10-28（云端源码与验收）

## 结果

- 只处理 `CharacterKit` 中 **id = musashi** 的 Idle / Walk / Run；上臂从原来的横向持刀警戒姿态放松到接近竖直，手肘轻弯，双刀斜向后下方，随同侧腿反向摆动。
- 保留原有髋部起伏、腿部落脚与名义步速；胸背增加很小的反向扭转和呼吸，颈部作小幅补偿。没有独立的第二动画时钟、每帧 IK 或额外的运行时累加修正。
- 调整在加载时烘焙为普通动画通道，由现有单个 mixer/action 和 0.18 秒过渡处理；中断、切换和回到待机都沿用原有动画机制。
- 原始模型、脸、发型、材质、服饰、刀、刀鞘、手指握姿、插槽、本地刀柄位置，以及 Attack 全部保留。**19/30 秒右刀、33/30 秒左刀**两次事件、攻击距离、伤害和冷却不变。
- 黑胡子不参与此修正；拿破仑现有白马冲锋分支与亚瑟王双服装动作均通过回归检查。

## 真实模型与战斗测试

使用项目实际 Three.js `GLTFLoader`、动画 mixer、CPU 蒙皮顶点和真实 `WorldCombat.allyStrike`，不是只检查源代码字符串。

| 指标 | Idle | Walk | Run |
|---|---:|---:|---:|
| 完整刀刃最低离地高度（120 个相位/周期） | 34.43 cm | 29.42 cm | 26.28 cm |
| 刀刃顶点至身体/衣料/腿部表面最小采样间距（12 个相位） | 5.05 cm | 5.08 cm | 3.86 cm |
| 脚底最低点 | −0.001 mm | −0.509 mm | −1.879 mm |

- 36 个独立姿态的完整刀刃与身体/衣料/腿部三角形 BVH 相交测试均无相交（排除应该握住刀的手臂/手指）。表面间距是顶点采样值，不等同于连续时间的全局最小间距。
- 两把刀的真实蒙皮采样点始终固定在各自原手骨坐标内；刀柄插槽的父节点、位置和旋转不变。
- Idle / Walk / Run / Attack 全部 12 种有向切换，在 120 Hz 下测试；最低刀刃高度 13.79 cm，最大相邻帧手部位移 4.66 cm。另覆盖快速中断、暂停、召回、连续 10 周期不漂移。
- 与原始 Attack 逐骨对比，两次命中时的全部骨骼旋转不变。原始 hip / leg / foot / toe / finger 通道逐值不变。
- 真实战斗：第一次接受的命中减少 9 HP；第二刀仍发出 33/30 秒事件，但**现有的全局盟友 1.1 秒冷却**会拒绝该次伤害，下一轮连招仍正常。此修订没有擅自改变这一已有战斗规则。视线丢失、暂停与召回均无迟到伤害。
- 本地针对性测试 **20/20 通过**，含通用 CharacterKit、亚瑟王与拿破仑回归；类型检查、生产构建通过。最终全仓检查由独立 QA 汇总，局部结果不是全仓结果。

```sh
cd world
node --import tsx --test validation/musashi-locomotion.test.ts validation/musashi-combat-qa.test.ts validation/character-kit.test.ts validation/servant-walk-pose.test.ts
npm run typecheck
npm run build
```

## 预览与复现

扩展交付预览包保留原始 Walk 对照，以及修订后的 Idle、两个 Walk 相位、Run、两次原始 Attack 命中。GitHub 的 `docs/musashi-motion/` 仅保留精简步态拼图与量化记录，不重复提交单帧 PNG 和 GIF。它们是**真实运行时姿态的 CPU 蒙皮快照 + 原 GLB 材质/贴图的 Blender CPU 离线渲染**，不是概念图、素材替换或游戏截图。

```sh
cd world
node --import tsx validation/characters/export-musashi-poses.ts /tmp/parhelion-musashi-poses --baseline
node --import tsx validation/characters/export-musashi-poses.ts /tmp/parhelion-musashi-poses
blender --background --threads 4 --python validation/characters/render-motion-poses.py -- /tmp/parhelion-musashi-poses ../docs/musashi-motion
# 固定摄影机的完整步行周期，16 个实际运行时相位：
node --import tsx validation/characters/export-musashi-poses.ts /tmp/parhelion-musashi-cycle --walk-cycle
blender --background --threads 4 --python validation/characters/render-motion-poses.py -- /tmp/parhelion-musashi-cycle /tmp/parhelion-musashi-cycle-renders
```

交付预览包中的 `musashi-walk-cycle.gif` 与仓库中的 `musashi-walk-cycle-sheet.jpg` 展示固定摄影机的 16 个步行相位；GIF 总时长 1.070 秒，近似原始 1.0667 秒周期，不是实时帧率或连续 GPU 验收。可用 `python validation/characters/assemble-musashi-cycle.py /tmp/parhelion-musashi-cycle-renders ../docs/musashi-motion` 重建。

`validation.json` 记录实际量化结果、运行时文件与预览 SHA256，以区分最终修正后的姿态和早期草案。

**限制：**云端正常沙盒浏览器此前在打开页面前因 `socket() Operation not permitted` 被阻止；本次没有重试、禁用沙盒或绕过限制。没有实际 WebGL 操作、游戏内动态观感或 GPU 帧率验收；离线预览和数值测试不能冒充浏览器验收。本记录不包含桌面同步或公网部署；GitHub 发布以仓库提交记录为准。
