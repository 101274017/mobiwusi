# C08 桌面 SQLite 本地提醒仓储

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

更新日期：2026-10-16（Asia/Shanghai）。本文件记录 C08 在 Windows Electron 主进程内新增的本地持久化预备层，不代表桌面通知或系统后台调度已验收。

## 已实现

- `apps/desktop/reminder-store.cjs` 使用 Electron/Node 内置 `node:sqlite.DatabaseSync`，在 `app.getPath('userData')` 下创建 `nuanban-reminders.sqlite`；当前仓储 schema 为 `v2`，新库写入版本元数据，已有 v1 库按列集识别后迁移。
- 主进程通过 `apps/desktop/main.cjs` 提供受信任主窗口 IPC：排程、读取、列表、取消、到期提交、回执和完成；`preload.cjs` 只暴露这些明确方法，不开放 Node 或任意文件访问。
- SQLite schema 有版本元数据、账号分区、到期索引和状态约束；同账号同提醒按排程版本实现幂等、旧版本拒绝和同版本内容冲突拒绝。
- 到期提交、取消、回执和完成支持实例 ID + 排程版本绑定；绑定不匹配时拒绝旧闹钟/旧通知污染当前排程，未绑定的旧仓储调用仍保持兼容。
- 已加入显式 `v1 → v2` 迁移：为旧库补充 `submitted_at`、`delivered_at`、`opened_at`、失败/错过/未知、完成和取消时间列，并保留已有提醒行；迁移在单个 SQLite 事务中执行，未知版本拒绝打开。
- 关闭并重新打开数据库后保留提醒；取消提醒不会在到期时重新提交；回执、完成和取消时间与状态一起持久化，回执时间倒退或终态覆盖会拒绝。
- 外部 URL、非法标识、非法时间和不可序列化 payload 在写入前拒绝。
- 主进程使用 Electron `safeStorage` 作为可选 payload 编解码器：可用时只加密 `payload_json`，数据库结构、状态和索引不加密；不可用时明确回报 `encryptedReminderPayload=false` 并保留明文兼容路径，遇到已有密文则拒绝读取。

## 桌面通知适配器预备层

- `apps/desktop/notification-adapter.cjs` 不创建定时器，也不扫描到期任务；调用方必须显式传入已到期且已通过本地仓储状态门控的提醒。
- 适配器要求注入的 Electron `Notification.isSupported()` 返回 `true` 且权限为 `granted`；否则返回 `unsupported`，不创建通知对象。
- 通知正文固定为非敏感文案，不包含 `payloadJson`、任务标题或深链；点击只把受限内部深链交给调用方，不能打开外部 URL。
- `show`、`click`、`failed` 事件分别产生 `delivered`、`opened`、`failed` 回执；同一活动实例幂等，内容冲突拒绝；`dispose()` 只关闭当前适配器持有的对象。
- 同一桌面通知的重复点击只派发一次打开事件；旧排程通知的回执和点击路由同时经过实例/版本校验，不能写入或打开已替换的提醒。
- `apps/desktop/reminder-notification-bridge.cjs` 已通过受限主进程 IPC 接入仓储和通知适配器：到期前先检查能力/权限，成功后持久化 `submitted`/`delivered`/`opened`/`failed` 回执，点击只向渲染器发送受限内部深链。主进程当前将权限报告为 `unknown`，因此不会实际提交系统通知；这只是保守装配与合成验证，不是 Windows Toast、权限、退出/睡眠/重启后的系统投递证明。

定向验证：

```text
pnpm desktop:reminder-store:check
pnpm desktop:notification:check
```

当前桌面仓储 10 项测试、通知适配器 5 项测试和主进程提醒桥 5 项测试通过，结果分别写入 `docs/implementation/evidence/desktop-reminder-store-results.json` 和 `docs/implementation/evidence/desktop-notification-adapter-results.json`。仓储测试同时验证 v1→v2 迁移、payload 落盘为 `safe-v1:` 密文、关闭重开后可解码、回执/完成/取消时间持久化、实例/版本绑定，以及 `safeStorage` 不可用时不伪称加密；通知测试验证显式能力/权限门控、非敏感正文、重复点击幂等、回执顺序、深链白名单、幂等和释放边界；桥测试验证到期门控、绑定提交、回执持久化、旧排程点击隔离、点击深链、取消/未到期和失败回执。Electron 44.7.2 的本机 Node 运行时确认提供 `node:sqlite.DatabaseSync`；这些只证明当前运行时的本机预备适配器，不等于已完成安装包、升级迁移演练、系统 Toast 或用户设备验收。

## 明确未完成

- 未接 Android Room、SQLite 整库加密、Windows 系统级通知/Toast、计划任务或其他系统后台调度；桌面通知模块只是显式调用的合成适配器，`safeStorage` 仅保护提醒 payload，不是整库加密或独立密钥管理验收。
- 未证明应用退出、睡眠、强停、重启后的系统投递、桌面通知展示和真实 `delivered/opened` 回执。
- 未接云同步、真实账号认证或远程服务；账号标识只是本地命名空间，不是身份认证。
- C07/C08 仍保持 `preparatory_not_accepted`，不能推动 D，也不能启动真实 E/F。
