package org.nuanban.assistant.nativehost

import java.util.UUID

data class TeachingScreenContext(val frameId: String, val generation: Long, val sequence: Long, val capturedAtMs: Long, val target: String, val signature: String, val width: Int, val height: Int, val elements: List<LocalScreenElement>, val capturedAtEpochMs: Long = 0, val frameHash: String = "", val sanitizedHash: String = "")
data class TeachingStep(val instruction: String, val expectedLabels: List<String>, val baseline: TeachingScreenContext, val target: LocalScreenElement?, val uncertain: Boolean, val issuedAtMs: Long = 0)
data class AndroidTeachingJob(val observationId: String, val observationGeneration: Long, val guideId: String, val taskGeneration: Long, val triggerId: String, val reason: String, val question: String, val screen: TeachingScreenContext, val previous: TeachingStep?)
data class AndroidTeachingReply(val kind: String, val instruction: String, val targetId: String? = null, val presentation: String? = null, val expectedLabels: List<String> = emptyList(), val evidenceLabels: List<String> = emptyList())
data class AndroidTeachingView(val phase: String, val instruction: String, val target: LocalScreenElement? = null, val uncertain: Boolean = false, val expiresAtMs: Long = 0)

class AndroidTeachingState(private val now: () -> Long) {
    private var observationId: String? = null
    private var observationGeneration = 0L
    private var taskGeneration = 0L
    private var guideId: String? = null
    private var question = ""
    private var cloudConsent = false
    private var latest: TeachingScreenContext? = null
    private var previous: TeachingStep? = null
    private var pendingReason: String? = null
    private var inFlight: AndroidTeachingJob? = null
    private var requireSequenceAfter = -1L
    private var view = AndroidTeachingView("idle", "请本人开启观察，再提出想学的操作。")

