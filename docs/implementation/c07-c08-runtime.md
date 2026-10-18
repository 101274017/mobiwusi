# C07/C08 共享提醒运行时接线

更新日期：2026-10-17（Asia/Shanghai）。本文件记录待办界面到共享平台提醒端口的本机预备接线，不把浏览器 `page_only` 或原生 `unsupported` 结果当作系统通知验收。

## 已实现

- `packages/platform-ports/src/reminder-runtime.ts` 提供 `ReminderRuntime`，以账号、待办 ID 和排程版本构造稳定提醒实例，并把待办转换为共享 `ReminderScheduleRequest`。
- 待办新增、修改、完成和删除通过周期同步进入同一运行时；排程版本或时间变化时先取消旧实例，再提交新实例，已完成/已删除待办会取消当前注册。
- 相同待办和相同排程内容重复同步不会重复调用平台端口；到期事件按实例只触发一次，页面通知正文保持非敏感，点击只进入复习或待办内部路径。
- `NativeHostPlatform` 现在只在宿主显式暴露 `reminderStore` 时接线本地排程、取消和到期派发请求；Windows Electron preload 已提供受限本地仓储接口，宿主缺少该接口时不会猜测或写入其他存储。
- `App` 不再直接维护分散的提醒 `setInterval` 和 `Notification` 逻辑，浏览器能力仍由 `BrowserPlatform` 返回 `page_only`，尚未验证的 Android/Windows 宿主仍返回 `unsupported`。
- 停止运行时会取消已注册的页面/平台提醒，停止后不会因后续轮询自动恢复；调度/取消异常通过 `onError` 保留为可观察失败，不阻断本机资料保存。
- 旧实例取消失败时阻断新版本排程，避免取消不确定时形成重复系统提醒；成功清理前保留旧注册，等待后续人工/平台处理，不静默覆盖。

## 本轮本机审查

- `ReminderRuntime` 的串行同步、旧实例先取消、取消失败阻断、停止后不恢复和按实例去重已有定向覆盖；本轮未扩大其实现范围。
- 桌面宿主边界已补实例/排程版本绑定：运行时发出的到期请求即使经过排程替换，也不能让旧通知回写或路由到新提醒。
- IndexedDB 预备仓储现在额外拒绝非规范 RFC3339 时间和不匹配 `todoId + scheduleRevision + plannedAt` 的稳定实例 ID。

## 验证

```text
pnpm reminder:runtime:check
pnpm exec vitest run tests/platform/reminder-runtime.test.ts tests/platform/native-host.test.ts tests/integration/local-data.test.ts
pnpm typecheck
pnpm test
pnpm build
```

本轮 `ReminderRuntime` 4 项既有测试保持通过；本次桌面/IndexedDB 定向回归 24 项通过，类型检查和桌面 CommonJS 语法检查通过。`pnpm check` 已刷新全量单元证据为 43 个测试文件、668 项通过；双视口 Chrome E2E 已完成 96 项且 0 失败、0 flaky、0 跳过，浏览器自动化不替代设备通知、系统权限或人工验收。

## 未完成边界

- 浏览器仍要求页面运行，`page_only` 不是关页、锁屏或睡眠后的系统后台提醒。
- Android Room/AlarmManager 尚未接入共享 `PlatformPort`；Windows 显式宿主本地仓储已接线，但 SQLite 仍没有系统调度和通知权限确认。当前原生平台对系统能力保守返回 `unsupported`，不把本地写入当作系统投递。
- 尚无 Android/Windows 设备权限、退出/睡眠/强停/重启、系统通知展示或真实 `delivered/opened` 回执证据；C07/C08/C17 仍为 `preparatory_not_accepted`，不能推动 D。
