param([string]$JavaHome, [string]$EvidencePath)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $JavaHome) { $JavaHome = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr' }
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { $JavaHome = $env:JAVA_HOME }
$java = if ($JavaHome -and (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { Join-Path $JavaHome 'bin/java.exe' } else { (Get-Command java).Source }
if (-not $java -or -not (Test-Path -LiteralPath $java)) { throw 'Configure JAVA_HOME, pass -JavaHome, or install java.' }

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

$source = Join-Path $root 'tests/native/ReminderTransitionCheck.kt'
$output = Join-Path $root '.cache/reminder-transition-jvm/classes'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$classpath = $jars -join ';'

& $java -cp $classpath org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath $classpath -jvm-target 17 -d $output $source
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$result = & $java -cp ((@($output) + $jars) -join ';') org.nuanban.nativelab.ReminderTransitionCheck
$exitCode = $LASTEXITCODE
$json = $result -join "`n"
if ($exitCode -ne 0) {
  if ($json) { Write-Output $json }
  exit $exitCode
}
try {
  $report = $json | ConvertFrom-Json
} catch {
  throw "The JVM transition check did not emit valid JSON: $($_.Exception.Message)"
}
if ($report.passed -ne $true) { throw 'The JVM transition check did not report passed=true.' }
if ($null -eq $report.cases -or [int]$report.cases -lt 1) { throw 'The JVM transition check did not report a positive case count.' }
if ($report.roomExecuted -ne $false -or $report.deviceVerified -ne $false -or $report.systemSchedulerVerified -ne $false) {
  throw 'The JVM transition check must keep roomExecuted, deviceVerified, and systemSchedulerVerified false.'
}
if ($EvidencePath) {
  $resolvedEvidencePath = if ([IO.Path]::IsPathRooted($EvidencePath)) { $EvidencePath } else { Join-Path $root $EvidencePath }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedEvidencePath) | Out-Null
  [IO.File]::WriteAllText($resolvedEvidencePath, "$json`n", [Text.UTF8Encoding]::new($false))
}
Write-Output $json
exit $exitCode
