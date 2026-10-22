# D04 预备检查记录

> 现行产品说明（2026-10-22）：本项目显示名称为**微光指引**，功能与平台边界见[当前产品状态](../../implementation/product-current-state.md)。本页任务元数据、原始 WBS 引文、哈希、生成日期与验收值保留为批次快照；文档同步不表示重跑或签收，不能据旧卡片推定当前功能尚未开发。

检查时间：2026-10-17T11:53:48.014+08:00（Asia/Shanghai）  
任务状态：`blocked / preparatory_not_accepted`  
性质：Android 本地/合成预备证据登记与限制交接；不是 Android 真机验收、系统权限验收、人工签收、独立复核、供应商结论、发布批准或 Go/No-Go。

## 范围与计划校验

- 对应计划 `暖伴AI公益助手-项目实施计划-Codex高效续作版.md#L331`，原始 WBS 行为：`| D04 Android证据与限制交接 | 全基线/AT前端层/NV；前置 B07/B10/C15/C16：FS | W9～9 / 1周 | A / 1 | 复核交付、缺口与可复现证据；交付：D交接包/能力账本 | 无真实业务后端可跑；核心原生有结论 | 未过关不进入E |`。
- 原始行 UTF-8、无行尾换行 SHA-256：`1834afc0de6cc3792575f5709a6660de663d498fb2ae598d443e402ed36e07ee`；本记录不修改计划文件。
- 已读取 `docs/implementation/d04-android-evidence-handoff.md`，并以现有 `docs/execution/tasks/D03.md`、`docs/execution/checks/D03-prep.md`、`docs/execution/tasks/D08.md`、`docs/execution/checks/D08-prep.md` 作为字段和限制表达格式参考。
- 当前交接源文件明确 `go_no_go_eligible=false`、`device_results_present=false`；D04 依赖 B07/B10/C15/C16，D 关口未批准，E/F 不启动。

## 已存在证据核对

| 证据 | 实际记录 | 可支持的结论 | 明确不能支持 |
| --- | --- | --- | --- |
| `docs/implementation/evidence/android-room-results.json` | `success=true`、`status=preparatory_not_accepted`；`roomCompileVerified=true`、`roomMigrationPreflightVerified=true`；8 项源码检查通过；`adbDeviceCount=0`、`deviceVerified=false`、`systemSchedulerVerified=false`；Debug APK `sourceFresh=true` | Android Room 源码/依赖、DAO 生成、本机 SQLite 迁移预演和静态拒绝路径已有预备材料 | 真机 Room 执行、旧库升级/备份恢复、系统调度、通知展示/点击、系统权限或 D04 通过 |
| `docs/implementation/evidence/android-room-jvm-results.json` | 纯 JVM 状态转换 `cases=9`、`passed=true`；`roomExecuted=false`、`deviceVerified=false`、`systemSchedulerVerified=false` | 注入式提醒状态边界的本地预备检查 | Android Room、系统 API、设备生命周期或通知回执 |
| `docs/implementation/evidence/android-lab-jvm.json` | `passed=true`、`cases=45`，含 `sessionCases=35`、`reminderPolicyCases=10`；`deviceVerified=false`、`captureVerified=false`、`systemSchedulerVerified=false` | C01 状态机和 C07 策略的 JVM/合成预备矩阵 | 真实投影授权、跨应用捕获、浮层、系统调度、资源释放或实机安全结论 |
| `docs/implementation/evidence/android-lab.json` | `connectedAdbDeviceCount=0`、`installedByAgent=false`、`launchedByAgent=false`；`deviceVerified=false`、`captureVerified=false`、`overlayVerified=false`、`systemPermissionGranted=false`、`independentAcceptance=false`；`jvmCases=35` | 独立 `native-lab` 的源码、Debug APK、Lint、本机枚举和 JVM 预备材料 | 正常演示包能力、Android 真机授权/安装/启动、投影/浮层、锁屏/显示变化或独立验收 |
| `docs/implementation/evidence/android-build.txt`、`android-lab-build.txt`、`android-lab-lint.txt` | 已存在正常包和 `native-lab` 构建/Lint 日志；交接文档记录构建/Lint为 `BUILD SUCCESSFUL` | 编译与 Lint 的复现入口 | 安装、启动、权限请求、通知投递、投影、浮层、WebView 真实桥接或系统回执 |
| `docs/implementation/evidence/c17-assembly-results.json` | `status=blocked`、`acceptance=preparatory_not_accepted`；`androidRoomVerified=compile_only`、`nativeBridgeVerified=synthetic_only`、`goNoGoEligible=false` | 共享存储/桥接组合根的本机预备审计边界 | 把 compile-only 或 synthetic-only 结果升级为 Android/D04 通过 |
| `docs/implementation/evidence/d-gate-readiness-results.json` | 总 D `blocked`；D04 `roomCompileVerified=true`、`roomMigrationPreflightVerified=true`、`roomExecuted=false`、`deviceVerified=false`、`androidLabDeviceVerified=false`；`eAfterDEligible=false`、`eStarted=false`、`fStarted=false` | 当前关口仍阻塞，并明确 D04 缺失的真实设备记录 | Go/No-Go 批准、E/F 启动授权或负责人签收 |

