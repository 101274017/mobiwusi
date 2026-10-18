# 本批次验证记录

日期：2026-10-17（Asia/Shanghai）。覆盖本次续建的前端、纯规则、浏览器本地持久化、宿主工程打包、C01/C02 独立样例、C07/C08 SQLite 预备实验、C09/C10 生命周期清理预备层、C11 3D 本地资源预检、C12 供应沙箱、C13 资产质量门控、C14 契约交接预备层、C15 NV 准入审计、C16 决策台账和 C17 共享仓储/桥接装配审计；不构成生产或真机验收。目录尚未初始化 Git，未生成提交或伪造提交 ID。

## 自动验证

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| pnpm check | 类型与领域/UI 依赖边界通过；43 文件、668 测试通过，且通过 `test:evidence` 自动刷新 JSON/文本单测证据；含 C01～C17 原生/策略/坐标/提醒/生命周期/3D/供应沙箱/NV 准入审计/决策台账/装配审计边界、D 关口预备审计及 C13 资产质量规则检查 | evidence/unit-results.json、evidence/unit.txt；scripts/run-unit-evidence.mjs |
| pnpm contracts:check | 0.2.0 草案，60 操作、118 定义；含活动桥请求/Android 回复共 6 Schema 通过；TS/Kotlin/OpenAPI 生成文件无漂移 | evidence/contracts.txt |
| pnpm contracts:kotlin:check | Kotlin 2.2.20/JVM 17 编译；全部 118 定义的 7,631 组 Ajv 对照通过，1,247 有效 DTO 往返、6,384 拒绝用例；另有 28 活动桥及 3 强类型边界检查 | evidence/kotlin-results.json、kotlin-fixtures.json、kotlin-compile.txt |
| pnpm build | Vite 共享 UI 构建成功 | apps/web/dist；双端打包日志包含重构建输出 |
| 本轮 `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --reporter=json` | 桌面 Chrome 与 Pixel 7 移动视口共 96 通过，0 失败、0 flaky、0 跳过，含无人接听重新发起回归、宿主暂停/停止失败与通知能力正反对照；Chrome E2E 不等于原生真机或人工签收 | evidence/e2e-results.json、evidence/e2e.txt |
| 构建后静态资源 smoke | 桌宠/冲突/认领/停止未确认 4 场景，1440×1000 与 390×844 共 8 组；0 页面错误、无水平溢出 | evidence/ui-smoke.json、evidence/screenshots |
| Android 消息通道浏览器模拟 | appassets HTTPS 主框架的 2 视口中，能力查询/停止/暂停停止的请求、唯一 ID、0→1→2 代际与回复通过；未使用真实 WebView | evidence/android-browser-bridge.json、tests/manual/built-ui-smoke.py |
| pnpm android:build -Offline | assembleDebug 成功，编译共享 Kotlin DTO/校验器/活动桥及原生接收端；APK 大小/哈希见产物记录 | evidence/android-build.txt；apps/android/app/build/outputs/apk/debug/app-debug.apk |
| pnpm desktop:package | Windows x64 开发目录包成功，已包含当前共享 UI、桌面仓储迁移代码和提醒通知主进程桥，ASAR 内容检查通过，未生成正式安装器 | evidence/desktop-package.txt、evidence/desktop-package-contents.txt；apps/desktop/out/NuanbanDemo-win32-x64 |
| pnpm acceptance:check | FE-13 前端验收交接包预检 8 项通过；检查文档/证据完整、当前 43 个文件/668 项单元证据、本轮 96 项双视口 E2E 证据、Android Room/桌面提醒限制、C17 与 D 阻塞状态、桌面 ASAR 主进程文件和重现命令；报告为 `preparatory_ready`，仍 `preparatory_not_accepted`、`goNoGoEligible:false` | evidence/acceptance-bundle-results.json；scripts/check-acceptance-bundle.mjs |
| 包内容检查 | APK/ASAR 各 6 个 UI 文件集及 SHA-256 与当前 Web 构建一致；DEX 包含 ActiveBridgeRequest/ContractValidator/GeneratedContractDtos/TodoPatch，ASAR 不含开发 node_modules | evidence/android-assets.json、evidence/artifacts.json |
| pnpm android:lab:check | 45 项 Kotlin JVM 预备检查通过：35 项捕获状态机与 10 项 Android 提醒权限/能力矩阵场景；`deviceVerified=false`、`systemSchedulerVerified=false`，不是系统权限测试 | evidence/android-lab-jvm.json、evidence/android-lab-jvm-compile.txt；apps/android/native-lab/src/main/java/org/nuanban/nativelab/ReminderPolicy.kt；tests/native/ReminderPolicyCheck.kt；docs/implementation/c07-c08-android-policy.md |
| pnpm android:lab:build -Offline | 独立 native-lab Debug APK 编译成功；最终清单无网络/相机/麦克风权限，不改变正常演示包权限 | evidence/android-lab-build.txt、evidence/android-lab.json |
| pnpm android:build | 正常 Android app Debug APK 构建成功；Room 2.8.5 KAPT 生成、schema v3 提醒实体/DAO/1→3 数据库迁移、事务仓储、通知渠道/权限/精确闹钟适配器均通过编译；不含设备安装或系统投递 | apps/android/app/build/outputs/apk/debug/app-debug.apk；docs/implementation/c07-c08-android-room.md |
| pnpm android:room:check | 8 项 Android Room/通知预备检查通过，`roomCompileVerified=true`、`roomMigrationPreflightVerified=true`、`adbDeviceCount=0`、`deviceVerified=false`、`systemSchedulerVerified=false`；其中一项在本机 Node SQLite 中预演旧版表到 1→3 的增量迁移，另有一次性点击令牌、到期提交补偿、通知回执和 Activity 销毁顺序静态检查；不安装 APK、不请求权限、不触发提醒 | evidence/android-room-results.json；scripts/check-android-room.mjs |
| pnpm android:room:jvm:check | 纯 JVM 提醒状态转换 harness 9 项通过；覆盖并发认领、旧令牌/实例隔离、缺失令牌补发、回滚边界、版本替换、旧闹钟误认领保护、回执顺序、过期排程和 Activity 销毁竞态；`roomExecuted=false`、`deviceVerified=false`、`systemSchedulerVerified=false`，不替代真实 Room/设备验证 | evidence/android-room-jvm-results.json；tests/native/ReminderTransitionCheck.kt；scripts/check-reminder-transition-jvm.ps1 |
| :native-lab:lintDebug --offline | Android Lint 通过；内部实验的动态文案仍有 SetTextI18n 警告，非真机证明 | evidence/android-lab-lint.txt、evidence/android-lab.json |
| pnpm desktop:lab:check | 锁定 Electron 44.7.2 隐藏运行 12 项 C02 检查通过；控制页/合成窗口截图、DIP 往返和停止代际通过；自动化真实桌面媒体请求为 0 | evidence/desktop-lab-smoke.json、desktop-lab-smoke.txt、screenshots/desktop-lab-*.png |
| pnpm desktop:lab:package | 独立 Windows x64 未签名包成功；ASAR 17 个源文件与当前样例哈希比较通过，Forge 清理后的 package manifest 关键字段匹配 | evidence/desktop-lab-package.json；apps/desktop/native-lab/out/NuanbanC02Lab-win32-x64 |
| pnpm privacy:c03:check | C03 本地逐帧门控 52 项合成测试通过；覆盖授权/代际/时效、未知/失败/超时/低置信、文本风险、人脸脱敏失败和安全票据篡改；不含真实模型或媒体发送 | evidence/privacy-c03-results.json；packages/privacy/src/index.ts；tests/privacy/c03-gate.test.ts |
| pnpm media:c04:check | C04 受控媒体出口 15 项合成测试通过；覆盖安全票据、有界队列、AI/家属双出口共用 stop fence、迟到编码、伪造 artifact、出口失败和新代际；不含真实编码器/WebRTC/网络 | evidence/media-c04-results.json；packages/media-relay/src/index.ts；tests/privacy/c04-media-relay.test.ts |
| pnpm guidance:c05:c06:check | C05/C06 坐标与儿童指向 9 项合成测试通过；覆盖 Android 系统栏/letterbox/旋转、Windows DIP/负原点/缩放、失配撤标、儿童避让和无输入注入边界；不含真机、多屏或原生浮层 | evidence/guidance-c05-c06-results.json、guidance-c05-c06-scope.json；packages/guidance-engine/src/index.ts；tests/domain/guidance-platform.test.ts |
| pnpm reminder:c07:c08:check | C07/C08 共享提醒预备层 8 项规则测试、6 项派发闸门测试与 6 项平台边界测试通过（共 20 项）；覆盖稳定实例、幂等/旧版本、内部深链、时区/DST、取消、到期提交、submitted/delivered/opened/completed 分离、能力/权限拒绝、撤权代际、停止不自动恢复和调度端口失败阻断；不含 Room/生产 SQLite/系统调度 | evidence/reminder-c07-c08-results.json、reminder-c07-c08-scope.json；docs/implementation/c07-c08-dispatch.md；packages/reminder-engine/src/index.ts；tests/domain/reminder-engine.test.ts；tests/domain/reminder-dispatch.test.ts；tests/platform/native-host.test.ts |
| pnpm reminder:runtime:check | 共享 `ReminderRuntime` 4 项测试通过；覆盖稳定实例、重复同步去重、排程版本替换、完成/删除取消、到期单次触发、停止不自动恢复和取消失败阻断新版本；不含系统后台调度 | evidence/reminder-runtime-results.json；docs/implementation/c07-c08-runtime.md；packages/platform-ports/src/reminder-runtime.ts；tests/platform/reminder-runtime.test.ts |
| pnpm localdata:c07:c08:check | v4 IndexedDB 提醒仓储 3 项预备测试通过；覆盖账号隔离、重新创建仓储后的读取、重复实例/非法深链拒绝、原子替换后的清空和跨账号清理边界；不含 Room/生产 SQLite/系统调度 | evidence/localdata-c07-c08-results.json；packages/local-data/src/index.ts；packages/local-data/README.md；tests/integration/c07-c08-reminder-store.test.ts |
| pnpm pet:c13:check | C13 可动 2D 资产质量预备层 6 项规则测试通过；覆盖生成身份、单边 2048px、64MiB 解码内存、配色、body/eyes/mouth 图层、受控本地路径、边界、八种动作关键帧和畸形输入；结构完整资产只允许预览且不可发布 | evidence/pet-c13-results.json、pet-c13-scope.json；packages/pet-engine/src/index.ts；tests/domain/pet-asset-quality.test.ts |
| pnpm c11:3d:check | C11 3D 本地资源预检 10 项测试通过；覆盖 GLB/VRM 容器识别、FBX 隔离摘要要求、坏文件/声明冲突/未知扩展、外链/脚本、未知贴图尺寸、版本/材质/骨骼、50MiB/2048px/10万面/512MiB/300MiB/展开比例预算和 2D 回退；不含真实 Three.js/FBX 解析器/设备渲染 | evidence/c11-3d-results.json、c11-3d-scope.json；docs/implementation/c11-3d-spec.md；packages/pet-engine/src/three-d.ts；tests/domain/three-d-asset-preflight.test.ts |
| pnpm c12:sandbox:check | C12 供应沙箱 14 项测试通过，覆盖六类能力、合成凭证门控、流式顺序/取消、ASR 无结果、TTS 超时、活体/无 SIM 失败、生成取消/质量阈值、限流和供应不可用；报告仍标记真实凭证缺失和生产未就绪，不含真实网络/供应调用 | evidence/c12-sandbox-results.json、c12-sandbox-scope.json；docs/implementation/c12-supplier-sandbox.md；packages/provider-sandbox/src/index.ts；tests/provider/provider-sandbox.test.ts |
| pnpm c15:nv:check | C15 NV-01～NV-12 证据准入审计通过；逐项检查设备/供应信号、证据文件、统一记录字段、来源哈希和限制元数据，当前 `evidenceQualityPassed=true`、12 项全部 `blocked`，`goNoGoEligible:false`；不含真实设备或供应执行 | evidence/c15-nv-readiness-results.json、c15-nv-readiness.txt；docs/implementation/c15-nv-evidence-protocol.md；scripts/check-c15-nv-readiness.mjs；tests/acceptance/c15-nv-readiness.test.ts |
| pnpm c16:decision:check | C16 Q-02/Q-05/Q-10/Q-11/Q-14 决策准入审计通过；20 个 Top20 槽位和负责人签收字段保持 `unconfirmed`，`decisionReady:false`、`top20Approved:false`、`pilotEligible:false`；不含真实负责人/试点方批准 | evidence/c16-decision-readiness-results.json；docs/implementation/c16-decision-ledger.md；scripts/check-c16-decision-readiness.mjs；tests/acceptance/c16-decision-readiness.test.ts |
| pnpm c17:assembly:check | C17 组合根、账号隔离、IndexedDB 事务、Android 本地桥接、Electron SQLite 受限 IPC、桌面通知适配器与主进程提醒桥门控和高风险关闭的 9 项静态检查通过；报告仍为 `blocked`、`acceptance=preparatory_not_accepted`、`goNoGoEligible:false`，不含真实 WebView、Room、安装包迁移、系统权限、系统 Toast 或设备执行 | evidence/c17-assembly-results.json、c17-assembly-check.txt；docs/implementation/c17-assembly.md；scripts/check-c17-assembly.mjs；tests/acceptance/c17-assembly.test.ts；apps/desktop/notification-adapter.cjs；apps/desktop/reminder-notification-bridge.cjs；tests/platform/desktop-reminder-bridge.test.ts |
| pnpm d:gate:check | D01～D08 交接前置审计可重放；文件齐全但 B07/B10/B11 人工签收、C15/C16/C14/C17 准入条件未满足，报告保持 `blocked`、`preparatory_not_accepted`、`goNoGoEligible:false`、`eStarted:false`、`fStarted:false` | evidence/d-gate-readiness-results.json；scripts/check-d-gate-readiness.mjs；docs/implementation/d-gate-readiness.md；tests/acceptance/d-gate-readiness.test.ts |
| pnpm sqlite:c07:c08:check | 独立 Node 24 SQLite 预备实验 8 项检查通过；覆盖 schema 重复迁移、账号分区、同版本幂等、旧版本拒绝、同版本冲突、取消后不提交和关闭重开读取；不接系统调度或通知 | evidence/sqlite-c07-c08-results.json；apps/desktop/native-lab/c07-c08-sqlite-preflight.mjs；apps/desktop/native-lab/README-c07-c08-sqlite.md |
| pnpm desktop:reminder-store:check | Electron 主进程 SQLite 仓储定向测试 10 项通过；覆盖 v1→v2 迁移、关闭重开、账号隔离、幂等/版本冲突、取消/到期提交、回执/完成/取消时间、倒退回执拒绝、实例/排程版本绑定、非法深链、不可序列化资料，以及 `safeStorage` 可用/不可用时的 payload 编解码边界；不含 SQLite 整库加密、系统调度或真实通知 | evidence/desktop-reminder-store-results.json；apps/desktop/reminder-store.cjs；apps/desktop/main.cjs；apps/desktop/preload.cjs；docs/implementation/c07-c08-desktop-store.md |
| pnpm desktop:notification:check | 桌面通知适配器 5 项、主进程提醒桥 5 项合成测试通过；覆盖 Electron 通知 API/权限门控、固定非敏感正文、`submitted`/`delivered`/`opened`/`failed` 回执、到期/未到期/取消门控、内部深链白名单、同实例幂等/冲突、旧排程点击隔离和 dispose 释放；主进程当前权限保持 `unknown`，不会把合成通知当作 Windows Toast 或设备验收 | evidence/desktop-notification-adapter-results.json；apps/desktop/notification-adapter.cjs；apps/desktop/reminder-notification-bridge.cjs；apps/desktop/main.cjs；apps/desktop/preload.cjs；tests/platform/desktop-notification-adapter.test.ts；tests/platform/desktop-reminder-bridge.test.ts；docs/implementation/c07-c08-desktop-store.md |
| pnpm lifecycle:c09:c10:check | C09/C10 生命周期清理预备层最新定向回归 25 项合成测试通过；覆盖 Android/Windows 固定宿主事件映射、退出/渲染器退出/窗口移动通知、主进程停止请求合并、撤权/锁屏/递归捕获预留、出口关闭→代际失效→队列清理→轨道停止→浮层隐藏、解绑、并发停止、资源端口绑定、清理失败阻断重启、不自动恢复，以及原生宿主未明确确认捕获和媒体均已停止时的失败路径 | evidence/lifecycle-c09-c10-results.json、lifecycle-c09-c10-scope.json；docs/implementation/c09-c10-lifecycle.md；packages/platform-ports/src/index.ts；packages/platform-ports/src/lifecycle-events.ts；apps/desktop/lifecycle.cjs；tests/platform/native-host.test.ts；tests/platform/lifecycle-engine.test.ts；tests/platform/desktop-lifecycle.test.ts |
| pnpm c14:handoff:check | C14 契约交接预备层 9 项源审查通过；覆盖 0.2.0/60 操作/118 定义、授权、幂等/版本、错误包络、媒体同意、协助租约、流终止和 E-after-D 标记；不接真实后端/供应 | evidence/c14-handoff-results.json；docs/implementation/c14-backend-handoff.md；scripts/check-c14-handoff.mjs；packages/contracts/src/spec/ |

