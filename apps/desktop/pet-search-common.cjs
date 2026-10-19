const { isIP } = require('node:net');

const messages = Object.freeze({
  SEARCH_NOT_CONFIGURED: '智能模型尚未就绪，请检查本机已有模型配置后重新打开查询。',
  SEARCH_INVALID_QUERY: '请输入 1 至 500 字的问题。',
  SEARCH_PRIVATE_QUERY: '问题中可能含有个人号码或密钥，请移除隐私信息后再查询。',
  SEARCH_CONSENT_REQUIRED: '请本人确认将输入的问题发送给已配置的智能模型。',
  SEARCH_CANCELLED: '查询已停止。',
  SEARCH_TIMEOUT: '查询超时，请稍后手动重试。',
  SEARCH_AUTH_FAILED: '智能服务鉴权失败，请检查本机模型密钥或账号权限。',
  SEARCH_QUOTA: '智能服务额度不足或请求过于频繁，请稍后重试或检查额度。',
  SEARCH_FAILED: '智能查询暂不可用，请稍后手动重试。',
  SEARCH_INVALID_RESPONSE: '智能服务返回了无法使用的内容，未展示未确认的回答。',
});

class SearchError extends Error {
  constructor(code) {
    super(messages[code] ?? messages.SEARCH_FAILED);
    this.code = Object.hasOwn(messages, code) ? code : 'SEARCH_FAILED';
  }
}

function searchFailure(error) {
  const code = error instanceof SearchError ? error.code : 'SEARCH_FAILED';
  return { ok: false, code, message: messages[code] };
}

function validateSearchQuery(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500 || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u.test(value)) throw new SearchError('SEARCH_INVALID_QUERY');
  const query = value.trim().replace(/\s+/gu, ' ');
  if (/(?:^|\D)(?:1[3-9]\d{9}|\d{17}[\dXx]|\d{16,19})(?!\d)/u.test(query)
    || /(?:api[_ -]?key|access[_ -]?token|password|secret|密码|验证码)\s*[:：=]\s*\S{3,}/iu.test(query)
    || /\b(?:(?:sk-|Bearer\s+)[A-Za-z0-9_.-]{12,}|key_[A-Za-z0-9_-]{16,})/iu.test(query)) throw new SearchError('SEARCH_PRIVATE_QUERY');
  return query;
}

function publicResultUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\x00-\x20\x7F\\]/u.test(value)) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || isIP(hostname.replace(/^\[|\]$/g, '')) || !hostname.includes('.') || hostname.endsWith('.') || hostname.length > 253
    || /(?:^|\.)(?:localhost|local|internal|home|lan|onion|invalid|test|example)$/u.test(hostname)) return null;
  return url.href;
}

function resultText(value, limit) {
  return typeof value === 'string' ? value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u202A-\u202E\u2066-\u2069]/gu, '').trim().slice(0, limit) : '';
}

function projectResults(items) {
  if (!Array.isArray(items) || items.length > 100) throw new SearchError('SEARCH_INVALID_RESPONSE');
  const results = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new SearchError('SEARCH_INVALID_RESPONSE');
    const url = publicResultUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const source = new URL(url).hostname;
    results.push({ title: resultText(item.title, 200) || source, url, source,
      snippet: resultText(item.snippet, 1200) || resultText(item.content, 1200) });
    if (results.length === 10) break;
  }
  return results;
}

function projectModelAnswer(value) {
  if (!value || value.kind !== 'model-answer' || value.webSearch !== false || typeof value.answer !== 'string'
    || value.answer.length > 24000 || !Array.isArray(value.results) || value.results.length) throw new SearchError('SEARCH_INVALID_RESPONSE');
  const answer = resultText(value.answer, 24000);
  if (!answer) throw new SearchError('SEARCH_INVALID_RESPONSE');
  return { kind: 'model-answer', webSearch: false, answer, results: [] };
}

module.exports = { SearchError, searchFailure, validateSearchQuery, publicResultUrl, projectResults, projectModelAnswer };
