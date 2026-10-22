# D02 契约冻结与后端交接

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。当前状态：**blocked；契约仍为评审草案，未冻结、未签收**。本文整理 D02 的交付范围、复核入口和未决项，不替代独立评审、版本批准或 D Go/No-Go。

## 1. D02 范围

D02 依据 `packages/contracts` 形成可追溯的契约评审快照和后端交接包：明确单一来源、生成物、兼容边界、风险/偏差、版本及哈希，并由有相应职责的人员独立评审和签收。

**包含：**

- 评审 HTTP 操作、DTO、事件/流终止、错误包络、认证/对象授权元数据、幂等与版本条件，以及当前活动桥协议边界。
- 核对 OpenAPI、JSON Schema、TypeScript/Kotlin 生成物与源定义一致；记录兼容策略、未决事项和后续实现限制。
- 形成完整、可复核的冻结候选版本快照；所有偏差均有责任人、处置结论和复核证据。

**不包含：**

- 实现或部署真实后端、认证服务、生产数据库、真实供应商调用或媒体中继。
- 将静态检查、合成夹具、Mock、模板或本交接文档视为独立评审、协议冻结、D 批准或服务可用证明。
- 修改契约生成物来绕过源定义；接口变更必须修改源定义、重新生成并复核。

## 2. 契约草案与生成物

当前草案版本为 `0.2.0`，含 **60 个操作、118 个服务定义**。契约来源包括 `packages/contracts/src/spec/` 下的 primitives、models、events、errors、operations、catalog，以及单独定义活动桥边界的 `packages/contracts/src/active-bridge.ts`。生成物不得手工编辑。

生成器当前管理的产物：

- OpenAPI：`packages/contracts/openapi.json`（OpenAPI 3.1）。
- JSON Schema：`schemas/services.schema.json`、`schemas/note.schema.json`、`schemas/service-error.schema.json`、`schemas/bridge.schema.json`、`schemas/android-bridge-reply.schema.json`。
- TypeScript：`src/types.generated.ts`。
- Kotlin：`kotlin/src/main/kotlin/org/nuanban/contracts/ServiceDtos.generated.kt`、`ContractRules.generated.kt`。

`schemas/conversation-event.schema.json` 也由契约校验覆盖，但不在当前 `scripts/generate-contracts.mjs` 的生成映射中；冻结快照应注明其维护/版本关系，不应误报为该生成器产物。

C14 现有证据 `docs/implementation/evidence/c14-handoff-results.json` 报告 9 项静态检查通过、`success=true`，但状态仍是 `draft_review_required`，且 `backendStarted=false`。其 `sourceInventory` 中已记录文件的 SHA-256 与当前文件相符；不过该清单未覆盖 `models.ts`、`active-bridge.ts` 及全部生成物。因此它可作为草案审查证据，不能单独充当完整冻结快照。本轮 prep-01 新增的 `docs/implementation/evidence/d02-contract-snapshot.json` 补齐 49 个声明资产的源/生成物/活动桥/fixture/兼容说明/复算工具哈希边界，缺失项为 0；它仍只是本地预备快照，不能替代独立评审、冻结或签收。当前工作区无可用 Git 元数据，提交标识只能记录为不可用，不得虚构。

| C14 证据角色 | 路径 | 字节数 | 当前 SHA-256 |
| --- | --- | ---: | --- |
| generated_openapi | `packages/contracts/openapi.json` | 485835 | `8054d8be16705bc6902e86494c53ca9bff2c3ade4903d698b4367a5957c92e41` |
| operations | `packages/contracts/src/spec/operations.ts` | 12071 | `95118a211b11dc9230a98e785ae678b1eca8779f6c08ee40956a8d643c3380ee` |
| events | `packages/contracts/src/spec/events.ts` | 5442 | `2288c2440c03260de512d0a946d84e1f460113bb0a7a0320266f396f8ec3579b` |
| catalog | `packages/contracts/src/spec/catalog.ts` | 1079 | `75d4df906ca4068198dcd42febd07cc07f207a8a9c356006f8475af2280fe46db` |
| primitives | `packages/contracts/src/spec/primitives.ts` | 2367 | `9cc4ae693033f19498b69cee74d1610d0e97dd10d525b09c28e8f5af67be77cb` |
| errors | `packages/contracts/src/spec/errors.ts` | 388 | `27124d0ddb3bcffcd7f65177caedb00191dfa8f892d8f234dd73aecfe0f71b66` |

