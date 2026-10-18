# Server skeleton

This is the first TypeScript modular-monolith skeleton for E07 and the minimum E01/E02 auth, relation, and consent flows. It uses Node's built-in `http` server and only replaceable repository interfaces.

`InMemoryRepositories` is a development and test implementation only. It is not a production database: it has no durability, transactions, backup, multi-process coordination, or operational retention controls. A production adapter must implement `ServerRepositories` before deployment.

Implemented routes are the contract-backed `/healthz`, `/v1/auth/device-challenges`, `/v1/auth/device-exchange`, `/v1/auth/refresh`, `/v1/devices/:id`, `/v1/relations/**`, and `/v1/consents/**` routes. All JSON responses use the contract version, request correlation, and unified error envelope.

Start the development server with `pnpm --filter @nuanban/server start`. It binds to `HOST` (default `127.0.0.1`) and `PORT` (default `3000`). Run `pnpm --filter @nuanban/server check` for the native Node TypeScript syntax check.

The default server storage is in-memory. To opt into the local SQLite adapter, set `NUANBAN_SERVER_STORAGE=sqlite`; `NUANBAN_SERVER_ENV` selects the isolated environment and `NUANBAN_SERVER_DB_PATH` explicitly selects the database file. If the path is omitted, the adapter uses an environment-specific file under the current user's `.nuanban/server` directory, outside the repository. Runtime device secrets are supplied through the application boundary and are not checked into source control.

Extension packages can inject `ServerOptions.hooks.onRequest`, `resolveActor`, `onRoute`, and `onResponse`. `onRoute` receives the request context, a lazy `getActor()` resolver, and `respond()`; it can return `{ status, data }` for a JSON route or return `true` after writing a streaming response.

