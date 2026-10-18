# C12 供应沙箱预备层

`ProviderSandbox` 是认证、语音、多模态和可动 2D 桌宠生成的本地合成验证层。它只验证凭证门控、事件顺序、取消、失败回退、质量阈值和安全留存边界，不读取真实密钥、不访问网络、不调用真实供应商。

## 覆盖范围

- 运营商 token 兑换：无 SIM 时阻塞并回退到设备绑定路径。
- 服务端人脸/活体：证明失败时拒绝并回退到家属认领。
- 多模态流式回答：验证 `started → delta → completed`、停止取消、限流和供应不可用。
- ASR/TTS：验证无结果回退到文字、超时回退到纯字幕。
- 可动 2D 桌宠生成：验证取消不应用迟到结果，质量不足保留现有 2D 资产。

所有结果都携带 `networkAttempted: false` 和 `rawPayloadsRetained: 0`。没有有效的受控凭证引用时，沙箱返回 `blocked`，而不是伪造成功。

## E08/E11/E12 编排层

- `ProviderOrchestrator` 通过可替换 `ProviderAdapter` 接口统一多模态、ASR、TTS 和生成任务的开始、增量、完成、失败与取消终止事件。
- 新 generation 会取消旧适配器；超时、适配器异常、坏响应和不完整终止事件均默认拒绝，不把异常标记为成功。
- `LocalPolicyGate` 对未知、坏、超时模型和未知/受限风险默认拒绝；策略模型只接收受控请求，不保存原始载荷。
- `ProviderUsageLedger` 预留并发请求的最小用量，统计配额、成本、失败原因、超时、连续故障和熔断状态；超额只降级或阻塞，不引入收费解锁。
- 适配器默认只能使用合成模式；声明 `mode: 'network'` 的适配器在本地验证中直接返回 `NETWORK_DISABLED`，不调用执行函数。

## 复现

```powershell
pnpm c12:sandbox:check
```

结果写入 `docs/implementation/evidence/c12-sandbox-results.json`；范围与限制见 `docs/implementation/evidence/c12-sandbox-scope.json` 和 `docs/implementation/c12-supplier-sandbox.md`。

## 尚未完成

当前验证使用合成夹具，真实凭证仍缺失。因此不能据此宣称认证、活体、ASR、TTS、多模态或生成服务已接入。真实供应验证还需要区域、价格/配额、数据保留、合同条款、回调验签、首片段时延、取消延迟、音频/活体/生成质量以及独立复核证据；本包只提供 E08/E11/E12 的本地编排和安全边界，真实供应接入仍保持 `blocked / preparatory_not_accepted`。
