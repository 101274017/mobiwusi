# CLAUDE.md

> 文档同步：2026-10-22。产品显示名称为**微光指引**；[当前功能与平台边界](docs/implementation/product-current-state.md)统一说明现行入口、已实现范围和待验证能力。本文已有测试数字与生成日期仍只对应原批次，不因文档更新自动视为重新验收。

## Current product documentation

The user-visible name is 微光指引. Read [current product and feature status](docs/implementation/product-current-state.md) before using older task cards as evidence of current capabilities. Windows has separate continuous-observation and previewed single-frame guidance flows; neither permits automatic third-party input. Product renaming does not migrate package IDs, stored data, IPC channels, launch filenames, or the existing local wake vocabulary. Do not infer Android device readiness, successful WeChat guidance, cloud-account support, or release approval from a successful build or synthetic test.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

微光指引 (nuanban) is an AI public-welfare assistant. The repo is a pnpm monorepo (`apps/*`, `packages/*`) with a shared React frontend, a TypeScript backend, and Android and Windows (Electron) hosts. Node >= 24 and pnpm 9.12.0 are required (see `package.json`). Docs, UI strings and many comments are in Chinese.

The app is not production ready. The frontend defaults to a real empty local workspace without runtime mocks. Desktop text, image and read-only guidance use an explicitly configured OpenAI-compatible provider; provider credentials remain encrypted outside the repo and are decrypted only in the main process. Starting the backend does not grant real auth. Real devices, complete supplier integration, user consent, pilots and signed release are not accepted. Keep high-risk capabilities closed. Do not fake external evidence. See `docs/implementation/real-ai-provider.md`.

The current core product shape is defined by the three root `暖伴AI公益助手-*独立桌宠*.md` documents. The older V1.2 work-package plan is archived at `docs/暖伴AI公益助手-项目实施计划-Codex高效续作版(1).md`; keep its development/release gates separate. The latest run state and resume point are in `docs/execution/RUN.md`; migration scope and verification limits are in `docs/implementation/standalone-pet-migration.md`.

The Windows host now starts a standalone pet and lazily opens management. Closing management must not end the pet runtime. Observation and teaching are separate sessions; third-party applications are operated only by the user. Screen and microphone are off by default. Local detection and same-frame redaction precede every cloud egress; unknown, sensitive, stale, invalid-source or detector-failure states fail closed. Privacy resumption requires a new owner action, not background capture. Local wake must never fall back to continuous cloud ASR. Synthetic/self-UI checks are not external-app acceptance.

## Commands

Run from the repo root. Install with `pnpm install --frozen-lockfile` only if dependencies are missing.

```powershell
pnpm dev                 # web app (Vite) at http://127.0.0.1:5173, strictPort
pnpm server:dev          # backend at http://127.0.0.1:3000, in-memory store, /healthz
pnpm typecheck           # tsc --noEmit over apps/web, packages, tests
pnpm build               # typecheck, then vite build of @nuanban/web
pnpm test                # vitest run (all of tests/**/*.test.ts)
pnpm test:watch
pnpm check               # typecheck + test:evidence + check:boundaries (what CI runs first)
pnpm contracts:check     # generated contracts are up to date + Ajv validation
pnpm contracts:generate  # regenerate JSON Schema / OpenAPI / TS / Kotlin contracts
pnpm test:e2e            # Playwright, desktop and Pixel 7 projects
```

Single test or file:

```powershell
pnpm exec vitest run tests/domain/conversation.test.ts
pnpm exec vitest run tests/domain/conversation.test.ts -t "test name"
pnpm exec playwright test tests/e2e/<file> --project=desktop-chromium
```

Notes:
- Playwright starts `pnpm dev` itself and reuses an existing server outside CI. Check for existing listeners on `:5173` and `:3000` before starting servers. Locally set `$env:PLAYWRIGHT_CHANNEL='chrome'` to use installed Chrome. CI installs Playwright Chromium instead.
- Vitest is capped at 2 workers with serial files. Many tests spawn child processes, so long ones may need a larger timeout.
- The server runs TypeScript directly via `node --experimental-transform-types`. Use `NUANBAN_SERVER_STORAGE=sqlite` and `NUANBAN_SERVER_DB_PATH` for SQLite storage. `HOST` and `PORT` override the bind address.
- Frontend env (see `.env.example`): `VITE_API_MODE` (`local` or `real`), `VITE_PLATFORM_MODE`, `VITE_API_BASE_URL`. Mock mode and `VITE_MOCK_SCENARIO` are rejected; scenario URL parameters no longer alter runtime. Remote business mode requires `VITE_API_BASE_URL`. AI credentials must never be placed in `VITE_*`.
- Desktop: `pnpm desktop` (build, then Electron), `pnpm desktop:package`. Android: `pnpm android:build -Offline`, `pnpm android:sync`, plus `android:lab:*`. These need the Windows PowerShell scripts in `scripts/`.
- CI (`.github/workflows/ci.yml`, windows-latest) runs `pnpm check`, `contracts:check`, `build`, then `test:e2e`.

