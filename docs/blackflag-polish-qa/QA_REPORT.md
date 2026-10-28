# BLACKFLAG 独立 QA · 2026-10-28

**云端源码与资产交付；未推送、未部署、未执行 Mac Work。**

- 基线：已发布修复版 `24b0f13` 的冻结副本。
- 最终视觉 GLB SHA256：`1dd80d4a1c1abc7ea549688d3b339d0c02fe1d46b9c9b4c5d5a28b8f8021aa05`。
- 原基线 GLB SHA256：`e72df2656cc7133b104fd5ba9a549cfd34ac0a52055d802fb030ab40d2965100`。
- 最终检查、构建、预览、缩略图与对比图已用哈希关联；见 [最终一致性审计](final-evidence-audit.json)。

## 已通过

| 检查 | 结果 |
|---|---|
| Arena 全部自动化测试 | 21 个测试文件，318 项通过 |
| 客户端和 Worker TypeScript | 两个项目均通过 |
| Arena 生产构建 | 通过；产物 GLB 与源码资产字节一致 |
| 构建静态资源路径 | 3 个入口引用、25 个资源引用通过；不是 HTTP 测试 |
| 共享 GLB / 代理检查 | 449 项通过 |
| 美术、UV、法线、预算与物理指纹检查 | 446 项通过 |
| 独立材质检查 | 7 张内嵌 PNG 解码、纹理通道、UV 与索引检查通过 |
| 干净临时目录连续重建两次 | 11 个生成文件完全一致，且匹配最终交付资产 |
| 保护范围 | 702 个文件与基线逐字节一致 |

保护范围包括 BLACKFLAG 的完整 `runtime/map.json`、碰撞 GLB、共享物理/规则、服务器、其他所有地图、World、武器、既有测试与共享氛围。只有 BLACKFLAG 缩略图及共享预览清单中的 BLACKFLAG 项获得额外更新授权；其他地图预览清单项不变。

路线、出生点视线、机器人连通性/对战、移动边界、跳跃/冲刺边缘回放属于自动化规则测试；**不等于完整人工试玩或 PvP 平衡验证**。原测试文件没有被削弱或修改。

## 预算与已知取舍

| 资源 | 基线 | 最终 |
|---|---:|---:|
| GLB 字节 | 3,933,468 | 3,507,008 |
| 三角形 | 42,940 | 49,879 |
| 材质 primitive | 126 | 141 |
| 内嵌 PNG | 6 | 7 |
| 内嵌纹理编码字节 | 105,430 | 100,693 |
| GLB 内嵌灯 / 透明材质 | 0 / 0 | 0 / 0 |

保留 **小于 50,000 三角形 / 4,000,000 字节** 上限；最终仅剩 121 个三角形的名义余量。局部材质批次上限从 128 明确调整为 160，实际141，比基线增加15。模型文件更小不代表 GPU 更快；**没有宣称帧率提升**。

运行时仅在 `id === 'blackflag'` 使用独立氛围、选择性静态阴影和环境特效。高质量144点/2个点绘制对象，低质量32点/1个点绘制对象；一个不投影的弱填充方向光；复用现有辉光纹理，不新增纹理、渲染目标或自定义 shader。

独立 CPU 审计在高/低质量各执行60,000次更新，加入 NaN、Infinity、负值及300秒间隔输入：对象、材质、几何和 typed buffer 身份保持不变，粒子始终有限并在保守剔除球内；海面光点在甲板外，日光微粒高于作战视线带；重复 dispose 恰好释放一次且保留共享纹理。此为资源/边界审计，**不是 JS 堆基准、GPU 基准或 FPS 测量**。

## 实际像素证据

- [同镜头俯瞰前后对比](comparison-overview.jpg)
- [同镜头玩家视线前后对比](comparison-lane.jpg)
- 最终原始 PNG：[俯瞰](after/blackflag-overview.png)、[甲板视线](after/blackflag-lane.png)、[桅帆轮廓](after/blackflag-rigging.png)、[高台甲板](after/blackflag-deck.png)、[炮架](after/blackflag-cannon.png)、[炮口](after/blackflag-cannon-front.png)、[船尾侧廊](after/blackflag-stern.png)。

前后主视图使用同相机位置/目标/镜头/投影、同中性光照、1296×864、Blender Cycles CPU、64 samples。原始 PNG 保留；对比 JPEG 仅并排排版与标签，无补画或重新打光。最终七个视角已检查实际像素：分层桅帆、深色后帆、门窗木作、侧廊、黄铜饰边与炮架/炮口清楚；未见需阻塞交付的明显接缝、穿插或路线可读性问题。

这些是**实际 GLB 的离线渲染**，不是浏览器截图，也不是 AI 概念图。Three.js 的 PBR hook、选择性阴影策略、天空、雾、填充灯、粒子和后处理不在这些中性渲染中复现。新运行时氛围/特效仅由源码、实际 GLTFLoader 和 CPU 测试验证，不宣称已经完成运行时视觉验收。

地图规范预览 PNG/JPG 与640×427 WebP 大厅缩略图均来自本轮最终实际 GLB；[缩略图来源](thumbnail-derivation.json)及 `arena-maps/chapter-preview-sources.json` 已更新。

## 限制

普通 Chromium 启动在本云环境遇到 `process_singleton` / `socket()` EPERM，因此没有浏览器/WebGL 实景、真实设备 GPU/FPS、Safari、完整人工试玩或公网 Worker 验收。没有通过 `--no-sandbox`、更换环境或其他方式绕过限制。没有推送、发布、部署或访问用户 Mac。

## 复现与文件

`diff-manifest.json` 列出相对基线的源码/资源变更及前后 SHA256；`protected-baseline.json` 固定保护文件与明确例外。运行独立基线比较时，通过 `QA_BASELINE_ROOT=/path/to/frozen-24b0f13` 指向完整冻结基线；默认记录的是本次云端路径，不假设接收者机器有同一路径。

```sh
python3 docs/blackflag-polish-qa/run_arena_checks.py
QA_BASELINE_ROOT=/path/to/frozen-24b0f13 python3 docs/blackflag-polish-qa/verify_candidate.py
python3 docs/blackflag-polish-qa/check_arena_build.py
node docs/blackflag-polish-qa/audit_effects.mts
python3 docs/blackflag-polish-qa/verify_evidence.py
```

Node24原生 TypeScript stripping 可执行 CPU 审计；无需启动被禁的 tsx IPC socket。检查脚本、最终 JSON 与日志保留在本目录。交付包为增量源码/资产，依赖完整基线项目；不包含 `node_modules`、构建目录、旧中间渲染或自动发布脚本。