### prep-01 本地快照边界

本轮只允许修改本文、docs/execution/tasks/D02.md、docs/execution/checks/D02-prep.md，以及明确新增的 docs/implementation/evidence/d02-contract-snapshot.json；不覆盖其他 evidence，不修改 packages/contracts、共享 RUN、状态总账或其他任务文件。

快照按原始文件字节计算 SHA-256，文件列表必须明确区分契约源、生成物、活动桥协议、fixture、兼容说明和复算工具；缺失项与未执行检查单独登记。无 Git 元数据时提交标识只能为不可用，不以本地哈希冒充 commit。快照制作或本地校验通过均不改变 blocked / preparatory_not_accepted，不签署冻结、不启动 E/F。

## 3. 校验与证据命令

从项目根目录执行。命令成功只说明其覆盖范围内的本地检查通过，不等于人工签收或服务端能力证明。

| 命令 | 用途与注意事项 |
| --- | --- |
| `pnpm contracts:check` | 检查生成漂移并校验契约 Schema/定义；适合作为只读一致性检查。 |
| `pnpm contracts:kotlin:check` | 检查 Kotlin 生成物、编译及合成 fixture；需要 JDK 17+ 和锁定工具链缓存，并会写 `.cache` 与 Kotlin 证据文件。 |
| `node scripts/check-c14-handoff.mjs --no-write` | 只读执行 C14 静态交接审查，不覆盖 C14 证据文件。 |
| `pnpm c14:handoff:check` | 刷新 C14 报告，会写 `docs/implementation/evidence/c14-handoff-results.json`。 |
| `pnpm c16:decision:check` | 刷新 C16 决策准入报告，会写 `docs/implementation/evidence/c16-decision-readiness-results.json`。 |
| `pnpm d:gate:check` | 刷新 D 关口报告，会写 `docs/implementation/evidence/d-gate-readiness-results.json`。 |

截至 2026-10-17，本轮 D02 预备制作只读复核未改写现有 evidence；新增唯一证据清单 `docs/implementation/evidence/d02-contract-snapshot.json`，任务卡和检查记录见 `docs/execution/tasks/D02.md` 与 `docs/execution/checks/D02-prep.md`。刷新其他证据应在获准更新证据的工作中进行，并保留执行时间、来源快照及哈希。

## 4. 版本与冻结前置

当前 `0.2.0` 是草案版本，不是冻结版本。任何冻结结论都必须绑定完整源/生成物哈希、兼容策略和签收记录；不能只凭版本字符串、文件存在、自动审查通过或报告生成时间推定。

冻结候选至少需要：

1. **A02 独立评审：** 评审范围、字段/操作、授权与同意、错误/拒绝、幂等、版本冲突、取消/重连/终态及兼容/迁移策略；记录评审者独立性、逐项结论、偏差和整改复核。
2. **C14 评审闭环：** 由独立评审者完成协议评审。自动审查的 9/9 通过不替代人工判断；安全、授权、媒体租约、流结束等阻塞偏差必须关闭并有证据。对供应商相关边界，取得 C12 结论，或明确将相应能力排除/延期且不将其描述为已支持。
3. **C16 决策边界确认：** Q-02、Q-05、Q-10、Q-11、Q-14 的适用业务范围、授权/留存边界和负责人输入得到确认；与契约相关的未决决定须明确解决或排除在冻结范围之外。
4. **版本快照与治理：** 对全部契约源、生成物、桥协议、fixture 和兼容说明计算 SHA-256，记录版本控制提交标识（如可用）、生成/校验结果、版本演进与兼容/弃用策略；评审后的任何源或生成物变化均触发影响分析和相应复核。
5. **签收权限：** 独立评审者、契约技术负责人、相关业务/安全决策责任人及有权限的 D 负责人分别在职责范围内签收；建议冻结不等于已冻结，D Go/No-Go 也不能由自动审计代签。

## 5. 真实后端边界与后续限制

