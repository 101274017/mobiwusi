$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $root 'apps/desktop/package.json') -Raw | ConvertFrom-Json
$version = $package.devDependencies.electron
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'An exact Electron version is required.' }
$candidates = @(
  (Join-Path $root 'apps/desktop/node_modules/electron/dist'),
  (Join-Path $root 'node_modules/electron/dist'),
  (Join-Path $root "node_modules/.pnpm/electron@$version/node_modules/electron/dist")
)
$distribution = $candidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'electron.exe') } | Select-Object -First 1
if (-not $distribution) { throw 'The locked Electron binary is not installed. Install dependencies before offline packaging.' }
$binaryVersion = (Get-Item -LiteralPath (Join-Path $distribution 'electron.exe')).VersionInfo.ProductVersion
if ($binaryVersion -ne $version) { throw 'The installed Electron binary does not match the locked version.' }
$cache = Join-Path $root '.cache/electron'
$archive = Join-Path $cache "electron-v$version-win32-x64.zip"
Push-Location -LiteralPath $root
try {
  pnpm build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (-not (Test-Path -LiteralPath $archive)) {
    [IO.Compression.ZipFile]::CreateFromDirectory($distribution, $archive, [IO.Compression.CompressionLevel]::Fastest, $false)
  }
  $env:NUANBAN_ELECTRON_ZIP_DIR = $cache
  pnpm --filter '@nuanban/desktop' package
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node scripts/check-d03-candidate.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
