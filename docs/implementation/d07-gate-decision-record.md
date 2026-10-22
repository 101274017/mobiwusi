# D07 自动开发决定与发布状态记录（V1.2）

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。根实施计划 V1.2 将 D07 改为自动开发门禁。本文记录开发可继续与正式发布待项，不是人工批准、真实设备/供应结果或正式验收证明。

## 判定与输入

开发门禁读取契约/事件与消费者、C14/C15/C16/C17、验收包、安全关闭/停止与当前证据。开发与发布使用两套结果：

| 结果 | 可执行动作 | 不表示 |
| --- | --- | --- |
| `DEV_READY` | 继续依赖满足的本地代码、服务和自动测试 | 已正式上线 |
| `DEV_READY_WITH_EXTERNAL_PENDING` | 保持受影响真实能力关闭，继续独立开发 | 外部实测、用户同意或真人试点已发生 |
| `DEV_BLOCKED` | 修复实际相关编译/契约/安全/模式/证据错误并重验 | 仅仅缺人工材料；不可把软件失败改称外部待项 |
| `release.verdict=EXTERNAL_PENDING`、`release.ready=false` | 保留真实验证缺口和关闭策略 | 必须停止全部本地 E/F 编码 |

不要求用户补 D07 签字、指定评审角色、给 Top20、填写人工决策 JSON 或逐项放行。Codex 可按实际输入生成技术默认值和候选；不能伪造真人、设备、供应、平台权限或真实用户/监护同意。

## 当前已有快照

本轮只迁移文档，以下来自已有证据而非本轮重新执行：

| 来源 | 当前值 | 正确解释 |
| --- | --- | --- |
| `evidence/d07-decision.json` | `schemaVersion=d07-decision/v2`、`decisionMode=development`、`decision=go`；`generatedAt=2026-10-17T13:43:50.368Z` | 自动开发决定，不是正式 Go；必须同时核对 Schema、模式和证据 |
| 同一决定 | `development.verdict=DEV_READY_WITH_EXTERNAL_PENDING`、`development.eligible=true`；`release.verdict=EXTERNAL_PENDING`、`release.ready=false` | 开发可持续与正式未就绪同时成立 |
| `evidence/d-gate-readiness-results.json` | `status=blocked`、`acceptance=preparatory_not_accepted`、`goNoGoEligible=false`、`eAfterDEligible=false`、`eStarted=false`、`fStarted=false` | 保留的正式/兼容字段，不再是全局编码禁令 |
| `evidence/f-execution-results.json` | `generatedAt=2026-10-17T14:30:42.952Z`；三阶段退出码 0，24/24 项开发检查通过；`success=true` | 仅报告覆盖的本机开发检查，不等于原始 F 工作包全部交付 |
| F 正式字段 | `formalComplete=false`、`formalD07Go=false`、`formalFExecutionStarted=false`、`fStarted=false` | 任务卡 `blocked / preparatory_not_accepted / execution_started=false` 仍保留 |

当前快照没有把真实网络、生产数据或真实设备启用；F 报告对应三个开关均为 false。不能只看顶层 `decision=go` 或退出码 0 推导正式批准。

## 复核命令与本地运行

~~~powershell
node scripts/check-d07-decision.mjs --mode development --no-write
node scripts/check-d07-decision.mjs --mode release --no-write
~~~

默认 `pnpm d07:decision:check` 是开发模式，可自动生成/校验开发决定，不是旧版人工正式决策预检；`--no-write` 仅复核不改文件。发布模式在缺真实条件时应非通过，不能为消除阻断伪造批准。未知模式、损坏 Schema、失效证据和真实本地错误不能静默视为开发通过。

本地运行入口：工作区根目录 `pnpm dev`；可选本地后端 `pnpm --filter @nuanban/server start`。前端默认演示与生产能力分离，实际监听地址、页面/接口、类型/构建和回归结果由主线程补录到 [RUN](../execution/RUN.md)。当前只说明入口存在，不能称本轮已跑通。

## 外部验证，不是待用户填表

- B07/B10/B11 真人演示、读屏和体验未发生的事实保留，自动技术复核不冒充人类签收。
- C15 的真机、供应、抓包/接收端及独立实测按真实来源登记，未发生时为 `external_pending`。
- C16 自主默认流程/Top20 候选与真实应用适配、监护同意、试点合作分别记录；不要求用户交清单或批准开发。
- C14 自动技术冻结与 A02 独立真实评审分开；C17 静态/本地端口装配与真实 WebView、系统权限、生命周期分开。
- 真正开放能力时须有相应有效授权和真实验证，不能由 Mock、合成、打包或哈希替代；缺口只限制对应真实能力/正式发布，不阻止独立本地代码。

## 主线程续作边界

优先完成 D07 相关一致性与本地可运行检查，不扩展其他 F 交付。本轮未改任务卡、证据 JSON、脚本或根计划；旧任务卡/索引/生成器与其他文档若仍有人工 Go 编码前置，由主线程迁移。文档变更可能影响证据指纹，需按实际依赖刷新并验证开发/发布结果，没有新输入时不重复轮询同一外部阻塞。

## 历史兼容记录

V1.1 曾使用人工决策模板、四角色签署和人工 Go 后才进入 E 的流程；早期缺决策记录时命令退出 1、保持 blocked 的结果保留在 [RUN 历史断点](../execution/RUN.md)，不改写成当时已通过。旧签署表不再作为活跃待办，也不要求补填。

旧 `d07-decision/v1` 正式记录与开发 `d07-decision/v2` 必须区分；兼容实现以主线程当前代码为准，不能由开发 go 冒充正式批准，也不能把旧人工字段反向作为本地启动前置。真实发布证明不存在就保持未就绪，不得复制模板、造人名或手工改证据冒充批准。
