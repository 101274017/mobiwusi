package org.nuanban.assistant.nativehost

import java.security.MessageDigest
import java.util.Locale

data class LocalScreenRect(val x: Int, val y: Int, val width: Int, val height: Int) {
    fun within(imageWidth: Int, imageHeight: Int): Boolean = x >= 0 && y >= 0 && width > 0 && height > 0 && x.toLong() + width <= imageWidth && y.toLong() + height <= imageHeight
}
data class LocalScreenWord(val text: String, val rect: LocalScreenRect)
data class LocalScreenElement(val id: String, val label: String, val rect: LocalScreenRect)
data class LocalScreenDecision(val risk: FrameRisk, val reason: String, val elements: List<LocalScreenElement> = emptyList())

object AndroidScreenPolicy {
    const val MODEL_FINGERPRINT = "4f5fa874d4808f27f9afca0ccb6a69debc0f8ab67d59ece2981704f4a54224a6"
    const val MODEL_ASSET_COUNT = 39
    const val MAX_FRAME_AGE_MS = 500L
    const val MAX_DETECTION_MS = 300L
    private val restricted = Regex("密码|口令|验证码|动态码|私聊|聊天记录|私人聊天|身份证|银行卡|支付|付款|收款|转账|交易确认|安全密钥|访问令牌|password|passcode|one[ -]?time|verification code|private (chat|message)|credit card|bank account|payment|transfer money|bearer\\s|api[ _-]?key|secret key", RegexOption.IGNORE_CASE)
    private val personal = Regex("1[3-9][0-9]{9}|[0-9]{17}[0-9Xx]|[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|(sk|pk)[-_][A-Za-z0-9]{16,}")
    private val settings = setOf("设置", "系统", "显示", "屏幕", "字体", "字体大小", "文本大小", "缩放", "辅助功能", "无障碍", "个性化", "主题", "颜色", "语言", "声音", "音量", "settings", "system", "display", "font", "font size", "text size", "accessibility", "theme", "colors", "sound")
    private val browser = setOf("书签", "收藏", "收藏夹", "添加书签", "添加到收藏夹", "书签管理器", "新建标签页", "标签页", "刷新", "主页", "全屏", "bookmarks", "bookmark", "favorites", "add bookmark", "new tab", "reload", "home")
    private val editor = setOf("文件", "编辑", "查看", "视图", "格式", "工具", "保存", "另存为", "新建", "撤销", "重做", "复制", "粘贴", "file", "edit", "view", "format", "tools", "save", "save as", "undo", "redo")
    private val common = setOf("开始", "应用", "搜索", "桌面", "帮助", "选项", "菜单", "更多", "返回", "下一步", "上一步", "确定", "取消", "关闭", "打开", "展开", "收起", "大", "中", "小", "默认", "推荐", "开启", "开", "关", "放大", "缩小", "start", "apps", "search", "desktop", "help", "options", "menu", "more", "back", "next", "previous", "ok", "cancel", "close", "open", "expand", "collapse", "large", "medium", "small", "default", "on", "off")
    private val safeLabels = settings + browser + editor + common

    fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
    fun normalize(text: String): String = text.trim().lowercase(Locale.ROOT).replace(Regex("\\s+"), " ")
    fun restrictedText(text: String): Boolean = restricted.containsMatchIn(text) || personal.containsMatchIn(text)

    fun inspect(words: List<LocalScreenWord>, faces: List<LocalScreenRect>, width: Int, height: Int, frameHash: String, fullText: String): LocalScreenDecision {
        if (width !in 1..4096 || height !in 1..4096 || width.toLong() * height > 4_194_304 || !frameHash.matches(Regex("[a-f0-9]{64}"))) return LocalScreenDecision(FrameRisk.UNKNOWN, "invalid_frame")
        if (words.isEmpty() || words.size > 400 || faces.size > 40 || fullText.length > 20_000) return LocalScreenDecision(FrameRisk.UNKNOWN, "incomplete_or_excessive_detection")
        if (words.any { it.text.isBlank() || it.text.length > 400 || !it.rect.within(width, height) } || faces.any { !it.within(width, height) }) return LocalScreenDecision(FrameRisk.UNKNOWN, "invalid_local_regions")
        if (restrictedText(fullText) || restrictedText(words.joinToString("") { it.text })) return LocalScreenDecision(FrameRisk.SENSITIVE, "sensitive_screen")
        val allowed = words.filter { normalize(it.text) in safeLabels }
        val labels = allowed.map { normalize(it.text) }.toSet()
        val unknown = words.size - allowed.size
        val scene = when {
            labels.count { it in settings } >= 2 && allowed.size >= 3 && unknown <= allowed.size * 2 -> true
            labels.count { it in browser } >= 2 && allowed.size >= 3 && unknown <= 1 -> true
            labels.count { it in editor } >= 3 && allowed.size >= 4 && unknown <= 1 -> true
            else -> false
        }
        if (!scene || allowed.size > 80) return LocalScreenDecision(FrameRisk.UNKNOWN, "unclassified_screen")
        return LocalScreenDecision(FrameRisk.SAFE, "locally_checked", allowed.mapIndexed { index, word -> LocalScreenElement("element_" + frameHash.take(12) + "_" + index, word.text.trim(), word.rect) })
    }
}
