package org.nuanban.assistant.nativehost

import java.io.ByteArrayOutputStream
import java.net.URI
import java.security.MessageDigest
import java.text.Normalizer
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.Collections
import java.util.Locale
import java.util.zip.CRC32
import java.util.zip.Inflater

data class StandaloneGuidanceRect(val x: Double, val y: Double, val width: Double, val height: Double)
data class StandaloneGuidanceElement(val id: String, val label: String, val rect: StandaloneGuidanceRect)

class StandaloneGuidanceFrame(
    val observationId: String,
    val observationGeneration: Long,
    val frameId: String,
    val sourceId: String,
    val targetVersion: String,
    val sequence: Long,
    val capturedAtMs: Long,
    val width: Int,
    val height: Int,
    val frameHash: String,
    val sanitizedSha256: String,
    sanitizedPng: ByteArray,
    elements: List<StandaloneGuidanceElement>,
) {
    init {
        require(sanitizedPng.size <= StandaloneGuidanceProtocol.MAX_IMAGE_BYTES && elements.size <= 80) { "Invalid guidance frame" }
    }
    private val png = sanitizedPng.copyOf()
    val elements: List<StandaloneGuidanceElement> = immutableGuidanceList(elements)
    internal fun sanitizedPngCopy(): ByteArray = synchronized(png) { png.copyOf() }
    fun erase() { synchronized(png) { png.fill(0) } }
}

enum class StandaloneGuidanceReason(val wireValue: String) {
    QUESTION("question"), PAGE_CHANGED("page_changed"), VERIFICATION("verification")
}

class StandaloneGuidancePreviousStep(
    val frame: StandaloneGuidanceFrame,
    val issuedAtMs: Long,
    val instruction: String,
    expectedLabels: List<String>,
) {
    init { require(expectedLabels.size <= 16) { "Invalid guidance labels" } }
    val expectedLabels: List<String> = immutableGuidanceList(expectedLabels)
}

class StandaloneGuidanceRequest(
    val frame: StandaloneGuidanceFrame,
    val guideId: String,
    val taskGeneration: Long,
    val triggerId: String,
    val reason: StandaloneGuidanceReason,
    val question: String,
    val previousStep: StandaloneGuidancePreviousStep? = null,
)

class StandaloneGuidanceConfig(
    val baseUrl: String,
    val deviceSessionToken: String,
    val allowLoopbackHttp: Boolean = false,
    val connectTimeoutMs: Int = 5_000,
    val readTimeoutMs: Int = 8_000,
    val callTimeoutMs: Int = 12_000,
) {
    fun endpointOrNull(): URI? = try {
        val uri = URI(baseUrl)
        val host = uri.host?.removeSurrounding("[", "]")?.lowercase(Locale.ROOT)
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        val loopback = host in setOf("localhost", "127.0.0.1", "::1")
        val path = uri.rawPath.orEmpty().removeSuffix("/")
        if (baseUrl.length !in 1..2048 || baseUrl.any { it <= ' ' || it == '\\' }
            || host.isNullOrEmpty() || uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null
            || uri.port != -1 && uri.port !in 1..65535
            || scheme != "https" && !(scheme == "http" && allowLoopbackHttp && loopback)
            || path.isNotEmpty() && (!path.startsWith("/") || path.drop(1).split('/').any {
                it.isEmpty() || it == "." || it == ".." || !it.matches(Regex("[A-Za-z0-9._~-]+"))
            })
            || deviceSessionToken.length !in 1..4096 || !deviceSessionToken.matches(Regex("[A-Za-z0-9._~+/-]+=*"))
            || deviceSessionToken.startsWith("sk-", true) || deviceSessionToken.startsWith("sk_", true)
            || connectTimeoutMs !in 1..15_000 || readTimeoutMs !in 1..15_000
            || callTimeoutMs !in 1..30_000 || connectTimeoutMs > callTimeoutMs || readTimeoutMs > callTimeoutMs
        ) null else URI(scheme, null, if (scheme == "http" && host == "localhost") "127.0.0.1" else host,
            uri.port, "$path/v1/standalone/guidance/analyze", null, null)
    } catch (_: Exception) { null }

    override fun toString(): String = "StandaloneGuidanceConfig(redacted)"
}

