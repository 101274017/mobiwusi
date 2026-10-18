# D05 Windows 证据与限制交接

更新日期：2026-10-17（Asia/Shanghai）  
工作包：D05 Windows 证据与限制交接  
状态：`blocked`  
验收状态：`preparatory_not_accepted`  
Go/No-Go：`goNoGoEligible=false`；不得据此进入 E/F

## 1. 交接结论

D05 当前只能交接隐藏 Electron 预检、ASAR/开发包检查、单显示器几何预检，以及 C08/C09/C17 的静态或合成边界。现有证据没有证明真实桌面捕获、系统权限/来源体验、双屏或以上显示器、负坐标、混合 DPI 移动后的内容标定、真实置顶与鼠标穿透、Windows 系统资源释放，亦没有 Windows 独立复核或人工签收。

本交接包必须把“自动化/静态/合成/打包通过”和“真实 Windows 能力通过”分开记录。不得伪造真实捕获、设备矩阵、人工观察、独立复核人或签名；未执行项保持 `blocked` 或 `not-run`。

## 2. 范围与安全边界

- C02 native-lab 是独立目录和独立包，不改变正常 `@nuanban/desktop` 宿主；正常宿主仍保持 `externalCapture:false`、`nativeOverlay:false`。
- native-lab 的固定合成窗口只含 `NUANBAN-C02-SYNTHETIC`、本地按钮和固定说明；不得打开真实聊天、支付、验证码、账号或含第三方隐私的窗口。
- native-lab 不枚举其他窗口、不读取桌面、不接收文件、不打开链接；没有摄像头/麦克风、编码器、WebRTC、文件写入或网络出口。
- 允许人工验证的捕获来源限于本机固定合成窗口；自动化不得启动 `getDisplayMedia`。帧只记录视频回调的序号和尺寸元数据，不保存采集帧。
- 浮层只验证原生窗口配置。`setIgnoreMouseEvents(true, { forward: true })` 的配置呈现、合成按钮可点击或自动化截图，都不能单独证明真实触摸/鼠标穿透。
- 所有停止都应先失效当前 `generation`，再停止轨道并等待页面确认；迟到回调不得重启旧会话。窗口移动、显示器变化、锁屏/挂起和渲染器退出应保守停止。

## 3. 当前可交接证据

### 3.1 隐藏 Electron 预检

来源：`docs/implementation/evidence/desktop-lab-smoke.json`、`desktop-lab-smoke.txt`。

- 锁定 Electron `44.7.2`、`win32`；隐藏运行共 12 项检查，报告 `passed=true`。
- 已覆盖：不自动请求桌面捕获、sandbox/隔离、无桥接合成源、无用途同意时不开始、额外 IPC 字段拒绝、隐藏 UI `1160`/`760` DIP 渲染、合成 canary、当前环境 DIP 往返、透明置顶窗口配置、停止代际、渲染器错误观察器。
- `displayRequestCount=0`、`realDisplayMediaRequests=0`、`externalScreenCapture=false`。这是安全边界和“自动化没有真实捕获”的证据，不是捕获通过证据。
- 合成轨道明确标记为 canvas `MediaStreamTrack`，不是 desktop media；没有像素读取、`MediaRecorder`、`RTCPeerConnection`、`fetch` 或上传入口。
- 当前记录只有一台显示器：原点为 `(0,0)`，bounds 为 `1707×1067`，work area 为 `1707×1019`，`scaleFactor=1.5`，旋转为 `0`。这只能说明当前环境的单屏几何快照。
- `captureFrameCalibration=not-implemented`，报告明确说明几何记录不是跨应用教学坐标或捕获内容区标定。
- `mousePassThroughConfigured=true`，但 `mousePassThroughVerified=false`；`nativeHitPassVerified=false`。不得把窗口配置或截图写成穿透通过。
- `actualDisplayCaptureVerified=false`、`mixedDpiMovementVerified=false`、`negativeOriginMovementVerified=false`、`independentAcceptance=false`。

### 3.2 ASAR 与桌面包预检

来源：`docs/implementation/evidence/desktop-package.txt`、`desktop-package-contents.txt`、`desktop-lab-package.json`。

- `pnpm build` 与 `pnpm desktop:package` 已生成 Windows x64 Electron 开发目录包；ASAR 列表检查确认 `main.cjs`、`preload.cjs`、`reminder-store.cjs`、`notification-adapter.cjs`、`reminder-notification-bridge.cjs` 在主进程包内。
- 独立 C02 native-lab 包报告为 `win32-x64`、Electron `44.7.2`、未签名；`filesCompared=17`，其中 `package.json` 接受 Forge 的标准清理并单独比较关键字段。报告记录了 ASAR 与可执行文件 SHA-256，但不代表发布签名或安装器验收。
- native-lab 包目录为 `apps/desktop/native-lab/out/NuanbanC02Lab-win32-x64`，必须连同目录使用，不能只复制 exe。
- normal desktop 包和 native-lab 包都只是开发/调试产物；包存在或 ASAR 内容一致，不证明 Windows Toast、系统权限、后台调度、退出/睡眠/重启投递、真实捕获或设备验收。