开发中修正了定位器/等待条件，并修复模态框内错误可访问性、HashRouter 跳过链接误路由、模态焦点返回与宿主同步探测异常。清空资料同时删除冲突草稿，已补集成回归。截图检查曾因额外写入不存在的定位文本失败，修正定位后重跑；全页截图前回到页首并关闭已读错误提示，避免滚动位置造成固定元素截图伪影。表格与 JSON 均为最终实际重跑结果，不把中途失败或重试记为业务成功。

本轮先复现并修复“原生通知能力 false 仍直接调用 Notification”的越权路径；保留已授权浏览器通知为正对照，确保不是一律关掉提醒。原生暂停测试初次使用错误场景/定位文本及空输入可发送断言，已按实际页面状态修正。Kotlin 夹具曾触及 JVM 单类上限，现按 60 例分组，保持全部用例；离线脚本改用 .NET SHA-256，避免依赖本机缺失的 Get-FileHash。中途失败不计入最终通过。

## 本机工具链及修复

- Node v24.21.0、pnpm 9.12.0；本机缓存下 `pnpm install --offline --frozen-lockfile` 成功，锁文件未改版本。不是独立干净机器验证。
- Android 使用已安装的 SDK 36、Android Studio JBR 21.0.10、锁定的 Gradle 8.14.3。脚本不依赖当前全局 JAVA_HOME 恰好正确，支持显式传入 SDK/JDK。
- Kotlin 对照使用缓存中的 compiler-embeddable 2.2.20 及其精确版本依赖；不引入序列化库或下载新依赖。DTO 的解析边界为 Map/List/标量，构造、编码和解码均严格校验；目标 Android 设备的时区库与真实 JSON/网络接入仍需后续验证。
- Forge 原先拒绝 pnpm 默认布局；增加项目 `.npmrc` 的 node-linker=hoisted。外部下载失败后，打包脚本改用本机已有且 ProductVersion 与锁版本一致的 Electron 44.7.2 分发文件建立本地 ZIP 缓存，不冒充重新获取官方分发包。
- 宿主只使用 Electron/Node 内置模块，UI 已静态打包，因此排除开发 node_modules 并关闭不必要的 prune 扫描，避免打包器遍历安装器开发依赖。ASAR 内容已核对。
- Android 同步和 Forge generateAssets 现在先校验目标仍在工程内，再清理对应生成 UI 暂存目录并复制新构建；避免 cp 叠加遗留旧哈希资源。APK/ASAR 的全部 UI 文件集和哈希已比较，不只检查 index.html。
- `main.cjs`、`preload.cjs`、`forge.config.cjs` 的 Node 语法检查通过。未通过隐藏窗口或浏览器截图冒充 Electron 窗口/跨应用验证。

