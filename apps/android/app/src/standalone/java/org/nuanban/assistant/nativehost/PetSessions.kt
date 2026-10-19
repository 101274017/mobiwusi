package org.nuanban.assistant.nativehost

import java.util.UUID

enum class PetObservationPhase { IDLE, AWAITING_SYSTEM, STARTING, OBSERVING, PRIVACY_PAUSED, STOPPED }
enum class PetTeachingPhase { IDLE, WAITING_FOR_OBSERVATION, ACTIVE, UNAVAILABLE, STOPPED }
data class PetObservationTicket(val generation: Long, val nonce: String)
data class PetSnapshot(
    val observation: PetObservationPhase,
    val observationGeneration: Long,
    val teaching: PetTeachingPhase,
    val teachingGeneration: Long,
    val guideId: String?,
    val reason: String,
    val cloudChannelOpen: Boolean = false,
    val familyChannelOpen: Boolean = false,
    val cloudAnalysisConsent: Boolean = false,
)

class PetSessions {
    private var observation = PetObservationPhase.IDLE
    private var observationGeneration = 1L
    private var teaching = PetTeachingPhase.IDLE
    private var teachingGeneration = 1L
    private var guideId: String? = null
    private var ticket: PetObservationTicket? = null
    private var reason = "not_observing"
    private var cloudAnalysisConsent = false

    @Synchronized fun snapshot() = PetSnapshot(observation, observationGeneration, teaching, teachingGeneration, guideId, reason, cloudAnalysisConsent = cloudAnalysisConsent)

    @Synchronized fun requestObservation(nativeConsent: Boolean, overlayGranted: Boolean, notificationGranted: Boolean, detectorReady: Boolean, cloudConsent: Boolean = false): PetObservationTicket? {
        if (observation in setOf(PetObservationPhase.AWAITING_SYSTEM, PetObservationPhase.STARTING, PetObservationPhase.OBSERVING)) return null
        if (!nativeConsent) { reason = "native_consent_required"; return null }
        if (!overlayGranted || !notificationGranted) { privacyPause("overlay_or_notification_unavailable"); return null }
        if (!detectorReady) { privacyPause("local_detector_unavailable"); return null }
        observationGeneration += 1
        cloudAnalysisConsent = cloudConsent
        ticket = PetObservationTicket(observationGeneration, UUID.randomUUID().toString())
        observation = PetObservationPhase.AWAITING_SYSTEM
        reason = "awaiting_fresh_system_consent"
        return ticket
    }

    @Synchronized fun resolveConsent(candidate: PetObservationTicket, granted: Boolean): Boolean {
        if (ticket != candidate || observation != PetObservationPhase.AWAITING_SYSTEM) return false
        if (!granted) { stopAll("system_consent_denied"); return false }
        observation = PetObservationPhase.STARTING
        reason = "starting_local_observation"
        return true
    }

    @Synchronized fun mayStart(candidate: PetObservationTicket): Boolean = ticket == candidate && observation == PetObservationPhase.STARTING

    @Synchronized fun captureStarted(candidate: PetObservationTicket): Boolean {
        if (!mayStart(candidate)) return false
        observation = PetObservationPhase.OBSERVING
        reason = "local_observation_active"
        return true
    }

    @Synchronized fun captureStopped(candidate: PetObservationTicket, cause: String, privacy: Boolean) {
        if (ticket != candidate) return
        if (privacy) privacyPause(cause) else stopAll(cause)
    }

    @Synchronized fun beginTeaching(question: String, guidanceAvailable: Boolean = false): Boolean {
        if (question.isBlank() || question.length > 2000) return false
        teachingGeneration += 1
        guideId = UUID.randomUUID().toString()
        teaching = if (observation != PetObservationPhase.OBSERVING) PetTeachingPhase.WAITING_FOR_OBSERVATION else if (guidanceAvailable && cloudAnalysisConsent) PetTeachingPhase.ACTIVE else PetTeachingPhase.UNAVAILABLE
        reason = when (teaching) { PetTeachingPhase.ACTIVE -> "waiting_for_safe_frame_user_operates"; PetTeachingPhase.UNAVAILABLE -> "authenticated_cloud_guidance_unavailable"; else -> "safe_observation_required_no_upload" }
        return true
    }

    @Synchronized fun stopTeaching() {
        teachingGeneration += 1
        teaching = PetTeachingPhase.STOPPED
        guideId = null
    }

    @Synchronized fun privacyPause(cause: String) {
        observationGeneration += 1
        observation = PetObservationPhase.PRIVACY_PAUSED
        cloudAnalysisConsent = false
        ticket = null
        reason = cause
        stopTeaching()
    }

    @Synchronized fun stopAll(cause: String) {
        observationGeneration += 1
        observation = PetObservationPhase.STOPPED
        cloudAnalysisConsent = false
        ticket = null
        reason = cause
        stopTeaching()
    }
}