### Evidence-producing checks

Many `*:check` scripts (for example `privacy:c03:check`, `reminder:c07:c08:check`, `c17:assembly:check`, `acceptance:check`, `d:gate:check`) run a targeted vitest file or script and write JSON into `docs/implementation/evidence/`. `pnpm check` uses `test:evidence`, which writes `unit-results.json` and `unit.txt` there. Later gates (C14 to C17, acceptance bundle, D07) fingerprint source files and these evidence files. Editing tracked source or evidence can invalidate them, so rerun the relevant check after changes. `README.md` lists the full command set.

The development gate and the release gate are separate:
- `pnpm d07:decision:check` computes the development decision (`DEV_READY_WITH_EXTERNAL_PENDING` is expected).
- `pnpm d07:release:check` and `pnpm release:readiness:check --mode release --no-write` are expected to exit 1 while external conditions are missing. That is not a bug.
- `docs/implementation/external-capabilities.md` lists external gaps.

## Architecture

### Layering

The frontend is a ports-and-adapters design. `apps/web/src/composition.ts` is the composition root. It reads config and builds `AppServices` (`ownerId`, `repository`, `conversation`), selecting real local IndexedDB or explicit remote business adapters. Text and image questions use restricted desktop IPC; missing ports fail closed without fixed-answer fallback. Synthetic adapters live only in `tests/fixtures` and must not enter the product. UI code must not import adapters directly.

`scripts/check-boundaries.mjs` (part of `pnpm check`) enforces this:
- `packages/domain` must not import react, zustand, electron or other `@nuanban/*` packages.
- `apps/web/src` files other than `composition.ts` must not import `@nuanban/mocks`, `@nuanban/local-data` or fixtures.

Packages live under `packages/*` and are consumed as `@nuanban/<name>`. They resolve to `packages/<name>/src/index.ts` through tsconfig `paths` and through hand-maintained alias lists in `vitest.config.ts` and `apps/web/vite.config.ts`. A new package needs entries in all three places. The two alias lists differ, so check both.

Main groups:
- Core: `domain` (rules), `application` (service interfaces), `config`, `contracts`.
- Adapters: `api-client`, `local-data`, `platform-ports`, `sync-engine`.
- UI: `ui`, `design-tokens`, `accessibility-assets`, `flow-library`.
- Capability and safety engines, each with its own README and tests: `privacy` (frame gating), `media-relay`, `media-session`, `guidance-engine`, `reminder-engine`, `pet-engine`, `provider-sandbox`, `asset-service`, `quality-gates`.

### Contracts (single source)

`packages/contracts` holds the service contract (JSON Schemas, OpenAPI, generated TS and Kotlin DTOs). `scripts/generate-contracts.mjs` generates all outputs, and `contracts:check` fails if they drift. Do not hand-edit `*.generated.*` files. See `packages/contracts/README.md`. Kotlin consistency is checked by `contracts:kotlin:check` against fixtures from `scripts/generate-kotlin-fixtures.mjs`.

### Apps

- `apps/web`: React 19, react-router, zustand, Vite. Pages are in `src/pages`, store in `src/store.ts`.
- `apps/server`: dependency-free Node HTTP server (`http.ts` builds the app). It has device-challenge auth, accounts, relations, consent, family, sync and reminders. Storage is in-memory or SQLite (`repositories.ts`, `sqlite.ts`). Service modules are in `service-modules.ts`, with notes in `src/modules/README.md`. Server tests are in `tests/server`.
- `apps/desktop`: Electron host (CommonJS `.cjs`). Main-process code covers lifecycle, reminder store (SQLite over restricted IPC), notification adapter and reminder bridge. `native-lab/` holds the standalone C02 Windows verification sample.
- `apps/android`: Gradle project with the main WebView shell (Room reminder store, message bridge to the web app) and a standalone `native-lab/` (C01). `apps/android/.gradle` and `build/` are build output.

### Cross-cutting rules in the code

- Capture and media paths are fenced by "stop generations". Every frame, ticket, scheduled reminder and bridge message carries a generation, and late results after stop must be dropped. Lifecycle cleanup is coordinated in `platform-ports` (C09/C10).
- Per-account isolation uses `ownerId` in stores (IndexedDB, Room, SQLite).
- Runtime starts with empty `local-owner` data; legacy demo namespaces are not loaded or destructively erased. Scenario fixtures exist only in tests.
- Content that drives behavior lives in `content/` (personas, safety policy, flow drafts).

### Tests

`tests/` is organized by area (`domain`, `contract`, `platform`, `privacy`, `server`, `acceptance`, `e2e`, and others). `tests/acceptance` tests the gate scripts themselves. `tests/setup.ts` is the Vitest setup file. E2E specs in `tests/e2e` run against the Vite dev server in desktop and mobile viewports.

Task cards under `docs/execution` can be regenerated with `pnpm tasks:refresh`, and backups go to `docs/execution/.ef-card-backups`. Do not edit the backups.
