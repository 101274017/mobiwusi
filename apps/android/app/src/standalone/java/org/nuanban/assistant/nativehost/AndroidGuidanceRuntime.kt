package org.nuanban.assistant.nativehost

import android.content.Context
import android.os.SystemClock
import java.util.concurrent.Executors

data class AndroidGuidanceDisplay(val view: AndroidTeachingView, val target: LocalScreenRect?, val geometry: AndroidCaptureGeometry?)

object AndroidGuidanceRuntime {
    private class ActiveRequest(val job: AndroidTeachingJob, val local: LocallySanitizedFrame, val request: StandaloneGuidanceRequest, val cancellation: StandaloneGuidanceCancellation)
    private val state = AndroidTeachingState(SystemClock::elapsedRealtime)
    private val executor = Executors.newSingleThreadExecutor()
    private var active: ActiveRequest? = null
    private var connection: GuidanceConnection? = null
    private var geometry: AndroidCaptureGeometry? = null
    private var generation: Long? = null
    private var cloudConsent = false
    private var hostContext: Context? = null
    private var listener: (() -> Unit)? = null

    @Synchronized fun setListener(changed: (() -> Unit)?) { listener = changed }
    private fun changed() { listener?.invoke() }

    @Synchronized fun beginObservation(context: Context, captureGeneration: Long, source: AndroidCaptureGeometry, consent: Boolean) {
        active?.cancellation?.cancel()
        active?.request?.frame?.erase()
        generation = captureGeneration
        geometry = source.takeIf { it.valid() }
        cloudConsent = consent
        hostContext = context.applicationContext
        connection = if (consent) AndroidGuidanceConnection.read(context) else null
        state.beginObservation(captureGeneration, consent)
        changed()
    }

    @Synchronized fun ask(question: String): Boolean {
        if (!state.ask(question)) return false
        active?.cancellation?.cancel()
        active?.request?.frame?.erase()
        PetRuntime.sessions.beginTeaching(question, connection != null && cloudConsent)
        changed()
        return true
    }

    @Synchronized fun verify(): Boolean {
        if (!state.verify()) return false
        active?.cancellation?.cancel()
        active?.request?.frame?.erase()
        changed()
        return true
    }

    @Synchronized fun pauseForControls() {
        active?.let { it.cancellation.cancel(); it.request.frame.erase(); state.discard(it.job) }
        changed()
    }

    @Synchronized fun onFrame(frame: LocallySanitizedFrame) {
        if (generation != frame.identity.generation || NativeCaptureRuntime.detector?.isAdmitted(frame, SystemClock.elapsedRealtime()) != true) return
        val screen = TeachingScreenContext("frame_" + frame.identity.generation + "_" + frame.identity.sequence, frame.identity.generation, frame.identity.sequence, frame.identity.capturedAtMs,
            frame.identity.targetVersion, frame.signature, frame.width, frame.height, frame.elements, frame.capturedAtEpochMs, frame.frameHash, frame.sanitizedHash)
        if (!state.onFrame(screen)) return
        active?.let { if (!state.isCurrent(it.job)) it.cancellation.cancel() }
        if (active == null) dispatch(frame)
        changed()
    }

    private fun dispatch(frame: LocallySanitizedFrame) {
        val job = state.takeJob() ?: return
        val settings = connection
        if (settings == null) { state.unavailable("未配置可用微光指引设备会话；没有上传，也不会以演示步骤代替。"); return }
        val config = StandaloneGuidanceConfig(settings.baseUrl, settings.accessToken)
        if (config.endpointOrNull() == null) { state.unavailable("教学服务配置不可用；未发送画面。"); return }
        val png = frame.sanitizedPng()
        val request = try { AndroidGuidanceAdapter.request(job, png) } catch (_: Exception) { state.unavailable("当前画面不能形成有效教学请求。"); return } finally { png.fill(0) }
        val pending = ActiveRequest(job, frame, request, StandaloneGuidanceCancellation())
        active = pending
        val client = StandaloneGuidanceClient(config,
            isAdmitted = { candidate -> synchronized(this) { active === pending && candidate === pending.request.frame && NativeCaptureRuntime.detector?.isAdmitted(pending.local, SystemClock.elapsedRealtime()) == true } },
            isCurrent = { candidate -> synchronized(this) { candidate === pending.request && isCurrent(pending) } },
        )
        executor.execute {
            val outcome = try { client.analyze(request, pending.cancellation) } catch (_: Exception) { StandaloneGuidanceOutcome.Failure(StandaloneGuidanceFailureCode.FAILED) }
            synchronized(this) {
                if (active === pending) {
                    if (isCurrent(pending)) {
                        when (outcome) {
                            is StandaloneGuidanceOutcome.Success -> if (!pending.cancellation.isCancelled()) state.apply(job, AndroidGuidanceAdapter.reply(outcome.content)) else state.unavailable("本次分析已取消，未显示迟到指引。")
                            is StandaloneGuidanceOutcome.Failure -> state.unavailable("本次教学分析不可用（" + outcome.code.name + "）；没有自动重试，请本人重新提问或核验。")
                        }
                    } else state.discard(job)
                    active = null
                    changed()
                }
                request.frame.erase()
                request.previousStep?.frame?.erase()
            }
        }
    }

    private fun isCurrent(pending: ActiveRequest): Boolean {
        val context = hostContext ?: return false
        val capture = NativeCaptureRuntime.session.snapshot()
        return active === pending && cloudConsent && generation == pending.job.observationGeneration && state.isCurrent(pending.job) &&
            capture.phase == CapturePhase.QUARANTINED && capture.generation == pending.job.observationGeneration &&
            PetRuntime.sessions.snapshot().observation == PetObservationPhase.OBSERVING && PetRuntime.running && !PetRuntime.localControlsVisible() &&
            android.provider.Settings.canDrawOverlays(context) && PetRuntime.notificationGranted(context) && !context.getSystemService(android.app.KeyguardManager::class.java).isKeyguardLocked
    }

    @Synchronized fun display(): AndroidGuidanceDisplay {
        val view = state.snapshot()
        val screen = state.currentScreen()
        val current = generation != null && screen != null && SystemClock.elapsedRealtime() - screen.capturedAtMs in 0..1200
        return AndroidGuidanceDisplay(view, if (current && !PetRuntime.localControlsVisible()) view.target?.let { geometry?.map(it.rect) } else null, if (PetRuntime.localControlsVisible()) null else geometry)
    }

    @Synchronized fun status(): String = "云分析：" + (if (!cloudConsent) "本次未同意，出口关闭" else if (connection == null) "本次同意但连接未配置，不上传" else "按需鉴权分析；非连续上云") + "\n教学：" + state.snapshot().instruction

    @Synchronized fun finishTeaching() {
        active?.cancellation?.cancel()
        active?.request?.frame?.erase()
        state.finishTeaching()
        PetRuntime.sessions.stopTeaching()
        changed()
    }

    @Synchronized fun stopObservation(reason: String, expectedGeneration: Long? = null) {
        if (expectedGeneration != null && generation != expectedGeneration) return
        cloudConsent = false
        generation = null
        geometry = null
        connection = null
        hostContext = null
        state.stopObservation(reason)
        active?.cancellation?.cancel()
        active?.request?.frame?.erase()
        changed()
    }
}
