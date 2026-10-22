# D07 修复与本地运行目标终审

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

审计日期：2026-10-17（Asia/Shanghai）；审查类型：automated。目标为“依据修订计划解决 D07 相关问题，然后检查本项目内容是否可以运行”，不是宣布全部 96 项正式验收或生产上线。

## 需求与当前证据

| 要求 | 当前证据与覆盖范围 | 结论 |
| --- | --- | --- |
| 保留 V1.2 原计划与 V1.1 历史，不因文件改名卡住执行 | `scripts/implementation-plan.mjs` 按正文发现实际 `(1).md`，根/docs 内容一致；计划发现与冲突拒绝测试通过；V1.2 SHA-256 为 `7de509f0441a32e9d4a641e64a985dff3303fedf460c300864ad4f9925eac64f`，V1.1 历史为 `ed9b078814a71fd26686d3b8d8870efb0ef5051e80525798ab4a1fbb12d0b353` | 已验证 |
| 开发与正式发布共用明确规则，不相互矛盾 | `scripts/project-gate.mjs` 及 `tests/acceptance/project-gate.test.ts`；实际失败和未验证能力误启用会阻断，外部待项不会自动当通过 | 已验证 |
| C14 技术冻结来自真实契约与消费者检查 | `evidence/c14-handoff-results.json`，`status=frozen`、自动技术冻结、命令退出 0；契约 0.2.0 / 60 操作 / 118 定义；独立评审另记 | 已验证开发范围 |
| C15 开发审计与设备/供应独立分栏 | `scripts/check-c15-nv-readiness.mjs`、对应测试与 `evidence/c15-nv-readiness-results.json`；来源审计通过、development eligible，12 项 NV 真实实测未通过，release.ready=false | 已验证分离，不冒充 NV 完成 |
| C16 自主默认与 Top20，不等待人工填写 | `c16-development-defaults.json` 五项默认；`c16-top20-candidates.json` 二十项候选；32 项测试通过，真实同意、适配和试点仍未发生 | 已验证开发候选 |
| C17 当前装配与安全路径来自实际代码/测试 | `evidence/c17-assembly-results.json`；9 项装配检查、10 个测试文件的实际命令退出 0、39 项源码/测试指纹；隐私、媒体停止及供应拒绝路径包含在命令中 | 已验证本地范围，真机另记 |
| 自动生成 D07 决定，无人工签字前置 | `scripts/check-d07-decision.mjs`、开发 Schema 与 `evidence/d07-decision.json`；v2 / development / automated / go；开发模式退出 0，幂等与不覆盖用户证据测试通过 | 已验证 |
| 失效证据、损坏 Schema 和未知模式失败关闭 | `tests/acceptance/d07-decision.test.ts`；真实临时夹具覆盖来源变更/删除、无效哈希、新增外部输入、无效决定和未知模式；未修改工作区源文件来伪造测试 | 已验证 |
| 验收包与 D07 不再要求 C17 同时 blocked 和 ready | `evidence/acceptance-bundle-results.json` 与相关测试；development 使用相同 C17 开发结果，release 保留真实验证待项 | 已验证 |
| 本地业务后端与数据库不是整体退回 Mock | `apps/server/src/http.ts` / `sqlite.ts` / `auth.ts`，HTTP/SQLite/同步测试；`evidence/runtime-sqlite-results.json` 实际子进程启动、SQLite 冷迁移、合成设备鉴权与跨进程会话持久化 7/7 | 已验证本地实现 |
| 当前前端可启动、关键交互与错误路径可执行 | `pnpm build` 成功；既有全量 `evidence/e2e-results.json` 96/96，界面源码未变；本次实际启动并执行 `evidence/runtime-web-results.json` 双视口 6/6，涵盖入口、敏感文字拒绝和停止后无迟到回复 | 已验证 Web 开发范围 |
| 项目提供的标准检查命令可运行 | `pnpm check` 退出 0，73 文件 / 880 单测全部通过；`pnpm build` 与 `pnpm contracts:check` 退出 0；`evidence/check.txt` 和 `evidence/unit-results.json` 保存实际输出 | 已验证 |
| 项目说明、任务卡与命令同步，保留历史 | README、RUN、status、C14/C17/F 文档、D01～D08 及 E/F 卡已区分开发和正式状态；50 张 E/F 卡由生成器维护并备份旧内容，正式字段不伪造通过 | 已验证治理范围 |
| 一次性外部能力台账与真实能力关闭 | `external-capabilities.md`、`evidence/release-readiness.json`；15 项本地关闭/拒绝检查通过，13 项外部条件仍 pending；D07 和发布就绪的 release 模式均预期非 0 | 已验证关闭，不宣称外部条件完成 |
| 不残留验证服务或真实数据 | Playwright 管理服务生命周期；SQLite 审计直接拥有并停止子进程，临时目录父级/前缀验证后清理；只使用合成账号，不输出密钥或令牌 | 已验证 |

## 结论与运行方法

- D07 开发门禁为 `DEV_READY_WITH_EXTERNAL_PENDING`，无需人工批准即可继续前置 development 满足的本地代码、服务和测试；真实代码失败不能用外部待项或 bypass 掩盖。
- 项目在当前 Node 24 / Windows 环境可构建、测试，Web 前端与内存/SQLite 后端可本地运行；前端默认仍为演示模式，不宣称 UI 已联通真实认证、供应或媒体。
- 在工作区执行 `pnpm dev`，另一个终端执行 `pnpm server:dev`；默认地址分别是 `127.0.0.1:5173` 与 `127.0.0.1:3000`，先检查已有监听。实际端口和覆盖配置以终端为准。
- 发布为 `EXTERNAL_PENDING`、`release.ready=false`；真机、真实供应、真实用户同意、试点、签名和生产部署仍须独立验证，不算本轮已完成。
- F01～F24 的已有本地开发结果及限制保存在 `evidence/f-execution-results.json`，不是全部 F 原工作包正式交付完成。
