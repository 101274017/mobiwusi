# 微光指引 · AI 公益助手

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

## 文档导航

[完整 Markdown 文档索引](docs/README.md)覆盖现行需求、实现、模块说明、任务卡和历史记录；当前功能事实以[产品与功能状态](docs/implementation/product-current-state.md)及对应功能的带日期记录为准。

[品牌与 Logo 资源](design/brand/README.md)说明当前“鹿角光标”及各平台图标的来源与使用位置；品牌标志和默认桌宠角色分别管理。

**微光指引**（原产品名“暖伴”）是面向老年人、儿童及其他数字弱势群体的公益助手。工程由共享 React 前端、TypeScript 服务端及 Windows/Android 宿主构成。当前形态以根目录三份“独立桌宠”需求与技术文档为准；较早的 V1.2 工作包和开发/发布双门禁作为工程历史保留。

截至 2026-10-22，Windows 默认启动驻留桌宠，点击打开桌宠功能页、右键查看独立功能清单，管理客户端按需打开。桌面教学可使用获本人授权的本地观察与按需脱敏分析；另有需本人检查预览并确认发送的单帧图像指引入口。目标软件始终由用户亲手操作。启动时屏幕、麦克风和云分析均关闭。当前功能范围、各端差异及真实验收边界见 [`docs/implementation/product-current-state.md`](docs/implementation/product-current-state.md)。

手机浏览器或未装配桌面原生桥的 WebView 也能使用“打开桌宠”、栗栗、露米和本机原画入口：确认后会在当前页面显示“页面陪伴伙伴”，不再把按钮置灰或伪装成系统悬浮窗。页面陪伴只存在于当前网页，不会替换手机系统桌宠，也不会自动开启屏幕、麦克风或上传资源；需要真正悬浮在 Windows 桌面上的系统桌宠时，仍请使用微光指引桌面客户端。

当前仓库包含桌宠功能页、问答、学习资料与待办、本地形象和受控屏幕指引实现，以及 Android 宿主、服务端 API 和多个领域/平台模块。桌面文字与图片请求可使用本人本机配置的真实模型网关；账号/家属服务、云端同步和正式生产部署不可仅依据 API 骨架或测试视为可用。详细状态与限制见 [`docs/implementation/product-current-state.md`](docs/implementation/product-current-state.md) 和 `docs/implementation/real-ai-provider.md`。

屏幕采集、麦克风和云分析默认关闭，互不代替授权；未知、敏感或检测失败按关闭优先处理。模型只可提供解释和只读指引，不会移动系统光标、自动点击/输入、启动第三方软件，或处理真实密码、支付与验证码。未接通服务不得以模拟结果冒充。C01/C02 原生隔离验证工具须显式构建和本人授权，不会自动安装或启动。旧包名、协议、启动脚本及唤醒词保留作兼容，不代表用户可见产品仍沿用旧名称。

## 本地运行

在本目录双击 `启动暖伴.bat`，或执行 `pnpm dev`；浏览器打开终端给出的本机地址。依赖尚未安装时先执行 `pnpm install --frozen-lockfile`。Node/pnpm 版本以 package.json 为准。

前端默认地址为 `http://127.0.0.1:5173`。另一个终端执行 `pnpm server:dev`，后端默认在 `http://127.0.0.1:3000` 使用内存仓储，健康检查路径为 `/healthz`；未认证的 `/v1/relations` 应返回 401。启动前检查已有监听，不重复占用端口；只使用本地合成数据。

## 开发与发布门禁

- `pnpm d07:decision:check` 根据实际 C14/C15/C16/C17、验收包和来源指纹计算并生成自动开发决定；无需人工填写决定、签字、Top20 清单或 `--bypass-d07`。
- `DEV_READY` / `DEV_READY_WITH_EXTERNAL_PENDING` 允许依赖满足的本地实现与自动测试；失效证据、实际编译/契约/安全失败仍须修复。
- `pnpm d07:release:check` 与 `pnpm release:readiness:check --mode release --no-write` 独立检查正式发布；缺外部条件时 `release.ready=false`，预期退出 1，不把开发 go 当正式批准。
- `docs/implementation/external-capabilities.md` 集中记录外部缺项、关闭策略与验证入口；最新运行结果和续作断点见 `docs/execution/RUN.md`。

