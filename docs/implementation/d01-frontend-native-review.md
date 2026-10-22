# D01 前端与原生验收复核交接

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。本交接件整理当前工作区中的前端、Android 与 Windows 可复现证据及其边界，不构成人工验收、设备验收或 D 关口批准。

> **当前判定：blocked / preparatory_not_accepted。** FE-13 预检通过仅表示本机材料可检查；AT 最终真实层和 NV 设备/供应层未签收。不得据此宣称 D01 通过、Go/No-Go 已作出，或启动 E/F。

## 1. 目标与输入

### 目标

- 对前端体验与 Android/Windows 原生边界做 D01 复核交接：说明已有什么可重放证据、它覆盖哪些 AT/NV 项，以及尚缺哪些人工、设备、供应和独立复核材料。
- 供后续负责人、参与者及独立复核者按既有验收追踪执行复核；记录应能追溯到本机结果、构建/包哈希和真实执行记录。
- 本任务仅整理证据，不新增产品功能，不代填签收，不改变 C15/C16/D 的状态。

### 复核输入

- [README](../../README.md)：工程边界、预备验证和可用命令；默认演示仅用合成数据。
- [实施状态](status.md)：A/B/C 阶段成果、已知限制和 D/E/F 状态。
- [AT/NV 验收追踪](acceptance.md)：AT-01～AT-24 与 NV-01～NV-12 的权威范围及局部覆盖。
- [验证记录](verification.md)：自动化、构建、Android/Windows 样例的记录与限制。
- [FE-13 验收包结果](evidence/acceptance-bundle-results.json)：预备验收包快照。
- [C15 证据协议](c15-nv-evidence-protocol.md)及 [C15 准入结果](evidence/c15-nv-readiness-results.json)：NV 证据质量、逐项阻塞和所需记录字段。
- [C16 决策台账](c16-decision-ledger.md)及 [C16 准入结果](evidence/c16-decision-readiness-results.json)：Top20、监护/授权、留存、指标和亲情范围的未决输入。
- [D 关口预备审计说明](d-gate-readiness.md)及 [D 关口结果](evidence/d-gate-readiness-results.json)：D01～D08 状态、缺口和 E/F 限制。
- 辅助定位：C01/C02 的 evidence/android-lab.json、evidence/android-lab-jvm.json、evidence/desktop-lab-smoke.json，以及 C17 的 evidence/c17-assembly-results.json 和 c17-assembly.md（路径均在 docs/implementation/ 下）。

## 2. 当前可复现证据

以下“通过”仅表示相应自动化、静态检查或构建的局部结果，不代表整体验收。

