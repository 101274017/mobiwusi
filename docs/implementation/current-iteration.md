# 当前开发批次：按 A → B → C/D 关口推进

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

## 当前维护方向（2026-10-22）

当前工作是微光指引独立桌宠的增量维护：桌宠与客户端分离、功能页隔离、授权本地观察、按需脱敏分析、单帧图片预览及只读指引。产品默认资料为空白本机资料，历史模拟登录/业务回复不再作为产品可用功能。用户始终亲手操作，不能把自动测试等同真实微信验收。

开发和发布采用双门禁：开发依赖满足时继续本地实现与测试，真实安全/编译/契约失败须修复；外部待项仅限制相应真实能力及正式发布，不因缺人工 D07 签字全局阻断编码。

## 2026-10-17 原始批次记录

下列执行顺序、禁止接入范围和测试数字只描述当时工作，不覆盖后续已明确配置的真实模型或当前独立桌宠改版；不是当前运行状态。

日期：2026-10-17（Asia/Shanghai）。依据产品需求文档、技术与实施方案、项目实施计划；文档描述的是产品基线，不是已完成证明。

## 执行顺序

1. 核对 A 阶段工程与范围，补 A02/A03/A10 的统一服务契约草案、生成与严格校验，不把代码存在当成人工签收。
2. 保留 B02/B04 的异常场景与安全状态，再依次补 B03 内置桌宠微调、B05 冲突比较、B06 登录/认领模拟。
3. 补 B09/B10 的键盘、焦点、字号、语音降级与回归证据，按 WBS 更新进度。
4. C 阶段只记录已验证能力；C01/C02 已有独立样例和本机合成证据，C05/C06 已补共享坐标与儿童指向合成向量，C12 已补供应沙箱边界，C15 已补 NV 证据准入审计，C16 已补决策台账，设备、授权、真实捕获、多屏、媒体、真实供应和负责人签收没有证据时保持待验证。D 未通过，E/F 不启动。

本轮继续推进：B07 已补 PRD 场景 A/B/C 的前端重放脚本 `docs/implementation/demo-scenarios.md`，并纳入 FE-13 交接包文件完整性检查；脚本只覆盖合成前端层，人工演示、C15 独立复核和 D 关口仍不自动通过。

## 开始时基线

- 已有共享前端、学习资料/待办/绘画本地存储，以及 Android/Windows 宿主骨架。
- 原工程已有基础成功 Mock、部分 Schema 与测试，不足以覆盖计划中的异常路径和服务交接。
- 前一轮已补 13 个可重放场景、流式取消和画稿任务；本轮在此基础上扩展，不重建界面。
- 真机、真实供应与独立签收均不能由本机测试替代。

## 范围限制

不虚构人员、资源申请、供应凭证、设备报告或 Go/No-Go 批准。不接入真实账号、AI、跨应用采集或远程媒体，不部署生产环境。

## 本批次实施结果

