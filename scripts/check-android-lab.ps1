param([string]$JavaHome)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $JavaHome) { $JavaHome = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr' }
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { $JavaHome = $env:JAVA_HOME }
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { throw 'Configure JAVA_HOME or pass -JavaHome.' }
$gradleHome = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $HOME '.gradle' }
$cache = Join-Path $gradleHome 'caches/modules-2/files-2.1'
$coordinates = @(
  'org.jetbrains.kotlin/kotlin-compiler-embeddable/2.2.20',
  'org.jetbrains.kotlin/kotlin-stdlib/2.2.20',
  'org.jetbrains.kotlin/kotlin-script-runtime/2.2.20',
  'org.jetbrains.kotlin/kotlin-reflect/1.6.10',
  'org.jetbrains.kotlin/kotlin-daemon-embeddable/2.2.20',
  'org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.8.0',
  'org.jetbrains/annotations/13.0'
)
$jars = foreach ($coordinate in $coordinates) {
  $directory = Join-Path $cache $coordinate
  if (-not (Test-Path -LiteralPath $directory)) { throw "Missing cached Kotlin compiler dependency: $coordinate. Build Android first." }
  $jar = Get-ChildItem -LiteralPath $directory -Filter '*.jar' -File -Recurse | Where-Object { $_.Name -notmatch '-(sources|javadoc)\.jar$' } | Select-Object -First 1
  if (-not $jar) { throw "Missing cached Kotlin JAR: $coordinate" }
  $jar.FullName
}
$relativeSources = @(
  'apps/android/native-lab/src/main/java/org/nuanban/nativelab/LabSession.kt',
  'apps/android/native-lab/src/main/java/org/nuanban/nativelab/ReminderPolicy.kt',
  'tests/native/LabSessionCheck.kt',
  'tests/native/ReminderPolicyCheck.kt'
)
$sources = $relativeSources | ForEach-Object { Join-Path $root $_ }
$output = Join-Path $root '.cache/android-lab/classes'
$evidence = Join-Path $root 'docs/implementation/evidence'
New-Item -ItemType Directory -Force -Path $output, $evidence | Out-Null
$resultPath = Join-Path $evidence 'android-lab-jvm.json'
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($resultPath, '{"passed":false,"stage":"running","deviceVerified":false}', $utf8)
$java = Join-Path $JavaHome 'bin/java.exe'
$ErrorActionPreference = 'Continue'
& $java -cp ($jars -join ';') org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath ($jars -join ';') -jvm-target 17 -d $output @sources 2>&1 | Tee-Object -FilePath (Join-Path $evidence 'android-lab-jvm-compile.txt')
$compileExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($compileExit -ne 0) {
  [IO.File]::WriteAllText($resultPath, '{"passed":false,"stage":"compile","deviceVerified":false}', $utf8)
  exit $compileExit
}
$sessionResult = & $java -cp ((@($output) + $jars) -join ';') org.nuanban.nativelab.LabSessionCheckKt
if ($LASTEXITCODE -ne 0) {
  [IO.File]::WriteAllText($resultPath, '{"passed":false,"stage":"jvm-session","deviceVerified":false}', $utf8)
  exit $LASTEXITCODE
}
$reminderResult = & $java -cp ((@($output) + $jars) -join ';') org.nuanban.nativelab.ReminderPolicyCheckKt
if ($LASTEXITCODE -ne 0) {
  [IO.File]::WriteAllText($resultPath, '{"passed":false,"stage":"jvm-reminder-policy","deviceVerified":false}', $utf8)
  exit $LASTEXITCODE
}
$sessionReport = ($sessionResult -join "`n") | ConvertFrom-Json
$reminderReport = ($reminderResult -join "`n") | ConvertFrom-Json
$report = [pscustomobject]@{
  passed = [bool]($sessionReport.passed -and $reminderReport.passed)
  cases = [int]$sessionReport.cases + [int]$reminderReport.cases
  sessionCases = [int]$sessionReport.cases
  reminderPolicyCases = [int]$reminderReport.cases
  scope = 'kotlin-jvm-state-machine-and-android-reminder-policy-preflight'
  generatedTimeZone = 'Asia/Shanghai'
  deviceVerified = $false
  captureVerified = [bool]$sessionReport.captureVerified
  systemSchedulerVerified = [bool]$reminderReport.systemSchedulerVerified
  limitations = @(
    'Covers only Kotlin/JVM state transitions, reminder policy, and local compilation; no Android device is installed or started.',
    'Does not verify real system permissions, background delivery, lock screen, force-stop, restart, or user-visible receipts.'
  )
}
$hashes = [ordered]@{}
foreach ($relative in $relativeSources) {
  $bytes = [IO.File]::ReadAllBytes((Join-Path $root $relative))
  $digest = [Security.Cryptography.SHA256]::Create()
  try { $hashes[$relative] = ([BitConverter]::ToString($digest.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
  finally { $digest.Dispose() }
}
$report | Add-Member -NotePropertyName generatedAt -NotePropertyValue (Get-Date -Format o)
$report | Add-Member -NotePropertyName sourceSha256 -NotePropertyValue $hashes
[IO.File]::WriteAllText($resultPath, ($report | ConvertTo-Json -Depth 5), $utf8)
$report | ConvertTo-Json -Depth 5
