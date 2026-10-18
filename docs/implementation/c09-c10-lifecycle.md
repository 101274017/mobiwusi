# C09/C10 生命周期清理预备层

更新日期：2026-10-17（Asia/Shanghai）。本文件记录共享代码与宿主事件装配，不把合成测试当作 Android/Windows 设备验收。

## 已生成

- `LifecycleCoordinator` 统一维护活动代际、输出门控、停止状态和清理报告。
- `bindLifecycleEvents` 只接收固定宿主事件名：Android 的 `host-pause`、`host-destroy`、权限撤回，以及 Windows 的退出、渲染器退出、窗口移动和递归捕获预留事件。
- 清理顺序固定为：关闭出口 → 失效当前代际 → 清空队列 → 停止轨道 → 隐藏浮层；每一步失败都会保留停止状态并阻止当前进程重新开始。
- 原生宿主 `stopAll()` 的返回值必须明确确认 `stopped=true`、`captureActive=false`，且若提供 `mediaActive` 必须为 `false`；只返回已解析或空对象不会被当作清理成功。
- Android `MainActivity` 在 `onPause` 和 `onDestroy` 通知页面；Windows Electron 主进程在 `before-quit`、窗口关闭、`render-process-gone` 和窗口移动时通知页面，并用独立控制器合并重复停止请求。
- 共享前端仅在原生宿主模式装配协调器；浏览器仍保留页面级停止行为，避免把浏览器事件误称为系统生命周期证明。

## 证据

执行 `pnpm lifecycle:c09:c10:check` 生成 `docs/implementation/evidence/lifecycle-c09-c10-results.json`。当前覆盖 3 个定向测试文件、6 个测试套件、25 项通过，包含事件映射、销毁解绑、并发停止、代际失效、Windows 主进程控制器，以及原生宿主未明确确认捕获和媒体均已停止时的失败路径。

## 未通过边界

- 没有 Android 锁屏、真实撤权、进程终止、MediaProjection、浮层或系统资源释放设备报告。
- 没有 Windows 真实窗口/多屏/递归捕获、渲染器崩溃或系统资源释放报告。
- 宿主停止控制器和资源端口仍是预备装配；当前高风险捕获、媒体、浮层和通知能力保持关闭。
- `host-destroy`、`before-quit` 和 `render-process-gone` 的页面通知不能保证在操作系统强杀或渲染器已不可用时送达；主进程/原生侧必须另有真实资源清理实现。

因此 C09/C10 仍为 `preparatory_not_accepted`，不构成 NV-04/NV-05、D 或生产发布准入。