### 3.3 C08 关联限制

`docs/implementation/c07-c08-desktop-store.md` 与 `docs/implementation/c07-c08-runtime.md` 只支持 Windows 本机预备层的限制说明：

- Electron 主进程的 SQLite 本地仓储、受信任 IPC、提醒实例/排程版本绑定和合成通知桥已有定向检查。
- `safeStorage` 最多保护提醒 `payload_json`；数据库结构、状态、索引和整库密钥管理不因此得到证明。
- 主进程当前把通知权限报告为 `unknown`，不会实际提交系统通知；没有 Windows 系统 Toast、后台调度、退出/睡眠/强停/重启后的投递，或真实 `delivered/opened` 回执。
- 因此 C08 的本机仓储/桥接证据不能替代 D05 的桌面捕获、生命周期或系统资源释放证据。

### 3.4 C09/C10 与 C17 关联限制

- `docs/implementation/c09-c10-lifecycle.md` 规定清理顺序为“关闭出口 → 失效当前代际 → 清空队列 → 停止轨道 → 隐藏浮层”，并要求原生 `stopAll()` 明确返回 `stopped=true`、`captureActive=false`，可选的 `mediaActive` 也必须为 `false`。
- C09/C10 定向回归当前有 25 项通过，覆盖事件映射、销毁解绑、并发停止、代际失效、Windows 主进程控制器和未确认停止时的失败路径；但没有 Windows 真实窗口/多屏/递归捕获、渲染器崩溃或系统资源释放报告。
- `before-quit`、窗口关闭和 `render-process-gone` 的页面通知，在操作系统强杀或渲染器已不可用时不能保证送达；主进程/原生侧仍需真实资源清理证据。
- `docs/implementation/c17-assembly.md` 的 `auditPassed=true` 只表示静态装配、桌面仓储、通知适配器和主进程桥边界可追踪；C17 整体仍是 `blocked` / `preparatory_not_accepted`，不能证明系统权限、跨应用捕获、浮层、桌面通知、媒体出口或安装包升级迁移。

## 4. 待执行人工真实验证矩阵

以下是 D05 的人工执行表，不是已完成记录。执行时只使用固定合成窗口和受控设备，不保存采集帧；每一行都要附开始/停止时间、实际观察、证据文件和缺陷号。没有真实记录时保持 `blocked`。

| 编号 | 场景 | 最低操作与观察 | 当前状态 |
| --- | --- | --- | --- |
| M-01 | 真实系统捕获/来源与权限 | 在人工操作下启动 native-lab；先验证未勾选用途说明不会开始，再勾选用途说明，仅选择固定合成窗口；记录系统权限/来源选择、无音频、停止入口和轨道状态 | `blocked`；现有自动化请求数为 0，未形成真实人工记录 |
| M-02 | 多屏与负坐标 | 至少两台显示器，包含负坐标显示器；记录每屏 bounds、work area、旋转和窗口所在屏；移动合成窗口后确认旧坐标不复用 | `blocked`；当前证据只有一台显示器 |
| M-03 | 混合 DPI | 两台显示器使用不同缩放；在每个屏幕上启动/移动/缩放合成窗口，记录 DIP、物理像素、捕获内容区和回算误差 | `blocked`；只有当前环境单屏 DIP 往返，内容区标定未实现 |
| M-04 | 置顶与穿透 | 浮层开关分别执行；人工用合成按钮确认标记、底层按钮和独立停止窗口的可达性；记录“配置已呈现”和“底层按钮是否可点击”，不以截图替代 | `blocked`；配置已记录，真实穿透未验证 |
| M-05 | 控制页停止 | 用控制页停止；确认轨道停止、页面确认、浮层隐藏、无自动恢复、旧代际迟到回调不增加有效帧 | `blocked`；有代际预检，无人工真实记录 |
| M-06 | 浮层停止 | 用独立置顶停止按钮停止；记录停止延迟、轨道状态、窗口状态和清理报告 | `blocked`；有装配/合成边界，无人工真实记录 |
| M-07 | 来源/轨道自然结束 | 结束捕获轨道或关闭合成窗口；确认不会自动恢复，旧会话不会重新出队或重启 | `blocked`；有停止逻辑预检，无人工真实记录 |
| M-08 | 窗口移动/显示器变化 | 移动、缩放、隐藏合成窗口，改变显示器排列/主屏/旋转；确认当前采集先停止，重新开始前不复用旧坐标 | `blocked`；无真实移动和内容标定报告 |
| M-09 | 锁屏/唤醒与显示设置变化 | 锁屏/唤醒，改变缩放或分辨率；记录权限、窗口、轨道、停止延迟和清理结果；确认不会自动恢复 | `blocked`；C02 仅定义保守停止边界，未实测 |
| M-10 | 退出/渲染器退出 | 分别执行窗口关闭、应用退出、渲染器退出/崩溃模拟；记录 `before-quit`、窗口关闭、`render-process-gone` 是否触发，以及主进程侧资源是否释放 | `blocked`；C09/C10 仅有装配和合成测试 |
| M-11 | 强制结束/重启 | 强制结束进程并重启应用；确认不自动恢复采集，不残留轨道/浮层/资源占用；记录重启前后状态 | `blocked`；现有页面通知不覆盖 OS 强杀 |
| M-12 | 受保护或第三方窗口边界 | 不打开真实第三方隐私窗口；仅记录该场景按实验规则禁止执行，并确认不会把“未测试”写成支持 | `not-run`；这是安全限制，不是缺陷通过 |