## Android 交接边界

### 正常演示包 `app`

- 交接文档登记应用 ID `org.nuanban.assistant`，APK 入口为 `apps/android/app/build/outputs/apk/debug/app-debug.apk`；工程配置为 `compileSdk=36`、`targetSdk=36`、`minSdk=26`、Java/Kotlin JVM 17。`minSdk=26` 仍是待评审候选，不能写成已验证支持范围。
- 清单声明 `POST_NOTIFICATIONS` 与 `SCHEDULE_EXACT_ALARM`，不声明 MediaProjection、悬浮窗、相机、麦克风或无障碍服务权限；这只是静态声明，不能证明运行时权限已授予。
- Room 2.8.5、schema v3、账号分区主键、事务仓储、1→3 显式迁移、一次性点击令牌和保守通知/精确闹钟适配器已有源码/预备检查；不等于设备上的旧库升级、恢复、通知或生命周期成功。

### 独立 `native-lab`

- `org.nuanban.nativelab` 与正常包隔离，不共享权限、Room、仓储或 WebView 桥；交接文档要求由实际执行者显式安装、阅读实验说明并手工完成系统授权后，才可尝试前台投影和可选浮层。
- 现有材料只允许合成 canary 和受控合成测试应用；帧仅隔离计数并释放，不读像素、不预览、不编码、不落盘、不上传。不能用来证明真实聊天、支付、账号、验证码场景的画面安全或 C17/D04 通过。

## 明确缺失项与后续入口

1. 缺少真实 Android 设备型号、系统版本、安装包哈希、安装/启动和卸载/重装记录；当前无 ADB 设备结果。
2. 缺少正常包运行时权限与通知渠道状态、精确闹钟、通知展示/点击、WebView 路由及后台唤醒回执；不能把清单声明或源码门控写成系统已授权。
3. 缺少 Room 旧库 1→3 真机升级、备份恢复、回滚/失败回退、并发关闭和真实账号分区运行记录；本机 SQLite 预演不替代真机迁移。
4. 缺少锁屏、睡眠、强停、重启、进程/Activity 生命周期、通知重复投递和资源释放等设备矩阵记录。
5. 缺少 C01 `native-lab` 的真实授权票据、投影/浮层、锁屏/显示变化、停止 fence、OS 资源释放和失败路径实测；不得将 JVM/合成 canary 写成实机结论。
6. 缺少实际执行者、独立复核者和有权限 D 负责人的身份、原始记录、结论与签收；B07/B10/C15/C16、C14 独立评审/契约冻结及 D07 授权输入仍未补齐。

## 实际命令与退出码

| 只读检查或写入动作 | 退出码 | 结果与限制 |
| --- | ---: | --- |
| PowerShell 读取计划并定位 D04 原始行，计算 UTF-8 SHA-256 | 0 | 定位第 331 行，得到 `1834afc0de6cc3792575f5709a6660de663d498fb2ae598d443e402ed36e07ee`；未修改计划 |
| PowerShell 读取 `d04-android-evidence-handoff.md` 及 D03/D08 任务卡、检查记录 | 0 | 核对格式、状态字段、证据边界和禁止越权结论；未修改参考文件 |
| PowerShell `Get-Item` 检查 Android 证据、源码入口和构建日志路径 | 0 | 交接文档列出的本地材料均存在；路径存在不等于设备验证 |
| PowerShell `ConvertFrom-Json` 读取 Android Room/JVM、native-lab、C17 与 D-gate evidence | 0 | 读取到上述状态和缺失字段；未刷新或写回任何 evidence |
| `apply_patch` 引擎新增 `docs/execution/tasks/D04.md` 与 `docs/execution/checks/D04-prep.md` | 0 | 仅写入本任务要求的两个文件；未修改 `RUN.md`、`progress.jsonl`、共享 evidence、源码、构建目录或其他任务文件 |

本轮未运行构建、测试、ADB、Android 安装/启动、系统权限请求、通知投递、投影/浮层实验、人工读屏、供应商核验或长时间任务；没有把未执行动作记为通过。

## 结论

D04 仅完成 Android 本地/合成预备证据与限制交接，保持 `blocked / preparatory_not_accepted`。现有材料支持编译、静态、JVM、SQLite 预演和合成桥接边界，不支持真机、系统权限、通知/生命周期、C01 实机或人工/独立验收结论。必须补齐真实设备与授权记录、独立复核、B07/B10/C15/C16/C14/D07 关口输入后，才能由有权限负责人复核 D；在 D 正式 Go/No-Go 通过前，`eStarted=false`、`fStarted=false`，不启动 E/F。
