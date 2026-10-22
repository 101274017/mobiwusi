# WBS 执行账本（V1.2 双状态）

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。依据根目录 `暖伴AI公益助手-项目实施计划-Codex高效续作版.md` V1.2 第 3.2～3.7 节，保留 96 项唯一编号：A10/B11/C17/D8/E26/F24。下表工作包名称与输入依赖取自根 V1.2；W1～W24 仍为相对计划周，不是已执行日期。

## 开发与验证口径

- `development` 是本地代码、服务、契约与自动验证进度；依赖的 FS/SS/FF 读取前置开发状态，不要求前置所有外部实测/签收先 accepted。
- `verification` 单列外部设备、供应、真实同意/试点与正式验收。没有真实证据就保留 `external_pending` 和相应能力关闭，不把代码存在/Mock/合成/静态/打包写成生产已完成。
- D07 已有快照为 `DEV_READY_WITH_EXTERNAL_PENDING`，发布为 `EXTERNAL_PENDING`、`release.ready=false`。正式 `blocked / preparatory_not_accepted / execution_started=false / fStarted=false` 保留，但不是本地编码禁令；不要求用户补签字、角色、Top20 或人工决策 JSON。
- E01～E26 经只读 `node scripts/check-e-development.mjs` 确认代码和测试入口均存在；`implemented` 仅是存在性，不表示测试执行、应用运行或工作包全部完成。
- F 已有 `f-execution-results.json`（`generatedAt=2026-10-17T14:30:42.952Z`）记录三阶段退出码 0、24/24 项 `checks_passed`；`formalComplete=false`、`fStarted=false`。本轮不重跑或扩展其他 F 交付。
- 本轮优先 D07 与本地可运行检查，实际启动/页面/接口/构建结论待主线程补录至 [RUN](../execution/RUN.md)。A/B/C 左栏保留历史局部记录，不冒充本轮重验；真正的相关软件/安全/证据失败仍为 `DEV_BLOCKED`，不能改称外部待项。

## 阶段 A：契约与工程准备

| WBS | 工作包 | V1.2 需求与输入依赖 | development / 本地工程记录 | verification / 外部与正式状态 |
| --- | --- | --- | --- | --- |
| A01 | 范围与假设基线 | 全基线/Q-01～15；前置 无 | 已核对范围与 Q 台账；V1.2 按自主默认方案续作，不等待人员/日期签收才能开发。历史范围记录保留于 baseline.md。 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A02 | 架构与服务契约评审 | ACC/HELP/同步；前置 A01：SS | 0.2.0 草案覆盖 60 操作/118 定义、HTTP/SSE/信令、错误/版本/幂等元数据；独立评审与冻结未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A03 | Schema、端口与确定性 Mock | IN/CHAT/GUIDE；前置 A02：SS | Schema/OpenAPI/TS/Kotlin 同源生成、缺省/可空/联合与 7,631 项 JVM 对照、严格映射及 13 场景已测；真实传输与独立冻结未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A04 | 验收设计与安全素材 | AT-01～24/NV-01～12；前置 A01：SS | 本批次补测试与 AT/NV 追踪；真实帧 canary 与独立复核待执行 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A05 | 设计系统与人群交互 | PET/SUB/无障碍；前置 A01：SS | 已有 tokens 与共享原型；保留既有暖色风格，人工设计/无障碍评审未签收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A06 | Android 工程与端口骨架 | SYS/IN；前置 A02：SS | 已有 Kotlin 受限桥骨架；本批次同步 UI 并构建 Debug APK，未做设备安装验证 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A07 | Windows 工程与窗口骨架 | SYS/PET；前置 A02：SS | 已有 Electron 主窗/受限 IPC；本批次 Windows x64 开发包打包及 ASAR 校验通过；原生实验未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A08 | 安全模型与供应适配设计 | SAFE/PET/CHAT；前置 A02：SS | 已有纯门控与隐私单测；真实检测/语音/生成/媒体供应设计与验证未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A09 | 资源发现与外部能力清单 | Q-01/02/04/05/15；前置 A01：FS | 原记录真实成员、设备预约、供应凭证和试点申请未提供；V1.2 改为资源发现与外部能力清单，不伪造申请，不要求用户补办后才编码。 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| A10 | 工具链与契约发布基线 | 工程/ADR；前置 A02：SS，A03：FF | 类型/边界、6 Schema/118 定义、668 测试、Kotlin 离线编译/对照及双端打包通过；补 C01～C17/D 关口预备证据复核脚本，正式冻结/跨语言发布未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |

