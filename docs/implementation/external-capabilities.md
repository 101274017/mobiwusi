# 一次性外部能力清单与发布就绪

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

生成时间：2026-10-18T09:24:24.762Z；审查类型：automated；输入指纹：`15280d6810a21cd577e9d217ea838f0d9a85c9a8b1268ef7986e75feb2d6f2ce`。

本文件由 `node scripts/check-release-readiness.mjs` 从根计划 V1.2、共享门禁、当前本地源码/配置及既有证据计算生成。重复执行更新同一份台账，不要求逐任务补材料。

## 当前结论

- 开发：`DEV_BLOCKED`；可继续：`false`。
- 发布：`BLOCKED`；正式 ready：`false`。
- 外部待项：13 项；关闭/本地检查：14/16。
- 不更新正式 D07、任务卡或其他门禁证据；开发 go 不代替正式 Go。
- 本报告不验证本地服务启动；启动检查由主线程执行。

## 外部缺项（一次性汇总）

| 能力 | 验证状态 | 当前真实路径 | 缺项 | 关闭与降级证据 |
| --- | --- | --- | --- | --- |
| Android 系统授权、捕获/浮层、通知与生命周期 | EXTERNAL_PENDING | 关闭未证明，开发阻断 | 目标设备/系统版本、本人系统授权、捕获与停止计数、通知/后台/浮层及生命周期真实回执 | `apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/NativeCaptureRuntime.kt`、`apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/NativeCaptureService.kt`、`packages/privacy/src/index.ts`、`apps/android/standalone-runtime.md`；普通包无捕获/浮层组件；独立包默认关闭，缺完整本地检测器时拒绝系统采集授权流程；无远端媒体 |
| Windows 捕获、多屏 DPI、浮层与通知 | EXTERNAL_PENDING | 关闭证据已核对 | 目标 Windows 设备、混合 DPI/负坐标、多屏移动、真实权限/通知和停止回执 | `apps/desktop/native-runtime.cjs`、`apps/desktop/main.cjs`、`apps/desktop/standalone-host.cjs`、`packages/privacy/src/index.ts`；管理桥仍关闭高风险媒体；独立桌宠捕获另需本人选源和同意、逐帧安全门控，默认关闭；代码及自身UI测试不等于外部软件验收 |
| 真实检测/脱敏模型与目标应用 Top20 | EXTERNAL_PENDING | 关闭未证明，开发阻断 | 真实模型、目标应用版本、20 项设备适配和儿童指向实测；开发候选不是已适配证明 | `apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/LocalFrameGate.kt`、`packages/privacy/src/index.ts`、`docs/implementation/evidence/c16-decision-readiness-results.json`；检测未知、页面未知或敏感时拒绝发送，不做输入注入 |
| 真实生成 2D/3D 资产及许可 | EXTERNAL_PENDING | 关闭证据已核对 | 真实生成资产、授权许可、完整动作/格式/骨骼兼容和目标设备质量验证 | `packages/provider-sandbox/src/index.ts`、`apps/server/src/main.ts`；保留画布、草稿和既有 2D；无真实生成模块自动挂载 |
| 真实供应：carrier_auth | EXTERNAL_PENDING | 关闭证据已核对 | 受管供应凭据引用、供应条款、本人同意、服务端证明/防重放及无 SIM/拒绝/撤销实测 | `packages/provider-sandbox/src/index.ts`、`apps/server/src/main.ts`；使用明确标注的本地适配/文字或亲情兜底，不调用网络供应 |
| 真实供应：face_auth | EXTERNAL_PENDING | 关闭证据已核对 | 受管供应凭据引用、供应条款、本人同意、服务端证明/防重放及无 SIM/拒绝/撤销实测 | `packages/provider-sandbox/src/index.ts`、`apps/server/src/main.ts`；使用明确标注的本地适配/文字或亲情兜底，不调用网络供应 |
| 真实供应：multimodal | EXTERNAL_PENDING | 关闭证据已核对 | 受管供应凭据引用、授权端点/配额、用途与留存条款、真实质量/成本/取消和故障回执 | `packages/provider-sandbox/src/index.ts`、`apps/server/src/main.ts`、`apps/server/src/standalone-guidance.ts`；通用供应沙盒拒绝网络；独立视觉端口无配置503，需真实服务鉴权、本人用途同意和合规脱敏帧才按需请求，不回退Mock |
| 真实供应：asr | EXTERNAL_PENDING | 关闭证据已核对 | 受管供应凭据引用、授权端点/配额、用途与留存条款、真实质量/成本/取消和故障回执 | `packages/provider-sandbox/src/index.ts`、`apps/server/src/main.ts`；使用明确标注的本地适配/文字或亲情兜底，不调用网络供应 |
| 真实供应：tts | EXTERNAL_PENDING | 关闭证据已核对 | 受管供应凭据引用、授权端点/配额、用途与留存条款、真实质量/成本/取消和故障回执 | `packages/provider-sandbox/src/index.ts`、`apps/server/src/main.ts`；保留字幕，不调用网络供应 |
| 真实供应：pet_generation | EXTERNAL_PENDING | 关闭证据已核对 | 受管供应凭据引用、授权端点/配额、用途与留存条款、真实质量/成本/取消和故障回执 | `packages/provider-sandbox/src/index.ts`、`apps/server/src/main.ts`；保留草稿与既有 2D，不调用网络供应 |
| 真实编码、信令与 TURN 中继 | EXTERNAL_PENDING | 关闭未证明，开发阻断 | 授权信令/TURN、实际编码/中继、动态同意/撤权、断连和清理计数 | `packages/privacy/src/index.ts`、`apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/NativeCaptureRuntime.kt`、`apps/desktop/native-runtime.cjs`、`apps/server/src/main.ts`；默认服务不挂载媒体模块；外部采集和远端媒体关闭；不输出 TURN 凭据 |
| 真实参与者/监护同意与 F09/F10 试点 | EXTERNAL_PENDING | 关闭未证明，开发阻断 | 有效真实参与者/监护同意、撤回/到期记录、真实试点及效果记录；无可接受的真人证明验证器 | `packages/privacy/src/index.ts`、`docs/implementation/evidence/c16-decision-readiness-results.json`、`docs/implementation/evidence/f-execution-results.json`；仅合成账户和本地验证；真实采集/分享须独立系统授权和有效同意 |
| 正式部署、签名、恢复/回滚与对外交付 | EXTERNAL_PENDING | 关闭未证明，开发阻断 | 目标环境、生产运维/保留策略、签名与安装升级、备份恢复/回滚、真实对外交付证据；本地演练不是签收 | `apps/server/src/main.ts`、`docs/implementation/evidence/f-execution-results.json`；保持本地服务/开发模式，不开启真实供应、生产数据或正式 F 执行 |

