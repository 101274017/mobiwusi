# 实施状态（V1.2）

更新日期：2026-10-17（Asia/Shanghai）。依据实际根计划 `暖伴AI公益助手-项目实施计划-Codex高效续作版(1).md` V1.2，完成用户要求的 F 本地开发级运行、双状态任务卡和证据收尾；根计划及 V1.1 历史基线未改动。计划/示例不是完成事实，历史命令结果不改写。

## 当前阶段与本地运行

| 范围 | development / 当前已有工程事实 | verification / 外部与正式边界 |
| --- | --- | --- |
| A/B/C | 已有前端、契约、共享规则、平台装配和构建/测试；已刷新 C14/C15/C16/C17 证据，C14 为 frozen（自动技术冻结），C17 为 ready_for_development，C16 生成五项开发默认与二十项候选 | 独立真实评审、真机/供应、读屏、用户同意等仍为 external_pending；候选不等于真实适配或同意 |
| D07 | 现有 d07-decision/v2、decisionMode=development、decision=go；DEV_READY_WITH_EXTERNAL_PENDING | release=EXTERNAL_PENDING、release.ready=false，开发 go 不是正式 Go |
| E01～E26 | 只读代码存在性检查确认 26/26 项代码与测试入口存在 | implemented 只表示入口存在，不表示测试已执行、应用已运行或真实供应已接入 |
| F01～F24 | 本轮实际重跑三阶段，退出码均为 0、24/24 项 checks_passed；前置运行器 5/5 作业通过 | formalComplete=false、formalFExecutionStarted=false、fStarted=false；不是全部真实联调、试点、签名和正式交付完成 |
| 本地可运行检查 | 标准 pnpm check（含 typecheck/单测/边界）、build、契约通过；Vitest 880/880；既有 E2E 96/96、终审当前网页双视口冒烟 6/6；实际内存/SQLite 启动、迁移、鉴权与进程重启会话持久化 7/7 | 前端仍为演示模式；移动视口不等于 Android 真机；回环服务不等于生产部署，全部仅合成数据 |

本轮 F 证据时间 `generatedAt=2026-10-17T15:37:07.882Z`；D07 自动开发决定已按刷新后的上游指纹生成。命令和可复现边界见 [RUN](../execution/RUN.md)，完整 F 结果见 `evidence/f-execution-results.json`。正式记录仍为 `status=blocked`、`acceptance=preparatory_not_accepted`、`execution_started=false`、`eStarted=false`、`fStarted=false`，不反推“本地未开发”。F 报告的真实网络、生产数据和真实设备三个开关仍为 false。

## V1.2 续作规则

- 开发依赖按前置任务 `development` 的 FS/SS/FF 解释；`DEV_READY` / `DEV_READY_WITH_EXTERNAL_PENDING` 可以继续本地业务代码、服务、契约和测试，不再等人工 D07 Go。
- 不向用户补要签字、角色、Top20 或人工决策 JSON；开发决定与合理技术默认值由实际证据生成。真实系统权限、用户/监护同意和供应结果不可伪造。
- 真正的编译、契约、隔离、门控/停止或失效证据错误属于 `DEV_BLOCKED`，必须修复；不能把本地失败伪装成外部待项。外部项记 `verification=external_pending`，对应能力关闭，不全局阻止独立开发。
- 默认 `pnpm d07:decision:check` 检查开发模式；正式检查显式 `node scripts/check-d07-decision.mjs --mode release --no-write`，不得把开发退出 0 当生产 ready。
- 本地入口为 `pnpm dev`，可选后端为 `pnpm server:dev`；详细边界见 [RUN](../execution/RUN.md)。本轮检查后 Playwright `:5173` 与后端 `:3017` 已停止；续作先核对实际监听，不重复启停其他进程。

## 历史批次可用变化（迁移前记录）

以下逐项保留原实施事实、命令、测试数字和当时限制；其中旧 D 全局阻断、C14 草案/C17 blocked、未建立后端等描述仅对应当时，不是 V1.2 当前开发规则或当前软件缺失清单。

