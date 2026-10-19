const { validApiKey } = require('./anysearch-settings.cjs');
const { SearchError, searchFailure, validateSearchQuery, publicResultUrl, projectResults } = require('./pet-search-common.cjs');

const endpoint = 'https://api.anysearch.com/v1/search';

async function readResponse(response, maxBytes, signal) {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json') || !response.body) {
    void response.body?.cancel().catch(() => {});
    throw new SearchError('SEARCH_INVALID_RESPONSE');
  }
  const declaredLength = response.headers.get('content-length');
  if (declaredLength && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    await response.body.cancel().catch(() => {});
    throw new SearchError('SEARCH_INVALID_RESPONSE');
  }
  const reader = response.body.getReader();
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  let total = 0;
  const chunks = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) throw new SearchError('SEARCH_INVALID_RESPONSE');
      chunks.push(Buffer.from(chunk.value));
    }
    let payload;
    try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new SearchError('SEARCH_INVALID_RESPONSE'); }
    if (!payload || payload.code !== 0 || !payload.data || typeof payload.data !== 'object') throw new SearchError('SEARCH_INVALID_RESPONSE');
    return projectResults(payload.data.results);
  } finally {
    signal.removeEventListener('abort', onAbort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function createAnySearchClient({ env = process.env, getApiKey, fetch: fetchSearch = globalThis.fetch, timeoutMs = 15_000, maxResponseBytes = 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000
    || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 256 || maxResponseBytes > 2 * 1024 * 1024) throw new TypeError('搜索请求限制无效');
  function apiKey() {
    const supplied = env.NUANBAN_ANYSEARCH_API_KEY ?? env.ANYSEARCH_API_KEY;
    if (supplied !== undefined) return validApiKey(supplied) ? supplied : undefined;
    try {
      const stored = typeof getApiKey === 'function' ? getApiKey() : undefined;
      return validApiKey(stored) ? stored : undefined;
    } catch { return undefined; }
  }

  async function search(value, { signal } = {}) {
    const query = validateSearchQuery(value);
    const key = apiKey();
    if (!key || typeof fetchSearch !== 'function') throw new SearchError('SEARCH_NOT_CONFIGURED');
    if (signal?.aborted) throw new SearchError('SEARCH_CANCELLED');
    const controller = new AbortController();
    let rejectCancellation;
    const cancellation = new Promise((resolve, reject) => { rejectCancellation = reject; });
    const cancel = code => {
      if (controller.signal.aborted) return;
      rejectCancellation(new SearchError(code));
      controller.abort();
    };
    const onAbort = () => cancel('SEARCH_CANCELLED');
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    const timer = setTimeout(() => cancel('SEARCH_TIMEOUT'), timeoutMs);
    const request = async () => {
      if (controller.signal.aborted) throw new SearchError('SEARCH_CANCELLED');
      const response = await fetchSearch(endpoint, { method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ query, max_results: 10, language: 'zh-CN' }),
        signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new SearchError([401, 403].includes(response.status) ? 'SEARCH_AUTH_FAILED' : [402, 429].includes(response.status) ? 'SEARCH_QUOTA' : 'SEARCH_FAILED');
      }
      return readResponse(response, maxResponseBytes, controller.signal);
    };
    try { return await Promise.race([request(), cancellation]); }
    catch (error) { throw error instanceof SearchError ? error : new SearchError('SEARCH_FAILED'); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); controller.abort(); }
  }

  return Object.freeze({ status: () => ({ provider: 'AnySearch', configured: typeof fetchSearch === 'function' && Boolean(apiKey()) }), search });
}

module.exports = { createAnySearchClient, SearchError, searchFailure, validateSearchQuery, publicResultUrl, projectResults };
