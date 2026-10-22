# D06 媒体/供应能力结论交接

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-17（Asia/Shanghai）。本文件对应实施计划 D06「媒体/供应能力结论交接」，用于交接 C03/C04/C12 的本机合成证据、能力边界和真实验证缺口。它不是生产媒体或供应接入报告，不构成 NV、D 或 Go/No-Go 签收。

## 计划位置与结论摘要

- 实施计划将 D06 排在 W9，计划历时 1 周、主责角色 I、估算 1 人日；前置为 B07/B10/C15/C16（FS）。交付是 D 交接包/能力账本中的媒体与供应结论复核；验收要求无真实业务后端可运行且核心能力结论可追溯，未过关不得进入 E。
- 当前可交接的是**安全策略和失败边界的合成证明**：C03 能签发并复核绑定当前帧的短时安全票据，C04 能把安全票据接入有界内存 relay，C12 能在合成凭证夹具下重放供应事件、取消和回退。
- 当前不可交接为真实能力：没有真实屏幕/音频采集、OCR/人脸模型、真实编码器、WebRTC/网络中继、可达接收端、供应商调用、真实凭证、区域价格配额或供应数据保留/合同结论。
- 当前硬边界是**不连接真实供应、不读取真实密钥、不发起网络请求、不伪造凭证或成功结果**。合成测试通过不能升级为真实供应通过。
- D06 当前判定为 `blocked`；对应 D 预备状态为 `acceptance=preparatory_not_accepted`、`goNoGoEligible=false`、`eAfterDEligible=false`，E/F 均未启动。

## 合成能力边界

| 能力层 | 当前已证明的合成行为 | 明确不代表 |
| --- | --- | --- |
| C03 / NV-06 本地检测门控 | 只接受严格的合成帧元数据；系统授权、当次同意、会话、目标授权、代际、帧时效、检测健康、已验证页面、OCR 完成、置信度、人脸脱敏和风险均满足时才允许签发票据。未知、失败、超时、过期、错代际、风险帧或脱敏失败均暂停/拒绝；票据绑定 `frameId`、`frameHash`、`generation`、`policyVersion` 和短时有效期。 | 真实 OCR、计算机视觉/人脸模型质量、屏幕像素生命周期、设备授权、漏检/误停率或真实发送前检测质量。 |
| C04 / NV-07 受控媒体出口 | `ControlledMediaRelay` 只消费 C03 安全票据和最小合成元数据；安全帧进入有界队列后才调用注入的编码器，并把同一安全 artifact 依次送往 AI、家属两个本地出口。停止会关闭门控、递增代际、清理队列；迟到编码结果、旧票据、伪造绑定、出口失败和队列溢出均不会越过安全边界。 | 真实视频/音频编码、`MediaRecorder`/原生编码器、WebRTC、ICE/TURN、HTTP/SSE/WS、中继服务、网络传输、接收端可达性、抓包、长时性能或已发帧撤回。 |
| C12 供应沙箱 | 覆盖 `carrier_auth`、`face_auth`、`multimodal`、`asr`、`tts`、`pet_generation` 六类供应能力；可重放成功流、`started → delta → completed` 顺序、取消、无 SIM、活体失败、ASR 无结果、TTS 超时、限流、供应不可用和生成质量不足回退。无有效凭证时返回 `blocked`，不产生供应事件。 | 真实运营商/人脸/活体/AI/ASR/TTS/生成调用、真实响应质量、真实首片段或取消延迟、真实资产许可、真实计费和生产可用性。 |

### 安全输出形态

- C03 的决策、票据和 C04 的编码器输入不含原始 OCR 文本、像素、媒体轨道或 raw track；C04 的合成编码类型固定为 `synthetic-redacted-metadata`，canary 为 `NUANBAN-C04-SYNTHETIC`。
- C04 的两个出口是 `InMemoryMediaReceiver`，只在本机内存记录合成 artifact；AI 出口发送后若发生风险/停止，家属出口也必须被同一 stop fence 阻断。
- C12 的每个结果固定 `networkAttempted: false`、`rawPayloadsRetained: 0`；这证明沙箱没有副作用，不证明真实供应具备同样行为。

