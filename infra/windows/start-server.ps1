#Requires -Version 5.1
<#
.SYNOPSIS
  Supervise the 寰厜鎸囧紩 (nuanban) API on 127.0.0.1:3000 for the NuanbanServer scheduled task.

.DESCRIPTION
  Runs as SYSTEM from Task Scheduler at boot. Sets the deployment environment, then keeps the
  TypeScript server alive in a restart loop (no build step, no node_modules). A global mutex
  makes sure only one supervisor instance runs, so a re-deploy cannot start a second API.

  Native Node diagnostics (ExperimentalWarning etc.) go to stderr. With
  $ErrorActionPreference = 'Stop' PowerShell would turn those lines into terminating
  errors, so this script keeps a non-terminating preference for the native calls and logs
  a UTF-8 transcript instead of the UTF-16 default of `*>>`.

  Scope notes:
    - binds to loopback only; the IIS reverse proxy is the only public path;
    - SQLite storage lives outside the repository, under <Root>\data;
    - starts no capture, microphone, cloud analysis or supplier integration.
#>
$ErrorActionPreference = 'Continue'
$Root = 'C:\nuanban'
$ApiPort = 3000

$logDir = Join-Path $Root 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$script:logFile = Join-Path $logDir 'server.log'

function Write-Log([string]$message) {
  try {
    $line = "[start-server] $(Get-Date -Format o) $message"
    Add-Content -LiteralPath $script:logFile -Value $line -Encoding UTF8
  } catch { }
}

# Single supervisor instance (task re-registration or a stray wrapper must not double-start).
$mutex = $null
try {
  $createdNew = $false
  $mutex = New-Object System.Threading.Mutex($true, 'Global\NuanbanServer', [ref]$createdNew)
  if (-not $createdNew) {
    Write-Log 'another supervisor already holds Global\NuanbanServer, exiting'
    exit 0
  }
} catch {
  Write-Log "mutex unavailable, continuing without single-instance guard: $($_.Exception.Message)"
}

if ((Test-Path -LiteralPath $script:logFile) -and ((Get-Item -LiteralPath $script:logFile).Length -gt 20MB)) {
  Move-Item -LiteralPath $script:logFile -Destination "$script:logFile.1" -Force
}

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

$env:HOST = '127.0.0.1'
$env:PORT = [string]$ApiPort
$env:NUANBAN_SERVER_STORAGE = 'sqlite'
$env:NUANBAN_SERVER_DB_PATH = Join-Path $Root 'data\server.sqlite'
$env:NUANBAN_SERVER_ENV = 'production'

Write-Log "supervisor start: node $(& $nodeExe -v 2>$null), dir=$serverDir, bind=127.0.0.1:$ApiPort, db=$($env:NUANBAN_SERVER_DB_PATH)"

$useTransformFlag = $true
$failures = 0
while ($true) {
  if (-not (Test-Path -LiteralPath $serverDir)) {
    Write-Log "server sources missing at $serverDir, retrying in 10s"
    Start-Sleep -Seconds 10
    continue
  }
  Set-Location -LiteralPath $serverDir
  if ($useTransformFlag) {
    & $nodeExe --experimental-transform-types --disable-warning=ExperimentalWarning 'src/main.ts' 2>&1 | Out-File -LiteralPath $script:logFile -Append -Encoding utf8
  } else {
    & $nodeExe 'src/main.ts' 2>&1 | Out-File -LiteralPath $script:logFile -Append -Encoding utf8
  }
  $code = $LASTEXITCODE
  if ($code -eq 9 -and $useTransformFlag) {
    Write-Log 'transform-types flag rejected by this Node build, falling back to default type stripping'
    $useTransformFlag = $false
    continue
  }
  $failures += 1
  $delay = if ($failures -le 2) { 5 } elseif ($failures -le 5) { 15 } else { 30 }
  Write-Log "node exited with code $code (failure $failures), restarting in ${delay}s"
  Start-Sleep -Seconds $delay
}
