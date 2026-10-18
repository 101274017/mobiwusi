$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$phase = 'request'
$bitmap = $null
$faceBitmap = $null
$stream = $null
$png = $null
$reply = $null
$request = $null

function Wait-WinRt {
    param($Operation, [Type]$ResultType)
    $task = $script:asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(10000)) {
        $Operation.Cancel()
        throw [System.TimeoutException]::new('winrt_timeout')
    }
    return ,$task.GetAwaiter().GetResult()
}

function Read-Request {
    $builder = New-Object System.Text.StringBuilder
    $characters = New-Object char[] 4096
    while (($count = [Console]::In.Read($characters, 0, $characters.Length)) -gt 0) {
        if ($builder.Length + $count -gt 33570816) { throw [System.IO.InvalidDataException]::new('request_limit') }
        $null = $builder.Append($characters, 0, $count)
    }
    return ($builder.ToString() | ConvertFrom-Json)
}

try {
    $request = Read-Request
    if ($request.protocol -ne 1 -or $request.operation -notin @('probe', 'detect')) { throw [System.IO.InvalidDataException]::new('protocol_invalid') }
    $phase = 'winrt_load'
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Media.FaceAnalysis.FaceDetector, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Media.FaceAnalysis.DetectedFace, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $script:asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Length -eq 1 -and $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    if ($null -eq $script:asTask) { throw [System.NotSupportedException]::new('winrt_async_unavailable') }
    $phase = 'ocr_create'
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    $languages = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag })
    $faceSupported = [Windows.Media.FaceAnalysis.FaceDetector]::IsSupported
    $formats = @([Windows.Media.FaceAnalysis.FaceDetector]::GetSupportedBitmapPixelFormats() | ForEach-Object { $_.ToString() })
    if ($null -eq $engine) {
        $reply = @{ protocol = 1; status = 'unavailable'; reason = 'ocr_language_unavailable'; ocrStatus = 'unavailable'; faceStatus = 'unavailable'; languages = $languages }
    } elseif (-not $faceSupported -or -not [Windows.Media.FaceAnalysis.FaceDetector]::IsBitmapPixelFormatSupported([Windows.Graphics.Imaging.BitmapPixelFormat]::Gray8)) {
        $reply = @{ protocol = 1; status = 'unavailable'; reason = 'face_detection_unavailable'; ocrStatus = 'available'; faceStatus = 'unavailable'; languages = $languages; faceFormats = $formats }
    } else {
        $phase = 'face_create'
        $faceDetector = Wait-WinRt ([Windows.Media.FaceAnalysis.FaceDetector]::CreateAsync()) ([Windows.Media.FaceAnalysis.FaceDetector])
        if ($null -eq $faceDetector) { throw [System.NotSupportedException]::new('face_detector_missing') }
        if ($request.operation -eq 'probe') {
            $reply = @{ protocol = 1; status = 'complete'; ocrStatus = 'available'; faceStatus = 'available'; languages = $languages; recognizerLanguage = $engine.RecognizerLanguage.LanguageTag; maxImageDimension = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension; faceFormats = $formats; powershellVersion = $PSVersionTable.PSVersion.ToString() }
        } else {
            $phase = 'decode'
            if ($request.frameHash -notmatch '^[a-f0-9]{64}$' -or $request.sourceId -isnot [string] -or $request.sourceId.Length -gt 256 -or $request.width -lt 1 -or $request.height -lt 1 -or $request.width -gt 8192 -or $request.height -gt 8192 -or ([long]$request.width * [long]$request.height) -gt 16777216 -or $request.pngBase64 -isnot [string] -or $request.pngBase64.Length -gt 33554432) { throw [System.IO.InvalidDataException]::new('frame_invalid') }
            $png = [Convert]::FromBase64String($request.pngBase64)
            $request.pngBase64 = $null
            if ($png.Length -lt 33 -or $png.Length -gt 25165824) { throw [System.IO.InvalidDataException]::new('png_limit') }
            $sha = [System.Security.Cryptography.SHA256]::Create()
            try { $actualHash = ([BitConverter]::ToString($sha.ComputeHash($png))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
            if ($actualHash -cne $request.frameHash) { throw [System.IO.InvalidDataException]::new('frame_hash_mismatch') }
            $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
            $writer = New-Object Windows.Storage.Streams.DataWriter($stream.GetOutputStreamAt(0))
            try {
                $writer.WriteBytes($png)
                $null = Wait-WinRt ($writer.StoreAsync()) ([uint32])
                $null = $writer.DetachStream()
            } finally { $writer.Dispose() }
            $stream.Seek(0)
            $decoder = Wait-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
            if ($decoder.PixelWidth -ne $request.width -or $decoder.PixelHeight -ne $request.height -or $decoder.OrientedPixelWidth -ne $request.width -or $decoder.OrientedPixelHeight -ne $request.height) { throw [System.IO.InvalidDataException]::new('image_dimensions_mismatch') }
            if ($decoder.PixelWidth -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension -or $decoder.PixelHeight -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension) {
                $reply = @{ protocol = 1; status = 'unavailable'; reason = 'ocr_dimensions_unsupported'; ocrStatus = 'unavailable'; faceStatus = 'unavailable' }
            } else {
                $bitmap = Wait-WinRt ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)) ([Windows.Graphics.Imaging.SoftwareBitmap])
                $phase = 'ocr_detect'
                $ocrResult = Wait-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
                if ($null -eq $ocrResult) { throw [System.IO.InvalidDataException]::new('ocr_result_missing') }
                $words = New-Object System.Collections.ArrayList
                foreach ($line in $ocrResult.Lines) {
                    foreach ($word in $line.Words) {
                        if ($words.Count -ge 8192 -or $word.Text.Length -gt 512) { throw [System.IO.InvalidDataException]::new('ocr_output_limit') }
                        $bounds = $word.BoundingRect
                        $null = $words.Add(@{ text = $word.Text; rect = @{ x = $bounds.X; y = $bounds.Y; width = $bounds.Width; height = $bounds.Height } })
                    }
                }
                $phase = 'face_detect'
                $faceBitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($bitmap, [Windows.Graphics.Imaging.BitmapPixelFormat]::Gray8)
                $detectedFaces = Wait-WinRt ($faceDetector.DetectFacesAsync($faceBitmap)) ([System.Collections.Generic.IList[Windows.Media.FaceAnalysis.DetectedFace]])
                if ($null -eq $detectedFaces) { throw [System.IO.InvalidDataException]::new('face_result_missing') }
                $faces = New-Object System.Collections.ArrayList
                foreach ($face in $detectedFaces) {
                    if ($faces.Count -ge 512) { throw [System.IO.InvalidDataException]::new('face_output_limit') }
                    $bounds = $face.FaceBox
                    $null = $faces.Add(@{ rect = @{ x = $bounds.X; y = $bounds.Y; width = $bounds.Width; height = $bounds.Height } })
                }
                $reply = @{ protocol = 1; status = 'complete'; ocrStatus = 'complete'; faceStatus = 'complete'; words = @($words.ToArray()); faces = @($faces.ToArray()); textAngle = $ocrResult.TextAngle }
            }
        }
    }
} catch {
    $failureStatus = if ($phase -in @('winrt_load', 'ocr_create', 'face_create')) { 'unavailable' } else { 'failed' }
    $reply = @{ protocol = 1; status = $failureStatus; reason = ('{0}:{1}:0x{2:X8}' -f $phase, $_.Exception.GetType().Name, $_.Exception.HResult); ocrStatus = 'unavailable'; faceStatus = 'unavailable' }
} finally {
    if ($null -ne $faceBitmap) { $faceBitmap.Dispose() }
    if ($null -ne $bitmap) { $bitmap.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
    if ($null -ne $png) { [Array]::Clear($png, 0, $png.Length) }
}

if ($null -ne $request -and $request.operation -eq 'detect') {
    $reply.frameHash = $request.frameHash
    $reply.sourceId = $request.sourceId
    $reply.sourceIdentity = $request.sourceIdentity
    $reply.width = $request.width
    $reply.height = $request.height
}
$outputText = $reply | ConvertTo-Json -Compress -Depth 8
if ([System.Text.Encoding]::UTF8.GetByteCount($outputText) -gt 2097152) { $outputText = '{"protocol":1,"status":"failed","reason":"helper_output_limit","ocrStatus":"unavailable","faceStatus":"unavailable"}' }
[Console]::Out.Write($outputText)
