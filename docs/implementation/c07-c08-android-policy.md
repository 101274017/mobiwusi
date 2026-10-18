# C07 Android 提醒权限策略预备层

更新日期：2026-10-16（Asia/Shanghai）。本文件记录 C07 在 Android 独立 native-lab 中新增的权限与调度能力判定，不代表 Room、系统通知或后台调度已验收。

## 已实现

- `ReminderPolicy.kt` 根据 API 级别、通知权限、通知渠道、精确闹钟许可、后台调度可用性和页面会话状态计算提醒能力。
- 对 Android 13 及以上未知通知权限返回 `unknown` 并要求显式请求；拒绝通知或关闭通知渠道返回 `denied`，不向系统调度器派发。
- 只有所有必需输入都明确满足时才报告 `system`；页面仍在运行但缺少后台调度时最多报告 `page_only`，不能冒充系统后台送达。
- 当前实现是纯策略层，不调用 `NotificationManager`、`AlarmManager`、`WorkManager`，不保存提醒资料，也不请求真实权限。

## 验证

```text
pnpm android:lab:check
```

结果写入 `docs/implementation/evidence/android-lab-jvm.json`。新增 10 个 Kotlin JVM 策略场景，和原有捕获状态机一起运行；`deviceVerified` 与 `systemSchedulerVerified` 必须保持 `false`。

## 未完成

 - 本 native-lab 不接 Android Room；正常 `app` 模块已另有 Room 2.8.5 schema v3 提醒仓储、1→3 迁移入口和点击令牌边界，但尚无生产数据库迁移演练。
- 未接真实通知渠道、`POST_NOTIFICATIONS`、精确闹钟、AlarmManager/WorkManager 或后台服务。
- 未在 Android 设备上验证拒绝、撤权、锁屏、强停、睡眠、重启和用户看到回执。
- C07 仍为 `preparatory_not_accepted`，不构成 NV-02、AT-17 或 D 通过。
