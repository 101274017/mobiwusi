# 微光指引 · Sync engine

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

This package is a pure TypeScript first implementation for E03, E04, and E05.

`SyncStore`, `ReminderStore`, `TaskQueuePort`, `ReminderDeliveryPort`, and `ObjectAuthorizer` are replacement ports. The included memory implementations are deterministic test doubles: they do not perform network requests or real push delivery. A production adapter can implement the same ports with a database, durable queue, worker, and explicit object authorization service.

The services enforce versioned writes, mutation idempotency, outbox/change records, owner plus object authorization, tombstones, timezone and repeat validation, stable reminder occurrence IDs, explicit reminder receipt transitions, and recovery of running queue tasks after restart.

## Guarantees

- `SyncService` checks authorization before idempotent replay, scopes mutation receipts by actor and owner, rejects mutation ID reuse with a different intent, and records the entity change and outbox item in the same `SyncStore.transaction`.
- Changes use a cursor bound to both actor and subject. Unauthorized change sequences are consumed without being returned, while page boundaries never skip a later authorized change.
- Deleted records remain as tombstones. Update and create operations cannot resurrect or overwrite a tombstone, and delete changes carry a null entity payload while the store retains the tombstone.
- Todo `scheduleRevision` changes only when reminder timing or repeat rules change, so title edits do not invalidate an existing occurrence. Completion is bound to the current occurrence and is idempotent for the same completed instance.
- Reminder tasks use a lease token, expiry, retry timestamp, and stable delivery idempotency key. A delivery failure keeps the occurrence at `submitted` and requeues it; `delivered`, `opened`, and `completed` are separate transitions.

`SyncStore`, `ReminderStore`, `TaskQueuePort`, `ReminderDeliveryPort`, and `ObjectAuthorizer` remain injectable ports. The in-memory adapters provide deterministic rollback, restart snapshots, lease recovery, and delivery deduplication for tests; production adapters are responsible for durable transactions and queues.