## 阶段 B：共享前端闭环

| WBS | 工作包 | V1.2 需求与输入依赖 | development / 本地工程记录 | verification / 外部与正式状态 |
| --- | --- | --- | --- | --- |
| B01 | UI 路由与应用装配 | 全UI；前置 A03/A05：FS | 共享路由已存在；本批次加验收台和服务/场景命名空间隔离；真实账号未接入 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B02 | 多输入、流式对话与字幕 | IN-01～06/CHAT/SUB；前置 B01：FS | 本批次补流事件、取消防迟到、错误保留输入、重试与字幕；真实识别由 C/E 提供 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B03 | 桌宠、绘画与生成任务交互 | PET-01～04；前置 B01：FS | 画稿任务模拟/保稿/取消/原画确认及内置 SVG 五官/颜色/姿态预览、确认应用/撤回已测；真实可动资产未接入 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B04 | 教学与风险状态界面 | GUIDE/SAFE；前置 B02：FS | 已有逐步合成教学；本批次加低置信/风险夹具与暂停；不表示跨应用教学 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B05 | 档案、待办和复习界面 | NOTE/TODO；前置 B02：FS | 本机档案/待办/复习及冲突比较、草稿刷新恢复、显式选择已测；IDB 原子版本写入/清空草稿已测，非真实云同步 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B06 | 账号、家属与协助界面 | ACC/HELP；前置 B03：FS | 五条登录/认领模拟路径、本人/儿童监护确认、失败/过期/取消、关系 scope 与邀请状态已测；无真实认证或媒体接通 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B07 | 前端交互整合与修正 | PRD场景A/B/C；前置 B04：FS，B05/B06：FF | 三类入口可演示；已补 `docs/implementation/demo-scenarios.md` 三场景逐步重放脚本，人工演示/业务验收仍待负责人签收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B08 | 适老适幼及绘画资产设计 | PET/SUB/GUIDE；前置 A05：FS | 内置 2D 样例已存在；自绘生成资产、儿童完整动作与设计签收未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B09 | 全页面无障碍复核 | 无障碍/AT-15；前置 B08：FS | 键盘跳过/激活、最大字号、减少动画、焦点返回、静音/语音降级已自动验证；全页面人工读屏与独立复核未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B10 | 组件/契约/Mock E2E | AT-01～24前端层；前置 A04：FS，B01～B07：SS/FF | 43 文件 668 项总检查（含 C01～C17 原生/策略/坐标/提醒/生命周期/3D/供应沙箱/NV 准入审计/决策台账/装配审计边界、D 关口预备审计与 C13 资产门控）、本轮 96 双视口 E2E、8 组静态 UI 与 2 组消息通道模拟通过；FE-13 验收交接包预检 8 项通过；不能替代真实层验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| B11 | 自主需求默认决策与交互核对 | Q-01～15；前置 A09：FS | 原记录待项目负责人及真实参与者评审、无会议或业务签收；V1.2 改为自主默认决策与交互核对，不把真人评审设为开发前置。 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |

## 阶段 C：原生及供应工程验证

