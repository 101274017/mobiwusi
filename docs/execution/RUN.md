# 暖伴执行断点（独立桌宠改版）

更新日期：2026-10-18，Asia/Shanghai。当前任务是对照三份独立桌宠文档，改造独立悬浮、真实外部软件教学、本地持续观察、按需脱敏上云与用户亲手操作。差异及逐项实现追溯见 `docs/implementation/standalone-pet-migration.md`。

## 当前改造

- Windows 默认入口改为独立桌宠；管理懒加载，关闭管理不结束桌宠。受信桌宠 IPC、只读指引/字幕、直接文字提问、学习面板和停止入口已接。
- 观察与教学分离；仅本人选择的源可进入隔离媒体 worker，本地连续检测，必要帧按需分析；原图不出云。敏感、未知、失效或检测失败先关出口并停捕获，恢复须本人新操作；迟到的屏幕/语音确认不能在停止或锁屏后重启采集。
- Windows 本地离线唤醒与可选听写接入单独本人确认，默认关闭，不恢复授权，不用云常听替代。启动/故障/停止未真实退出前均保守显示可能持麦；退出等待真实清理。
- 服务端新增鉴权 `POST /v1/standalone/guidance/analyze`，供应配置仅服务端；无配置 503，不回退 Mock。请求/鉴权/响应通用 hook 不获取图片或问题正文。契约单一来源已更新为 61 个操作、127 个定义。
- 每次教学独立保存加密安全摘要，默认未掌握；本人明确确认掌握，AI 复习建议经本人确认后持久化本地调度，不伪造系统送达。慢推理只在最新安全上下文仍有效时接收，不放宽发送前的新鲜度及同帧准入。
- Android 普通 `:app` 与独立 `:standalone` 包已隔离；补接随包 OCR/人脸模型校验、300ms 同帧本地检测/脱敏、独立当次云同意、KeyStore 加密设备会话、真实单飞分析、新帧教学证据及只读标记/字幕。未就绪、未知/敏感、时效/来源/几何失败仍封闭。控制页/输入面板期间不取帧，关闭后需新检查；Android 本地唤醒、完整学习闭环/家属媒体仍未接线，真机效果未验收。
- 本任务四个并发代理已完成并关闭；但收尾期间共享宿主仍出现其他并行写入，不能把某次快照通过当作持续通过。没有自动启用用户屏幕或麦克风，不关闭用户已运行的旧应用。源码已有 Git 基线 `7b1c691`，本轮未提交或创建分支，未覆盖其他原画、语音或 3D 功能改动。

## 本轮最新验证（2026-10-18 收尾）

- 五项核心最终专项：15 文件、791/791，通过，`.cache/standalone-core-final-tests.log` / `.cache/standalone-core-final-report.json`。Android 专项 13 项包含实际 JVM runner；单独 JVM 264/264，与专项重叠，不相加。最后补正旧 Android 全屏 metrics，并对控件消失/恢复基线造成的自浮层反馈补上防重复分析与旧标记重画回归。
- 最新双 APK 离线编译成功（25 秒、78 任务），实际权限/组件/DEX/39 个模型及遥测后端隔离 87/87；`.cache/android-guidance-packaging-final.log`。普通 APK 保持原权限/入口且不含 ML/桌宠实现；最新哈希见 `apps/android/standalone-runtime.md`。未安装、启动设备、抓屏、录音或调用云供应。
- `pnpm build`、`pnpm contracts:check`、单独 `pnpm check:boundaries` 与 `git diff --check` 通过。C17 关键来源已扩展到新增 Android 检测、协议、连接、状态机、几何与测试，不省略安全来源指纹。
- 整仓 `pnpm check`（17:19～17:22）退出 1：106 文件、1895 项中 1852 通过、43 失败，8 个失败文件均为 acceptance。完整失败保留 `docs/implementation/evidence/unit-results.json` / `unit.txt`，日志 `.cache/standalone-android-integrated-check.log`；旧完整结果备份 `.cache/standalone-unit-before-android-*.json`。随后全屏 metrics 修正只做定向复验与 APK 重编，不把部分报告替换成全量。
- 当前真实失败不止先前 7 个指纹用例：并行改版删除 `packages/config/src/scenarios.ts`，release-readiness 25 个临时夹具因仍复制该文件而失败；C17-06 的旧 production Mock / UnconnectedRepository 静态标记不再匹配新配置。C17 的 20 文件/630 项真实源码专项通过，但整体审计失败；acceptance、D gate、D07/F/project gate 连带拒绝。新动态 detector 也不满足旧 `ANDROID_CLOSED` 对空 `LocalFrameGate()` 的静态规则，需要按真实默认拒绝机制审计，不能直接放行。
- 最新刷新 acceptance / D07 / release-readiness 均退出 1，`.cache/standalone-acceptance-latest.log` / `.cache/standalone-d07-latest.log` / `.cache/standalone-release-latest.log`。当前 `development=DEV_BLOCKED, release=BLOCKED, release.ready=false`，真实外部待项仍另列；不将本地代码/夹具失败归因于正式 Go 待审批。
- 不覆盖其他并行工作的配置、语音、原画或 3D 改动；本轮未提交/建分支，未为放行伪造授权、放宽隐私或修改正式批准。

