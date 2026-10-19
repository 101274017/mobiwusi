package org.nuanban.assistant.nativehost

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.time.Instant
import java.util.Collections
import java.util.IdentityHashMap
import java.util.zip.CRC32
import java.util.zip.DeflaterOutputStream

object StandaloneGuidanceProtocolChecks {
    private val timestamp = Instant.parse("2026-10-18T00:00:00Z").toEpochMilli()
    private val image = png()
    private val digest = sha(image)
    private val setting = StandaloneGuidanceElement("settings", "设置", StandaloneGuidanceRect(1.0, 1.0, 4.0, 4.0))
    private val display = StandaloneGuidanceElement("display", "显示", StandaloneGuidanceRect(6.0, 1.0, 4.0, 4.0))

    @JvmStatic fun main(args: Array<String>) { println("StandaloneGuidanceProtocolChecks: " + run().size + " passed") }

    fun run(): List<String> {
        val cases = mutableListOf<String>()
        fun scenario(name: String, action: () -> Unit) {
            try { action(); cases.add(name) } catch (error: Throwable) { throw AssertionError(name, error) }
        }
        fun invalid(request: StandaloneGuidanceRequest) {
            check(StandaloneGuidanceProtocol.validateRequest(request, timestamp) == StandaloneGuidanceFailureCode.INVALID_REQUEST)
        }
        fun rejected(json: String, request: StandaloneGuidanceRequest = request()) {
            check(StandaloneGuidanceProtocol.validateResponse(json, request, timestamp) ==
                StandaloneGuidanceOutcome.Failure(StandaloneGuidanceFailureCode.INVALID_RESPONSE))
        }
        fun accepted(json: String, request: StandaloneGuidanceRequest = request()): StandaloneGuidanceContent =
            (StandaloneGuidanceProtocol.validateResponse(json, request, timestamp) as StandaloneGuidanceOutcome.Success).content

        scenario("valid_redacted_png_request") { check(StandaloneGuidanceProtocol.validateRequest(request(), timestamp) == null) }
        scenario("default_gate_denies") {
            check(StandaloneGuidanceGuard(now = { timestamp }).beforeSend(request(), StandaloneGuidanceCancellation()) == StandaloneGuidanceFailureCode.OUTBOUND_CLOSED)
        }
        scenario("identity_set_not_value_attestation") {
            val admitted = Collections.newSetFromMap(IdentityHashMap<StandaloneGuidanceFrame, Boolean>())
            val original = frame()
            admitted.add(original)
            val current = request(original)
            val guard = StandaloneGuidanceGuard({ admitted.contains(it) }, { it === current }, { timestamp })
            check(guard.beforeSend(current, StandaloneGuidanceCancellation()) == null)
            check(guard.beforeSend(request(frame()), StandaloneGuidanceCancellation()) == StandaloneGuidanceFailureCode.OUTBOUND_CLOSED)
            check(guard.beforeSend(request(original), StandaloneGuidanceCancellation()) == StandaloneGuidanceFailureCode.OUTBOUND_CLOSED)
        }
        scenario("generation_change_closes_gate") {
            var generation = 2L
            val original = request()
            val guard = StandaloneGuidanceGuard({ true }, { it.frame.observationGeneration == generation }, { timestamp })
            check(guard.beforeSend(original, StandaloneGuidanceCancellation()) == null)
            generation++
            check(guard.afterResponse(original, StandaloneGuidanceCancellation()) == StandaloneGuidanceFailureCode.OUTBOUND_CLOSED)
        }
        scenario("slow_response_uses_current_job_not_old_admission") {
            var admitted = true
            var current = true
            var clock = timestamp
            val original = request()
            val guard = StandaloneGuidanceGuard({ admitted }, { current }, { clock })
            check(guard.beforeSend(original, StandaloneGuidanceCancellation()) == null)
            admitted = false
            clock += 60_000
            check(guard.afterResponse(original, StandaloneGuidanceCancellation()) == null)
            check(guard.beforeSend(original, StandaloneGuidanceCancellation()) == StandaloneGuidanceFailureCode.OUTBOUND_CLOSED)
            check(accepted(response(original), original) is StandaloneGuidanceContent.Step)
            current = false
            check(guard.afterResponse(original, StandaloneGuidanceCancellation()) == StandaloneGuidanceFailureCode.OUTBOUND_CLOSED)
        }
        scenario("gate_callback_exception_is_closed") {
            val guard = StandaloneGuidanceGuard({ error("synthetic-secret") }, { true }, { timestamp })
            check(guard.beforeSend(request(), StandaloneGuidanceCancellation()) == StandaloneGuidanceFailureCode.OUTBOUND_CLOSED)
        }
        scenario("cancel_disconnects_once_and_suppresses_late_result") {
            val cancellation = StandaloneGuidanceCancellation()
            var disconnects = 0
            check(cancellation.claim())
            cancellation.attach { disconnects++ }
            cancellation.cancel()
            cancellation.cancel()
            check(disconnects == 1 && cancellation.isCancelled())
            val guard = StandaloneGuidanceGuard({ true }, { true }, { timestamp })
            check(guard.afterResponse(request(), cancellation) == StandaloneGuidanceFailureCode.CANCELLED)
            check(!cancellation.claim())
        }
        scenario("cancel_before_attach_disconnects_immediately") {
            val cancellation = StandaloneGuidanceCancellation()
            cancellation.cancel()
            var disconnects = 0
            cancellation.attach { disconnects++ }
            check(disconnects == 1 && !cancellation.claim())
        }
        scenario("timeout_preserves_first_terminal_reason") {
            val cancellation = StandaloneGuidanceCancellation()
            cancellation.timeout()
            cancellation.cancel()
            check(cancellation.failureCode() == StandaloneGuidanceFailureCode.TIMED_OUT)
        }
        scenario("finished_cancel_does_not_disconnect") {
            val cancellation = StandaloneGuidanceCancellation()
            var disconnects = 0
            check(cancellation.claim())
            cancellation.attach { disconnects++ }
            check(cancellation.finish() == null)
            cancellation.cancel()
            check(disconnects == 0 && !cancellation.claim())
        }
        scenario("cancel_exception_is_not_exposed") {
            val cancellation = StandaloneGuidanceCancellation()
            cancellation.attach { error("synthetic-secret") }
            cancellation.cancel()
            check(cancellation.failureCode() == StandaloneGuidanceFailureCode.CANCELLED)
        }
        scenario("frame_copies_and_erases_png") {
            val source = image.copyOf()
            val elements = mutableListOf(setting)
            val captured = frame(pixels = source, elements = elements)
            source.fill(0)
            elements.clear()
            check(captured.sanitizedPngCopy().contentEquals(image) && captured.elements.size == 1)
            captured.erase()
            check(captured.sanitizedPngCopy().all { it == 0.toByte() })
            invalid(request(captured))
        }
        for ((name, candidate) in listOf(
            "expired" to frame(captured = timestamp - 30_001), "future" to frame(captured = timestamp + 1),
            "negative_time" to frame(captured = -1), "zero_generation" to frame(generation = 0),
            "unsafe_integer_generation" to frame(generation = 9_007_199_254_740_992),
            "negative_sequence" to frame(sequence = -1), "invalid_frame_id" to frame(id = "frame/bad"),
            "same_hashes" to frame(originalHash = digest), "bad_hash" to frame(sanitizedHash = "a"),
            "wrong_digest" to frame(sanitizedHash = "c".repeat(64)), "wrong_dimensions" to frame(width = 17),
            "zero_dimensions" to frame(width = 0), "too_many_pixels" to frame(width = 4096, height = 4096),
            "empty_source" to frame(source = ""), "empty_target" to frame(target = ""),
            "missing_png" to frame(pixels = byteArrayOf()),
            "truncated_png" to frame(pixels = image.copyOf(image.size - 1), sanitizedHash = sha(image.copyOf(image.size - 1))),
        )) scenario("request_" + name) { invalid(request(candidate)) }
        scenario("crc_corruption") {
            val corrupt = image.copyOf().also { it[29] = (it[29].toInt() xor 1).toByte() }
            invalid(request(frame(pixels = corrupt, sanitizedHash = sha(corrupt))))
        }
        scenario("png_metadata_forbidden") {
            val metadata = png(extra = "tEXt" to "synthetic-text".toByteArray())
            invalid(request(frame(pixels = metadata, sanitizedHash = sha(metadata))))
        }
        for ((name, element) in listOf(
            "negative" to setting.copy(rect = StandaloneGuidanceRect(-1.0, 0.0, 1.0, 1.0)),
            "outside" to setting.copy(rect = StandaloneGuidanceRect(15.0, 0.0, 2.0, 1.0)),
            "zero" to setting.copy(rect = StandaloneGuidanceRect(0.0, 0.0, 0.0, 1.0)),
            "nan" to setting.copy(rect = StandaloneGuidanceRect(Double.NaN, 0.0, 1.0, 1.0)),
            "infinity" to setting.copy(rect = StandaloneGuidanceRect(0.0, 0.0, Double.POSITIVE_INFINITY, 1.0)),
            "private_label" to setting.copy(label = "支付"), "long_label" to setting.copy(label = "字".repeat(49)),
            "html_label" to setting.copy(label = "<显示>"), "bad_id" to setting.copy(id = "unsafe/id"),
        )) scenario("control_" + name) { invalid(request(frame(elements = listOf(element)))) }
        scenario("duplicate_control_ids") { invalid(request(frame(elements = listOf(setting, setting)))) }
        scenario("control_label_budget") {
            invalid(request(frame(elements = (0 until 50).map { setting.copy(id = "element-" + it, label = "字".repeat(48)) })))
        }
        for (question in listOf("", " ", "字".repeat(2001), "付款", "password", "ｐａｓｓｗｏｒｄ", "发送给 test@example.com", "自动点击", "https://example.com", "x=123")) {
            scenario("unsafe_question_" + cases.size) { invalid(request(question = question)) }
        }
        scenario("non_question_may_be_empty") {
            check(StandaloneGuidanceProtocol.validateRequest(request(reason = StandaloneGuidanceReason.PAGE_CHANGED, question = ""), timestamp) == null)
        }
        scenario("https_configuration") {
            check(StandaloneGuidanceConfig("https://service.example/base/", "device-session-token").endpointOrNull().toString() ==
                "https://service.example/base/v1/standalone/guidance/analyze")
        }
        for (address in listOf("", "http://service.example", "http://127.0.0.1", "ftp://service.example", "https://user:secret@service.example", "https://service.example?q=secret", "https://service.example#fragment", "https://service.example/../bad", "https://service.example/%2e%2e", "https://service.example//bad", "https://service.example:0")) {
            scenario("invalid_config_" + cases.size) { check(StandaloneGuidanceConfig(address, "session").endpointOrNull() == null) }
        }
        for (address in listOf("http://127.0.0.1:8080", "http://localhost:8080", "http://[::1]:8080")) {
            scenario("explicit_loopback_" + cases.size) { check(StandaloneGuidanceConfig(address, "session", true).endpointOrNull() != null) }
        }
        scenario("http_lan_not_development_loopback") { check(StandaloneGuidanceConfig("http://192.168.1.2", "session", true).endpointOrNull() == null) }
        for (token in listOf("", "session\r\nsecret", "Bearer session", "sk-provider-secret", "字", "a".repeat(4097))) {
            scenario("invalid_session_token_" + cases.size) { check(StandaloneGuidanceConfig("https://service.example", token).endpointOrNull() == null) }
        }
        scenario("config_to_string_redacted") { check(!StandaloneGuidanceConfig("https://service.example", "synthetic-secret").toString().contains("synthetic-secret")) }
        scenario("unbounded_timeout_unavailable") { check(StandaloneGuidanceConfig("https://service.example", "session", callTimeoutMs = 0).endpointOrNull() == null) }

        val current = request()
        scenario("target_is_exact_local_control") {
            val step = accepted(response(current, extra = mapOf("target_id" to "settings", "presentation" to "confirmed")), current) as StandaloneGuidanceContent.Step
            check(step.target === current.frame.elements[0] && step.presentation == StandaloneGuidancePresentation.CONFIRMED)
        }
        scenario("step_without_target") { check((accepted(response(current)) as StandaloneGuidanceContent.Step).target == null) }
        for ((field, replacement) in listOf("observation_id" to "other", "guide_id" to "other", "observation_generation" to 3L,
            "task_generation" to 4L, "trigger_id" to "other", "frame_id" to "other")) {
            scenario("response_correlation_" + field) { rejected(response(current, extra = mapOf(field to replacement))) }
        }
        for (extra in listOf(mapOf("target_id" to "missing", "presentation" to "confirmed"), mapOf("target_id" to "settings"),
            mapOf("presentation" to "confirmed"), mapOf("target_id" to "settings", "presentation" to "unknown"),
            mapOf("target_id" to null, "presentation" to null), mapOf("rect" to mapOf("x" to 1)), mapOf("actions" to listOf("click")),
            mapOf("evidence_labels" to listOf("不存在")), mapOf("expected_labels" to listOf("显示", "显示")),
            mapOf("expected_labels" to listOf("显示", "DISPLAY", "display")), mapOf("expected_labels" to null),
            mapOf("expected_labels" to List(17) { "显示" }), mapOf("review_proposal" to emptyMap<String, Any?>()))) {
            scenario("invalid_response_fields_" + cases.size) { rejected(response(current, extra = extra)) }
        }
        scenario("uncertain_candidate_honest") {
            check(accepted(response(current, instruction = "这可能是候选位置，请先核对。", extra = mapOf("target_id" to "settings", "presentation" to "uncertain_candidate"))) is StandaloneGuidanceContent.Step)
        }
        for (instruction in listOf("请点击设置。", "已确认这是候选位置。", "Definitely a candidate", "可能支付", "x=120", "<b>显示</b>", "自动点击显示", "打开 https://example.com", "password", "\u200B显示", "字".repeat(601))) {
            scenario("unsafe_or_dishonest_instruction_" + cases.size) {
                rejected(response(current, instruction = instruction, extra = mapOf("target_id" to "settings", "presentation" to "uncertain_candidate")))
            }
        }
        for (kind in listOf("clarify", "unsupported")) {
            scenario("plain_" + kind) { accepted(response(current, kind = kind)) }
            scenario("extra_fields_" + kind) { rejected(response(current, kind = kind, extra = mapOf("evidence_labels" to emptyList<String>()))) }
        }
        scenario("unknown_kind") { rejected(response(current, kind = "execute")) }
        val validJson = response(current)
        for (malformed in listOf(validJson + "{}", validJson.dropLast(1) + ",}", validJson.replace("\"kind\":\"step\"", "\"kind\":\"step\",\"kind\":\"clarify\""),
            validJson.replace("\"task_generation\":3", "\"task_generation\":3.5"), validJson.replace("\"task_generation\":3", "\"task_generation\":\"3\""),
            validJson.replace("\"task_generation\":3", "\"task_generation\":03"), "[" + validJson + "]", "{unquoted:true}",
            " ".repeat(StandaloneGuidanceProtocol.MAX_RESPONSE_BYTES + 1), validJson.replace("请亲手选择显示。", "\\uD800"))) {
            scenario("strict_json_" + cases.size) { rejected(malformed) }
        }
        scenario("valid_service_envelope") { accepted(json(mapOf("data" to responseMap(current), "request_id" to "trigger-1", "schema_version" to "0.2.0"))) }
        scenario("envelope_request_id_mismatch") { rejected(json(mapOf("data" to responseMap(current), "request_id" to "other", "schema_version" to "0.2.0"))) }
        scenario("envelope_unknown_field") { rejected(json(mapOf("data" to responseMap(current), "request_id" to "trigger-1", "schema_version" to "0.2.0", "debug" to "secret"))) }

        val baseline = frame(id = "frame-old", sequence = 1, captured = timestamp - 2000, originalHash = "b".repeat(64), pixels = byteArrayOf(), elements = listOf(setting))
        val previous = StandaloneGuidancePreviousStep(baseline, timestamp - 1500, "请亲手选择显示。", listOf("显示"))
        val verification = request(frame(elements = listOf(display)), previous = previous, reason = StandaloneGuidanceReason.VERIFICATION)
        val completion = response(verification, kind = "completed", extra = mapOf("evidence_labels" to listOf("显示")))
        scenario("baseline_without_pixels_is_valid_metadata") { check(StandaloneGuidanceProtocol.validateRequest(verification, timestamp) == null) }
        scenario("completion_is_candidate_not_success_state") { check(accepted(completion, verification) is StandaloneGuidanceContent.CompletionCandidate) }
        scenario("completion_requires_previous") { rejected(response(current, kind = "completed", extra = mapOf("evidence_labels" to listOf("设置")))) }
        scenario("question_cannot_complete") {
            val question = request(verification.frame, previous = previous)
            rejected(response(question, kind = "completed", extra = mapOf("evidence_labels" to listOf("显示"))), question)
        }
        for (candidate in listOf(
            request(verification.frame, previous = StandaloneGuidancePreviousStep(baseline, timestamp - 1500, "请核对。", emptyList()), reason = StandaloneGuidanceReason.VERIFICATION),
            request(frame(elements = listOf(display), sequence = 1), previous = previous, reason = StandaloneGuidanceReason.VERIFICATION),
            request(frame(elements = listOf(display), captured = timestamp - 1600), previous = previous, reason = StandaloneGuidanceReason.VERIFICATION),
            request(frame(elements = listOf(display), source = "other"), previous = previous, reason = StandaloneGuidanceReason.VERIFICATION),
            request(frame(elements = listOf(display), target = "other"), previous = previous, reason = StandaloneGuidanceReason.VERIFICATION),
            request(frame(elements = listOf(display), generation = 3), previous = previous, reason = StandaloneGuidanceReason.VERIFICATION),
            request(frame(elements = listOf(display), originalHash = "b".repeat(64)), previous = previous, reason = StandaloneGuidanceReason.VERIFICATION),
        )) scenario("completion_new_frame_required_" + cases.size) { rejected(response(candidate, kind = "completed", extra = mapOf("evidence_labels" to listOf("显示"))), candidate) }
        scenario("completion_requires_new_expected_label") {
            val old = frame(id = "old", sequence = 1, captured = timestamp - 2000, originalHash = "b".repeat(64), elements = listOf(display))
            val candidate = request(verification.frame, previous = StandaloneGuidancePreviousStep(old, timestamp - 1500, "请核对。", listOf("显示")), reason = StandaloneGuidanceReason.PAGE_CHANGED)
            rejected(response(candidate, kind = "completed", extra = mapOf("evidence_labels" to listOf("显示"))), candidate)
        }
        for (labels in listOf(emptyList(), listOf("设置"), listOf("显示", "不存在"), listOf("显示", "显示"))) {
            scenario("completion_evidence_" + cases.size) { rejected(response(verification, kind = "completed", extra = mapOf("evidence_labels" to labels)), verification) }
        }
        fun review(at: String = Instant.ofEpochMilli(timestamp + 86_400_000).toString(), zone: String = "Asia/Shanghai", reason: String = "稍后练习显示设置。") =
            mapOf("remind_at" to at, "timezone" to zone, "reason" to reason)
        scenario("future_review_is_suggestion_only") {
            val result = accepted(response(verification, kind = "completed", extra = mapOf("evidence_labels" to listOf("显示"), "review_proposal" to review())), verification)
            check((result as StandaloneGuidanceContent.CompletionCandidate).reviewSuggestion?.timezone == "Asia/Shanghai")
        }
        for (proposal in listOf(review(at = Instant.ofEpochMilli(timestamp).toString()), review(at = Instant.ofEpochMilli(timestamp + 366L * 86_400_000).toString()),
            review(at = "2026-02-30T00:00:00Z"), review(at = "2026-10-19T24:00:00Z"), review(zone = "Not/AZone"), review(reason = "支付"), review() + ("scheduled" to true))) {
            scenario("invalid_review_" + cases.size) { rejected(response(verification, kind = "completed", extra = mapOf("evidence_labels" to listOf("显示"), "review_proposal" to proposal)), verification) }
        }
        return cases.map { "guidance_protocol_" + it }
    }