| WBS | 工作包 | V1.2 需求与输入依赖 | development / 本地工程记录 | verification / 外部与正式状态 |
| --- | --- | --- | --- | --- |
| C01 | Android 捕获与浮层验证 | NV-01/02/IN/SYS；前置 A06：FS | 预备样例：独立 native-lab、本次授权/前台服务/可选浮层/隔离释放；35 项 JVM 状态机与编译通过。无设备安装、真实授权/穿透/停止证据，未通过验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C02 | 桌面窗口/捕获/多屏验证 | NV-03/IN/SYS；前置 A07：FS | 预备样例：固定合成窗口、严格自有来源、可选透明/穿透窗口、停止代际、DIP/物理坐标记录；74 项策略与隐藏 Electron 12 项检查、离线未签名包通过。真实桌面媒体、双屏/负坐标/混合 DPI/穿透仍待人工验证，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C03 | 本地敏感检测与脱敏样例 | NV-06/SAFE；前置 A08：FS | 本地逐帧门控样例：逐帧授权/代际/时效/页面范围/检测健康/OCR/置信度/文本风险/第三方人脸脱敏门控，短时票据绑定 frame/hash/policy；52 项合成测试通过。无真实 OCR/模型/帧像素/编码发送，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C04 | 受控媒体源与中继样例 | NV-07/HELP；前置 C03：FS，C01/C02：FS | 仅内存 relay 样例：安全票据→有界队列→合成编码元数据→AI/家属双出口，共用 stop fence；15 项合成竞态/伪造/失败测试通过。无真实编码、WebRTC、网络、抓包或接收端，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C05 | Android 坐标与儿童指向 | NV-08/09/GUIDE；前置 C01：FS | 已补共享变换、状态栏/导航栏/letterbox/旋转、目标生命周期与儿童安全停靠的 9 项合成向量；无 Android 设备、原生浮层和真实跨应用证据，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C06 | Windows 坐标与儿童指向 | NV-08/09/GUIDE；前置 C02：FS | 已补共享变换、DIP/物理像素、负显示器原点、窗口/DPI 失效与儿童避让的 9 项合成向量；无真实多屏/混合 DPI/穿透和独立复核，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C07 | Room、权限与本地提醒 | NV-02/本地数据/TODO；前置 C01：FS | 已补共享提醒排程/回执规则、`ReminderDispatchGate`、`ReminderRuntime` 待办生命周期接线、v4 IndexedDB 提醒仓储、独立 Node SQLite 预备实验、Android `ReminderPolicy` 权限/能力矩阵，以及正常 app 的 Room 2.8.5 schema v3 实体/DAO/事务仓储、1→3 迁移入口、一次性通知点击令牌和通知/精确闹钟保守适配器；另有 9 项纯 JVM 状态转换 harness 通过；浏览器仍为 `page_only`，Android 仍缺真实设备权限/调度/回执，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C08 | SQLite、资源与桌面提醒 | 本地数据/TODO/SYS；前置 C02：FS | 已新增 `apps/desktop/reminder-store.cjs` 和受限主进程 IPC，并将 Windows `reminderStore` 接入共享宿主端口；10 项桌面仓储测试覆盖 v1→v2 迁移、账号隔离、版本冲突、取消、回执/完成时间、倒退回执拒绝、实例/排程版本绑定、关闭重开及 `safeStorage` 条件下的提醒 payload 加密；另有 `notification-adapter.cjs` 与 `reminder-notification-bridge.cjs`，5 项适配器测试和 5 项主进程桥测试覆盖显式能力/权限门控、到期/未到期/取消、show/click/failed 回执、内部深链、旧排程点击隔离和非敏感正文；主进程权限保持 `unknown`，仍未完成 SQLite 整库加密、Toast、计划任务、应用退出/睡眠/重启实测，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C09 | Android 生命周期清理 | NV-04/05/SAFE；前置 C05：FS，C07：SS | 已补共享生命周期协调器与宿主事件绑定：`onPause`→锁屏、`onDestroy`→进程终止、权限撤回预留；最新定向回归 25 项 C09/C10 合成测试通过，覆盖清理顺序、并发、解绑、失败阻断及原生宿主未确认停止回执；无 Android 锁屏/撤权/进程终止/浮层设备验证，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C10 | Windows 生命周期清理 | NV-04/05/SAFE；前置 C06：FS，C08：SS | 已补共享生命周期协调器、Electron 退出/渲染器退出/窗口移动事件通知和主进程停止请求合并；最新定向回归 25 项 C09/C10 合成测试通过，覆盖窗口移动/递归捕获预留、代际与资源清理及原生宿主未确认停止回执；无真实多屏/窗口/桌面捕获设备验证，未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C11 | 3D 导入可行性样例 | NV-10/PET-03；前置 C02：FS | 已补桌面候选矩阵和本地预检：按容器识别 VRM/GLB、识别 FBX 头并要求隔离解析摘要，校验外链/脚本/版本/材质/骨骼/50MiB 文件、2048px 贴图、10万面、512MiB 解析和 300MiB 解码预算；10 项合成测试通过。无真实 Three.js/FBX 解析器/供应资产/设备渲染，仍未验收 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C12 | 认证/语音/生成供应沙箱验证 | NV-11/12/Q-04/06/15；前置 A08/A09：FS | 已补本地供应沙箱矩阵与 11 个场景检查：凭证门控、流式取消、ASR 无结果、TTS 超时、活体/无 SIM 失败、生成质量/取消、限流与供应不可用；14 项 Vitest 断言通过。真实凭证缺失，报告仍为 `blocked / preparatory_not_accepted`，不伪称真实认证、语音或生成通过 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C13 | 儿童指向/生成资产质量规则 | NV-09/10/PET；前置 B08：SS，C05/C06：SS | 已补共享可动 2D manifest 结构、预算、图层、路径、动作关键帧和人工复核门控；6 项规则测试通过。真实生成样本、视觉/儿童可理解性验收及设备路径未完成 | 尚无本轮正式验收结论；既有外部/真实验证限制见本行工程记录，不作为本地编码前置。 |
| C14 | 契约自动核对与技术冻结 | 同步/ACC/HELP；前置 A02：FS，C12：SS | 已有 c14-handoff-results.json：status=frozen（自动技术冻结）、development=DEV_READY_WITH_EXTERNAL_PENDING。早期交接草案与 9 项源契约审查仍是历史局部证据，不冒充 A02 独立真实冻结。 | release=EXTERNAL_PENDING；自动技术冻结不是独立人员评审或真实后端交付。 |
| C15 | 自动验证与外部实测分层复核 | NV-01～12；前置 A04：FS，C01～C12：SS/FF | 已有 NV-01～NV-12 准入审计与统一记录字段；旧报告逐项 blocked 只描述真实实测缺口。V1.2 的本地检查与外部验证分层，当前旧报告的双状态迁移/刷新由主线程处理。 | NV-01～12 真实设备/供应与独立实测未验收；不能用审计命令通过代替 NV 通过。 |
| C16 | Top20默认流程与授权/试点工程方案 | Q-02/05/10/11/14；前置 A09：FS | 已有 5 项 Q 审计；当前旧证据仍为 20 个空白槽位、unconfirmed。V1.2 应自主形成默认方案与 20 项安全候选，本轮未据旧报告认定此项已完成，不向用户索要清单/签字。 | 真实 decisionReady=false / top20Approved=false / pilotEligible=false；默认候选不是正式批准或真人试点。 |
| C17 | 平台装配与模式隔离自动核验 | 本地数据/IN/GUIDE；前置 B01：FS，C01/C02：SS | 已有组合根、IndexedDB、Android Room/活动桥与桌面仓储/通知受限装配证据；当前 c17-assembly-results.json 为 ready_for_development、DEV_READY_WITH_EXTERNAL_PENDING。早期静态/合成检查不冒充实机结果。 | release=EXTERNAL_PENDING；真实 WebView、系统权限、迁移/投递和生命周期未验证。 |

