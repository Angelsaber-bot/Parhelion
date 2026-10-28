# 男性主角与渲染优化：云端独立验收

基线：`d8183368fc57f13198daa9de7e9c48503d053688`。范围仅云端修改与验证；未推送 GitHub，未同步桌面，未发布公网。

## 验收状态

- 代码整合检查：299 项测试通过，TypeScript typecheck、Vite production build 通过。最终冻结资产修正后已再次通过。
- 美术仍为**可评审候选**，不是精品完成承诺。已通过多轮实际 Blender 图像审查发现并修正发帽空隙、腰带穿插、衣摆过度翻起、背负枪悬空等问题；最后一轮确认俯头冠顶已封闭、静态裙侧穿插已消除；奔跑时衣摆仍有可见黑色条状穿插/折叠，游泳腰背内衬偏硬，因此美术尚未完全验收。
- 11 张图是**实际运行时模型与姿态的离线渲染**，不是实时游戏截图：`buildCharacter` + `CharacterAnimator` + `attachExplorerRifle` 加载实际 `01_Dawn_AR.glb`，等待完成后导出，再用 Blender CPU 渲染。未用生成图替换模型、未美化修图。
- 真实浏览器 GPU 帧率、Retina 跨屏实机、最终游戏 shader/光照效果尚未实测；没有绕过云端浏览器安全限制。

## 自动检查内容

独立检查覆盖：所有动画关节及动态 matrix 更新，idle/run/swim/glide/ADS，实际 AR 与 fallback 在 -0.5/0/+0.5 rad 时双手握点误差 <2 mm；索引范围、量化法线与三角预算；源 GLB 与运行时主体逐关节几何一致。

渲染检查覆盖：实际 Three.js EffectComposer 初始/resize/DPR 单次缩放，保存设置与 URL 优先级、存储异常/未知旧值回退、无 resize 的 DPR 变化接线、截图模式禁用自适应；一次 reset 统计整个 render frame 的全部 passes。

静态冻结只适用于不可变地图美术。25 项独立用例验证 Water/TGT_、spin/bob/dynamic/showWhen/hideWhen/opensWhen 出现在自身、祖先、后代时均不被冻结，旁支角色与 visibility 保持正常。实际五地图75个动态/状态对象受到保护；地图资产未改。

## 清晰度与成本

默认是固定均衡模式，DPR 最高1.25，取消旧的隐式0.6降分辨率。用户可选原生清晰模式最高2；2相对1.25有2.56倍像素面积（+156%），**不能称清晰度提高一定带来FPS增加**。自适应明确选择才开启、正常设备下限1；低特效上限1。阴影、草地、材质细节未作为默认优化手段静默删除。

静态矩阵和距离剔除优化有 CPU 工作量收益，但不是 GPU 帧率证据。微基准使用同状态/步长/预热，计时仅 animation + hierarchy update。模型几何比旧2662三角主体复杂，整体GPU成本必须实机验证。

## 资产与交付证据

主体与完整装备指标必须区分：主体12网格/1材质；完整rig含真实AR、滑翔翼的网格/三角清单不等于屏幕可见绘制调用，也不含 outline、shadow 或 post passes。精确最终哈希与数字见后续本文件附录。

可复现脚本：
- `validation/benchmarks/player-render-baseline.ts`：CPU计时（不是FPS）。
- `validation/benchmarks/export-player-poses.ts`：实际AR默认、`--fallback`仅显式诊断。
- `validation/benchmarks/render-player-poses.py`：11视图Blender CPU渲染。
- `validation/benchmarks/map-art-inventory.ts`：地图哈希与静态保护清单。
- `validation/benchmarks/make-player-review-boards.py`：只拼接原始图像。

构建仍有单JS包超过1200kB的warning；同步模型数据增加初始包体积。没有将此成本隐藏为性能全面提升。

## 最后候选指标（2026-10-28 UTC）

- 主体：45,541 三角形 / 12 网格 / 1 材质。量化JSON 771,098 bytes；GLB 1,176,064 bytes。
- GLB SHA-256：`6f3d5bb4fed9c7e1772ee2558b9d8ab73b06011ac95776dbb7e05b24f7b37f89`。
- 完整rig + 真AR + 滑翔翼：39 网格 / 86,037 三角形（库存统计，不含outline与多pass，不是实际GPU draw）。
- 新增短衣摆局部形变避免刚性裙片穿腿；2项独立回归测试通过：不可变rest缓存、重复姿态无漂移、零角恢复、run→idle→swim→idle恢复，法线有效及剔除球覆盖。
- 包含衣摆更新的CPU微基准约0.03298ms/次，旧模型约0.00584ms/次（同6000预热、9×12000、1/60固定步骤）。这是模型动画成本增加，不能用静态地图优化掩盖它；不代表FPS。
- 最终原图目录：`protagonist-review/player-runtime-release/`（11张实际运行时姿势的离线渲染）；交付板在`protagonist-review/delivery/`，只原图拼接。

最终验证日志：`qa-release-tests.log`（299/299）、`qa-release-typecheck.log`、`qa-release-build.log`（全部成功）；CPU记录`player-baseline-cpu-final-session.json`与`player-final-cpu.json`，在离线渲染结束后连续运行。图板不隐藏剩余衣摆缺陷。
