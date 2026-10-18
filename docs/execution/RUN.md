# 暖伴执行断点（V1.2）

更新日期：2026-10-17（Asia/Shanghai）。实际基线为根目录 `暖伴AI公益助手-项目实施计划-Codex高效续作版(1).md` V1.2；由正文发现，不改名。根目录与 docs 副本 SHA-256 均为 `7de509f0441a32e9d4a641e64a985dff3303fedf460c300864ad4f9925eac64f`；保留 96 项功能范围，按开发与发布双状态续作。

## 当前任务与证据

- `development_gate=DEV_READY_WITH_EXTERNAL_PENDING`；`release_readiness=EXTERNAL_PENDING`、`release.ready=false`。正式待项不作为独立本地编码前置。
- 本次目标终审：修复 D07 规则遗漏、复核本地运行；需求逐项与证据对应见 `docs/implementation/d07-runtime-audit.md`。

- 当前任务：按用户“先跑 F”要求完成 F01～F24 本地开发级执行与回归，不把开发通过写成正式交付。
- 已有 D07 快照：`docs/implementation/evidence/d07-decision.json` 为 `schemaVersion=d07-decision/v2`、`decisionMode=development`、`decision=go`；开发结论为 `DEV_READY_WITH_EXTERNAL_PENDING`，不是正式 Go。
- 本轮 F 证据：`docs/implementation/evidence/f-execution-results.json` 的 `generatedAt=2026-10-17T15:37:07.882Z`；F01～F06、F07～F12、F13～F24 三阶段退出码均为 0、`success=true`、`safetyClosed=true`，24/24 项 `developmentStatus=checks_passed`。这是本轮真实运行的本机开发检查，不证明全部原始工作包正式交付。
- F 前置运行器 5/5 个作业成功：`docs/implementation/evidence/f-development-run-results.json`；未传 `--bypass-d07`，由实际自动开发门禁放行。E 代码/测试入口 26/26 存在，F 开发依赖均满足。
- 最终标准命令：`pnpm check`、`pnpm build`、`pnpm contracts:check` 均退出 0；Vitest 全量 73 个文件、880/880 项通过，见 `docs/implementation/evidence/unit-results.json`、`docs/implementation/evidence/check.txt`。此前全量桌面/移动 Chrome 视口 E2E 96/96 通过；界面源码未改，终审另实际启动网页并复测键盘入口、敏感文字拒绝、停止后无迟到回复，双视口 6/6 通过，见 `docs/implementation/evidence/runtime-web-results.json`。
- 终审补齐：C15 显式输出开发/外部/发布状态；C17 把隐私、媒体、供应拒绝路径与其测试纳入实际命令及 39 项源码指纹；D07 对源码修改、删除、损坏哈希和新增外部输入有负面回归。默认 Vitest 限制为 2 workers、文件串行，避免嵌套验证进程无界抢占资源；不保证网络永不重连。
- 已修复旧计划文件名断言、任务卡测试的类型导入，以及实际子进程测试使用不适合的默认 5 秒超时；失败后的完整回归通过，未跳过失败项。
- 正式状态仍为 `status=blocked`、`acceptance=preparatory_not_accepted`、`execution_started=false`、`eStarted=false`、`fStarted=false`；F 报告 `formalComplete=false`、`formalFExecutionStarted=false`、`release.verdict=EXTERNAL_PENDING`、`release.ready=false`。这些正式字段不代表本地开发未发生。
- F 报告的 `realNetworkEnabled=false`、`productionDataEnabled=false`、`realDevicesEnabled=false` 保持不变；本地服务可在隔离开发环境运行，不开放未验证的生产能力。

## 本地运行入口与检查顺序

- 服务并发边界：本轮 Playwright 独占 `:5173`，复用既有后端 `:3017` 验证后停止；验证结束后两个监听均已释放。续作仍须先检查实际监听，不盲目启动第二份服务。

在工作区根目录运行，Node/pnpm 要求以 `package.json` 为准；依赖已存在时不重复安装，缺依赖时才用 `pnpm install --frozen-lockfile`。

~~~powershell
node scripts/check-d07-decision.mjs --mode development --no-write
pnpm f:development:run
node scripts/f-development/execute.mjs --evidence docs/implementation/evidence/f-execution-results.json
pnpm tasks:refresh
pnpm dev
~~~

`pnpm dev` 启动仅绑定 `127.0.0.1` 的 Web 开发服务，配置端口为 5173、`strictPort=true`；以实际终端输出为准，端口占用应定位，不盲目启动第二份。也可双击 `启动暖伴.bat`。开发门禁本地错误应修复；不能因缺签字、角色、Top20 或人工决策 JSON 停止编码。

