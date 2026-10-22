# 微光指引 · 服务契约草案与交接边界

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

当前版本：`0.2.0`，61 个操作、127 个服务定义。它是 A02/A03/A10 的可执行评审来源；C14 自动技术冻结不等于独立人工协议签收、真实供应接入或 D07 正式批准。

## 单一来源与生成

- `src/spec/primitives.ts`：版本、UUID、时间等原语。
- `src/spec/models.ts`、`events.ts`、`errors.ts`：业务 DTO、wire 事件和错误。
- `src/spec/operations.ts`：HTTP/流/信令操作及授权、幂等、版本等元数据。
- `src/spec/standalone-guidance.ts`：独立桌宠同帧分析的严格请求、四种结果、复习建议与错误形状；JSON Schema 不证明本地检测可信、真实脱敏质量、本人同意或提醒送达。
- `src/spec/catalog.ts`：统一定义目录和服务 Schema。
- 在项目根目录执行 `pnpm contracts:generate`，生成 `openapi.json`、`src/types.generated.ts`、`kotlin/src/main/kotlin/org/nuanban/contracts/ServiceDtos.generated.kt`、`ContractRules.generated.kt` 和相关 Schema；不要手改生成文件。
- `src/active-bridge.ts` 单独定义当前活动桥请求与 Android 回复：能力查询、停止，以及受限提醒排程/取消/到期操作；生成 `bridge.schema.json`、`android-bridge-reply.schema.json`，不引用未来宽桥 DTO 授权其他原生方法。
- `pnpm contracts:check` 检查 TS/Kotlin/OpenAPI/Schema 生成漂移、6 个 Schema、127 个服务定义的编译。`tests/contract` 覆盖定义夹具、分支、操作元数据、非法字段、生成器不支持特性和适配边界。测试夹具为合成数据，不证明真实服务可用。

独立 `POST /v1/standalone/guidance/analyze` 使用真实 Bearer 账号会话鉴权；关联头可省略，由服务端补 UUID；它是只读按需分析，不要求幂等头，也不代表旧操作的幂等要求可以删除。只有 completed 可附 AI 复习建议；本机仍须用当前新帧核验完成，本人确认后才能创建提醒。服务端无供应配置返回 503，不返回演示答案。

## Kotlin 生成与对照验证

Kotlin DTO 使用 data class、字符串 enum 与 sealed 联合；必填可空字段为无缺省值的 `T?`，可缺省字段用 `OptionalField.Absent/Present<T>` 明确区分缺失与显式 null。固定字面值只提供只读属性。整数采用 Long 并执行 Schema 的 JavaScript 安全整数边界，构造/解码/编码都校验约束；业务字段不以宽松 JSONObject 或 Any 代替。

解析边界的 `fromWire(Any?)` 只接受已解析的 Map/List/标量，先严格校验再生成强类型 DTO；`toWire()` 返回可供宿主 JSON 编码的结构。未知字段、错误类型、非法 enum/字面值、依赖字段、数组/长度/范围、UUID、日期/时区和联合分支都不能静默忽略。尚未实现真实 HTTP/SSE/WS 解析及调用。时区由 JDK/Android 的 IANA 数据验证，具体支持仍需目标设备与时区库版本验证。

生成器对当前 Schema 使用的关键约束有显式映射；新出现的不支持关键字、格式、类型或命名碰撞直接失败，不降低 Schema 严格度。当前 JVM 对照覆盖全部 118 定义，7,631 个 Ajv 判定正反例，其中 1,247 个有效 DTO 往返、6,384 个拒绝用例；另有 28 个当前活动桥请求/回复对照和 3 个强类型边界检查。夹具按组拆分以避开 JVM 单类字节码上限，不减少测试范围。

在 Windows 执行 `pnpm contracts:kotlin:check`。需要本机 JDK 17+ 和锁定 Kotlin 2.2.20 Android 工具链缓存；脚本不下载新依赖，支持 `-JavaHome`，缺缓存时明确失败。证据写入 `docs/implementation/evidence/kotlin-results.json`、`kotlin-fixtures.json`、`kotlin-compile.txt`，含源文件哈希。Android 工程已包含这些 Kotlin 源码并通过编译；这不是 WebView 真机运行或真实服务验收。

## 已表达的约束

草案覆盖账号/挑战/认领、关系/授权、会话/事件、二进制媒体、教学、笔记/复习、待办/回执、桌宠任务/资产、清单、同步/冲突、协助/信令、安全/统计、配置与语音帧。严格拒绝未声明字段，校验 UUID、日历时间与 IANA 时区；声明 X-Request-ID、变更 Idempotency-Key、版本条件和分页游标。具体操作以源文件元数据为准，不把元数据当作已生效的服务端鉴权/幂等实现。

## 兼容与适配

- `src/index.ts` 中原有内部 `ConversationEvent` 供本机 Mock 使用，不等于完整 wire SSE 事件；两者必须通过 `packages/api-client/src/mappers.ts` 的显式校验/映射边界转换。
- wire 错误信封使用 `schema_version`。本机历史 ID/错误类型的兼容边界不意味着 wire 可以接受非 UUID 标识。
- 笔记/待办映射保留 owner、version、时间与删除标记，拒绝错账号、降版本、非法时间。未知家属 scope 不得自动映射为写权限。
- `BridgeRequestV1` 是未来桥接 DTO 草案，不是当前宿主授权清单。现有活动桥只开放能力查询、停止和受限提醒操作；捕获、浮层、媒体与系统通知保持未验证/关闭。
- Electron `nuanbanHost` 与 Android `nuanbanBridge` postMessage 已有安全适配代码。Android 仅允许本地 appassets HTTPS 主框架：严格关联 ID/安全整数代际、请求超时、停止取消旧请求、重复 ID 拒绝及 pagehide 清理。原生接收端不用 optInt/optString 强制转换类型，拒绝超长/额外字段与未来宽桥方法。关联 ID 收紧为 1～128 个 ASCII 安全字符，缺省使用随机 UUID；该开发协议收紧仍需独立兼容评审。
- Android onPause/onDestroy 通知页面按锁屏/进程终止信号停止且不自动恢复；宿主停止失败有明确“未确认”提示。浏览器同源通道模拟与 Kotlin 对照通过，不等于 Android WebView/系统生命周期真机通过，所有高风险能力仍为 false。

## 尚待完成

1. A02：独立评审操作/字段、授权、错误、取消/重连、版本和兼容策略，并冻结基线。
2. A03/A10：已具备 TS/Kotlin 生成与 JVM 对照证据；仍须独立复核、目标设备验证和冻结后的正式契约发布。
3. C12/C14：取得真实供应沙箱结论与后端交接评审；当前无真实 HTTP/SSE/WS 服务链路。C14 草案与自动审查见 `docs/implementation/c14-backend-handoff.md`、`docs/implementation/evidence/c14-handoff-results.json` 和 `pnpm c14:handoff:check`。
4. B/C 证据齐备后进行独立 D Go/No-Go；只有批准后才进入 E 真实后端与联调，不借契约草案提前宣布实现。
