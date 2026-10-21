package org.nuanban.assistant.nativehost

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.net.URI

class GuidanceConnection(val baseUrl: String, val accessToken: String)

object AndroidGuidanceConnection {
    private const val ACCOUNT = "standalone-device"
    private const val SLOT = "guidance-connection"
    fun validEndpoint(value: String): Boolean = try {
        val uri = URI(value)
        value.length <= 2048 && uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null && (uri.port == -1 || uri.port in 1..65535)
    } catch (_: Exception) { false }
    fun validToken(value: String): Boolean = value.length in 16..4096 && value.none { it <= ' ' || it >= '\u007f' }
    fun read(context: Context): GuidanceConnection? {
        val encoded = try { AndroidSecretStore.create(context).read(ACCOUNT, SLOT) } catch (_: Exception) { null } ?: return null
        return try {
            val data = JSONObject(String(encoded, Charsets.UTF_8))
            val baseUrl = data.getString("baseUrl")
            val token = data.getString("accessToken")
            if (validEndpoint(baseUrl) && validToken(token)) GuidanceConnection(baseUrl, token) else null
        } catch (_: Exception) { null } finally { encoded.fill(0) }
    }
    fun save(context: Context, baseUrl: String, token: String, confirmed: Boolean) {
        require(confirmed && validEndpoint(baseUrl) && validToken(token))
        val encoded = JSONObject().put("baseUrl", baseUrl).put("accessToken", token).toString().toByteArray(Charsets.UTF_8)
        try { AndroidSecretStore.create(context).write(ACCOUNT, SLOT, encoded) } finally { encoded.fill(0) }
    }
    fun clear(context: Context) { AndroidSecretStore.create(context).remove(ACCOUNT, SLOT) }
}

class GuidanceConnectionActivity : Activity() {
    override fun onResume() { super.onResume(); PetRuntime.controlVisible(this, true); AndroidGuidanceRuntime.pauseForControls() }
    override fun onPause() { PetRuntime.controlVisible(this, false); super.onPause() }
    override fun onDestroy() { PetRuntime.controlVisible(this, false); super.onDestroy() }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        if (Build.VERSION.SDK_INT >= 31) window.setHideOverlayWindows(true)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 24, 28, 24) }
        root.addView(TextView(this).apply { text = "微光指引教学服务连接\n请填写微光指引 HTTPS 服务地址及有效设备会话，不是模型供应商密钥。保存不会开启观察或云分析。更换连接会停止当前会话。"; textSize = 18f })
        val endpoint = EditText(this).apply { hint = "微光指引 HTTPS 服务地址"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI; isSaveEnabled = false; filters = arrayOf(android.text.InputFilter.LengthFilter(2048)) }
        val token = EditText(this).apply {
            hint = "微光指引设备会话凭证（不回显已保存值）"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            isSaveEnabled = false
            filters = arrayOf(android.text.InputFilter.LengthFilter(4096))
            if (Build.VERSION.SDK_INT >= 26) importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            imeOptions = android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
        }
        val confirmed = CheckBox(this).apply { text = "我是本人，确认连接此微光指引服务；屏幕和云分析仍需另行当次同意。"; isSaveEnabled = false; filterTouchesWhenObscured = true }
        val status = TextView(this).apply { text = if (AndroidGuidanceConnection.read(this@GuidanceConnectionActivity) == null) "尚未配置可用连接。" else "已加密保存连接；不显示凭证，不代表服务已验收。" }
        root.addView(endpoint); root.addView(token); root.addView(confirmed); root.addView(status)
        root.addView(Button(this).apply { text = "本人保存连接（不采集）"; filterTouchesWhenObscured = true; setOnClickListener {
            val ownerConfirmed = confirmed.isChecked
            confirmed.isChecked = false
            if (!ownerConfirmed || !AndroidGuidanceConnection.validEndpoint(endpoint.text.toString().trim()) || !AndroidGuidanceConnection.validToken(token.text.toString())) { status.text = "需要本人确认、有效 HTTPS 地址和设备会话；未保存。"; return@setOnClickListener }
            PetRuntime.stopWork(this@GuidanceConnectionActivity, "guidance_connection_changed")
            try { AndroidGuidanceConnection.save(this@GuidanceConnectionActivity, endpoint.text.toString().trim(), token.text.toString(), true); token.text.clear(); status.text = "连接已加密保存；观察与云分析保持关闭。" } catch (_: Exception) { token.text.clear(); status.text = "加密保存失败，未降级为明文。" }
        } })
        root.addView(Button(this).apply { text = "清除连接并停止"; filterTouchesWhenObscured = true; setOnClickListener {
            PetRuntime.stopWork(this@GuidanceConnectionActivity, "guidance_connection_cleared")
            try { AndroidGuidanceConnection.clear(this@GuidanceConnectionActivity); token.text.clear(); status.text = "连接已移除。" } catch (_: Exception) { status.text = "移除失败；教学出口已关闭。" }
        } })
        root.addView(Button(this).apply { text = "返回，不开启采集"; setOnClickListener { token.text.clear(); finish() } })
        setContentView(ScrollView(this).apply { addView(root) })
    }
}
