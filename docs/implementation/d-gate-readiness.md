# D 关口开发与发布双状态（V1.2）

更新日期：2026-10-17（Asia/Shanghai）。依据根实施计划 V1.2 的 D01～D08：自动工程复核允许继续本地 E/F 开发；真实设备、供应和发布另行验证。不再把全部外部实测、人工签字或人工决策文件作为编码前置。

## 当前证据口径

来源为已有 `docs/implementation/evidence/d-gate-readiness-results.json` 与 `d07-decision.json` 快照；本轮只改流程文档，不刷新证据，不声称本轮重新通过。

| 维度 | 已有结果 | 含义 |
| --- | --- | --- |
| 开发 | `development.verdict=DEV_READY_WITH_EXTERNAL_PENDING`、`development.eligible=true` | 可按前置开发状态继续本地服务、业务代码、契约与测试 |
| 发布 | `release.verdict=EXTERNAL_PENDING`、`release.ready=false` | 外部实测与真实授权未完成，生产能力不能自动开放 |
| 兼容正式字段 | `status=blocked`、`acceptance=preparatory_not_accepted`、`goNoGoEligible=false`、`eAfterDEligible=false` | 正式状态保留，不作为“不能本地编码”的全局状态 |
| 正式开始字段 | `eStarted=false`、`fStarted=false`；任务卡 `execution_started=false` | 不代表本地开发未发生，不宣称正式联调、试点或发布启动 |

F 已有报告 `generatedAt=2026-10-17T14:30:42.952Z`：三阶段、24/24 项开发检查通过，`formalComplete=false`、`fStarted=false`。只引用其实际覆盖，不把本机检查升级为原始 F 工作包全部验收；本轮不扩展 F 交付。

## D01～D08 的开发输入与外部项

| 工作包（V1.2） | 本地工程输入/可继续工作 | verification / 外部与正式边界 |
| --- | --- | --- |
| D01 自动前端/原生工程证据复核 | 检查前端、契约、门控/停止及可执行原生证据 | 人工演示、读屏、真机 NV 等未发生不冒充通过 |
| D02 契约自动冻结与后端交接 | 依据 C14 契约/版本/消费者检查生成接口交接，允许本地后端实现 | A02/C14 独立评审不是编码前置；真实部署/供应不能假称已有 |
| D03 前端候选包与重置自动检查 | 固定场景、重置、包与运行说明 | 实际启动结果由主线程补录；候选包不代替真人体验 |
| D04 Android 工程证据与外部项汇总 | 工具链、Room、迁移入口、JVM 与 APK 证据分层 | 真机权限、后台/锁屏/强停/重启与通知回执待验证 |
| D05 Windows 工程证据与外部项汇总 | 桌面代码、包、几何与安全关闭检查 | 真实捕获、多屏/DPI、穿透和系统资源释放待验证 |
| D06 媒体/供应适配工程结论 | 适配器、受控出口、取消、授权与关闭策略 | 真供应、编码/WebRTC/接收端和服务条款未验证则保持能力关闭 |
| D07 自动开发门禁与 E 阶段放行 | 读取 D01～D06/D08 的 development，自动计算开发/发布结果 | 开发 Go 不等于正式 Go，不索取人工决策 JSON |
| D08 交互与无障碍自动技术复核 | 可执行的布局、键盘、读屏语义、字幕与减少动态检查 | 不冒充真人读屏/体验或人工签收 |

除 D07 按 D01～D06/D08 的 development 报告为 FS 外，其余 D 项按根 V1.2 的 B07/B10/C14/C15/C16/C17 development 结果为 FS。真实后端 HTTP/SSE/WS、认证、媒体与生产数据库未接入，不是阻止 D02 自动工程交接或本地 E 编码的理由。

## 命令与本地运行入口

~~~powershell
node scripts/check-d07-decision.mjs --mode development --no-write
node scripts/check-d07-decision.mjs --mode release --no-write
~~~

默认 `pnpm d07:decision:check` 为开发模式，可按实际证据生成/校验决定；发布必须显式 `--mode release`。`pnpm d:gate:check` 等有证据写入入口，文档迁移后需由主线程按真实检查顺序刷新并核对哈希；本轮不执行写证据命令。

本地 Web 用 `pnpm dev`，可选本地后端用 `pnpm --filter @nuanban/server start`；绑定、配置及检查中状态见 [RUN](../execution/RUN.md)，实际可运行结论待主线程记录。

## 失败与续作

- `DEV_BLOCKED` 只用于实际相关软件、安全、模式或证据错误，修复后重验；不能以常量、改阈值或伪证放行。
- 缺设备、供应、真实同意/试点等记 `external_pending`，对应真实能力关闭；不向用户追要签字、角色、Top20 或人工决策文件来继续开发。
- 本地按 development 的 FS/SS/FF 滚动执行；发布按真实验证检查，不以开发成功自动设置 `release.ready=true`。
- 相同输入未变时不反复跑外部阻塞检查；优先处理 D07 语义和本地运行，不扩大其他 F 交付。

## 历史说明

早期 D 预备审计保留 `blocked / preparatory_not_accepted`、`eStarted=false`、`fStarted=false` 的事实；自动化当时也不是人工批准。旧文档“不进入 E/F”的全局编码限制已由 V1.2 替换，真实验收未发生的事实继续保留。
