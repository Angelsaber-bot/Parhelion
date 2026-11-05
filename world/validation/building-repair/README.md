> 本文件保留首轮检查历史。后续已扩大到全量建筑与运行时补充场景，最终结论、逐项清单和图册见 [完整验收报告](exhaustive/README.md)。下文的 66 项和资源体积仅对应首轮。

# 大世界建筑完整性巡检与修补 · 2026-11-05

本轮检查五区正式 GLB 的结构与数值，以及建筑生成代码中的屋顶、底面和封边。实际资源均可解码，ART / COLLISION / MARKERS 三组齐全，无 NaN/Infinity 顶点或访问器值，统计见 `asset-audit.json`。这不是对每栋建筑所有视角的穷尽验收。

确认的问题在京都共用 `roofSurface`：双坡屋顶的侧面误用生成双层屋面的函数，造成多余面、错误朝向和不一致的底面高度；双坡檐口没有封闭；四坡封边厚度也与 0.14 m 的底面不一致。原实现的 8 组闭合拓扑检查全部失败。

修补保持屋顶外表面曲线，按外表面的真实边界生成封边，底面统一下移 0.14 m 并反转朝向。8 组不同尺寸、双坡/四坡屋顶检查现均通过：每条边恰好属于两个方向相反的面，且上下两个方向的单面材质射线都能命中。装饰、材质及碰撞沿用原设计。

涉及京都町屋、稻荷楼门、东山寺院、岚山及小型石构屋盖。只重建京都正式地图和 visual 流式资源；core、布局 JSON 与另外四区二进制资产没有改变。正式 GLB 从 12,330,884 字节减至 12,194,100 字节。删除错误重复封边后，网格数量与渲染准备块数不得增加。历史精修基线没有重写，仅为这次修补列出明确的屋顶消费者例外，无关对象仍逐项比对。

游戏实景人工检查：Chrome 打开本机 Vite，使用默认流式加载检查京都街道和稻荷楼门；截图为 `kyoto-street.jpg`、`inari-gate.jpg`。没有改存档、发布线上版本或重做剧情中的断桥/烧毁建筑。离线 Blender 预览尝试在导入前崩溃，未作为验收依据。

验证命令（在 world 目录）：

```sh
node --import tsx tools/build-kyoto.ts
node --import tsx tools/build-stream-assets.ts
node --import tsx --test validation/roof-integrity.test.ts
node --import tsx --test --test-concurrency=1 validation/roof-integrity.test.ts validation/kyoto*.test.ts validation/britain.test.ts validation/blacksail.test.ts validation/winter.test.ts validation/world-smoke.test.ts validation/map-polish.test.ts
npm run build
```

地图相关的 66 项测试全部通过，类型检查和生产构建通过。另启动的全量测试因包含大量无关长流程而主动停止，未宣称全量测试通过。
