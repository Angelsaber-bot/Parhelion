# Saber · 落日王国第一契约从者 — 原创同人模型 v1

面向 Parhelion 第三人称游戏的 **Saber / 阿尔托莉雅·潘德拉贡同人角色资产**。
本包的几何、材质、骨架与动画由脚本原创搭建；没有下载、拆包或复用官方角色模型。
它是可继续精修的风格化游戏资产 v1，不是官方授权模型，也不冒充 AAA / 收藏级成品。

## 交付内容

- `saber_contract_servant.blend`：Blender 4.3.2 可编辑源文件；约 364 个语义命名的可编辑部件、原始修改器、42 根骨骼、3 个动作、独立灯光/摄影棚集合。
- `saber_contract_servant.glb`：优化后的运行时模型。约 2.34 MB，62,469 三角面；一个蒙皮网格，19 个 PBR 材质分区。
- `source/build_saber.py`：从零构建几何、材质、权重、动作、场景与 GLB 的可复现脚本。
- `source/render_saber.py`：源文件多视角渲染。
- `source/render_runtime.py`：重新导入实际 GLB 后渲染待机、行走、攻击姿态。
- `source/validate_saber.py`：GLB 数据及 Blender 重新导入后的实际顶点变形检查。
- `qa/build_stats.json`、`qa/validation.json`：实测数据；`RIG_CONTRACT.json`：接入约定。
- 预览包：全身、脸部、背面、正面、第三人称距离与实际 GLB 动画姿态。预览里的地台和灯光不在 GLB 中。

## 角色造型

保留金发、分层刘海、双侧鬓发、辫盘发、蓝色后蝴蝶结、标志性呆毛、绿色眼睛、蓝色长裙、银色分片护甲与金蓝配色长剑。
脸部为连续面颊/下颌/鼻梁网格；眼白、虹膜、瞳孔、眼睑与高光是独立几何，不是平面贴图脸。
裙摆具有径向褶皱、金边与象牙色波齿内衬；侧裙甲、腰甲、前臂护甲与手甲保持独立可编辑部件。
剑为原创外观的 Excalibur 风格同人道具，不包含真实武器制造结构。

## 接入约定

- Blender：`+Z` 向上、`-Y` 朝前。导出的 glTF：`+Y` 向上、`+Z` 朝前；米制，缩放 `1`。
- 原点位于脚底中心，GLB 最低 Y 为 `0`；身体约 1.68 m，含呆毛的包围盒高度约 1.752 m。
- `Saber_Rig` 骨架；`Root` 根骨；`Hips / Spine / Chest / Neck / Head` 主干。
- 左右肢体采用 `.L / .R` 后缀；`Hand.R` 为持剑手，`Sword` 为其子骨。
- 8 根 `Skirt.00`—`Skirt.07` 控制裙摆；顶点使用手工分配和径向插值权重，而非未绑定的静态摆件。
- 精确动作名称：`Idle`（约 2.033 s，循环）、`Walk`（约 1.100 s，循环）、`Attack`（约 1.033 s，单次）。
- 动作为原地 FK；移动速度、转向、碰撞与伤害由游戏控制。攻击动作不是物理模拟。
- Three.js 蒙皮实例请使用 `SkeletonUtils.clone()`；播放由 `AnimationMixer` 负责。材质使用标准 glTF PBR，建议配置环境光/环境贴图。
- GLB 不含摄影机、灯光、展示底座、外部纹理或网络资源。

## 验证

已检查每个材质分区的 POSITION、NORMAL、TEXCOORD_0、JOINTS_0、WEIGHTS_0；坐标及 UV 有限，法线和权重归一化，关节索引有效。
在空 Blender 场景重新导入 GLB 后，检测到了 1 个实际蒙皮网格和 42 根骨骼。三个动作均实际驱动顶点，不只是空动作名称：

| 动作 | 采样最大顶点位移 |
|---|---:|
| Idle | 0.0264 m |
| Walk | 0.2103 m |
| Attack | 1.3953 m（包含挥剑尖端） |

Blender 导入器为骨骼显示生成的隐藏 Icosphere 属于编辑器辅助对象，不是 GLB 内的额外角色网格。
游戏运行接入由主工程单独验证；单独拿到本模型不等于游戏集成已完成。

## 当前边界与后续精修点

- 这是风格化 v1：刘海仍偏雕塑式发束；近距离面部、手指与布料可以继续人工雕刻精修。
- 无表情 blendshape、口型、眨眼动画或面部控制器；没有完整 IK / retarget 控制面板。
- 裙摆使用 8 骨骼的轻量变形，不是实时布料；极端自定义姿势可能需要调整权重和防穿模。
- 金属/布料由几何和 PBR 纯色材质表现；无烘焙法线/磨损贴图。UV 已提供，但未按专门贴图流程重新排布成唯一无重叠图集。
- 19 材质分区适合少量同屏角色；大量召唤实例仍应另做材质合批和 LOD。
- 不宣称通过本包获得角色 IP 的商业使用授权。

## 复现

```bash
blender -b -t 4 --python source/build_saber.py
# 只构建资产而不等待全部渲染：
SABER_SKIP_RENDER=1 blender -b -t 4 --python source/build_saber.py
blender -b -t 4 --python source/validate_saber.py
blender -b -t 4 --python source/render_runtime.py
```

源文件的 NLA 轨默认静音，以便打开时看到完整中立造型；在 Action Editor 选择 `Idle / Walk / Attack` 可编辑动作。
渲染使用 Cycles CPU；此环境没有 OpenImageDenoise，因此脚本关闭降噪，预览可能存在轻微采样噪声。

## 视觉参考与权利说明

- [Good Smile Company：Saber/Altria Pendragon (Second Ascension)](https://www.goodsmile.com/en/product/8973/Saber%2BAltria%2BPendragon%2BSecond%2BAscension%2B)：官方商品造型说明与外观参考。
- [Saber 全身参考图条目](https://www.zerochan.net/107972)：实际检查的蓝银盔甲、刘海/鬓发、辫发与裙甲轮廓参考。

参考仅用于观察造型；本交付不附带上述网站图片，不将其作为纹理或模型资产。
Saber / Artoria 及 Fate 相关角色权利属于 TYPE-MOON / FGO PROJECT 等相应权利人。本模型为非官方同人作品。
