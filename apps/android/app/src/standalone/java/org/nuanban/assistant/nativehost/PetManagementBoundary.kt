package org.nuanban.assistant.nativehost

object PetManagementBoundary {
    fun protectsPetSession(pet: PetSnapshot, petOwnedCapture: Boolean): Boolean {
        val observationActive = pet.observation in setOf(PetObservationPhase.AWAITING_SYSTEM, PetObservationPhase.STARTING, PetObservationPhase.OBSERVING)
        val teachingActive = pet.teaching in setOf(PetTeachingPhase.WAITING_FOR_OBSERVATION, PetTeachingPhase.UNAVAILABLE)
        return petOwnedCapture || observationActive || teachingActive
    }

    fun stopReply(pet: PetSnapshot, capture: CaptureSnapshot): Map<String, Any?> {
        val observationInactive = pet.observation in setOf(PetObservationPhase.IDLE, PetObservationPhase.STOPPED, PetObservationPhase.PRIVACY_PAUSED)
        val teachingInactive = pet.teaching in setOf(PetTeachingPhase.IDLE, PetTeachingPhase.STOPPED)
        if (!observationInactive || !teachingInactive || pet.cloudChannelOpen || pet.familyChannelOpen || !capture.stopped) {
            return mapOf("error_code" to "bridge_error", "message" to "管理页无权停止独立桌宠会话，未确认全局停止。请使用原生桌宠面板或常驻通知的停止入口。")
        }
        return mapOf("stopped" to true, "captureActive" to false)
    }
}
