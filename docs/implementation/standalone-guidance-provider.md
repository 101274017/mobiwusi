# 独立桌宠：按需云端多模态教学供应服务

## 接线接口

实现文件：apps/server/src/standalone-guidance.ts。此模块不注册 HTTP 路由，不修改生成契约，不依赖管理窗口，不保存教学、掌握或提醒记录。

导出：

- createStandaloneGuidanceService(options?: StandaloneGuidanceOptions): StandaloneGuidanceService。
- service.analyze(input: unknown, actor: { account_id: string } | null | undefined, options?: { signal?: AbortSignal }): Promise<StandaloneGuidanceResult>。
- StandaloneGuidanceError，具有 status、code、retryable；不包含 provider body、请求正文、供应密钥或底层异常 cause。
- StandaloneGuidanceInput、StandaloneGuidanceElement、StandaloneGuidanceResult、StandaloneGuidanceOptions、StandaloneGuidanceService、StandaloneGuidanceErrorCode、standaloneGuidanceLimits。

拟接线 POST /v1/standalone/guidance/analyze。主线程负责调用既有 getActor()，随后调用 analyze(body, actor, { signal })。account_id 必须来自既有鉴权，不从请求正文推断身份。此模块只检查账户标识，不替代鉴权系统。

ServerOptions 可使用 standaloneGuidance?: ReturnType<typeof createStandaloneGuidanceService>。仅在服务端 main() 注入运行配置；无配置的默认服务返回明确 503，不启用 mock。路由需优先识别 StandaloneGuidanceError，再由现有通用错误映射处理其他错误。专属 code 不需要加入生成契约的错误枚举。

请求断开、停止教学、隐私暂停或代际变化时，由主线程取消该请求的 AbortController，并传入 signal。服务独立合并取消与超时，超时会取消 fetch 和响应流；即使测试桩忽略 signal，调用仍按时拒绝。清理计时器和外部监听器，不自动重试。

## 服务端配置

三个必填配置均无默认供应商、默认模型或默认密钥：

| 配置 | 含义 |
| --- | --- |
| NUANBAN_VISION_BASE_URL | 操作者配置的供应基础 URL，或完整 /chat/completions URL |
| NUANBAN_VISION_API_KEY | 仅服务器保存，放在供应请求 Authorization: Bearer 头中 |
| NUANBAN_VISION_MODEL | 操作者确认支持图像、Chat Completions 和 JSON mode 的模型标识 |

基础 URL 的路径末尾若不是 /chat/completions，则追加该后缀。不硬编码任何供应主机，不探测或承诺任何供应商、模型或账户权限可用。使用 max_completion_tokens=2000，不使用已弃用的 max_tokens；供应需要支持此协议字段。供应商不支持协议、鉴权失败、限流、拒绝、网络错误或输出不合法均报错，不回退固定指引。

默认要求 HTTPS。拒绝 URL 用户名/密码、query、fragment、反斜杠、空白、重定向、常见内部主机后缀、私有/保留 IPv4 字面量及 IPv6 字面量。URL 只来自受信任服务器配置，不接受客户端覆盖。生产部署仍需由操作者控制 DNS 和出口访问规则，不应把主机名语法检查视为 DNS 重绑定隔离。

本地合成供应沙箱必须同时设置 NUANBAN_VISION_ALLOW_LOOPBACK_HTTP=true，以及 NODE_ENV=development 或 test；仅此时允许 loopback HTTP，不允许任意局域网 HTTP。生产环境即使误带 flag 也拒绝。开发沙箱只使用合成数据和测试密钥。

不把以上配置返回桌宠或 renderer，不在此模块中记录请求、图片、OCR、供应正文、密钥或模型文字日志。HTTP 层和网络代理也必须禁止请求/响应正文与 Authorization 日志。

## 输入与上传最小化

严格接受 StandaloneGuidanceInput 所列字段；根对象、image、element、rect、previous_step 的未知字段全部拒绝。