## 历史实现记录

以下保留各批次的实施范围和当时的验证数字，不作为当前执行状态或人工批准前置；C14/C16/C17 的最新结果以自动证据与 RUN 为准：

- 顶部「开发验收场景」可切换 13 个固定异常/正常场景。场景资料隔离，重置只作用于当前场景。
- 流式讲解检查请求、事件序号及完成标记；超时/中断保留输入，不生成不完整笔记。敏感文字本机拦截，不发送给服务。
- 「我的小伙伴 → 画一画 → 演示生成任务流程」支持模拟成功、失败、取消、重新排队、预览确认和刷新恢复。仅预览原画，明确不产出 AI 可动资产。
- 「我的小伙伴」支持内置 SVG 五官、颜色和姿态微调；先预览，确认应用后可撤回上一套配置，不冒充画稿生成结果。
- 资料版本冲突先保留草稿，逐项比较本机/另一份模拟版本，明确选择才提交；刷新不丢草稿，清空资料也清掉草稿。
- 模式选择页可进入五条登录/认领模拟路径，含儿童监护确认；始终不是实际登录，不采集真实身份。
- 低置信/风险教学暂停；演示邀请过期不能接听；修复键盘跳过导航与焦点返回，补字号/语音降级回归。
- 服务契约 0.2.0 草案含 60 操作、118 定义，Schema/OpenAPI/TS/Kotlin 同源生成；7,631 个 JVM/Ajv 对照通过，使用方法与待评审边界见 `packages/contracts/README.md`。
- Android 本地 HTTPS 主框架已装配能力查询、停止和受限提醒排程/取消/到期请求消息桥，含严格字段、代际、超时、错误与清理；高风险能力仍关闭，未做真实 WebView/真机验收。
- 按 C01 新增独立 Android 原生样例：本次授权、前台服务、可选浮层、停止清理与有界帧隔离计数；无像素读取/保存/网络出口。35 项 JVM 状态机测试与开发包编译通过，真机状态仍未验证，见 `apps/android/native-lab/README.md`。
- 按 C02 新增独立 Windows 原生样例：固定合成窗口、严格捕获来源、可选透明浮层、DIP/物理坐标记录、停止代际和离线未签名包。74 项策略测试与隐藏 Electron 检查通过；未请求真实桌面媒体，真实多屏/穿透仍未验证，见 `apps/desktop/native-lab/README.md`。
- 按 C03 补充本地逐帧安全门控：未知页面、检测/ OCR 失败或超时、低置信度、交易/私人/医疗/投资风险、第三方人脸脱敏失败均暂停或拒绝；允许帧才签发短时代际票据。52 项合成门控测试通过，不包含真实 OCR/人脸模型或媒体发送，见 `packages/privacy/README.md`。
- 按 C04 补充仅内存的受控媒体出口样例：安全票据进入有界队列后才允许编码元数据，并以同一 stop fence 保护 AI/家属两个本地接收出口。15 项竞态/队列/伪造测试通过，不接 WebRTC、网络或真实编码器，见 `packages/media-relay/README.md`。
- 按 C05/C06 补充共享坐标与儿童指向引擎：Android 系统栏/letterbox/旋转、Windows DIP/负显示器原点/混合缩放、过期撤标、遮挡避让和“我点好了”仅触发核验。9 项合成向量通过；没有真机、多屏、原生浮层、穿透或人工点击证据，见 `docs/implementation/evidence/guidance-c05-c06-scope.json`。
- 按 C07/C08 补充共享提醒预备层与 `ReminderDispatchGate`：严格校验内部深链、时区和排程版本，稳定生成提醒实例，区分发出/投递/看到/完成，并在能力/权限/撤权/停止代际前拒绝系统排程。20 项规则/派发/平台边界测试通过；Android 正常 app 已继续接入 Room 2.8.5 schema v3 本地提醒仓储和保守通知适配器，另有 9 项纯 JVM 状态转换 harness 通过，但尚未完成设备/权限/系统投递验收，见 `docs/implementation/c07-c08-dispatch.md`、`docs/implementation/c07-c08-android-room.md` 和 `packages/reminder-engine/README.md`。
- 按 C07 增加 Android `ReminderPolicy` 权限/调度能力预备矩阵：覆盖 Android 版本、通知权限、通知渠道、精确闹钟、后台调度和页面级回退；10 项 Kotlin JVM 场景通过，但不调用真实系统 API，`deviceVerified=false`、`systemSchedulerVerified=false`，见 `docs/implementation/c07-c08-android-policy.md`。
- Android 正常 app 的提醒点击已增加 Room 3 版一次性随机令牌：只有账号、实例、深链、令牌和 `delivered` 状态全部匹配才记录一次 `opened` 并路由，重复或外部伪造 Intent 被拒绝；这仍是源码/编译预备证据，不替代真实设备点击验收，见 `docs/implementation/c07-c08-android-room.md`。
- 按 C07/C08 增加独立 Node 24 SQLite 预备实验，并将桌面 SQLite 仓储接入 Electron 主进程受限 IPC 和共享宿主端口：独立实验 8 项检查、桌面仓储 10 项测试通过，覆盖 v1→v2 迁移、账号隔离、幂等/版本冲突、取消、到期提交、回执/完成时间、倒退回执拒绝和关闭重开读取，以及 `safeStorage` 可用时仅加密提醒 payload；另有桌面通知适配器 5 项测试和主进程提醒桥 5 项测试，覆盖能力/权限门控、到期/未到期/取消、show/click/failed 回执、内部深链和无敏感正文。主进程权限保持 `unknown`，仍未接整库加密、系统调度或真实通知，见 `apps/desktop/native-lab/README-c07-c08-sqlite.md` 和 `docs/implementation/c07-c08-desktop-store.md`。
- 按 C09/C10 补充共享生命周期清理协调器与宿主事件装配：Android `onPause`/`onDestroy`、Electron 退出/渲染器退出/窗口移动通知、代际与队列清理、并发停止和失败阻断；原生宿主未明确确认捕获和媒体均已停止时会进入失败路径。最新定向回归 25 项合成测试通过，不代表设备生命周期验收，见 `docs/implementation/c09-c10-lifecycle.md` 和 `packages/platform-ports/README.md`。
- 按 C14 补充后端交接准备：自动审查 0.2.0 契约的 60 个操作、118 个定义、对象授权、幂等/版本、错误包络、媒体同意、协助租约和 D 前置标记，并生成交接草案；9 项检查通过，但不接真实后端或供应，见 `docs/implementation/c14-backend-handoff.md`。
- 按 C13 补充可动 2D 资产质量预备层：校验 `generated_2d` manifest、单边 2048px、64MiB 解码内存、配色、body/eyes/mouth 图层、受控本地路径和八种动作关键帧；结构完整资产只允许预览，始终要求人工复核且不可发布。6 项规则测试通过，不等于真实 AI 生成或视觉/儿童理解验收，见 `packages/pet-engine/README.md`。
- 按 C11 补充桌面 3D 本地资源预检：从容器识别 VRM/GLB，识别 FBX Binary/ASCII 头并要求隔离解析摘要；校验版本、外链/脚本、材质、骨骼、未知贴图尺寸、50MiB 文件、2048px 贴图、10万三角面、512MiB 解析峰值、300MiB 解码和异常展开比例，失败回退 2D。10 项合成测试通过；无 Three.js/真实 FBX 解析器/供应资产/设备渲染验收，见 `docs/implementation/c11-3d-spec.md`。
- 按 C12 补充认证/语音/生成供应沙箱预备层：六类供应能力使用合成凭证夹具验证流式成功/取消、ASR 无结果、TTS 超时、活体/无 SIM 失败、生成取消/质量不足、限流与供应不可用。14 项测试通过；真实凭证缺失，报告保持 `blocked / preparatory_not_accepted`，不访问网络、不保留原始载荷，见 `docs/implementation/c12-supplier-sandbox.md`。
- 按 C15 补充 NV-01～NV-12 证据准入审计：逐项检查设备/供应证据文件、真实信号、统一记录字段和阻塞原因。审计器与 3 项测试通过，但当前 12 项 NV 全部 `blocked`，不把合成、契约、打包或单屏记录当作真实验收，见 `docs/implementation/c15-nv-evidence-protocol.md`。
- 按 C16 补充 Top20/监护/留存/掌握/亲情范围决策台账：审计 Q-02/Q-05/Q-10/Q-11/Q-14，保留 20 个空白候选槽位。审计器与 3 项测试通过，但所有决策仍 `unconfirmed`，不伪造 Top20 适配清单或试点批准，见 `docs/implementation/c16-decision-ledger.md`。
 - 按 C17 补充共享仓储与桥接装配预备审计：检查组合根、`ownerId` 账号隔离、IndexedDB 事务、Android `appassets` 主框架消息桥、Android Room 代码生成/迁移入口、本机 SQLite 旧版表迁移预演、Electron SQLite 受限 IPC、桌面通知适配器与主进程提醒桥的显式能力/权限门控、超时/停止/迟到清理和高风险能力关闭。9 项静态检查与 Android Room 8 项预备检查通过，包含 1→3 迁移和一次性点击令牌边界；桌面通知适配器 5 项测试与主进程提醒桥 5 项测试通过，但整体仍为 `blocked / preparatory_not_accepted`，不等于真实 WebView、Room 设备旧库升级/备份恢复、安装包迁移、系统权限或设备验收，见 `docs/implementation/c17-assembly.md`。
  - 按 FE-13 补充前端验收交接包预检：`pnpm acceptance:check` 的 8 项检查确认实施文档、当前 43 个文件/668 项单元证据、本轮 96 项双视口 Chrome E2E 证据、Room/桌面提醒限制、C17 与 D 阻塞状态、桌面 ASAR 主进程文件和重现命令齐全；`pnpm d:gate:check` 的 D01～D08 预备审计保持 `blocked`，`goNoGoEligible=false`、`eAfterDEligible=false`、`eStarted=false`、`fStarted=false`；报告为 `preparatory_ready`，仍不等于 B07/B11 人工签收或 D Go/No-Go，见 `docs/implementation/evidence/acceptance-bundle-results.json` 和 `docs/implementation/evidence/d-gate-readiness-results.json`。
