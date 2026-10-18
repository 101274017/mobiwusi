$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path -LiteralPath 'node_modules')) { pnpm install --frozen-lockfile; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
pnpm dev
