# 管理端图片问答接口

图片输入通过受限桌面端口调用真实 OpenAI 兼容网关。主进程读取外部加密配置；没有有效配置时仍返回 `model_not_configured`，不启用模拟答案。

## 已实现

- 图片与文字分别走独立应用端口；有附件时绝不回退文字演示。支持只发图片。
- PNG、JPEG、WebP，输入不超过 10MiB；宿主检查真实格式和解码尺寸，单边最多 4096、总像素最多 8,388,608。
- 当前图片仅在内存预览，替换、移除和离开页面释放对象 URL；发送失败保留图片和问题。不会自动归档图片问答或原图。
- 每次选图、取消或失败后的重新发送都要重新确认；没有确认、本机检测失败、敏感内容或安全未知均不调用模型。
- 主进程通过 Windows 本地 OCR/人脸检测，遮盖全部文字与人脸，仅向模型端口交付同一附件的脱敏 PNG，最大 2,000,000 字节。
- 停止、换图、移除、导航、管理窗关闭和进程退出均可中止；桌面供应请求超时 45 秒，前端保护超时 50 秒，拒绝迟到回答，错误不携带供应商异常正文。
- 未接模型时前端仅读取状态，不读取附件二进制、不把附件发送到 IPC，也不进行本地 OCR 或任何云端请求。

## 接入位置

应用端口及受限 IPC 类型：`packages/application/src/image-question.ts`。

桌面模型适配器接口：`apps/desktop/image-question.d.cts` 的 `ImageQuestionProvider`。只需实现：

```typescript
interface ImageQuestionProvider {
  answer(input: {
    requestId: string;
    question: string;
    image: { mime: 'image/png'; bytes: Buffer; width: number; height: number };
    signal: AbortSignal;
  }): Promise<{ text: string }>;
}
```

随后在 `apps/desktop/main.cjs` 创建服务的位置传入 `provider`：

```javascript
createImageQuestionService({ nativeImage: electron.nativeImage, provider });
```

`main.cjs` 已将 `ai-provider.cjs` 的真实适配器注入图片服务，并复用于文字问答与独立桌宠的只读教学。配置方法见 `real-ai-provider.md`。凭证只在主进程解密，不保存媒体、不记录问题/图片/密钥，不放入 Renderer、`VITE_*` 或 URL。网页和 Android 未安装此桌面 IPC 时明确不可用，不自动走其他上传路径。

## IPC

| 方法 | 输入 | 输出 |
| --- | --- | --- |
| `nuanbanImageQuestion.status()` | 无 | `{ available, reason }` |
| `nuanbanImageQuestion.answer(...)` | `{ requestId, question, image: { mime, bytes }, confirmed }` | `{ ok: true, requestId, text }` 或 `{ ok: false, requestId, code, retryable }` |
| `nuanbanImageQuestion.cancel(requestId)` | 当前请求 UUID | 是否已请求取消 |

接口只对受信管理窗口主框架开放，不对桌宠/子框架开放；调用不包含任意 URL、文件路径、供应商选项或系统操作指令。这是本机模型适配端口，不是新增的 `/v1` HTTP 服务接口，既有公共服务契约不变。

## 安全边界与未验收项

附件 ID 使用 `attachment:<requestId>`，不冒充屏幕来源、屏幕捕获许可或教学安全票据，也不调用桌宠教学接口。共享的是本地检测和保守安全策略，而非观察会话。

当前安全策略仍只正向准入已识别的设置/浏览器控件/编辑器控件场景。普通照片、画稿或其他无法确认安全的图片仍会阻断；未接模型不代表通用照片理解已经完成。不能为打开图片问答而放宽未知内容的关闭策略。

单元与界面测试使用合成图片、假本地检测和注入模型端口，不捕获真实屏幕、不打开麦克风、不上传用户图片。另外已向用户指定网关和模型发送最小文字、合成空白 PNG 连通性请求并收到有效响应；这不是 Windows 本地检测、真实设备通用图片理解或正式发布验收。本次不改写 D07 结论与其他验收证据。

## 专项验证

```powershell
pnpm typecheck
pnpm exec vitest run tests/domain/image-question.test.ts tests/platform/desktop-image-question.test.ts tests/platform/desktop-observation-source.test.ts tests/platform/desktop-observation-policy.test.ts tests/domain/conversation.test.ts
$env:PLAYWRIGHT_CHANNEL='chrome'
pnpm exec playwright test tests/e2e/image-question.spec.ts
```
