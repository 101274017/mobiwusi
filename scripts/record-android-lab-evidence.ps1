param([string]$SdkRoot)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $SdkRoot) { $SdkRoot = $env:ANDROID_HOME }
if (-not $SdkRoot) { $SdkRoot = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$aapt = Join-Path $SdkRoot 'build-tools/36.0.0/aapt.exe'
if (-not (Test-Path -LiteralPath $aapt)) { throw 'Android SDK build-tools 36.0.0 are required. Pass -SdkRoot.' }

function Get-Sha256([string]$Path) {
  $digest = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($digest.ComputeHash([IO.File]::ReadAllBytes($Path)))).Replace('-', '').ToLowerInvariant() }
  finally { $digest.Dispose() }
}

$evidence = Join-Path $root 'docs/implementation/evidence'
$apkRelative = 'apps/android/native-lab/build/outputs/apk/debug/native-lab-debug.apk'
$apk = Get-Item -LiteralPath (Join-Path $root $apkRelative)
$lab = Join-Path $root 'apps/android/native-lab'
$inputs = @(Get-ChildItem -LiteralPath (Join-Path $lab 'src/main') -Recurse -File | ForEach-Object FullName)
$inputs += Join-Path $lab 'build.gradle.kts'
$inputs += Join-Path $root 'apps/android/build.gradle.kts'
$inputs += Join-Path $root 'apps/android/settings.gradle.kts'
$inputs += Join-Path $root 'apps/android/gradle.properties'
$sourceHashes = [ordered]@{}
foreach ($inputPath in $inputs) {
  if ((Get-Item -LiteralPath $inputPath).LastWriteTimeUtc -gt $apk.LastWriteTimeUtc) { throw "Source is newer than APK; rebuild first: $inputPath" }
  $relative = $inputPath.Substring($root.Length + 1).Replace('\', '/')
  $sourceHashes[$relative] = Get-Sha256 $inputPath
}
$buildLog = Join-Path $evidence 'android-lab-build.txt'
$lintLog = Join-Path $evidence 'android-lab-lint.txt'
foreach ($logPath in @($buildLog, $lintLog)) {
  if ((Get-Content -LiteralPath $logPath -Raw) -notmatch 'BUILD SUCCESSFUL') { throw "No successful build/lint log: $logPath" }
}
$jvm = Get-Content -LiteralPath (Join-Path $evidence 'android-lab-jvm.json') -Raw | ConvertFrom-Json
if (-not $jvm.passed -or $jvm.deviceVerified -or $jvm.captureVerified) { throw 'Expected a passing JVM-only report.' }
foreach ($property in $jvm.sourceSha256.PSObject.Properties) {
  if ((Get-Sha256 (Join-Path $root $property.Name)) -ne $property.Value) { throw "JVM evidence is stale: $($property.Name)" }
}
$lintPath = Join-Path $lab 'build/reports/lint-results-debug.xml'
[xml]$lint = Get-Content -LiteralPath $lintPath -Raw
$issues = @($lint.issues.issue)
$lintErrors = @($issues | Where-Object { $_.severity -in @('Error', 'Fatal') })
if ($lintErrors.Count -ne 0) { throw 'Android Lint has errors.' }
$warnings = @($issues | Where-Object { $_.severity -eq 'Warning' } | Group-Object id | ForEach-Object { [ordered]@{ id = $_.Name; count = $_.Count } })
$permissionsText = & $aapt dump permissions $apk.FullName
if ($LASTEXITCODE -ne 0) { throw 'Failed to inspect packaged permissions.' }
if (($permissionsText -join "`n") -notmatch 'package: org\.nuanban\.nativelab(?:\s|$)') { throw 'Unexpected APK application ID.' }
$permissions = @($permissionsText | ForEach-Object { if ($_ -match "^uses-permission: name='([^']+)'") { $Matches[1] } } | Sort-Object)
$expected = @('android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION', 'android.permission.POST_NOTIFICATIONS', 'android.permission.SYSTEM_ALERT_WINDOW')
if (@(Compare-Object $expected $permissions).Count -ne 0) { throw 'Unexpected native lab permissions.' }
$normalManifest = Get-Content -LiteralPath (Join-Path $root 'apps/android/app/src/main/AndroidManifest.xml') -Raw
if ($normalManifest -match '<uses-permission\b') { throw 'Normal demo permissions changed; review isolation.' }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($apk.FullName)
$dexClasses = [ordered]@{}
try {
  $entries = @($archive.Entries)
  if (@($entries | Where-Object { $_.FullName -match '^assets/.*\.(html|js)$' }).Count -ne 0) { throw 'Native lab must not package Web UI.' }
  $dexText = ''
  foreach ($entry in ($entries | Where-Object { $_.FullName -match '^classes\d*\.dex$' })) {
    $stream = $entry.Open()
    $memory = New-Object IO.MemoryStream
    try { $stream.CopyTo($memory); $dexText += [Text.Encoding]::ASCII.GetString($memory.ToArray()) }
    finally { $stream.Dispose(); $memory.Dispose() }
  }
  foreach ($name in @('CaptureLabActivity', 'CaptureLabService', 'LabSession', 'LabTicket')) {
    $found = $dexText.Contains("Lorg/nuanban/nativelab/$name;")
    if (-not $found) { throw "Missing native class in DEX: $name" }
    $dexClasses[$name] = $found
  }
} finally { $archive.Dispose() }
$adb = Join-Path $SdkRoot 'platform-tools/adb.exe'
$deviceCount = $null
if (Test-Path -LiteralPath $adb) {
  $devices = & $adb devices -l
  if ($LASTEXITCODE -ne 0) { throw 'ADB device enumeration failed.' }
  $deviceCount = @($devices | Where-Object { $_ -match '^\S+\s+(device|offline|unauthorized)(?:\s|$)' }).Count
}
$report = [ordered]@{
  generatedAt = (Get-Date -Format o)
  generatedTimeZone = 'Asia/Shanghai'
  scope = 'C01-preparatory-build-static-and-jvm-only'
  artifact = [ordered]@{ path = $apkRelative; bytes = $apk.Length; sha256 = (Get-Sha256 $apk.FullName); debugSigned = $true; productionRelease = $false }
  permissions = $permissions
  normalDemoSourcePermissionsUnchanged = $true
  webUiAssetsPresent = $false
  classesInDex = $dexClasses
  jvmCases = $jvm.cases
  lint = [ordered]@{ errors = $lintErrors.Count; warnings = $warnings; reportSha256 = (Get-Sha256 $lintPath) }
  logs = [ordered]@{ buildSha256 = (Get-Sha256 $buildLog); lintSha256 = (Get-Sha256 $lintLog) }
  sourceSha256 = $sourceHashes
  connectedAdbDeviceCount = $deviceCount
  installedByAgent = $false
  launchedByAgent = $false
  deviceVerified = $false
  captureVerified = $false
  overlayVerified = $false
  systemPermissionGranted = $false
  independentAcceptance = $false
  limitations = @(
    '仅覆盖独立 native-lab 的源码、Debug APK、JVM 状态机和本机 ADB 枚举。',
    '没有安装、启动或授权 Android 真机，也没有跨应用捕获、浮层或系统资源释放记录。',
    'deviceVerified、captureVerified、overlayVerified、systemPermissionGranted 和 independentAcceptance 保持 false。'
  )
}
$json = $report | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText((Join-Path $evidence 'android-lab.json'), $json, (New-Object Text.UTF8Encoding($false)))
[PSCustomObject]$report | Select-Object scope, jvmCases, connectedAdbDeviceCount, deviceVerified, captureVerified | ConvertTo-Json
