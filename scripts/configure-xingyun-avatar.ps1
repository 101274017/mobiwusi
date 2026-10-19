param(
    [Parameter(Mandatory = $true)][string]$AppId,
    [switch]$FromStdin
)
$ErrorActionPreference = 'Stop'
$plain = $null
try {
    Add-Type -AssemblyName System.Security
    if ($AppId -notmatch '^[A-Za-z0-9_-]{16,128}$') { throw 'Invalid application ID' }
    if ($FromStdin) {
        $secret = [Console]::ReadLine()
    } else {
        $secure = Read-Host 'Xingyun App Secret (hidden)' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    }
    if ($secret -notmatch '^[A-Za-z0-9_-]{16,128}$') { throw 'Invalid application secret' }
    $plain = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($plain, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $configuration = @{ version = 1; appId = $AppId; credentialFormat = 'windows-dpapi-v1'; encryptedSecret = [Convert]::ToBase64String($encrypted) }
    $directory = Join-Path $env:LOCALAPPDATA 'Nuanban'
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $file = Join-Path $directory 'xingyun-avatar.json'
    $temporary = $file + '.tmp'
    [System.IO.File]::WriteAllText($temporary, ($configuration | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $file -Force
    Write-Output 'Xingyun avatar configured. App Secret is encrypted for the current Windows user.'
} catch {
    [Console]::Error.WriteLine('Xingyun configuration was not saved. Check application ID and secret.')
    exit 1
} finally {
    $secret = $null
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
}