1. 顶部「开发验收场景」可切换成功、空资料、长等待、超时、断网、权限拒绝、低置信、风险暂停、流中断、版本冲突、部分失败、邀请过期、配额不足 13 场景。固定夹具时钟/初始 ID，场景资料独立；明确确认后只重置当前场景。
2. 讲解校验请求和事件顺序/完成标记；停止隔离迟到事件，失败保留问题与重试入口，不把部分回复保存成学习笔记。密码/交易相关文字先在本机拦截。
3. 绘画新增模拟任务的等待、处理、失败、取消、重排、原画预览与确认；本机持久化，刷新不自动处理。原画不是 AI 可动资产，确认不替换现有桌宠。清画布需要确认。
4. 教学低置信/风险暂停、过期邀请不能接听；保存冲突先保留本机草稿，再逐项比较并明确选择；模态框内错误可读。
5. 内置桌宠支持眼睛/嘴型/颜色/姿态的本机预览，确认后保留上一套设置并可撤回；画稿任务仍明确 `generated:false`。
6. 登录/认领只演示合成挑战、失败、过期、本人/监护确认和无 SIM 替代路径，始终标记 `authenticated:false`，不生成凭证。
7. 完成键盘跳过链接、主内容焦点、最大字号、减少动画、静音、语音不可用降级和模态框焦点回收验证；不是独立人工读屏签收。
8. 工程保留项目内 pnpm hoisted 配置、Android 自动构建脚本、Windows 使用本机已安装运行时的离线打包路径；不改全局工具配置。
9. 补 Kotlin 强类型生成、缺省/显式 null、sealed 分支、约束运行时与离线对照脚本；不支持的关键特性直接使生成失败，不放松校验。
10. Android 本地资源主框架接入现有 capabilities/stop_all 与受限提醒操作：能力保持关闭，超时/错代际/重复/伪造回复不兑现；提醒字段、深链、版本和 payload 严格解析，Room 调用走后台 executor；原生暂停通知停止，未确认原生停止时明确提示。仍不是实际捕获、浮层或系统提醒验收。
11. C01 独立 native-lab 已形成可编译样例：本次手动系统授权、前台服务、可选穿透/停止浮层、有界帧隔离释放、30 秒停止计时、撤销/生命周期清理。正常演示包不增权限，帧不读取/保存/外发；真实设备项仍为待验证。
12. C02 独立 Windows native-lab 已形成可运行验证样例：固定合成窗口、自有来源白名单、无音频、可选透明/穿透窗口、停止代际、生命周期/多显示器事件保守停止，以及 DIP↔物理坐标记录。74 项策略测试、隐藏 Electron 12 项检查和离线未签名包通过；真实桌面媒体、多屏、负坐标、混合 DPI 与穿透仍未验证。
13. C03 补充本地逐帧门控样例：系统授权/用途/会话/目标/代际/时效、检测健康、已验证页面、OCR 完成、置信度、风险文本和第三方人脸脱敏全部进入放行条件；交易/私人/医疗/投资、未知、失败、超时和脱敏失败不签发票据。52 项合成测试通过；真实检测模型、坏模型/质量评测和编码端仍未接入。
14. C04 补充仅内存受控媒体出口：安全票据绑定后进入有界队列，编码器只能接收最小安全元数据，AI/家属出口共享代际和 stop fence；停止、队列满、编码器伪造、出口失败和重启代际均有测试。15 项合成测试通过；真实编码、relay-only WebRTC、抓包/接收 canary 与双出口长时测试仍未接入。
15. C05/C06 补充共享坐标与儿童指向：Android 系统栏/letterbox/旋转、Windows DIP/负原点/缩放、帧/布局/变换失效、过期撤标、儿童安全停靠/遮挡避让和“我点好了”核验边界。9 项合成向量通过；真实设备和原生路径仍未验收，范围证据见 `evidence/guidance-c05-c06-scope.json`。
 16. C07/C08 预备层补充共享提醒引擎和平台能力边界：稳定 `instanceId`、幂等/版本/CAS 风格状态、时区/DST 重复规则、取消、到期提交以及 submitted/delivered/opened/completed 分离；浏览器返回 `page_only`，原生系统能力返回 `unsupported`，但 Windows 显式宿主 `reminderStore` 已接收本地排程、取消和到期请求，不向缺少该接口的宿主猜测写入。8 项共享规则、6 项派发闸门与 6 项平台边界测试通过；Android 已有 Room 2.8.5 schema v3 本地提醒预备仓储和保守通知适配器，`android:room:check` 新增本机 SQLite 1→3 迁移预演和一次性点击令牌边界，`android:room:jvm:check` 的 9 项纯 JVM 状态转换 harness 通过；桌面已有 SQLite v1→v2 迁移、回执时间持久化、`safeStorage` payload 条件加密和显式通知适配器合成测试，但仍没有真实 Room 旧库升级/备份恢复、SQLite 整库加密、真实通知权限、系统调度或真实设备回执。
