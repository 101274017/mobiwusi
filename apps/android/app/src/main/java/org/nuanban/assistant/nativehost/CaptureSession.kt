package org.nuanban.assistant.nativehost

import java.util.UUID

enum class CapturePhase { IDLE, AWAITING_CONSENT, STARTING, QUARANTINED, STOPPED }
enum class CaptureStop { USER, CONSENT_DENIED, START_FAILED, SYSTEM_REVOKED, SCREEN_OFF, LOCKED, DISPLAY_CHANGED, NOTIFICATION_UNAVAILABLE, OVERLAY_UNAVAILABLE, TIME_LIMIT, FRAME_FAILED, TASK_REMOVED, DESTROYED }
data class CaptureTicket(val generation: Long, val nonce: String)
data class CaptureSnapshot(val phase: CapturePhase, val generation: Long, val framesReleased: Long, val lateFrames: Long, val resourcePending: Boolean, val cleanupFailures: Int, val stopReason: CaptureStop?) {
    val stopped: Boolean get() = phase != CapturePhase.STARTING && phase != CapturePhase.QUARANTINED && phase != CapturePhase.AWAITING_CONSENT && !resourcePending && cleanupFailures == 0
}

class CaptureSession {
    private var phase = CapturePhase.IDLE
    private var generation = 0L
    private var ticket: CaptureTicket? = null
    private var owner: CaptureTicket? = null
    private var released = 0L
    private var late = 0L
    private var failures = 0
    private var reason: CaptureStop? = null

    @Synchronized fun snapshot() = CaptureSnapshot(phase, generation, released, late, owner != null, failures, reason)

    @Synchronized fun requestConsent(): CaptureTicket? {
        if (phase !in setOf(CapturePhase.IDLE, CapturePhase.STOPPED) || owner != null || failures != 0) return null
        generation += 1
        released = 0
        late = 0
        reason = null
        phase = CapturePhase.AWAITING_CONSENT
        return CaptureTicket(generation, UUID.randomUUID().toString()).also { ticket = it }
    }

    @Synchronized fun resolveConsent(candidate: CaptureTicket, granted: Boolean): Boolean {
        if (candidate != ticket || phase != CapturePhase.AWAITING_CONSENT) return false
        if (!granted) { stop(CaptureStop.CONSENT_DENIED); return false }
        phase = CapturePhase.STARTING
        return true
    }

    @Synchronized fun claim(candidate: CaptureTicket): Boolean {
        if (candidate != ticket || phase != CapturePhase.STARTING || owner != null) return false
        owner = candidate
        return true
    }

    @Synchronized fun mayStart(candidate: CaptureTicket): Boolean = candidate == ticket && phase == CapturePhase.STARTING

    @Synchronized fun started(candidate: CaptureTicket): Boolean {
        if (candidate != ticket || owner != candidate || phase != CapturePhase.STARTING) return false
        phase = CapturePhase.QUARANTINED
        return true
    }

    @Synchronized fun releaseFrame(candidate: CaptureTicket, close: () -> Unit): Boolean {
        val current = candidate == ticket && phase == CapturePhase.QUARANTINED
        if (!current) late += 1
        try { close(); released += 1 } catch (_: Exception) { failures += 1; stop(CaptureStop.FRAME_FAILED); return false }
        return current
    }

    @Synchronized fun stop(cause: CaptureStop) {
        if (phase == CapturePhase.STOPPED) return
        phase = CapturePhase.STOPPED
        generation += 1
        ticket = null
        reason = cause
    }

    @Synchronized fun released(candidate: CaptureTicket, cleanupFailures: Int) {
        require(cleanupFailures >= 0)
        if (owner != candidate) return
        if (ticket == candidate) stop(CaptureStop.DESTROYED)
        failures += cleanupFailures
        owner = null
    }
}