真实 HTTP/SSE/WS 传输、服务端认证/鉴权执行、生产数据库、真实媒体中继及供应商接入**不属于 D02 的冻结交付，也不是仅因当前未接入就否决 D02 契约评审的理由**。D02 应交接接口要求、未验证假设和风险，不得将这些能力写成已实现。`docs/implementation/d-gate-readiness.md` 明确区分 D02 契约冻结与后端未接入的限制；D 负责人批准 Go/No-Go 前不得启动 E/F 的真实业务实现。

上述能力仍是后续 E 阶段实现与联调的限制：必须在获准启动后完成真实服务、权限/数据治理、媒体停止/租约、供应凭证与条款、环境和运行验证；C12 供应结论未完成时，不得宣称真实供应能力或锁定未经验证的供应商行为。这里登记的是后续交付限制，不是本地合成能力已通过的证据。

## 6. 独立评审与签收记录

以下表格待实际评审时填写；目前没有姓名、结论、签名或日期可登记。评审模板可参照 `docs/implementation/c14-independent-review-template.md`。

| 角色 | 评审/签收范围 | 姓名及独立性/权限依据 | 结论与未关闭偏差 | 整改复核证据 | 签名/正式记录 | 日期/时区 |
| --- | --- | --- | --- | --- | --- | --- |
| A02 独立契约评审者 | 操作、字段、授权、安全、错误、幂等、版本、流终止与兼容性 | 待填写 | □ 未评审 □ 通过 □ 有条件 □ 不通过 | 待填写 | 待填写 | 待填写 |
| C14 独立协议复核者 | C14 检查范围、C12 供应边界、偏差关闭与冻结建议 | 待填写 | □ 未评审 □ 通过 □ 有条件 □ 不通过 | 待填写 | 待填写 | 待填写 |
| C16 业务/产品决策责任人 | 相关 Q 决策及对接口范围、授权和留存的影响 | 待填写 | □ 未确认 □ 已确认；依据待填写 | 待填写 | 待填写 | 待填写 |
| 契约技术负责人（知悉） | 源/生成物清单、哈希、兼容策略与交接完整性 | 待填写 | □ 未核对 □ 已核对；意见待填写 | 待填写 | 知悉记录待填写 | 待填写 |
| D02 / D Go-No-Go 有权负责人 | D02 交接接受及 D 阶段/后续启动决定（权限范围内） | 待填写 | □ 未签收 □ Go □ No-Go；理由待填写 | 待填写 | 待填写 | 待填写 |

**冻结建议：** □ 尚无建议　□ 建议冻结　□ 有条件建议冻结　□ 不建议冻结　□ 无法作出建议

理由、所依据的完整版本/哈希快照及未决条件：待独立评审者填写。以上选项均未预选；当前不得表述为已冻结或已签收。

## 7. 当前状态与解除阻塞路径

截至本文件所依据的 2026-10-17 证据快照：

- **C14：** `success=true`、9 项检查通过，但 `status=draft_review_required`；A02 独立评审/冻结未完成，C12 真实供应凭证与质量/条款结论缺失。
- **C16：** `status=blocked`、`decisionState=unconfirmed`、`decisionReady=false`、`pilotEligible=false`；没有决策输入文件，Q-02/Q-05/Q-10/Q-11/Q-14 均未确认。
- **实施计划依赖：** WBS 将 D02 前置列为 B07/B10/C15/C16（FS），交付为 D 交接包/能力账本；验收条件包括无真实业务后端仍可完成交接、核心原生能力有结论，未过关不进入 E。相关前置须按项目计划完成，且不改变真实后端属于后续限制的判定。
- **D 关口：** `status=blocked`、`goNoGoEligible=false`、`eAfterDEligible=false`；D02 子项为 `blocked`，`contractsFrozen=false`。
- **判定边界：** D 关口报告列出的真实后端未接入应作为能力限制保留；D02 就绪说明明确它不是 D02 冻结前置。当前阻塞来自尚未完成的独立评审/冻结与 C16 边界确认；整体 D Go/No-Go 仍须满足其余 D 前置，不能由本文件单独解除。

**下一步：** 完成相关 C16 决策输入和签收；安排 A02/C14 独立评审并关闭偏差；复核 prep-01 快照与兼容策略并补充授权评审结论；对 C12 相关能力提供结论或明确延期范围；随后在可更新证据的流程中重跑相应检查并由授权人员签收。条件完成前保持 **blocked**，不伪造冻结，不启动 E/F。
