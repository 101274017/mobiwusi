# 微光指引 · C07/C08 SQLite 预备实验

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

日期：2026-10-16。这个脚本是实施计划 C07/C08 的**独立预备层**，不是 Electron 生产能力、Android Room 实现或系统提醒验收。

## 边界

- 使用当前 Node `v24.21.0` 的 `node:sqlite.DatabaseSync`，脚本位于独立 native-lab 目录，不由 Electron 44.7.2 加载。
- 覆盖独立 SQLite schema 创建/重复打开、账号分区、同版本幂等、旧版本拒绝、同版本冲突、取消后到期不提交，以及关闭后重新打开仍能读取 `submitted` 状态；生产 Electron 仓储另有 v1→v2 迁移测试。
- 测试数据只写入临时目录，脚本结束后删除；不连接网络、不接真实账号、不写生产数据库、不发送通知。

## 命令

在项目根目录执行：

```powershell
pnpm sqlite:c07:c08:check
```

命令会运行 `apps/desktop/native-lab/c07-c08-sqlite-preflight.mjs`，并写入 `docs/implementation/evidence/sqlite-c07-c08-results.json`。

## 未完成项

- Android Room、通知权限、AlarmManager/WorkManager、强停/后台/重启与真实设备回执仍未接入。
- Windows 加密密钥保护、Toast/计划任务、退出/睡眠/重启和用户看到回执仍未接入。
- 该脚本证明的是本地 SQLite 事务/持久化预备规则，不证明 Electron 原生模块兼容、系统调度、后台送达或 C07/C08/NV-02 通过。
