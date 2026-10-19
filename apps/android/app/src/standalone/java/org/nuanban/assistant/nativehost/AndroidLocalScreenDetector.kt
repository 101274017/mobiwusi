package org.nuanban.assistant.nativehost

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.SystemClock
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.Collections
import java.util.IdentityHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class LocallySanitizedFrame internal constructor(
    val identity: FrameIdentity, val frameHash: String, val sanitizedHash: String, val width: Int, val height: Int,
    val elements: List<LocalScreenElement>, val signature: String, val capturedAtEpochMs: Long,
    private val image: ByteArray,
) {
    fun sanitizedPng(): ByteArray = image.copyOf()
    internal fun intact(): Boolean = AndroidScreenPolicy.sha256(image) == sanitizedHash && image.size in 76..2_000_000 && frameHash != sanitizedHash
    internal fun erase() { image.fill(0) }
}
data class LocalScreenDetection(val proof: DetectionProof?, val sanitized: LocallySanitizedFrame?, val reason: String)

class AndroidLocalScreenDetector(context: Context) {
    private val assets = context.applicationContext.assets
    private val executor = Executors.newSingleThreadExecutor()
    private val admitted = Collections.newSetFromMap(IdentityHashMap<LocallySanitizedFrame, Boolean>())
    private val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
    private val faceDetector = FaceDetection.getClient(FaceDetectorOptions.Builder().setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE).build())
    @Volatile private var ready = false
    @Volatile private var initializing = false
    @Volatile private var failureReason = "local_models_not_initialized"

    fun ready(): Boolean = ready
    fun status(): String = if (ready) "bundled_models_ready_coverage_limited" else failureReason

    @Synchronized fun prepare(onReady: (Boolean) -> Unit) {
        if (ready) { onReady(true); return }
        if (initializing) { onReady(false); return }
        initializing = true
        executor.execute {
            var sample: Bitmap? = null
            try {
                val paths = mutableListOf<String>()
                fun collect(path: String) {
                    val children = assets.list(path) ?: throw IllegalStateException()
                    for (name in children) {
                        val next = path + "/" + name
                        if (assets.list(next)?.isNotEmpty() == true) collect(next) else paths.add(next)
                    }
                }
                collect("mlkit-google-ocr-models")
                collect("models_bundled")
                require(paths.size == AndroidScreenPolicy.MODEL_ASSET_COUNT)
                val manifest = paths.sorted().joinToString("") { path ->
                    val bytes = assets.open(path).use { it.readBytes() }
                    val hash = AndroidScreenPolicy.sha256(bytes)
                    bytes.fill(0)
                    path + '\u0000' + hash + "\n"
                }
                require(AndroidScreenPolicy.sha256(manifest.toByteArray(Charsets.UTF_8)) == AndroidScreenPolicy.MODEL_FINGERPRINT)
                val bitmap = Bitmap.createBitmap(640, 180, Bitmap.Config.ARGB_8888)
                sample = bitmap
                val canvas = Canvas(bitmap)
                canvas.drawColor(Color.WHITE)
                canvas.drawText("Settings System Display", 20f, 100f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 38f })
                val input = InputImage.fromBitmap(bitmap, 0)
                val textTask = recognizer.process(input)
                val faceTask = faceDetector.process(input)
                val complete = Tasks.whenAllComplete(textTask, faceTask)
                try { Tasks.await(complete, 15, TimeUnit.SECONDS) } catch (error: Exception) {
                    if (!complete.isComplete) { sample = null; complete.addOnCompleteListener { if (!bitmap.isRecycled) bitmap.recycle() } }
                    throw error
                }
                require(textTask.isSuccessful && faceTask.isSuccessful && textTask.result.text.isNotBlank())
                ready = true
                failureReason = ""
            } catch (_: Exception) { failureReason = "bundled_models_failed_verification_or_warmup" }
            finally {
                sample?.let { if (!it.isRecycled) it.recycle() }
                initializing = false
                onReady(ready)
            }
        }
    }

    fun detect(frame: FrameIdentity, bitmap: Bitmap, capturedAtEpochMs: Long): LocalScreenDetection {
        if (!ready || bitmap.isRecycled) { if (!bitmap.isRecycled) bitmap.recycle(); return LocalScreenDetection(null, null, "detector_unavailable") }
        var deferredRelease = false
        var sanitized: Bitmap? = null
        try {
            val pixels = ByteBuffer.allocate(bitmap.byteCount)
            bitmap.copyPixelsToBuffer(pixels)
            val frameHash = AndroidScreenPolicy.sha256(pixels.array())
            pixels.array().fill(0)
            val image = InputImage.fromBitmap(bitmap, 0)
            val textTask = recognizer.process(image)
            val faceTask = faceDetector.process(image)
            val complete = Tasks.whenAllComplete(textTask, faceTask)
            try { Tasks.await(complete, 300, TimeUnit.MILLISECONDS) } catch (_: Exception) {
                deferredRelease = true
                complete.addOnCompleteListener { if (!bitmap.isRecycled) bitmap.recycle() }
                return LocalScreenDetection(null, null, "detection_timeout")
            }
            if (!textTask.isSuccessful || !faceTask.isSuccessful) return LocalScreenDetection(null, null, "detection_failed")
            val text = textTask.result
            val lines = text.textBlocks.flatMap { it.lines }
            val words = lines.flatMap { line ->
                val lineRect = line.boundingBox ?: throw IllegalStateException()
                val full = LocalScreenWord(line.text, LocalScreenRect(lineRect.left, lineRect.top, lineRect.width(), lineRect.height()))
                val segments = line.elements.map { element ->
                    val rect = element.boundingBox ?: throw IllegalStateException()
                    LocalScreenWord(element.text, LocalScreenRect(rect.left, rect.top, rect.width(), rect.height()))
                }
                val lineDecision = AndroidScreenPolicy.normalize(full.text)
                if (segments.size > 1 && lineDecision.contains(' ')) segments else listOf(full)
            }
            val faces = faceTask.result.map { face -> face.boundingBox.let { LocalScreenRect(it.left, it.top, it.width(), it.height()) } }
            val decision = AndroidScreenPolicy.inspect(words, faces, bitmap.width, bitmap.height, frameHash, text.text)
            if (decision.risk != FrameRisk.SAFE) return LocalScreenDetection(DetectionProof(frame, AndroidScreenPolicy.MODEL_FINGERPRINT, decision.risk, SystemClock.elapsedRealtime(), false), null, decision.reason)
            val masked = bitmap.copy(Bitmap.Config.ARGB_8888, true) ?: throw IllegalStateException()
            sanitized = masked
            val canvas = Canvas(masked)
            val paint = Paint().apply { color = Color.BLACK; style = Paint.Style.FILL }
            val textRegions = lines.map { line -> line.boundingBox ?: throw IllegalStateException() }.map { LocalScreenRect(it.left, it.top, it.width(), it.height()) }
            for (rect in textRegions + faces) {
                require(rect.within(bitmap.width, bitmap.height))
                canvas.drawRect((rect.x - 5).coerceAtLeast(0).toFloat(), (rect.y - 5).coerceAtLeast(0).toFloat(), (rect.x + rect.width + 5).coerceAtMost(bitmap.width).toFloat(), (rect.y + rect.height + 5).coerceAtMost(bitmap.height).toFloat(), paint)
            }
            val png = ByteArrayOutputStream().use { output -> require(masked.compress(Bitmap.CompressFormat.PNG, 100, output)); output.toByteArray() }
            if (png.size !in 76..2_000_000) { png.fill(0); return LocalScreenDetection(null, null, "sanitized_image_limit") }
            val finished = SystemClock.elapsedRealtime()
            if (finished - frame.capturedAtMs > AndroidScreenPolicy.MAX_DETECTION_MS) { png.fill(0); return LocalScreenDetection(null, null, "detection_timeout") }
            val signature = AndroidScreenPolicy.sha256(decision.elements.sortedWith(compareBy({ it.rect.y }, { it.rect.x }, { it.label })).joinToString("|") { AndroidScreenPolicy.normalize(it.label) + ":" + it.rect.x / 4 + ":" + it.rect.y / 4 + ":" + it.rect.width / 4 + ":" + it.rect.height / 4 }.toByteArray(Charsets.UTF_8))
            val result = LocallySanitizedFrame(frame, frameHash, AndroidScreenPolicy.sha256(png), bitmap.width, bitmap.height, decision.elements, signature, capturedAtEpochMs, png)
            if (!result.intact()) { result.erase(); return LocalScreenDetection(null, null, "redaction_integrity_failed") }
            synchronized(admitted) { admitted.add(result) }
            return LocalScreenDetection(DetectionProof(frame, AndroidScreenPolicy.MODEL_FINGERPRINT, FrameRisk.SAFE, finished, true), result, "locally_checked")
        } catch (_: Exception) { return LocalScreenDetection(null, null, "detection_failed") }
        finally {
            sanitized?.let { if (!it.isRecycled) it.recycle() }
            if (!deferredRelease && !bitmap.isRecycled) bitmap.recycle()
        }
    }

    fun isAdmitted(frame: LocallySanitizedFrame, nowMs: Long): Boolean = synchronized(admitted) {
        admitted.contains(frame) && ready && nowMs >= frame.identity.capturedAtMs && nowMs - frame.identity.capturedAtMs <= AndroidScreenPolicy.MAX_FRAME_AGE_MS && frame.intact()
    }
    fun release(frame: LocallySanitizedFrame?) { if (frame != null) synchronized(admitted) { admitted.remove(frame); frame.erase() } }
    fun clear() { synchronized(admitted) { admitted.forEach { it.erase() }; admitted.clear() } }
}
