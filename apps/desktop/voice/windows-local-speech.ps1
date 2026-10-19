$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$synthesizer = $null
$request = $null
$resultCode = 0
try {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line.Length -gt 16384) { throw 'speech_request_invalid' }
  $request = ConvertFrom-Json -InputObject $line
  if ($request.token -notmatch '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' -or $request.op -notin @('probe', 'speak')) { throw 'speech_request_invalid' }
  Add-Type -AssemblyName System.Speech
  $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synthesizer.SetOutputToNull()
  $voice = $synthesizer.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -match '^zh-(CN|Hans-CN)$' } | Select-Object -First 1
  if ($null -eq $voice) { throw 'speech_zh_cn_voice_unavailable' }
  $synthesizer.SelectVoice($voice.VoiceInfo.Name)
  if ($request.op -eq 'speak') {
    if ($request.text -isnot [string] -or [string]::IsNullOrWhiteSpace($request.text) -or $request.text.Length -gt 2000) { throw 'speech_request_invalid' }
    $synthesizer.SetOutputToDefaultAudioDevice()
    $synthesizer.Speak($request.text)
  }
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject @{ token = $request.token; kind = 'complete'; culture = $voice.VoiceInfo.Culture.Name; localOnly = $true }))
} catch {
  $reason = 'speech_engine_unavailable'
  if ($_.Exception.Message -match '^speech_[a-z_]{1,60}$') { $reason = $_.Exception.Message }
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject @{ token = $request.token; kind = 'error'; reason = $reason }))
  $resultCode = 2
} finally {
  if ($null -ne $synthesizer) { $synthesizer.Dispose() }
  $request = $null
}
exit $resultCode