| 证据 | 复核结果 / 内容 | 明确边界 |
| --- | --- | --- |
| FE-13 交接包 | 2026-10-17 只读重放 node scripts/check-acceptance-bundle.mjs --no-write：8 项预检通过，status=preparatory_ready、acceptance=preparatory_not_accepted、goNoGoEligible=false；检查到 43 个测试文件/668 个既有单测结果、96 个双视口 E2E 结果。 | 它检查的是留存报告和材料，不会因检查通过而签收 AT/NV。留存的 acceptance-bundle-results.json 是较早快照，FE13-03 记录 expected=92；本次只读重放读到 96。未改写该快照，正式评审前须核对并按需经授权刷新证据。 |
| D 关口 | 2026-10-17 只读重放 node scripts/check-d-gate-readiness.mjs --no-write：D01～D08 均 blocked；status=blocked、acceptance=preparatory_not_accepted、goNoGoEligible=false、eAfterDEligible=false、eStarted=false、fStarted=false。D01 的 localPackageReady=true，但 manualSignoff=false、C15=blocked、C16=unconfirmed。 | D01 明确缺少 B07/B10/B11 人工签收、C15 独立复核条件及 C16 决策输入；预备审计不等于负责人批准。 |
| C15 / NV | 2026-10-17 只读重放 node scripts/check-c15-nv-readiness.mjs --no-write：12 项 NV 均 blocked；deviceVerified=false、supplierVerified=false、goNoGoEligible=false。 | auditPassed=true 与 evidenceQualityPassed=true 只说明引用证据的可读性/追踪元数据检查通过，不是设备、供应或 NV 验收通过。 |
| C16 决策 | 2026-10-17 只读重放 node scripts/check-c16-decision-readiness.mjs --no-write：status=blocked、decisionState=unconfirmed、decisionReady=false、top20Approved=false、pilotEligible=false；输入文件缺失，Q-02/Q-05/Q-10/Q-11/Q-14 未确认，20 个 Top20 槽位未获批准。 | 审计正确保留“未决”不代表负责人、独立复核者或试点方已签收。 |
| 前端 / 自动化 | [验证记录](verification.md) 留存 pnpm check 的 43 个测试文件/668 项通过、96 项桌面与 Pixel 7 视口 E2E 通过，以及 1440×1000/390×844 共 8 组 UI smoke；覆盖合成场景、界面状态、键盘/焦点/字号等自动检查。 | UI smoke、Chrome E2E 和合成资料不能替代人工演示、读屏、原生字幕或 Android 真机验收。只读 FE-13 复核读取的是已有结果，不是本次重新运行测试。 |
| Android / C01、C17 | C01 独立样例已有构建与捕获状态机 JVM 检查；C17/Room 有静态装配、迁移预演、纯 JVM 状态转换和编译证据。参见 README、[验证记录](verification.md)、evidence/android-lab.json、evidence/android-room-results.json、evidence/c17-assembly-results.json。 | 无 Android 设备执行、真实 WebView、系统授权/跨应用捕获、Room 设备旧库升级/恢复、系统调度或生命周期记录。deviceVerified=false。 |
| Windows / C02 | 隐藏 Electron 合成窗口、策略测试和离线开发包/包内容检查已有记录；参见 README、[验证记录](verification.md)、evidence/desktop-lab-smoke.json、evidence/desktop-lab-package.json。 | 未验证真实桌面媒体、双屏/混合 DPI/负坐标、穿透、系统资源释放或独立签收；现有几何/窗口结果不等于设备捕获验收。 |
| C03～C06、C09～C13 | 有逐帧策略、内存 relay、坐标/指向、生命周期、资产预检及供应沙箱的合成测试和范围记录；具体路径见 [AT/NV 验收追踪](acceptance.md) 与 [验证记录](verification.md)。 | 没有真实 OCR/人脸模型、编码/WebRTC 双出口、人工点击轨迹、原生儿童指向、供应凭证或真实资产/渲染的设备层证据。 |

### 快照与复核日期

留存的 FE-13、C15、C16、D 关口 JSON 是历史生成快照；本交接件记录的是 2026-10-17 对当前工作区执行的 --no-write 只读重放。重放确认阻塞结论仍成立，但不回写任何结果文件。FE-13 的 92/96 差异需在正式签收时与 E2E 报告及重新生成的验收包核对，不得静默覆盖或把旧快照说成刚刚执行。

## 3. AT 覆盖摘要

下表压缩呈现 [AT/NV 验收追踪](acceptance.md) 中 AT-01～AT-24 的现有局部覆盖；具体验收步骤以该追踪表和 [验证记录](verification.md) 为准。每行均为“有自动化/模拟材料，不代表完整验收”。

| AT | 已有局部覆盖 | 尚未签收的真实层 / 限制 |
| --- | --- | --- |
| AT-01～02 | 输入/界面演示与流状态；停止代际、迟到事件和宿主生命周期规则的自动检查。 | 真实音频/相机/屏幕共享、Android 生命周期/系统撤权、真实 WebView 和端到端媒体停止记录。 |
| AT-03～05 | 桌宠模拟任务、原画预览、内置 SVG 微调/撤回、本地资源结构门控。 | 无真实生成资产；预览原画仍为 source=simulation、generated=false；无真实资产同步/3D 渲染验收。 |
| AT-06～08 | 合成教学操作与核验、坐标变换向量、遮挡/停靠及过期失效规则。 | 无跨应用真机坐标、原生浮层/真实动画、儿童可达性或人工理解评审。 |
| AT-09、AT-19 | 低置信、过期邀请、拒绝/断线等 UI 和 E2E 场景。 | 无真实家属接通、信令或媒体通话证据。 |
| AT-10～12、AT-22～23 | 本机文字风险拦截、合成帧门控/媒体 relay、停止代际/清理顺序等规则测试。 | 无真实屏幕帧 OCR/脱敏、编码/发送/接收计数、完整日志/崩溃/备份扫描及设备 stop/revoke/lock/kill/reboot 实测。 |
| AT-13～14、AT-21、AT-24 | 流事件完整性、笔记/复习、冲突草稿/明确选择、账号命名空间和本地掌握状态的自动化。 | 无真实服务端流、云端并发合并或真实成效指标签收。 |
| AT-15 | 双视口布局、键盘导航/焦点、大字号、减少动画、静音与语音不可用降级有自动化。 | 无人工读屏/键盘/字号体验记录、双端原生字幕检查和负责人签收。 |
| AT-16～17 | 本地待办/提醒规则、仓储与通知适配器编译/合成检查。 | 无设备系统调度、后台/强停/重启投递或用户实际看到通知的回执。 |
| AT-18 | 登录/认领/监护模拟及失败/过期路径。 | authenticated=false；无真实身份核验、服务端证明、防重放或对象授权。 |
| AT-20 | Top20 流程仅有设计/预备材料。 | Top20 清单、应用版本、风险边界、签名更新/回退未由负责人确认（关联 C16 Q-02）。 |