    private fun frame(
        id: String = "frame-1", generation: Long = 2, sequence: Long = 2, captured: Long = timestamp - 100,
        source: String = "display-0", target: String = "target-1", width: Int = 16, height: Int = 16,
        originalHash: String = "a".repeat(64), sanitizedHash: String = digest, pixels: ByteArray = image,
        elements: List<StandaloneGuidanceElement> = listOf(setting),
    ) = StandaloneGuidanceFrame("observation-1", generation, id, source, target, sequence, captured, width, height, originalHash, sanitizedHash, pixels, elements)

    private fun request(frame: StandaloneGuidanceFrame = frame(), question: String = "如何调整字体大小？",
        previous: StandaloneGuidancePreviousStep? = null, reason: StandaloneGuidanceReason = StandaloneGuidanceReason.QUESTION,
    ) = StandaloneGuidanceRequest(frame, "guide-1", 3, "trigger-1", reason, question, previous)

    private fun responseMap(request: StandaloneGuidanceRequest, kind: String = "step", instruction: String = "请亲手选择显示。", extra: Map<String, Any?> = emptyMap()): Map<String, Any?> =
        linkedMapOf<String, Any?>("observation_id" to request.frame.observationId, "guide_id" to request.guideId,
            "observation_generation" to request.frame.observationGeneration, "task_generation" to request.taskGeneration,
            "trigger_id" to request.triggerId, "frame_id" to request.frame.frameId, "kind" to kind, "instruction" to instruction) + extra
    private fun response(request: StandaloneGuidanceRequest, kind: String = "step", instruction: String = "请亲手选择显示。", extra: Map<String, Any?> = emptyMap()): String =
        json(responseMap(request, kind, instruction, extra))
    private fun json(value: Any?): String = when (value) {
        null -> "null"
        is String -> "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\""
        is Map<*, *> -> value.entries.joinToString(",", "{", "}") { json(it.key) + ":" + json(it.value) }
        is List<*> -> value.joinToString(",", "[", "]") { json(it) }
        else -> value.toString()
    }
    private fun sha(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun png(extra: Pair<String, ByteArray>? = null): ByteArray {
        val result = ByteArrayOutputStream()
        result.write(byteArrayOf(137.toByte(), 80, 78, 71, 13, 10, 26, 10))
        fun chunk(type: String, payload: ByteArray) {
            val name = type.toByteArray(Charsets.US_ASCII)
            val stream = DataOutputStream(result)
            stream.writeInt(payload.size)
            stream.write(name)
            stream.write(payload)
            stream.writeInt(CRC32().apply { update(name); update(payload) }.value.toInt())
        }
        val header = ByteArrayOutputStream()
        DataOutputStream(header).apply { writeInt(16); writeInt(16); write(byteArrayOf(8, 2, 0, 0, 0)) }
        chunk("IHDR", header.toByteArray())
        if (extra != null) chunk(extra.first, extra.second)
        val compressed = ByteArrayOutputStream()
        DeflaterOutputStream(compressed).use { it.write(ByteArray((16 * 3 + 1) * 16)) }
        chunk("IDAT", compressed.toByteArray())
        chunk("IEND", byteArrayOf())
        return result.toByteArray()
    }
}
