# world/ — 幻日谷 (World 首区) 白盒

Parhelion Alpha 的大世界首区：程序生成的白盒地图（GLB）+ 浏览器第一人称查看器。
设计说明见 [DESIGN.md](DESIGN.md)。这个目录是独立的，不依赖也不改动仓库里的其它部分（例如 Arena）。

![营地视角](docs/spawn.jpg)

## 运行

```bash
cd world
npm install
npm run dev          # 打开 http://localhost:5173
```

地图文件已经提交在 `public/assets/`，直接运行即可。修改了 `tools/gen/*` 之后重新生成：

```bash
npm run build:world  # 重新生成 world_alpha.glb + world_alpha.layout.json（同种子结果一致）
npm run build        # 类型检查 + 打包到 dist/
```

## 操作

| 键 | 作用 |
|---|---|
| 点击画面 | 锁定鼠标进入 |
| WASD / Shift / Space | 移动 / 奔跑 / 跳 |
| 左键 | 射击（可打机关靶） |
| E | 互动（中继器、控制台） |
| M | 大地图 |
| 1–7 | 传送到各区域（调试） |
| F | 飞行模式（调试，Q/E 下降/上升） |
| C | 显示碰撞体 |
| R | 重置进度 |

URL 参数（截图/调试）：`?spawn=station`、`?cam=x,y,z,yaw,pitch`、`?clean`（隐藏 HUD）、`?lit`（点亮光环）、`?nofog`。

## 目录

```
world/
  tools/build-world.ts     生成入口
  tools/gen/layout.ts      布局数据（区域、河流、路线、建筑位置）—— 改地图主要改这里
  tools/gen/terrain.ts     高度图地形 + 顶点色
  tools/gen/structures.ts  营地、观测站、遗迹、幻日塔、瀑布洞穴、桥、路灯、边界
  tools/gen/vegetation.ts  树、石头、灌木
  src/                     Three.js 查看器（卡通材质、描边、天空、胶囊碰撞、小地图、目标流程）
  public/assets/           生成好的 GLB + layout JSON
  docs/                    截图
```