data class StandaloneGuidanceCapabilities(val configured: Boolean, val protocol: String = "standalone-guidance-v1")
enum class StandaloneGuidanceFailureCode {
    UNAVAILABLE, OUTBOUND_CLOSED, INVALID_REQUEST, INVALID_RESPONSE, CANCELLED, TIMED_OUT, FAILED, BUSY
}
enum class StandaloneGuidancePresentation { CONFIRMED, UNCERTAIN_CANDIDATE }
data class StandaloneGuidanceReviewSuggestion(val remindAtMs: Long, val timezone: String, val reason: String)

sealed class StandaloneGuidanceContent {
    abstract val instruction: String
    data class Step(
        override val instruction: String,
        val target: StandaloneGuidanceElement?,
        val presentation: StandaloneGuidancePresentation?,
        val expectedLabels: List<String>,
        val evidenceLabels: List<String>,
    ) : StandaloneGuidanceContent()
    data class CompletionCandidate(
        override val instruction: String,
        val evidenceLabels: List<String>,
        val reviewSuggestion: StandaloneGuidanceReviewSuggestion?,
    ) : StandaloneGuidanceContent()
    data class Clarify(override val instruction: String) : StandaloneGuidanceContent()
    data class Unsupported(override val instruction: String) : StandaloneGuidanceContent()
}

sealed class StandaloneGuidanceOutcome {
    data class Success(val content: StandaloneGuidanceContent) : StandaloneGuidanceOutcome()
    data class Failure(val code: StandaloneGuidanceFailureCode) : StandaloneGuidanceOutcome()
}

class StandaloneGuidanceCancellation {
    private val lock = Any()
    private var reason: StandaloneGuidanceFailureCode? = null
    private var claimed = false
    private var finished = false
    private var disconnect: (() -> Unit)? = null

    fun cancel() { stop(StandaloneGuidanceFailureCode.CANCELLED) }
    fun isCancelled(): Boolean = synchronized(lock) { reason != null }
    internal fun failureCode(): StandaloneGuidanceFailureCode? = synchronized(lock) { reason }
    internal fun claim(): Boolean = synchronized(lock) {
        if (claimed || finished || reason != null) false else { claimed = true; true }
    }
    internal fun attach(action: () -> Unit) {
        val closeNow = synchronized(lock) {
            if (finished || reason != null) true else { disconnect = action; false }
        }
        if (closeNow) runCatching(action)
    }
    internal fun timeout() { stop(StandaloneGuidanceFailureCode.TIMED_OUT) }
    internal fun finish(): StandaloneGuidanceFailureCode? = synchronized(lock) {
        finished = true
        disconnect = null
        reason
    }
    private fun stop(code: StandaloneGuidanceFailureCode) {
        val action = synchronized(lock) {
            if (finished || reason != null) return
            reason = code
            val pending = disconnect
            disconnect = null
            pending
        }
        if (action != null) runCatching(action)
    }
}

class StandaloneGuidanceGuard(
    private val isAdmitted: (StandaloneGuidanceFrame) -> Boolean = { false },
    private val isCurrent: (StandaloneGuidanceRequest) -> Boolean = { false },
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun beforeSend(request: StandaloneGuidanceRequest, cancellation: StandaloneGuidanceCancellation): StandaloneGuidanceFailureCode? {
        cancellation.failureCode()?.let { return it }
        return try {
            if (!isAdmitted(request.frame) || !isCurrent(request)) StandaloneGuidanceFailureCode.OUTBOUND_CLOSED
            else if (!StandaloneGuidanceProtocol.isFresh(request.frame, now())) StandaloneGuidanceFailureCode.OUTBOUND_CLOSED
            else cancellation.failureCode()
        } catch (_: Exception) { StandaloneGuidanceFailureCode.OUTBOUND_CLOSED }
    }
    fun afterResponse(request: StandaloneGuidanceRequest, cancellation: StandaloneGuidanceCancellation): StandaloneGuidanceFailureCode? {
        cancellation.failureCode()?.let { return it }
        return try {
            if (!isCurrent(request)) StandaloneGuidanceFailureCode.OUTBOUND_CLOSED else cancellation.failureCode()
        } catch (_: Exception) { StandaloneGuidanceFailureCode.OUTBOUND_CLOSED }
    }
}

internal class StandaloneGuidanceRejected(val code: StandaloneGuidanceFailureCode) :
    RuntimeException("Guidance request rejected", null, false, false)

