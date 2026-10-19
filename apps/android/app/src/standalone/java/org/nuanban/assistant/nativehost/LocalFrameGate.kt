package org.nuanban.assistant.nativehost

data class FrameIdentity(val generation: Long, val sequence: Long, val capturedAtMs: Long, val targetVersion: String)
data class DetectionProof(val frame: FrameIdentity, val modelSha256: String, val risk: FrameRisk, val finishedAtMs: Long, val redactionComplete: Boolean)

class LocalFrameGate(private val trustedModelSha256: String? = null, private val detectorVerified: Boolean = false, private val detectorVerifier: (() -> Boolean)? = null) {
    private var generation: Long? = null
    private var targetVersion: String? = null
    private var lastSequence = -1L

    fun detectorReady(): Boolean = (detectorVerified || detectorVerifier?.invoke() == true) && trustedModelSha256?.matches(Regex("[a-f0-9]{64}")) == true

    @Synchronized fun authorize(currentGeneration: Long, target: String, consent: Boolean, targetSupported: Boolean): Boolean {
        stop()
        if (!detectorReady() || !consent || !targetSupported || currentGeneration < 1 || target.isBlank()) return false
        generation = currentGeneration
        targetVersion = target
        return true
    }

    @Synchronized fun inspect(frame: FrameIdentity, proof: DetectionProof?, nowMs: Long): GateDecision {
        val reason = when {
            generation == null -> "detector_or_target_unavailable"
            frame.generation != generation || frame.targetVersion != targetVersion -> "stale_generation_or_target"
            frame.sequence < 0 || frame.sequence <= lastSequence -> "replayed_frame"
            nowMs < frame.capturedAtMs || frame.capturedAtMs < 0 || nowMs - frame.capturedAtMs > 500 -> "frame_expired"
            proof == null -> "detection_missing"
            proof.frame != frame -> "proof_frame_mismatch"
            proof.modelSha256 != trustedModelSha256 -> "model_not_trusted"
            proof.finishedAtMs < frame.capturedAtMs || proof.finishedAtMs > nowMs || proof.finishedAtMs - frame.capturedAtMs > 300 -> "detection_timeout"
            proof.risk != FrameRisk.SAFE -> "risk_blocked"
            !proof.redactionComplete -> "redaction_unconfirmed"
            else -> "safe_local_only"
        }
        if (frame.generation == generation) lastSequence = maxOf(lastSequence, frame.sequence)
        return GateDecision(reason == "safe_local_only", reason)
    }

    @Synchronized fun stop() { generation = null; targetVersion = null; lastSequence = -1 }
}
