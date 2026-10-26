# PARHELION · 旅人武装 / 第一套精细外观资产

**版本：1.0 · Blender 4.3.2 · 2026-10-26**

这一套是 5 把枪 + 3 类近战的原创、虚构游戏美术模型。保留二次元清晰轮廓，采用象牙白包覆装甲、深蓝灰骨架、铜色结构点缀和少量青色/琥珀指示光。不是现实武器设计，也不包含可制造的内部机构、装配公差或功能结构。

## 交接清单

| 编号 | 暂定中文名 | 英文资产名 | 类别 / 轮廓区分 |
|---|---|---|---|
| 01 | 曙光 | Dawn AR | 突击步枪；流线楔形机身、分层护木、常规尾托 |
| 02 | 流萤 | Firefly SMG | 冲锋枪；紧凑高机身、骨架式尾托、短前握把 |
| 03 | 余辉 | Afterglow Shotgun | 霰弹枪；宽厚分节前护木、上下双重外观管线 |
| 04 | 子午线 | Meridian DMR | 精确射手步枪；后置弹匣、开放式拇指孔框架 |
| 05 | 长夜 | Longnight Sniper | 狙击步枪；长外观枪管、悬浮框架护木、大镜体 |
| 06 | 折光 | Refract Blade | 单手刃；渐薄斜刃面、开放护手、分层握把 |
| 07 | 流星 | Meteor Polearm | 长兵器；连续分节长柄、刃头/柄过渡、尾部配重 |
| 08 | 断层 | Faultline Hammer | 科幻战锤；非对称锤头、凹入圆形能量芯、包覆端盖 |

名字为本套的工作命名，不代表游戏数值、技能或平衡设计已定案。

### 文件夹

- `blender/`：8 个单件原生 `.blend`，每件含可编辑网格、分件节点、材质、摄影棚和相机；另有总览 `.blend`。
- `glb/`：8 个 glTF 2.0 二进制 `.glb`，仅资产本体，不包含展示台、灯光和相机。
- `previews/`：8 张单件 2000px 渲染，总览图，以及 `detail_views/` 的背部三分之四角度细节检查图。
- `source/`：可复现模型、渲染和验证的 Python 源码；只依赖 Blender 内置 Python / 标准库。
- `checks/`：最终网格统计、GLB 结构检查和重新导入检查结果。

## 资产与引擎约定

- **Blender：+X 为朝前/刃尖方向，+Z 为上，Y 为左右。** 主要展示侧在 -Y。
- 导出采用 glTF 标准的 **+Y 向上**；导入其他引擎时，使用其 glTF 坐标变换，不要再凭经验手动多转一次。
- 场景使用米制单位设置，但造型比例是**抽象游戏美术比例**，没有按任何真实型号标定。接入时按角色手型和游戏视野统一缩放，不应当作现实制造尺寸。
- 单件 `*_ROOT` 位于资产局部原点。枪械原点靠近机身/握把上方；近战原点靠近刃头/柄过渡。每个分件使用命名枢轴，具体位置已记录在 `checks/*_mesh.json`。
- `00_Parhelion_Armory_Master.blend` 是展示排版：根节点已平移、旋转，部分近战调整了显示比例。**引擎接入请使用单件 GLB，不使用总览排版坐标。**

### 分件 / 动画准备

- 枪械分件：`body`（固定外观）、`stock`、`optic`、`trigger`、`bolt`；有外置弹匣的型号另含 `magazine`。
- 余辉霰弹枪另含 `fore_end`；长夜狙击枪另含 `support`。
- 近战分件：`body` 与 `cosmetic_core`（装饰发光核心）。
- 所有分件均为**外观动画节点**，不是功能性机械模型。原点已分离并命名，便于后续做换弹、拉机柄、检视等游戏演出。
- **本次没有骨骼、动画片段、手部/角色绑定、碰撞体、LOD、枪械逻辑、射击特效或音效。** 这是一套可用于引擎导入和后续动画的静态高细节资产，不是已经接入运行的游戏系统。

## 材质、UV 与性能