internal fun <Item> immutableGuidanceList(items: Collection<Item>): List<Item> = Collections.unmodifiableList(ArrayList(items))

object StandaloneGuidanceProtocol {
    const val MAX_REQUEST_BYTES = 3 * 1024 * 1024
    const val MAX_RESPONSE_BYTES = 32_000
    const val MAX_IMAGE_BYTES = 2_000_000
    const val MAX_FRAME_AGE_MS = 30_000L
    private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L
    private val identifier = Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
    private val hash = Regex("[a-fA-F0-9]{64}")
    private val forbidden = Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF]")
    private val risky = Regex("付款|支付|收款|转账|轉帳|汇款|匯款|银行|銀行|信用卡|密码|密碼|口令|验证码|驗證碼|校验码|动态码|助记词|私钥|私鑰|身份证|身份證|刷脸|人脸验证|人臉驗證|私聊|私人聊天|聊天记录|远程控制|遠端控制|关闭.{0,6}(?:安全|防护)|關閉.{0,6}(?:安全|防護)|\\b(?:password|passcode|otp|pin|cvv|cvc|payment|checkout|banking|bank\\s+account|credit\\s+card|wire\\s+transfer|verification\\s+code|security\\s+code|private\\s+key|seed\\s+phrase|remote\\s+(?:control|access)|bearer|api[ _-]?key|secret[ _-]?key|private\\s+(?:chat|message))\\b", RegexOption.IGNORE_CASE)
    private val personal = Regex("(?:\\b1[3-9]\\d{9}\\b)|(?:\\b\\d{17}[\\dXx]\\b)|(?:[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,})|(?:\\b(?:sk|pk)[-_][A-Za-z0-9]{16,})")
    private val action = Regex("自动(?:点击|输入|填表|提交|操作)|自動(?:點擊|輸入|提交)|(?:代替|替您|替你|帮你|幫你).{0,12}(?:点击|點擊|输入|輸入|提交|操作)|执行.{0,8}(?:脚本|代码|命令)|執行.{0,8}(?:腳本|代碼|命令)|powershell|cmd\\.exe|javascript\\s*:|<\\s*script|\\beval\\s*\\(|\\b(?:curl|wget|sendinput|robotjs|pyautogui|autohotkey|shell|terminal)\\b|\\b(?:automatically|programmatically)\\s+(?:click|type|submit|operate)|\\b(?:run|execute|paste)\\b.{0,24}\\b(?:script|command|code)\\b|https?://|www\\.|data:|file:|Win\\s*\\+\\s*R", RegexOption.IGNORE_CASE)
    private val coordinates = Regex("\\b(?:x|y|left|top|width|height)\\s*[:=]\\s*-?\\d|坐标|座標|\\(\\s*\\d{2,}\\s*[,，]\\s*\\d{2,}\\s*\\)|\\b\\d+\\s*(?:px|pixels)\\b", RegexOption.IGNORE_CASE)
    private val uncertain = Regex("候选|候選|可能|不确定|不確定|\\b(?:candidate|uncertain|might|may)\\b", RegexOption.IGNORE_CASE)
    private val confident = Regex("已(?:经|經)?(?:确认|確認|找到|定位|匹配)|确定就是|確定就是|\\b(?:matched|confirmed|located|definitely|certainly)\\b", RegexOption.IGNORE_CASE)
    private val correlation = setOf("observation_id", "guide_id", "observation_generation", "task_generation", "trigger_id", "frame_id")

    fun isFresh(frame: StandaloneGuidanceFrame, nowMs: Long): Boolean =
        nowMs >= 0 && frame.capturedAtMs >= 0 && frame.capturedAtMs <= nowMs && nowMs - frame.capturedAtMs <= MAX_FRAME_AGE_MS

    fun validateRequest(request: StandaloneGuidanceRequest, nowMs: Long): StandaloneGuidanceFailureCode? = try {
        requireRequest(request, nowMs)
        null
    } catch (_: Exception) { StandaloneGuidanceFailureCode.INVALID_REQUEST }

    internal fun requireRequest(request: StandaloneGuidanceRequest, nowMs: Long) {
        val code = StandaloneGuidanceFailureCode.INVALID_REQUEST
        requireFrame(request.frame, code)
        ensure(isFresh(request.frame, nowMs) && identifier.matches(request.guideId) && identifier.matches(request.triggerId)
            && request.taskGeneration in 1..MAX_SAFE_INTEGER && safeText(request.question, 2000, true)
            && (request.reason != StandaloneGuidanceReason.QUESTION || request.question.isNotBlank()), code)
        request.previousStep?.let {
            requireFrame(it.frame, code)
            ensure(safeText(it.instruction, 600) && validLabels(it.expectedLabels)
                && it.issuedAtMs >= it.frame.capturedAtMs && it.issuedAtMs <= nowMs
                && sameContext(it.frame, request.frame), code)
        }
        val bytes = request.frame.sanitizedPngCopy()
        try {
            val digest = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            ensure(digest.equals(request.frame.sanitizedSha256, true), code)
            requirePng(bytes, request.frame.width, request.frame.height)
        } finally { bytes.fill(0) }
    }

    private fun requireFrame(frame: StandaloneGuidanceFrame, code: StandaloneGuidanceFailureCode) {
        ensure(identifier.matches(frame.observationId) && identifier.matches(frame.frameId)
            && frame.observationGeneration in 1..MAX_SAFE_INTEGER && frame.sequence in 0..MAX_SAFE_INTEGER
            && frame.sourceId.length in 1..256 && frame.targetVersion.length in 1..256
            && frame.sourceId.isNotBlank() && frame.targetVersion.isNotBlank()
            && !frame.sourceId.any { it.isISOControl() } && !frame.targetVersion.any { it.isISOControl() }
            && frame.capturedAtMs in 0..253_402_300_799_999L
            && frame.width in 1..4096 && frame.height in 1..4096 && frame.width.toLong() * frame.height <= 8_388_608
            && hash.matches(frame.frameHash) && hash.matches(frame.sanitizedSha256)
            && !frame.frameHash.equals(frame.sanitizedSha256, true) && frame.elements.size <= 80, code)
        val ids = HashSet<String>()
        var characters = 0
        for (element in frame.elements) {
            val rect = element.rect
            characters += element.label.length
            ensure(identifier.matches(element.id) && ids.add(element.id) && genericLabel(element.label) && characters <= 2048
                && listOf(rect.x, rect.y, rect.width, rect.height).all { it.isFinite() }
                && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
                && rect.x + rect.width <= frame.width && rect.y + rect.height <= frame.height, code)
        }
    }

    fun validateResponse(json: String, request: StandaloneGuidanceRequest, nowMs: Long): StandaloneGuidanceOutcome = try {
        StandaloneGuidanceOutcome.Success(readResponse(json, request, nowMs))
    } catch (_: Exception) { StandaloneGuidanceOutcome.Failure(StandaloneGuidanceFailureCode.INVALID_RESPONSE) }

    internal fun readResponse(json: String, request: StandaloneGuidanceRequest, nowMs: Long): StandaloneGuidanceContent {
        val code = StandaloneGuidanceFailureCode.INVALID_RESPONSE
        ensure(json.length <= MAX_RESPONSE_BYTES && json.toByteArray(Charsets.UTF_8).size <= MAX_RESPONSE_BYTES, code)
        requireFrame(request.frame, code)
        val root = record(GuidanceJsonReader(json).read())
        val value = if (root.containsKey("data")) {
            fields(root, setOf("data", "request_id", "schema_version"))
            ensure(root["request_id"] == request.triggerId && root["schema_version"] == "0.2.0", code)
            record(root["data"])
        } else root
        ensure(value["observation_id"] == request.frame.observationId && value["guide_id"] == request.guideId
            && value["observation_generation"] == request.frame.observationGeneration
            && value["task_generation"] == request.taskGeneration && value["trigger_id"] == request.triggerId
            && value["frame_id"] == request.frame.frameId, code)
        val instruction = value["instruction"] as? String ?: reject(code)
        ensure(safeText(instruction, 600), code)
        val required = correlation + setOf("kind", "instruction")
        return when (value["kind"]) {
            "step" -> {
                fields(value, required, setOf("target_id", "presentation", "expected_labels", "evidence_labels"))
                ensure(value.containsKey("target_id") == value.containsKey("presentation"), code)
                val target = if (value.containsKey("target_id")) {
                    request.frame.elements.singleOrNull { it.id == value["target_id"] } ?: reject(code)
                } else null
                val presentation = if (target == null) null else when (value["presentation"]) {
                    "confirmed" -> StandaloneGuidancePresentation.CONFIRMED
                    "uncertain_candidate" -> StandaloneGuidancePresentation.UNCERTAIN_CANDIDATE
                    else -> reject(code)
                }
                if (presentation == StandaloneGuidancePresentation.UNCERTAIN_CANDIDATE) {
                    val normalized = normalize(instruction)
                    ensure(uncertain.containsMatchIn(normalized) && !confident.containsMatchIn(normalized), code)
                }
                StandaloneGuidanceContent.Step(instruction, target, presentation,
                    responseLabels(value, "expected_labels"), evidence(value, request))
            }
            "completed" -> {
                fields(value, required + "evidence_labels", setOf("review_proposal"))
                val previous = request.previousStep ?: reject(code)
                val labels = evidence(value, request)
                val expected = previous.expectedLabels
                val baseline = previous.frame.elements.map { it.label }.toSet()
                ensure(request.reason != StandaloneGuidanceReason.QUESTION && expected.isNotEmpty() && labels.isNotEmpty()
                    && validLabels(expected) && sameContext(previous.frame, request.frame)
                    && request.frame.sequence > previous.frame.sequence && request.frame.frameId != previous.frame.frameId
                    && !request.frame.frameHash.equals(previous.frame.frameHash, true)
                    && request.frame.capturedAtMs > maxOf(previous.frame.capturedAtMs, previous.issuedAtMs)
                    && expected.all { it in labels } && expected.any { it !in baseline }, code)
                val review = if (value.containsKey("review_proposal")) review(value["review_proposal"], nowMs) else null
                StandaloneGuidanceContent.CompletionCandidate(instruction, labels, review)
            }
            "clarify" -> { fields(value, required); StandaloneGuidanceContent.Clarify(instruction) }
            "unsupported" -> { fields(value, required); StandaloneGuidanceContent.Unsupported(instruction) }
            else -> reject(code)
        }
    }

    private fun evidence(value: Map<String, Any?>, request: StandaloneGuidanceRequest): List<String> {
        val labels = responseLabels(value, "evidence_labels")
        ensure(labels.all { label -> request.frame.elements.any { it.label == label } }, StandaloneGuidanceFailureCode.INVALID_RESPONSE)
        return labels
    }

    private fun responseLabels(value: Map<String, Any?>, key: String): List<String> {
        if (!value.containsKey(key)) return emptyList()
        val values = value[key] as? List<*> ?: reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE)
        val strings = values.map { it as? String ?: reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE) }
        ensure(validLabels(strings), StandaloneGuidanceFailureCode.INVALID_RESPONSE)
        return immutableGuidanceList(strings)
    }

    private fun review(value: Any?, nowMs: Long): StandaloneGuidanceReviewSuggestion {
        val code = StandaloneGuidanceFailureCode.INVALID_RESPONSE
        val proposal = record(value)
        fields(proposal, setOf("remind_at", "timezone", "reason"))
        val at = proposal["remind_at"] as? String ?: reject(code)
        val timezone = proposal["timezone"] as? String ?: reject(code)
        val reason = proposal["reason"] as? String ?: reject(code)
        ensure(at.matches(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-](?:(?:0\\d|1[0-3]):[0-5]\\d|14:00))"))
            && timezone.length in 1..64 && timezone.matches(Regex("[A-Za-z][A-Za-z0-9_+-]*(?:/[A-Za-z0-9_+-]+)*"))
            && timezone in ZoneId.getAvailableZoneIds() && safeText(reason, 240), code)
        val due = OffsetDateTime.parse(at).toInstant().toEpochMilli()
        ensure(due > nowMs && due - nowMs <= 365L * 86_400_000, code)
        return StandaloneGuidanceReviewSuggestion(due, timezone, reason)
    }

    private fun sameContext(first: StandaloneGuidanceFrame, second: StandaloneGuidanceFrame): Boolean =
        first.observationId == second.observationId && first.observationGeneration == second.observationGeneration
            && first.sourceId == second.sourceId && first.targetVersion == second.targetVersion
            && first.width == second.width && first.height == second.height

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC)
    private fun safeText(value: String, maximum: Int, allowEmpty: Boolean = false): Boolean {
        if (value.length > maximum || !allowEmpty && value.isBlank() || !validUnicode(value)) return false
        val normalized = normalize(value)
        return !forbidden.containsMatchIn(normalized) && !risky.containsMatchIn(normalized) && !personal.containsMatchIn(normalized)
            && !action.containsMatchIn(normalized) && !coordinates.containsMatchIn(normalized) && '<' !in normalized && '>' !in normalized
    }
    private fun genericLabel(value: String): Boolean = safeText(value, 48) && value == value.trim()
        && !Regex("[\\r\\n@{}\\[\\]=;!?。！？]|\\b\\d{5,}\\b").containsMatchIn(normalize(value))
    private fun validLabels(value: List<String>): Boolean = value.size <= 16 && value.all { genericLabel(it) }
        && value.map { normalize(it).lowercase(Locale.ROOT) }.distinct().size == value.size
    private fun validUnicode(value: String): Boolean {
        var offset = 0
        while (offset < value.length) {
            val character = value[offset++]
            if (character.isHighSurrogate()) {
                if (offset == value.length || !value[offset++].isLowSurrogate()) return false
            } else if (character.isLowSurrogate()) return false
        }
        return true
    }
    private fun record(value: Any?): Map<String, Any?> {
        val map = value as? Map<*, *> ?: reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE)
        return map.entries.associate { (it.key as? String ?: reject(StandaloneGuidanceFailureCode.INVALID_RESPONSE)) to it.value }
    }
    private fun fields(value: Map<String, Any?>, required: Set<String>, optional: Set<String> = emptySet()) {
        ensure(value.keys.containsAll(required) && value.keys.all { it in required || it in optional }, StandaloneGuidanceFailureCode.INVALID_RESPONSE)
    }
    private fun ensure(allowed: Boolean, code: StandaloneGuidanceFailureCode) { if (!allowed) reject(code) }
    private fun reject(code: StandaloneGuidanceFailureCode): Nothing = throw StandaloneGuidanceRejected(code)

    private fun requirePng(bytes: ByteArray, width: Int, height: Int) {
        val code = StandaloneGuidanceFailureCode.INVALID_REQUEST
        ensure(bytes.size in 57..MAX_IMAGE_BYTES && bytes.take(8) == listOf(137, 80, 78, 71, 13, 10, 26, 10).map { it.toByte() }, code)
        fun unsigned(offset: Int): Long = (0..3).fold(0L) { total, index -> (total shl 8) or (bytes[offset + index].toLong() and 255) }
        val data = ByteArrayOutputStream()
        val ancillary = mapOf("sRGB" to 1, "gAMA" to 4, "cHRM" to 32, "pHYs" to 9)
        val seen = HashSet<String>()
        var offset = 8
        var channels = 0
        var ended = false
        var dataEnded = false
        while (offset < bytes.size) {
            ensure(offset + 12 <= bytes.size, code)
            val lengthLong = unsigned(offset)
            ensure(lengthLong <= bytes.size - offset - 12, code)
            val length = lengthLong.toInt()
            val end = offset + length + 12
            val type = String(bytes, offset + 4, 4, Charsets.ISO_8859_1)
            val crc = CRC32().apply { update(bytes, offset + 4, length + 4) }.value
            ensure(crc == unsigned(end - 4) && (offset != 8 || type == "IHDR"), code)
            when (type) {
                "IHDR" -> {
                    ensure(offset == 8 && length == 13 && unsigned(offset + 8) == width.toLong()
                        && unsigned(offset + 12) == height.toLong() && bytes[offset + 16].toInt() == 8
                        && bytes[offset + 18].toInt() == 0 && bytes[offset + 19].toInt() == 0 && bytes[offset + 20].toInt() == 0, code)
                    channels = when (bytes[offset + 17].toInt()) { 0 -> 1; 2 -> 3; 4 -> 2; 6 -> 4; else -> reject(code) }
                }
                "IDAT" -> { ensure(!dataEnded && length > 0, code); data.write(bytes, offset + 8, length) }
                "IEND" -> { ensure(length == 0 && data.size() > 0 && end == bytes.size, code); ended = true }
                else -> ensure(ancillary[type] == length && seen.add(type) && data.size() == 0, code)
            }
            if (data.size() > 0 && type != "IDAT") dataEnded = true
            offset = end
        }
        ensure(ended && channels > 0, code)
        val compressed = data.toByteArray()
        val row = ByteArray(width * channels + 1)
        val inflater = Inflater()
        try {
            inflater.setInput(compressed)
            repeat(height) {
                var read = 0
                while (read < row.size) {
                    val count = inflater.inflate(row, read, row.size - read)
                    ensure(count > 0, code)
                    read += count
                }
                ensure(row[0].toInt() in 0..4, code)
            }
            ensure(inflater.inflate(ByteArray(1)) == 0 && inflater.finished() && inflater.remaining == 0, code)
        } finally { inflater.end(); compressed.fill(0); row.fill(0) }
    }
}

