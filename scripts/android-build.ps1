param(
  [string]$SdkRoot,
  [string]$JavaHome,
  [switch]$Offline,
  [switch]$NativeLab
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $SdkRoot) { $SdkRoot = $env:ANDROID_HOME }
if (-not $SdkRoot) { $SdkRoot = $env:ANDROID_SDK_ROOT }
if (-not $SdkRoot) { $SdkRoot = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
if (-not $JavaHome) {
  $studioJava = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr'
  if (Test-Path -LiteralPath (Join-Path $studioJava 'bin/java.exe')) { $JavaHome = $studioJava }
  else { $JavaHome = $env:JAVA_HOME }
}
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { throw 'Configure a JDK with -JavaHome or JAVA_HOME.' }
if (-not (Test-Path -LiteralPath (Join-Path $SdkRoot 'platforms/android-36/android.jar'))) { throw 'Android SDK platform 36 is required. Pass -SdkRoot or set ANDROID_HOME.' }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
Push-Location -LiteralPath $root
try {
  if (-not $NativeLab) {
    pnpm android:sync
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  $target = if ($NativeLab) { ':native-lab:assembleDebug' } else { ':app:assembleDebug' }
  $arguments = @($target, '--no-daemon')
  if ($Offline) { $arguments += '--offline' }
  & (Join-Path $root 'apps/android/gradlew.bat') -p (Join-Path $root 'apps/android') @arguments
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $artifact = if ($NativeLab) { 'apps/android/native-lab/build/outputs/apk/debug/native-lab-debug.apk' } else { 'apps/android/app/build/outputs/apk/debug/app-debug.apk' }
  Get-Item -LiteralPath (Join-Path $root $artifact) | Select-Object FullName, Length, LastWriteTime
} finally { Pop-Location }
