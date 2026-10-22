# 微光指引 · 本地敏感检测与逐帧门控样例

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

这是 C03 / NV-06 的本地策略层，不是 OCR、计算机视觉或人脸模型，也不接收真实屏幕像素。它用合成的 OCR 状态、文本风险、页面范围、第三方人脸数量和脱敏结果验证“检测失败不放行”的边界。

## 放行条件

每一张待外发帧都必须同时满足：

- 系统采集授权、用途同意、会话仍活动、目标仍授权；
- frame generation 与当前会话一致，帧没有未来时间或超过最大年龄；
- 检测器健康、页面属于已验证范围、OCR 已完成且置信度达到阈值；
- 风险文本为 `safe`；交易、私人、医疗、投资内容均暂停，不通过文字绕过画面熔断；
- 第三方人脸为零，或明确有 `applied` 的脱敏结果；
- 通过后才签发短时票据，票据绑定 `frame_id`、`frame_hash`、`generation`、`policy_version` 和授权目标。

任何未知、失败、超时、过期、错代际、票据篡改或脱敏失败都不会产生可外发票据。停止会关闭会话并递增代际；旧票据不能用于新帧。

## 复现

```powershell
pnpm privacy:c03:check
```

结果写入 `docs/implementation/evidence/privacy-c03-results.json`。当前测试只证明纯 TypeScript 策略边界；真实 OCR/模型评测、坏模型注入、第三方人脸检测质量、每帧原始内存生命周期和编码/发送端仍需后续 C04/E11/F07 方案与设备/模型资源。

`canSendFrame` 和 `SendingGate` 保留用于既有教学模拟；新增 `evaluateLocalFrame`、`FrameSafetyGate` 和短时 `SafetyTicket` 用于 C03 的逐帧门控，不提供自动点击、上传或媒体发送 API。
