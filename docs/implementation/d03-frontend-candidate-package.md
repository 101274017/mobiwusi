# D03 前端候选包与重置说明

更新日期：2026-10-17（Asia/Shanghai）  
工作包：D03 前端候选包与重置说明  
计划负责人席位：F（共享前端）  
前置依赖：B07/B10/C15/C16，均需在 D 关口完成后才可关闭 D03 交接。

## 当前结论

**状态：`blocked`。** 本文是候选包的可复现交接材料，不是发布批准、D 关口通过或人工签收记录。

当前关口状态必须保持如下值：

| 字段 | 当前值 | 说明 |
| --- | --- | --- |
| `status` | `blocked` | D01～D08 预备审计全部保持阻塞 |
| `acceptance` | `preparatory_not_accepted` | 只有本机预备证据，没有最终验收 |
| `goNoGoEligible` | `false` | 尚未具备独立 Go/No-Go 条件 |
| `eAfterDEligible` | `false` | 不得以 D03 材料启动 E |
| `eStarted` / `fStarted` | `false` / `false` | 不得进入真实业务、联调、试点或发布 |

当前阻塞不是“没有构建产物”，而是以下准入条件尚未满足：

1. 没有候选包负责人的真实姓名、日期、环境、哈希和范围批准记录。
2. 历史完整 E2E、本轮无障碍定向复跑、静态审计和打包成功均不能替代候选包人工复核和负责人签收。
3. 修复前 Web/ASAR 仅 3/6 一致的现场保存在 `docs/implementation/evidence/d03-candidate-snapshot.json`。本轮已重新打包，修复后快照 `docs/implementation/evidence/d03-candidate-snapshot-rebuilt.json` 为 6/6 一致、0 mismatch、0 extra；包不同步问题已修复，但仍缺同一候选版本的人工复核及批准。
4. C15 仍缺真实设备/供应/独立复核，C16 仍未确认负责人、Top20 和试点输入；D 关口报告已明确禁止把预备审计升级为批准。

## 项目进度定位

项目实施计划将 D 阶段安排在 W9，D03 的交付物是“D 交接包/能力账本”，不是生产安装包。当前工程进度可概括为：

- B 层共享前端已具备 13 个固定合成场景、学习/待办/画稿/关系演示、冲突草稿、停止与失败回退、键盘/焦点/字号/语音降级等本机行为。
- C 层已有 Android/Windows 宿主骨架、Room/SQLite/桥接和原生实验的编译或合成预备证据；没有真实设备、系统权限、后台投递、跨应用捕获、真实媒体或供应证据。
- 历史 `pnpm check` 证据为 43 个测试文件、668 项通过；本轮完整 Vitest 为 44 文件、681 项通过，见 `docs/implementation/evidence/d03-d08-unit-regression-20261017.json`。既有完整双视口 E2E 报告为 96 项通过；本轮无障碍定向复跑另有独立 10/10 报告，不表示重跑了完整 E2E，也不构成人工签收。
- `pnpm acceptance:check` 为 `preparatory_ready`，但明确保持 `preparatory_not_accepted`；`pnpm d:gate:check` 的 D01～D08 全部为 `blocked`。
- E/F 尚未启动；不得为了“完成 D03”改写 `blocked`、补造签名或把历史证据当作本轮人工结论。

## 候选包清单

以下清单区分“当前可追踪的本机产物”和“可批准的候选包”。当前只允许作为交接输入，不代表已发布。

### 1. 共享 Web UI

| 项目 | 当前值 |
| --- | --- |
| 目录 | `apps/web/dist/` |
| 构建入口 | `pnpm build`，其中包含 `pnpm typecheck` 和 `pnpm --filter @nuanban/web build` |
| 最新现场核对 | 2026-10-17 11:31（Asia/Shanghai）；逐项记录见修复后 D03 快照 |
| 当前文件 | `index.html`、`favicon.svg`、2 个 CSS、2 个 JS，共 6 个 UI 文件 |
| 当前用途 | 浏览器演示、桌面打包输入、Android 同步输入 |
| 结论 | 可重建；需在签收时重新构建并记录完整哈希 |

