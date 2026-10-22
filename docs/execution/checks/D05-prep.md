# D05 预备检查记录

> 现行产品说明（2026-10-22）：本项目显示名称为**微光指引**，功能与平台边界见[当前产品状态](../../implementation/product-current-state.md)。本页任务元数据、原始 WBS 引文、哈希、生成日期与验收值保留为批次快照；文档同步不表示重跑或签收，不能据旧卡片推定当前功能尚未开发。

检查时间：2026-10-17T11:53:38.674+08:00（Asia/Shanghai）  
任务状态：`blocked / preparatory_not_accepted`  
性质：现有 Windows 本地/合成预检与限制交接登记；不是 Windows 真机验收、真实捕获验证、人工签收、独立复核、发布批准或负责人 Go/No-Go。

## 范围与计划校验

- 对应计划 `暖伴AI公益助手-项目实施计划-Codex高效续作版.md#L332`，原始 D05 行 SHA-256：`076ad15d16eb32e38629366cdad248bbc1021055e1dc0bf4ef598a7bc0bddb52`（UTF-8，不含行尾换行）。
- 原始任务行：`| D05 Windows证据与限制交接 | 全基线/AT前端层/NV；前置 B07/B10/C15/C16：FS | W9～9 / 1周 | W / 1 | 复核交付、缺口与可复现证据；交付：D交接包/能力账本 | 无真实业务后端可跑；核心原生有结论 | 未过关不进入E |`
- 本轮只允许写入并只写入 `docs/execution/tasks/D05.md` 与 `docs/execution/checks/D05-prep.md`；不修改 `RUN.md`、`progress.jsonl`、共享 evidence、源码、构建目录或其他任务文件。

## 只读材料与实际结果

| 只读材料/检查 | 记录到的真实结果 | 明确边界 |
| --- | --- | --- |
| 读取 `docs/implementation/d05-windows-evidence-handoff.md` | 文档明确 D05 为 `blocked`、`preparatory_not_accepted`、`goNoGoEligible=false`；M-01～M-11 为待执行真实矩阵，M-12 为安全限制 `not-run` | 交接文档是边界和执行入口，不是已完成的人工记录 |
| 解析 `docs/implementation/evidence/desktop-lab-smoke.json` | `passed=true`；Electron `44.7.2`、`win32`；12 项隐藏 Electron 预检；`displayRequestCount=0`、`realDisplayMediaRequests=0`、`externalScreenCapture=false` | 证明自动化没有真实桌面媒体请求；不证明真实捕获或权限体验 |
| 读取 smoke 的显示器/几何/浮层字段 | 仅一台显示器：bounds `(0,0,1707,1067)`、work area `(0,0,1707,1019)`、`scaleFactor=1.5`、旋转 `0`；`captureFrameCalibration=not-implemented`；配置有穿透但 `mousePassThroughVerified=false`、`nativeHitPassVerified=false` | 不覆盖多屏、负坐标、混合 DPI、内容区标定、真实穿透或人工观察 |
| 解析 `docs/implementation/evidence/desktop-lab-package.json` | `platform=win32-x64`、Electron `44.7.2`、`signedProductionRelease=false`、`filesCompared=17`；ASAR SHA-256 `8e2b1e39afaf187e8e596cbb17d656c5ccfe7689835190dba74708e17325ec38`；EXE SHA-256 `e0a1475dbc187659e6675d3df5f185eb3c27d3707b6120ae513a239de55e7c34` | 只证明未签名调试包、文件集和哈希可追踪；不证明发布签名、安装/升级或设备验收 |
| 读取 `docs/implementation/evidence/desktop-package.txt` 与 `desktop-package-contents.txt` | 既有桌面开发包与 ASAR 内容检查可定位 `main.cjs`、`preload.cjs`、提醒仓储和通知桥等主进程文件 | 不证明 Windows Toast、后台调度、退出/睡眠/重启投递、真实捕获或资源释放 |
| 解析 `docs/implementation/evidence/lifecycle-c09-c10-results.json` | 6 个套件、25/25 项通过、0 失败；覆盖停止共享 Promise、停止重入、未确认 stop-all 失败保持阻断和清理失败不自动重启 | 是本机定向回归；不替代 OS 强杀、渲染器崩溃、真实多屏或系统资源释放 |
| 解析 `docs/implementation/evidence/c17-assembly-results.json` | `auditPassed=true`；C17-01～C17-09 均 `passed`，整体状态仍为 `blocked` | 是静态装配/边界审计；不证明系统权限、跨应用捕获、浮层、通知、媒体出口或升级迁移 |
| 解析 `docs/implementation/evidence/d-gate-readiness-results.json` | 快照 `2026-10-17T00:52:49.567Z`；总状态 `blocked`、`acceptance=preparatory_not_accepted`、`goNoGoEligible=false`、`eAfterDEligible=false`、`eStarted=false`、`fStarted=false`；D05 的 `packagePresent=true`、`smokePassed=true`、`actualDisplayCaptureVerified=false`、`independentAcceptance=false` | 既有 D 关口快照，不在本记录中刷新；不能升级为批准或 E/F 启动许可 |
| 对照现有 `D03`/`D08` 任务卡和检查记录 | 沿用前置依赖、状态字段、证据边界和“不把自动化写成人工签收”的格式 | 参考格式不构成 D05 额外验收证据 |

