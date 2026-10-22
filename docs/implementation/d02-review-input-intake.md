# D02 独立评审与 C16 输入补录单

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。本文件把 D02 从本地预备快照推进到授权评审所需的外部输入分成可核验步骤；它不是 A02/C14 评审结论、契约冻结记录、C16 批准或 D Go/No-Go。

## 1. 当前可复核基线

- D02 本地快照：`docs/implementation/evidence/d02-contract-snapshot.json`，49 项声明资产、缺失项 0；工作区没有 `.git`，不能填写虚构 commit。
- 契约草案：`0.2.0`、60 个操作、118 个定义；C14 静态审查为 9/9，但状态仍是 `draft_review_required`。
- C16 输入目标路径：`docs/implementation/evidence/c16-decision-input.json`；当前文件不存在，不能用模板或占位文本替代负责人决策。

## 2. A02/C14 独立评审提交

以 `docs/implementation/c14-independent-review-template.md` 为记录主体，至少补齐：

| 项目 | 必须有的真实输入 |
| --- | --- |
| 评审身份 | 主评审者、独立复核者、组织/角色、资格、独立性和利益冲突声明 |
| 版本范围 | D02 快照哈希、全部源/生成物/fixture/桥协议/兼容说明范围；没有 Git 时写明不可用 |
| 逐条结论 | PRO、AUTH、ERR、IDEMP、VER、MED、STR 等条目逐项 `通过/有条件通过/不通过/未评审` |
| 偏差与整改 | 编号、严重性、事实、影响、责任人、目标日期、关闭证据和复核结果 |
| 冻结建议 | 只能由有权限评审者选择；建议冻结不等于已冻结 |
| 正式签收 | 技术负责人知悉、独立复核者、D02/D 负责人及日期时区 |

评审后任何契约源、生成物、fixture、授权边界、媒体租约或流终止语义变化，都必须重新生成 D02 快照并进行影响复核。

独立评审完成后另保存 `docs/implementation/evidence/c14-independent-review.json`；可从 `docs/implementation/evidence/c14-independent-review.template.json` 开始填写，使用 `schemaVersion=c14-independent-review/v1`，至少包含评审编号、D02 快照 SHA-256、独立复核者、带时区签署时间、冻结建议和证据引用。该记录与 Markdown 逐条评审表同时保留；任一缺失都不能解除 D02 阻塞。

## 3. C16 决策输入

复制 `docs/implementation/evidence/c16-decision-input.template.json` 为精确路径 `docs/implementation/evidence/c16-decision-input.json` 后，由负责人填写真实内容，再由独立复核者和试点方确认。必须同时完成：

- Q-02：20 个 Top20 场景、应用名称/版本、风险断点、流程包签名和更新回退。
- Q-05：关系/监护核验、consent scope、系统权限和儿童数据边界。
- Q-10：媒体、资产、日志、审计、备份及供应数据的用途、TTL、删除和备份清除。
- Q-11：本人/授权家属确认、无 AI 复现单列、协助排除、分母和观察期。
- Q-14：绑定、档案查看、代设待办、当次屏幕/语音和延期家庭范围。
- `top20Slots`：恰好 20 条，逐条填名称、应用版本、风险边界、权限/同意、流程包版本和回退方案。
- `signoff`：负责人、独立复核者、试点方/合作方和带时区的签署记录；不得用“待确认”“测试”“示例”占位。

## 4. 授权重跑顺序

1. 保存并核对 C16 输入文件与签收记录。
2. 完成 A02/C14 独立评审和偏差复核，确认 D02 快照与评审对象一致。
3. 运行 `node scripts/check-c16-decision-readiness.mjs --no-write` 和 `node scripts/check-c14-handoff.mjs --no-write`。
4. 在获准更新 evidence 后，再按授权命令刷新 C14/C16/D 报告。
5. 最后运行 `node scripts/check-d-gate-readiness.mjs --no-write` 和 `pnpm exec vitest run tests/acceptance/d-gate-readiness.test.ts`；未满足人工/设备/供应前置时不得启动 E/F。

## 5. 当前工作区结论

截至 2026-10-17，C16 输入、A02 独立评审、C14 冻结建议和有权限签收均未提供；本补录单只形成可执行入口，不改变 D02 的 `blocked / preparatory_not_accepted` 状态。
