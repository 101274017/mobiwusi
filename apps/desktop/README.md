# Windows Electron 宿主

在仓库根目录运行 pnpm desktop。默认载入本地构建，不接业务后端。

- renderer 禁用 Node，开启 contextIsolation / sandbox / webSecurity。
- preload 仅暴露能力查询、停止和受限提醒仓储方法；主进程核对主窗口和主 frame 来源。
- 主进程用 `lifecycle.cjs` 合并 IPC 停止、窗口关闭、`before-quit` 和 `render-process-gone` 清理请求；渲染器收到退出/窗口移动事件后进入共享生命周期预备清理链。
- 禁止新窗、页面外跳、嵌套 webview 和系统媒体权限，CSP 阻断外部网络。
- 正常 Windows 演示主窗口不等于原生浮层；没有截屏、隐私检测、SQLite 整库加密、系统通知、3D 或 WebRTC。提醒 payload 在 Electron `safeStorage` 可用时单独加密，不能据此宣称整库加密。C02 验证样例是独立目录和独立包，不改变正常宿主能力。
- `reminder-store.cjs` 在 Electron 主进程使用内置 SQLite 保存本地提醒，当前 schema 为 `v2`，支持 v1→v2 迁移、回执/完成/取消时间持久化和回执时间顺序保护，并通过受信任 IPC 提供排程、取消、回执和完成状态；不执行系统通知或后台调度。
- `notification-adapter.cjs` 是显式调用的桌面通知预备适配器：只在注入的 Electron `Notification.isSupported()` 和权限均明确可用时创建通知，记录 `submitted`/`delivered`/`opened`/`failed` 回执，并只打开受限 `nuanban://review/...` 或 `nuanban://todo/...` 深链；已通过 `reminder-notification-bridge.cjs` 在主进程受限装配；主进程当前将权限报告为 `unknown`，不会实际创建系统通知，不能替代系统后台调度证据。
- 根目录运行 `pnpm desktop:reminder-store:check` 可复现 9 项桌面仓储测试，结果见 `docs/implementation/evidence/desktop-reminder-store-results.json`。
- 根目录运行 `pnpm desktop:notification:check` 可复现 9 项桌面通知相关预备测试（5 项适配器、4 项主进程提醒桥），结果见 `docs/implementation/evidence/desktop-notification-adapter-results.json`。
- pnpm --filter @nuanban/desktop package 只生成开发包，签名和正式发布未验收。

## 可复现开发打包

根目录运行 `pnpm desktop:package`：先构建共享 UI，再使用已安装且版本匹配的 Electron 本机分发文件创建 ZIP 缓存，交给 Forge 打包，不在打包阶段重复下载运行时。首次安装依赖仍需确保 Electron 二进制可用。

项目 `.npmrc` 使用 Forge 要求的 hoisted 依赖布局；只影响当前工程，不修改全局 pnpm 配置。本机缓存位于根目录 `.cache/electron`，已忽略。`pnpm install --offline --frozen-lockfile` 已在本机缓存条件下执行成功。

宿主运行时只依赖 Electron/Node 内置模块，UI 已打成静态资源，因此打包明确排除 node_modules，并关闭不必要的依赖裁剪扫描，避免把 Forge/Electron 安装器等开发依赖带进应用。

该命令不签名、不创建正式安装器、不自动运行桌面应用。窗口、浮层、多屏、采集、生命周期与远程媒体仍需 C 阶段设备验证；开发包存在不等于上述能力通过。

## C02 独立验证样例

根目录运行 `pnpm desktop:lab:check` 可隐藏运行锁定 Electron 的合成窗口检查；运行 `pnpm desktop:lab:package` 可生成未签名的独立 Windows x64 包；运行 `pnpm desktop:lab` 才会打开人工验证页面。样例只允许本机固定合成窗口来源，不枚举其他窗口、不采集桌面、不启用音频，帧只统计元数据并在本机停止。真实多屏、负坐标、混合 DPI、触摸穿透与系统授权仍未验收，详见 `native-lab/README.md`。