    @Synchronized fun snapshot(): AndroidTeachingView {
        if (view.target != null && now() > view.expiresAtMs) return view.copy(target = null)
        return view
    }
    @Synchronized fun currentScreen(): TeachingScreenContext? = latest
    @Synchronized fun discard(job: AndroidTeachingJob) {
        if (inFlight !== job) return
        inFlight = null
        if (view.phase == "analyzing") view = AndroidTeachingView("waiting", "画面已变化，等待新的本地安全画面。")
    }
    @Synchronized fun beginObservation(generation: Long, consent: Boolean) {
        observationId = UUID.randomUUID().toString()
        observationGeneration = generation
        cloudConsent = consent
        latest = null
        previous = null
        inFlight = null
        requireSequenceAfter = -1
        if (guideId != null) { pendingReason = "question"; view = AndroidTeachingView("waiting", "等待当前屏幕通过本地检查。") }
    }
    @Synchronized fun ask(text: String): Boolean {
        if (text.isBlank() || text.length > 2000 || AndroidScreenPolicy.restrictedText(text)) return false
        taskGeneration += 1
        guideId = UUID.randomUUID().toString()
        question = text.trim()
        previous = null
        inFlight = null
        pendingReason = "question"
        requireSequenceAfter = latest?.sequence ?: -1
        view = AndroidTeachingView("waiting", if (observationId == null) "请本人开启观察并选择是否允许必要脱敏画面分析。" else "等待新画面检查；不会替您点击或输入。")
        return true
    }
    @Synchronized fun verify(): Boolean {
        if (guideId == null || observationId == null || previous == null) return false
        inFlight = null
        pendingReason = "verification"
        requireSequenceAfter = latest?.sequence ?: -1
        view = view.copy(phase = "verifying", target = null)
        return true
    }
    @Synchronized fun onFrame(screen: TeachingScreenContext): Boolean {
        if (observationId == null || screen.generation != observationGeneration || screen.sequence < 0 || now() < screen.capturedAtMs || now() - screen.capturedAtMs > AndroidScreenPolicy.MAX_FRAME_AGE_MS || screen.elements.isEmpty() || screen.elements.any { !it.rect.within(screen.width, screen.height) }) return false
        val before = latest
        if (before != null && (before.generation != screen.generation || before.target != screen.target || before.width != screen.width || before.height != screen.height || before.sequence >= screen.sequence)) return false
        latest = screen
        if (guideId == null) return true
        val step = previous
        if (before != null && before.signature != screen.signature && pendingReason != "verification" && pendingReason != "question") {
            val baseline = step?.baseline ?: before
            val oldLabels = baseline.elements.map { AndroidScreenPolicy.normalize(it.label) }.toSet()
            val newControls = screen.signature != baseline.signature && screen.elements.any { AndroidScreenPolicy.normalize(it.label) !in oldLabels }
            if (newControls) pendingReason = "page_changed"
            else if (step != null) view = AndroidTeachingView("needs_verification", "当前目标或布局变化尚不能确认结果；请亲手操作后点桌宠核验。")
        }
        if (step != null && before?.signature == screen.signature && view.phase == "guiding") {
            val target = step.target?.let { match -> screen.elements.find { it.label == match.label && it.rect == match.rect } }
            view = view.copy(target = target, expiresAtMs = now() + 1200)
        } else if (before != null && before.signature != screen.signature) view = view.copy(target = null)
        return true
    }
    @Synchronized fun takeJob(): AndroidTeachingJob? {
        val observation = observationId ?: return null
        val guide = guideId ?: return null
        val reason = pendingReason ?: return null
        val screen = latest ?: return null
        if (inFlight != null || screen.sequence <= requireSequenceAfter || now() < screen.capturedAtMs || now() - screen.capturedAtMs > AndroidScreenPolicy.MAX_FRAME_AGE_MS) return null
        if (!cloudConsent) { view = AndroidTeachingView("unavailable", "未同意云分析，画面只在本地处理。"); pendingReason = null; return null }
        val job = AndroidTeachingJob(observation, observationGeneration, guide, taskGeneration, UUID.randomUUID().toString(), reason, question, screen, previous)
        inFlight = job
        pendingReason = null
        view = AndroidTeachingView("analyzing", "正在分析本次必要脱敏画面；请先不要继续下一步。")
        return job
    }
    @Synchronized fun isCurrent(job: AndroidTeachingJob): Boolean {
        val screen = latest ?: return false
        return cloudConsent && inFlight === job && observationId == job.observationId && observationGeneration == job.observationGeneration && guideId == job.guideId && taskGeneration == job.taskGeneration && screen.generation == job.screen.generation && screen.target == job.screen.target && screen.signature == job.screen.signature && screen.width == job.screen.width && screen.height == job.screen.height && now() >= screen.capturedAtMs && now() - screen.capturedAtMs <= 5000
    }
    private fun verifiedTransition(job: AndroidTeachingJob, screen: TeachingScreenContext, evidence: List<String>): Boolean {
        val step = job.previous ?: return false
        if (job.reason !in setOf("verification", "page_changed") || screen.sequence <= step.baseline.sequence || step.expectedLabels.isEmpty()) return false
        val oldLabels = step.baseline.elements.map { AndroidScreenPolicy.normalize(it.label) }.toSet()
        val currentLabels = screen.elements.map { AndroidScreenPolicy.normalize(it.label) }.toSet()
        val expected = step.expectedLabels.map(AndroidScreenPolicy::normalize).toSet()
        val proven = expected.intersect(currentLabels) - oldLabels
        return proven.isNotEmpty() && evidence.map(AndroidScreenPolicy::normalize).any { it in proven }
    }
    @Synchronized fun apply(job: AndroidTeachingJob, reply: AndroidTeachingReply): Boolean {
        if (!isCurrent(job)) { if (inFlight === job) inFlight = null; return false }
        val screen = latest ?: return false
        inFlight = null
        if (reply.instruction.isBlank() || reply.instruction.length > 600 || AndroidScreenPolicy.restrictedText(reply.instruction) || reply.evidenceLabels.size > 16 || reply.evidenceLabels.any { it.isBlank() || it.length > 48 || AndroidScreenPolicy.restrictedText(it) }) { unavailable("分析结果不安全或无效，未显示指引。"); return false }
        if (reply.kind in setOf("clarify", "unsupported")) { view = AndroidTeachingView(reply.kind, reply.instruction); return true }
        if (job.previous != null && !verifiedTransition(job, screen, reply.evidenceLabels)) {
            view = AndroidTeachingView("needs_verification", "当前新画面尚不能证明这一步完成；请继续操作或重新核验。")
            return false
        }
        if (reply.kind == "completed") {
            if (job.previous == null || !verifiedTransition(job, screen, reply.evidenceLabels)) { unavailable("尚无新的本地证据证明完成。"); return false }
            view = AndroidTeachingView("completed", reply.instruction + " 完成不代表已掌握，掌握状态仍需本人确认。")
            guideId = null
            question = ""
            previous = null
            pendingReason = null
            return true
        }
        if (reply.kind != "step" || reply.expectedLabels.size > 16 || reply.expectedLabels.any { it.isBlank() || it.length > 48 || AndroidScreenPolicy.restrictedText(it) }) { unavailable("分析结果结构无效。"); return false }
        val proposed = reply.targetId?.let { id -> job.screen.elements.find { it.id == id } }
        val target = proposed?.let { candidate -> screen.elements.find { it.label == candidate.label && it.rect == candidate.rect } }
        if (reply.targetId != null && (target == null || reply.presentation !in setOf("confirmed", "uncertain_candidate"))) { unavailable("目标已无法定位，请重新观察。"); return false }
        val uncertain = reply.presentation == "uncertain_candidate"
        val instruction = (if (uncertain) "位置不确定，请您先核对：" else "") + reply.instruction
        previous = TeachingStep(instruction, reply.expectedLabels, screen, target, uncertain, now())
        view = AndroidTeachingView("guiding", instruction, target, uncertain, now() + 1200)
        return true
    }
    @Synchronized fun unavailable(message: String) { inFlight = null; pendingReason = null; view = AndroidTeachingView("unavailable", message) }
    @Synchronized fun finishTeaching() {
        taskGeneration += 1
        guideId = null
        question = ""
        previous = null
        pendingReason = null
        inFlight = null
        view = AndroidTeachingView("ended", "本次教学已结束；仍有效的本地观察不会因此自动停止。")
    }
    @Synchronized fun stopObservation(reason: String) {
        finishTeaching()
        observationId = null
        observationGeneration += 1
        cloudConsent = false
        latest = null
        view = AndroidTeachingView("stopped", "观察已停止：" + reason)
    }
}