## 前序验证快照（非当前整仓结论）

- `pnpm contracts:check`：通过，61 个操作、127 个定义，0 生成漂移；全量契约测试 10 文件、361 项通过。
- 定向 HTTP/隐私 hook、服务鉴权、桌宠宿主及门禁回归在相应快照通过。最后同步新增 `dictate` / `cancelDictation` 的严格 IPC API 名单，并验证额外参数不被转发；桌宠 UI、宿主及语音桥联测 102/102 通过，日志 `.cache/standalone-final-integration.log`。收尾没有扩大产品功能或放宽安全断言。
- 最新 `pnpm desktop:package` 退出 0，包含 Web/3D 构建、Forge 打包及 UI 字节一致性检查，日志 `.cache/standalone-integrated-final-package.log`。产物为 `apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe`。16:25:48 的 14 项独立运行时源码/ASAR 字节核对通过，两个 PowerShell 辅助脚本实际解包，见 `.cache/standalone-final-package-runtime-parity.json`；但 16:28:44 再核对时 `standalone-host.cjs`、`pet-preload.cjs`、`pet.html` 已被后续修改，见 `.cache/standalone-final-package-current-parity.json`。因此此包只代表打包时快照，不代表此后最新源码。早前缺失 3D 入口及类型错误是已恢复的历史失败，不是当前打包结论。
- 真实 Electron 自身 UI 冒烟 8/8 通过，零屏幕枚举/捕获尝试，结果 `.cache/standalone-smoke-1792311620041/results.json`；它是 16:20:31 的自身 UI 快照，不证明之后变更或真实外部软件教学。没有屏幕、麦克风或云供应授权。
- Windows 无麦能力 probe 返回已安装 zh-CN 本机引擎、听写可用，状态保持 disabled；合成图真实 OCR/遮盖探测通过且 `captureCalls=0`。未测试真实唤醒率、麦克风权限或真实外部画面。
- Android 双包已用最新契约离线重编，BUILD SUCCESSFUL（46 秒，76 任务），实际 APK 权限/入口/DEX 隔离 54/54 通过；此前 JVM 逻辑 41/41、相关 Vitest 41/41。日志 `.cache/standalone-android-packaging-final.log`；最新 APK 哈希见 `apps/android/standalone-runtime.md`。设备、抓屏、麦克风和云请求均未执行。
- C14 → C15 → C16 → C17 → acceptance → D07 在各次生成时真实通过；C17 纳入独立 runtime、worker、wake、Android 和专项测试指纹，未删除门禁或常量放行。最后全量期间共享宿主继续变更，C17 指纹再次失效，涉及 `standalone-host.cjs`、`pet-preload.cjs`、`pet.html`、`desktop-standalone-host.test.ts`。此前快照备份在 `.cache/standalone-evidence-before-1792309605126`；历次完整失败报告保留在 `.cache/standalone-full-failure-*.json`。
- 最后一次完整 `pnpm check`：类型检查通过，94 文件、1739 项中 1732 通过、7 失败，退出 1，日志 `.cache/standalone-integrated-final-check.log`，完整结果保留在 `docs/implementation/evidence/unit-results.json`。7 项均在 D07/F 开发门禁的 3 个测试文件，因上述源码指纹失效而拒绝继续；不是正式 Go 外部待项，也不能冒充全绿。此前 1692/1693 的失败已分清为接口名单未同步及文件写入中的语法错误，并做了 102 项联测；没有跳过失败用例。ASAR/唤醒/观察专项 187 项通过属于此前对应快照。
- 用于递归证据初始化的真实非 acceptance 源码报告为 1599 项通过，保存在 `.cache/standalone-final-source-report.json`，只属于预备源码层，不能替代最终全量失败报告。最后 `pnpm contracts:check` 与 `git diff --check` 均退出 0。
- 最终刷新 acceptance、D07、release-readiness 均退出 1：当前 `development=DEV_BLOCKED`、`release=BLOCKED`、`release.ready=false`，同时真实外部能力仍为 `external_pending`。需要先收敛共享文件并行写入，再重新冻结、刷新源码指纹及完整回归；不能以旧的开发 Go 或仅重写报告代替验证。D07 正式批准、真实系统权限/外部软件、供应、家属媒体、设备/性能、试点与签名仍不成立。

