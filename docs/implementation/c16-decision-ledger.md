# C16 V1.2 自动开发默认决策与 Top20 候选台账

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。对应 V1.2 实施计划 C16「Top20默认流程与授权/试点工程方案」。开发技术选择自动形成，不等待负责人补 Top20、外部决策 JSON 或人工签字；真实人员同意、应用版本适配、供应条款和正式签收不由自动化代填。

## 复现与写入范围

```powershell
# 只读开发检查，不写任何候选文件或 readiness-results
node scripts/check-c16-decision-readiness.mjs --no-write
# 仅生成下面两个 development/candidate 文件，不写 readiness-results
node scripts/check-c16-decision-readiness.mjs --development-only
# C16 针对测试，不输出项目证据结果
pnpm exec vitest run tests/acceptance/c16-decision-readiness.test.ts
```

- `docs/implementation/c16-development-defaults.json`：五个 Q 项的可逆开发技术选择。
- `docs/implementation/c16-top20-candidates.json`：恰好 20 个有实际名称、平台、风险边界、停止/回退策略及来源行号的初始候选。
- 两份产物均显式标记 `generatedBy=automated`、`mode=development`、`status=candidate`；它们是开发配置建议，不是运行时功能实现或真实验证证据。
- 本次不刷新 `docs/implementation/evidence/c16-decision-readiness-results.json`。由主线程统一运行 `node scripts/check-c16-decision-readiness.mjs --evidence docs/implementation/evidence/c16-decision-readiness-results.json`；现有 `pnpm c16:decision:check` 入口也可使用。刷新时同步重建两个候选文件。

## 实际来源与开发失败

1. 读取根目录 `暖伴AI公益助手-项目实施计划-Codex高效续作版.md`：校验 V1.2 版本和 C16 任务行，从第 5 节的默认策略表及 Android/Windows 候选段落生成内容，不把固定空槽或通用“基础流程”当作 Top20。
2. 读取 `docs/implementation/baseline.md`：核对 Q-02/Q-05/Q-10/Q-11/Q-14 实际存在。保留路径、字节数、SHA-256、来源行号和策略原文；来源内容变化会改变生成结果及哈希。
3. 开发检查实际验证默认策略及真实边界、Android/Windows 各十项、总数恰好二十、非空、无占位、平台内不重复及敏感操作限制。未检查真人同意或真机执行，不把来源检查称为完整流程执行。
4. 缺文件、缺 Q 项、旧计划、缺策略、19/21 项、重复、危险候选、丢失密码/配对/硬件限制等均产生具体失败检查：`auditPassed=false`、`development.verdict=DEV_BLOCKED`、`verification.automated=failed`、`verification.release=BLOCKED`，命令非零退出。这些软件输入错误不归为外部待项，也不覆盖上一次有效的候选产物；旧产物不能代替失败的当前检查结果。

## 五项开发默认方案

| 决策 | 自动开发技术默认值 | 保留的真实边界 |
| --- | --- | --- |
| Q-02 Top20 | 使用计划的二十项安全候选；未知页面暂停；候选更新、显式提升及回滚策略；保留 PRD 必做流程 | 不批准应用版本，不宣称二十项真实适配，不替换现有运行时流程库 |
| Q-05 监护/授权 | 默认无同意、空 scope；关系/档案/当次/系统权限分开；核验 scope、撤回、到期和当前版本；儿童仅合成数据 | 不替监护人同意，不使真实采集/分享自动授权 |
| Q-10 留存/删除 | 仅合成数据；原始实时媒体不持久化；按数据类别配置清理与备份删除重放；供应处理默认关闭 | 批准期限及供应保留条款为 `null`，不编造真实 TTL 批准 |
| Q-11 掌握/指标 | 本人或有效授权主体确认；AI 只建议；独立操作/练习/掌握分事实，无 AI 复现与协助练习分开 | 不生成学习效果或公益转化结论 |
| Q-14 亲情范围 | 绑定、档案查看、代设待办、当次屏幕/语音保留为开发流程；空默认 scope；当次同意与系统授权独立；复杂家庭范围后续 | 真实家庭数据默认关闭，不以配置文件冒充完整亲情功能闭环 |

## Top20 具体候选与验证状态

- Android：字体大小、显示大小、屏幕亮度、深色模式、媒体音量、响铃/静音、自动旋转、手电筒入口、Wi-Fi 设置入口（不教密码）、蓝牙设置入口（不含敏感配对证明）。
- Windows：文字大小、显示缩放、屏幕亮度（设备支持时）、浅色/深色主题、系统音量、输出设备选择、夜间模式、鼠标指针大小、放大镜、浏览器页面缩放。
- 当前每项 `verification=external_pending`、`targetVerified=false`、`applicationVersion=null`、`flowPackageVersion=null`、`consent=null`、`consentGranted=false`。来源/配置检查不升级为 `synthetic_verified` 或 `target_verified`，也不从运行时占位目录推断真实支持。
- 报告中的兼容字段 `top20Slots` 现在承载上述有名称的候选，而不是二十个空白槽；正式批准仍由独立字段表达。

## 外部输入与正式结论

可选 `docs/implementation/evidence/c16-decision-input.json` 仍按 `c16-decision-input/v1` 做结构校验，包含带时区时间、五项决策、二十个槽位和负责人/独立复核者/试点方签收字段。缺失、格式错误、占位字段或无人工签字不阻断开发默认方案；错误保留在 `decisionInputErrors` 和正式 `blockerRefs`。即使合成输入结构完整，结构校验也不核实身份、同意、签名真实性或试点关系。

当前开发检查通过时为 `DEV_READY_WITH_EXTERNAL_PENDING`，仅允许继续独立的本地代码、契约与合成测试。正式字段继续保持 `status=blocked`、`decisionState=unconfirmed`、`decisionReady=false`、`top20Approved=false`、`pilotEligible=false`，五个正式决策仍为 `unconfirmed`，未确认字段不因开发候选自动清空。真实 E18/E20/E24 验证、真人试点和正式发布不能从本台账获得批准。