### 4.1 每个矩阵项的记录要求

- 测试环境：Windows 版本/build、机器/显卡（如适用）、Electron 版本、native-lab 或 normal desktop 包路径。
- 显示器：数量、排列、每屏 bounds/work area、缩放、旋转、主屏和负坐标；不得只写“多屏”。
- 包身份：使用的 ASAR SHA-256、exe SHA-256 或候选包标识；若没有哈希，明确写“未记录”。
- 过程：用途说明是否勾选、来源/权限结果、开始/停止时间、停止入口、轨道/窗口/浮层状态、停止延迟。
- 结果：原始观察、截图/日志路径、缺陷号、操作者和独立复核者；没有独立复核者则保持 `blocked`。
- 数据边界：只使用合成窗口，不保存采集帧，不输入真实密码/支付/验证码/账号，不上传或外传屏幕内容。

## 5. 复现命令

以下命令只复现已有预检或打开人工实验入口；命令成功不等于 D05 通过。

### 5.1 C02 hidden Electron 与 native-lab 包

在仓库根目录执行：

```powershell
pnpm desktop:lab:check
pnpm desktop:lab:package
pnpm desktop:lab
```

- `pnpm desktop:lab:check`：锁定 Electron `44.7.2`，隐藏运行 12 项检查；复核 `realDisplayMediaRequests=0`、`displayRequestCount=0` 和输出中的 `false` 验收字段。
- `pnpm desktop:lab:package`：使用本机缓存 Electron ZIP 生成未签名 Windows x64 调试包，并检查 ASAR 源文件哈希；不下载运行时，不产生发布安装器。
- `pnpm desktop:lab`：打开源目录验证页。它不会自动勾选用途说明或开始捕获；只用于人工按第 4 节执行受控合成窗口步骤。

预期证据：`docs/implementation/evidence/desktop-lab-smoke.json`、`desktop-lab-smoke.txt`、`desktop-lab-package.json`，以及 `docs/implementation/evidence/screenshots/desktop-lab-*.png`。重新执行后应以新生成报告为准，不能手工修改报告字段。

### 5.2 正常桌面开发包与 ASAR 内容

```powershell
pnpm build
pnpm desktop:package
pnpm exec asar list apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar
```

该流程只证明 Windows x64 Electron 开发包可生成和主进程文件可检查；不证明系统通知、后台调度、退出/睡眠/重启投递、真实捕获或设备验收。

### 5.3 C08/C09/C17 支撑性预检

```powershell
pnpm desktop:reminder-store:check
pnpm desktop:notification:check
pnpm lifecycle:c09:c10:check
pnpm c17:assembly:check
pnpm d:gate:check
```

这些命令分别刷新桌面仓储/通知桥、生命周期装配、共享仓储与桥接、D 关口预备证据。它们不能替代 M-01～M-11 的 Windows 设备实测、独立复核或人工签收；`pnpm d:gate:check` 应继续保持 `status=blocked`、`acceptance=preparatory_not_accepted`、`eStarted=false`、`fStarted=false`。

## 6. 限制、失败处置与交接出口

### 6.1 当前已知限制