## 零网络访问边界

当前 C03/C04/C12 只允许本地合成执行：

- `packages/media-relay` 不接收原始屏幕轨道，不调用摄像头/麦克风，不创建 `MediaRecorder`、WebRTC、`RTCPeerConnection`、`WebSocket`，也不执行 `fetch` 或其他网络请求。
- `packages/provider-sandbox` 不读取环境变量或密钥文件，不发起 HTTP/SSE/WS 请求，不调用真实供应商，不保留原始音频、图像、视频、模型载荷或供应商响应。
- 当前记录中的凭证仅是 `synthetic_fixture` 或受控引用的元数据；本任务不创建、连接或写入真实供应凭证。凭证缺失时必须保持 `blocked`，不能用示例引用伪造成功。
- “零网络”是当前验证范围的硬限制和安全不变量，不是对未来真实网络接入、WebRTC 中继或供应商行为的能力承诺。任何真实验证都必须在授权、区域、数据处理和独立复核条件满足后另行执行。

## 当前证据与复现

| 证据 | 复现命令 | 当前可核对结果 | 结论层级 |
| --- | --- | --- | --- |
| `docs/implementation/evidence/privacy-c03-results.json` | `pnpm privacy:c03:check` | 4 个测试套件、52/52 通过；覆盖本地门控、票据绑定、过期/撤权/代际和原始 OCR 不外发 | 本地策略合成证据；不是 NV-06 真实通过 |
| `docs/implementation/evidence/media-c04-results.json` | `pnpm media:c04:check` | 3 个测试套件、15/15 通过；覆盖安全帧、双出口、队列、停止竞态、旧代际和出口失败 | 内存 relay 合成证据；不是 NV-07 真实通过 |
| `docs/implementation/evidence/c12-sandbox-results.json` | `pnpm c12:sandbox:check` | 2 个测试套件、14/14 通过；范围文件记录 11/11 合成场景检查通过，`realCredentialState=missing` | 供应沙箱预备证据；范围状态为 `preparatory_not_accepted` |
| `docs/implementation/evidence/c15-nv-readiness-results.json` | `pnpm c15:nv:check` | 证据文件可解析、审计完成；相关 NV-06/NV-07/NV-11/NV-12 仍为 `blocked`，未达到独立复核就绪 | 准入审计，不是媒体/供应验收 |
| `docs/implementation/evidence/d-gate-readiness-results.json` | `pnpm d:gate:check` | D06 `blocked`；合成媒体成功但真实凭证缺失；D 总体未获 Go/No-Go 资格 | D 关口预备判定 |

如需只读核对 C15 文件而不更新报告，可使用：

```powershell
node scripts/check-c15-nv-readiness.mjs --no-write
```

上述命令均只重放本地测试、审计或文件检查；在本任务范围内不得改为真实供应调用，也不得为了让命令通过而填入凭证、网络结果或设备结果。

## 真实验证矩阵

以下是解除 D06 阻塞所需的真实证据矩阵。每条记录都应包含 C15 要求的日期和时区、构建/包哈希、设备型号/系统/DPI、用例和合成材料哈希、权限与当次同意、步骤/预期/实际、帧/编码/发送/接收/缓存计数、截图或视频引用、限制、执行者和独立复核者；不得写入真实密码、验证码、银行卡、私人聊天或儿童原始素材。

