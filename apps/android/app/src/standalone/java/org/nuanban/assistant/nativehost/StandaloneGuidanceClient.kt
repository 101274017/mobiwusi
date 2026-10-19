package org.nuanban.assistant.nativehost

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.time.Instant
import java.util.Base64
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.HttpsURLConnection

class StandaloneGuidanceClient(
    private val config: StandaloneGuidanceConfig? = null,
    isAdmitted: (StandaloneGuidanceFrame) -> Boolean = { false },
    isCurrent: (StandaloneGuidanceRequest) -> Boolean = { false },
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val endpoint = config?.endpointOrNull()
    private val guard = StandaloneGuidanceGuard(isAdmitted, isCurrent, now)
    private val active = AtomicBoolean(false)

    fun capabilities(): StandaloneGuidanceCapabilities = StandaloneGuidanceCapabilities(endpoint != null)

    fun analyze(
        request: StandaloneGuidanceRequest,
        cancellation: StandaloneGuidanceCancellation = StandaloneGuidanceCancellation(),
    ): StandaloneGuidanceOutcome {
        val settings = config ?: return failure(StandaloneGuidanceFailureCode.UNAVAILABLE)
        val address = endpoint ?: return failure(StandaloneGuidanceFailureCode.UNAVAILABLE)
        if (!active.compareAndSet(false, true)) return failure(StandaloneGuidanceFailureCode.BUSY)
        if (!cancellation.claim()) {
            active.set(false)
            return failure(cancellation.failureCode() ?: StandaloneGuidanceFailureCode.CANCELLED)
        }
        var connection: HttpURLConnection? = null
        var payload: ByteArray? = null
        var responseBytes: ByteArray? = null
        val deadline = deadlines.schedule({ cancellation.timeout() }, settings.callTimeoutMs.toLong(), TimeUnit.MILLISECONDS)
        try {
            requireOpen(guard.beforeSend(request, cancellation))
            StandaloneGuidanceProtocol.requireRequest(request, now())
            val body = encode(request)
            payload = body
            if (body.size > StandaloneGuidanceProtocol.MAX_REQUEST_BYTES) reject(StandaloneGuidanceFailureCode.INVALID_REQUEST)
            requireOpen(guard.beforeSend(request, cancellation))
            val channel = address.toURL().openConnection() as? HttpURLConnection ?: reject(StandaloneGuidanceFailureCode.UNAVAILABLE)
            connection = channel
            cancellation.attach { channel.disconnect() }
            if (address.scheme == "https" && channel !is HttpsURLConnection) reject(StandaloneGuidanceFailureCode.UNAVAILABLE)
            channel.instanceFollowRedirects = false
            channel.useCaches = false
            channel.allowUserInteraction = false
            channel.connectTimeout = settings.connectTimeoutMs
            channel.readTimeout = settings.readTimeoutMs
            channel.requestMethod = "POST"
            channel.doOutput = true
            channel.setFixedLengthStreamingMode(body.size)
            channel.setRequestProperty("Authorization", "Bearer " + settings.deviceSessionToken)
            channel.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            channel.setRequestProperty("Accept", "application/json")
            channel.setRequestProperty("Accept-Encoding", "identity")
            channel.setRequestProperty("Connection", "close")
            channel.setRequestProperty("X-Request-ID", request.triggerId)
            requireOpen(guard.beforeSend(request, cancellation))
            channel.outputStream.use { output ->
                requireOpen(guard.beforeSend(request, cancellation))
                output.write(body)
            }
            val status = channel.responseCode
            requireOpen(guard.afterResponse(request, cancellation))
            if (status != HttpURLConnection.HTTP_OK) {
                reject(when (status) {
                    401, 403, 503 -> StandaloneGuidanceFailureCode.UNAVAILABLE
                    499 -> StandaloneGuidanceFailureCode.CANCELLED
                    504 -> StandaloneGuidanceFailureCode.TIMED_OUT
                    in 300..399 -> StandaloneGuidanceFailureCode.INVALID_RESPONSE
                    else -> StandaloneGuidanceFailureCode.FAILED
                })
            }
            val contentType = channel.getHeaderField("Content-Type")?.substringBefore(';')?.trim()
            val encoding = channel.getHeaderField("Content-Encoding")
            if (!contentType.equals("application/json", true) || encoding != null && !encoding.equals("identity", true)) {
                reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE)
            }
            val lengthHeader = channel.getHeaderField("Content-Length")
            val declaredLength = lengthHeader?.toLongOrNull()
            if (lengthHeader != null && (declaredLength == null || declaredLength !in 1..StandaloneGuidanceProtocol.MAX_RESPONSE_BYTES.toLong())) {
                reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE)
            }
            val bytes = channel.inputStream.use { input ->
                val collected = ByteArrayOutputStream()
                val chunk = ByteArray(4096)
                try {
                    while (true) {
                        requireOpen(guard.afterResponse(request, cancellation))
                        val count = input.read(chunk)
                        if (count < 0) break
                        if (collected.size() + count > StandaloneGuidanceProtocol.MAX_RESPONSE_BYTES) {
                            reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE)
                        }
                        collected.write(chunk, 0, count)
                    }
                    if (collected.size() == 0 || declaredLength != null && collected.size().toLong() != declaredLength) {
                        reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE)
                    }
                    collected.toByteArray()
                } finally { chunk.fill(0) }
            }
            responseBytes = bytes
            requireOpen(guard.afterResponse(request, cancellation))
            val json = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
            val content = StandaloneGuidanceProtocol.readResponse(json, request, now())
            requireOpen(guard.afterResponse(request, cancellation))
            requireOpen(cancellation.finish())
            return StandaloneGuidanceOutcome.Success(content)
        } catch (rejected: StandaloneGuidanceRejected) {
            return failure(cancellation.failureCode() ?: rejected.code)
        } catch (_: SocketTimeoutException) {
            return failure(cancellation.failureCode() ?: StandaloneGuidanceFailureCode.TIMED_OUT)
        } catch (_: Exception) {
            return failure(cancellation.failureCode() ?: StandaloneGuidanceFailureCode.FAILED)
        } finally {
            deadline.cancel(false)
            cancellation.finish()
            runCatching { connection?.disconnect() }
            payload?.fill(0)
            responseBytes?.fill(0)
            active.set(false)
        }
    }

    private fun encode(request: StandaloneGuidanceRequest): ByteArray {
        val frame = request.frame
        val png = frame.sanitizedPngCopy()
        try {
            val elements = JSONArray()
            for (element in frame.elements) {
                val rect = element.rect
                elements.put(JSONObject().put("id", element.id).put("label", element.label).put("rect",
                    JSONObject().put("x", rect.x).put("y", rect.y).put("width", rect.width).put("height", rect.height)))
            }
            val body = JSONObject().put("observation_id", frame.observationId).put("guide_id", request.guideId)
                .put("observation_generation", frame.observationGeneration).put("task_generation", request.taskGeneration)
                .put("trigger_id", request.triggerId).put("trigger_reason", request.reason.wireValue)
                .put("frame_id", frame.frameId).put("frame_hash", frame.frameHash).put("sanitized_sha256", frame.sanitizedSha256)
                .put("captured_at", Instant.ofEpochMilli(frame.capturedAtMs).toString())
                .put("image", JSONObject().put("mime", "image/png").put("base64", Base64.getEncoder().encodeToString(png)))
                .put("redaction_profile", "all_text_and_faces_v1").put("local_safety", "safe")
                .put("question", request.question).put("elements", elements)
            request.previousStep?.let {
                body.put("previous_step", JSONObject().put("instruction", it.instruction).put("expected_labels", JSONArray(it.expectedLabels)))
            }
            return body.toString().toByteArray(Charsets.UTF_8)
        } finally { png.fill(0) }
    }

    private fun requireOpen(code: StandaloneGuidanceFailureCode?) { if (code != null) reject(code) }
    private fun reject(code: StandaloneGuidanceFailureCode): Nothing = throw StandaloneGuidanceRejected(code)
    private fun failure(code: StandaloneGuidanceFailureCode) = StandaloneGuidanceOutcome.Failure(code)

    companion object {
        private val deadlines = ScheduledThreadPoolExecutor(1) { action ->
            Thread(action, "standalone-guidance-deadline").apply { isDaemon = true }
        }.apply { removeOnCancelPolicy = true }
    }
}
