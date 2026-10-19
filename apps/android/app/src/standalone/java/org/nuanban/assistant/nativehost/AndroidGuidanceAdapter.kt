package org.nuanban.assistant.nativehost

object AndroidGuidanceAdapter {
    fun request(job: AndroidTeachingJob, png: ByteArray): StandaloneGuidanceRequest {
        fun frame(screen: TeachingScreenContext, pixels: ByteArray): StandaloneGuidanceFrame = StandaloneGuidanceFrame(
            job.observationId, job.observationGeneration, screen.frameId, "android-primary-display", screen.target, screen.sequence,
            screen.capturedAtEpochMs, screen.width, screen.height, screen.frameHash, screen.sanitizedHash, pixels,
            screen.elements.map { element -> element.rect.let { rect -> StandaloneGuidanceElement(element.id, element.label, StandaloneGuidanceRect(rect.x.toDouble(), rect.y.toDouble(), rect.width.toDouble(), rect.height.toDouble())) } },
        )
        val previous = job.previous?.let { step -> StandaloneGuidancePreviousStep(frame(step.baseline, ByteArray(0)), step.baseline.capturedAtEpochMs + (step.issuedAtMs - step.baseline.capturedAtMs), step.instruction, step.expectedLabels) }
        val reason = when (job.reason) { "question" -> StandaloneGuidanceReason.QUESTION; "page_changed" -> StandaloneGuidanceReason.PAGE_CHANGED; "verification" -> StandaloneGuidanceReason.VERIFICATION; else -> throw IllegalArgumentException("Invalid teaching trigger") }
        return StandaloneGuidanceRequest(frame(job.screen, png), job.guideId, job.taskGeneration, job.triggerId, reason, job.question, previous)
    }

    fun reply(content: StandaloneGuidanceContent): AndroidTeachingReply = when (content) {
        is StandaloneGuidanceContent.Step -> AndroidTeachingReply("step", content.instruction, content.target?.id, when (content.presentation) { StandaloneGuidancePresentation.CONFIRMED -> "confirmed"; StandaloneGuidancePresentation.UNCERTAIN_CANDIDATE -> "uncertain_candidate"; null -> null }, content.expectedLabels, content.evidenceLabels)
        is StandaloneGuidanceContent.CompletionCandidate -> AndroidTeachingReply("completed", content.instruction, evidenceLabels = content.evidenceLabels)
        is StandaloneGuidanceContent.Clarify -> AndroidTeachingReply("clarify", content.instruction)
        is StandaloneGuidanceContent.Unsupported -> AndroidTeachingReply("unsupported", content.instruction)
    }
}
