# Three-character game-ready kits（未自动启用）

本目录新增黑胡子、宫本武藏、骑乘白马的拿破仑资产及轻量 Three.js 接入层。它不修改现有 World 场景、契约任务、角色职阶、伤害或 Arena 配装，也不会自动生成 NPC；开发者显式选用后才加载模型。

## 接入接口

```ts
import { loadCharacterKit } from './characters/characterKit';
import { CHARACTER_KITS } from './characters/catalog';

const actor = await loadCharacterKit(CHARACTER_KITS.blackbeard, {
  environment: scene.environment ?? undefined,
  onEvent(event) {
    // 仅动画事件。玩法层自己核验目标、范围、遮挡和权威伤害。
    // event.transform 是事件时刻实际混合姿态下的 socket 世界变换。
    if (event.kind === 'fire') console.log(event.transform?.position, event.transform?.forward);
  },
});
scene.add(actor.root);
actor.root.position.set(x, groundY, z);
actor.play('walk', { speed: .65 });
// 游戏循环：actor.update(dt, paused); 场景退出：actor.dispose();
```

每次 `loadCharacterKit` 拥有独立模型资源。不要把同一已加载 GLTF（或共享其几何/材质的浅克隆）交给多个 `CharacterKit` 后独立释放。`environment` 是调用者拥有的共享贴图，角色释放不会删除它。PBR 银/金属需要环境反射；使用现有场景环境，或像 Artoria 现有接入一样创建一次 `RoomEnvironment` + PMREM 并在所有角色间共享。没有环境反射时，金属变黑不是把模型颜色改灰就能正确解决的问题。

- 角色以米为单位，glTF +Y 向上、+Z 朝前；根位移由调用者控制，动画原地播放。
- `play('idle'|'walk'|'run'|'attack')`；黑胡子另有 `melee`，但没有作者确定的接触时刻，接入层不虚构命中事件。
- 同一状态反复请求不会从头播放；确实要重播时传 `{ restart: true }`。
- 步速按作者提供的名义速度缩放动画，倍率0–3。超出名义速度太多仍可能足底滑动，不冒充重定向或完整足部IK系统。
- `update(dt, true)` 暂停时钟；切换状态取消未发出的旧动作事件，释放后不能再触发事件。长时间后台恢复每步最多推进0.25秒，避免补发过期连击。
- GLB 和 `.glb.gz` 均支持；gzip是字节级无损传输。HTTP已自动解压时也能正确识别，不双重解压。
- 导入模块不会改当前玩家、召唤或设置。此接入层只负责显示、动画和事件，不附送未经确认的新玩法。

## 默认品质与变体

完整精修几何是默认，不能悄悄降面来声称性能达标。武藏 LOD1 是可显式选择的额外资源，面部及56个morph保持相同；默认仍是完整 LOD0。黑胡子三角帽完整变体与单独帽子、燧发枪同样作为可选资源，不在玩家进入游戏时自动切换。

## 导出空间中的附件

黑胡子 `Blackbeard_Muzzle` 的**GLB局部+Z**为枪口前向、+Y为上方，导出手骨叫 `HandR`。Blender原始枪口-Y/手骨Hand.R不是运行时应使用的名称和轴。已用实际蒙皮后的枪管两点/端盖面与socket逐一比对，而不是从建模软件坐标推测。

武藏右/左刀的节点为 `Attachment_RightHand_Katana` / `Attachment_LeftHand_Katana`，连击分别在19/30秒和33/30秒发出对应事件。这些是握持/附着节点，并不代表刀尖碰撞体；游戏层需要自己的合法命中检测。

骑乘拿破仑的马与骑手必须使用一个GLB和同一AnimationMixer时钟；不要额外对骑手再套第二份根位移。最终挂点/速度/命中元数据以资产契约和catalog为准。

## 发布清理与来源

只收录作者最终白名单中的运行时GLB/gzip、可编辑native场景、必要制作脚本、实际导出验证与模型自身预览。下载原包、参考截图、研究稿、被淘汰模型、`.blend1`、缓存和执行日志不公开。

必要的来源/许可文本即使原来位于名为reference的目录，也不能误删。各角色的source/provenance文件区分获准复用的基础模型与Fate角色设计/IP；复用基础模型的许可不等于官方角色设计授权，不宣称这些是官方授权商用资产。

## QA边界

自动检查使用项目实际 Three.js GLTFLoader、AnimationMixer、SkinnedMesh 变形和真实资产文件。Node中仅纹理GPU上传由测试适配器替代；不能把此检查叫作浏览器画面验收。实际Blender重新导入后的多角度/动画图由美术侧提供。云端已知Chromium socket EPERM未绕过；没有本次浏览器试玩或目标设备GPU帧率证明。

本角色发布工作树建立在包含靶子/刷怪修复、黑帆尽头、永冬之城及业火京都地图的 `0f2eabed3ab67c8a9f028aa2822982dd88f5073d` 上，不从旧kingdom补丁覆盖新地图。GitHub发布与最终提交由监督任务单独核对；网页部署、Mac同步不属于本次动作。

## 本次冻结验证（2026-10-27）

| 默认运行资产 | 三角面 | 骨骼 | gzip字节 | 120 Hz足底扫描最大下沉 |
|---|---:|---:|---:|---:|
| 黑胡子完整版 | 402,274 | 52 | 6,923,513 | 2.70 mm |
| 武藏完整LOD0 | 173,648 | 65 | 6,199,512 | 1.78 mm |
| 拿破仑+白马 | 349,738 | 76 | 21,105,256 | 2.33 mm |

足底值使用本接入层的视觉根偏移和真实蒙皮顶点离线扫描，**不是连续碰撞/足部IK保证**。黑胡子 Walk/Run 额外修正了绕脚踝旋转引起的靴底下沉，外观几何、根、骨盆和上身动作保持不变。拿破仑作者在冻结前减少冗余曲线采样；接入阶段未做减面，也没有偷偷换低质量资源。

- World 全套 **148/148** 通过（当前五区域原有124项 + 11项通用接入层 + 13项真实资产检查）。
- Arena **198/198** 通过；World、Arena前端和Worker类型检查及生产构建通过。
- 三角色实际 GLTFLoader/AnimationMixer/蒙皮、零起点四动作、循环端点、6组过渡、作者动作事件、枪口轴、同钟骑乘座点、刀长刚性、资源释放和gzip字节一致性均有自动证据。
- 单独用生产 Vite 配置构建角色目录，三个资产URL均输出与最终SHA一致的gzip字节；这仅验证接入打包，不等同于实机画面或GPU性能。
- 精确源/运行文件SHA和作者白名单见 `assets/characters/CHARACTER_KIT_MANIFEST.json`；模型依然是需要明确启用的资产，不会因导入而自动招募或改地图。
