---
title: D04 Android 证据与限制交接
work_package: D04
status: blocked
acceptance: preparatory_not_accepted
go_no_go_eligible: false
device_results_present: false
---

# D04 Android 证据与限制交接

> 本文件交接 Android 预备证据、复现入口、人工设备执行方案和已知限制。当前没有 Android 设备安装、启动、授权、通知投递、Room 真机迁移或 C01 真机采集结果；所有设备项均保持“待验证”。

## 1. 关口状态与计划位置

- **D04 状态：** `blocked`；**验收：** `preparatory_not_accepted`。
- **Go/No-Go：** `goNoGoEligible=false`；D 关口未批准，E/F 不启动。
- **计划前置：** D04 依赖 B07/B10/C15/C16 完成并经独立 Go/No-Go 复核。WBS 所列 Android 真机权限、后台调度、锁屏/强停/重启和通知回执尚无证据。
- **当前 D-gate 记录：** `roomCompileVerified=true`、`roomMigrationPreflightVerified=true`、`roomExecuted=false`、`deviceVerified=false`、`androidLabDeviceVerified=false`。
- **C17 边界：** C17 为 `blocked / preparatory_not_accepted`；Android Room 仅 `compile_only`，原生桥仅 `synthetic_only`，不能据此推动 D。

## 2. 当前 Android 交接范围

### 2.1 正常演示包 `app`

- 应用 ID：`org.nuanban.assistant`；APK：`apps/android/app/build/outputs/apk/debug/app-debug.apk`。
- 工具链：`compileSdk=36`、`targetSdk=36`、`minSdk=26`、Java/Kotlin JVM 17。最低 Android 26 只是待评审候选，不是已验证支持范围。
- WebView 使用受限 `appassets` HTTPS 主框架；桥接请求/回复字段、代际、超时和页面清理有源码校验。
- 正常包清单有 `POST_NOTIFICATIONS` 和 `SCHEDULE_EXACT_ALARM`；没有 MediaProjection、悬浮窗、相机、麦克风或无障碍服务权限。
- Room 2.8.5、schema v3、账号分区主键、事务仓储、1→3 显式迁移、一次性点击令牌及保守通知/精确闹钟适配器已接入。

### 2.2 C01 独立 `native-lab`

- 应用 ID：`org.nuanban.nativelab`；不与正常演示包共享权限、Room、仓储或 WebView 桥。
- 只有显式安装、勾选实验说明并手工完成系统授权后才尝试前台投影和可选浮层；不自动安装、启动或点击系统授权。
- 帧仅隔离计数并释放，不读像素、不预览、不编码、不落盘、不上传；不能据此判断画面安全或 C17 已装配。
- 实验只使用合成 canary 和受控合成测试应用；不得打开真实聊天、支付、账号或验证码内容。

## 3. 已有证据清单

### 3.1 源码与构建证据

| 证据范围 | 现有材料 | 可以说明 | 不能说明 |
| --- | --- | --- | --- |
| Android 工程 | `apps/android/README.md`、`apps/android/app/build.gradle.kts`、`AndroidManifest.xml` | 工程配置、包名、目标 SDK、权限声明和构建入口存在 | API 26 已被真机支持；系统权限已授予 |
| Room 源码 | `ReminderEntity.kt`、`ReminderDao.kt`、`ReminderDatabase.kt`、`ReminderStore.kt` | 实体、索引、DAO、事务状态机、迁移入口和后台 executor 已接入 | 设备上的旧库升级、备份恢复、回滚或并发关闭成功 |
| 通知路径 | `ReminderNotificationScheduler.kt`、`ReminderAlarmReceiver.kt`、`MainActivity.kt` | 通知渠道、权限/渠道/闹钟门控、到期认领、`delivered`、一次性令牌和 `opened` 校验路径存在 | 系统实际展示通知、后台唤醒、用户点击或 WebView 路由成功 |
| 活动桥 | `ActiveBridgeProtocol.kt`、`packages/platform-ports/src/android-message-host.ts` | 严格消息协议及宿主边界有源码和合成测试 | 真实 Android WebView 的消息端口已联调 |
| C01 源码 | `apps/android/native-lab/src/main/java/org/nuanban/nativelab/` | 授权票据、代际、停止 fence、资源释放和失败路径已实现 | MediaProjection、浮层、锁屏/显示变化和 OS 资源释放已在设备观察 |

### 3.2 构建、静态和 JVM evidence

| evidence 文件 | 当前记录 | 交接解释 |
| --- | --- | --- |
| `docs/implementation/evidence/android-room-results.json` | `success=true`、`status=preparatory_not_accepted`；Room 编译和迁移预演为 `true`；`deviceVerified=false`、`systemSchedulerVerified=false`、`adbDeviceCount=0`；8 项源码检查通过；APK `sourceFresh=true` | 证明源码/依赖/DAO 生成、本机 SQLite 预演和静态拒绝路径的预备检查；不证明设备执行 |
| `docs/implementation/evidence/android-room-jvm-results.json` | 9 项纯 JVM 状态转换通过；`roomExecuted=false`、`deviceVerified=false`、`systemSchedulerVerified=false` | 证明注入式状态机边界；不调用 Android Room 或系统 API |
| `docs/implementation/evidence/android-lab-jvm.json` | 45 项通过：`sessionCases=35`、`reminderPolicyCases=10`；`deviceVerified=false`、`captureVerified=false`、`systemSchedulerVerified=false` | 证明 C01 状态机和 C07 策略预备矩阵；不证明真实授权/调度 |
| `docs/implementation/evidence/android-lab.json` | C01 汇总含 35 项 JVM 状态机；`connectedAdbDeviceCount=0`、`deviceVerified=false`、`captureVerified=false` | 当前无 ADB 设备；没有安装、启动、授权或采集结果 |
| `docs/implementation/evidence/android-build.txt` | 正常 `app` 构建日志 | Debug 构建复现材料；不是安装/运行证据 |
| `docs/implementation/evidence/android-lab-build.txt`、`android-lab-lint.txt` | native-lab 构建和 Lint 日志为 `BUILD SUCCESSFUL` | C01 编译/Lint 证据；不是投影、浮层或设备证据 |
| `docs/implementation/evidence/c17-assembly-results.json` | `blocked / preparatory_not_accepted`；`androidRoomVerified=compile_only`、`nativeBridgeVerified=synthetic_only`、`goNoGoEligible=false` | C17 预备审计状态；不能把本机组合根或合成通道写成 Android 通过 |
| `docs/implementation/evidence/d-gate-readiness-results.json` | D 总体 `blocked`；`eAfterDEligible=false`、`eStarted=false`、`fStarted=false` | D 尚未准入；D04 只能交接限制与待办 |

`pnpm contracts:kotlin:check` 另覆盖生成 Kotlin DTO/校验器的 JVM/Ajv 对照和活动桥对照；仍属源码/契约证据，不能替代真实 WebView 或设备验收。
