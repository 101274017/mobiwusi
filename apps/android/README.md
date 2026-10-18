# Android Kotlin 宿主骨架

先在根目录执行 pnpm android:sync，把共享 UI 复制到 app/src/main/assets/ui。

使用 Android Studio 打开本目录，配置 JDK 17 和 Android SDK 36，再执行 gradlew.bat assembleDebug。最低 Android 26 是待评审候选，不是已验证支持范围。

当前只有受限 WebViewAssetLoader 本地页面和能力查询、停止、提醒排程/取消/到期的白名单桥。提醒请求只允许固定字段、应用内深链、版本和非敏感 payload，Room 操作在单线程后台 executor 执行；没有申请 MediaProjection、悬浮窗、相机、麦克风权限，也没有用无障碍服务自动操作。C07 新增的通知/精确闹钟权限只用于提醒能力检查，不在启动时自动请求。

共享 JS 已接入 nuanbanBridge 消息对象，只在 appassets HTTPS 主框架启用；严格关联 ID、代际、请求字段、回复字段、超时和页面清理，捕获/浮层/媒体能力保持关闭，系统通知仍按权限保守回退。接收端使用 ActiveBridgeRequest 严格解析，不把字符串/小数强制转换成整数，不允许白名单外的桥方法；超长消息和非本地资源拒绝访问。onPause 通知页面按锁屏信号停止，onDestroy 发送进程终止通知；两者都不自动续播，停止未确认时页面明确提示。

Android 源集包含 packages/contracts/kotlin 下生成的强类型 DTO 与校验器。根目录执行 `pnpm contracts:generate` 后，用 `pnpm contracts:kotlin:check` 跑 118 定义的 7,631 组 JVM/Ajv 对照及 28 组活动桥对照。真实 WebView/设备尚未运行验收；Chrome 合成通道、JVM 通过或 DEX 存在契约类都不是 NV 设备通过证据。

正常演示包已接入 Room 2.8.5 本地提醒实体/DAO/3 版迁移和事务仓储，并通过受限 WebView 桥接排程、取消和到期提交；到期状态先幂等认领，通知回调写入 `delivered`，点击携带随机一次性令牌并同时校验账号、实例、深链和已投递状态后才写入 `opened`，重复或外部伪造 Intent 不触发路由，Activity 销毁时避免后台 Room 操作与数据库关闭竞态。加入通知渠道、`POST_NOTIFICATIONS`、精确闹钟检查及保守拒绝适配器，但没有开机恢复。2026-10-16 使用本机 Android SDK 36 和 Gradle 构建 Debug APK；这只证明源码与 Room 代码生成可编译，没有设备安装、权限结果、后台投递或真机验收证据。详见 `docs/implementation/c07-c08-android-room.md`。

C01 另增独立模块 `native-lab`，应用 ID 为 `org.nuanban.nativelab`。只有显式构建、安装、勾选本次说明和手动系统授权后，才尝试前台投影/可选浮层实验。帧只隔离计数并释放，不读像素、不保存、不上传；普通演示包没有增加 C01 的采集/悬浮窗权限，桥能力不变。执行 `pnpm android:lab:check`、`pnpm android:lab:build -Offline`；实验边界、35 个捕获状态机用例、10 个提醒策略场景与待执行设备记录见 [独立样例说明](native-lab/README.md)。当前无连接的 ADB 设备，没有安装/启动/授权；C01、NV-01/02 仍未通过。

根目录可执行 `pnpm android:build`，自动同步最新共享界面并构建 Debug APK。`pnpm android:build -Offline` 使用本机已缓存依赖。脚本优先使用 Android Studio 的 JBR，SDK 默认读取环境变量或本机标准目录；也可直接调用脚本传入 `-SdkRoot`、`-JavaHome`。

`pnpm android:room:check` 检查 Room 依赖、实体主键/索引、事务状态机、一次性点击令牌、迁移入口和通知拒绝路径，并在本机 Node SQLite 中预演 1→3 迁移；它记录 `roomMigrationPreflightVerified=true`，但仍保持 `deviceVerified=false`、`systemSchedulerVerified=false`，不安装 APK、不申请权限、不触发系统提醒。

输出：`app/build/outputs/apk/debug/app-debug.apk`。这是本机演示用调试包，非签名发布版。构建仍有 Kotlin jvmTarget DSL 弃用和 SDK XML 工具版本提示，应在 A10 工具链维护时处理，不影响此次 assembleDebug 结果。
