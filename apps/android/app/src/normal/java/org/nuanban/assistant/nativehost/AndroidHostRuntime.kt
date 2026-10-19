package org.nuanban.assistant.nativehost

import android.app.Activity
import android.content.Context
import android.view.View

object AndroidHostRuntime {
    fun managementView(activity: Activity, content: View): View = content

    fun capabilities(context: Context): Map<String, Any?> = mapOf(
        "externalCapture" to false,
        "nativeOverlay" to false,
        "remoteMedia" to false,
        "captureActive" to false,
        "captureStatus" to "standalone_build_required",
        "deviceVerified" to false,
    )

    fun stopManagement(context: Context): Map<String, Any?> = mapOf("stopped" to true, "captureActive" to false)
}