## 4. NV 覆盖与剩余缺口

截至本次只读复核，NV-01～NV-12 全部 blocked；当前自动化仅帮助定位缺口，不得把下表中的策略测试或样例提升为设备/供应验收。

| NV | 已有预备材料 | 阻塞的验收证据 |
| --- | --- | --- |
| NV-01 Android 捕获/浮层 | C01 样例、构建、状态机 JVM 测试。 | 真机系统授权、跨应用捕获来源、底层仍可操作、浮层对照和独立复核。 |
| NV-02 服务/通知/后台 | Room/提醒策略、迁移预演、适配器编译及状态转换检查。 | 真机权限拒绝、强停/后台/退出/睡眠/重启、系统排程与真实通知回执。 |
| NV-03 Windows 捕获/多屏 | C02 隐藏 Electron 合成窗口、策略测试和单显示器几何记录。 | 真实桌面捕获、双屏/混合 DPI/负坐标、置顶/穿透及独立复核。 |
| NV-04 采集生命周期 | C09/C10 合成停止代际、队列/轨道清理和失败阻断测试。 | stop/revoke/lock/kill/reboot 后真实出口、队列、轨道和资源释放计数。 |
| NV-05 浮层污染 | 停止时隐藏浮层等合成顺序检查。 | Android/Windows 真实捕获开关对照、排除/隐藏/屏蔽结果和人工复核。 |
| NV-06 检测/脱敏 | C03 合成风险、未知、低置信、超时/失败门控。 | 真实 OCR/检测/人脸模型、坏模型质量和逐帧设备证据。 |
| NV-07 媒体出口 | C04 仅内存 relay 的队列/票据/停止竞态测试。 | 真实编码器/WebRTC、无 raw track 证明、AI/家属接收 canary、抓包与停止竞态记录。 |
| NV-08 用户操作/核验 | C05/C06 坐标和“操作后核验”合成向量。 | 设备上的真实页面变更核验、无输入注入及人工操作轨迹。 |
| NV-09 儿童指向 | 合成停靠/避让与资产结构门控。 | 原生桌宠路径、真实动画/遮挡/替代停靠、儿童理解及人工可达性评审。 |
| NV-10 2D/画布/3D | C11/C13 合成容器/manifest、结构与预算预检。 | 真实 VRM/FBX/GLB、隔离解析/渲染、设备帧率/内存、视觉质量和供应资产验收。 |
| NV-11 语音/多模态/生成 | C12 合成凭证门控、失败/取消/回退场景。 | 真实供应凭证、质量/延迟、区域/价格/配额、留存/合同和独立复核。 |
| NV-12 免密/人脸/无 SIM | 登录/认领模拟及 C12/C14 契约/失败路径预备检查。 | 服务端证明、防重放、真实失败替代与认领实测、真实供应凭证和独立复核。 |

所有真实记录按 [C15 证据协议](c15-nv-evidence-protocol.md)填写：日期/时区、构建与包哈希、设备型号/系统/DPI、合成素材哈希、权限与当次同意、步骤/预期/实际、帧/编码/发送/接收/缓存计数、截图/视频、限制、执行者和独立复核者。不得使用真实密码、验证码、银行卡、私人聊天或儿童原始素材，不得虚构执行者、设备或复核签名。

## 5. 剩余缺口与解除条件

