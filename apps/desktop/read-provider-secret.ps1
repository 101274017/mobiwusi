$ErrorActionPreference = 'Stop'
$plain = $null
try {
    Add-Type -AssemblyName System.Security
    $encoded = [Console]::In.ReadToEnd()
    if ($encoded.Length -gt 24000) { exit 1 }
    $plain = [System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($encoded), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    if ($plain.Length -lt 10 -or $plain.Length -gt 4096) { exit 1 }
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($plain))
} catch { exit 1 } finally {
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
}