17. C13 补充可动 2D 资产的共享 manifest 质量门控：仅允许结构完整的 `generated_2d` 资产进入预览，校验单边 2048px、64MiB 解码内存、配色、body/eyes/mouth 图层、受控本地路径、边界和八种动作关键帧；始终 `manualReviewRequired:true`、`publishEligible:false`。6 项规则测试通过；无真实生成样本、视觉/儿童理解评审或供应验收。
18. C07/C08 独立 SQLite 预备实验与桌面仓储：使用 Node `v24.21.0` 的 `node:sqlite.DatabaseSync` 验证 schema 重复打开、账号分区、同版本幂等、旧版本拒绝、同版本冲突、取消后不提交和关闭重开读取，8 项检查通过；新增 `apps/desktop/reminder-store.cjs` 并通过受限 IPC 接入 Electron 主进程，9 项定向测试覆盖 v1→v2 迁移、回执/完成/取消时间、倒退回执拒绝、关闭重开和 `safeStorage` payload 编解码；新增显式调用的 `apps/desktop/notification-adapter.cjs`，5 项合成测试覆盖能力/权限门控、非敏感正文、show/click/failed 回执、深链白名单、幂等和释放。仍未接 SQLite 整库加密、系统调度或真实通知。
19. C11 补充桌面 3D 候选规格和本地预检：GLB/VRM 按容器头和 glTF JSON 识别，FBX 只识别 Binary/ASCII 头并要求隔离解析摘要；检查外链、脚本/执行引用、版本、材质、骨骼、50MiB 文件、2048px 贴图、10万三角面、512MiB 解析峰值、300MiB 解码和异常展开比例。10 项合成测试通过；无真实 Three.js/FBX 解析器、供应资产、设备渲染或视觉验收，证据见 `evidence/c11-3d-results.json`、`evidence/c11-3d-scope.json`。
20. C12 补充认证/语音/生成供应沙箱预备层：六类能力使用合成凭证夹具验证流式成功/取消、ASR 无结果、TTS 超时、活体证明拒绝、无 SIM、生成取消/质量不足、限流和供应不可用；14 项 Vitest 断言、11 个场景检查通过。所有结果禁止网络和原始载荷留存；真实凭证状态为 `missing`，报告保持 `blocked / preparatory_not_accepted`，证据见 `evidence/c12-sandbox-results.json`、`evidence/c12-sandbox-scope.json` 和 `c12-supplier-sandbox.md`。
21. C15 NV 准入审计层：新增 `check-c15-nv-readiness.mjs`，逐项检查 NV-01～NV-12 的证据文件、设备/供应信号、统一记录字段和阻塞原因；3 项审计测试通过，命令报告 `auditPassed:true` 但 `status=blocked`、`goNoGoEligible:false`，不把合成/契约/打包证据升级为真实验收，详见 `evidence/c15-nv-readiness-results.json` 和 `c15-nv-evidence-protocol.md`。
22. C16 决策准入层：新增 `check-c16-decision-readiness.mjs`，审计 Q-02/Q-05/Q-10/Q-11/Q-14 是否存在负责人签收字段，并生成 20 个未确认 Top20 候选槽位；3 项测试通过，但 `decisionState=unconfirmed`、`top20Approved=false`、`pilotEligible=false`，不伪造试点协议或真实家庭/儿童数据流程，详见 `evidence/c16-decision-readiness-results.json` 和 `c16-decision-ledger.md`。
23. C17 共享仓储与桥接装配预备审计：新增 `check-c17-assembly.mjs`，检查组合根、`ownerId` 账号隔离、IndexedDB 事务、Android `appassets` 主框架桥、Electron SQLite 受限 IPC、桌面通知适配器与主进程提醒桥显式能力/权限门控、超时/停止/迟到清理和高风险能力关闭；9 项静态检查与 3 项审计测试通过，但报告仍为 `blocked / preparatory_not_accepted`，不把 Chrome 同源通道、本机 IndexedDB、桌面仓储或注入通知对象当作真实 WebView、Room、安装包迁移、系统 Toast 或设备验收，详见 `evidence/c17-assembly-results.json` 和 `c17-assembly.md`。
 24. FE-13 前端验收交接包预检：新增 `check-acceptance-bundle.mjs` 与 `pnpm acceptance:check`，8 项检查确认文档/证据、当前 43 个文件/668 项单元、本轮 96 项双视口 E2E、Room/桌面提醒限制、C17 与 D 阻塞状态、桌面 ASAR 文件和重现命令齐全；报告为 `preparatory_ready`，但仍保持 `preparatory_not_accepted`、`goNoGoEligible:false`，不替代 B07/B11 人工签收或 D 关口。