当前 `apps/web/dist` 文件哈希（用于现场比对，不替代签收）：

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `apps/web/dist/index.html` | 581 | `79d50d82811dd4d72aa8ae87ca4cb723b678a2eac511b6a7b817c4d73416f0cf` |
| `apps/web/dist/favicon.svg` | 382 | `b3d5f7e1b3224b4b12503c7801964abe9d4a205d5597322801221a000ca8412c` |
| `apps/web/dist/assets/bootstrap-CVGnqZ7q.css` | 4,275 | `3ae2f75d9909d40fff86a3e73edccd54dbf4b90d5b219f1403a8f7be0556f67b` |
| `apps/web/dist/assets/bootstrap-BIi0-HtA.js` | 275,366 | `4e058dc99880039049b08a7d1e7b708a8d62aeac90c88d1cb8f0f998c2c9c2e5` |
| `apps/web/dist/assets/index-Cne_RoAQ.css` | 40,988 | `a23d7be6d2513be59105686cdb52b3538037532c4465a5121db1690a7c5d0139` |
| `apps/web/dist/assets/index-piQD4I18.js` | 222,229 | `77e75fd1fa4fdb5977110b3b11d8d3cb384719fa6698b66793b7825ac32742db` |

### 2. Android 正常演示 Debug APK

| 项目 | 当前值 |
| --- | --- |
| 包路径 | `apps/android/app/build/outputs/apk/debug/app-debug.apk` |
| 应用标识 | `org.nuanban.assistant` |
| 构建版本 | `0.1.0-demo`，Debug、未签名发布包 |
| 当前现场读取时间 | 2026-10-17 00:47:04（Asia/Shanghai） |
| 文件大小 | 4,293,825 bytes |
| 当前 SHA-256 | `f9862196e7ddb131ffc6191977da80f32c8f1ea99bb7200d5c7ae0e9c11777a1` |
| 历史核对内容 | 当时 APK 内 `assets/ui` 的 6 个文件与当时 Web 构建哈希一致；DEX 含活动桥/契约类；本轮未重建或重新对齐 APK，不沿用为当前 Web 候选的一致性结论 |
| 不能据此证明 | 真机安装、WebView 实跑、系统权限、通知/闹钟投递、锁屏/强停/重启恢复 |

### 3. Windows Electron 开发目录包

| 项目 | 当前值 |
| --- | --- |
| 包目录 | `apps/desktop/out/NuanbanDemo-win32-x64/` |
| 可执行文件 | `apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe` |
| ASAR | `apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar` |
| 当前产物时间 | `nuanban.exe`：2026-10-17 11:25:03；`app.asar`：2026-10-17 11:25:02（Asia/Shanghai） |
| `nuanban.exe` SHA-256 | `c8e551c11c5e33c7b5f48baa901c8acae76c1fd0e8bf6fcff0194edcf9a7bb20` |
| `app.asar` SHA-256 | `a4206de7e955b2ebdcf72397f177aa027817939dfabd09efd6659857ee1a725e` |
| 包性质 | Windows x64 未签名开发包；不是正式安装器或发布包 |
| ASAR 已确认 | 含 `main.cjs`、`preload.cjs`、`reminder-store.cjs`、`notification-adapter.cjs`、`reminder-notification-bridge.cjs` |
| 当前 UI 核对 | Web/ASAR 的 6 项 UI 文件均逐字节一致，0 mismatch、0 extra；见修复后快照 |

修复前证据保留为历史现场，不覆盖成修复后结果。当前桌面开发包已完成重打包和 UI 一致性后置检查，但仍没有负责人签收、签名、正式安装器、系统通知、后台调度或真实设备验收结论。

### 4. 独立实验包（不并入主候选包）

- `apps/android/native-lab/build/outputs/apk/debug/native-lab-debug.apk` 是独立 Android native-lab Debug APK，只用于捕获状态机/提醒策略预备实验，不改变正常演示包能力，也不能作为主 APK 的生产能力证明。
- `pnpm android:lab:check`、`pnpm desktop:lab:check` 的结果只作为 C01/C02 边界证据；不要把 native-lab 安装包、隐藏 Electron 合成窗口或截图混入 D03 主候选包。

