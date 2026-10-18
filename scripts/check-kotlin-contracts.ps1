param([string]$JavaHome)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $JavaHome) { $JavaHome = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr' }
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { $JavaHome = $env:JAVA_HOME }
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { throw 'Pass -JavaHome or configure JAVA_HOME.' }
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
  if (-not (Test-Path -LiteralPath $directory)) { throw "Missing cached compiler dependency: $coordinate. Build Android once with the pinned toolchain first." }
  $jar = Get-ChildItem -LiteralPath $directory -Filter '*.jar' -Recurse -File | Where-Object { $_.Name -notmatch '-(sources|javadoc)\.jar$' } | Select-Object -First 1
  if (-not $jar) { throw "Missing cached compiler JAR: $coordinate" }
  $jar.FullName
}
Push-Location -LiteralPath $root
try {
  pnpm contracts:check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node scripts/generate-kotlin-fixtures.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $output = Join-Path $root '.cache/kotlin-contracts/classes'
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  $sources = @(Get-ChildItem -LiteralPath (Join-Path $root 'packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts') -Filter '*.kt' -File | ForEach-Object FullName)
  $sources += Join-Path $root '.cache/kotlin-contracts/ContractFixtures.generated.kt'
  $evidence = Join-Path $root 'docs/implementation/evidence'
  New-Item -ItemType Directory -Force -Path $evidence | Out-Null
  $java = Join-Path $JavaHome 'bin/java.exe'
  $ErrorActionPreference = 'Continue'
  & $java -cp ($jars -join ';') org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath ($jars -join ';') -jvm-target 17 -d $output @sources 2>&1 | Tee-Object -FilePath (Join-Path $evidence 'kotlin-compile.txt')
  $compileExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($compileExit -ne 0) {
    [IO.File]::WriteAllText((Join-Path $evidence 'kotlin-results.json'), '{"passed":false,"stage":"compile"}', (New-Object Text.UTF8Encoding($false)))
    exit $compileExit
  }
  $ErrorActionPreference = 'Continue'
  $result = & $java -cp ((@($output) + $jars) -join ';') org.nuanban.contracts.ContractFixtures_generatedKt 2>&1
  $testExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($testExit -ne 0) {
    $result | Out-String | Write-Output
    [IO.File]::WriteAllText((Join-Path $evidence 'kotlin-results.json'), '{"passed":false,"stage":"fixtures"}', (New-Object Text.UTF8Encoding($false)))
    exit $testExit
  }
  $report = ($result | Out-String) | ConvertFrom-Json
  $manifest = Get-Content -LiteralPath (Join-Path $root '.cache/kotlin-contracts/fixtures-manifest.json') -Raw | ConvertFrom-Json
  if ($report.casesPassed -ne $manifest.cases -or $report.definitions -ne $manifest.definitions -or $report.activeBridgeCasesPassed -ne $manifest.activeBridgeCases -or $report.validRoundtrips -ne $manifest.expectedValid -or ($report.validRoundtrips + $report.invalidRejected) -ne $manifest.cases) { throw 'Incomplete Kotlin fixture execution.' }
  $report | Add-Member -NotePropertyName passed -NotePropertyValue $true
  $report | Add-Member -NotePropertyName testedAt -NotePropertyValue ([DateTimeOffset]::Now.ToString('o'))
  $report | Add-Member -NotePropertyName compilerVersion -NotePropertyValue '2.2.20'
  $hashes = @($sources | ForEach-Object {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($_)
    try { @{path = $_.Substring($root.Length + 1).Replace('\', '/'); sha256 = [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()} }
    finally { $stream.Dispose(); $algorithm.Dispose() }
  })
  $report | Add-Member -NotePropertyName sources -NotePropertyValue $hashes
  $json = $report | ConvertTo-Json -Depth 6
  [IO.File]::WriteAllText((Join-Path $evidence 'kotlin-results.json'), $json + "`n", (New-Object Text.UTF8Encoding($false)))
  Write-Output $json
  Copy-Item -LiteralPath (Join-Path $root '.cache/kotlin-contracts/fixtures-manifest.json') -Destination (Join-Path $evidence 'kotlin-fixtures.json')
} finally { Pop-Location }
