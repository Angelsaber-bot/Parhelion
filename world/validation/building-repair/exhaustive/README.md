# 大世界建筑完整性全量验收 · 2026-11-05

五区正式地图和运行时补充建筑已按下述清单逐项验收，并修复确认的缺口。未解决的已确认建筑缺陷：0。这里的“全量”指当前项目生成、加载的全部建筑与结构单元；烧毁遗迹、施工骨架、露天建筑及效果物有明确分类。

[打开逐项六向图册](index.html) · [下载逐项清单 CSV](buildings.csv) · [完整机器可读台账](buildings.json)

## 覆盖范围

| 范围 | 建筑与结构验收单元 | 六向图复核 |
| --- | ---: | --- |
| 幻日谷 alpha | 112 | 全部 |
| 英国 britain | 170 | 全部 |
| 黑帆 blacksail | 101 | 全部 |
| 永冬 winter | 108 | 全部 |
| 京都 kyoto | 661 | 全部 |
| 五区生成地图小计 | **1,152** | **全部** |
| 运行时补充场景、道具与效果 | **280** | **全部** |

“单元”不等于“栋数”：生成地图含 404 个剩余结构空间格，用于覆盖未通过独立建筑函数创建的城墙、台阶、围栏、支架等。运行时单元含宝箱、线索和能量效果，不能当作 280 栋房屋。五区有 608 栋通过房屋构造函数登记的房屋，另有要塞、寺院、宫殿、教堂、桥梁、码头、船只和营地等。

运行时从真实生产启动流程采集 25 个场景组、1,070 个网格，包含五区聚落、五区任务场地、False Dawn 场地、返程道路、军械服务院、旗舰舱室、OpenWorldAdventure、SunwardExploration、通行附加结构、四区 EraStory 和谷地住宅信号。采集包含当前隐藏的状态网格；角色、生物、原始流式地图另行归属，不重复统计为建筑。

最终台账为 **1,432 项，244 张完整分辨率图集**。每项记录编号、区域、类型、来源、空间范围、状态、检查方法、图片与行号。每行依次为正、背、左、右、上、下六个方向。新增基础的 28 栋房屋使用补修后的独立图集。其余复用图片的顶点、颜色和索引与最终构造数据逐项逐字节一致；最终运行时网格与图集采集数据也逐字节一致。

## 确认并修复的问题

| 位置 | 原问题 | 修补结果与验收依据 |
| --- | --- | --- |
| 京都共用曲面屋顶 | 侧面重复、底面高度与封边厚度不一致，部分檐口开边 | 按真实边界封闭，统一 0.14 m 底壳；452 处正式屋顶实例均做闭合检查；8 组不同尺寸/坡型做正反单面射线回归 |
| 京都完整町屋与封闭厅堂 | 墙体只到檐口，阁楼三角区/曲面下方整片缺墙 | 补齐 **402 组阁楼围护**：391 栋完整町屋和 11 处厅堂；直接对正式压缩地图做 **4,210 次**外侧单面射线检查，0 组失败 |
| 英国聚落铁匠铺 | 后山墙缺失，前山墙斜率与有挑檐的屋顶不合 | 增加前后实心阁楼墙，按实际屋顶坡度接合，入口通道保持畅通 |
| 英国聚落马厩 | 后方阁楼敞口 | 增加后山墙；正面供玩家进入的敞廊保留，射线分别检查封闭面与开放通道 |
| 冬区援助站及共用屋盖 | 装饰木板每层留出约 2 cm 缝隙 | 在装饰板后增加连续厚壁三角填面；共用构件同时覆盖京都聚落对应屋盖；实景与穿缝射线通过 |
| 拿骚四坡屋顶 | 住宅/船长屋缺底面和端部封檐；酒馆端部封檐缺失 | 补闭合薄壳和端部封檐；酒馆沿用原六面内衬，独立验证解码后的原尺寸、内侧法线和向上射线 |
| 黑胡子要塞四座望塔 | 塔身与屋顶间均悬空约 **1.1 m** | 四座塔补连续石鼓座及相同碰撞，接缝两端轻微搭接；四座分别射线复测，实景确认 |
| 京都、永冬坡地住宅 | 墙脚部分高于实际地形；京都 11 栋明显悬空，最严重约 **2.44 m** | 按足迹地形补 **28 处石基**（京都 22、永冬 6），同时生成一致碰撞；全部 608 栋 × 25 点，对正式地形及新增支撑复测，**15,200 点无未支撑缺口** |

京都屋脚的原始高度及每栋复测结果保存在 [ground-findings.json](ground-findings.json)。15 cm 为墙脚暴露检查阈值；大于该值的 57 个采样点均有闭合基础完整跨接至地形。基础生成阈值为 12 cm，包含更小但可修补的缝隙。高坡侧埋入地形的旧房屋定位沿用原布局；本次通过向下补基础处理悬空，不抬动房屋或任务锚点。