## 阶段 D：自动开发门禁与工程交接

| WBS | 工作包 | V1.2 需求与输入依赖 | development / 本地工程记录 | verification / 外部与正式状态 |
| --- | --- | --- | --- | --- |
| D01 | 自动前端/原生工程证据复核 | 全基线/AT前端层/NV开发证据；前置 B07/B10/C14/C15/C16/C17的development结果：FS | 已有 D 开发汇总 eligible=true；自动技术复核与真人演示/读屏分开，按实际证据保持范围。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |
| D02 | 契约自动冻结与后端交接 | 全基线/AT前端层/NV开发证据；前置 B07/B10/C14/C15/C16/C17的development结果：FS | C14 自动技术冻结已有证据；本地后端编码不等待真实 HTTP/SSE/WS 或独立人员签名。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |
| D03 | 前端候选包与重置自动检查 | 全基线/AT前端层/NV开发证据；前置 B07/B10/C14/C15/C16/C17的development结果：FS | 已有候选包、固定场景及重置材料；本轮本地启动检查中，实际结果待主线程补录。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |
| D04 | Android工程证据与外部项汇总 | 全基线/AT前端层/NV开发证据；前置 B07/B10/C14/C15/C16/C17的development结果：FS | 已有 Room、迁移入口、JVM/APK 等局部证据；可继续 Android 工程，不宣称真机已测。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |
| D05 | Windows工程证据与外部项汇总 | 全基线/AT前端层/NV开发证据；前置 B07/B10/C14/C15/C16/C17的development结果：FS | 已有 Electron、ASAR、几何预检与局部桌面证据；本轮不把它们升级为真实多屏/采集结果。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |
| D06 | 媒体/供应适配工程结论 | 全基线/AT前端层/NV开发证据；前置 B07/B10/C14/C15/C16/C17的development结果：FS | 已有适配器/合成供应及受控媒体证据；继续本地契约和关闭/拒绝路径验证。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |
| D07 | 自动开发门禁与E阶段放行 | 开发/发布双门禁；前置 D01～D06/D08的development报告：FS | 已有 d07-decision/v2、decisionMode=development、decision=go；DEV_READY_WITH_EXTERNAL_PENDING。按真实本地错误与外部待项分开处理。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |
| D08 | 交互与无障碍自动技术复核 | 全基线/AT前端层/NV开发证据；前置 B07/B10/C14/C15/C16/C17的development结果：FS | 已有布局/键盘/焦点/字幕等自动证据；不要求真人读屏或人工签收才能继续本地代码。 | external_pending；正式 blocked / preparatory_not_accepted，真实设备/供应/体验等不得伪造。 |

