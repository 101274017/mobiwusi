package org.nuanban.nativelab

import java.util.UUID

enum class LabPhase { IDLE, AWAITING_CONSENT, STARTING, CAPTURING, STOPPED }

enum class LabStopReason {
    USER, CONSENT_DENIED, NOTIFICATION_UNAVAILABLE, START_FAILED, PROJECTION_REVOKED,
    TIME_LIMIT, SCREEN_OFF, DEVICE_LOCKED, DISPLAY_CHANGED, OVERLAY_UNAVAILABLE,
    FRAME_FAILED, RELEASE_FAILED, TASK_REMOVED, SERVICE_DESTROYED
}

data class LabTicket(val generation: Long, val nonce: String)

data class LabSnapshot(
    val phase: LabPhase,
    val generation: Long,
    val frames: Long,
    val released: Long,
    val lateFrames: Long,
    val releaseFailures: Long,
    val cleanupPending: Boolean,
    val cleanupFailures: Long,
    val stopReason: LabStopReason?
)

class LabSession {
    private var phase = LabPhase.IDLE
    private var generation = 0L
    private var ticket: LabTicket? = null
    private var serviceTicket: LabTicket? = null
    private var frames = 0L
    private var released = 0L
    private var lateFrames = 0L
    private var releaseFailures = 0L
    private var cleanupFailures = 0L
    private var stopReason: LabStopReason? = null

    @Synchronized
    fun snapshot() = LabSnapshot(phase, generation, frames, released, lateFrames, releaseFailures, serviceTicket != null, cleanupFailures, stopReason)

    @Synchronized
    fun beginConsent(): LabTicket? {
        if ((phase != LabPhase.IDLE && phase != LabPhase.STOPPED) || serviceTicket != null || cleanupFailures != 0L) return null
        generation += 1
        frames = 0
        released = 0
        lateFrames = 0
        releaseFailures = 0
        stopReason = null
        phase = LabPhase.AWAITING_CONSENT
        return LabTicket(generation, UUID.randomUUID().toString()).also { ticket = it }
    }

    @Synchronized
    fun resolveConsent(candidate: LabTicket, granted: Boolean): Boolean {
        if (ticket != candidate || phase != LabPhase.AWAITING_CONSENT) return false
        if (!granted) {
            stop(LabStopReason.CONSENT_DENIED)
            return false
        }
        phase = LabPhase.STARTING
        return true
    }

    @Synchronized
    fun mayStart(candidate: LabTicket) = candidate == ticket && phase == LabPhase.STARTING

    @Synchronized
    fun claimService(candidate: LabTicket): Boolean {
        if (!mayStart(candidate) || serviceTicket != null) return false
        serviceTicket = candidate
        return true
    }

    @Synchronized
    fun started(candidate: LabTicket): Boolean {
        if (!mayStart(candidate) || serviceTicket != candidate) return false
        phase = LabPhase.CAPTURING
        return true
    }

    @Synchronized
    fun quarantineFrame(candidate: LabTicket, release: () -> Unit): Boolean {
        val current = candidate == ticket && phase == LabPhase.CAPTURING
        if (current) frames += 1 else lateFrames += 1
        try {
            release()
            released += 1
        } catch (_: Exception) {
            releaseFailures += 1
            if (current) stop(LabStopReason.RELEASE_FAILED)
            return false
        }
        return current
    }

    @Synchronized
    fun stop(candidate: LabTicket, reason: LabStopReason): Boolean {
        if (candidate != ticket) return false
        stop(reason)
        return true
    }

    @Synchronized
    fun serviceReleased(candidate: LabTicket, failures: Int) {
        if (candidate != serviceTicket) return
        require(failures >= 0)
        if (candidate == ticket) stop(LabStopReason.SERVICE_DESTROYED)
        cleanupFailures += failures
        serviceTicket = null
    }

    @Synchronized
    fun stop(reason: LabStopReason) {
        if (phase == LabPhase.STOPPED) return
        phase = LabPhase.STOPPED
        generation += 1
        ticket = null
        stopReason = reason
    }
}

object LabRuntime {
    val session = LabSession()
    const val MAX_DURATION_MS = 30_000L
}
