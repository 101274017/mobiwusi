# D01 外部证据补录单

更新日期：2026-10-17（Asia/Shanghai）。本文件是 D01 的外部证据收集表，不是验收报告、设备通过记录、供应通过记录或负责人签收。未由真实执行者和独立复核者填写前，D01 必须保持 `blocked / preparatory_not_accepted`。

## 0. 使用边界

- 只记录真实设备、真实系统权限、真实供应沙箱和人工体验/读屏操作；本机单测、E2E、合成窗口、JVM harness 和契约检查只能作为辅助证据。
- 不写入真实密码、令牌、验证码、银行卡、私人聊天、儿童原始媒体或供应商密钥；截图/视频应先脱敏，并使用文件路径、哈希和短说明引用。
- 每条记录必须有执行者、独立复核者、日期时间及时区、构建或包哈希、设备/系统信息、预期、实际、限制和证据引用。
- `通过` 只能由实际执行者记录并由独立复核者复核；Codex 不代填姓名、签名、批准、设备结果或供应结论。

## 1. B07/B10/B11 人工演示、体验和无障碍

最终记录保存为 `docs/implementation/evidence/b07-b11-signoff.json`；可从 `docs/implementation/evidence/b07-b11-signoff.template.json` 开始填写，必须使用 `schemaVersion=b07-b11-signoff/v1`，并由 `scripts/check-d-gate-readiness.mjs` 校验。每个场景至少记录：

| 字段 | 必填内容 |
| --- | --- |
| `scenarioId` | B07/B10/B11 对应场景或 AT 编号，不能只写“整体通过” |
| `packageHash` | 实际测试包或构建产物的 SHA-256 |
| `performedAt` / `timeZone` | 带时区的执行时间 |
| `operator` / `reviewer` | 实际执行者和独立复核者；说明角色与独立性 |
| `device` | Android/Windows 型号、系统版本、DPI/缩放、屏幕布局或读屏软件版本 |
| `steps` | 实际操作步骤、预期结果、实际结果和失败/回退动作 |
| `accessibility` | 键盘、焦点、大字号、减少动画、字幕/语音、读屏输出的实际观察 |
| `evidenceRefs` | 脱敏截图/视频/日志路径及 SHA-256 |
| `limitations` | 未覆盖能力、环境限制和遗留偏差 |
| `outcome` | `passed` / `conditional` / `failed` / `not_run`，不能空白 |

人工签收还必须包含：负责人、参与者/复核者、签收日期时区、结论、未关闭偏差和正式记录引用。自动化结果不能单独作为 `b07-b11-signoff.json`。

## 2. C15 NV-01～NV-12 真实证据

| NV | 实际执行必须补的证据 | 证据负责人 | 独立复核 |
| --- | --- | --- | --- |
| NV-01 | Android 授权、跨应用捕获、原应用可操作、浮层和底层点击记录 | 待指定 | 待指定 |
| NV-02 | 权限拒绝、强停、后台、退出、睡眠、重启和系统通知回执 | 待指定 | 待指定 |
| NV-03 | Windows 捕获、双屏、混合 DPI、负坐标、置顶/穿透和资源释放 | 待指定 | 待指定 |
| NV-04 | stop/revoke/lock/kill/reboot 后出口、队列、轨道和资源计数 | 待指定 | 待指定 |
| NV-05 | 浮层开关、捕获污染排除/隐藏/屏蔽对照和人工复核 | 待指定 | 待指定 |
| NV-06 | OCR/检测/人脸模型的风险、未知、超时、坏模型和逐帧脱敏记录 | 待指定 | 待指定 |
| NV-07 | 编码入口、无 raw track、AI/家属双出口 canary、抓包和停止竞态 | 待指定 | 待指定 |
| NV-08 | 无输入注入、页面操作、帧/窗口/变换一致性和人工轨迹 | 待指定 | 待指定 |
| NV-09 | 儿童路径、遮挡避让、过期终止、替代停靠、真实动画和可达性评审 | 待指定 | 待指定 |
| NV-10 | VRM/FBX/GLB 样本、隔离解析、渲染、预算、帧率/内存和 2D 质量 | 待指定 | 待指定 |
| NV-11 | 真实供应凭证、流式/取消、ASR/TTS/生成质量、成本、区域、保留和条款 | 待指定 | 待指定 |
| NV-12 | 服务端证明、防重放、无 SIM/人脸失败替代、认领和撤权实测 | 待指定 | 待指定 |

每项记录必须关联 `docs/implementation/c15-nv-evidence-protocol.md` 的统一字段，并把设备/供应/人工/独立复核分别列出；不能用同一份合成报告覆盖全部 NV。

## 3. 提交前检查

1. 由执行者保存脱敏证据并计算文件哈希。
2. 由独立复核者核对原始记录、限制和偏差，不由执行者自签独立复核。
3. 将真实记录放入授权的 evidence 路径，保留版本、时间和权限边界。
4. 先运行 `node scripts/check-c15-nv-readiness.mjs --no-write`，确认每项达到 `ready_for_independent_review` 后，再按授权流程刷新报告。
5. 完成 B07/B10/B11 人工签收后，运行 `node scripts/check-acceptance-bundle.mjs --no-write` 和 `node scripts/check-d-gate-readiness.mjs --no-write`；任何缺口都保持阻塞。

## 4. 当前工作区结论

截至 2026-10-17，工作区未发现 `adb` 命令、真实 Android 设备、供应凭证或人工签收文件；本补录单只降低后续收集歧义，不改变 C15/D01 的 `blocked` 状态。
