# E 阶段 V1.2 开发与发布边界

更新日期：2026-10-17（Asia/Shanghai）。保留旧文件名用于引用；本地开发现按根实施计划 V1.2 自动开发门禁执行，不再依赖临时人工例外。

## 开发门禁

- D07 默认命令 `pnpm d07:decision:check` 检查开发模式，由实际证据生成/校验开发决定；不要求用户补签字、指定角色、提供 Top20 或填写人工决策 JSON。
- `development.verdict=DEV_READY` 或 `DEV_READY_WITH_EXTERNAL_PENDING` 时，按前置任务的 `development` 与原 FS/SS/FF 继续 E01～E26 代码、本地服务、契约夹具和自动测试。
- `DEV_BLOCKED` 表示相关编译、契约、模式隔离、安全或证据错误，必须修复再验；真实软件失败不得改记 `external_pending`。
- 本地默认使用合成数据、内存端口或明确隔离的开发仓储；允许实现真实业务逻辑，不代表允许连接生产服务或生产数据。

## 发布与外部验证

- `release.verdict=EXTERNAL_PENDING`、`release.ready=false` 与开发可继续同时成立。
- 正式记录仍保留 `status=blocked`、`acceptance=preparatory_not_accepted`、`execution_started=false`、`eStarted=false`、`fStarted=false`；这些字段不把已发生的本地编码解释为“未开发”。
- 设备、真实供应、用户/监护同意和真实试点未发生时，记 `verification=external_pending` 并保持对应真实能力关闭；不得伪造权限、真人复核或正式批准。
- 本机合成、Mock、静态检查、打包和测试入口存在，均不能升级为真实供应、实机联调、试点或正式验收。开发结果中的 `decision=go` 必须结合 `schemaVersion`、`decisionMode` 解读，不是正式 Go。

## 本地入口与证据口径

~~~powershell
node scripts/check-d07-decision.mjs --mode development --no-write
pnpm e:development:check
pnpm dev
~~~

开发检查器的 `implemented` 只表示该任务的代码与测试入口存在，不表示测试已执行或 WBS 全部验收。`blocked`/`not_started` 是该检查器的代码存在性分类，不得与正式记录的同名 `blocked` 混为一谈。

本地启动与结果登记见 [RUN](RUN.md)；本轮实际运行检查由主线程补录。发布只读入口为 `node scripts/check-d07-decision.mjs --mode release --no-write`，缺真实条件应保持非通过，不反向停止独立编码。

## 历史兼容

早期本记录曾以“开发例外”允许受限实现，并说明 `d07FormalGo=false`；该正式边界保留。V1.2 已替换“人工 D07 Go 后才能本地编码”的旧规则，不能把默认开发检查误称为正式决策检查。旧任务卡/检查单的状态字段和文字迁移由主线程处理，本轮不改卡片、脚本或证据 JSON。