## 产物及重现

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm contracts:check
pnpm contracts:kotlin:check
pnpm build
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='docs/implementation/evidence/e2e-results.json'
pnpm exec playwright test '--reporter=list,json'
pnpm android:build -Offline
pnpm desktop:package
```

静态构建复测：先执行 `pnpm --filter @nuanban/web preview --port 4173 --strictPort`，在另一个终端执行 `python tests/manual/built-ui-smoke.py`。需要本机 Python Playwright 与已安装 Chrome；这是辅助测试环境，不是应用运行依赖。脚本保存当前 index 哈希、8 组界面检查及 2 组明确标注的 Android 通道模拟证据。

启动 Web：双击根目录 `启动暖伴.bat`，或 `pnpm dev`。验收台位于 `#/development/scenarios`。生成任务演示入口位于「我的小伙伴 → 画一画 → 演示生成任务流程」。

Android Debug APK：`apps/android/app/build/outputs/apk/debug/app-debug.apk`。Windows 开发主程序：`apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe`，必须连同所在目录使用，不能只复制 exe。两个产物均未完成项目正式签名、安装/升级/回滚、真机功能或发布准入验证。

SHA-256 与大小见 evidence/artifacts.json。当前构建截图为 pet-settings、conflicts、account-demo、native-stop-failure 的 desktop/mobile PNG，逐项路径见 evidence/ui-smoke.json。android-bridge-simulated-desktop/mobile.png 来自 Chrome 中注入的合成消息通道，不是 Android 截图。scenario-desktop.png、interrupted-desktop.png、pet-job-mobile.png 为较早批次截图，不作为本轮构建证明。