## 真实缺失项与矩阵状态

- 缺少 Windows 版本/build、机器/显卡（如适用）、实际执行人、独立复核人和负责人签收。
- 缺少真实系统捕获、用途说明/来源选择、权限结果、无音频、开始/停止时间和轨道状态记录。
- 缺少双屏/负坐标、混合 DPI、旋转/排列变化、捕获内容区标定和窗口移动后的真实观察。
- 缺少真实置顶/鼠标或触摸穿透、窗口关闭/渲染器退出、锁屏/唤醒、强制结束、重启后的轨道/浮层/资源释放记录。
- 缺少缺陷号、原始截图/日志和独立复核结论；不得用合成截图、窗口配置或自动化退出码补齐。

| 矩阵 | 当前状态 | 依据 |
| --- | --- | --- |
| M-01 真实系统捕获/来源/权限 | `blocked` | 现有记录明确自动化真实请求数为 0，未形成人工记录 |
| M-02 多屏与负坐标 | `blocked` | 现有几何只有单屏 `(0,0)` |
| M-03 混合 DPI | `blocked` | 仅有当前环境 DIP 往返；内容区标定未实现 |
| M-04 置顶与穿透 | `blocked` | 仅 `mousePassThroughConfigured=true`，验证字段为 false |
| M-05 控制页停止 | `blocked` | 只有代际/合成停止预检，无人工真实记录 |
| M-06 浮层停止 | `blocked` | 无独立停止按钮的真实观察与清理报告 |
| M-07 来源/轨道自然结束 | `blocked` | 无真实轨道结束或关闭窗口记录 |
| M-08 窗口移动/显示器变化 | `blocked` | 无真实移动、排列/主屏/旋转变化和标定报告 |
| M-09 锁屏/唤醒与显示设置变化 | `blocked` | 只有保守停止边界说明，未实测 |
| M-10 退出/渲染器退出 | `blocked` | C09/C10 有定向回归，但无真实 OS/渲染器环境记录 |
| M-11 强制结束/重启 | `blocked` | 页面通知和合成测试不覆盖 OS 强杀 |
| M-12 受保护或第三方窗口边界 | `not-run` | 安全规则禁止打开真实第三方隐私窗口；不得写成支持 |

## 预备结论

1. 本轮可以交接的只有：隐藏 Electron 的安全边界与合成轨道预检、当前单屏几何快照、未签名 native-lab 包及 ASAR/EXE 身份、C08/C09/C10/C17 的本机或静态支撑证据。
2. 本轮不能交接：真实桌面捕获、系统权限/来源体验、多屏/负坐标/混合 DPI、真实置顶/穿透、Windows 系统通知/后台能力、退出/睡眠/强停/重启资源释放、Windows 独立复核和人工签收。
3. 不得把 `passed=true`、包存在、ASAR/EXE 哈希、窗口配置、合成按钮或自动化退出码改写成真实 Windows 能力通过。
4. D05 保持 `blocked / preparatory_not_accepted`；D 关口正式 Go/No-Go 未通过前，`eStarted=false`、`fStarted=false`，不启动 E/F。

## 落盘自检结果

- 两个目标文件均存在；任务卡前置 YAML 已由本地 `yaml` 解析器成功解析，检查记录可按 UTF-8 Markdown 读取。
- 已核对任务卡 `D05`、`blocked`、`preparatory_not_accepted`、`eStarted=false`、`fStarted=false` 与“不启动 E/F”标记；检查记录包含相同状态语义，结果：`passed`。
- 已核对计划原始行 `#L332` 与 SHA-256 `076ad15d16eb32e38629366cdad248bbc1021055e1dc0bf4ef598a7bc0bddb52`，结果：`passed`。
- 已逐一确认任务卡列出的 8 个 evidence 路径在本地存在；本轮未新增、未改写 evidence，结果：`passed`。
- 已核对 M-01～M-11 均为 `blocked`、M-12 为 `not-run`，并保留真实捕获、独立复核和人工签收缺失边界，结果：`passed`。
