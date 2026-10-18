# D08 本地预备检查记录

更新时间：2026-10-17（Asia/Shanghai）  
任务状态：`blocked` / `preparatory_not_accepted`  
记录性质：只读核对与人工复核表单预备，补记新鲜浏览器自动化复跑证据；不是 Android 真机、真实读屏、人工体验、设备验证、独立复核或 D08 签收。

## 范围与写入边界

初次预备依照计划原始行 `暖伴AI公益助手-项目实施计划-Codex高效续作版.md#L335`，核对签收正文、E2E 源码、既有报告及 D 关口快照，并建立 `docs/implementation/d08-manual-review-intake.md`。这些初次检查作为历史记录保留。

本次只读核对 D08 任务卡、本文、`docs/implementation/evidence/d08-browser-accessibility-20261017.json` 和 `.cache/d08-accessibility-20261017-results.json`；写入仅限 `docs/execution/tasks/D08.md` 与本文。未修改共享 `RUN.md`、history、共享 evidence、人工补录入口、其他任务、产品源码或构建目录，未执行构建或测试。

## 初次预备只读检查（历史保留）

| 检查 | 实际结果 | 边界 |
| --- | --- | --- |
| 读取 `docs/implementation/d08-accessibility-signoff.md` | 文件存在；声明 `blocked` / `preparatory_not_accepted`、`manualSignoff=false`；列出 SUB-01～03、AT-15、B07/B10/B11/B09 约束及 5 项自动化映射。 | 文档是验收边界说明，不是人工签收凭证。 |
| 读取 `tests/e2e/accessibility.spec.ts` | 实际存在 A11Y-A01～A05：跳过导航/键盘激活；正文 1.25、字幕 40、减少动画及视口溢出；静音字幕/重读；用 `speechSynthesis=undefined` 模拟语音不可用；对话框名称/Escape/焦点回收。 | 浏览器 DOM、键盘事件和故障夹具断言，不是系统读屏器、真实辅助技术或原生字幕验证。 |
| 只读解析 `docs/implementation/evidence/e2e-results.json`，并核对 `docs/implementation/evidence/e2e.txt` | 既有报告汇总 96 项通过、0 失败、0 跳过、0 flaky；无障碍 5 个用例在 `desktop-chromium` 和 `mobile-chromium` 各通过一次（10 次项目执行）。报告项目配置含 1280×720 桌面视口和 412×839 Pixel 7 移动视口模拟。 | 报告是既有自动化记录；初次预备未重跑测试。移动视口配置不等于 Android 真机。 |
| 只读解析 `docs/implementation/evidence/d-gate-readiness-results.json` | 快照时间 `2026-10-17T00:52:49.567Z`；总状态 `blocked`，`goNoGoEligible=false`、`eAfterDEligible=false`、`eStarted=false`、`fStarted=false`；D08 为 `blocked`、`accessibilityAutomationPresent=true`、`manualSignoff=false`、`e2eEvidenceExpected=92`。 | 这是既有快照，不在本轮刷新；92 与 E2E 报告 96 的计数/范围差异需在后续授权关口复核。 |
| 读取计划 D08 原始行并计算其 SHA-256 | 行文本与任务卡引用一致；UTF-8 行内容哈希为 `77c41daa75b14a6fc7fb99a7754f7470f3b24ce4fd1704cad7a48a924e88c233`。 | 仅用于计划行来源校验，不代表版本控制提交或验收签名。 |

以上为初次预备的文件读取、文本检索或本地 JSON/哈希解析记录。下节补记另行生成的新鲜浏览器复跑结果；本次文档更新只读取这些结果，未执行 Playwright、未启动浏览器、未写入 evidence，也未操作真实设备或真实辅助技术。

## 2026-10-17 新鲜浏览器复跑证据补记

- 汇总证据：`docs/implementation/evidence/d08-browser-accessibility-20261017.json`（`schemaVersion=d08-browser-accessibility/v1`，生成时间 `2026-10-17T03:27:16.191Z`）。
- 原始日志：`.cache/d08-accessibility-20261017-results.json`。只读解析日志的 `stats`、项目配置及全部测试结果，与汇总证据交叉核对。
- 原始开始时间：`2026-10-17T03:17:22.783Z`（北京时间 11:17:22.783）；耗时 `23108.21 ms`。汇总证据记录命令退出码 `0`、`success=true`；这仅表示本次浏览器自动化复跑结果。

| 浏览器项目 | expected / 执行项数 | unexpected | skipped | flaky |
| --- | --- | --- | --- | --- |
| `desktop-chromium` | 5 / 5 | 0 | 0 | 0 |
| `mobile-chromium` | 5 / 5 | 0 | 0 | 0 |
| 合计 | **10 / 10** | **0** | **0** | **0** |

两个项目各执行同样的 5 个用例：跳过导航/键盘操作、最大字号/减少动画/视口溢出、静音字幕/重读、语音不可用时字幕降级、模态框名称/Escape/焦点回收。10 项均为 `outcome/status=expected`，各次原始执行结果均为 `passed`，没有跳过或 flaky。

**证据边界：**移动项目是 Pixel 7 浏览器视口模拟，不是 Android 真机；本次复跑不是 Windows/Android 实机验证、真实读屏、人工签收或独立验收。证据明确保留 `acceptance=preparatory_not_accepted`、`deviceVerified=false`、`manualSignoff=false`、`independentAcceptance=false`、`goNoGoEligible=false`、`eStarted=false`、`fStarted=false`。10 项专项结果不覆盖历史 96 项全量报告，也不刷新 D 关口或消除其 92/96 口径差异。

## 资料映射及限制

- 现有签收正文第 2 节定义 SUB-01～03、AT-15 和前置边界；第 3 节说明 A11Y-A01～A05 的自动化覆盖与未覆盖范围。
- E2E 源码的五个测试名和具体断言已映射到新增人工补录单，便于执行者识别可复用的自动化基线与需要亲自验证的差距。
- 历史 `e2e-results.json` 总数为 96，而既有 D 关口快照中的 D08 `e2eEvidenceExpected` 为 92。新鲜 10 项专项结果是第三份独立范围的记录；本次不覆盖、不“校正”共享 evidence，也不将差异解释为通过。
- 本机文件检查无法证明现场人员、读屏器、系统键盘辅助、Android/Windows 原生字幕、音频/TTS 故障、真实大字号布局或签收已完成。

## 仍需补齐的人工与前置输入

- 真实读屏朗读、完整键盘/焦点、大字号体验及缺陷复测的人工原始记录。
- Windows/Android 实机、设备与系统版本、双端原生字幕及音频/TTS 降级实测证据；浏览器视口模拟不能替代。
- 人工执行者、独立复核者和有权限的 D 负责人的真实身份、结论及签收；不得由自动化结果或模板代填。
- B07/B10/C15/C16 的当前输入与前置证据，并由有权限的 D 负责人按授权流程复核 D 关口。

## 结论

D08 预备入口已建立，并已补记新鲜浏览器复跑 **10/10 expected、0 unexpected、0 skipped、0 flaky**；没有补录真实人员或设备结论。D08 保持 `blocked / preparatory_not_accepted`。后续须补齐 B07/B10/C15/C16 输入、真实读屏及 Windows/Android 实机记录，完成实际人员补录、独立复核和 D 负责人授权复核；在此之前不作人工验收、发布批准或 Go/No-Go，不启动 E/F。