| 验证单元 | 当前状态 | 真实证据必须补齐 | 解阻条件 |
| --- | --- | --- | --- |
| C03 / NV-06：逐帧检测与脱敏 | 只有本地合成门控；无真实帧和模型 | 目标 Android/Windows 设备授权；真实屏幕帧；OCR/风险/人脸模型版本；安全、未知、交易/私人/医疗/投资、超时、坏模型、第三方人脸和脱敏失败逐帧记录；拒绝/暂停计数 | 未判安全不编码、不发送；失败/未知保守暂停；票据与实际帧、代际、策略和目标授权一致；完成独立隐私复核 |
| C04：真实编码入口 | 当前编码器是注入的合成函数，artifact 不是媒体字节 | 真实编码器/输入格式、编码前门控记录、编码帧数/字节/时间、失败和停止计数；证明编码器入口没有 raw track、像素或未脱敏输入 | 每帧先通过 C03；编码器输入与安全票据绑定；无门控绕过；异常停止不自动恢复 |
| C04：WebRTC/中继传输 | 未创建 WebRTC 或网络中继 | 经批准的真实端到端拓扑；offer/answer、ICE/连接状态、候选和中继配置、发送/接收包与字节计数、丢包/重连/停止记录；必要时提供抓包或等价传输证据 | 仅发送已编码安全媒体；停止/撤权后无新发送；旧代际不能重用；传输、日志和抓包不泄露原始敏感内容 |
| C04：AI/家属接收端 | 只有本地内存接收器，无接收端 canary | AI 与家属两个真实接收端的 canary、接收计数、顺序/代际、延迟、断线和失败记录；AI 发送后触发停止时家属端不得继续接收 | 双出口均能收到同一安全 artifact；停止、风险、撤权、锁屏/退出和接收端失败路径可复现；已发帧不可宣称可撤回 |
| `carrier_auth` | 只有无 SIM/替代登录夹具 | 受控真实凭证、可审计区域、一次性 nonce、回调验签、防重放、失败与 `device_binding` 回退；区域、价格、额度和合同/数据处理条款 | 凭证由受控渠道提供且未写入仓库；服务端证明、nonce 和回调验签可核对；失败不创建会话；供应与条款经独立复核 |
| `face_auth` | 只有无效证明/家属认领夹具 | 真实活体/人脸服务证明、绑定关系、低光/无相机/拒绝/撤权/重放 proof 记录；数据保留、删除和合同条款；`family_claim` 回退 | 真实证明与防重放可核对；撤回同意立即关闭出口；不以设备解锁或本地模拟替代服务端人脸验收 |
| `multimodal` | 只有合成流、取消、限流和供应不可用 | 受控模型端点凭证、区域、模型/内容条款、价格和配额；首片段时延、事件顺序、取消延迟、断线、限流、成本和原始载荷留存记录 | 用户停止或风险暂停后无新句段；真实响应、账单/额度和条款与供应记录一致；无原始响应留存超出批准范围 |
| `asr` | 只有无结果到文字回退 | 音频用途同意、语言/时长边界、首结果/空结果/噪声/超时/取消质量、价格/配额、删除条款和停止后的迟到结果处理 | 停止录音后不提交新音频帧；迟到转写丢弃；无结果回退文字；区域、计费和删除条款可审计 |
| `tts` | 只有超时到纯字幕回退 | 句段接口、播放位置、字符/时长价格与配额、超时/失败/静音/重复播报、取消和字幕一致性记录 | 取消后不继续播放旧代际；超时稳定回退 `captions_only`；数据用途和保留条款已复核 |
| `pet_generation` | 只有取消、质量阈值和保留旧 2D 资产 | 真实生成凭证、区域/价格/配额、内容审核、资产许可、分层完整性、动作覆盖、相似性、取消延迟和质量评分；迟到资产处理 | 取消后迟到资产不能应用；质量不足保留现有 2D；许可、审核、成本和保留条款均有记录 |
| 供应总账与复核 | C12 `realCredentialState=missing`；C16 决策未确认 | 每类供应的凭证引用状态、有效期、授权人/范围、区域、价格/配额、数据用途/TTL/删除、合同版本、回调验签和独立复核记录；秘密只留受控系统 | 真实凭证和条款经授权复核；C15 相关 NV 达到 `ready_for_independent_review` 后完成独立签收；再重跑 D06/D07 |

## 待验条款与交接动作

以下项目在当前 D06 中保留为 `待验`，不能用 Mock、合成夹具、静态源码或文件存在性关闭：