## 当前启动与续作

1. 退出旧版应用自身的桌宠，再在仓库根目录运行 `pnpm desktop`；单实例保护不强行替换旧进程。默认只启动桌宠，右键查看功能，管理按需打开。
2. 启动或测试不代表同意观察：屏幕来源、用途/可选云分析、麦克风都需本人明确操作；不能让代理替用户确认系统权限。
3. 连接真实视觉分析前，按 `docs/implementation/standalone-guidance-provider.md` 配置暖伴服务的有效设备会话及服务端供应环境，不能在 Renderer 写供应密钥。缺配置只报告不可用。
4. 复跑 `pnpm check`、`pnpm contracts:check`、`pnpm build`、`node scripts/test-standalone-desktop.mjs`；源码变更后按指纹依赖刷新开发证据，正式门禁仍保留待项。
5. 首次真实外部验收必须另获本人明确授权，测选定屏幕/第三方软件、逐步核验、未知/敏感熔断、撤权/锁屏/退出及多屏 DPI，不拿合成帧、自身 UI 或 APK 编译替代。

## 历史快照：V1.2（以下内容仅代表当时状态）

更新日期：2026-10-17（Asia/Shanghai）。实际基线为根目录 `暖伴AI公益助手-项目实施计划-Codex高效续作版(1).md` V1.2；由正文发现，不改名。根目录与 docs 副本 SHA-256 均为 `7de509f0441a32e9d4a641e64a985dff3303fedf460c300864ad4f9925eac64f`；保留 96 项功能范围，按开发与发布双状态续作。

## 当前任务与证据

- `development_gate=DEV_READY_WITH_EXTERNAL_PENDING`；`release_readiness=EXTERNAL_PENDING`、`release.ready=false`。正式待项不作为独立本地编码前置。
- 本次目标终审：修复 D07 规则遗漏、复核本地运行；需求逐项与证据对应见 `docs/implementation/d07-runtime-audit.md`。