- 使用可导出的 Principled / glTF 金属度-粗糙度 PBR 参数：象牙外壳、深色金属、橡胶、钢、铜、青光、琥珀、镜片等语义材质槽。
- **无外部贴图依赖，也没有声称包含手绘纹理或烘焙法线图。** 刻字、接缝和主要硬表面细节是几何；镜片采用不透明有色美术材质，不模拟真实光学。
- 二次元感主要来自轮廓、块面与配色；GLB 不包含 Blender 专用描边、分阶光照或 bloom 后处理，接入引擎时可另行配置，不能假定随文件自动携带。
- 每个网格包含 UV0（Smart UV 分岛）。各分件之间不是一个唯一全局图集；若需要统一蒙皮/单贴图、磨损纹理或极低 draw call，请后续做专用贴图图集和烘焙。
- 倒角已烘焙为网格，模型可以在 Blender 编辑；完整程序化造型逻辑保留在源码中。
- 本套偏向**第一人称高细节档**，并非移动端最低配置。材质拆分与几何文字增加绘制调用；实际统计见下表与验证 JSON。没有凭空宣称已达到某一平台帧率。

| 资产 | 三角形 | 原生顶点 | GLB 顶点（含 UV/法线接缝） | 材质 | PBR primitives（未合批） |
|---|---:|---:|---:|---:|---:|
| 01_Dawn_AR | 40,360 | 21,534 | 71,560 | 9 | 26 |
| 02_Firefly_SMG | 27,828 | 15,012 | 47,618 | 9 | 25 |
| 03_Afterglow_Shotgun | 29,908 | 16,500 | 51,298 | 9 | 26 |
| 04_Meridian_DMR | 40,266 | 21,526 | 63,019 | 9 | 22 |
| 05_Longnight_Sniper | 47,542 | 25,266 | 73,222 | 8 | 28 |
| 06_Refract_Blade | 15,676 | 9,004 | 22,879 | 8 | 9 |
| 07_Meteor_Polearm | 32,094 | 16,926 | 40,601 | 8 | 9 |
| 08_Faultline_Hammer | 37,802 | 20,258 | 51,718 | 9 | 11 |

“PBR primitives”是按 GLB 材质/分件拆分的未合批绘制单元数，不是实机 draw call 测试；引擎合批、阴影、描边和多渲染通道会改变实际调用数。

## 已做验证

1. 每件生成实际 Blender 渲染并逐张检查，不把灰盒或概念图当作成品。
2. 检查有限顶点、UV0、导出法线、索引范围、三角形数、材质引用、无外部资源、无意外相机/动画/骨骼。
3. 从背侧检查并修正了5把枪的装饰机柄/滑块朝向，未改变主体外观和分件枢轴。
4. 将 8 个 GLB 重新导入 Blender，比对三角形数、分件和 UV，并从重新导入的模型渲染整套总览与背部三分之四细节视图。
5. `checks/glb_validation.json` 和 `checks/glb_roundtrip.json` 是可复核记录。没有做游戏引擎实机测试；不会把 Blender 验证等同于运行时验证。

## 重新生成

在包含 Blender 4.3.2 的云端或本机，从 `weapons/` 目录运行：

```bash
blender -b -t 8 --python source/build_weapons.py -- --asset all --render
python3 source/validate_glb.py
blender -b -t 8 --python source/render_collection.py
blender -b -t 8 --python source/render_detail_checks.py
```

单件示例：`--asset 01_Dawn_AR`。`--quick` 仅用于草稿渲染。源码会写回同一资产输出目录，重新生成前请另存手工修改过的文件。当前云端 Blender 没有 OpenImageDenoise，脚本因此关闭去噪、提高采样；不需要额外安装依赖。

## 参考方法与原创范围

参考重点是优秀项目公开分享的**轮廓可辨识度、第一人称阅读性、主次体积、倒角高光和材质层级**，不是“客观最佳建模”的排名，也没有复制现成模型或纹理。

- Riot Games：[How the VALORANT Arsenal was built](https://playvalorant.com/en-gb/news/dev/how-the-valorant-arsenal-was-built/)
- Riot Games：[The Craft and Fantasy of VALORANT Weapon Skins](https://playvalorant.com/en-us/news/dev/the-craft-and-fantasy-of-valorant-weapon-skins/)
- Riot Games：[Future Vision: The Glitchpop Story](https://playvalorant.com/en-gb/news/dev/future-vision-the-glitchpop-story/)
- Chris Stone：[Prime Vandal — 制作者展示](https://chrisstone3d.artstation.com/projects/L2no5w)
- Airborn Studios：[Overwatch 2 Reinhardt Hammer — 制作工作室展示](https://airbornstudios.artstation.com/projects/rJBm0a)
- Khronos：[glTF PBR](https://www.khronos.org/gltf/pbr)

本次仅创建 Parhelion 武器美术文件；未改 Arena/World 文件身份，未修改游戏代码、提交 GitHub 或调用 Work / 用户桌面。
