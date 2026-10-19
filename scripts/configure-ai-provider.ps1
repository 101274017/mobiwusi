param(
    [Parameter(Mandatory = $true)][string]$BaseUrl,
    [Parameter(Mandatory = $true)][string]$Model,
    [switch]$FromStdin
)
$ErrorActionPreference = 'Stop'
$plain = $null
try {
    Add-Type -AssemblyName System.Security
    $endpoint = [Uri]$BaseUrl
    if ($endpoint.Scheme -ne 'https' -or $endpoint.UserInfo -or $endpoint.Query -or $endpoint.Fragment -or $Model -notmatch '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$') { throw 'Invalid provider configuration' }
    if ($FromStdin) {
        $apiKey = [Console]::ReadLine()
    } else {
        $secure = Read-Host 'API key (hidden)' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    }
    if ([string]::IsNullOrWhiteSpace($apiKey) -or $apiKey.Length -lt 10 -or $apiKey.Length -gt 4096 -or $apiKey -match '[\s\x00-\x1f]') { throw 'Invalid API key' }
    $plain = [System.Text.Encoding]::UTF8.GetBytes($apiKey)
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($plain, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $configuration = @{ version = 1; baseUrl = $BaseUrl.TrimEnd('/'); model = $Model; credentialFormat = 'windows-dpapi-v1'; encryptedKey = [Convert]::ToBase64String($encrypted) }
    $directory = Join-Path $env:LOCALAPPDATA 'Nuanban'
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $file = Join-Path $directory 'ai-provider.json'
    [System.IO.File]::WriteAllText($file, ($configuration | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
    Write-Output 'Provider configuration saved; API key is encrypted for the current Windows user.'
} catch {
    [Console]::Error.WriteLine('Provider configuration was not saved. Check HTTPS URL, model and key input.')
    exit 1
} finally {
    $apiKey = $null
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
}
