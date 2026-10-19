package org.nuanban.assistant.nativehost

enum class FrameRisk { SAFE, SENSITIVE, UNKNOWN }
data class GateDecision(val allowed: Boolean, val reason: String)
