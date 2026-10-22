# F 阶段 V1.2 开发与发布边界

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。保留旧文件名用于历史引用；本文件说明开发与发布分离，不扩展 F 交付范围。

## 开发可持续

按根实施计划 V1.2，D07 的 `DEV_READY` / `DEV_READY_WITH_EXTERNAL_PENDING` 允许依赖满足的本地编码、契约夹具、静态检查、单元测试和隔离合成验证。FS/SS/FF 在开发调度中读取前置任务的 `development`，不是等待所有真实验证或人工签字后才能写代码。

不再向用户索要 D07 签字、角色、Top20 或人工决策 JSON；自动开发决定可按实际证据生成。C14 的自动开发技术冻结与相关前置 development 结果可用于开发交接，独立人工评审不作为本地编码前置。真正的软件/安全/证据失败仍须修复，不得用“开发绕过”放行。

## 历史开发证据快照（不是当前重新执行结果）

以下保留此前来自 `docs/implementation/evidence/f-execution-results.json`、`generatedAt=2026-10-17T14:30:42.952Z` 的历史快照，不推断当前文件仍为该版本。当前执行须以实际报告、版本与命令退出码为准；本次文档修改不构成 F 重跑或验收证据。

| 范围 | 开发结果 | 正式边界 |
| --- | --- | --- |
| F01～F06 / F07～F12 / F13～F24 三阶段 | 各阶段 `exitCode=0`、`success=true`、`safetyClosed=true` | 只证明报告所列本机检查 |
| 24 项任务 | 24/24 `developmentStatus=checks_passed` | 各项 `formalStatus=blocked`、`formalAcceptance=preparatory_not_accepted`、`formalExecutionStarted=false` |
| 汇总 | `success=true`、`development.verdict=DEV_READY_WITH_EXTERNAL_PENDING` | `formalComplete=false`、`formalD07Go=false`、`fStarted=false`、`formalFExecutionStarted=false` |
| 发布/真实能力 | `release.verdict=EXTERNAL_PENDING`、`release.ready=false` | `realNetworkEnabled=false`、`productionDataEnabled=false`、`realDevicesEnabled=false` |

报告中的开发通过不等于所有原始 F 工作包完成；正式任务卡仍保持 `status=blocked`、`acceptance=preparatory_not_accepted`、`execution_started=false`，不能把本地执行写成真实联调、真人试点、签名交付或正式验收。

## 当前要求：先跑 F 的本地开发检查

当前用户明确要求先跑 F。本地运行器默认自动核对 D07 开发决定和开发依赖，满足后执行 F 本地检查；不以人工正式 Go、override 文件存在或 `--bypass-d07` 作为开发启动前置。原 FS/SS/FF 仍约束代码依赖，正式验收与真实验证独立记录。运行交接和待补结果见 [RUN](RUN.md)。

复用当前入口，不添加开发绕过参数；以下为不写共享证据的执行方式，由 F 执行主线程记录实际结果：

```text
node scripts/check-f-development.mjs --no-write
node scripts/f-development/execute.mjs --no-write
node scripts/run-f-development.mjs --no-write
```

本地任务可按实际互不冲突的资源并发；共享数据库、端口、锁或设备时串行。启动或续作先核对已有运行句柄，不因观察超时重复启动。开发失败须定位并修复，不能在输入未变时反复等待外部材料，也不能用兼容参数跳过真实本地失败。

独立人工评审、真实供应、真机、用户有效同意、真实试点及发布所需证明独立记 `external_pending`，对应 verification 未完成，相应能力默认关闭并验证拒绝路径。当前 F 本地执行不启用生产网络/数据、真实账号、供应凭证或设备权限；Mock 和合成数据不能伪造系统权限、真人反馈或正式验收。开发成功不改变正式 D07 或 `fStarted=false` 的发布边界。

## 历史兼容

早期“先越过 D07”的请求、`--bypass-d07`/override 开发绕过记录，以及一轮“聚焦 D07、不要求重跑或新增 F 交付”的范围说明均保留为历史，不再限制当前先跑 F 的要求。`--bypass-d07` 只保留兼容含义，不是绕过实际开发失败、取得人工 Go 或解除发布门禁的手段。

V1.2 后默认 D07 命令检查自动开发门禁，正式判断需显式 `--mode release`。旧的“不得修改开发决定文件”不再作为当前规则，但不能伪造或覆盖真实正式批准。任务卡、共享证据及脚本的执行与回归由主线程负责，本文不将文档更新记为正式 F 完成。
