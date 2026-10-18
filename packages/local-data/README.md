# IndexedDB 本机仓储

`IndexedDbRepository`、画稿仓储和 `IndexedDbReminderStore` 只服务于浏览器本机/演示预备层。

- 资料、画稿、任务和提醒使用账号命名空间，不进行云同步。
- 提醒仓储在 IndexedDB v4 中以事务替换当前账号的记录，校验内部深链、时区、版本、回执和提醒实例。
- `IndexedDbReminderStore` 不调用系统通知、AlarmManager、WorkManager 或 Electron 调度器；浏览器仍是 `page_only`。
- Android Room、Windows 生产 SQLite、密钥保护、退出/睡眠/重启和系统投递必须在真实平台资源到位后单独验证。