1. 无真实 `getDisplayMedia` 系统权限/来源体验记录；自动化必须保持零真实桌面媒体请求。
2. 无双屏或以上、负屏幕坐标、混合 DPI、旋转/显示设置变化后的真实窗口移动与内容区标定。
3. 无真实置顶、鼠标/触摸穿透、浮层污染排除或跨应用捕获结果；`setIgnoreMouseEvents` 只是配置边界。
4. 无锁屏/唤醒、渲染器崩溃、强制结束、重启后的轨道计数、窗口状态和系统资源释放报告。
5. 无 Windows 系统通知/Toast、系统后台调度、退出/睡眠/重启投递或真实回执；C08 的本地 SQLite/通知桥不替代这些证据。
6. 无 Windows 独立复核和人工签收；C17 静态装配、C09/C10 测试和 C02 包/截图都不能形成独立验收。

### 6.2 失败处置

- 任一真实捕获、权限、来源、坐标、穿透、停止或资源释放项失败，保持 D05 `blocked`；记录缺陷号、复现步骤、包哈希和原始观察，不用合成结果覆盖。
- 停止结果无法明确证明 `stopped=true`、`captureActive=false`，或 `mediaActive` 仍为 `true`/未知时，不得标记清理成功，不得重新开始当前代际。
- 发现显示器变化、窗口移动或渲染器/进程退出后仍有轨道、浮层、出队或资源占用时，停止该验证模式并建立修复/ADR 入口；不得继续扩展到真实业务窗口。
- 设备、独立复核者或人工签收缺失时，报告为 `blocked`，而不是 `passed`、`verified` 或 `accepted`。

### 6.3 D05 交接出口

D05 只有在以下材料都存在并由独立复核者确认后，才可提交 D 关口复核：真实人工矩阵记录、每屏 DPI/坐标与内容标定、穿透与置顶观察、退出/强停/重启资源释放记录、包身份、缺陷闭环或明确例外、人工签收。即使 D05 材料补齐，也仍需等待 C15/C16 和 D 总关口批准；在此之前不启动 E/F。

## 7. 人工签收模板

以下模板保持空白使用；不得代填姓名、时间、设备结果或签名。

```markdown
# D05 Windows 人工签收记录

状态：blocked
记录编号：
执行日期（Asia/Shanghai）：
执行人：
独立复核人：
缺陷/例外单号：

## 环境

- Windows 版本/build：
- Electron 版本：
- 验证入口：`apps/desktop/native-lab` / `apps/desktop`
- 包目录：
- ASAR SHA-256：
- exe/候选包 SHA-256：
- 是否签名发布包：否 / 是（需附签名证据）

## 显示器与权限

| 屏幕 | bounds | work area | 缩放 | 旋转 | 主屏 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |

- 用途说明是否勾选：
- 系统来源/权限结果：
- 是否仅使用 `NUANBAN-C02-SYNTHETIC`：
- 是否保存采集帧：必须为“否”

## 矩阵结果

| 编号 | 实际观察摘要 | 证据路径 | 缺陷号 | 状态（pass/fail/blocked/not-run） |
| --- | --- | --- | --- | --- |
| M-01 |  |  |  | blocked |
| M-02 |  |  |  | blocked |
| M-03 |  |  |  | blocked |
| M-04 |  |  |  | blocked |
| M-05 |  |  |  | blocked |
| M-06 |  |  |  | blocked |
| M-07 |  |  |  | blocked |
| M-08 |  |  |  | blocked |
| M-09 |  |  |  | blocked |
| M-10 |  |  |  | blocked |
| M-11 |  |  |  | blocked |
| M-12 |  |  |  | not-run |

## 结论与签收

- 真实桌面捕获：未证明 / 通过（需证据） / 失败（需缺陷）
- 多屏、负坐标、混合 DPI：未证明 / 通过（需证据） / 失败（需缺陷）
- 置顶与穿透：未证明 / 通过（需证据） / 失败（需缺陷）
- 退出、强停、重启后的资源释放：未证明 / 通过（需证据） / 失败（需缺陷）
- 独立复核结论：
- D05 建议：保持 blocked / 提交复核 / 退回修复

执行人签名：________________  日期：____________

独立复核人签名：____________  日期：____________

负责人签收：________________  日期：____________
```

## 8. 证据索引

- `apps/desktop/native-lab/README.md`
- `apps/desktop/README.md`
- `docs/implementation/evidence/desktop-lab-smoke.json`
- `docs/implementation/evidence/desktop-lab-smoke.txt`
- `docs/implementation/evidence/desktop-lab-package.json`
- `docs/implementation/evidence/desktop-package.txt`
- `docs/implementation/evidence/desktop-package-contents.txt`
- `docs/implementation/c07-c08-desktop-store.md`
- `docs/implementation/c07-c08-runtime.md`
- `docs/implementation/c09-c10-lifecycle.md`
- `docs/implementation/c17-assembly.md`
- `docs/implementation/evidence/lifecycle-c09-c10-results.json`
- `docs/implementation/evidence/c17-assembly-results.json`
- `docs/implementation/evidence/d-gate-readiness-results.json`