- 当前任务：按用户“先跑 F”要求完成 F01～F24 本地开发级执行与回归，不把开发通过写成正式交付。
- 已有 D07 快照：`docs/implementation/evidence/d07-decision.json` 为 `schemaVersion=d07-decision/v2`、`decisionMode=development`、`decision=go`；开发结论为 `DEV_READY_WITH_EXTERNAL_PENDING`，不是正式 Go。
- 本轮 F 证据：`docs/implementation/evidence/f-execution-results.json` 的 `generatedAt=2026-10-17T15:37:07.882Z`；F01～F06、F07～F12、F13～F24 三阶段退出码均为 0、`success=true`、`safetyClosed=true`，24/24 项 `developmentStatus=checks_passed`。这是本轮真实运行的本机开发检查，不证明全部原始工作包正式交付。
- F 前置运行器 5/5 个作业成功：`docs/implementation/evidence/f-development-run-results.json`；未传 `--bypass-d07`，由实际自动开发门禁放行。E 代码/测试入口 26/26 存在，F 开发依赖均满足。
- 最终标准命令：`pnpm check`、`pnpm build`、`pnpm contracts:check` 均退出 0；Vitest 全量 73 个文件、880/880 项通过，见 `docs/implementation/evidence/unit-results.json`、`docs/implementation/evidence/check.txt`。此前全量桌面/移动 Chrome 视口 E2E 96/96 通过；界面源码未改，终审另实际启动网页并复测键盘入口、敏感文字拒绝、停止后无迟到回复，双视口 6/6 通过，见 `docs/implementation/evidence/runtime-web-results.json`。
- 终审补齐：C15 显式输出开发/外部/发布状态；C17 把隐私、媒体、供应拒绝路径与其测试纳入实际命令及 39 项源码指纹；D07 对源码修改、删除、损坏哈希和新增外部输入有负面回归。默认 Vitest 限制为 2 workers、文件串行，避免嵌套验证进程无界抢占资源；不保证网络永不重连。
- 已修复旧计划文件名断言、任务卡测试的类型导入，以及实际子进程测试使用不适合的默认 5 秒超时；失败后的完整回归通过，未跳过失败项。
- 正式状态仍为 `status=blocked`、`acceptance=preparatory_not_accepted`、`execution_started=false`、`eStarted=false`、`fStarted=false`；F 报告 `formalComplete=false`、`formalFExecutionStarted=false`、`release.verdict=EXTERNAL_PENDING`、`release.ready=false`。这些正式字段不代表本地开发未发生。
- F 报告的 `realNetworkEnabled=false`、`productionDataEnabled=false`、`realDevicesEnabled=false` 保持不变；本地服务可在隔离开发环境运行，不开放未验证的生产能力。

## 本地运行入口与检查顺序

- 服务并发边界：本轮 Playwright 独占 `:5173`，复用既有后端 `:3017` 验证后停止；验证结束后两个监听均已释放。续作仍须先检查实际监听，不盲目启动第二份服务。

在工作区根目录运行，Node/pnpm 要求以 `package.json` 为准；依赖已存在时不重复安装，缺依赖时才用 `pnpm install --frozen-lockfile`。

~~~powershell
node scripts/check-d07-decision.mjs --mode development --no-write
pnpm f:development:run
node scripts/f-development/execute.mjs --evidence docs/implementation/evidence/f-execution-results.json
pnpm tasks:refresh
pnpm dev
~~~

`pnpm dev` 启动仅绑定 `127.0.0.1` 的 Web 开发服务，配置端口为 5173、`strictPort=true`；以实际终端输出为准，端口占用应定位，不盲目启动第二份。也可双击 `启动暖伴.bat`。开发门禁本地错误应修复；不能因缺签字、角色、Top20 或人工决策 JSON 停止编码。

后端本地入口为另一个终端中的 `pnpm --filter @nuanban/server start`；代码默认监听 `127.0.0.1:3000`、使用内存仓储，执行前核对 `HOST`、`PORT`、`NUANBAN_SERVER_STORAGE` 等覆盖配置，不能连生产数据。前端默认演示模式不因后端启动自动变成真实认证、供应或媒体联调。

本轮后端实测 `/healthz` 返回 200、内存仓储 `status=ok`，未认证 `/v1/relations` 返回 401；复用已有回环服务检查，不代表生产部署或前后端真实供应联调。启动证据见 `docs/implementation/evidence/runtime-server-results.json`，本轮复核后已停止服务。

