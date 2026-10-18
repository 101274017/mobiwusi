# D03 预备检查记录

检查时间：2026-10-17T11:34:11.379+08:00（Asia/Shanghai）  
任务状态：`blocked / preparatory_not_accepted`  
性质：本机候选包字节比对结果登记与重置文档核对；不是人工验收、设备验收、发布批准或负责人签收。

## 范围与计划校验

- 对应计划 `暖伴AI公益助手-项目实施计划-Codex高效续作版.md#L330`，原行 SHA-256：`2e6112bfcdeb839f8a8f5a07f5454a081cdf3e8d618ce4c5a00a2a8b74608a6a`（UTF-8，不含换行）。
- 现有 `docs/implementation/d03-frontend-candidate-package.md` 保持不变；SHA-256：`353fbef107915c03a36117c79b44807c67293b1cd3d20c05b935f5bc6d3149f0`。
- 本轮只更新任务卡和本文；`docs/implementation/evidence/d03-candidate-snapshot-rebuilt.json` 仅作已存在的只读证据引用，没有改共享 RUN/history、D01/D02、其他任务、其他 evidence、源码或构建目录。

## 历史修复前现场（保留）

以下内容是修复前只读检查的历史现场，不代表当前重建候选包状态，也不应继续作为当前 `Web/ASAR` 的失败结论。

| 对象 | 本机事实 | 边界 |
| --- | --- | --- |
| Web dist | 6 文件；历史比较结果为 3/6 matched、3/6 mismatched | 未重新构建、未运行浏览器，不是候选包批准。 |
| 桌面目录 | 73 文件；历史记录只对 EXE/ASAR 计算整文件哈希，其余 runtime 仅计数 | 未启动、未签名、未生成安装器，不声明全目录逐项哈希已复核。 |
| ASAR | 历史记录为 17 个目录/文件条目，含 6 个 UI 文件 | 包内含文件不证明系统通知、后台投递、睡眠/退出/重启或真实设备通过。 |
| Web 对 ASAR | 历史逐项读取 6 个内层 UI：3 相同、3 不同 | 历史不同步结果已由修复后候选包重新比对；不把历史差异继续写成当前状态。 |

桌面 EXE：`apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe`，245589504 bytes，SHA-256 `db555f44e4719fdbda100902796a8ce5427a76533444ed0bfccee10332f7a229`。  
桌面 ASAR：`apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar`，582666 bytes，SHA-256 `b3022aed666dd2bfa2b0d6096732d7368df824357219da4867923eb553d6ce9c`。

### 历史三处不同步的精确源/目标哈希

目标均位于上述 `app.asar`；不是当前工作树同名文件。

| 当前 Web 源 | 源 SHA-256 | ASAR 目标条目 | 目标 SHA-256 |
| --- | --- | --- | --- |
| `apps/web/dist/index.html` | `e48a36ddf55d4a7ff687de94a79ffa1158b8b2e1e2ad84a6ad9751c6ff8106f8` | `ui/index.html` | `72ba4186453e2b29775e8320d6ee024e7762bcbf129ed828cc4d7dd6717a2b5f` |
| `apps/web/dist/assets/bootstrap-hAlCZebq.js` | `13ef81f5963bc2e0aa2ba4e1ef57da7d0a69aa06a69d45355abe8cd7eeffbfa5` | `ui/assets/bootstrap-DM2hlXN_.js` | `a3a22ffe1b01a0760512b407096143d0168419d8011a6454e9f89fa2b1f61f02` |
| `apps/web/dist/assets/index-CUiXrJUr.js` | `bbc0bab2589791f7cc60e6ee0f2f18c3f63cecc65a495071d733891e0512231f` | `ui/assets/index-C239dCop.js` | `694bb041412433742d7903ae4dd6eca9f3f53f92ed1faa110c39fcd31d43cdfc` |