保留并登记了 140 栋京都烧毁遗迹，另外保留设计中的敞廊、院落、船坞施工骨架、残骸、帐篷出入口、断桥及效果物。没有把这些开放结构统一封成房屋。

## 检查结果

- 最终 306 个生成批次与正式导出文件逐批三角形数量匹配，0 个不匹配；完整资产标识见 [asset-manifest.json](asset-manifest.json)。
- 131,684 个生成部件做坐标及体积检查：0 个非有限坐标、0 个反向闭合体。
- 92,066 个应闭合部件检查焊接后的边使用次数和方向，0 个开边/方向问题；其中包括 452 处京都屋顶。[闭合报告](shell-findings.json)
- 402 组阁楼围护、4,210 次正式地图射线检查，0 失败。[围护报告](attic-envelope-findings.json)
- 608 栋房屋、15,200 个正式地形采样点，0 个未解决支撑问题。[地基报告](ground-findings.json)
- 数值扫描另记录 806 个零面积冗余三角形（旋转体极点、已有自定义表面及挤出轮廓的重合点）；它们不生成可见面。闭合检查在焊接后忽略这些退化面，其余边仍须严格成对；没有将其当作补洞或通过依据。[数值报告](geometry-findings.json)
- 所有原始有序碰撞三角形、完整布局与无关导出节点继续对历史基线比较。只为三个明确命名的永久支撑批次增加新碰撞：望塔、京都石基、永冬石基；这些支撑在进度重置后保持有效。没有刷新旧基线来掩盖变动。
- **最终全套测试 1,889 项全部通过，0 失败、0 跳过；340 个测试文件，耗时约 11 分钟。类型检查与生产构建通过。** [测试汇总](validation-summary.json) · [完整测试日志](full-suite.log) · [生产构建日志](production-build.log)。此前过高并发运行出现过两项启动超时；最终以并发 3 完整重跑，全部通过。

六向图由真实构造几何/生产启动采集几何在中性光照下离线渲染，默认隐藏背面，以便发现缺面。它不是对游戏材质、帧率或所有摄像机路径的替代证明。已在 Chrome 使用正式默认流式地图复查五区，保留 [native](native/) 下的六张实景截图。布料等双面材质在离线图中可能出现保守的背面隐藏；实际材质契约由现有测试和实景检查确认。

| 实景 | 证据 |
| --- | --- |
| 幻日谷建筑群 | [alpha-campus.jpg](native/alpha-campus.jpg) |
| 英国铁匠铺后山墙 | [britain-forge.jpg](native/britain-forge.jpg) |
| 黑帆望塔接缝 | [blacksail-towers.jpg](native/blacksail-towers.jpg) |
| 永冬援助站阁楼 | [winter-aid-house.jpg](native/winter-aid-house.jpg) |
| 京都曲面屋顶/阁楼墙 | [kyoto-attic.jpg](native/kyoto-attic.jpg) |
| 京都东山坡地石基 | [kyoto-foundation.jpg](native/kyoto-foundation.jpg) |

## 复现

在 `world` 目录执行下列命令。构造明细的大文件放在临时目录；仓库保留可再生成的脚本、逐项台账、图册和汇总。

```sh
node --import tsx tools/build-kyoto.ts
node --import tsx tools/build-blacksail.ts
node --import tsx tools/build-winter.ts
node --import tsx tools/build-stream-assets.ts
node --import tsx validation/building-repair/exhaustive/inventory.ts /tmp/parhelion-building-review
node --import tsx validation/building-repair/exhaustive/prepare-review.ts /tmp/parhelion-building-review
node --import tsx validation/building-repair/exhaustive/analyze.ts /tmp/parhelion-building-review
node --import tsx validation/building-repair/exhaustive/check-shells.ts /tmp/parhelion-building-review
node --import tsx validation/building-repair/exhaustive/audit-attics.ts /tmp/parhelion-building-review
node --import tsx validation/building-repair/exhaustive/audit-ground.ts /tmp/parhelion-building-review
node --import tsx validation/building-repair/exhaustive/export-runtime.ts /tmp/parhelion-runtime-review
node --import tsx --test --test-concurrency=3 validation/*.test.ts
npm run build
python3 validation/building-repair/exhaustive/verify-evidence.py
```

`render-atlas.py` 使用本机已安装的 Blender，接收 `构造目录 输出目录 [区域]`；省略区域则渲染全部。`survey.py` 用 Pillow 拼接四页缩略复核图。`package-evidence.py` 检查复用图片几何一致性并输出 WebP 图册与清单。重新生成全图集时可以直接使用最终构造，不必复用旧图。原始资产和本次交付图像均有 SHA-256，`verify-evidence.py` 可检查当前资源是否与本次验收记录一致。
