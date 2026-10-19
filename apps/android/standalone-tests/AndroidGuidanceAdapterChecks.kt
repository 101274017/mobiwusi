package org.nuanban.assistant.nativehost

object AndroidGuidanceAdapterChecks {
    fun run(): List<String> {
        val cases = mutableListOf<String>()
        fun scenario(name: String, action: () -> Unit) { try { action(); cases.add(name) } catch (error: Throwable) { throw AssertionError(name, error) } }
        val pixels = byteArrayOf(1, 2, 3, 4)
        val element = LocalScreenElement("display_1", "显示", LocalScreenRect(2, 3, 8, 4))
        val screen = TeachingScreenContext("frame_2_1", 2, 1, 100, "android-display:1080x2400:576x1280", "safe-signature", 576, 1280, listOf(element), 1_792_281_600_000, "a".repeat(64), AndroidScreenPolicy.sha256(pixels))
        fun job(reason: String = "question", previous: TeachingStep? = null) = AndroidTeachingJob("observation_1", 2, "guide_1", 9, "trigger_1", reason, "如何调整字体", screen, previous)
        scenario("android_adapter_binds_request_correlations") { val request = AndroidGuidanceAdapter.request(job(), pixels); check(request.frame.observationId == "observation_1" && request.frame.observationGeneration == 2L && request.guideId == "guide_1" && request.taskGeneration == 9L && request.triggerId == "trigger_1" && request.frame.frameId == screen.frameId) }
        scenario("android_adapter_uses_epoch_not_monotonic_timestamp") { check(AndroidGuidanceAdapter.request(job(), pixels).frame.capturedAtMs == screen.capturedAtEpochMs) }
        scenario("android_adapter_preserves_local_frame_hashes") { val frame = AndroidGuidanceAdapter.request(job(), pixels).frame; check(frame.frameHash == screen.frameHash && frame.sanitizedSha256 == screen.sanitizedHash) }
        scenario("android_adapter_target_is_current_local_element") { val wire = AndroidGuidanceAdapter.request(job(), pixels).frame.elements.single(); check(wire.id == element.id && wire.label == element.label && wire.rect == StandaloneGuidanceRect(2.0, 3.0, 8.0, 4.0)) }
        scenario("android_adapter_screen_source_not_software_allowlist") { val frame = AndroidGuidanceAdapter.request(job(), pixels).frame; check(frame.sourceId == "android-primary-display" && frame.targetVersion == screen.target) }
        scenario("android_adapter_copies_sanitized_input") { val buffer = pixels.copyOf(); val frame = AndroidGuidanceAdapter.request(job(), buffer).frame; buffer.fill(0); check(frame.sanitizedPngCopy().contentEquals(pixels)); frame.erase(); check(frame.sanitizedPngCopy().all { it == 0.toByte() }) }
        scenario("android_adapter_no_previous_image_retained") { val step = TeachingStep("请亲手点击显示", listOf("字体大小"), screen, element, false, 150); val previous = requireNotNull(AndroidGuidanceAdapter.request(job("verification", step), pixels).previousStep); check(previous.frame.sanitizedPngCopy().isEmpty() && previous.frame.frameHash == screen.frameHash && previous.issuedAtMs == screen.capturedAtEpochMs + 50) }
        scenario("android_adapter_three_bounded_trigger_types") { check(AndroidGuidanceAdapter.request(job(), pixels).reason == StandaloneGuidanceReason.QUESTION); check(AndroidGuidanceAdapter.request(job("page_changed"), pixels).reason == StandaloneGuidanceReason.PAGE_CHANGED); check(AndroidGuidanceAdapter.request(job("verification"), pixels).reason == StandaloneGuidanceReason.VERIFICATION) }
        scenario("android_adapter_unknown_trigger_rejected") { check(runCatching { AndroidGuidanceAdapter.request(job("periodic_upload"), pixels) }.isFailure) }
        scenario("android_adapter_unproven_pixels_fail_protocol") { check(StandaloneGuidanceProtocol.validateRequest(AndroidGuidanceAdapter.request(job(), pixels), screen.capturedAtEpochMs) == StandaloneGuidanceFailureCode.INVALID_REQUEST) }
        val wireElement = StandaloneGuidanceElement(element.id, element.label, StandaloneGuidanceRect(2.0, 3.0, 8.0, 4.0))
        scenario("android_adapter_confirmed_step_keeps_local_id") { val reply = AndroidGuidanceAdapter.reply(StandaloneGuidanceContent.Step("请亲手点击显示", wireElement, StandaloneGuidancePresentation.CONFIRMED, listOf("字体大小"), listOf("显示"))); check(reply.kind == "step" && reply.targetId == element.id && reply.presentation == "confirmed" && reply.expectedLabels == listOf("字体大小") && reply.evidenceLabels == listOf("显示")) }
        scenario("android_adapter_uncertain_step_not_confirmed") { check(AndroidGuidanceAdapter.reply(StandaloneGuidanceContent.Step("可能在这里，请核对", wireElement, StandaloneGuidancePresentation.UNCERTAIN_CANDIDATE, emptyList(), emptyList())).presentation == "uncertain_candidate") }
        scenario("android_adapter_text_step_has_no_coordinates") { val reply = AndroidGuidanceAdapter.reply(StandaloneGuidanceContent.Step("请亲手打开设置", null, null, emptyList(), emptyList())); check(reply.targetId == null && reply.presentation == null) }
        scenario("android_adapter_completion_stays_candidate") { val reply = AndroidGuidanceAdapter.reply(StandaloneGuidanceContent.CompletionCandidate("已看到结果", listOf("字体大小"), null)); check(reply.kind == "completed" && reply.evidenceLabels == listOf("字体大小") && reply.targetId == null) }
        scenario("android_adapter_review_not_automatically_scheduled") { val content = StandaloneGuidanceContent.CompletionCandidate("已看到结果", listOf("字体大小"), StandaloneGuidanceReviewSuggestion(1_800_000_000_000, "Asia/Shanghai", "建议复习")); check(AndroidGuidanceAdapter.reply(content) == AndroidGuidanceAdapter.reply(content.copy(reviewSuggestion = null))) }
        scenario("android_adapter_clarify_has_no_target") { check(AndroidGuidanceAdapter.reply(StandaloneGuidanceContent.Clarify("请说明想调整的内容")) == AndroidTeachingReply("clarify", "请说明想调整的内容")) }
        scenario("android_adapter_unsupported_not_demo_steps") { check(AndroidGuidanceAdapter.reply(StandaloneGuidanceContent.Unsupported("当前页面暂不支持")) == AndroidTeachingReply("unsupported", "当前页面暂不支持")) }
        return cases
    }
}