25. C07/C08 继续接线：新增共享 `ReminderRuntime`，把待办新增/修改/完成/删除纳入稳定实例、版本替换、取消、到期单次触发和停止不恢复流程；移除 `App` 中分散的提醒定时器/通知代码，旧实例取消失败时阻断新版本排程，浏览器仍返回 `page_only`，原生未验证能力仍返回 `unsupported`。4 项运行时测试通过；详见 `docs/implementation/c07-c08-runtime.md` 和 `evidence/reminder-runtime-results.json`。

## 历史验证结果（原命令与数字保留）

- 类型/依赖边界检查通过；43 个 Vitest 文件共 **668 项通过**，6 个 JSON Schema 和 118 个服务定义通过生成/编译校验，生成文件无漂移。
- Kotlin JVM/Ajv 对照 **7,631 项通过**，含 1,247 个有效往返、6,384 个拒绝用例；另有 28 个活动桥对照与 3 个类型边界检查，源哈希已保存。
- 本轮桌面与移动 Chrome 视口全量 **96 项 E2E 通过**，0 失败、0 flaky、0 跳过；包含无人接听后重复发起回归，不是 Android 真机或人工体验签收。失败根因是 HashRouter 将顶层 `?assist=unanswered` 留在浏览器 location search，而路由 `useSearchParams` 只读取 hash 路由 search；夹具现从两处一致解析并有双视口回归覆盖。
- 已新增 D01～D08 关口预备审计：`pnpm d:gate:check` 可重放检查交接包、C14/C15/C16/C17 和人工签收前置，当前报告明确为 `blocked`、`goNoGoEligible:false`、`eStarted:false`、`fStarted:false`；不把 D 预备审计当作批准。
- `pnpm build` 通过；当前静态构建 4 场景各做双视口检查，共 8 组截图，0 页面错误、无水平溢出；另有 2 组 appassets 同源 Android 消息通道模拟，非真实 WebView。
- Android Debug APK 与 Windows x64 开发目录包已重建，大小/哈希见 evidence/artifacts.json；两包各 6 个 UI 文件与当前 Web 构建一致，APK DEX 含生成 DTO/验证器/活动桥，Windows ASAR 不含开发 node_modules。
- 新增独立 C01 Debug APK；35 项真实 Kotlin JVM 状态机检查及 Android Lint 通过，APK 清单无网络/相机/麦克风权限。源码/包哈希与静态检查见 evidence/android-lab.json；没有连接设备，未安装或启动采集。本轮没有改变 Web 或正常 Android 的运行源码；C02 另有独立 Windows 样例，但不把它算作正常宿主已开启或新原生模块的设备证明。
- 新增独立 C02 Windows 样例；74 项策略/坐标/边界测试，隐藏 Electron 检查 12 项，控制页与合成窗口截图，以及离线未签名 Windows x64 包的 ASAR 源哈希比较通过。自动检查真实桌面媒体请求为 0，当前仅一台显示器；不把合成 canvas 轨道、单屏坐标往返或窗口配置当作 NV-03 通过。
- 新增 C03 本地逐帧门控；52 项合成测试覆盖风险优先级、未知/失败/超时/低置信、第三方人脸脱敏失败、票据绑定/过期/篡改和停止代际；结果见 evidence/privacy-c03-results.json。没有真实 OCR/人脸/检测模型或编码发送证据，不把策略通过当作 NV-06 通过。
- 新增 C04 受控媒体出口；15 项合成测试覆盖安全票据、有界队列、编码器输入最小化、AI/家属共用门控、停止竞态、伪造 artifact、出口/编码失败和新代际。结果见 evidence/media-c04-results.json；没有真实编码器、WebRTC、网络或接收端证据，不把 relay 测试当作 NV-07 通过。
- 新增 C05/C06 坐标与儿童指向共享层；9 项合成测试覆盖 Android 状态栏/导航栏/letterbox/旋转、Windows DIP/负显示器原点、窗口/DPI 失配撤标、儿童安全停靠/遮挡避让以及无输入注入边界。结果见 evidence/guidance-c05-c06-results.json 和 evidence/guidance-c05-c06-scope.json；没有设备、多屏、原生浮层、穿透或人工点击证据，不把它们当作 NV-08/NV-09 通过。
- 新增 C07/C08 共享提醒预备层和 `ReminderDispatchGate`；8 项提醒规则、6 项能力/权限/撤权代际/停止派发测试与 6 项平台边界测试通过，覆盖稳定实例、幂等排程、旧版本拒绝、内部深链/时间/时区校验、DST、取消、到期提交、submitted/delivered/opened/completed 分离、系统能力拒绝和调度器失败阻断；另有共享 `ReminderRuntime` 4 项测试，显式宿主 `reminderStore` 排程/取消/到期接线测试、Android `ReminderPolicy` 10 项权限/能力矩阵场景、v4 IndexedDB 提醒仓储 4 项测试、独立 Node 24 SQLite 预备实验 8 项检查、Electron 桌面仓储 10 项测试、桌面通知适配器 5 项测试和主进程提醒桥 5 项测试通过，其中 Android Room/通知预备检查现为 8 项，另有 9 项纯 JVM 状态转换 harness 通过；Room schema v3 的本机 SQLite 1→3 旧版表迁移预演、一次性点击令牌、到期提交补偿、通知 `delivered`/点击 `opened` 回执接线和 Activity 销毁顺序检查均已保留；新增桌面 v1→v2 迁移、回执时间持久化/倒退保护、`safeStorage` payload 编解码与不可用回退边界、通知能力/权限门控、非敏感正文和 show/click/failed 回执。结果见 `evidence/android-lab-jvm.json`、`evidence/android-room-results.json`、`evidence/android-room-jvm-results.json`、`evidence/reminder-c07-c08-results.json`、`evidence/reminder-c07-c08-scope.json`、`docs/implementation/c07-c08-android-policy.md`、`docs/implementation/c07-c08-dispatch.md`、`evidence/localdata-c07-c08-results.json`、`evidence/sqlite-c07-c08-results.json`、`evidence/desktop-reminder-store-results.json`、`evidence/desktop-notification-adapter-results.json` 和 `docs/implementation/c07-c08-desktop-store.md`；没有真实 Room 设备迁移、SQLite 整库加密、Windows 系统通知、后台调度、应用退出/睡眠/重启或真实“看到”回执，不把它们当作 C07/C08/NV-02 通过。
- 新增 C13 可动 2D 资产质量预备层；6 项测试覆盖生成身份、单边 2048px、64MiB 解码内存、配色、body/eyes/mouth 图层、受控本地路径、边界、八种动作关键帧和畸形输入；结构完整资产只允许预览，始终需要人工复核且不可发布。结果见 evidence/pet-c13-results.json 和 evidence/pet-c13-scope.json；没有真实生成样本、视觉/儿童理解评审、动画自然度或供应验收，不把它们当作 AT-03/AT-08/NV-09/NV-10 通过。
- 新增 C11 3D 本地资源预检；10 项测试覆盖 GLB/VRM 容器识别、FBX 隔离摘要要求、格式声明冲突、坏文件、未知扩展、外链/脚本、未知贴图尺寸、版本/材质/骨骼、50MiB/2048px/10万面/512MiB/300MiB/展开比例预算和 2D 回退；结果见 evidence/c11-3d-results.json、c11-3d-scope.json 和 c11-3d-spec.md；没有 Three.js/three-vrm/FBXLoader、真实解析器、供应资产、设备帧率/内存或视觉验收，不把它们当作 PET-03/NV-10 通过。
- 新增 C12 认证/语音/生成供应沙箱预备层；14 项测试覆盖六类供应矩阵、合成凭证门控、流式顺序/取消、ASR 无结果、TTS 超时、活体/无 SIM 失败、生成取消/质量阈值、限流与供应不可用；结果见 evidence/c12-sandbox-results.json、c12-sandbox-scope.json 和 c12-supplier-sandbox.md。真实凭证、区域、价格/配额、数据保留、合同条款、音频/活体/生成质量均未验证，不把合成通过当作 NV-11/NV-12、E01/E08/E09 或 D 通过。
- 新增 C15 NV 实测准入审计；12 项 NV 检查逐项读取已有证据的设备/供应信号，统一输出 `blocked`、阻塞原因和真实记录字段；审计命令本身通过，但没有设备、供应凭证或独立复核，不能作为 NV 或 D 通过证据。结果见 evidence/c15-nv-readiness-results.json、c15-nv-readiness.txt 和 c15-nv-evidence-protocol.md。
- 新增 C16 决策准入审计；5 项 Q 决策检查和 20 个空白候选槽位均保持 `unconfirmed`，审计命令本身通过但 `decisionReady=false`、`top20Approved=false`、`pilotEligible=false`；没有负责人签收、试点合作或设备/同意矩阵，不能作为 C16/M07 通过证据。结果见 evidence/c16-decision-readiness-results.json 和 c16-decision-ledger.md。
- 新增 C09/C10 生命周期清理预备层；最新定向回归 25 项测试通过，覆盖 Android 权限撤回/锁屏/销毁事件、Windows 窗口移动/递归捕获预留/退出与渲染器退出、停止顺序、事件解绑、并发幂等、资源端口绑定、旧代际拒绝、浮层隐藏、清理失败阻断重启、不自动恢复，以及原生宿主未明确确认捕获和媒体均已停止时的失败路径。结果见 evidence/lifecycle-c09-c10-results.json、evidence/lifecycle-c09-c10-scope.json 和 c09-c10-lifecycle.md；没有设备锁屏/撤权/进程终止/真实桌面捕获或系统资源释放证据，不把它们当作 NV-04/NV-05 通过。
 - 新增 C14 后端契约交接预备层；9 项源契约审查覆盖 `0.2.0`/60 操作/118 定义、授权、幂等/版本、错误包络、媒体同意、协助租约、流终止和 D 前置标记。结果见 evidence/c14-handoff-results.json 和 c14-backend-handoff.md；A02 冻结、C12 供应结论、真实 HTTP/SSE/WS 和 D 交接评审仍未完成。
 - FE-13 验收交接包现纳入 D01～D08 预备审计；8 项 FE-13 检查通过仅表示文档、自动化证据和构建产物可复现，D 报告仍为 `blocked`、`preparatory_not_accepted`，`goNoGoEligible=false`、`eAfterDEligible=false`、`eStarted=false`、`fStarted=false`，不启动 E/F。

具体路径、哈希、命令与限制见 [验证记录](verification.md) 和 evidence/artifacts.json。

## 续作断点

本次“解决 D07 相关问题并检查本项目是否可以运行”逐项审计见 `d07-runtime-audit.md`：可用本地范围已验证，正式发布仍独立保留外部待项；C15 开发状态和 C17 安全源码时效检查已补齐。

1. 本轮 F 自动开发验证已完成；后续只在输入变化或实际修复后重验，不为缺人工材料重复停工。
2. 运行结果、重跑命令和已停止的服务见 RUN；以实际证据为准，不将入口存在写成正式验证。
3. E/F 50 张卡已刷新并保留旧版备份，开发依赖满足而正式字段不变；不要让旧卡片的人工 Go 规则重新卡住编码。
4. 外部设备、供应、真实同意/试点等 13 项集中记录在 `external-capabilities.md`，维持关闭和拒绝路径；正式 release.ready=false，不要求用户补表后才结束本地工作。

完整 [96 项 WBS](wbs.md)、[需求/决策基线](baseline.md)、[AT/NV 追踪](acceptance.md) 保留未完成项。计划周窗不是已执行日历承诺，不声称完成 24 周项目或所有 F 交付。
