# Arena 地图与场景打磨（本地 v34）

本次限定 Arena。更新本地网页与本地服务构建，不推送 GitHub，不发布公网。

## 场景改动

| 地图 | 本次改动 |
|---|---|
| HOMEWARD 归灯回街 | 双院铺装与工坊立面、货棚帆布、钟楼、河渠水轮、接地的城镇外景；两条横贯街道增加实体遮挡；独立暮色光照 |
| ASTER 研究站 | 出生区实体风挡及双出口、仪器柜和甲板导向细节；保持原研究站主体 |
| SAKURA 樱庭 | 木、石、瓦 PBR 材质，神社格栅与鸟居细节；围墙可见高度匹配碰撞；独立黄昏光照及接地远景 |
| CAM LANN 誓约荒原 | 石质门槛与台阶落点，保持原有废墟建筑和交火路线 |
| BLACKFLAG 黑帆战舰 | 四处船舱梯改为可辨识的木踏步，黄铜及防滑落点；远处岩岛 |
| FROSTCOURT 永冬庭院 | 出生区折线遮挡与中间隔墙、2 米通道；蓝金台阶导向与雪地远景 |
| LISHAN 骊山地宫 | 青铜/玉石落点、栈桥连接细节；地宫内景缩略图 |
| SUNTEMPLE 日轮神殿 | 青金石/金色路径落点、双侧入口翼日纹样 |
| ORLEANS 奥尔良 | 深浅鹅卵石通道标记、外城连续地面 |

HOMEWARD、ASTER、FROSTCOURT 的出生朝向现在明确对准出口，并由出生事件携带到客户端；不会在同一快照后续输入覆盖朝向后再次转回墙面。训练场仍保留各靶位原有朝向。

九张选图图片直接由当前游戏的 ArenaScene 渲染导出。工具源码在 `tools/map-review.ts`；运行 `node arena-game/scripts/build-map-review.mjs` 可生成临时本地审阅页。最终本地安装不包含该审阅页。

本地安装校验现在覆盖全部 Arena 地图运行数据和 GLB，而非仅检查 HOMEWARD。地图碰撞更新使规则版本升至 34，避免旧客户端静默接入不同地图规则。

## 验证范围

- 52 个 Arena 非网络测试文件，870 项测试通过；另有 5 项本地安装测试通过。
- GPU 实景逐图检查，使用实际模型、材质、光照；检查选图图片与本地 v34 页面。
- 本次未运行联机套接字测试、未做真人对抗胜率或帧率基准；机器人交火与视线采样不能代替这些验证。

## 独立几何与对局审计

This audit evaluates movement and sightline geometry with the production collision, navigation, bot and simulation code. It does not assert perfect competitive balance, visual quality, network performance, or human playtest results.

## Corrected design defects

- ASTER: 56 sampled neutral positions could see both spawns of one team; 40 sampled elevated-to-spawn rays were open. Matching visible/solid inner windbreaks reduced both counts to zero. The two exits remain 2.25 m wide (1.61 m capsule-centre clearance for radius 0.32 m). Actual movement traversed all four mirrored exits in both directions.
- FROSTCOURT: 309 sampled elevated-to-spawn rays were open. Staggered screens/wings and the divider between north/south pockets reduced the count to zero while retaining a 2 m exit channel. Twelve formerly exposed terrace/arcade positions, mirrored across the map, pass standing and jump-apex sightline regressions against every spawn.
- HOMEWARD: sub-cell sampling revealed 58.35 m and 57.85 m uninterrupted transverse streets missed by the previous coarse grid. The expanded town booths and terrace service cabinet interrupt those exact rays. Long diagonal angles still exist: a separate 0.5 m ground grid / 64-direction scan found a 53.03 m diagonal. These changes therefore do not imply a universal 40 m cap.

## Current metrics

| Map | Authored routes | Spawn anchors | Reachable nav nodes | Directed traps | Sampled elevated spawn exposures | First damage, live seconds | Best-round total kills |
|---|---:|---:|---:|---:|---:|---:|---:|
| homeward | 10 | 8 | 7382 | 0 | 0 | 7 | 9 |
| aster | 5 | 4 | 15364 | 0 | 0 | 11.08 | 14 |
| camlann | 6 | 4 | 9434 | 0 | 0 | 3.3 | 4 |
| blackflag | 6 | 6 | 12392 | 0 | 0 | 3.95 | 17 |
| frostcourt | 6 | 4 | 9674 | 0 | 0 | 7.43 | 14 |
| sakura | 4 | 4 | 9572 | 0 | 0 | 3.55 | 11 |
| lishan | 8 | 8 | 8056 | 0 | 0 | 2.72 | 9 |
| suntemple | 9 | 8 | 9268 | 0 | 0 | 6.02 | 5 |
| orleans | 9 | 8 | 8416 | 0 | 0 | 4.25 | 12 |

Navigation is a directed 0.5 m grid with drops. The new tests examine every reachable surface for a return path to the circulation network. Central-half spawn-lock tests examine all reachable grid nodes, standing and at a 1.07 m jump apex, at least 12 m from every candidate spawn. The metric report's elevated-spawn counts sample every fourth reachable node and only standing eyes; the separate regression tests cover the specified elevated defects at both heights.

Combat metrics use a single deterministic 90-second hard-bot 2v2 per map, seeds 41–44, with Artoria, Jeanne, Musashi and Qin. They prove encounters occur under that scenario, not equal team win rates. ASTER's first encounter is slower than the smaller arenas; CAM LANN's dense cover yields fewer kills in this one run.

## Validation

- 95 / 95 tests pass across map-safety.test.ts (24), maps.test.ts (57), and homeward.test.ts (14).
- Tests include actual capsule movement, anchor/route connectivity, spawn visibility, bot fights, finite visual geometry for Homeward, and the new sightline/exit regressions.
- Final geometry audit: all nine maps have zero directed traps and zero sampled neutral all-spawn-lock spots.
- Central objective arrival differences are generally under 0.3 seconds; offset home-side objective anchors deliberately differ. BLACKFLAG has two east-offset objective anchors, producing an apparent 2.1–2.3 second east advantage when measuring only those anchors; this is not evidence that the mirrored full battlefield is inherently unbalanced.

Reproduce from repository root:

```sh
npm test --prefix arena-game -- test/map-safety.test.ts test/maps.test.ts test/homeward.test.ts
node --import ./arena-game/node_modules/tsx/dist/loader.mjs arena-game/.scratch/map-design-audit.ts
node --import ./arena-game/node_modules/tsx/dist/loader.mjs arena-game/.scratch/map-combat-audit.ts
```
