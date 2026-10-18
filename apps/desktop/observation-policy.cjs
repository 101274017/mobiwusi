const { createHash } = require('node:crypto');

const policyVersion = 'windows-local-ocr-v1';
const admittedFrames = new WeakSet();
const privatePattern = /密码|口令|验证码|动态码|私聊|聊天记录|私人聊天|发送给|身份证|银行卡|支付|付款|收款|转账|交易确认|安全密钥|访问令牌|password|passcode|one[ -]?time|verification code|private (?:chat|message)|credit card|bank account|payment|transfer money|bearer\s|api[ _-]?key|secret key/i;
const personalPattern = /(?:\b1[3-9]\d{9}\b)|(?:\b\d{17}[\dXx]\b)|(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})|(?:\b(?:sk|pk)[-_][A-Za-z0-9]{16,})/;
const genericLabels = new Set([
  '设置', '系统', '显示', '屏幕', '字体', '字体大小', '文本大小', '大小', '缩放', '辅助功能', '无障碍', '个性化', '主题', '颜色', '语言', '时间和语言', '网络和internet', '网络', 'wifi', '蓝牙', '音量', '声音', '音频', '通知', '开始', '所有应用', '应用', '搜索', '搜索应用', '桌面', '文件', '编辑', '查看', '视图', '帮助', '格式', '工具', '选项', '菜单', '更多', '返回', '下一步', '上一步', '确定', '取消', '保存', '应用更改', '关闭', '打开', '展开', '收起', '大', '中', '小', '默认', '推荐', '开启', '关闭状态', '开', '关', '滑块', '放大', '缩小',
  'settings', 'system', 'display', 'screen', 'font', 'fonts', 'font size', 'text size', 'size', 'scale', 'accessibility', 'personalization', 'theme', 'colors', 'language', 'network', 'wi-fi', 'wifi', 'bluetooth', 'volume', 'sound', 'audio', 'notifications', 'start', 'all apps', 'apps', 'search', 'desktop', 'file', 'edit', 'view', 'help', 'format', 'tools', 'options', 'menu', 'more', 'back', 'next', 'previous', 'ok', 'cancel', 'save', 'apply', 'close', 'open', 'expand', 'collapse', 'large', 'medium', 'small', 'default', 'recommended', 'on', 'off', 'slider', 'zoom in', 'zoom out',
]);
const sceneLabels = new Set(['设置', '系统', '显示', '字体', '字体大小', '文本大小', '缩放', '辅助功能', '无障碍', '个性化', '主题', '语言', '网络', '蓝牙', '音量', '声音', 'settings', 'system', 'display', 'font', 'fonts', 'font size', 'text size', 'scale', 'accessibility', 'personalization', 'theme', 'language', 'network', 'bluetooth', 'volume', 'sound']);

function normalizeLabel(value) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '').trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function isRestrictedText(value) {
  const normalized = normalizeLabel(value);
  return privatePattern.test(normalized) || personalPattern.test(normalized);
}

function safeSummary(value, maximum = 500) {
  if (typeof value !== 'string' || isRestrictedText(value)) return '本次内容涉及隐私或风险，仅保留教学状态。';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maximum);
}