## 阶段 E：业务代码、本地服务与接口实现

| WBS | 工作包 | V1.2 需求与输入依赖 | development / 本地工程记录 | verification / 外部与正式状态 |
| --- | --- | --- | --- | --- |
| E01 | 身份、设备与辅助开通 | ACC-01/NV-12；前置 D07：FS | implemented（仅入口存在）；代码 `apps/server/src/auth.ts`，测试 `tests/server/auth.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E02 | 关系、同意与协助信令 | ACC-02/HELP；前置 E01：FS | implemented（仅入口存在）；代码 `apps/server/src/family.ts`，测试 `tests/server/family.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E03 | 笔记、复习与待办服务 | NOTE/TODO；前置 E01：FS | implemented（仅入口存在）；代码 `packages/sync-engine/src/services.ts`，测试 `tests/sync/sync-engine.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E04 | 增量同步与冲突 | AT-21/同步；前置 E03：SS，E01：FS | implemented（仅入口存在）；代码 `packages/sync-engine/src/services.ts`，测试 `tests/sync/sync-engine.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E05 | 提醒调度与推送补偿 | TODO-03/SYS；前置 E03：FS，E04：SS | implemented（仅入口存在）；代码 `packages/sync-engine/src/services.ts`，测试 `tests/sync/sync-engine.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E06 | 资产任务与签名流程发布 | PET/FLOW；前置 E02/E03：FS | implemented（仅入口存在）；代码 `packages/asset-service/src/index.ts`，测试 `tests/assets/asset-service.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E07 | 服务骨架、迁移与任务设施 | 后端/运维；前置 D02/D07：FS | implemented（仅入口存在）；代码 `apps/server/src/http.ts`，测试 `tests/server/http.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E08 | 真实多模态、ASR/TTS编排 | IN/CHAT/SUB；前置 D06/D07：FS | implemented（仅入口存在）；代码 `packages/provider-sandbox/src/index.ts`，测试 `tests/provider/e08-e12.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E09 | 真实手绘与偏好生成 | PET-01/02；前置 E08：FS，C13：FS | implemented（仅入口存在）；代码 `packages/asset-service/src/index.ts`，测试 `tests/assets/asset-service.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E10 | 亲情受控媒体生产适配 | HELP/NV-07；前置 E02：FS，E09：SS | implemented（仅入口存在）；代码 `packages/media-session/src/index.ts`，测试 `tests/media-session/media-session.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E11 | 本地检测模型与策略固化 | SAFE/NV-06；前置 C03/D06：FS | implemented（仅入口存在）；代码 `packages/provider-sandbox/src/index.ts`，测试 `tests/provider/e08-e12.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E12 | 供应配额、成本与故障隔离 | Q-15/成本；前置 E08：FS，E10：SS | implemented（仅入口存在）；代码 `packages/provider-sandbox/src/index.ts`，测试 `tests/provider/e08-e12.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E13 | Mock逐项替换与接口装配 | IN/CHAT/NOTE/TODO/ACC；前置 D03/D07：FS | implemented（仅入口存在）；代码 `packages/api-client/src/remote.ts`，测试 `tests/contract/remote-api-client.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E14 | 真实同步/提醒/亲情视图 | NOTE/TODO/ACC/同步；前置 E13：FS，E02/E03/E04：SS | implemented（仅入口存在）；代码 `packages/api-client/src/index.ts`，测试 `tests/contract/remote-api-client.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E15 | 生成、协助与浮层业务整合 | PET/HELP/GUIDE；前置 E13：FS，E09/E10：SS | implemented（仅入口存在）；代码 `packages/api-client/src/index.ts`，测试 `tests/contract/remote-api-client.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E16 | 真实接口兼容回归 | 契约/AT前端层；前置 E14：FS，E15：FF | implemented（仅入口存在）；代码 `packages/contracts/src/validation.ts`，测试 `tests/contract/schema.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E17 | Android原生生产化 | IN/GUIDE/SAFE/SYS；前置 D04/D07：FS | implemented（仅入口存在）；代码 `apps/android/app/src/main/AndroidManifest.xml`，测试 `tests/native/android-lab.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E18 | Android流程/认证/资产适配 | FLOW/ACC/PET；前置 E17：SS，C16：FS | implemented（仅入口存在）；代码 `apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt`，测试 `tests/native/android-lab.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E19 | Windows原生生产化 | IN/GUIDE/SAFE/SYS；前置 D05/D07：FS | implemented（仅入口存在）；代码 `apps/desktop/native-runtime.cjs`，测试 `tests/platform/desktop-native-runtime.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E20 | Windows流程/3D/认证适配 | FLOW/PET-03/ACC；前置 E19：SS，C11/C16：FS | implemented（仅入口存在）；代码 `apps/desktop/native-runtime.cjs`，测试 `tests/platform/desktop-native-runtime.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E21 | 真实资源与无障碍修订 | PET/SUB/无障碍；前置 D08：FS，E09：SS | implemented（仅入口存在）；代码 `packages/accessibility-assets/src/index.ts`，测试 `tests/accessibility/e21.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E22 | 后端/契约/模块增量测试 | AT全项准备；前置 D01：FS，E01～E20：SS/FF | implemented（仅入口存在）；代码 `packages/quality-gates/src/index.ts`，测试 `tests/quality/e22-e23.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E23 | 安全、模型文件与日志审计 | SAFE/AT-10～12/23；前置 E22：SS | implemented（仅入口存在）；代码 `packages/quality-gates/src/index.ts`，测试 `tests/quality/e22-e23.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E24 | 自主流程内容、指标与培训工程准备 | FLOW/公益/指标；前置 C16/D07：FS | implemented（仅入口存在）；代码 `packages/flow-library/src/index.ts`，测试 `tests/flows/e24-e26.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E25 | 供应、授权与发布前提自动核对 | Q-04/05/10/14/15；前置 E24：SS | implemented（仅入口存在）；代码 `packages/flow-library/src/index.ts`，测试 `tests/flows/e24-e26.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |
| E26 | 流程库解释与配置更新 | FLOW；前置 D03：FS，E24：SS | implemented（仅入口存在）；代码 `packages/flow-library/src/index.ts`，测试 `tests/flows/e24-e26.test.ts`。 | external_pending；正式 blocked / preparatory_not_accepted / execution_started=false，不表示本地未编码。 |

## 阶段 F：本地检查与真实验证分离

| WBS | 工作包 | V1.2 需求与输入依赖 | development / 本地工程记录 | verification / 外部与正式状态 |
| --- | --- | --- | --- | --- |
| F01 | 共享前端真实双端联调 | AT-01～24/三场景；前置 E16/E22/E25：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F02 | Android真实双端联调 | AT-01～24/三场景；前置 E16/E22/E25：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F03 | Windows/图形真实双端联调 | AT-01～24/三场景；前置 E16/E22/E25：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F04 | 后端/运维真实双端联调 | AT-01～24/三场景；前置 E16/E22/E25：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F05 | AI/媒体真实双端联调 | AT-01～24/三场景；前置 E16/E22/E25：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F06 | 测试/安全复核真实双端联调 | AT-01～24/三场景；前置 E16/E22/E25：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F07 | 隐私/性能/长时/恢复测试 | AT-07/10～12/17/21～23；前置 F06：SS，F01～F05：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F08 | 自动回归与工程候选验收 | AT-01～24；前置 F07：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F09 | 试点工作流自动验证与真实观察状态 | AT-24/无障碍；前置 F08：SS/FF | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F10 | 培训/反馈流程与材料自动交付 | 公益/亲情/培训；前置 E24：FS，F08：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F11 | 自动工程验收与交付 | 全基线工程交付；前置 F08/F09/F24的development结果：FS或FF | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F12 | 培训材料与试点体验修订 | 无障碍/交付；前置 E21：FS，F10：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F13 | 答辩素材与演示包整理 | 答辩；前置 F12：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F14 | 共享前端联调/试点缺陷修复 | F01～F09问题单；前置 F01～F06：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F15 | Android联调/试点缺陷修复 | F01～F09问题单；前置 F01～F06：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F16 | Windows/图形联调/试点缺陷修复 | F01～F09问题单；前置 F01～F06：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F17 | 后端/运维联调/试点缺陷修复 | F01～F09问题单；前置 F01～F06：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F18 | AI/媒体联调/试点缺陷修复 | F01～F09问题单；前置 F01～F06：SS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F19 | 部署、备份恢复与发布演练 | 运维/交付；前置 F07：FS，F17：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F20 | Android签名/安装/升级交付 | SYS/交付；前置 F15：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F21 | Windows签名/安装/升级交付 | SYS/交付；前置 F16：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F22 | 代码/契约/客户端交接 | 全客户端；前置 F14：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F23 | 供应/模型/媒体运维交接 | AI/HELP/SAFE；前置 F18：FS | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |
| F24 | 最终自动回归与工程证据审查 | AT-01～24/NV双状态；前置 F09开发结果：FS，F19～F23开发结果：SS/FF | checks_passed（已有本机开发报告）；仅覆盖该项实际执行的开发检查，不是原始工作包全部交付。 | external_pending；formalStatus=blocked、formalAcceptance=preparatory_not_accepted、formalExecutionStarted=false，fStarted=false。 |

## 历史与主线程残留

迁移前账本（2026-10-16）记录 A/B/C 预备工程，E 因旧 D 全局关口未启动、F 等待 E 候选和真实资源；这是当时状态，不改写成当时已完成。旧的人工 Go 才能本地 E/F 编码的规则已由 V1.2 替换，早期命令/测试数字保留为历史局部事实。

本轮未改任务卡、检查单、索引、证据 JSON、脚本或根计划。主线程仍需处理旧卡/生成器的双状态文字、C15/C16 旧证据与默认方案一致性，以及文档变更后的证据哈希/依赖刷新；不能仅凭本表认定 96 项已全部工程交付或正式验收。
