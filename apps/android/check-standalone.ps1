param([string]$JavaHome)
$ErrorActionPreference = 'Stop'
if (-not $JavaHome) { $JavaHome = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr' }
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { $JavaHome = $env:JAVA_HOME }
if (-not $JavaHome) { throw 'A local JDK is required.' }
$java = Join-Path $JavaHome 'bin/java.exe'
$gradleHome = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $HOME '.gradle' }
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
    $directory = Join-Path $gradleHome ('caches/modules-2/files-2.1/' + $coordinate)
    $jar = Get-ChildItem -LiteralPath $directory -Filter '*.jar' -File -Recurse | Where-Object { $_.Name -notmatch '-(sources|javadoc)\.jar$' } | Select-Object -First 1
    if (-not $jar) { throw ('Missing offline compiler dependency: ' + $coordinate) }
    $jar.FullName
}
$output = Join-Path $PSScriptRoot 'standalone-tests/build/classes'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$classpath = $jars -join ';'
$native = Join-Path $PSScriptRoot 'app/src/standalone/java/org/nuanban/assistant/nativehost'
$sources = @((Join-Path $native 'PetSessions.kt'), (Join-Path $native 'CaptureSession.kt'), (Join-Path $native 'LocalFrameGate.kt'), (Join-Path $native 'PetManagementBoundary.kt'), (Join-Path $PSScriptRoot 'app/src/main/java/org/nuanban/assistant/nativehost/GuidanceSafetyTypes.kt'), (Join-Path $PSScriptRoot 'standalone-tests/PetSessionChecks.kt'))
$sources += @((Join-Path $native 'AndroidScreenPolicy.kt'), (Join-Path $PSScriptRoot 'standalone-tests/AndroidScreenPolicyChecks.kt'))
$sources += @((Join-Path $native 'AndroidTeachingState.kt'), (Join-Path $PSScriptRoot 'standalone-tests/AndroidTeachingStateChecks.kt'))
$sources += @((Join-Path $native 'AndroidCaptureGeometry.kt'), (Join-Path $PSScriptRoot 'standalone-tests/AndroidCaptureGeometryChecks.kt'))
$sources += @((Join-Path $native 'StandaloneGuidanceProtocol.kt'), (Join-Path $PSScriptRoot 'standalone-tests/StandaloneGuidanceProtocolChecks.kt'))
$sources += @((Join-Path $native 'AndroidGuidanceAdapter.kt'), (Join-Path $PSScriptRoot 'standalone-tests/AndroidGuidanceAdapterChecks.kt'))
& $java -cp $classpath org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath $classpath -jvm-target 17 -d $output @sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $java -cp ((@($output) + $jars) -join ';') org.nuanban.assistant.nativehost.PetSessionChecks
exit $LASTEXITCODE
