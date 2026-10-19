# 默认小猴子桌宠与星云 SDK 接入

## 默认形象

独立桌宠的产品默认形象是星云小猴子，标识为 `xingyun-monkey`，定义在 `apps/desktop/default-pet.json`。只调整桌宠形象与功能页，不改变客户端页面布局。

- 启动即显示同款小猴子的本地静态预览，不再默认显示小橘猫。
- 预览图由用户提供的星云编辑器截图裁出，仅包含角色本体，已移除周围白色背景；不含浏览器、账户、接口凭证或编辑器界面。
- 静态预览不是 GLB/VRM/FBX 文件，不支持离线旋转、口型或实时 3D 动作。页面和悬浮形象明确标注显示模式。
- 本人手动启用星云服务并成功加载后，实时形象替换静态预览。停止、失败或断网后恢复本机形象；仅当本地预览资源损坏时，才使用原小橘猫应急。
- 保留已有用户原画、本地模型和选择，不因修改产品默认值删除或覆盖用户资产。

默认形象不等于默认同意联网计费。`autoConnect` 默认为 `false`；不自动连接或重连，不因展开面板创建会话。

## 使用与配置

桌宠右键 → “星云小猴子 · 3D 形象”，或功能小屋 → “默认小猴子 · 3D”，进入专属页面。确认联网服务说明后，点击“启用小猴子”。使用页面按钮或右键“停止星云形象（恢复本机桌宠）”结束服务。收起面板不代表远端会话停止。

根目录执行以下命令并替换 App ID；App Secret 通过隐藏输入获取，不作为命令行参数：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure-xingyun-avatar.ps1 -AppId "替换为你的AppId"
pnpm desktop:avatar:build
```

凭证以 Windows DPAPI CurrentUser 加密保存到 `%LOCALAPPDATA%/Nuanban/xingyun-avatar.json`，不存入仓库或前端。更换配置后，在保存工作后重启暖伴生效；不会自动重启正在使用的进程。公开分发前，应独立确定应用权限、额度及角色素材使用授权，不应把开发者长期 App Secret 打包给其他用户。

## 安全与生命周期

- 使用锁定的 `@xmov/avatar@2.4.1`，SDK 预打包进桌宠 `avatar-runtime`，不依赖浮动 CDN。
- 页面只得到 App ID、一次性授权和短期会话信息。真实 App Secret 只由主进程解密与代签。
- 仅代签固定星云 HTTPS 会话接口的 POST/DELETE；不提供任意 URL 代理或签名接口，不透传页面传入的截图、问题、ASR 或 Brain 配置。
- 使用 `/user/v1/ttsa_v2/session`，不额外添加 `tag`；只接收 SDK 检测得到的布尔型 `config.raw_audio`，不覆盖为固定格式。该字段只用于输出音频格式协商，不代表麦克风授权；缺失或非布尔值在联网前拒绝，其他配置仍由主进程白名单重建。
- 签名遵循官方 SDK 的 Unicode 码点递归排序、非 ASCII JSON 转义和 MD5 算法。
- 每次显式授权最多一次 POST。Agent 重连关闭，旧授权及重复 POST 被主进程拒绝；失败只能重新确认后手动重试。
- 不调用 `startASR` 或 `ask`；输入音频、自动 ASR→LLM、Sentry 上报关闭，输出音量为零。原有问答与语音使用原来的独立权限和服务。
- 会话会收发 SDK 必需的设备/性能信息、资源及控制数据；不是完全离线服务。
- 仅桌宠 CSP 允许星云资源；客户端 CSP 不放宽，客户端 preload 不暴露会话桥接。
- 关闭、退出、Renderer 故障及全局停止均清理远端会话。在途创建先等待返回，再以 request/session ID 关闭，防止孤儿会话。停止失败如实提示并阻止新会话。

## 验证边界

```powershell
pnpm exec vitest run tests/platform/desktop-xingyun-avatar.test.ts
$env:PLAYWRIGHT_CHANNEL='msedge'
pnpm exec playwright test --config tests/helpers/desktop-pet-playwright.config.ts desktop-pet-avatar.spec.ts
node scripts/test-xingyun-avatar.mjs
node scripts/test-xingyun-avatar.mjs --simulate
```

专项检查覆盖默认小猴子、签名与权限、密钥隔离、重复请求、取消、停止失败、退出、独立页面、零尺寸保护、形象互斥、迟到初始化，以及客户端导航和草稿不被影响。`--simulate` 仅在隔离测试宿主注入合成凭证与错误响应，不连接星云，不是产品实现的替身。

只有显式传入 `--live` 才创建真实会话，可能消耗平台额度。结束前请求 DELETE。产物保存在 `.cache/xingyun-avatar-check-*/`；记录脱敏状态，不记录 App Secret 或短期会话令牌。

已有的 2026-10-18 真实接口记录返回 `1008`：`ttsa request error: 请求参数不完整,请检查传入参数(如角色、音色等)`，未获得 `resource_pack`；随后 DELETE 返回 `error_code: 0`。用户提供的配置截图已显示角色“小猴子”、音色“运动男孩”、自动保存，不能再仅凭此错误认定角色或音色未选择、未保存。2026-10-19 重新核对调试截图发现页面显示“重新连接”、输入框和“提问”按钮不可用；对应公开工作台源码的未连接预览分支，不能将画面中存在猴子认定为内部会话连接成功。顶部自动连接说明不是实时连接成功状态。

2026-10-19 修正本地请求重建时额外添加 `tag` 和强制 `raw_audio: false` 的偏差，并通过合成会话检查 SDK 音频格式传递、一次授权一次 POST、1008 失败后 DELETE 清理及不重连。这是本地协议对齐，不证明上述偏差就是 1008 的唯一根因，也不等于真实 3D 已验收。

同日，用户明确要求直接调用后，使用本机 DPAPI 加密配置执行了一次 `node scripts/test-xingyun-avatar.mjs --live`。修正后的请求没有额外 `tag`，`raw_audio` 与 SDK 检测结果一致；真实接口 HTTP 200，但业务错误仍为 `1008`，未返回 `resource_pack`。总计一次 POST、一次 DELETE，DELETE 返回 `error_code: 0`；没有自动重连、抓屏或启用麦克风，客户端导航及草稿检查通过。脱敏报告保存在 `.cache/xingyun-avatar-check-1792367970070/report.json`。此次实测未解决 1008，也未完成真实 3D 验收，后续排查不能把上述本地协议偏差认定为已确认根因。

本地 App ID 与此前实际请求及用户的 SDK 接入截图一致。进一步以合成凭证直接运行已锁定的 `@xmov/avatar@2.4.1` 原始请求构造及签名函数，离线对比了两种布尔音频格式的请求体与签名，以及 Unicode POST 和 DELETE 签名，结果一致；没有读取明文密钥，也没有增加云端会话。该检查不验证后台保存结果、应用授权、额度或密钥是否仍有效，详见 `docs/implementation/xingyun-avatar-1008-diagnostic.md`。

此前在聊天或截图中展示过的 App Secret 仍建议立即在星云后台轮换，再通过本机配置脚本的隐藏输入保存；后续真实测试应使用轮换后的凭证并重新取得授权。向星云平台反馈“外部 `ttsa_v2/session` 返回 1008，已有后台调试截图同样处于未连接状态”，请平台核查应用保存的角色/音色/表演配置、调用权限及参数兼容性。不要再将“内部调试正常”作为已确认前提，也不要在反馈或日志中包含密钥、短期令牌或原始资源包。真实 3D 画面、透明背景、完整资源域名、口型及动作仍待验证。