### 5. 证据时效说明

`docs/implementation/evidence/artifacts.json`、`android-assets.json` 等部分产物记录生成于 2026-10-15，记录的文件名/哈希可能早于当前现场产物。签收时必须以同一轮构建后重新计算的文件哈希为准，不能把旧报告中的哈希直接复制到新候选包。`docs/implementation/evidence/e2e-results.json` 的本轮执行起始时间为 2026-10-17 08:22:40.539（Asia/Shanghai，按 JSON 的 UTC 时间换算），仍需本轮人工复核。

## 可复现命令

以下命令均从仓库根目录 `C:\Users\33864\Desktop\nuanban` 执行。命令是复现路径，不表示本轮已再次执行；执行后应保存实际开始/结束时间、环境、产物哈希和失败日志。

### 环境与共享前端

```powershell
pnpm install --offline --frozen-lockfile
pnpm typecheck
pnpm build
pnpm check
```

`pnpm check` 会执行类型、单元/领域证据和边界检查；不要只看退出码，还要检查生成的 `docs/implementation/evidence/unit-results.json` 是否对应本轮执行。

### 浏览器 E2E 与静态 UI smoke

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm exec playwright test --reporter=json
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

本轮已有双视口配置：`desktop-chromium` 和 `mobile-chromium`（Pixel 7 视口）。`docs/implementation/evidence/d08-browser-accessibility-20261017.json` 单独记录本轮 A11Y 五项 × 两个 Chromium 项目的 10/10 定向复跑；`mobile-chromium` 仍是视口模拟而非 Android 真机。自动化通过后仍必须手动打开候选包，不能用 96 项既有完整报告或 10 项定向报告替代人工演示、读屏、字号和负责人签收。

### Android 包

```powershell
pnpm android:build -Offline
pnpm android:room:check
pnpm android:lab:check
pnpm android:lab:build -Offline
```

`pnpm android:build -Offline` 会先执行共享 UI 构建和 `scripts/sync-android.mjs`，再生成 `app-debug.apk`。`android:room:check`、JVM harness 和 native-lab 不等于 Android 真机执行；当前没有 ADB 设备记录。

### Windows 包

```powershell
pnpm desktop:package
pnpm desktop:lab:check
pnpm exec asar list apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar
```

本轮已执行 `pnpm desktop:package`，并验证 `scripts/desktop-package.ps1` 接入的 `scripts/check-d03-candidate.mjs` 后置检查成功。日志见 `.cache/d03-desktop-package-integrated-20261017.log`。后续产生新候选版本时仍须重新打包，并至少核对：

```powershell
Get-FileHash apps/web/dist/index.html -Algorithm SHA256
Get-FileHash apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar -Algorithm SHA256
Get-FileHash apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe -Algorithm SHA256
```

ASAR 内 UI 文件也要逐项与 `apps/web/dist` 比对；仅检查 `app.asar` 自身哈希或仅看到 Forge 成功不足以证明候选包同步。

### 交接状态检查

```powershell
pnpm acceptance:check
pnpm d:gate:check
```

当前预期不是 `passed` 或 `go`，而是保留 `blocked`、`preparatory_not_accepted`、`goNoGoEligible=false`，并且 `eStarted=false`、`fStarted=false`。若脚本输出这些边界被放松，应先停止交接并查明原因。

## 手动演示与重置说明

### 通用准备

1. 启动 `pnpm dev`，打开 `http://127.0.0.1:5173/?scenario=success#/development/scenarios`。
2. 在“开发验收场景”确认 13 个场景可见；场景包括正常、空白、等待、超时、断网、权限拒绝、低置信、风险暂停、流中断、版本冲突、部分失败、邀请过期和供应配额不足。
3. 每个场景使用独立的演示命名空间；不要把一个场景的 IndexedDB 资料或截图当成另一个场景的证据。
4. 场景 A/B/C 的完整步骤以 `docs/implementation/demo-scenarios.md` 为准。场景脚本只覆盖共享前端和合成夹具，不覆盖真实账号、AI、原生权限、后台通知或跨应用媒体。