后端本地入口为另一个终端中的 `pnpm --filter @nuanban/server start`；代码默认监听 `127.0.0.1:3000`、使用内存仓储，执行前核对 `HOST`、`PORT`、`NUANBAN_SERVER_STORAGE` 等覆盖配置，不能连生产数据。前端默认演示模式不因后端启动自动变成真实认证、供应或媒体联调。

本轮后端实测 `/healthz` 返回 200、内存仓储 `status=ok`，未认证 `/v1/relations` 返回 401；复用已有回环服务检查，不代表生产部署或前后端真实供应联调。启动证据见 `docs/implementation/evidence/runtime-server-results.json`，本轮复核后已停止服务。

终审新增实际 Node 子进程启动：内存后端、空 SQLite 自动迁移、合成设备挑战/交换、鉴权后的关系查询，以及停止进程再启动后原会话仍有效，7/7 通过；见 `docs/implementation/evidence/runtime-sqlite-results.json`。仅在临时数据库使用合成账号，未输出密钥/令牌；所有子进程停止、临时数据库删除。该项证明真实本地 HTTP/SQLite 实现可运行，不证明前端已从 Mock 自动切换或接入真实供应。

E2E 使用已安装的 Chrome：PowerShell 先设 `$env:CI="1"`、`$env:PLAYWRIGHT_CHANNEL="chrome"`、`$env:PLAYWRIGHT_JSON_OUTPUT_FILE="docs/implementation/evidence/e2e-results.json"`，再执行 `pnpm exec playwright test --workers=2 --max-failures=1 '--reporter=line,json'`。未安装默认 Chromium 的失败不作为最终证据；完整 Chrome 重跑 96/96 通过。全量单测命令为 `pnpm exec vitest run --maxWorkers=2 --no-file-parallelism --reporter=default --reporter=json --outputFile=docs/implementation/evidence/unit-results.json`。

正式发布只读检查使用 `node scripts/check-d07-decision.mjs --mode release --no-write`，外部条件未满足预期退出 1，不能为了退出 0 修改正式状态。一次性外部能力清单及关闭/拒绝路径证据见 `docs/implementation/external-capabilities.md` 和 `evidence/release-readiness.json`。

## 续作规则

1. 本地调度读取前置任务的 `development`，保留 V1.2 的 FS/SS/FF；外部实测/真实授权独立记录为 `verification=external_pending`，不反向阻断独立的 E/F 编码、本地服务和自动测试。
2. D07 自动开发决定由实际证据生成；不要求用户补签字、选角色、给 Top20 或手填决策 JSON。真实权限、用户同意、设备和供应结果不能伪造。
3. 真正的编译、契约、门控、停止、模式隔离或失效证据错误属于 `DEV_BLOCKED`，应修复再验；不能改称外部待项。相同输入未变时不反复执行同一阻塞检查。
4. E/F 50 张任务卡、50 份检查记录与索引已按 V1.2 刷新，正式字段保留，开发字段按实际代码/证据记录；旧内容保存在 `docs/execution/.ef-card-backups/`。只用生成器刷新受管理文件，不覆盖未知人工改动。旧卡中的人工 Go 规则不再作为本地编码前置。
5. 恢复时先核对实际进程/会话，已验证内容不无故重做；工作区无 Git 提交基线。使用小步写入与本地断点，不承诺网络/服务绝不重连，不关闭安全设置。

## 历史断点（V1.1，2026-10-17T15:57:00+08:00）

以下仅保留当时事实，不是当前开发前置，也不是本轮新检查结果：

- 当时为 D01～D08 预备材料及 E/F 50 张任务卡、50 份预备检查和启动矩阵准备；正式状态 `blocked / preparatory_not_accepted`，`eStarted=false`、`fStarted=false`。
- 桌面重打包和后置检查：修复前快照 3/6；修复后 Web/ASAR 6/6、0 extra；D08 浏览器无障碍 10/10；全量 Vitest 44 文件、681 项通过。
- 当时新增 EF 生成器、`EF-index.md`、D07 检查器/模板/测试等，既有 D/C evidence 未覆盖，产品源码/构建目录未改。EF 生成器 `node --check` 通过；只读预检 E=26/F=24、目标 101 个；50/50 行哈希/依赖/状态/引用审计通过。
- 当时 D-gate `--no-write` 退出码 0 但仍 `blocked`；`pnpm d07:decision:check` 对缺失决策记录退出 1 并保持 `blocked`。旧版人工决策前置已由 V1.2 双门禁替换，不篡改早期命令结果。
- 当时记录无代理、构建或后台任务，`run_id=ef-cards-20261017-1507`、无长任务日志；这不是当前主线程或后台状态的保证。