终审新增实际 Node 子进程启动：内存后端、空 SQLite 自动迁移、合成设备挑战/交换、鉴权后的关系查询，以及停止进程再启动后原会话仍有效，7/7 通过；见 `docs/implementation/evidence/runtime-sqlite-results.json`。仅在临时数据库使用合成账号，未输出密钥/令牌；所有子进程停止、临时数据库删除。该项证明真实本地 HTTP/SQLite 实现可运行，不证明前端已从 Mock 自动切换或接入真实供应。

E2E 使用已安装的 Chrome：PowerShell 先设 `$env:CI="1"`、`$env:PLAYWRIGHT_CHANNEL="chrome"`、`$env:PLAYWRIGHT_JSON_OUTPUT_FILE="docs/implementation/evidence/e2e-results.json"`，再执行 `pnpm exec playwright test --workers=2 --max-failures=1 '--reporter=line,json'`。未安装默认 Chromium 的失败不作为最终证据；完整 Chrome 重跑 96/96 通过。全量单测命令为 `pnpm exec vitest run --maxWorkers=2 --no-file-parallelism --reporter=default --reporter=json --outputFile=docs/implementation/evidence/unit-results.json`。

正式发布只读检查使用 `node scripts/check-d07-decision.mjs --mode release --no-write`，外部条件未满足预期退出 1，不能为了退出 0 修改正式状态。一次性外部能力清单及关闭/拒绝路径证据见 `docs/implementation/external-capabilities.md` 和 `evidence/release-readiness.json`。

## 续作规则

1. 本地调度读取前置任务的 `development`，保留 V1.2 的 FS/SS/FF；外部实测/真实授权独立记录为 `verification=external_pending`，不反向阻断独立的 E/F 编码、本地服务和自动测试。
2. D07 自动开发决定由实际证据生成；不要求用户补签字、选角色、给 Top20 或手填决策 JSON。真实权限、用户同意、设备和供应结果不能伪造。
3. 真正的编译、契约、门控、停止、模式隔离或失效证据错误属于 `DEV_BLOCKED`，应修复再验；不能改称外部待项。相同输入未变时不反复执行同一阻塞检查。
4. E/F 50 张任务卡、50 份检查记录与索引已按 V1.2 刷新，正式字段保留，开发字段按实际代码/证据记录；旧内容保存在 `docs/execution/.ef-card-backups/`。只用生成器刷新受管理文件，不覆盖未知人工改动。旧卡中的人工 Go 规则不再作为本地编码前置。
5. 恢复时先核对实际进程/会话，已验证内容不无故重做；当时记录工作区无 Git 提交基线，当前基线见本页新断点。使用小步写入与本地断点，不承诺网络/服务绝不重连，不关闭安全设置。

## 历史断点（V1.1，2026-10-17T15:57:00+08:00）

以下仅保留当时事实，不是当前开发前置，也不是本轮新检查结果：

- 当时为 D01～D08 预备材料及 E/F 50 张任务卡、50 份预备检查和启动矩阵准备；正式状态 `blocked / preparatory_not_accepted`，`eStarted=false`、`fStarted=false`。
- 桌面重打包和后置检查：修复前快照 3/6；修复后 Web/ASAR 6/6、0 extra；D08 浏览器无障碍 10/10；全量 Vitest 44 文件、681 项通过。
- 当时新增 EF 生成器、`EF-index.md`、D07 检查器/模板/测试等，既有 D/C evidence 未覆盖，产品源码/构建目录未改。EF 生成器 `node --check` 通过；只读预检 E=26/F=24、目标 101 个；50/50 行哈希/依赖/状态/引用审计通过。
- 当时 D-gate `--no-write` 退出码 0 但仍 `blocked`；`pnpm d07:decision:check` 对缺失决策记录退出 1 并保持 `blocked`。旧版人工决策前置已由 V1.2 双门禁替换，不篡改早期命令结果。
- 当时记录无代理、构建或后台任务，`run_id=ef-cards-20261017-1507`、无长任务日志；这不是当前主线程或后台状态的保证。