1. A02/A03/A10：形成 0.2.0 草案，60 操作、118 定义；同源生成 OpenAPI 3.1、TS/Kotlin DTO 与约束。严格映射、缺省/可空、联合分支及 7,631 个 JVM/Ajv 对照已测，仍未独立冻结或发布真实服务。
2. B02/B04：保留 13 场景、取消代际、事件顺序/完成校验、失败保留输入、低置信/风险暂停和过期邀请；部分回复不落学习笔记。
3. B03：画稿任务仍只展示原画；另补内置 SVG 的眼睛、嘴型、颜色、姿态预览，明确确认才应用，可持久化并撤回上一套配置。两条路径不混充真实生成资产。
4. B05：冲突时保留未保存笔记/待办草稿，展示本机与另一份模拟版本，必须逐项选择并确认；刷新不丢草稿，版本比较与写入在单个 IndexedDB 事务中执行。清空资料同时删除冲突草稿。
5. B06：本机号码、已登记人脸、已绑定设备、家属认领、社区逐人认领五条合成路径；处理失败、过期、取消和儿童监护确认。始终 authenticated:false，不采集真实身份或签发会话。
6. B09/B10：修复 HashRouter 跳过导航、路由/模态框焦点；补最大字号、减少动画、静音/语音不可用降级测试。不是独立人工读屏验收。
7. C17：共享适配层可用 Electron 受限本地仓储或 Android 本地 HTTPS 主框架 postMessage；活动桥覆盖能力查询、停止和提醒排程/取消/到期，严格 ID/代际/类型、超时、停止取消、迟到隔离与清理有测试。Android Room 调用已通过后台 executor 接入，但 Android onPause 通知页面停止，宿主停止失败显示未确认；高风险能力始终 false。Chrome 同源通道模拟和 APK 编译不是 WebView 真机证明。
8. A06/A07/A10：668 项单元/契约/集成/静态边界、本轮 96 项双视口 E2E、7,631 项 Kotlin 对照及 32 项活动桥对照通过；`pnpm check` 通过 `test:evidence` 同步 `unit-results.json` 与 `unit.txt`；双端开发包核对全部 UI 文件和 APK DEX 中的契约类。原生能力关闭时不会越过开关发系统通知，浏览器已授权通知保留正对照。E2E 是 Chrome 自动化，不是 D 人工签收。
9. C01：追加独立 native-lab 预备模块，不改变正常演示包权限或共享前端能力。明确同意和每次系统授权后才尝试前台投影/可选浮层，只隔离释放帧，不读像素/保存/上传。35 项 JVM 状态机检查、APK 编译及 Lint 通过；无 ADB 设备，未安装/启动采集，12 条实测记录全部待验证。源码/包证据见 evidence/android-lab.json。
10. C02：追加独立 Windows native-lab 预备模块，不改变正常宿主能力。固定合成窗口、自有来源白名单、无音频、透明/穿透配置、停止代际和显示器事件停止；74 项策略检查、隐藏 Electron 12 项检查、截图与离线未签名包通过。自动化不请求真实桌面媒体，NV-03 的双屏/混合 DPI/负坐标/穿透仍待人工验证。
11. C03：补充本地逐帧安全门控，不接真实 OCR/模型或媒体发送。放行必须同时通过系统授权、用途、会话、代际、时效、页面范围、检测健康、OCR、置信度、风险和第三方人脸脱敏；52 项合成测试通过，未知和失败均保守暂停。
12. C04：补充仅内存受控媒体出口，不接真实编码器/WebRTC/网络。安全票据通过后进入有界队列，最小安全元数据进入合成编码器，再按同一 stop fence 发送到 AI/家属本地接收端；15 项竞态测试通过，真实 NV-07 仍待接收端/抓包/设备验证。
13. C05/C06：补充共享坐标变换与目标生命周期，覆盖 Android 系统栏/letterbox/旋转、Windows DIP/负显示器原点/混合缩放，以及儿童安全停靠、遮挡避让、过期撤标和“我点好了”只触发核验；9 项合成向量通过。没有真机、原生浮层、多屏、穿透或人工点击证据，NV-08/NV-09 仍未验收，证据见 evidence/guidance-c05-c06-scope.json。
14. C07/C08 预备层：新增共享 reminder-engine 和 `ReminderDispatchGate`，严格校验 UUID、RFC3339、IANA 时区、内部深链和排程版本；稳定生成 `instanceId`，幂等排程、旧版本拒绝、取消、到期提交、submitted/delivered/opened/completed 分离、权限/能力拒绝、撤权代际和停止不自动恢复均有合成测试；新增 v4 IndexedDB 提醒仓储、Electron 主进程 SQLite 仓储、Android `ReminderPolicy` 权限/能力矩阵，以及正常 Android app 的 Room 2.8.5 schema v3 实体/DAO/事务仓储、1→3 迁移入口、一次性点击令牌和通知/精确闹钟保守适配器，覆盖账号隔离、原子替换、非法深链/重复实例拒绝、回执/完成、关闭重开和通知/后台能力保守判定；新增显式调用的 Electron 桌面通知适配器，固定非敏感正文并处理 show/click/failed 回执；共享 `ReminderRuntime` 已将待办生命周期接入平台端口，Windows 显式宿主 `reminderStore` 可接收本地排程/取消/到期请求。14 项共享规则/派发测试、6 项平台边界测试、4 项运行时测试、4 项提醒仓储测试、10 项桌面仓储测试、5 项桌面通知适配器测试、5 项主进程提醒桥测试、10 项 Android 策略场景、8 项 Android Room/通知预备检查和 9 项纯 JVM 状态转换 harness 通过，其中包含本机 SQLite 1→3 增量迁移和一次性点击令牌边界、到期提交补偿、通知回执和 Activity 销毁顺序检查。浏览器端明确 `page_only`；Android/桌面适配器在权限或能力不明确时拒绝系统调度；桌面仓储新增 v1→v2 迁移和回执时间顺序保护，payload 仍只有 `safeStorage` 条件加密；未完成真实 Room 旧库升级、SQLite 整库加密、真实系统权限、设备后台投递或用户回执，C07/C08 仍未验收。
15. C13 预备层：新增可动 2D pet manifest 质量门控，校验 `generated_2d` 身份、单边 2048px、64MiB 解码内存、受控本地资源路径、body/eyes/mouth 图层、八种动作关键帧和配色；结构完整资产可进入预览，但始终要求人工复核且不可发布。6 项测试通过；没有真实生成样本、视觉/儿童理解评审、动画自然度或供应验收。
16. C07/C08 独立 SQLite 预备层与桌面仓储：使用 Node `v24.21.0` `node:sqlite.DatabaseSync` 完成 schema 重复迁移、账号分区、幂等/旧版本/同版本冲突、取消后到期不提交和关闭重开读取 8 项检查；新增 `apps/desktop/reminder-store.cjs` 并通过受限 IPC 接入 Electron 主进程，10 项定向测试覆盖 v1→v2 迁移、回执/完成/取消时间、倒退回执拒绝、关闭重开和 `safeStorage` payload 编解码；新增 `apps/desktop/notification-adapter.cjs` 和 `apps/desktop/reminder-notification-bridge.cjs`，5 项适配器测试与 5 项主进程桥测试覆盖能力/权限门控、非敏感正文、到期/未到期/取消、show/click/failed 回执、内部深链和释放边界。主进程权限仍明确为 `unknown`，不会把装配或合成通知当作 Windows Toast；仍不是系统调度、SQLite 整库加密或真实通知证明，证据见 `evidence/sqlite-c07-c08-results.json`、`evidence/desktop-reminder-store-results.json`、`evidence/desktop-notification-adapter-results.json` 和 `docs/implementation/c07-c08-desktop-store.md`。
17. C09/C10 生命周期预备层：新增共享 `LifecycleCoordinator`、固定宿主事件绑定、Android `onPause`/`onDestroy` 页面通知、Electron 退出/渲染器退出/窗口移动通知和主进程停止请求合并；按出口关闭→代际失效→队列清理→轨道停止→浮层隐藏顺序清理，并要求原生 `stopAll` 明确确认捕获/媒体均已停止，最新定向回归 25 项生命周期测试（含宿主未确认停止回归）通过，无设备生命周期证据。
18. C14 交接预备层：新增源契约审查脚本和后端交接草案，9 项检查覆盖操作/定义计数、对象授权、Idempotency-Key、If-Match/ETag、错误包络、采集同意、协助短期 relay-only 租约、流终止和 E-after-D 标记；无真实后端或供应接入。
19. C11 3D 预备层：新增 VRM/GLB 容器识别、FBX Binary/ASCII 头识别与隔离摘要门控，按候选矩阵检查版本、外链/脚本、材质、骨骼和文件/贴图/三角面/解析峰值/解码/展开比例预算；无标准动作骨骼时只报告 display-only，失败回退 2D。10 项合成测试通过；无真实 Three.js/FBX 解析器、供应资产或设备渲染证据，详见 `docs/implementation/c11-3d-spec.md`。
20. C12 供应沙箱预备层：新增六类供应能力矩阵和合成凭证门控，覆盖流式成功/取消、ASR 无结果、TTS 超时、活体证明拒绝、无 SIM 替代登录、生成取消/质量阈值、限流与供应不可用。14 项 Vitest 断言、11 个场景检查通过；所有结果不访问网络且不保留原始载荷。真实凭证缺失，C12 报告保持 `blocked / preparatory_not_accepted`，详见 `docs/implementation/c12-supplier-sandbox.md`。
21. C15 NV 证据准入审计：逐项读取 NV-01～NV-12 当前证据，检查设备/供应信号是否达到独立复核门槛，并保留统一记录字段；3 项审计测试和 12 项逐项审计通过，但当前报告为 `blocked`、`goNoGoEligible:false`，不生成任何虚假的设备/供应通过结论，详见 `docs/implementation/c15-nv-evidence-protocol.md`。
22. C16 决策准入审计：审计 Q-02/Q-05/Q-10/Q-11/Q-14 的负责人签收和必要字段，保留 20 个空白候选槽位；3 项测试和 5 项决策检查通过，但当前报告为 `unconfirmed`、`decisionReady:false`、`pilotEligible:false`，不生成 Top20 或试点批准结论，详见 `docs/implementation/c16-decision-ledger.md`。
23. C17 共享仓储与桥接装配预备审计：检查组合根、`ownerId` 隔离、IndexedDB 事务、Android `appassets` 主框架消息桥、Android Room 编译/迁移入口、Electron SQLite 受限 IPC、桌面通知适配器与主进程提醒桥显式能力/权限门控和高风险关闭；9 项静态检查、3 项 C17 审计测试、5 项通知适配器测试与 5 项提醒桥测试通过，但整体仍为 `blocked / preparatory_not_accepted`，不代表真实 WebView、Room 旧库升级/整库加密、安装包迁移、系统权限、系统 Toast 或设备验证。
24. FE-13 前端验收交接包预检：新增 `scripts/check-acceptance-bundle.mjs` 和 `pnpm acceptance:check`，检查文档/证据完整性、43 个文件/668 项单元证据、本轮 96 项双视口 E2E 证据、Android Room 与桌面提醒限制、C17/D 阻塞状态、桌面 ASAR 主进程文件和重现命令；8 项检查通过，报告为 `preparatory_ready`，不替代 B07/B11 人工演示签收、C15 独立复核或 D Go/No-Go。
25. C07/C08 运行时接线：新增共享 `ReminderRuntime`，以稳定实例和排程版本管理待办同步，修改先取消旧排程、完成/删除取消当前排程，到期事件按实例去重，停止后不自动恢复，旧实例取消失败时阻断新版本排程；`App` 不再直接散落提醒定时器。4 项运行时测试通过，浏览器仍为 `page_only`，原生未验证能力仍为 `unsupported`，详见 `docs/implementation/c07-c08-runtime.md`。
26. D01～D08 关口预备审计：新增 `scripts/check-d-gate-readiness.mjs`、`pnpm d:gate:check`、D 预备报告和 2 项审计测试；当前准确保持 `blocked / preparatory_not_accepted`，不启动 E/F，详见 `docs/implementation/d-gate-readiness.md`。

当前 96 项 WBS 见 wbs.md，未完成项保留。下一步按依赖推进 C07 Android 真实权限/调度和 Room 旧库迁移演练、C08 SQLite 整库加密/桌面通知/退出睡眠重启实测，再推进 C09/C10 设备生命周期实测、C11 真实三格式解析/渲染样本、C12 真实凭证/条款与供应质量核验、C13 真实资产样本/人工质量评审、C15 NV-01～NV-12 真实执行与独立复核、C16 负责人/试点方决策输入，以及 C14 A02/供应结论独立交接评审；C17 只等待真实 WebView/Room/设备资源进行下一层验证，同时等待 C01/C02 设备资源与 B07/B11 人工演示/读屏复核。无设备、凭证或负责人签收时如实记录，不以合成规则越过 D 进入 E/F。实际命令、产物和证据见 verification.md。