- 按 C07/C08 继续接线：`ReminderRuntime` 将待办新增/修改/完成/删除纳入稳定实例、版本替换、取消、到期去重和停止不恢复；Windows 显式宿主 `reminderStore` 已接收本地排程、取消和到期请求，但系统能力仍返回 `unsupported`；浏览器仍为 `page_only`，详见 `docs/implementation/c07-c08-runtime.md`。
- 按 C07/C08 补充 v4 IndexedDB 提醒仓储：提醒记录按账号隔离，替换写入保持事务边界，非法深链和重复实例拒绝，清理不影响其他账号。4 项预备测试通过；浏览器仓储不接 Room、系统权限或后台调度，见 `packages/local-data/README.md`。

## 验证命令

```powershell
pnpm check
pnpm contracts:check
pnpm contracts:kotlin:check
pnpm build
$env:PLAYWRIGHT_CHANNEL='chrome'
pnpm test:e2e
pnpm android:build -Offline
pnpm android:lab:check
pnpm android:lab:build -Offline
pnpm desktop:package
pnpm desktop:lab:check
pnpm desktop:lab:package
pnpm privacy:c03:check
pnpm media:c04:check
pnpm guidance:c05:c06:check
pnpm reminder:c07:c08:check
pnpm reminder:runtime:check
pnpm pet:c13:check
pnpm c11:3d:check
pnpm c12:sandbox:check
pnpm c15:nv:check
pnpm c16:decision:check
pnpm c17:assembly:check
pnpm acceptance:check
pnpm d:gate:check
pnpm localdata:c07:c08:check
pnpm sqlite:c07:c08:check
pnpm desktop:reminder-store:check
pnpm desktop:notification:check
pnpm lifecycle:c09:c10:check
pnpm c14:handoff:check
```

Chrome 端到端用例含桌面及移动视口，不代表 Android 真机测试。CI 使用下载的 Playwright Chromium，无需设置 PLAYWRIGHT_CHANNEL。

阶段进度、96 项 WBS、AT/NV 证据范围和下一步分别见 `docs/implementation/status.md`、`docs/implementation/wbs.md`、`docs/implementation/acceptance.md`。D07 自动开发检查与正式发布检查是两套结果：本地工程通过不表示全部真机、供应、试点、E/F 正式验收或生产上线完成，外部验证不得伪造。
