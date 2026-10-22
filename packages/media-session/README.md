# 微光指引 · Media session

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

This package is the E10 controlled-session boundary. It models invitation, acceptance, short leases, grant revisions, disconnect/expiry termination, runtime stop fencing, and allocation release through injected ports.

The default ports are in-memory only. `SyntheticMediaTicketPort` returns a clearly synthetic relay-only fixture and never contacts TURN, signaling, WebRTC, or a provider. Real credentials, TURN allocation, WebRTC device behavior, and on-device acceptance remain outside this package.

Revocation increments the session generation, marks the lease unusable, aborts pending allocation, stops the runtime, and releases the allocation. A late allocation result is rejected and released instead of becoming active.