## 已知限制和非准入结论

- C01 native-lab 是独立开发包，没有读取帧像素或发送通道；35 项 JVM、4 项静态边界、编译与 Lint 仅证明各自范围。当前 ADB 设备列表为空，没有安装、授权或采集。自动停止的 OS 调度延迟、触摸穿透、受保护页面和资源释放均待实测；不得称为 C01/NV-01/02 通过。复现和 12 条空白设备记录见 `apps/android/native-lab/README.md`。
- C02 native-lab 是独立 Windows 样例；74 项策略、12 项隐藏 Electron、截图、ASAR 和单显示器 DIP 往返只证明本机合成/策略边界。自动化真实桌面媒体请求为 0，当前没有双屏/负坐标/混合 DPI/真实穿透/人工复核记录；不得称为 C02/NV-03 通过。复现和人工记录见 `apps/desktop/native-lab/README.md`。正常 Web/Electron/Android 运行能力仍未开启。
- C03 本地门控只消费合成元数据和文本，不读取屏幕像素，不包含 OCR/人脸/模型或编码发送；52 项测试只能证明失败关闭、风险优先级和票据代际边界。真实模型质量、漏检/误停/未知覆盖率、每帧检测和发送端均待后续 C04/E11/F07，不得称为 C03/NV-06 通过。复现见 `packages/privacy/README.md`。
- C04 relay 只消费 C03 安全票据和最小合成元数据，两个出口均为本地内存接收器；15 项测试只能证明队列/代际/竞态边界，不证明真实编码、WebRTC、网络传输或接收端可达。真实媒体仍待 C15/E10/F07，不得称为 C04/NV-07 通过。复现见 `packages/media-relay/README.md`。
- C05/C06 坐标与儿童指向共享层只消费合成帧上下文和归一化目标；9 项测试覆盖 Android 系统栏/letterbox/旋转、Windows DIP/负原点/缩放、帧/布局/变换失效、儿童安全停靠/避让与核验边界。没有 Android/Windows 设备、跨应用浮层、多屏/混合 DPI、真实动画、穿透或人工点击证据，不得称为 C05/C06、NV-08 或 NV-09 通过。复现见 `docs/implementation/evidence/guidance-c05-c06-scope.json`。

 - C07/C08 当前有共享 reminder-engine、`ReminderDispatchGate` 权限/能力/撤权代际门控、Android `ReminderPolicy` 注入矩阵、Android Room 2.8.5 schema v3 实体/DAO/迁移/事务仓储与通知/精确闹钟保守适配器、9 项纯 JVM 状态转换 harness、v4 IndexedDB 提醒仓储、Electron 主进程 SQLite 仓储、显式调用的桌面通知适配器与主进程提醒桥、平台安全返回边界和独立 Node 24 SQLite 预备实验；桌面提醒 payload 已接入 `safeStorage` 条件编解码，但仍没有 Android 设备上的真实通知权限/AlarmManager/WorkManager 投递、SQLite 整库加密/Toast、安装包升级迁移或应用退出/睡眠/重启验证。浏览器 `page_only`、注入的 `system` 测试能力、Android APK/Room 编译、Android 策略矩阵、IndexedDB、桌面本地仓储、注入的 Electron `Notification`、主进程提醒桥、原生 `unsupported` 和 Node 预备实验不能替代系统调度，不得称为 C07/C08、AT-17 或 NV-02 通过。复现见 `docs/implementation/evidence/android-room-results.json`、`docs/implementation/evidence/android-room-jvm-results.json`、`docs/implementation/evidence/android-lab-jvm.json`、`docs/implementation/evidence/reminder-c07-c08-results.json`、`reminder-c07-c08-scope.json`、`docs/implementation/c07-c08-android-policy.md`、`docs/implementation/c07-c08-android-room.md`、`docs/implementation/c07-c08-dispatch.md`、`localdata-c07-c08-results.json`、`sqlite-c07-c08-results.json`、`desktop-reminder-store-results.json`、`desktop-notification-adapter-results.json` 和 `docs/implementation/c07-c08-desktop-store.md`。
  - C07/C08 当前 Windows 显式宿主端口已能把共享提醒运行时的排程、取消和到期请求交给本地 SQLite/通知桥；返回的系统能力仍为 `unsupported`，无法证明后台调度、系统权限、Toast 展示或真实回执。Android 正常 app 已通过受限活动消息桥接入 Room/AlarmManager，但权限、精确闹钟和系统投递能力仍未验证。
  - C09/C10 当前新增固定宿主事件装配和 Windows 主进程停止请求合并，但仍只有共享协调器/注入资源端口/合成宿主控制器证据；没有 Android 锁屏/撤权/进程终止/浮层污染、Windows 窗口移动/递归捕获/多屏或真实系统资源释放证据，不得称为 C09/C10、NV-04 或 NV-05 通过。页面事件在系统强杀或 WebView/渲染器已不可用时不能保证送达。复现见 `docs/implementation/evidence/lifecycle-c09-c10-results.json`、`lifecycle-c09-c10-scope.json`、`docs/implementation/c09-c10-lifecycle.md`。