同名且历史相同的三项为 `favicon.svg`、`assets/bootstrap-CVGnqZ7q.css`、`assets/index-Cne_RoAQ.css`；完整字节数与哈希见历史快照。上述三处差异只作为修复前现场保留，不作为当前候选包结论。

### 历史证据索引漂移

`artifacts.json` 为 2026-10-15 历史记录；`packagedUiMatchesWebBuild=true` 不能沿用于当前文件。下列三项索引哈希均已过时：

| 路径 | 索引 SHA-256 | 现场 SHA-256 |
| --- | --- | --- |
| `apps/web/dist/index.html` | `d6037397fd5ba5c2b97a60aacb714c21248d39b8a055698e78d24b9cacf77bed` | `e48a36ddf55d4a7ff687de94a79ffa1158b8b2e1e2ad84a6ad9751c6ff8106f8` |
| `apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe` | `3e623acb3d29088e35bb593a761c170633a18b5590ff701574ea8ed9741aad8d` | `db555f44e4719fdbda100902796a8ce5427a76533444ed0bfccee10332f7a229` |
| `apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar` | `ad41695ede6ca24fd5ccd6a578e5f3f5efe3feba1aff304d430ec73e57c6f741` | `b3022aed666dd2bfa2b0d6096732d7368df824357219da4867923eb553d6ce9c` |

索引的 6 个 UI 条目中，favicon 和两份 CSS 仍相同；index.html 已变化，两个旧 JS 路径已不存在；当前两个新 JS 路径未被旧索引收录。此处只记录漂移，不刷新索引，也不据此推断旧证据造假。Android APK 索引项不在本 D03 子任务的产物比对范围。

## 修复后候选包登记

- 证据路径：`docs/implementation/evidence/d03-candidate-snapshot-rebuilt.json`；生成时间：`2026-10-17T11:31:52.977+08:00`（快照原始时间 `2026-10-17T03:31:52.977Z`）。
- 检查器结果：`success=true`、`status=matched`、`acceptance=preparatory_not_accepted`；6 个 Web UI 文件中 `6/6 matched`、`0 mismatch`、`0 extra`、`0 error`。
- ASAR：`apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar`，593744 bytes，最新 SHA-256：`a4206de7e955b2ebdcf72397f177aa027817939dfabd09efd6659857ee1a725e`。
- EXE：`apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe`，245589504 bytes，最新整文件 SHA-256：`c8e551c11c5e33c7b5f48baa901c8acae76c1fd0e8bf6fcff0194edcf9a7bb20`。该 EXE 哈希是对应候选目录的本地整文件读取；`check-d03-candidate.mjs` 本身只把 ASAR 哈希写入报告。
- 六项逐文件源/目标字节数与 SHA-256 以 rebuilt evidence 为准；本记录不把该本地自动检查写成人工验收、发布批准或 Go/No-Go。

## 重置说明只读复核

现有候选说明第 175、184、193、247 行分别覆盖当前场景重置、本机资料重置/清空、原生数据边界和回滚限制：

- 场景页需明确确认，先发送 `nuanban:stop`，只重置当前合成命名空间；后续必须人工核对其他场景资料未变。
- 设置页“重置合成演示数据”与“清空本机学习资料与画稿”不同；需核对笔记、待办、关系、outbox、冲突/画稿和任务，不宣称云端删除。
- 清除同源网站数据会影响全部场景；只能作为记录现场后的兜底，不能冒充单场景隔离验证。
- 桌面只在退出并确认实际 userData 路径后处理合成 SQLite；v2 不存在已签收降级路径。Android Room v3 清除/重装和旧库恢复仍需真实设备记录；native-lab 不代替正常包。
- 本轮未执行任何重置、删除、浏览器演示或设备操作，未承诺重置可解决客户端网络重连。

## 实际命令与退出码

