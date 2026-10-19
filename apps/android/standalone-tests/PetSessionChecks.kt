package org.nuanban.assistant.nativehost

object PetSessionChecks {
    @JvmStatic fun main(args: Array<String>) {
        val cases = mutableListOf<String>()
        fun scenario(name: String, action: () -> Unit) { action(); cases.add(name) }
        fun observing(sessions: PetSessions): PetObservationTicket {
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(sessions.resolveConsent(ticket, true))
            check(sessions.captureStarted(ticket))
            return ticket
        }
        scenario("default_no_capture_or_channels") {
            val state = PetSessions().snapshot()
            check(state.observation == PetObservationPhase.IDLE && state.teaching == PetTeachingPhase.IDLE)
            check(!state.cloudChannelOpen && !state.familyChannelOpen)
        }
        scenario("management_stop_does_not_claim_active_pet_stopped") {
            val sessions = PetSessions()
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(sessions.resolveConsent(ticket, true) && sessions.captureStarted(ticket))
            val snapshot = sessions.snapshot()
            check(PetManagementBoundary.protectsPetSession(snapshot, true))
            check(!PetManagementBoundary.stopReply(snapshot, CaptureSession().snapshot()).containsKey("stopped"))
        }
        scenario("management_stop_does_not_cancel_pending_pet_consent") {
            val sessions = PetSessions()
            check(sessions.requestObservation(true, true, true, true) != null)
            check(PetManagementBoundary.protectsPetSession(sessions.snapshot(), false))
        }
        scenario("management_stop_can_confirm_inactive_pet_after_capture_cleanup") {
            val sessions = PetSessions()
            val capture = CaptureSession()
            check(!PetManagementBoundary.protectsPetSession(sessions.snapshot(), false))
            check(PetManagementBoundary.stopReply(sessions.snapshot(), capture.snapshot())["stopped"] == true)
            val ticket = requireNotNull(capture.requestConsent())
            check(capture.resolveConsent(ticket, true) && capture.claim(ticket) && capture.started(ticket))
            capture.stop(CaptureStop.USER)
            capture.released(ticket, 0)
            check(PetManagementBoundary.stopReply(sessions.snapshot(), capture.snapshot())["captureActive"] == false)
        }
        scenario("management_stop_does_not_change_observation_or_teaching") {
            val sessions = PetSessions()
            observing(sessions)
            check(sessions.beginTeaching("synthetic local question"))
            val before = sessions.snapshot()
            check(PetManagementBoundary.protectsPetSession(before, false))
            val response = PetManagementBoundary.stopReply(before, CaptureSession().snapshot())
            check(response["error_code"] == "bridge_error" && !response.containsKey("stopped"))
            check(sessions.snapshot() == before)
        }
        scenario("management_teaching_without_capture_is_still_separate") {
            val sessions = PetSessions()
            check(sessions.beginTeaching("synthetic local question"))
            check(PetManagementBoundary.protectsPetSession(sessions.snapshot(), false))
            check(!PetManagementBoundary.stopReply(sessions.snapshot(), CaptureSession().snapshot()).containsKey("stopped"))
            sessions.stopTeaching()
            check(!PetManagementBoundary.protectsPetSession(sessions.snapshot(), false))
        }
        scenario("management_waits_for_pet_resource_cleanup") {
            val sessions = PetSessions()
            sessions.privacyPause("synthetic_unknown")
            check(PetManagementBoundary.protectsPetSession(sessions.snapshot(), true))
            val capture = CaptureSession()
            val ticket = requireNotNull(capture.requestConsent())
            check(capture.resolveConsent(ticket, true) && capture.claim(ticket))
            capture.stop(CaptureStop.USER)
            check(!PetManagementBoundary.stopReply(sessions.snapshot(), capture.snapshot()).containsKey("stopped"))
            capture.released(ticket, 1)
            check(!PetManagementBoundary.stopReply(sessions.snapshot(), capture.snapshot()).containsKey("stopped"))
        }
        scenario("management_idle_reply_is_exact_and_does_not_restore_privacy_pause") {
            val sessions = PetSessions()
            sessions.privacyPause("synthetic_unknown")
            val before = sessions.snapshot()
            val response = PetManagementBoundary.stopReply(before, CaptureSession().snapshot())
            check(response == mapOf("stopped" to true, "captureActive" to false))
            check(sessions.snapshot() == before)
        }
        scenario("native_consent_required") { check(PetSessions().requestObservation(false, true, true, true) == null) }
        scenario("overlay_required") { check(PetSessions().requestObservation(true, false, true, true) == null) }
        scenario("stop_notification_required") { check(PetSessions().requestObservation(true, true, false, true) == null) }
        scenario("missing_detector_prevents_authorization") {
            val sessions = PetSessions()
            check(sessions.requestObservation(true, true, true, false) == null)
            check(sessions.snapshot().observation == PetObservationPhase.PRIVACY_PAUSED)
        }
        scenario("native_consent_does_not_start_capture") {
            val sessions = PetSessions()
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(!sessions.captureStarted(ticket) && !sessions.mayStart(ticket))
        }
        scenario("system_denial_invalidates_ticket") {
            val sessions = PetSessions()
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(!sessions.resolveConsent(ticket, false) && !sessions.resolveConsent(ticket, true))
        }
        scenario("system_consent_one_use") {
            val sessions = PetSessions()
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(sessions.resolveConsent(ticket, true) && !sessions.resolveConsent(ticket, true))
        }
        scenario("nonce_cannot_be_forged") {
            val sessions = PetSessions()
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(!sessions.resolveConsent(ticket.copy(nonce = "forged"), true))
        }
        scenario("overlapping_requests_rejected") {
            val sessions = PetSessions()
            observing(sessions)
            check(sessions.requestObservation(true, true, true, true) == null)
        }
        scenario("teaching_without_observation_never_uploads") {
            val sessions = PetSessions()
            check(sessions.beginTeaching("合成问题"))
            check(sessions.snapshot().teaching == PetTeachingPhase.WAITING_FOR_OBSERVATION)
            check(!sessions.snapshot().cloudChannelOpen)
        }
        scenario("missing_cloud_auth_is_unavailable_not_mock") {
            val sessions = PetSessions()
            observing(sessions)
            check(sessions.beginTeaching("合成问题"))
            check(sessions.snapshot().teaching == PetTeachingPhase.UNAVAILABLE)
            check(sessions.snapshot().reason == "authenticated_cloud_guidance_unavailable")
        }
        scenario("ending_teaching_preserves_observation") {
            val sessions = PetSessions()
            observing(sessions)
            val generation = sessions.snapshot().observationGeneration
            sessions.beginTeaching("合成问题")
            sessions.stopTeaching()
            check(sessions.snapshot().observation == PetObservationPhase.OBSERVING)
            check(sessions.snapshot().observationGeneration == generation)
            check(sessions.snapshot().teaching == PetTeachingPhase.STOPPED)
        }
        scenario("new_teaching_has_independent_generation_and_id") {
            val sessions = PetSessions()
            sessions.beginTeaching("合成问题一")
            val first = sessions.snapshot()
            sessions.beginTeaching("合成问题二")
            check(sessions.snapshot().teachingGeneration > first.teachingGeneration)
            check(sessions.snapshot().guideId != first.guideId)
            check(sessions.snapshot().observationGeneration == first.observationGeneration)
        }
        scenario("no_question_content_retained") {
            val sessions = PetSessions()
            sessions.beginTeaching("synthetic-private-question")
            check(!sessions.snapshot().toString().contains("synthetic-private-question"))
        }
        scenario("invalid_question_rejected") {
            val sessions = PetSessions()
            check(!sessions.beginTeaching(" ") && !sessions.beginTeaching("字".repeat(2001)))
        }
        scenario("privacy_pause_closes_both_sessions_and_exits") {
            val sessions = PetSessions()
            val ticket = observing(sessions)
            sessions.beginTeaching("合成问题")
            sessions.privacyPause("sensitive")
            check(sessions.snapshot().observation == PetObservationPhase.PRIVACY_PAUSED)
            check(sessions.snapshot().teaching == PetTeachingPhase.STOPPED)
            check(!sessions.snapshot().cloudChannelOpen && !sessions.snapshot().familyChannelOpen)
            check(!sessions.captureStarted(ticket))
        }
        scenario("privacy_recovery_requires_fresh_native_and_system_consent") {
            val sessions = PetSessions()
            val old = observing(sessions)
            sessions.privacyPause("unknown")
            check(sessions.requestObservation(false, true, true, true) == null)
            val fresh = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(fresh.generation > old.generation && fresh.nonce != old.nonce)
            check(!sessions.captureStarted(fresh))
            check(sessions.resolveConsent(fresh, true) && sessions.captureStarted(fresh))
        }
        scenario("stale_stop_cannot_cancel_new_observation") {
            val sessions = PetSessions()
            val old = observing(sessions)
            sessions.stopAll("user")
            observing(sessions)
            sessions.captureStopped(old, "late_callback", true)
            check(sessions.snapshot().observation == PetObservationPhase.OBSERVING)
        }
        for (reason in listOf("screen_off", "system_revoked", "overlay_lost", "notification_unavailable", "frame_failed", "display_changed")) {
            scenario(reason + "_requires_new_authorization") {
                val sessions = PetSessions()
                val old = observing(sessions)
                sessions.captureStopped(old, reason, true)
                check(!sessions.mayStart(old) && !sessions.captureStarted(old))
                check(sessions.snapshot().observation == PetObservationPhase.PRIVACY_PAUSED)
            }
        }
        scenario("process_restart_does_not_restore_observation") {
            val oldProcess = PetSessions()
            observing(oldProcess)
            check(PetSessions().snapshot().observation == PetObservationPhase.IDLE)
        }
        scenario("default_native_detector_unavailable") {
            val gate = LocalFrameGate()
            check(!gate.detectorReady())
            check(!gate.authorize(1, "synthetic-target", true, true))
            check(!gate.inspect(FrameIdentity(1, 1, 100, "synthetic-target"), null, 100).allowed)
        }
        val model = "a".repeat(64)
        for (risk in FrameRisk.entries) {
            scenario("gate_" + risk.name.lowercase()) {
                val gate = LocalFrameGate(model, true)
                check(gate.authorize(1, "synthetic-target", true, true))
                val frame = FrameIdentity(1, 1, 100, "synthetic-target")
                val proof = DetectionProof(frame, model, risk, 110, true)
                check(gate.inspect(frame, proof, 120).allowed == (risk == FrameRisk.SAFE))
                gate.stop()
                check(!gate.inspect(frame, proof, 120).allowed)
            }
        }
        scenario("missing_redaction_blocks_frame") {
            val gate = LocalFrameGate(model, true)
            check(gate.authorize(1, "synthetic-target", true, true))
            val frame = FrameIdentity(1, 1, 100, "synthetic-target")
            check(!gate.inspect(frame, DetectionProof(frame, model, FrameRisk.SAFE, 110, false), 120).allowed)
        }
        scenario("capture_resource_cleanup_before_reauthorization") {
            val capture = CaptureSession()
            val ticket = requireNotNull(capture.requestConsent())
            check(capture.resolveConsent(ticket, true) && capture.claim(ticket) && capture.started(ticket))
            capture.stop(CaptureStop.PRIVACY_BLOCKED)
            check(capture.requestConsent() == null)
            capture.released(ticket, 0)
            check(capture.requestConsent() != null)
        }
        scenario("capture_cleanup_failure_remains_fail_closed") {
            val capture = CaptureSession()
            val ticket = requireNotNull(capture.requestConsent())
            check(capture.resolveConsent(ticket, true) && capture.claim(ticket))
            capture.stop(CaptureStop.PRIVACY_BLOCKED)
            capture.released(ticket, 1)
            check(capture.requestConsent() == null)
        }
        scenario("late_capture_frame_is_closed_not_reused") {
            val capture = CaptureSession()
            val ticket = requireNotNull(capture.requestConsent())
            check(capture.resolveConsent(ticket, true) && capture.claim(ticket) && capture.started(ticket))
            capture.stop(CaptureStop.PRIVACY_BLOCKED)
            var closed = false
            check(!capture.releaseFrame(ticket) { closed = true })
            check(closed && capture.snapshot().lateFrames == 1L)
        }
        cases.addAll(AndroidScreenPolicyChecks.run())
        scenario("optional_cloud_consent_is_separate_and_not_restored") {
            val sessions = PetSessions()
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true, true))
            check(sessions.resolveConsent(ticket, true) && sessions.captureStarted(ticket))
            check(sessions.snapshot().cloudAnalysisConsent)
            check(sessions.beginTeaching("调整字体", true) && sessions.snapshot().teaching == PetTeachingPhase.ACTIVE)
            sessions.privacyPause("unknown")
            check(!sessions.snapshot().cloudAnalysisConsent && !PetSessions().snapshot().cloudAnalysisConsent)
        }
        scenario("local_consent_does_not_imply_cloud_consent") {
            val sessions = PetSessions()
            val ticket = requireNotNull(sessions.requestObservation(true, true, true, true))
            check(sessions.resolveConsent(ticket, true) && sessions.captureStarted(ticket))
            check(sessions.beginTeaching("调整字体", true) && sessions.snapshot().teaching == PetTeachingPhase.UNAVAILABLE)
            check(!sessions.snapshot().cloudAnalysisConsent)
        }
        cases.addAll(AndroidTeachingStateChecks.run())
        cases.addAll(AndroidCaptureGeometryChecks.run())
        cases.addAll(StandaloneGuidanceProtocolChecks.run())
        cases.addAll(AndroidGuidanceAdapterChecks.run())
        val names = cases.joinToString(",") { "\"" + it + "\"" }
        println("{\"passed\":true,\"caseCount\":" + cases.size + ",\"cases\":[" + names + "],\"deviceVerified\":false,\"captureExecuted\":false,\"cloudExecuted\":false}")
    }
}