- C14 当前只有源契约审查和交接草案；没有 A02 独立冻结、C12 真实供应沙箱、HTTP/SSE/WS、服务端鉴权、媒体租约或生产数据库证据，不得称为 C14、D02 或后端交接完成。复现见 `docs/implementation/evidence/c14-handoff-results.json`、`docs/implementation/c14-backend-handoff.md`。
- C11 当前只有合成本地字节和隔离解析摘要预检；GLB/VRM 只解析基础头/JSON，FBX 没有真实隔离解析器，未启动 Three.js/three-vrm/GLTFLoader/FBXLoader，也没有供应资产、设备渲染、帧率、内存、材质视觉或动作质量证据。不得称为 PET-03、NV-10、E20 或 F03 通过。复现见 `docs/implementation/evidence/c11-3d-results.json`、`docs/implementation/evidence/c11-3d-scope.json`、`docs/implementation/c11-3d-spec.md`。
- C12 当前只有本地合成供应沙箱；14 项测试和 11 个场景检查验证凭证缺失阻塞、流式取消、失败回退、限流/不可用和零网络/零原始载荷留存。没有运营商、人脸/活体、多模态、ASR、TTS 或生成真实凭证、区域/价格/配额/数据保留/合同条款、音频/活体/首片段/生成质量或独立复核证据。不得称为 NV-11/NV-12、E01、E08、E09、C15 或 D 通过。复现见 `docs/implementation/evidence/c12-sandbox-results.json`、`docs/implementation/evidence/c12-sandbox-scope.json`、`docs/implementation/c12-supplier-sandbox.md`。
- C15 当前只有证据准入审计；审计器可验证 NV-01～NV-12 的缺口被明确记录，但不能生成设备/供应计数、抓包、屏幕视频、真实模型或独立复核。12 项均为 `blocked`，不得称为 NV、C15 或 D 通过。复现见 `docs/implementation/evidence/c15-nv-readiness-results.json`、`docs/implementation/evidence/c15-nv-readiness.txt`、`docs/implementation/c15-nv-evidence-protocol.md`。
- C16 当前只有决策准入审计；5 项 Q 决策和 20 个 Top20 槽位均为 `unconfirmed`，没有负责人/试点方签收、应用版本、监护流程、留存政策、指标口径或设备/同意矩阵。不得称为 C16、M07、E18、E20 或 E24 通过。复现见 `docs/implementation/evidence/c16-decision-readiness-results.json`、`docs/implementation/c16-decision-ledger.md`。
  - C17 当前有共享仓储/桥接装配预备审计和 Android Room/通知源码编译检查；9 项静态检查和 3 项审计测试通过，Android Room schema v3 的 8 项预备检查及 9 项纯 JVM 状态转换 harness 通过（含本机 SQLite 1→3 迁移预演、一次性点击令牌、到期提交补偿和回执/销毁顺序静态检查），桌面通知适配器 5 项测试与主进程提醒桥 4 项测试另有合成证据，但 `status=blocked`、`acceptance=preparatory_not_accepted`。没有真实 WebView、Room 设备旧库升级/备份恢复、整库加密、Electron 安装包迁移、系统权限、设备生命周期或独立复核证据，不得称为 C17、NV 或 D 通过。复现见 `docs/implementation/evidence/c17-assembly-results.json`、`docs/implementation/evidence/android-room-results.json`、`docs/implementation/evidence/android-room-jvm-results.json`、`docs/implementation/c17-assembly.md`、`docs/implementation/c07-c08-android-room.md`、`docs/implementation/evidence/desktop-notification-adapter-results.json`。
 - 当前浏览器本地数据为 IndexedDB，Android 正常 app 已有 Room 本地提醒预备仓储和通知适配器，Windows Electron 已有本地 SQLite 仓储适配器；系统权限、后台投递和设备生命周期仍未验收，页面 timer 不是系统后台提醒。
