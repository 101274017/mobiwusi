function createLiliAdapter({ play, setExpression, showBubble }) {
  let previous = {};
  let lastMessage = '';

  function semantic(event, text) {
    if (text !== undefined && (typeof text !== 'string' || text.length > 500)) return { ok: false, code: 'invalid_text' };
    let result;
    switch (event) {
      case 'listening': result = setExpression('listening'); break;
      case 'success': setExpression(null); result = play('success'); break;
      case 'reminder': setExpression('concern'); result = play('guide'); break;
      case 'greeting': setExpression(null); result = play('wave'); break;
      case 'rest': setExpression(null); result = play('rest'); break;
      case 'clear': setExpression(null); result = play('idle'); break;
      default: return { ok: false, code: 'unsupported_semantic_event' };
    }
    if (text !== undefined) showBubble(text);
    return result;
  }

  function observe(state) {
    const next = { task: state.task?.state, voice: state.voice?.state, wake: state.wake?.phase, observation: state.observation?.state };
    if (next.observation === 'privacy_paused') {
      if (previous.observation !== 'privacy_paused') { semantic('clear'); showBubble('共享已暂停，我在这里陪你。'); }
    } else {
      if (next.task !== previous.task) {
        if (next.task === 'completed') semantic('success');
        else if (next.task === 'awaiting_action') { setExpression(null); play('guide'); }
        else if (['analyzing', 'verifying'].includes(next.task)) semantic('listening');
        else if (next.task === 'needs_help') semantic('reminder');
        else if (['idle', 'ended'].includes(next.task) && previous.task) semantic('clear');
      }
      if (next.voice !== previous.voice || next.wake !== previous.wake) {
        const listening = ['listening', 'thinking'].includes(next.voice) || next.wake === 'question';
        const wasListening = ['listening', 'thinking'].includes(previous.voice) || previous.wake === 'question';
        if (listening) semantic('listening');
        else if (wasListening && !['analyzing', 'verifying'].includes(next.task)) setExpression(next.task === 'needs_help' ? 'concern' : null);
      }
      const messages = Array.isArray(state.messages) ? state.messages : [];
      const message = [...messages].reverse().find(item => item?.role === 'assistant' && typeof item.text === 'string');
      if (message?.text && message.text !== lastMessage) { lastMessage = message.text; showBubble(message.text.slice(0, 500)); }
    }
    previous = next;
  }

  return { semantic, observe };
}

module.exports = { createLiliAdapter };
