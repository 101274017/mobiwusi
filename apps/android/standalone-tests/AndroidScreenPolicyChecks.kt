package org.nuanban.assistant.nativehost

object AndroidScreenPolicyChecks {
    fun run(): List<String> {
        val cases = mutableListOf<String>()
        fun scenario(name: String, action: () -> Unit) { action(); cases.add(name) }
        val frameHash = "a".repeat(64)
        fun word(text: String, index: Int = 0) = LocalScreenWord(text, LocalScreenRect(10, 10 + index * 30, 90, 20))
        val settings = listOf(word("设置"), word("显示", 1), word("字体大小", 2))
        scenario("android_settings_safe_labels_admitted") { check(AndroidScreenPolicy.inspect(settings, emptyList(), 300, 300, frameHash, "设置 显示 字体大小").risk == FrameRisk.SAFE) }
        scenario("android_browser_not_bound_to_application_name") {
            val words = listOf(word("书签"), word("新建标签页", 1), word("返回", 2))
            check(AndroidScreenPolicy.inspect(words, emptyList(), 300, 300, frameHash, "书签 新建标签页 返回").risk == FrameRisk.SAFE)
        }
        scenario("android_editor_controls_admitted") {
            val words = listOf(word("文件"), word("编辑", 1), word("查看", 2), word("保存", 3))
            check(AndroidScreenPolicy.inspect(words, emptyList(), 300, 300, frameHash, "文件 编辑 查看 保存").risk == FrameRisk.SAFE)
        }
        scenario("android_unknown_screen_rejected") { check(AndroidScreenPolicy.inspect(listOf(word("非预置页面")), emptyList(), 300, 300, frameHash, "非预置页面").risk == FrameRisk.UNKNOWN) }
        scenario("android_empty_ocr_rejected") { check(AndroidScreenPolicy.inspect(emptyList(), emptyList(), 300, 300, frameHash, "").risk == FrameRisk.UNKNOWN) }
        scenario("android_sensitive_full_text_rejected") { check(AndroidScreenPolicy.inspect(settings, emptyList(), 300, 300, frameHash, "设置 显示 验证码").risk == FrameRisk.SENSITIVE) }
        scenario("android_sensitive_split_words_rejected") { check(AndroidScreenPolicy.inspect(settings + listOf(word("验", 3), word("证码", 4)), emptyList(), 300, 300, frameHash, "验 证码").risk == FrameRisk.SENSITIVE) }
        scenario("android_personal_email_rejected") { check(AndroidScreenPolicy.inspect(settings, emptyList(), 300, 300, frameHash, "本人 user@example.com").risk == FrameRisk.SENSITIVE) }
        scenario("android_bearer_secret_rejected") { check(AndroidScreenPolicy.restrictedText("Authorization: Bearer token")) }
        scenario("android_ocr_rect_out_of_bounds_rejected") { check(AndroidScreenPolicy.inspect(settings + LocalScreenWord("设置", LocalScreenRect(299, 0, 2, 2)), emptyList(), 300, 300, frameHash, "设置").risk == FrameRisk.UNKNOWN) }
        scenario("android_face_rect_out_of_bounds_rejected") { check(AndroidScreenPolicy.inspect(settings, listOf(LocalScreenRect(-1, 0, 2, 2)), 300, 300, frameHash, "设置").risk == FrameRisk.UNKNOWN) }
        scenario("android_invalid_frame_hash_rejected") { check(AndroidScreenPolicy.inspect(settings, emptyList(), 300, 300, "invalid", "设置").risk == FrameRisk.UNKNOWN) }
        scenario("android_control_ids_bound_to_frame_hash") {
            val first = AndroidScreenPolicy.inspect(settings, emptyList(), 300, 300, frameHash, "设置 显示 字体大小")
            val second = AndroidScreenPolicy.inspect(settings, emptyList(), 300, 300, "b".repeat(64), "设置 显示 字体大小")
            check(first.elements.map { it.id }.toSet().intersect(second.elements.map { it.id }.toSet()).isEmpty())
            check(first.elements.all { !AndroidScreenPolicy.restrictedText(it.label) })
        }
        scenario("android_hash_known_vector") { check(AndroidScreenPolicy.sha256("abc".toByteArray()) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") }
        scenario("android_unverified_dynamic_detector_stays_closed") {
            var verified = false
            val gate = LocalFrameGate(AndroidScreenPolicy.MODEL_FINGERPRINT, detectorVerifier = { verified })
            check(!gate.detectorReady() && !gate.authorize(1, "display:1", true, true))
            verified = true
            check(gate.detectorReady() && gate.authorize(1, "display:1", true, true))
            gate.stop()
            check(!gate.inspect(FrameIdentity(1, 1, 100, "display:1"), null, 110).allowed)
        }
        return cases
    }
}
