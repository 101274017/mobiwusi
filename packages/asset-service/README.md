# 微光指引 · Asset service

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](../../docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

This package implements the E06/E09 asset boundary without a server, network client, provider credential, or claim of real generated quality. `PetGenerationPort` and the signing/verification ports are injected; the in-memory stores are test fixtures.

- generation jobs are owner-authorized, queryable, cancellable, and generation-fenced;
- generated bundles must pass the existing local pet-engine structural gate and file/hash checks;
- assets are saved as preview-only and never replace the current pet until the owner confirms the preview;
- cancelled, stale, malformed, or hash-mismatched output is never applied;
- flow/config releases are canonicalized, signed, verified, versioned, and rollbackable;
- production signing keys, provider quality, network access, and human design review remain outside this package.
