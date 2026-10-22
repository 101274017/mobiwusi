# 微光指引 · Platform ports and lifecycle cleanup

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

`ReminderRuntime` 将待办生命周期转换为稳定的共享排程请求。浏览器端只返回 `page_only`；Windows 宿主只有在显式暴露 `reminderStore` 时才接收本地 SQLite 排程、取消和到期派发请求；Android 正常 app 已通过受限活动消息桥接收 Room/AlarmManager 排程、取消和到期请求，但通知权限、精确闹钟和系统投递未验证时仍返回 `unsupported`。

`LifecycleCoordinator` 是 C09/C10 的共享清理预备层。它把 Android 与 Windows 的生命周期信号映射到同一条安全清理顺序：关闭出口、失效当前代际、清空队列、停止轨道并隐藏浮层。

`bindLifecycleEvents` 将固定的宿主事件名装配到协调器：Android 支持暂停、销毁和权限撤回；Windows 支持退出、渲染器退出、窗口移动和递归捕获预留事件。解绑后不再处理事件，重复或并发停止共享协调器的清理结果。Windows 主进程另有 `apps/desktop/lifecycle.cjs` 合并退出、渲染器退出和 IPC 停止请求。

它只接收注入的资源端口，不调用系统捕获、通知、浮层或输入 API。清理失败时保持停止并阻止当前进程重新开始；新建协调器默认为 `idle`，不会因进程重启自动恢复采集。

真实锁屏、撤权、进程终止、窗口移动、递归捕获、系统资源释放和人工复核仍需设备证据，不能用这组规则测试替代。
