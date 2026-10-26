# Parhelion · ASTER 研究站 美化层

ASTER 是第一张 Arena 地图，地图本体（`arena/`，ChatGPT 的 Blender 流程）**一个文件都没改**。本目录只放一层纯装饰的叠加模型 `assets/aster_overlay.glb`，游戏加载 ASTER 时把它叠在原模型上，加上 `arena-game` 里 ASTER 专属的 `aurora` 氛围，让它和 SAKURA 樱庭一样有鲜明的主题：

**极光下的极地研究站**
- 冷色暮光天空，两道动态极光（绿青到紫）、星星和飘雪
- 所有墙顶、屏风和掩体上都有积雪
- 站外是雪原，有雪堆、松林、雪山、亮灯的小屋，还有带红色航标灯的通信塔
- 地标：东北方的射电望远镜，以及从中央 HELIOS 反应堆直冲天空的青色光柱和两道悬浮光环（都在可玩空间上方）
- 外墙内侧的青色灯带，在辉光下会发亮

叠加层没有任何碰撞，玩法、碰撞和视线和原版完全一样（`arena-game/test/maps.test.ts` 照常通过）。

```sh
python3 source/build_overlay.py   # 读 ../../arena/runtime/map.json，写 assets/aster_overlay.glb
```
