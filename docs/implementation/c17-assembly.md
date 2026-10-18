# C17 共享仓储与桥接装配开发验证

更新日期：2026-10-17（Asia/Shanghai）。本文件按实施计划 V1.2 区分本机装配、自动检查与外部验证；不代表真实平台权限、设备验收或正式发布完成。

## 实施范围

- `apps/web/src/composition.ts` 将 IndexedDB 仓储、演示服务和平台端口装配到同一组合根；服务模式与平台模式分开校验。
- `packages/local-data/src/index.ts` 以 `ownerId` 作为账号命名空间，资料、画稿和任务使用本机 IndexedDB；版本冲突在读写事务内拒绝覆盖。
- `packages/platform-ports/src/android-message-host.ts` 只接受 Android `appassets` HTTPS 主框架消息，严格校验请求 ID、代际、方法、超时、停止取消、迟到回复和 `pagehide` 清理。
- `packages/platform-ports/src/index.ts` 对浏览器仅提供 `page_only` 提醒，对未验证的原生宿主保持 `externalCapture`、`remoteMedia`、`nativeOverlay` 和系统通知关闭。
- `apps/android/app` 已有 Room 2.8.5 schema v3 实体/DAO、账号分区、事务仓储、1→3 迁移入口、一次性通知点击令牌和通知/精确闹钟保守适配器；`pnpm android:build`、`pnpm android:room:check` 与 `pnpm android:room:jvm:check` 只证明编译/静态/纯 JVM 预备层，不证明真实设备调度。
- `apps/desktop/reminder-store.cjs` 在 Electron 主进程提供 SQLite 本地提醒仓储，`main.cjs`/`preload.cjs` 只通过受信任主窗口 IPC 暴露明确的排程和状态方法；`apps/desktop/notification-adapter.cjs` 与 `apps/desktop/reminder-notification-bridge.cjs` 提供显式能力/权限门控的通知预备层；主进程当前将权限报告为 `unknown`，只做受限装配、独立仓储测试和合成通知/桥接测试。

## 检查命令

```text
pnpm c17:assembly:check
```

报告写入 `docs/implementation/evidence/c17-assembly-results.json`；只读复核入口为 `node scripts/check-c17-assembly.mjs --no-write`。默认 development 模式根据实际装配、检查及命令退出码计算结果：通过可为 `status=ready_for_development`、`auditPassed=true`，失败仍为 blocked，不能固定放行或将本地错误改记外部待项。

`auditPassed=true` 只覆盖报告列出的源文件、本机测试、桌面仓储装配、通知适配器和主进程提醒桥边界。`acceptance=preparatory_not_accepted` 保留正式验收边界；具体平台字段仍须区分 synthetic_only、compile_only、static_only 与实际目标验证，不能因开发可继续而统一改成真机通过。

## 开发依赖与 F 交接

- C14 的自动技术冻结和 C17 的实际开发检查可以作为 D07 自动开发门禁输入，不再因 C15/C16 缺少独立人工复核、真实设备或试点输入而全局禁止 E/F 编码。
- D07 为 `DEV_READY` / `DEV_READY_WITH_EXTERNAL_PENDING` 且相关前置 development 满足 FS/SS/FF 时，可继续本地代码、契约夹具、仓储/桥接测试和隔离合成验证；当前用户要求先跑 F，应据此推进依赖已具备的 F 本地检查。
- 真实装配缺失、契约不一致、安全隔离失败或失效证据属于开发失败，须修复再验证；外部条件缺失只限制对应真实验证和生产能力，不冒充检查通过。

## 不能由本步证明的事项

- 真实 Android WebView、Room 设备旧库升级/备份恢复/整库加密/账户迁移、Electron 安装包/升级迁移和加密密钥；当前已有本机 Node SQLite 1→3 迁移预演和点击令牌静态边界，但尚无真实设备/安装包证据。
- 系统权限、后台调度、锁屏/撤权/强停/重启、真实设备上的生命周期与回执。
- 任何跨应用捕获、浮层、桌面系统通知/Toast、后台调度、媒体出口、真实账号或服务端数据；通知适配器、主进程提醒桥的注入对象和合成回执不等于 Windows 系统投递。

独立评审、真实供应、真机、真实试点及发布继续记 external_pending；没有有效证明和授权时，相应采集、媒体外发、系统能力与生产数据路径保持关闭，并验证拒绝路径。开发状态不能替代正式 D07、独立复核或发布就绪结论，未发生的真人试点和系统投递不得写成正式完成。

## 历史流程记录（不作为当前开发前置）

2026-10-16 的预备层说明曾固定写整体 blocked，并要求“C15 NV 证据和 C16 负责人/试点方决策没有准入前，C17 不推动 D，也不启动 E/F”。这反映旧流程约束，现按 V1.2 改为开发与外部验证分别记录；历史记录不再阻断依赖已满足的本地开发或 F 检查，也不降低真实验证和发布要求。
