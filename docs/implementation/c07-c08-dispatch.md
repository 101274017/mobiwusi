# C07/C08 提醒系统派发闸门预备层

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-16（Asia/Shanghai）。本文件记录排程请求进入系统调度前的共享门控，不代表 Android Room、Windows SQLite 或系统通知已经接入。

## 已生成

- `ReminderDispatchGate` 接收注入的调度端口，按 `system`、`page_only`、`unsupported` 能力明确决定是否允许调用系统调度器。
- 未知、拒绝或不支持的通知权限不会调用调度端口；浏览器和未验证原生宿主分别保持 `page_only`/`unsupported` 语义。
- 系统能力获准后，排程仍须显式启动当前代际；同一账号/待办/版本幂等，旧版本拒绝，新版本先取消旧排程再注册。
- 撤权或宿主停止会递增派发代际并取消已注册排程；恢复权限不会自动恢复，必须显式启动更高代际。
- 调度器取消失败会保留阻断状态，禁止当前进程静默重启；取消、旧版本和未找到都返回可区分结果。

## 证据

执行 `pnpm reminder:c07:c08:check` 生成 `docs/implementation/evidence/reminder-c07-c08-results.json`。当前为 3 个定向测试文件、6 个测试套件、18 项通过；另有 v4 IndexedDB 仓储和独立 Node 24 SQLite 预备实验。

## 未通过边界

- 调度端口只由测试注入，没有 AlarmManager/WorkManager、Android 通知权限、Windows Toast/计划任务或后台服务。
- 共享派发层本身没有证明 Room 的真实设备迁移、密钥保护、系统通知、退出/睡眠/重启和真实设备投递/用户看到回执；正常 Android app 的 Room 预备层与桌面 SQLite/通知适配器分别见 `docs/implementation/c07-c08-android-room.md` 和 `docs/implementation/c07-c08-desktop-store.md`。
- `system` 能力仅是测试用能力标记，不能作为真实平台能力证明；当前生产组合根仍返回 `page_only` 或 `unsupported`。

因此 C07/C08 仍为 `preparatory_not_accepted`，不构成 NV-02、AT-17、D 或生产发布准入。