1. **媒体实现**：真实编码格式和参数、WebRTC/中继拓扑、接收端 canary、包/帧/缓存计数、停止与撤权后的无新发送、丢包/重连/长时性能。
2. **供应凭证**：运营商、服务端活体/人脸、模型、多模态、ASR、TTS、生成能力的真实授权状态；凭证来源、范围、有效期和轮换记录必须走受控渠道，不能写入仓库或证据文件。
3. **区域、价格与配额**：每类供应实际可用区域、计费单位、免费/付费额度、限流、超额行为、峰值并发、取消是否计费以及预算上限。
4. **数据保留与合同**：原始音频/图像/视频、模型请求/响应、日志、备份、训练用途、删除 SLA、跨区域处理、子处理方、回调验签和合同版本；Q-10/Q-15 未确认前不开展真实敏感数据处理。
5. **质量与独立复核**：真实音频/活体/流式首片段/取消延迟/生成资产质量、失败回退和安全副作用，均需真实记录、限制说明和独立复核；自动测试通过只表示本机策略可重放。

资源和授权到位后的顺序应为：受控申请与条款审阅 → 不含秘密的凭证状态登记 → 真实设备/接收端小范围验证 → 完成 C15 逐项记录和独立复核 → 更新能力账本与 D06/D07 判定。未完成前仅可继续维护合成测试、Schema、Mock 和证据元数据。

## 当前 blocked 判定

- **C03**：52/52 自动测试通过，但证据范围仍是合成输入和 TypeScript 门控；没有真实 OCR、人脸模型、设备帧、编码器、网络发送或独立隐私复核。
- **C04**：15/15 自动测试通过，但实现是本地内存 relay；没有真实编码器、WebRTC、网络接收端、AI/家属接收 canary、抓包或独立媒体安全复核。
- **C12**：14/14 自动测试通过，11 个合成场景检查通过；真实凭证缺失，`status=blocked`、`realCredentialState=missing`、`productionReady=false`，范围状态为 `preparatory_not_accepted`。
- **C15**：相关 NV-06、NV-07、NV-11、NV-12 仍为 `blocked`；审计/证据质量通过只表示文件可解析和限制可追踪，不表示设备、供应或独立复核已通过。
- **D06/D 关口**：D06 的机器判定为 `mediaSyntheticSuccess=true`、`c12Status=preparatory_not_accepted`、`realCredentialState=missing`，因此 D06 保持 `blocked`。D 总体 `goNoGoEligible=false`、`eAfterDEligible=false`，不得启动 E/F。

交接结论：**可以交接合成安全边界、可复现命令和真实验证清单；不能交接真实媒体/供应能力，当前保持 `blocked`。**

## 依据索引

- `packages/privacy/README.md`、`packages/privacy/src/index.ts`、`tests/privacy/c03-gate.test.ts`：C03 逐帧门控、票据和最小外发边界。
- `packages/media-relay/README.md`、`packages/media-relay/src/index.ts`、`tests/privacy/c04-media-relay.test.ts`、`docs/implementation/evidence/media-c04-results.json`：C04 有界内存 relay、双出口、停止竞态和合成限制。
- `packages/provider-sandbox/README.md`、`packages/provider-sandbox/src/index.ts`、`tests/provider/provider-sandbox.test.ts`、`docs/implementation/c12-supplier-sandbox.md`：C12 六类供应能力、凭证门控、取消/回退和零网络/零留存不变量。
- `docs/implementation/evidence/privacy-c03-results.json`、`docs/implementation/evidence/c12-sandbox-results.json`、`docs/implementation/evidence/c12-sandbox-scope.json`：合成测试计数、凭证状态和范围限制。
- `docs/implementation/c15-nv-evidence-protocol.md`、`docs/implementation/evidence/c15-nv-readiness-results.json`、`docs/implementation/d-gate-readiness.md`、`docs/implementation/evidence/d-gate-readiness-results.json`：真实验证字段、NV 阻塞语义和 D06 当前判定。
- `docs/implementation/verification.md`、`暖伴AI公益助手-项目实施计划.md`：C03/C04/C12 的计划边界、D06 交付要求和禁止把合成证据写成真实验收的项目基线。
