#Requires -Version 5.1
<#
.SYNOPSIS
  Start the 微光指引 (nuanban) API on 127.0.0.1:3000 for the NuanbanServer scheduled task.

.DESCRIPTION
  Runs as SYSTEM from Task Scheduler at boot. Sets the deployment environment and runs the
  TypeScript server directly through Node's type stripping (no build step, no node_modules).

  Scope notes:
    - binds to loopback only; the IIS reverse proxy is the only public path;
    - SQLite storage lives outside the repository, under <Root>\data;
    - starts no capture, microphone, cloud analysis or supplier integration.
#>
$ErrorActionPreference = 'Stop'
$Root = 'C:\nuanban'
$ApiPort = 3000

$nodeExe = $null
foreach ($candidate in @((Join-Path $env:ProgramFiles 'nodejs\node.exe'), 'C:\Program Files\nodejs\node.exe')) {
  if (Test-Path -LiteralPath $candidate) { $nodeExe = $candidate; break }
}
if (-not $nodeExe) {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { $nodeExe = $cmd.Source }
}
if (-not $nodeExe) { throw 'node.exe not found; install Node.js >= 24 first' }

$serverDir = Join-Path $Root 'app\apps\server'
if (-not (Test-Path -LiteralPath $serverDir)) { throw "server sources missing at $serverDir" }
$logDir = Join-Path $Root 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir 'server.log'
if ((Test-Path -LiteralPath $logFile) -and ((Get-Item -LiteralPath $logFile).Length -gt 20MB)) {
  Move-Item -LiteralPath $logFile -Destination "$logFile.1" -Force
}

$env:HOST = '127.0.0.1'
$env:PORT = [string]$ApiPort
$env:NUANBAN_SERVER_STORAGE = 'sqlite'
$env:NUANBAN_SERVER_DB_PATH = Join-Path $Root 'data\server.sqlite'
$env:NUANBAN_SERVER_ENV = 'production'

Set-Location -LiteralPath $serverDir
Add-Content -LiteralPath $logFile -Value "[start-server] $(Get-Date -Format o) node $nodeExe"

# Prefer Node's explicit transform flag; fall back to plain type stripping when unsupported.
$probe = & $nodeExe --experimental-transform-types -e '0' 2>&1
if ($LASTEXITCODE -eq 0) {
  & $nodeExe --experimental-transform-types 'src/main.ts' *>> $logFile
} else {
  Add-Content -LiteralPath $logFile -Value "[start-server] transform flag unsupported, using default type stripping"
  & $nodeExe 'src/main.ts' *>> $logFile
}
exit $LASTEXITCODE