| 命令或只读检查 | 退出码 | 结果 | 副作用/限制 |
| --- | ---: | --- | --- |
| PowerShell `Get-FileHash -Algorithm SHA256`，计划原行 UTF-8 SHA-256 | 0 | 计划原行及候选说明、Web/EXE/ASAR、历史索引哈希已取得 | 不修改输入文件。 |
| `pnpm exec asar --version` | 0 | v4.3.1 | 只查本机已安装工具。 |
| `pnpm exec asar list apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar` | 0 | 17 个条目，包含 6 个 UI 文件 | 不抽取到磁盘、不重打包。 |
| 历史 Node `@electron/asar` + `path.normalize` + SHA-256 内存比对 | 0 | 历史六项完整比对：3 相同、3 不同；差异如上 | Windows 内层路径使用本机分隔符，仅内存读取；该结果不代表当前候选包。 |
| `node scripts/check-d03-candidate.mjs --evidence docs/implementation/evidence/d03-candidate-snapshot-rebuilt.json` | 0 | 修复后候选包：6/6 matched、0 mismatch、0 extra、0 error；报告 `status=matched` | 只比较当前 Web 构建与桌面 ASAR UI 文件集合及原始字节；不验证设备、人工、负责人或独立签收。 |
| `node scripts/check-acceptance-bundle.mjs --no-write` | 0 | `preparatory_ready` | 只输出终端；未提供 `--evidence`，不刷新共享 evidence。 |
| `node scripts/check-d-gate-readiness.mjs --no-write` | 0 | `blocked` | 只输出终端；未提供 `--evidence`，不刷新共享 evidence。 |
| Node 参考文件/证据哈希前后比对 | 0 | 写入前参考文件稳定；既有 evidence 的基线计数/摘要保存在快照 | 只检查当前文件，不升级历史自动化为人工验收。 |
| 历史快照 JSON/整文件/ASAR 内层哈希落盘复核 | 0 | 历史快照的声明文件与 6 个内层 UI 记录可复算；历史 evidence 基线未被该检查改写 | 该行属于修复前记录；当前 6/6 结果以 rebuilt evidence 为准。 |
| 本轮 `apply_patch` 限定 D03 文档更新 | 0 | 仅更新 `docs/execution/tasks/D03.md` 和本文，并登记已存在的 rebuilt evidence 路径 | 未写共享 RUN/history、其他 evidence、源码或构建目录；本轮未运行长时间构建或测试。 |

只读探索中 `require('asar')` 曾退出 1（正确包名为 `@electron/asar`）；另一轮按斜杠路径读取嵌套条目的探索退出 1，其他被捕获的路径探测曾显示假缺失。已用 `@electron/asar` 和 `path.normalize` 完整重跑得到六项有效结果；这些探索错误不被写成真实包缺失。

历史 gate 脚本调用已确认其写盘边界；修复后候选包报告由 `check-d03-candidate.mjs` 生成并登记为 `d03-candidate-snapshot-rebuilt.json`。本轮只更新两份 D03 文档，未重新运行构建、打包、E2E、安装、设备操作或长时间测试；父任务独立输出的浏览器测试不计入本子任务。

## 剩余阻塞与交接

1. 修复后候选包的本地 Web/ASAR 比对已为 6/6 matched、0 mismatch、0 extra；历史 3/6 现场继续保留，不能覆盖为当前结论，也不能据此直接签收。
2. 真实负责人仍需记录姓名、日期/环境、候选路径/哈希、范围和实际步骤；F/Q 独立复核者仍需对同一候选版本复核，场景 A/B/C、隔离重置/清空及失败回退尚未签收。
3. D 人工读屏/体验与 A/W 真实设备及限制交接仍需独立执行；Android/Windows 设备、真实读屏、系统权限和后台能力均未由本地脚本证明。
4. C15 真实设备/供应/独立复核、C16 决策/Top20/试点输入和 D07 授权仍是关口前置；D03 继续保持 blocked，不启动 E/F。

本子任务仅完成本地预备记录与候选包字节比对登记，D03 保持 `blocked / preparatory_not_accepted`；不构成人工验收、发布批准、Go/No-Go，不启动 E/F。