1. **人工前端签收：** 补齐 D 关口指出的 B07/B10/B11 负责人和参与者人工演示、体验及无障碍记录；自动 E2E 不替代这一步。
2. **原生设备证据：** Android 与 Windows 目标设备/权限矩阵就绪后，按 NV-01～NV-10 对真实捕获、浮层、坐标/输入、生命周期、检测/媒体、系统投递及儿童路径逐项执行；缺设备时继续记录 blocked。
3. **供应证据：** 真实供应凭证、质量/成本/区域/保留/合同及身份服务证据到位后，依 NV-11/NV-12 的边界复核；不能用沙箱夹具代替。
4. **独立复核：** 由未执行该项的复核者检查来源、计数、限制和素材合规；更新 C15 后仍须负责人按正式 D 流程决定是否进入 Go/No-Go。
5. **C16 决策：** 由负责人与试点方提交并签收 Q-02/Q-05/Q-10/Q-11/Q-14、20 个 Top20 槽位及适用的设备/同意输入；在其确认前不得宣称试点资格或 Top20 已批准。
6. **证据新鲜度：** 对齐 README/验证记录中的当前测试数、E2E 报告和 FE-13 JSON 时间/计数；仅在授权刷新证据文件后再做正式复核，不覆盖历史差异。

在上述前置完成并经独立 D 负责人审议前，D01 保持阻塞；本交接件本身不解除任何阻塞。

## 6. 复核步骤与命令

### 6.1 本机只读状态复核

在仓库根目录 PowerShell 执行下列命令。--no-write 只输出审计结果，不回写证据 JSON；关注阻塞状态是否仍被正确保留。

~~~powershell
node scripts/check-acceptance-bundle.mjs --no-write
node scripts/check-c15-nv-readiness.mjs --no-write
node scripts/check-c16-decision-readiness.mjs --no-write
node scripts/check-d-gate-readiness.mjs --no-write
~~~

期望的当前结果：FE-13 为 preparatory_ready / preparatory_not_accepted；C15 为 blocked 且 NV 全 blocked；C16 为 blocked / unconfirmed；D01～D08 为 blocked，goNoGoEligible=false、eStarted=false、fStarted=false。若输出不同，先核对输入快照和时间，不要仅为得到绿色结果而改状态。

### 6.2 自动化/构建重现

以下是项目现有的自动化/构建入口，可按环境选择执行：

~~~powershell
pnpm check
pnpm build
pnpm test:e2e
pnpm android:lab:check
pnpm android:lab:build -Offline
pnpm desktop:lab:check
pnpm desktop:lab:package
~~~

测试和构建只重现本机代码、合成夹具或包产物。部分命令会刷新 docs/implementation/evidence/ 或创建构建输出；若本轮要求仅修改本交接文件，不运行会改写其他证据文件的命令。Chrome E2E、JVM 测试、Android APK 或 Electron 包均不等于真机/人工验收。

### 6.3 人工与设备复核

1. 使用 [演示场景说明](demo-scenarios.md) 和固定合成数据启动本地前端；确认演示没有连接生产后端、真实账号或真实个人/儿童素材。
2. 按 [AT/NV 验收追踪](acceptance.md) 执行适用的 B07/B10/B11 人工场景；分别记录预期/实际、无障碍操作、失败恢复和版本/包哈希。由参与者和负责人实际复核签收，空缺字段保持空缺。
3. 仅在目标 Android/Windows 设备和明确授权齐备时执行相应 NV：记录设备/系统/DPI、当次权限和同意、捕获/overlay 对照、用户实际点击、stop/revoke/lock/kill/reboot 结果及系统通知/媒体计数。无设备时不要填写设备结果，也不要把模拟器或合成窗口改称真实设备证据。
4. 对媒体/敏感检测使用 C15 允许的合成 canary；保留必要截图/视频和独立复核记录，不收集真实密码、验证码、私人聊天或儿童原始画面。
5. 完成人工及设备记录后，由独立复核者检查证据来源与限制，再重跑 C15/C16/D 只读审计；任何 D 负责人 Go/No-Go 决议须另行记录。当前并无这样的签收或决议。

## 7. 当前结论

blocked / preparatory_not_accepted。本工作区已有相当数量的自动化、合成、静态和构建证据，可支持后续复核准备；但 B07/B10/B11 人工签收缺失、C15 的 NV-01～NV-12 全部缺少设备/供应层独立验收，C16 决策未确认。**自动化不等于验收。** 不伪造人工签收、设备记录、独立复核、Go/No-Go 或 D01 通过；E/F 仍未启动。
