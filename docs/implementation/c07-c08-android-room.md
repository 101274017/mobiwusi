# C07 Android Room 与本地通知适配预备层

更新日期：2026-10-16（Asia/Shanghai）。本文件记录 C07 在正常 Android `app` 模块中的代码接入和本机编译证据，不把 Debug APK、源码检查或本机策略测试当作设备验收。

## 本次接入

- 使用 Room `2.8.5`、KAPT 和 Android app 模块生成 `ReminderDao` 实现；数据库版本为 `3`。
- `ReminderEntity` 以 `account_id + instance_id` 为主键，并对账号、任务、排程版本、状态和数值到期时间建立索引。
- `RoomReminderStore` 将排程、到期提交、回执、完成和取消放在数据库事务内；旧版本、同版本内容冲突、非法深链、错误回执顺序和跨账号读取会拒绝。
- `instance_id` 使用与共享提醒引擎相同的 SHA-256 稳定命名输入，避免同一任务和排程时间因重试产生重复实例。
- `ReminderDatabase.MIGRATION_1_2` 为回执和完成/取消时间列提供显式迁移入口，`MIGRATION_2_3` 增加本地通知点击令牌列；缺令牌的旧提醒在事务性到期认领时补发令牌，避免旧闹钟直接失效。`pnpm android:room:check` 另用本机 Node SQLite 构造旧版表并执行同一组迁移 SQL，验证旧行、8 个回执时间列、点击令牌列和两个既有索引被保留；尚未完成真实 Room 旧库升级、备份恢复或中断回滚演练。
- `ReminderNotificationScheduler` 创建通知渠道、检查 `POST_NOTIFICATIONS`、渠道总开关和精确闹钟能力；任一能力不明确或被拒绝时返回 `unsupported`，不调用 `setExactAndAllowWhileIdle`。
- `ReminderAlarmReceiver` 先在 `goAsync` 后台任务中按账号/提醒实例幂等认领到期状态，再展示不含敏感正文的通用通知并写入 `delivered`；每个实例生成本地随机点击令牌，通知点击必须同时匹配账号、提醒、实例、深链、令牌和 `delivered` 状态，成功后才写入一次性 `opened` 并路由，重复或外部伪造 Intent 不再触发页面路由。Android `MainActivity` 已通过共享活动桥接入 Room 排程、取消和到期提交，Room 调用使用单线程后台 executor；到期派发失败会回滚 `submitted`，销毁时使用生命周期锁等待正在运行的 Room 操作后再关闭数据库，系统能力不明确时仍返回 `unsupported`。

## 验证

```text
pnpm android:build
pnpm android:room:check
```

本轮结果：Android Debug APK 构建成功，8 项源码/依赖/迁移/拒绝路径检查通过，其中包含本机 SQLite 1→3 迁移预演、点击令牌防重放边界、到期提交补偿、通知回执和 Activity 销毁顺序检查；`roomCompileVerified=true`、`roomMigrationPreflightVerified=true`，`adbDeviceCount=0`、`deviceVerified=false`、`systemSchedulerVerified=false`。证据见 `docs/implementation/evidence/android-room-results.json`。

## 明确未完成

- 尚无 Android 设备安装、通知权限请求结果、渠道关闭、精确闹钟特殊访问、锁屏/睡眠/强停/重启后的真实投递、用户点击或 `opened` 回执证据；源码路径已接入但不替代设备观察。
- 尚无真实 WebView 消息端口、桥接请求/回复在设备上的联调；当前 Kotlin 编译和 JS 合成通道只证明协议与代码路径，不证明 Android 系统调度成功。
- 尚无通知点击后的真实 WebView 路由签收；当前只有通过一次性令牌和 `delivered` 状态校验、且 WebView 页面完成后才发出 `nuanban:reminder-open` 事件，页面路由和系统点击仍待设备联调。
- 尚无 Room 整库加密、密钥托管、真实账号认证、同步 outbox、云端 CAS 或生产迁移策略；`payload_json` 仍是本地预备字段，不能宣称敏感数据已加密。
- 未加入开机自启动或重启后自动恢复。没有系统生命周期证据前，不以页面 timer 或 `AlarmManager` 代码替代 NV-02。
- C07/C08 仍为 `preparatory_not_accepted`，不推动 D，也不启动真实 E/F。
