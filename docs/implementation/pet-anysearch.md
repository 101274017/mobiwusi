# 桌宠智能查询 · 复用已有模型

2026-10-18：桌宠原有搜索入口改为直接使用本机已配置的模型。不要求 AnySearch API Key，不需要新账号，不跳转管理客户端。桌宠底部“搜索”、功能页“智能查询”和右键菜单“智能查询 · 已配置模型”均可打开。

## 当前运行路径

- 桌宠主进程把已有的 questioner 注入 model-search-client.cjs，与普通问答、教学使用同一模型实例、网关和加密凭证；不自动换模型。
- 当前本机配置为 gpt-6.1-sol，网关为 api.openai-next.com。这是用户指定的第三方模型标识，不表示已认证其官方型号或网页检索能力。
- 原 AnySearch 适配器与密钥仓储仅保留兼容代码和隔离测试；桌宠默认运行路径不再导入它们，不读取 AnySearch 环境变量或保存的密钥，也不会在模型失败时回退调用它。
- 状态只返回固定供应类型与 configured 布尔值，不把网关、模型凭证或供应错误正文返回页面。配置就绪不保证实际鉴权、余额或网络请求成功。

## 发送与展示

- 打开页面不会请求模型。用户手动输入问题并勾选本次发送确认，再点击“请模型回答”才会发送。
- 只发送当前手动问题及固定说明，不附加屏幕、麦克风、图片、教学记录、学习档案或搜索历史。查询不启动观察、语音或其他客户端窗口。
- 本机继续拒绝常见个人号码、密码和密钥格式；这不代表能识别所有隐私。
- 页面显示“模型回答 · 未联网核验”。当前使用普通模型问答端口，没有接入实际网页检索工具；不得把模型生成的答案或链接包装成已验证的网页结果。
- 回答作为纯文本显示，不执行 HTML、脚本，不自动打开其中的链接；不提供模型编造的来源按钮。兼容来源结果仍只接受本次返回的安全 HTTPS 地址及受限来源 ID。
- 对实时、最新、价格、天气等问题明确提示无法实时核实；医疗、法律、金融问题仍需可靠原始来源或专业人士确认。

## 停止与失败

- 沿用模型适配器的 45 秒超时、响应长度限制、固定网关、禁止重定向和禁止自动重试；缺配置、鉴权失败、限流、取消、超时及畸形回包均给出固定提示，无 Mock 或匿名搜索回退。
- 新查询、停止、离开功能页、停止全部采集和退出都会取消在途请求。迟到回答不能恢复页面、覆盖新结果或跨页显示。
- 收起或离开页面后撤销本次发送确认，重新打开不会自动发送。模型请求可能在供应商侧已开始处理，取消不保证撤销上游计费。
- 沿用本机已有模型配置，无需重新输入 AnySearch 密钥。模型接入说明见 real-ai-provider.md。主进程接线升级后需要正常退出并重启桌宠。

## 验证方式

单元与接线回归：

~~~powershell
pnpm exec vitest run tests/platform/desktop-model-search.test.ts tests/platform/desktop-anysearch.test.ts tests/platform/desktop-anysearch-settings.test.ts tests/platform/desktop-pet-ui.test.ts tests/platform/desktop-standalone-host.test.ts tests/provider/desktop-ai-provider.test.ts
~~~

界面回归：

~~~powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
pnpm exec playwright test --config tests/helpers/desktop-pet-playwright.config.ts desktop-pet-search.spec.ts desktop-pet-features.spec.ts
~~~

这些测试使用显式合成供应及隔离浏览器，验证共用模型、固定鉴权路径、发送确认、纯文本回答、无伪造来源、错误和迟到响应隔离，不证明真实网页检索可用。

2026-10-18：使用本机已有 DPAPI 模型配置和不含个人数据的“Windows 怎样新建文件夹”问题，完成一次真实模型查询，返回非空中文回答，未返回或伪造网页来源；未发送用户屏幕、附件或音频。这只证明该次模型网关请求成功，不证明网页检索或所有回答质量已经验收，不能据此改写 D07 或发布结论。