function validRect(rect, width, height) {
  return Boolean(rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
    && rect.x + rect.width <= width && rect.y + rect.height <= height);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validPng(image, width, height) {
  return Buffer.isBuffer(image) && image.length >= 33 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && image.toString('ascii', 12, 16) === 'IHDR' && image.readUInt32BE(16) === width && image.readUInt32BE(20) === height;
}

function deny(reason, risk = 'unknown') {
  return { decision: 'pause', risk, reason, policyVersion };
}

function evaluateLocalFrame(frame, detection, options = {}) {
  const now = options.now ?? Date.now();
  if (!frame || !Buffer.isBuffer(frame.png) || !Number.isInteger(frame.width) || !Number.isInteger(frame.height)
    || frame.width < 1 || frame.height < 1 || frame.width > 16384 || frame.height > 16384
    || !Number.isFinite(frame.capturedAt) || frame.capturedAt > now || now - frame.capturedAt > (options.maxAgeMs ?? 5000)
    || typeof frame.sourceId !== 'string' || !frame.sourceId || !validPng(frame.png, frame.width, frame.height)
    || digest(frame.png) !== frame.frameHash) return deny('invalid_or_stale_frame');
  if (!detection || detection.status !== 'complete') return deny(detection?.reason ?? 'local_detector_unavailable');
  if (detection.frameHash !== frame.frameHash || detection.width !== frame.width || detection.height !== frame.height) return deny('detector_frame_mismatch');
  if (!Array.isArray(detection.words) || detection.words.length === 0 || detection.words.length > 1024
    || !Array.isArray(detection.faces) || detection.faces.length > 128
    || detection.redaction?.text !== true || detection.redaction?.faces !== true
    || !validPng(detection.sanitizedPng, frame.width, frame.height) || detection.sanitizedPng.length > 2_000_000) return deny('incomplete_local_detection');
  if (detection.words.some(word => typeof word?.text !== 'string' || word.text.length > 200 || !validRect(word.rect, frame.width, frame.height))
    || detection.faces.some(face => !validRect(face?.rect, frame.width, frame.height))) return deny('invalid_local_regions');
  const text = detection.words.map(word => word.text).join(' ');
  if (text.length > 20000) return deny('local_text_limit');
  if (isRestrictedText(text) || isRestrictedText(detection.words.map(word => word.text).join(''))) return deny('sensitive_screen', 'private');
  const allowedWords = detection.words.filter(word => genericLabels.has(normalizeLabel(word.text)));
  const labels = new Set(allowedWords.map(word => normalizeLabel(word.text)));
  const positiveMarkers = [...labels].filter(label => sceneLabels.has(label));
  if (positiveMarkers.length < 2 || allowedWords.length < 3 || detection.words.length - allowedWords.length > allowedWords.length * 2) return deny('unclassified_screen');
  const sanitizedHash = digest(detection.sanitizedPng);
  if (sanitizedHash === frame.frameHash) return deny('unredacted_frame');
  const elements = allowedWords.map((word, index) => ({ id: `element_${frame.frameHash.slice(0, 12)}_${index}`, label: word.text.trim(), rect: { ...word.rect } }));
  const signature = digest(JSON.stringify(detection.words.map(word => [normalizeLabel(word.text), Math.round(word.rect.x / 4), Math.round(word.rect.y / 4), Math.round(word.rect.width / 4), Math.round(word.rect.height / 4)])));
  const admitted = {
    decision: 'allow', risk: 'safe', reason: 'locally_checked', policyVersion, frameId: frame.frameId ?? frame.frameHash,
    frameHash: frame.frameHash, sanitizedHash, capturedAt: frame.capturedAt, sourceId: frame.sourceId,
    sourceName: frame.sourceName ?? '', displayId: frame.displayId, width: frame.width, height: frame.height,
    geometry: frame.geometry ? { ...frame.geometry } : null, signature, elements, sanitizedPng: Buffer.from(detection.sanitizedPng),
    redactionProfile: 'all_text_and_faces_v1', scene: 'settings',
  };
  admittedFrames.add(admitted);
  return admitted;
}

function isAdmittedFrame(frame, now = Date.now(), maxAgeMs = 5000) {
  return Boolean(frame && admittedFrames.has(frame) && frame.decision === 'allow'
    && Number.isFinite(frame.capturedAt) && frame.capturedAt <= now && now - frame.capturedAt <= maxAgeMs
    && Buffer.isBuffer(frame.sanitizedPng) && digest(frame.sanitizedPng) === frame.sanitizedHash);
}

module.exports = { evaluateLocalFrame, isAdmittedFrame, isRestrictedText, normalizeLabel, safeSummary, validRect, policyVersion };
