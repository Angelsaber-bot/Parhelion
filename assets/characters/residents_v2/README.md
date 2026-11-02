# 主线居民 · 第二轮人物美术

岚、艾妲、玛拉、米哈伊、澄沿用现有角色身份与工作，细化五套脸型、眼睛、成束头发、耳饰、领口与配饰。游戏中的主角与从者骨骼没有替换。

运行时与离线模型共用 `world/src/settlements/residentPortrait.ts`、`world/src/settlements/npcs.ts` 的构造函数。每个人仍是六个关节化网格批次，不增加人物材质批次或纹理下载。头部增加 Speak / Resolve 两个变形；这是无配音的交谈口型，不是音素同步，也不是完整全身蒙皮重建。

- `Main_Cast.glb`：五位人物的同源导出，可在 DCC 软件查看与编辑。
- `Main_Cast.blend`：已导入 glTF 的可编辑集合、层级、变形及摄影棚灯光。
- `cast-lineup.png`、五张近景 PNG：对正式几何的 CPU 离线渲染，不能替代 WebGL 实机检查。
- `manifest.json`：真实面数、身高、来源与 GLB 哈希。单角色约 1.1–1.3 万三角形。

复现：在 `world` 中运行 `node --import tsx tools/build-resident-cast.ts`；在项目根目录用 Blender 执行 `world/tools/render-resident-cast.py`，参数为本目录 GLB 和输出目录。

新增几何和顶点色由本项目参数化构造，没有从其他游戏提取角色模型、贴图或动画。
