# 微光指引 · Reminder engine

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

这个包是 C07/C08 的共享规则层，不是 Android Room、Windows SQLite 或系统通知实现。

已实现的边界：

- 严格校验 UUID、RFC3339 时间、IANA 时区、内部复习/待办深链和 `scheduleRevision`。
- 用 Web Crypto 按 `todoId + scheduleRevision + plannedAt` 生成稳定 `instanceId`。
- 同一排程幂等；旧版本拒绝；同版本内容冲突拒绝；当前版本才能写回执。
- `scheduled`、`submitted`、`delivered`、`opened`、`completed` 分开记录；未知/失败/错过不会伪造成已投递。
- 取消只阻断尚未发出的实例；删除或重排不自动复活旧实例。
- 按用户时区计算 daily/weekly 下一次时间，覆盖夏令时前后边界。
- `ReminderDispatchGate` 在系统排程端口前执行能力、权限、账号、版本和生命周期门控；撤权/停止后不自动恢复，旧版本不能回写。

尚未实现：

- Android Room、通知权限、AlarmManager/WorkManager 或厂商后台策略。
- Windows SQLite、加密密钥、Toast/计划任务或应用退出/睡眠/重启恢复。
- 云端调度、推送供应、跨设备全局恰好一次和真实“看到”回执。
- 这里的 `system` 派发能力只供注入端口测试；当前浏览器和未验证原生宿主仍分别是 `page_only` 与 `unsupported`。

因此该包的单元测试只能证明共享状态与时间规则，不能把 C07/C08 标为设备验收通过。