- 原生跨应用捕获、浮层、敏感帧检测/脱敏、AI 与家属两个安全出口、坐标和生命周期没有设备证据。
- 账号、认证、人脸、认领、真实 AI/语音/生成、远程媒体、云同步、Top20 签名更新与生产服务未接入。
- 画稿任务预览仍是原画，source=simulation、generated=false；内置 SVG 的五官/姿态预览、确认应用和撤回是独立演示功能，不等于真实生成形象的微调/应用验收。
- 版本冲突比较/选择已完成本机模拟层；另一份版本明确为合成数据，没有远端并发与真实跨端合并证明。
- 登录/认领/监护只演示状态和明确确认，authenticated:false；不能凭模拟监护复选框授权真实儿童数据。
- 契约 0.2.0 仍为可评审草案；TS/Kotlin 生成与 JVM 对照已具备，真实 HTTP/SSE/WS 传输、独立冻结和正式发布未完成。Android JS 活动桥已覆盖能力查询、停止和受限提醒操作，C17 组合根已完成预备装配审计，但仍只有本机静态/合成证据，不能算 C01/C02 或真实 WebView/系统权限验收通过。
- Android 构建提示 Kotlin jvmTarget DSL 弃用和 SDK XML 工具版本差异；应在工具链维护时处理，此次 assembleDebug 未因此失败。
- D 关口尚未进行独立签收。所有 NV 及 AT 最终真实层仍待执行，E/F 不启动。
