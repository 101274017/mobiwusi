# 微光指引 · 坐标与指向引擎

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

这是 C05/C06 的共享纯计算层，不读取屏幕、不创建浮层、不调用系统输入 API。

## 坐标规则

- 目标使用 `normalized-content` 坐标，必须绑定 `frameId`、`generation`、`displayId`、`windowId`、`transformId` 和 `layoutRevision`。
- `createAndroidFrameContext` 处理系统栏 inset、安全内容区、letterbox 和四向旋转。
- `createWindowsFrameContext` 处理显示器负坐标、窗口内容偏移、DIP 到物理像素缩放和变换代际。
- 目标过期、帧/布局/变换不匹配或坐标非法时，`evaluateTarget` 拒绝映射；`GuidanceTargetLifecycle` 转为 `low_confidence`。

## 儿童指向

`planChildPointer` 只返回桌宠渲染用的安全停靠点和避障路径。没有可达路径时返回 `unreachable`，不会猜测坐标，也不会点击、填表、提交或注入输入。

## 当前边界

`tests/domain/guidance-platform.test.ts` 的 9 项测试只证明合成向量和状态边界。Android 真机授权/浮层、Windows 多屏/混合 DPI/穿透、原生动画和人工可达性仍需 C01/C02 前置与人工验收。
