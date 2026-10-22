# 露米 Lumi 三维伙伴

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

入口：客户端「我的小伙伴」页最上方的露米卡片。模型已随客户端内置，不需要 Blender、网络生成服务或再次手动导入。

- 「预览 3D 与动作」打开真实 GLB 预览，支持拖动旋转、缩放和九个动作；收起预览时释放 WebGL 资源。
- Windows 客户端中的「设为桌面小伙伴」需确认后才检查、保存并显示独立桌宠；先停止星云形象并停用栗栗，不删除原画。
- 已选中时可「再次召唤桌宠」。选择保存在本机 SQLite，重启恢复；下方模型面板可切回原画 / 内置形象。
- 手机网页和没有桌面原生桥的 WebView 可以预览；确认“在本页显示露米”后显示页面陪伴，支持关闭，但不会替换系统桌宠。Windows 本机保存与真实桌宠调用仍仅开放给受信任的电脑客户端管理窗口。

## 资源与复用

源资源位于 `apps/web/public/models/lumi/`，构建时自动进入 Web `dist/models/lumi/` 和桌面打包的 `ui/models/lumi/`：

| 文件 | 用途 |
| --- | --- |
| `Lumi_Magical_Kitten.glb` | 内嵌网格、材质、骨骼、动作和表情，不依赖外部纹理 |
| `character_manifest.json` | 角色 ID、版本、动作、表情、挂点与施法事件的完整映射 |
| `poster.png` | 未启动 3D / 不支持 WebGL 时的角色展示 |

`apps/web/src/three-d/builtin-models.ts` 导出 `lumiModel` 目录信息和 `loadLumiModel(signal)`。后者只读取随包模型并校验 SHA-256；客户端使用只读的 `readBuiltin('lumi')` IPC，不放宽禁止网络请求的 CSP，网页使用本地静态资源请求。`createModelView` 返回 `animationNames`、`playAnimation(name)` 和 `dispose()`，可供后续界面复用。

```ts
const source = await loadLumiModel();
const view = await createModelView(container, source, { interactive: true });
view.playAnimation('wave');
view.playAnimation('cast');
view.dispose();
```

桌面管理窗口在用户明确确认后可调用 `window.nuanbanModel.applyBuiltin('lumi')`。这是固定白名单接口，不接受文件路径或任意模型 URL；主进程再次校验资源，并通过隔离渲染器检查真实资源预算后保存。预览不调用该接口、不创建导入候选、不替换桌宠。

页面陪伴路径直接使用随 Web 包提供的 `poster.png`，不写入 SQLite，不改变当前桌宠选择，也不上传 GLB 模型；它与桌面端的本机保存、重启恢复和真实独立悬浮窗口是两条不同能力路径。

## 动作与显示

身体动作：`idle`、`walk`、`wave`、`happy`、`think`、`cast`、`surprise`、`sleep`、`tap_react`。待机默认按名称选 `idle`，不依赖 GLB 动画列表的顺序。循环动作持续播放，单次动作结束后淡入待机；配套 `face_*` 表情或 `blink` 与身体动画同时播放。系统偏好减少动态效果时不自动开始动作，用户仍可手动预览。

模型坐标为 +Y 向上、+Z 朝前，文件根节点已含比例变换，加载时不重复缩放；通用查看器仅根据整体包围盒取景。运行模型约 1.75 MiB、29,900 三角面、30 骨骼、9 身体动作及 7 个面部动画片段。施法仅播放资产已有动画，粒子 / 音效和业务事件尚未自动接入；完整时点与挂点见 manifest。

原 Blender 导出的模型含 40 个稀疏表情访问器，桌面安全检查不接受稀疏数据。`node scripts/prepare-lumi-model.mjs <原始GLB路径>` 将其无损展开为普通顶点访问器，不放宽检查、不改变网格、材质或动画数值。manifest 的 `runtime.preparation` 记录源文件与运行文件的 SHA-256、展开数量和处理方式；原始交付文件不修改。