### 只重置当前场景

1. 在 `/development/scenarios` 点击“重置当前场景”。
2. 在确认框点击“确认重置当前场景”。
3. 页面会先发送 `nuanban:stop`，再清理当前场景的本机仓储、画稿和画稿任务，重新加载固定初始夹具。
4. 重新打开当前场景入口，确认当前场景回到基线；再切换到另一个场景，确认另一个场景资料未被清理。

这个操作只适用于 Mock/演示模式。代码按场景生成独立 `ownerId`：成功场景使用 `demo-local-owner`，其他场景使用 `demo-<scenario>-owner`。真实服务模式不得调用演示重置，不得把重置结果解释为云端删除或真实账号恢复。

### 重置或清空本机演示资料

在 `/settings` 使用以下两个不同入口，按验收目的选择：

- “重置合成演示数据”：恢复当前演示命名空间的初始笔记、待办、关系和设置，并清理画稿/画稿任务。
- “清空本机学习资料与画稿”：清空本机笔记、待办、演示关系、outbox、冲突草稿、画稿和画稿任务；不代表云端删除，也不影响系统权限。

清空后应重新打开 `/notes`、`/todos` 和 `/pets/draw`，确认不自动恢复示例。若浏览器 IndexedDB 因环境残留无法初始化，最后才使用浏览器对 `http://127.0.0.1:5173` 的“清除网站数据”；此兜底会清除该源下的全部演示场景，必须先记录场景 ID 和现场截图。

### 桌面与 Android 的重置边界

- Electron 桌面提醒仓储位于 Electron `app.getPath('userData')` 下的 `nuanban-reminders.sqlite`。退出应用后才可对合成开发数据做备份、改名或清除；不要猜测或批量删除用户目录，也不要把清除本机 SQLite 当作数据库降级。桌面当前 schema 为 v2，只保留 v1→v2 前向迁移预备证据，没有已签收的降级路径。
- Android 正常包的 Room schema 为 v3，已有 1→3 迁移预演和编译证据，没有真机旧库升级/恢复证据。真机到位后只能在合成数据上按设备记录执行“设置 → 应用 → 暖伴 → 存储 → 清除数据”或卸载重装；当前不得声称该路径已验证。
- Android `native-lab` 和桌面 native-lab 是独立实验命名空间；重置实验包不能代替正常候选包重置，也不能把实验结果写入主包签收。

## 包含能力

候选包可以被签收的范围仅限以下内容，且每项都要注明是 `ui`、`mock`、`local_real` 还是 `preflight` 层：

- React/TypeScript 共享页面、路由、设计样式和固定合成场景；桌面 Chrome 与移动视口布局、无水平溢出和页面错误的自动化回归。
- 应用内文字教学的分段、确认后推进、停止、迟到事件隔离、失败保留输入、低置信/风险暂停和恢复前重新确认。
- 本机 IndexedDB 的笔记、待办、画稿、冲突草稿、演示关系和场景命名空间；明确的重置、清空和草稿保留行为。
- 内置桌宠的本机 SVG 五官/颜色/姿态预览、确认应用和撤回；画稿任务仍是原画/演示流程。
- 键盘跳过链接、焦点回收、最大字号、减少动画、静音和语音不可用时的字幕降级自动化入口。
- Android 受限本地 WebView 页面、能力查询/停止/提醒桥接源码和 Debug 编译；Windows Electron 沙盒、context isolation、受限 IPC、本地提醒仓储及通知适配器的静态/合成装配。
- 包内容可追踪性：构建命令、路径、文件哈希、ASAR 主进程文件清单和证据索引。

“包含”只表示候选包中存在可复现的代码或预备层，不表示对应原生、云端或人工验收已通过。

## 不包含能力

以下能力不属于当前 D03 的已签收范围，也不能由本候选包或历史自动化推断：

