# F07 任务卡生成与前置检查

生成时间：2026-10-17T23:40:07+08:00（Asia/Shanghai）  
正式状态：`blocked / preparatory_not_accepted`；`execution_started=false`  
开发状态：`verified`；开发已开始：`true`；自动验证：`checks_passed`。
记录性质：WBS 原文提取、开发证据快照与外部待项登记；不是本任务业务验收或发布签收。

## 基线与依赖

- 计划原行（第 380 行）：| F07 隐私/性能/长时/恢复测试 | AT-07/10～12/17/21～23；前置 F06：SS，F01～F05：SS | W19～20 / 2周 | Q / 5 | 网络整形、停止竞态、越权、负载与恢复演练；交付：专项报告 | 设备/样本/分位数与失败率齐全 | 与开发缺陷迭代 |
- SHA-256：`0f030c18c92a85e4f1b5718f2dfe915806ac60c5f8aeaf849b245f8d6a8c2167`（UTF-8 原行字节，不含行尾换行）。
- 原始输入依赖：AT-07/10～12/17/21～23；前置 F06：SS，F01～F05：SS
- 验收证据原文：设备/样本/分位数与失败率齐全
- 风险/接入点原文：与开发缺陷迭代

## 生成时关口快照

- 关口证据生成时间：`2026-10-17T15:14:30.126Z`；D 状态 `blocked` / `preparatory_not_accepted`。
- `goNoGoEligible=false`、`eAfterDEligible=false`、`eStarted=false`、`fStarted=false`。
- 开发门禁快照：`DEV_READY_WITH_EXTERNAL_PENDING`；须与前置 development 状态一起核对，不以正式 blocked 阻断独立编码。
- 不要求人工开发签字、override 文件或 --bypass-d07；真实生产能力仍服从正式门禁与授权。

## 本轮动作与未执行事项

- 从改版计划指定的 E/F WBS 表机械提取原行，生成 docs/execution/tasks/F07.md 与本检查记录；未改动原计划行。
- 仅生成执行文档；没有修改产品代码、服务、数据库、网络适配、Android/Windows 原生能力或供应集成。
- 本次未运行该 WBS 实现或测试；已有证据范围为 existing_local_checks_snapshot_only，不得将生成动作算成一次新的通过。
- 既有开发证据：`docs/implementation/evidence/f-execution-results.json`。
- 既有证据内容指纹：`sha256:46b60d0c746c824cd38361c5426cecbf664e9f7fa357a0bf80757641b39546bd`；只证明引用内容，不证明当前代码重新运行。
- E implemented 仅为代码/测试入口存在性；F verified 仅为已有本地检查通过。设备、供应及真人验证继续 external_pending。
- 未刷新共享 evidence；当前关口值只作为生成时快照，正式执行前必须重查。

## 结论

F07 的 WBS 行已映射到双状态任务卡；开发检查通过可继续本地代码、契约夹具和自动测试，FS/SS/FF 读取 development 状态。正式状态仍为 blocked / preparatory_not_accepted；本地结果不能冒充真实验收或阶段正式完成。

<!-- generated-by: scripts/generate-ef-execution-cards.mjs; sha256:759c1d2adc90cbeaab268c9148117544252ff8ec29563650281e66b334588685 -->
