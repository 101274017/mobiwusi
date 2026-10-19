const { ProviderFailure } = require('./ai-provider.cjs');
const { SearchError, validateSearchQuery, projectModelAnswer } = require('./pet-search-common.cjs');

function createModelSearchClient({ provider } = {}) {
  function configured() {
    try { return typeof provider?.answer === 'function' && typeof provider.status === 'function' && provider.status()?.available === true; }
    catch { return false; }
  }

  async function search(value, { signal } = {}) {
    const query = validateSearchQuery(value);
    if (signal?.aborted) throw new SearchError('SEARCH_CANCELLED');
    if (!configured()) throw new SearchError('SEARCH_NOT_CONFIGURED');
    try {
      const reply = await provider.answer({ question: query, signal,
        instructions: '\n当前是桌宠智能查询，只使用模型知识回答，未接入网页检索工具或已核验的网页来源。'
          + '不得声称已联网搜索、已打开网页或已核实最新信息，不得编造来源链接或检索结果。'
          + '涉及当前、最新、价格、天气或其他实时问题时，明确说明无法实时核实，提醒本人查看可靠原始来源。'
          + '给出简洁、易懂的纯文本回答；不输出HTML、脚本、工具调用或系统命令。' });
      if (signal?.aborted) throw new SearchError('SEARCH_CANCELLED');
      return projectModelAnswer({ kind: 'model-answer', webSearch: false, answer: reply?.text, results: [] });
    } catch (error) {
      if (signal?.aborted) throw new SearchError('SEARCH_CANCELLED');
      if (error instanceof SearchError) throw error;
      const codes = { AUTH_FAILED: 'SEARCH_AUTH_FAILED', RATE_LIMITED: 'SEARCH_QUOTA', TIMEOUT: 'SEARCH_TIMEOUT', CANCELLED: 'SEARCH_CANCELLED', STREAM_INTERRUPTED: 'SEARCH_INVALID_RESPONSE' };
      throw new SearchError(error instanceof ProviderFailure ? codes[error.code] ?? 'SEARCH_FAILED' : 'SEARCH_FAILED');
    }
  }

  return Object.freeze({ status: () => ({ provider: 'ConfiguredModel', configured: configured() }), search });
}

module.exports = { createModelSearchClient };