- 真实账号、登录、监护/家属认证、免密凭证、真实儿童数据和云端授权。
- 真实 AI、多模态理解、OCR/敏感帧检测、ASR/TTS、真实生成资产、真实 3D 解析/渲染和儿童理解质量。
- Android/Windows 跨应用屏幕捕获、系统浮层、穿透、多屏/混合 DPI、真实停止副作用和生命周期清理。
- WebRTC/TURN/真实编码、接收端、亲情媒体出口、网络传输和真实供应凭证/区域/价格/配额/保留条款。
- Android 通知/AlarmManager/WorkManager 后台投递、Windows Toast、睡眠/锁屏/强停/退出/重启恢复和真实通知回执。
- 云同步、真实 HTTP/SSE/WS 后端、生产数据库、正式迁移/备份恢复、正式安装器、签名、升级和发布渠道。
- 真机人工读屏、人工体验、原生字幕、候选包负责人签收以及 D Go/No-Go 批准。

桌面 README 中的“提醒 payload 在 `safeStorage` 可用时单独加密”不能升级为整库加密；Android Room/通知编译、Chrome 合成通道和 JVM harness 也不能升级为设备通过。

## 负责人签收清单

项目计划中的角色代码是技能席位，不是已分配人员。以下空白必须由真实负责人填写；没有姓名、时间、环境和哈希的勾选不算签收。

| 签收项 | 责任席位 | 当前状态 | 必填记录 |
| --- | --- | --- | --- |
| 候选包目录、版本标签、构建命令、三端路径和 SHA-256 | F 共享前端 | 待签收 | 实际构建时间、Node/pnpm、产物哈希、范围变更 |
| 当前 Web UI 与 Android/Windows 包内 UI 逐项一致 | F，Q 见证 | 当前 Windows 开发包自动核对 6/6；Android 本轮未重新对齐；整体仍待签收 | 同一候选版本的 6 项 UI 哈希、双端差异说明、复核人 |
| 场景 A：老人学习视频通话前端流程 | F/P，D 参与 | 待本轮人工演示 | 场景 ID、视口、步骤、截图、失败/回退结果 |
| 场景 B：儿童作业辅导和画稿保留流程 | F/P，D 参与 | 待本轮人工演示 | 合成数据声明、草稿/失败回退、不得冒充 AI 的记录 |
| 场景 C：风险暂停、过期邀请、无人接听 | F/P，Q 见证 | 待本轮人工演示 | 停止事件、重新确认、邀请状态、无自动重连记录 |
| 重置当前场景不影响其他场景 | F，Q 复核 | 待本轮复核 | reset 前后 owner/scenario、资料计数、截图 |
| 设置页重置/清空路径和本机数据边界 | F，Q 复核 | 待本轮复核 | IndexedDB/画稿/outbox 清理结果，未宣称云端删除 |
| 键盘、焦点、大字号、减少动画、字幕降级人工体验 | D 设计/无障碍，Q 复核 | 未签收 | 真实读屏/人工步骤、设备、版本、缺陷与处理结论 |
| Android 包的 Debug/桥/Room 限制交接 | A Android | 未签收 | 真机或明确“未执行”记录；权限/调度/生命周期限制 |
| Windows 包的开发包/ASAR/系统能力限制交接 | W Windows/图形 | 未签收 | 重打包后的 ASAR/UI 哈希、系统版本、设备与限制 |
| 发布范围、是否允许进入 E 的决策 | P 项目/产品，Q 独立复核 | 未批准 | 明确 Go/No-Go、负责人姓名、签字时间、遗留风险 |

签收记录至少包含：`负责人姓名`、`角色`、`复核日期时间（Asia/Shanghai）`、`设备/浏览器/系统版本`、`候选包路径`、`SHA-256`、`实际步骤`、`结果`、`缺陷编号或阻塞原因`、`签名/确认方式`。自动化报告中的 `passed` 只能作为附件，不得填入人工签收栏代替负责人确认。

## 回滚与重置路径

### 候选包未通过时

