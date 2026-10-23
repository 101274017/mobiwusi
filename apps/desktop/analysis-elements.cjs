const { normalizeLabel } = require('./observation-policy.cjs');

function selectAnalysisElements(input, limit = 64) {
  const question = normalizeLabel([input.question, ...(input.clarificationReplies ?? []).map(reply => reply.answer)].join(' '));
  const relevantLabels = new Set((input.previousStep?.expectedLabels ?? []).map(normalizeLabel));
  for (const aliases of [['微信', 'wechat', 'weixin'], ['朋友圈', 'moments'], ['发现', 'discover']]) {
    if (aliases.some(label => question.includes(label) || relevantLabels.has(label))) {
      for (const label of aliases) relevantLabels.add(label);
    }
  }
  const visual = input.frame.elements.filter(element => element.surface === 'visual').slice(0, 48);
  const preferred = input.frame.elements.filter(element => {
    const label = normalizeLabel(element.label);
    return element.surface !== 'visual' && label.length > 1 && (question.includes(label) || relevantLabels.has(label));
  }).slice(0, Math.max(0, limit - visual.length));
  const selected = new Set([...preferred, ...visual]);
  return [...preferred, ...visual, ...input.frame.elements.filter(element => !selected.has(element))].slice(0, limit);
}

module.exports = { selectAnalysisElements };