- trigger_reason 只接受 question、page_changed、verification。
- observation_generation、task_generation 是大于零的安全整数。服务只回带，不声称知道本机当前代际。
- captured_at 必须为带 Z 或时区偏移的有效 ISO 日期时间；最多陈旧 30 秒、最多超前 5 秒。
- image.mime 仅 image/png；base64 必须规范、无空白或 data URL 前缀，最多 2,700,000 字符；解码后 PNG 最多 2,000,000 字节（十进制 MB）。
- PNG 检查签名、完整块结构及 CRC、IHDR、尺寸、解压后像素长度、逐行过滤器、压缩流是否夹带尾部数据、IEND 和无尾部字节。仅非交错 8-bit 灰度/灰度透明/RGB/RGBA，单边最多 4096、总像素最多 8,388,608。可接受有界颜色/物理尺寸元数据；拒绝文本、EXIF、动画及其他未许可块。
- 重算 PNG 的 SHA-256，必须匹配 sanitized_sha256；frame_hash 是另一份合法 SHA-256，且必须与脱敏 hash 不同。不接收原图。原图 hash 本身不能证明脱敏完成。
- redaction_profile 必须 all_text_and_faces_v1，local_safety 必须 safe。真正的脱敏和安全识别仍由可信本地链路完成，服务不能从声明和 hash 证明图像没有敏感内容。
- elements 最多 80；id 唯一，每个 rect 必须有限、非空、完整落在 PNG 像素坐标内。模型只能引用这些 id，不能提供坐标。
- label 最多 48 字符，合计最多 2048；拒绝多行、长正文、明显邮箱/长数字/风险标签等。短字符串规则不能证明标签一定通用，主线程仍必须事先过滤为 generic UI labels，禁止上传完整 OCR 或把 OCR 拼进 question。
- question 最多 2000 字符，question 触发时非空；付款、密码、验证码、远控、自动操作等风险问题在请求供应前拒绝。风险/未知页面应首先在本机停教停共享。

供应 JSON 包含模型名、非流式 JSON mode、系统安全提示，以及用户数据里的 question、trigger_reason、generic elements（含本机已验证的 rect）、可选 previous_expected_labels、当前时间和复习截止时间。图像以 image_url 中的 PNG base64 data URL 提供。

previous_step.instruction 只做有界输入校验，不上传。账户信息、原图/脱敏 hash、观察/任务/帧标识均不上传供应；返回这些标识时使用已验证的请求值，不相信模型回写。页面与图像中的提示注入仅作为不可信数据，不升级为系统指令。无工具调用接口。

HTTP 接线只对这一条路由放宽 readBody 上限至 3 MiB，其他路由维持既有上限。JSON 中两个 hash 之外的字段没有携带原图的合法通道。

## 输出与本人确认边界

仅接受供应返回的完整 JSON 对象，拒绝重复键、未知字段、代码围栏、截断、工具调用、无效 UTF-8、非 JSON 响应和非法结构。供应回复总量最多 65,536 字节，模型内容最多 8192 字符；默认 15 秒超时，可注入 1～60,000 ms。

- kind 仅 step、completed、clarify、unsupported。指令最多 600 字符；拒绝明显风险操作、自动输入、脚本/命令、外部 URL 和模型生成坐标。
- target_id 必须属于当前 elements；带 target 时必须明确 presentation。uncertain_candidate 需要明确表示不确定，不能声称已找到、确认或匹配。没有 target 的口头教学可教用户自己找图标、打开应用，不能伪造浮层目标。
- expected_labels 是下一张新帧的预期通用标签；evidence_labels 必须逐项来自本帧真实提供的元素标签。
- completed 只允许 verification/page_changed，且 previous_step.expected_labels 非空、每个预期标签同时在当前 UI 和 evidence_labels 中存在。不能带新步骤目标或下一步预期。
- completed 只是云端证据建议，不是步骤成功或掌握的权威。主线程仍需核对新帧、帧 hash、当前任务与观察代际、预期证据，才能推进。schema 未提供前一帧身份，因此服务不能证明这一帧与上一步不同。
- 无法可靠判断时供应应返回 clarify/unsupported。服务不把供应失败替换成这类看似成功的固定响应。

可选 review_proposal 仅允许用于 completed，严格字段为 { remind_at, timezone, reason }。必须由真实供应回复给出；未给出就不补造。remind_at 必须是有效 ISO 时间，在响应校验时严格晚于 now，且不超 365 天。timezone 必须是运行环境可识别的 IANA 标识，不能仅为数字 UTC offset。reason 非空且不超 240 字符，不能含风险操作。多余 confirmed、mastered 等字段拒绝。