private class GuidanceJsonReader(private val source: String) {
    private var offset = 0
    private var nodes = 0
    private fun invalid(): Nothing = throw StandaloneGuidanceRejected(StandaloneGuidanceFailureCode.INVALID_RESPONSE)
    fun read(): Any? {
        val result = value(0)
        whitespace()
        if (offset != source.length) invalid()
        return result
    }
    private fun whitespace() { while (offset < source.length && source[offset] in " \r\n\t") offset++ }
    private fun value(depth: Int): Any? {
        whitespace()
        if (depth > 8 || ++nodes > 1024 || offset == source.length) invalid()
        return when (source[offset]) {
            '{' -> {
                offset++
                val result = LinkedHashMap<String, Any?>()
                whitespace()
                if (take('}')) result else {
                    do {
                        whitespace()
                        val key = string()
                        if (result.containsKey(key) || result.size >= 24) invalid()
                        whitespace()
                        if (!take(':')) invalid()
                        result[key] = value(depth + 1)
                        whitespace()
                        if (take('}')) break
                        if (!take(',')) invalid()
                    } while (true)
                    result
                }
            }
            '[' -> {
                offset++
                val result = ArrayList<Any?>()
                whitespace()
                if (take(']')) result else {
                    do {
                        if (result.size >= 80) invalid()
                        result.add(value(depth + 1))
                        whitespace()
                        if (take(']')) break
                        if (!take(',')) invalid()
                    } while (true)
                    result
                }
            }
            '"' -> string()
            't' -> literal("true", true)
            'f' -> literal("false", false)
            'n' -> literal("null", null)
            else -> number()
        }
    }
    private fun take(character: Char): Boolean = if (offset < source.length && source[offset] == character) { offset++; true } else false
    private fun literal(text: String, result: Any?): Any? {
        if (!source.startsWith(text, offset)) invalid()
        offset += text.length
        return result
    }
    private fun string(): String {
        if (!take('"')) invalid()
        val result = StringBuilder()
        while (offset < source.length) {
            val character = source[offset++]
            if (character == '"') return result.toString()
            if (character < ' ') invalid()
            if (character != '\\') result.append(character) else {
                if (offset == source.length) invalid()
                when (val escaped = source[offset++]) {
                    '"', '\\', '/' -> result.append(escaped)
                    'b' -> result.append('\b')
                    'f' -> result.append('\u000c')
                    'n' -> result.append('\n')
                    'r' -> result.append('\r')
                    't' -> result.append('\t')
                    'u' -> {
                        if (offset + 4 > source.length) invalid()
                        val hex = source.substring(offset, offset + 4)
                        if (!hex.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) invalid()
                        result.append(hex.toInt(16).toChar())
                        offset += 4
                    }
                    else -> invalid()
                }
            }
        }
        invalid()
    }
    private fun number(): Number {
        val start = offset
        take('-')
        if (!take('0')) {
            if (offset == source.length || source[offset] !in '1'..'9') invalid()
            while (offset < source.length && source[offset] in '0'..'9') offset++
        }
        if (take('.')) {
            val digits = offset
            while (offset < source.length && source[offset] in '0'..'9') offset++
            if (offset == digits) invalid()
        }
        if (take('e') || take('E')) {
            if (!take('+')) take('-')
            val digits = offset
            while (offset < source.length && source[offset] in '0'..'9') offset++
            if (offset == digits) invalid()
        }
        val token = source.substring(start, offset)
        if (token.length > 32) invalid()
        return token.toLongOrNull() ?: token.toDoubleOrNull()?.takeIf { it.isFinite() } ?: invalid()
    }
}