## 可自动重跑的验证入口

以下入口只复核本地来源和新增证据，均不联网、不读取供应凭据、不启动真实设备或试点。没有真实证明仍返回 EXTERNAL_PENDING，不把 Mock、JVM、静态检查、打包或合成测试当正式验收。

```powershell
node scripts/check-release-readiness.mjs
node scripts/check-release-readiness.mjs --mode development --no-write
node scripts/check-release-readiness.mjs --mode release --no-write
node node_modules/vitest/vitest.mjs run tests/acceptance/release-readiness.test.ts
node scripts/check-c15-nv-readiness.mjs --no-write
node scripts/check-d07-decision.mjs --mode development --no-write
node scripts/check-d07-decision.mjs --mode release --no-write
```

- 默认 development：写入此清单和 `docs/implementation/evidence/release-readiness.json`；只有本地检查通过才退出 0。
- `--mode release`：只有发布 READY 才退出 0；缺外部条件退出 1，是预期门禁结果而非脚本崩溃。
- `--no-write`：只输出 JSON，两个模式都不写文件；未知参数/模式退出 1。
- 配置按 `apps/web/.env`、`.env.local`、对应模式配置及进程公开 VITE 键计算；根 `.env.example` 不当作已生效配置。端点仅分类，不输出值。
- 真实执行器目前未为这些外部条件提供完整自动验收入口：JSON 中 `real_execution_entry=null`。真实条件到位后先补受控实测/同意证明及对应验证器，再运行上面的离线复核；不能凭手改 ready 标志放行。

## 本地失败（若有）

- `D07_CURRENT_INPUTS`：只读复用 D07 当前源码指纹、Schema 和共享门禁判定；`scripts/project-gate.mjs`、`docs/implementation/evidence/c15-nv-readiness-results.json`、`docs/implementation/evidence/c16-decision-readiness-results.json`、`docs/implementation/evidence/d07-decision.json`。
- `ANDROID_CLOSED`：静态核对 Android 本地隔离捕获、未验证检测器和帧关闭路径；不宣称真机执行；`apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/NativeCaptureRuntime.kt`、`apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/NativeCaptureService.kt`、`apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/LocalFrameGate.kt`。

## 证据与边界

- 完整来源路径与 SHA-256、D07 输入指纹、逐项关闭检查、公开配置分类保存在生成 JSON 中；它们是本地工程证据而非供应或参与者证明。
- 检查范围仅为当前本地来源、公开配置、隔离的拒绝路径探针和既有证据；不代表全项目构建/启动或真实验收。
- 只读取允许的 VITE 配置键；不读取 token/key/secret 环境变量，不输出原始端点、凭据、供应载荷或未经脱敏的错误。
- Android 关闭证据为源码静态核对，不是真机结果；本地隔离捕获可能须本人系统授权，系统通知也不是全局关闭。
- 供应探针使用明确合成的准入材料验证 NETWORK_DISABLED，仅属本地拒绝测试，不是真实凭据或供应证明。
- 未知/缺失外部条件标 EXTERNAL_PENDING；关闭证据缺失或本地门禁失败则 DEV_BLOCKED，不以 external_pending 掩盖代码错误。
