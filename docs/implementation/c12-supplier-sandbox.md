# C12 认证、语音与生成供应沙箱

更新日期：2026-10-16（Asia/Shanghai）。本文件对应实施计划 C12「认证/语音/生成供应沙箱验证」。它是本地合成验证与缺口报告，不是供应商接入、真实认证、真实 AI 服务或合同验收。

## 目标与边界

C12 先验证真实接入前必须固定的安全边界：凭证是否可用、流式事件能否取消、ASR 无结果和 TTS 超时如何降级、活体/认证失败如何拒绝、无 SIM 如何替代登录、生成任务如何取消与回退，以及配额/限流/供应不可用时不误报成功。

当前 `ProviderSandbox` 只接受合成夹具或受控凭证引用元数据。它不读取环境变量或密钥文件，不发起 HTTP/SSE/WS 请求，不保留原始音频、图像、视频、模型载荷或供应商响应。

## 能力矩阵

| 能力 | 合成验证 | 失败/降级边界 | 真实缺口 |
| --- | --- | --- | --- |
| 运营商认证 | token 兑换门控、无 SIM | `device_binding` | 运营商区域、回调验签、nonce、防重放、价格与合同 |
| 服务端活体/人脸 | 证明失败 | `family_claim` | 真实活体质量、绑定关系、数据保留与服务端证明 |
| 多模态流式 | 事件顺序、取消、限流、供应不可用 | `text_input` | 首片段时延、内容条款、配额、成本与取消延迟 |
| ASR | 无结果 | `text_input` | 音频用途、语言/时长、删除条款与计费 |
| TTS | 超时 | `captions_only` | 句段接口、播放位置、字符/时长计费与静音策略 |
| 可动 2D 生成 | 取消、质量阈值 | `keep_existing_2d` | 分层完整性、动作自然度、资产许可、审核、成本与任务取消 |

## 当前证据

`pnpm c12:sandbox:check` 覆盖合成成功、流式取消、ASR 无结果、TTS 超时、活体证明拒绝、无 SIM、生成取消、生成质量不足、限流、供应不可用和缺少凭证，共 11 个场景检查。测试通过只代表本地策略可重放；报告的总状态仍为 `blocked`，因为真实授权凭证缺失。

证据文件：

- `docs/implementation/evidence/c12-sandbox-results.json`：Vitest 可重放测试结果。
- `docs/implementation/evidence/c12-sandbox-scope.json`：范围、凭证状态、网络/留存不变量和限制。
- `packages/provider-sandbox/src/index.ts`：合成沙箱实现与能力矩阵。
- `tests/provider/provider-sandbox.test.ts`：凭证、取消、失败回退和报告测试。

## 准入结论

- C12 合成沙箱边界：可验证，通过。
- C12 真实供应验证：阻塞，`realCredentialState=missing`。
- 生产就绪：否；不能把 `syntheticChecksPassed=true` 解释为真实供应通过。
- 在凭证、区域、价格/配额、数据保留和合同条款完成受控评审前，不启动真实 E01、E08、E09，也不越过 D 关口。
