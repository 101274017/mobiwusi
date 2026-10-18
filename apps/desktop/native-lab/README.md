# C02 Windows 独立原生验证样例

日期：2026-10-16。对应实施计划 C02 / NV-03 的**预备样例**，不是桌面捕获或多屏验收完成项。原始三份需求/方案/计划文档保持不变；D 未批准，E/F 不启动。

## 边界

- 独立目录和独立包，不进入正常 `@nuanban/desktop` 演示包；正常宿主仍保持 `externalCapture:false`、`nativeOverlay:false`。
- 固定合成窗口标题为「暖伴 C02 · 固定合成窗口」，只含 `NUANBAN-C02-SYNTHETIC` 标记、本地按钮和固定说明。样例不枚举其他窗口，不读取桌面，不接受文件，不打开链接。
- 控制页要求操作者勾选本次用途说明并点击开始；没有自动启动 `getDisplayMedia`。正常手动模式只允许宿主自己的合成窗口来源，禁止音频；没有 `desktopCapturer.getSources()`、摄像头/麦克风、编码器、WebRTC、文件写入或网络出口。
- 通过可选浮层只验证原生窗口配置：橙色标记窗口 `setIgnoreMouseEvents(true, { forward: true })`，停止按钮是单独的可点击置顶窗口。自动测试不会把配置当作触摸穿透已验证。
- 所有停止先递增 generation 并关闭代际，再停止轨道、等待页面确认；迟到回调不能重启旧会话。移动/缩放/隐藏合成窗口、显示器变化、锁屏/挂起、渲染进程退出都会保守停止。
- 帧只使用视频回调的序号和尺寸元数据；控制页没有像素读取、`MediaRecorder`、`RTCPeerConnection`、`fetch` 或保存/上传入口。`requestVideoFrameCallback` 的计数不是安全检测，也不是已发送帧证明。

## 命令

在项目根目录执行：

```powershell
pnpm desktop:lab:check
pnpm desktop:lab:package
pnpm desktop:lab
```

- `desktop:lab:check` 使用锁定的 Electron 44.7.2 隐藏运行 12 项检查：无自动桌面捕获请求、sandbox/隔离、合成窗口渲染、DIP 往返、透明窗口渲染、停止代际和错误观察器。它只使用隐藏窗口与 canvas 合成轨道，证据中的 `realDisplayMediaRequests` 必须为 `0`。
- `desktop:lab:package` 不下载运行时，使用本机缓存的 Electron ZIP 生成未签名 Windows x64 调试包，并比较 ASAR 的 16 个源文件（`package.json` 允许 Forge 的标准清理，只比较关键字段）。
- `desktop:lab` 打开源目录验证页；只启动应用，不自动勾选说明、不自动开始捕获。关闭验证程序即可结束实验。

包输出：`apps/desktop/native-lab/out/NuanbanC02Lab-win32-x64`。必须连同目录使用，不能只复制 exe；包是调试/未签名产物，不是发布安装器。

## 人工验证记录

人工验证只能使用本机合成窗口，不得打开真实聊天、支付、验证码、账号或含第三方隐私的窗口。每次记录 Windows 版本、Electron 版本、显示器布局、各显示器缩放、包 SHA-256、开始/停止时间、状态和缺陷号；不保存采集帧。

1. 启动 `pnpm desktop:lab`，点击「显示合成测试窗口」，确认只出现固定合成内容。
2. 不勾选说明直接点开始，确认不触发捕获；勾选说明后再点击开始，确认控制页显示仅合成窗口、无音频，并有可见停止入口。
3. 可选勾选浮层。用合成按钮人工核验标记遮挡与停止按钮；只记录“配置已呈现/底层按钮是否可点击”，不得把自动化 screenshot 当作穿透通过。
4. 使用控制页「停止」、浮层停止、捕获轨道结束和关闭合成窗口分别停止；确认不自动恢复，旧会话迟到回调不增加有效帧。
5. 使用显示卡片移动合成窗口；确认当前采集先停止，再移动，不复用旧坐标。真实多屏需至少一台负坐标显示器和不同缩放显示器。
6. 在混合 DPI、负坐标、旋转/显示设置变化、锁屏/唤醒和强制结束进程下重复；记录停止延迟、系统状态、是否仍有窗口/轨道和清理结果。

## 当前证据与未决项

2026-10-16 本机已有：74 项策略/坐标/边界测试、隐藏 Electron 12 项检查、控制页 1160/760 DIP 截图、合成 canary 截图、当前显示器的 DIP→物理像素→DIP 往返记录，以及离线未签名 Windows x64 包。自动检查没有请求真实桌面媒体（`displayRequestCount=0`），这正是安全边界，不是捕获通过证明。

仍未完成 NV-03：真实 `getDisplayMedia` 系统权限/来源体验、两个或以上显示器、负屏幕坐标、混合 DPI、真实置顶与触摸穿透、窗口移动后的内容标定、受保护窗口和独立人工复核。当前桌面只有本机可见的一个显示器记录；不要用单显示器的几何往返替代多屏验收。

证据：`docs/implementation/evidence/desktop-lab-smoke.json`、`desktop-lab-package.json`、`desktop-lab-smoke.txt` 和 `screenshots/desktop-lab-*.png`。当前 `actualDisplayCaptureVerified`、`mousePassThroughVerified`、`mixedDpiMovementVerified`、`negativeOriginMovementVerified`、`independentAcceptance` 均为 `false`。