主线程可将复习建议保存为 suggested，展示具体时间、时区、理由后仅由本人确认创建提醒。有效时区不等于已经确认用户所在地。模块不调用提醒存储、不改变掌握、不允许 AI 或家属代替本人确认。

### 桌宠结果呈现

- `clarify/unsupported` 返回后必须结束分析态；在光标指引功能页直接显示原有说明与未生成箭头的原因，允许本人重新描述或结束教学，不伪造位置。
- `step` 的 `task.targetState` 区分 `visible`、`unavailable`、`stale`、`hidden`。主进程窗口不接受目标时返回失败；功能页不得在没有箭头时宣称“请看箭头”。
- 箭头有效期受最近完整本地安全帧的原有新鲜度边界约束，最长五秒；同页面的新安全帧在本地续期，不额外上传。过期、页面变化、停止观察或隐私暂停立即撤销旧位置；续期不先清空窗口。
- 收起时的教学回复只点亮通知圆点，点击进入桌宠光标指引页。中央大字字幕仍默认关闭；用户仍须亲手点击和输入，系统鼠标不由桌宠移动。

## 错误映射

### 桌宠观察授权状态同步

- 文字查找和语音查找在发送授权请求前重新读取宿主状态，仍严格绑定本人点击时的观察代次；换屏或暂停后不会把旧问题自动转到新范围。
- 停止或隐私暂停开始时立即发布撤权后的状态，不等待采集源退出。清理完成前仍如实保留 `captureActive`，不谎报采集已经停止。
- 对过期的有效代次，宿主返回 `observation_changed` 和最新快照，不弹授权窗口；缺少或伪造授权参数仍拒绝。兼容旧宿主拒绝时，界面重新同步真实状态，不反复展示底层 IPC 报错。
- 光标指引页保留草稿并展示本地暂停原因。仅清理完成且允许恢复时提供“本人继续共享”，仍须本人重新选择范围和确认；不会自动恢复屏幕、云端或麦克风权限，也不会自动重发问题。
- 状态核对失败时禁止发送或开麦。“重试”只恢复状态连接，重新查找仍需本人再次点击。
- 自动化验证仅使用合成状态、合成画面和本地桩；不代表用户真实桌面或远端分析服务已验收。

### 云端服务错误

所有 message 都是固定安全描述，不引用供应正文、异常原文或配置值。

| status | code | retryable |
| --- | --- | --- |
| 400 | GUIDANCE_INVALID_REQUEST | false |
| 401 | GUIDANCE_AUTH_REQUIRED | false |
| 403 | GUIDANCE_UNSAFE_REQUEST | false |
| 503 | GUIDANCE_UNAVAILABLE | false |
| 502 | GUIDANCE_PROVIDER_FAILURE | true |
| 502 | GUIDANCE_INVALID_PROVIDER_RESPONSE | false |
| 502 | GUIDANCE_UNSAFE_PROVIDER_RESPONSE | false |
| 499 | GUIDANCE_ABORTED | false |
| 504 | GUIDANCE_TIMEOUT | true |

retryable 仅是给调用方的状态提示，本模块没有自动重试或失败后的静默上传。供应 HTTP 401/429/5xx 不伪装为用户鉴权失败，统一供应失败 502，不透传供应正文。

## 验证范围与官方协议来源

tests/server/standalone-guidance.test.ts 使用代码生成的纯合成 PNG、测试密钥及 fetch 单元桩，覆盖配置、鉴权、脱敏声明与 hash、伪造 PNG、时间/代际、未知字段、模型目标与候选、完成证据、可选复习提议、取消、超时、重定向、回复上限和密钥隔离。没有发送任何真实用户画面，没有注册或使用付费账户，不能把单测通过表述为真实供应商验收通过。

执行命令：pnpm exec vitest run tests/server/standalone-guidance.test.ts。

协议核对依据为官方 OpenAI 文档，而不是第三方示例；OpenAI-compatible 供应商仍需自行确认对该协议子集的实际支持：

- [Chat Completions create](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- [JSON mode and structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat)
