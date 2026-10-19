param(
    [string]$ResourceDirectory = (Join-Path $PSScriptRoot '..\apps\desktop\assets\lili'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\apps\web\src\assets\lili.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$resourceRoot = (Resolve-Path -LiteralPath $ResourceDirectory).Path
$manifest = Get-Content -LiteralPath (Join-Path $resourceRoot 'manifest.json') -Raw | ConvertFrom-Json
$frame = $manifest.frames.idle[0]
$tile = $manifest.faces.frames.smile[$frame.eye]
$bitmap = [System.Drawing.Bitmap]::new([int]$manifest.canvas[0], [int]$manifest.canvas[1], [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$body = $null
$faces = $null
$matrix = $null
try {
    $body = [System.Drawing.Image]::FromFile((Join-Path $resourceRoot $manifest.atlases[$frame.atlas]))
    $faces = [System.Drawing.Image]::FromFile((Join-Path $resourceRoot $manifest.faces.file))
    $bounds = [System.Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($body, $bounds, [int]$frame.x, [int]$frame.y, $bitmap.Width, $bitmap.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $transform = $frame.faceTransform
    $matrix = [System.Drawing.Drawing2D.Matrix]::new([single]$transform[0], [single]$transform[1], [single]$transform[2], [single]$transform[3], [single]$transform[4], [single]$transform[5])
    $graphics.Transform = $matrix
    $faceBounds = [System.Drawing.Rectangle]::new([int]$manifest.faceCrop[0], [int]$manifest.faceCrop[1], [int]$tile[2], [int]$tile[3])
    $graphics.DrawImage($faces, $faceBounds, [int]$tile[0], [int]$tile[1], [int]$tile[2], [int]$tile[3], [System.Drawing.GraphicsUnit]::Pixel)
    $absoluteOutput = [System.IO.Path]::GetFullPath($OutputPath)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($absoluteOutput)) | Out-Null
    $bitmap.Save($absoluteOutput, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Exported $($manifest.id) $($manifest.version) preview: $absoluteOutput"
} finally {
    $graphics.Dispose()
    if ($null -ne $matrix) { $matrix.Dispose() }
    if ($null -ne $body) { $body.Dispose() }
    if ($null -ne $faces) { $faces.Dispose() }
    $bitmap.Dispose()
}