1. 保持 D03 和 D 关口为 `blocked`，停止候选包推广，不启动 E/F。
2. 保存失败包的路径、哈希、日志、截图和复现步骤；不要用新构建覆盖失败包目录后再声称原包已复核。
3. 对 Web 仅回到上一个已保存且有完整哈希的静态目录；当前仓库没有 Git 提交基线，也没有记录为“已批准发布版”的候选包，因此不能虚构正式回滚版本。
4. 对桌面先退出应用并保留 `app.asar`、`nuanban.exe` 和 `userData` 数据库备份；若只是演示污染，按本文件的合成数据重置路径处理。不要对 v2 SQLite 做未经验证的降级迁移。
5. 对 Android 不做未经验证的数据库降级；在真机验证前只保留 Debug 包和日志，若需要清理合成数据，使用设备级清除数据/卸载重装并记录结果。

### 当前候选包需要重新同步时

1. 执行 `pnpm build`，记录新的 Web UI 哈希。
2. 执行 `pnpm android:build -Offline`，确认 APK 内 6 个 UI 文件与本轮 Web 哈希一致。
3. 本轮 `pnpm desktop:package` 及后置检查已确认 ASAR 内 6 个 UI 文件与本轮 Web 哈希一致；后续新版本须重跑。此次只解除包不同步这一项，不解除人工签收或 D 关口阻塞。
4. 重新执行候选包人工复核和 `pnpm acceptance:check`；不要直接沿用 2026-10-15 的 `artifacts.json` 哈希。
5. 只有负责人签收、独立复核和 D 关口输入齐全后，才可更新 D03 结论；本文件当前结论仍为 `blocked`。

## 解除 D03 阻塞的最小条件

- 由 F 负责人确认本轮候选包清单、构建时间、版本/环境和哈希；桌面包完成重新打包并与当前 Web UI 对齐。
- 在浏览器和候选包上重新执行三场景人工复核，保留步骤、视口、截图和失败回退记录。
- 由 Q 复核可复现命令、包内容和能力边界；由 D 完成人工体验/无障碍记录；涉及平台包时由 A/W 记录其真实限制或设备结果。
- 将人工签收记录与 `docs/implementation/evidence/acceptance-bundle-results.json`、`docs/implementation/evidence/d-gate-readiness-results.json` 关联保存。
- C15/C16 和 D07 的独立 Go/No-Go 前置仍需由各自负责人完成；D03 文档不能单独解除整个 D 关口，也不能授权 E/F。

## 证据索引

- 项目进度与状态：`docs/implementation/status.md`、`docs/implementation/current-iteration.md`、`docs/implementation/wbs.md`。
- D 关口边界：`docs/implementation/d-gate-readiness.md`、`docs/implementation/evidence/d-gate-readiness-results.json`。
- 场景和重放：`docs/implementation/demo-scenarios.md`、`docs/implementation/evidence/e2e-results.json`、`docs/implementation/evidence/e2e.txt`。
- 构建和产物：`docs/implementation/verification.md`、`docs/implementation/evidence/build.txt`、`docs/implementation/evidence/android-build.txt`、`docs/implementation/evidence/desktop-package.txt`、`docs/implementation/evidence/desktop-package-contents.txt`。
- 交接预检：`docs/implementation/evidence/acceptance-bundle-results.json`、`docs/implementation/acceptance.md`。
- Android 限制：`apps/android/README.md`、`docs/implementation/c07-c08-android-room.md`、`docs/implementation/evidence/android-assets.json`、`docs/implementation/evidence/android-lab.json`。
- Windows 限制：`apps/desktop/README.md`、`docs/implementation/evidence/desktop-lab-smoke.txt`、`docs/implementation/evidence/desktop-package-contents.txt`。

本文件随 D03/prep-02 更新当前候选清单；修复前快照和历史证据保留。本轮修复后 UI 证据见 `docs/implementation/evidence/d03-candidate-snapshot-rebuilt.json`；无障碍浏览器定向复跑见 `docs/implementation/evidence/d08-browser-accessibility-20261017.json`。这些均为本地预备证据，不替代同一版本的人工、真机、独立复核或 D 负责人批准。
