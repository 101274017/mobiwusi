#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy 微光指引 (nuanban) to a Windows Server host: IIS static site + Node backend + reverse proxy.

.DESCRIPTION
  Runs ON the target Windows Server 2022 instance, as SYSTEM / Administrator.
  Idempotent: safe to re-run for an upgrade. Keeps the previous web/app tree as *.prev.

  What it does:
    1. expands the payload zip (or uses an already extracted payload dir);
    2. swaps the static site payload into <Root>\web and the backend sources into <Root>\app;
    3. installs the IIS role when missing and points the default site at <Root>\web;
    4. installs Node.js >= 24 when missing (LTS MSI from a China-friendly mirror);
    5. registers the NuanbanServer scheduled task (boot start, auto restart) and starts the API;
    6. optionally installs IIS URL Rewrite + Application Request Routing and proxies
       /healthz and /v1/* to 127.0.0.1:<ApiPort> on the same origin;
    7. verifies the site and writes <Root>\logs\deploy-result.json.

  This is an owner-operated trial host, not a production release: it does not enable screen
  capture, microphone, cloud analysis, real suppliers or any release gate.

.PARAMETER Root
  Deployment root. Default C:\nuanban.

.PARAMETER PayloadDir
  Already extracted payload directory (contains web/, app/, config/, scripts/).
  When omitted, <Root>\staging\payload.zip is expanded into a new directory.

.PARAMETER HttpPort
  Public HTTP port for the static site. Default 80.

.PARAMETER ApiPort
  Loopback port for the Node API. Default 3000. Keep it on 127.0.0.1.

.PARAMETER SkipProxy
  Do not install URL Rewrite / ARR and do not expose the API through the site origin.

.PARAMETER SkipNodeInstall
  Fail instead of downloading Node.js. Useful when the host must stay offline.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy-server.ps1 -PayloadDir C:\nuanban\staging\extract
#>
[CmdletBinding()]
param(
  [string]$Root = 'C:\nuanban',
  [string]$PayloadDir = '',
  [int]$HttpPort = 80,
  [int]$ApiPort = 3000,
  [switch]$SkipProxy,
  [switch]$SkipNodeInstall
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$staging = Join-Path $Root 'staging'
$logs = Join-Path $Root 'logs'
$nodeVersion = 'v24.22.1'
$taskName = 'NuanbanServer'
$siteName = 'Default Web Site'

foreach ($d in @($Root, $staging, $logs, (Join-Path $Root 'data'))) {
  if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

$logFile = Join-Path $logs "deploy-$stamp.log"
$transcript = $false
try { Start-Transcript -Path $logFile -Force | Out-Null; $transcript = $true } catch { }

$summary = [ordered]@{
  stamp           = $stamp
  root            = $Root
  httpPort        = $HttpPort
  apiPort         = $ApiPort
  ok              = $false
  error           = $null
  recovery        = $null
  iisInstalled    = $false
  iisRestarted    = $false
  nodeVersion     = $null
  nodeInstalled   = $false
  proxyEnabled    = $false
  proxyNote       = $null
  checks          = [ordered]@{}
}

# Tracks whether the running service was torn down, so the catch block can restore it.
$serviceTornDown = $false

function Say([string]$message) { Write-Host "[nuanban-deploy] $message" }

function Get-NodeExe {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    'C:\Program Files\nodejs\node.exe'
  )
  foreach ($c in $candidates) { if (Test-Path -LiteralPath $c) { return $c } }
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Invoke-SilentMsi([string]$msiPath) {
  $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', "`"$msiPath`"", '/qn', '/norestart') -Wait -PassThru
  return $proc.ExitCode
}

function Download-First([string[]]$urls, [string]$destination, [int64]$minBytes = 1) {
  foreach ($u in $urls) {
    try {
      Say "downloading $u"
      if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
      Invoke-WebRequest -Uri $u -OutFile $destination -UseBasicParsing -TimeoutSec 600
      $len = (Get-Item -LiteralPath $destination).Length
      if ($len -ge $minBytes) { return $true }
      Say "downloaded file too small ($len bytes) from $u"
    } catch {
      Say "download failed from $u : $($_.Exception.Message)"
    }
  }
  return $false
}

function Get-HttpStatus([string]$url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 0
    return [int]$r.StatusCode
  } catch {
    try { return [int]$_.Exception.Response.StatusCode } catch { return 0 }
  }
}

function Get-HttpBody([string]$url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
    return [string]$r.Content
  } catch { return '' }
}

# Native tools such as appcmd/icacls write diagnostics to stderr. Under
# $ErrorActionPreference = 'Stop' PowerShell turns those lines into terminating errors,
# so run them in an isolated scope and report the exit code instead.
function Invoke-Native([string]$exe, [string[]]$arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $exe @arguments 2>&1
    $code = $LASTEXITCODE
    return [pscustomobject]@{ exitCode = $code; output = ($output | Out-String).Trim() }
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Swap-Directory([string]$source, [string]$target, [string]$previous) {
  if (Test-Path -LiteralPath $previous) { Remove-Item -LiteralPath $previous -Recurse -Force }
  if (-not (Test-Path -LiteralPath $target)) {
    Move-Item -LiteralPath $source -Destination $target -Force
    return
  }
  $serviceStopped = $false
  try {
    try {
      Move-Item -LiteralPath $target -Destination $previous -Force
    } catch {
      Say "move of $target failed, stopping W3SVC for the swap"
      try { Stop-Service -Name W3SVC -Force -ErrorAction Stop; $serviceStopped = $true } catch { }
      Start-Sleep -Seconds 2
      Move-Item -LiteralPath $target -Destination $previous -Force
    }
    Move-Item -LiteralPath $source -Destination $target -Force
  } finally {
    if ($serviceStopped) {
      try { Start-Service -Name W3SVC -ErrorAction Stop; Say 'W3SVC restarted after swap' } catch { }
    }
  }
}

try {
  Say "deploy start (stamp $stamp)"

  # ---------------------------------------------------------------- payload
  if ([string]::IsNullOrWhiteSpace($PayloadDir)) {
    $zip = Join-Path $staging 'payload.zip'
    if (-not (Test-Path -LiteralPath $zip)) { throw "payload zip not found: $zip" }
    $PayloadDir = Join-Path $staging "extract-$stamp"
    if (Test-Path -LiteralPath $PayloadDir) { Remove-Item -LiteralPath $PayloadDir -Recurse -Force }
    Say "expanding $zip"
    Expand-Archive -LiteralPath $zip -DestinationPath $PayloadDir -Force
  }
  $payloadWeb = Join-Path $PayloadDir 'web'
  $payloadApp = Join-Path $PayloadDir 'app'
  $payloadConfig = Join-Path $PayloadDir 'config'
  $payloadScripts = Join-Path $PayloadDir 'scripts'
  foreach ($p in @($payloadWeb, $payloadApp, $payloadConfig, $payloadScripts)) {
    if (-not (Test-Path -LiteralPath $p)) { throw "payload is missing required directory: $p" }
  }
  $manifestPath = Join-Path $PayloadDir 'manifest.json'
  if (Test-Path -LiteralPath $manifestPath) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $summary['payloadCommit'] = $manifest.gitCommit
    $summary['payloadBuiltAt'] = $manifest.builtAt
    Say "payload commit $($manifest.gitCommit) built $($manifest.builtAt)"
  }

  # ---------------------------------------------------------------- teardown
  # The running supervisor holds C:\nuanban\app as its working directory, which blocks the
  # directory swap below on Windows. Stop the task and every supervisor instance first.
  $startScript = Join-Path $Root 'scripts\start-server.ps1'
  $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($existingTask) {
    try { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue } catch { }
    try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop } catch {
      Say "could not unregister previous task: $($_.Exception.Message)"
    }
  }
  $serviceTornDown = $true
  try {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains($startScript) } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch { }
  try {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains('src/main.ts') } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch { }
  try {
    Get-NetTCPConnection -LocalPort $ApiPort -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  } catch { }
  Start-Sleep -Seconds 2
  Say 'previous service instance stopped'

  # ---------------------------------------------------------------- web swap
  $web = Join-Path $Root 'web'
  $webPrev = Join-Path $Root 'web.prev'
  Swap-Directory -source $payloadWeb -target $web -previous $webPrev
  Copy-Item -LiteralPath (Join-Path $payloadConfig 'web.config.base') -Destination (Join-Path $web 'web.config') -Force
  Say "static payload installed at $web"

  # ---------------------------------------------------------------- app swap
  $app = Join-Path $Root 'app'
  $appPrev = Join-Path $Root 'app.prev'
  Swap-Directory -source $payloadApp -target $app -previous $appPrev
  Say "backend sources installed at $app"

  $scriptsDir = Join-Path $Root 'scripts'
  if (Test-Path -LiteralPath $scriptsDir) { Remove-Item -LiteralPath $scriptsDir -Recurse -Force }
  Copy-Item -LiteralPath $payloadScripts -Destination $scriptsDir -Recurse -Force
  Say "service scripts installed at $scriptsDir"

  # ---------------------------------------------------------------- IIS role
  $appcmd = Join-Path $env:SystemRoot 'System32\inetsrv\appcmd.exe'
  $iisInstalled = Test-Path -LiteralPath $appcmd
  if (-not $iisInstalled) {
    Say 'installing IIS role'
    Import-Module ServerManager -ErrorAction SilentlyContinue
    $features = @(
      'Web-Server', 'Web-Static-Content', 'Web-Default-Doc', 'Web-Http-Errors',
      'Web-Http-Logging', 'Web-Request-Monitor', 'Web-Filtering', 'Web-Mgmt-Console',
      'Web-Mgmt-Tools', 'Web-ISAPI-Ext', 'Web-WebSockets'
    )
    $result = Install-WindowsFeature -Name $features -IncludeManagementTools -ErrorAction Stop
    Say "IIS install success=$($result.Success) restart=$($result.RestartNeeded)"
    $iisInstalled = Test-Path -LiteralPath $appcmd
  }
  $summary['iisInstalled'] = $iisInstalled
  if (-not $iisInstalled) { throw 'IIS is not installed after Install-WindowsFeature' }
  try { Set-Service -Name W3SVC -StartupType Automatic -ErrorAction SilentlyContinue } catch { }
  try { Start-Service -Name W3SVC -ErrorAction Stop; Say 'W3SVC started' } catch { Say "W3SVC start: $($_.Exception.Message)" }

  Import-Module WebAdministration -ErrorAction Stop

  # ---------------------------------------------------------------- site config
  $site = Get-Website -Name $siteName -ErrorAction SilentlyContinue
  if (-not $site) { throw "IIS site '$siteName' not found" }
  $bindingOk = @($site.Bindings.Collection) | Where-Object { $_.bindingInformation -match "^\*:$HttpPort`:" }
  if (-not $bindingOk) {
    Say "adding http binding *:$HttpPort"
    New-WebBinding -Name $siteName -Protocol http -Port $HttpPort -IPAddress '*' -ErrorAction Stop | Out-Null
    $site = Get-Website -Name $siteName
  }
  Set-ItemProperty -Path "IIS:\Sites\$siteName" -Name physicalPath -Value $web
  try {
    $siteItem = Get-Item -Path "IIS:\Sites\$siteName" -ErrorAction Stop
    $poolName = [string]$siteItem.applicationPool
    if ($poolName) { Set-ItemProperty -Path "IIS:\AppPools\$poolName" -Name managedRuntimeVersion -Value '' }
  } catch {
    Say "app pool runtime set skipped: $($_.Exception.Message)"
  }
  # defaultDocument / directoryBrowse come from web.config, so no extra appcmd calls are needed.
  Say "site '$siteName' -> $web on port $HttpPort"

  # grant read access to the site tree
  $aclWeb = Invoke-Native 'icacls.exe' @($web, '/grant', 'IIS_IUSRS:(OI)(CI)(RX)', '/T', '/Q')
  if ($aclWeb.exitCode -ne 0) { Say "icacls note: $($aclWeb.output)" }
  $aclData = Invoke-Native 'icacls.exe' @((Join-Path $Root 'data'), '/grant', 'SYSTEM:(OI)(CI)F', '/T', '/Q')
  if ($aclData.exitCode -ne 0) { Say "icacls note: $($aclData.output)" }

  # ---------------------------------------------------------------- firewall
  $fwName = "Nuanban HTTP $HttpPort"
  if (-not (Get-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $HttpPort -Profile Any | Out-Null
    Say "firewall rule added for TCP $HttpPort"
  }

  # ---------------------------------------------------------------- node
  $nodeExe = Get-NodeExe
  $needNode = $true
  if ($nodeExe) {
    try {
      $raw = (& $nodeExe -v).Trim()
      $summary['nodeVersion'] = $raw
      $major = [int](($raw -replace '^v', '').Split('.')[0])
      if ($major -ge 24) { $needNode = $false }
    } catch { }
  }
  if ($needNode) {
    if ($SkipNodeInstall) { throw 'Node.js >= 24 is required and -SkipNodeInstall was set' }
    $msi = Join-Path $staging "node-$nodeVersion-x64.msi"
    $urls = @(
      "https://cdn.npmmirror.com/binaries/node/$nodeVersion/node-$nodeVersion-x64.msi",
      "https://npmmirror.com/mirrors/node/$nodeVersion/node-$nodeVersion-x64.msi",
      "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-x64.msi"
    )
    if (-not (Download-First -urls $urls -destination $msi -minBytes 20000000)) { throw 'could not download the Node.js MSI' }
    Say 'installing Node.js MSI (silent)'
    $code = Invoke-SilentMsi -msiPath $msi
    if ($code -ne 0 -and $code -ne 3010) { throw "Node.js MSI failed with exit code $code" }
    $summary['nodeInstalled'] = $true
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $nodeExe = Get-NodeExe
    if ($nodeExe) { $summary['nodeVersion'] = (& $nodeExe -v).Trim() } else { throw 'node.exe missing after MSI install' }
  }
  if (-not $nodeExe) { throw 'node.exe not found' }
  Say "node: $nodeExe $($summary['nodeVersion'])"

  # ---------------------------------------------------------------- api service
  $startScript = Join-Path $scriptsDir 'start-server.ps1'
  if (-not (Test-Path -LiteralPath $startScript)) { throw "missing start script: $startScript" }

  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  Say "scheduled task '$taskName' started"

  # wait for the API on loopback
  $apiUp = $false
  for ($i = 0; $i -lt 30; $i++) {
    if ((Get-HttpStatus -url "http://127.0.0.1:$ApiPort/healthz") -eq 200) { $apiUp = $true; break }
    Start-Sleep -Seconds 2
  }
  $summary['checks']['apiLoopbackHealthz'] = (Get-HttpStatus -url "http://127.0.0.1:$ApiPort/healthz")
  $summary['checks']['apiListenerCount'] = @(Get-NetTCPConnection -LocalPort $ApiPort -State Listen -ErrorAction SilentlyContinue).Count
  $summary['checks']['nodeProcessCount'] = @(Get-Process node -ErrorAction SilentlyContinue).Count
  if (-not $apiUp) {
    Say 'WARNING: API did not answer /healthz within 60s'
    $serverLog = Join-Path $logs 'server.log'
    if (Test-Path -LiteralPath $serverLog) {
      $summary['serverLogTail'] = (Get-Content -LiteralPath $serverLog -Tail 15) -join ' | '
      Say "server.log tail: $($summary['serverLogTail'])"
    }
    try {
      $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction Stop
      $summary['taskLastResult'] = $taskInfo.LastTaskResult
    } catch { }
  }

  # ---------------------------------------------------------------- reverse proxy
  if (-not $SkipProxy) {
    $modules = @()
    try { $modules = Get-WebGlobalModule -ErrorAction SilentlyContinue } catch { }
    $hasRewrite = @($modules | Where-Object { $_.Name -eq 'RewriteModule' }).Count -gt 0
    $hasArr = @($modules | Where-Object { $_.Name -eq 'ApplicationRequestRouting' }).Count -gt 0
    Say "modules: rewrite=$hasRewrite arr=$hasArr"
    if (-not $hasRewrite) {
      $msi = Join-Path $staging 'rewrite_amd64_en-US.msi'
      $urls = @(
        'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi'
      )
      if (Download-First -urls $urls -destination $msi -minBytes 1000000) {
        $code = Invoke-SilentMsi -msiPath $msi
        Say "url rewrite MSI exit $code"
        $hasRewrite = ($code -eq 0 -or $code -eq 3010)
      } else { $hasRewrite = $false }
    }
    if (-not $hasArr) {
      $msi = Join-Path $staging 'requestRouter_amd64.msi'
      $urls = @(
        'https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi'
      )
      if (Download-First -urls $urls -destination $msi -minBytes 1000000) {
        $code = Invoke-SilentMsi -msiPath $msi
        Say "arr MSI exit $code"
        $hasArr = ($code -eq 0 -or $code -eq 3010)
      } else { $hasArr = $false }
    }
    if ($hasRewrite -and $hasArr) {
      $proxyConfig = Invoke-Native $appcmd @('set', 'config', '-section:system.webServer/proxy', '/enabled:True', '/preserveHostHeader:True', '/commit:apphost')
      if ($proxyConfig.exitCode -ne 0) { Say "proxy enable note: $($proxyConfig.output)" }
      Copy-Item -LiteralPath (Join-Path $payloadConfig 'web.config.proxy') -Destination (Join-Path $web 'web.config') -Force
      $summary['proxyEnabled'] = $true
      Say 'same-origin proxy enabled for /healthz and /v1/*'
      Start-Sleep -Seconds 2
    } else {
      $summary['proxyNote'] = 'URL Rewrite / ARR unavailable; API stays on loopback only'
      Say 'WARNING: proxy modules unavailable, API stays on 127.0.0.1'
    }
  } else {
    $summary['proxyNote'] = 'skipped by parameter'
  }

  # ---------------------------------------------------------------- verify
  $summary['checks']['siteIndex'] = Get-HttpStatus -url "http://127.0.0.1:$HttpPort/"
  $summary['checks']['siteManifest'] = Get-HttpStatus -url "http://127.0.0.1:$HttpPort/models/lumi/character_manifest.json"
  $summary['checks']['siteFavicon'] = Get-HttpStatus -url "http://127.0.0.1:$HttpPort/favicon.svg"
  if ($summary['proxyEnabled']) {
    $summary['checks']['proxyHealthz'] = Get-HttpStatus -url "http://127.0.0.1:$HttpPort/healthz"
    $summary['checks']['proxyUnauthRelations'] = Get-HttpStatus -url "http://127.0.0.1:$HttpPort/v1/relations"
  }
  $indexHtml = Get-HttpBody -url "http://127.0.0.1:$HttpPort/"
  $summary['checks']['indexHasProductMarkup'] = ($indexHtml -match '<div id="root">')
  $healthz = Get-HttpBody -url "http://127.0.0.1:$ApiPort/healthz"
  if ($healthz) { $summary['checks']['healthzBody'] = $healthz }

  $required = @($summary['checks']['siteIndex'], $summary['checks']['siteManifest'], $summary['checks']['siteFavicon'])
  if ($required -contains 0 -or $required -contains 404) {
    throw "site verification failed: $($summary['checks'] | ConvertTo-Json -Compress)"
  }
  if (-not $apiUp) {
    throw "API /healthz did not answer on 127.0.0.1:$ApiPort; check $logs\server.log and the scheduled task result"
  }
  $summary['ok'] = $true
  Say 'deploy verified'
}
catch {
  $summary['ok'] = $false
  $summary['error'] = ($_.Exception.Message)
  Say "DEPLOY FAILED: $($_.Exception.Message)"
  Say $_.ScriptStackTrace

  # Best effort: never leave the site down or without its service after a half-finished swap.
  try {
    $recoverWeb = Join-Path $Root 'web'
    $recoverWebPrev = Join-Path $Root 'web.prev'
    if (-not (Test-Path -LiteralPath $recoverWeb) -and (Test-Path -LiteralPath $recoverWebPrev)) {
      Move-Item -LiteralPath $recoverWebPrev -Destination $recoverWeb -Force
      Say 'restored web from web.prev'
    }
    $recoverApp = Join-Path $Root 'app'
    $recoverAppPrev = Join-Path $Root 'app.prev'
    if (-not (Test-Path -LiteralPath $recoverApp) -and (Test-Path -LiteralPath $recoverAppPrev)) {
      Move-Item -LiteralPath $recoverAppPrev -Destination $recoverApp -Force
      Say 'restored app from app.prev'
    }
  } catch { Say "rollback note: $($_.Exception.Message)" }

  if ($serviceTornDown) {
    try {
      $recoverScript = Join-Path $Root 'scripts\start-server.ps1'
      if ((Test-Path -LiteralPath $recoverScript) -and (Test-Path -LiteralPath (Join-Path $Root 'app\apps\server'))) {
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$recoverScript`""
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
          -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
        Start-ScheduledTask -TaskName $taskName
        $summary['recovery'] = 'service task re-registered and started'
        Say 'recovery: service task re-registered and started'
      }
    } catch { Say "service recovery note: $($_.Exception.Message)" }
  }

  try {
    $svc = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -ne 'Running') {
      Start-Service -Name W3SVC -ErrorAction Stop
      $summary['recovery'] = ($summary['recovery'] + '; W3SVC started').Trim('; ')
      Say 'recovery: W3SVC started'
    }
  } catch { Say "W3SVC recovery note: $($_.Exception.Message)" }
}
finally {
  $resultPath = Join-Path $logs 'deploy-result.json'
  try { $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultPath -Encoding UTF8 } catch { }
  Write-Host '----- deploy summary -----'
  try { $summary | ConvertTo-Json -Depth 6 } catch { }
  if ($transcript) { try { Stop-Transcript | Out-Null } catch { } }
}

if (-not $summary['ok']) { exit 1 }
exit 0
