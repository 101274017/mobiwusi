package org.nuanban.assistant.nativehost

data class InstalledTarget(val packageName: String, val versionName: String, val versionCode: Long, val signerSha256: String)
data class NativeFlowStep(val id: String, val risk: FrameRisk, val instruction: String, val target: NativeRect?)
data class NativeFlowPackage(val slot: Int, val version: String, val target: InstalledTarget, val reviewed: Boolean, val steps: List<NativeFlowStep>)
data class FlowReadiness(val slot: Int, val available: Boolean, val version: String?, val reason: String)

class FlowAdapter(packages: List<NativeFlowPackage> = emptyList()) {
    private val definitions = packages.toList()
    init { require(definitions.map { it.slot }.distinct().size == definitions.size && definitions.all { it.slot in 1..20 }) }

    fun readiness(slot: Int, installed: InstalledTarget?): FlowReadiness {
        val definition = definitions.firstOrNull { it.slot == slot } ?: return FlowReadiness(slot, false, null, "top20_unadapted")
        val valid = definition.version.matches(Regex("[0-9]+\\.[0-9]+\\.[0-9]+")) && definition.reviewed && definition.steps.isNotEmpty() && definition.steps.size <= 100 && definition.steps.map { it.id }.distinct().size == definition.steps.size && definition.steps.all { it.id.isNotBlank() && it.instruction.length in 1..500 }
        val reason = when {
            !valid -> "flow_review_required"
            installed == null -> "target_unavailable_or_not_visible"
            !installed.signerSha256.matches(Regex("[a-f0-9]{64}")) || installed != definition.target -> "target_version_or_signer_mismatch"
            else -> "ready_for_local_guidance"
        }
        return FlowReadiness(slot, reason == "ready_for_local_guidance", definition.version, reason)
    }

    fun step(slot: Int, index: Int, installed: InstalledTarget?, proof: GateDecision, geometry: NativeGeometry, childMode: Boolean): MappedTarget? {
        if (!readiness(slot, installed).available || !proof.allowed) return null
        val step = definitions.first { it.slot == slot }.steps.getOrNull(index) ?: return null
        if (step.risk != FrameRisk.SAFE) return null
        return CoordinateMapper.map(step.target ?: return null, geometry, geometry.generation, geometry.revision, childMode)
    }

    fun top20() = (1..20).map { readiness(it, null) }
}
