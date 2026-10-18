package org.nuanban.assistant.nativehost

data class Top20FlowSlot(val slot: Int, val key: String, val status: String, val blockingReason: String)

object Top20FlowRegistry {
    val slots: List<Top20FlowSlot> = (1..20).map { slot -> Top20FlowSlot(slot, "flow-slot-%02d".format(slot), "blocked", "c16_target_version_and_flow_review_required") }
    fun adapter(): FlowAdapter = FlowAdapter()
}
