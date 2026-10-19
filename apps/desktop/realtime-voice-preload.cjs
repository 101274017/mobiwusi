const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nuanbanVoiceChat', Object.freeze({
  mode: () => ipcRenderer.invoke('nuanban:voice-chat:mode'),
  transcript: value => {
    if (!value || !['user', 'assistant'].includes(value.role) || typeof value.id !== 'string' || value.id.length > 220
      || typeof value.text !== 'string' || value.text.length > 6000) throw new TypeError('语音字幕无效');
    return ipcRenderer.invoke('nuanban:voice-chat:transcript', { id: value.id, role: value.role, text: value.text });
  },
  onControl: listener => {
    if (typeof listener !== 'function') throw new TypeError('语音控制监听器必须是函数');
    const handler = (_event, action) => { if (['mute', 'unmute', 'interrupt'].includes(action)) listener(action); };
    ipcRenderer.on('nuanban:voice-chat:control', handler);
    return () => ipcRenderer.removeListener('nuanban:voice-chat:control', handler);
  },
  localControl: action => {
    if (!['start', 'mute', 'unmute', 'interrupt'].includes(action)) throw new TypeError('本地语音操作无效');
    return ipcRenderer.invoke('nuanban:voice-chat:local-control', action);
  },
  onEvent: listener => {
    if (typeof listener !== 'function') throw new TypeError('语音监听器必须是函数');
    const handler = (_event, value) => {
      if (value?.type === 'state' && ['connecting', 'listening', 'thinking', 'speaking', 'muted'].includes(value.state)) listener({ type: 'state', state: value.state });
      else if (value?.type === 'transcript' && typeof value.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/u.test(value.id)
        && ['user', 'assistant'].includes(value.role) && typeof value.text === 'string' && value.text.length <= 6000) {
        listener({ type: 'transcript', id: value.id, role: value.role, text: value.text });
      }
    };
    ipcRenderer.on('nuanban:voice-chat:event', handler);
    return () => ipcRenderer.removeListener('nuanban:voice-chat:event', handler);
  },
  connect: offer => {
    if (typeof offer !== 'string' || offer.length > 65_536 || !/^v=0\r?\n/u.test(offer)) throw new TypeError('语音会话无效');
    return ipcRenderer.invoke('nuanban:voice-chat:connect', offer);
  },
  state: value => {
    if (!['listening', 'thinking', 'speaking', 'muted'].includes(value)) throw new TypeError('语音状态无效');
    return ipcRenderer.invoke('nuanban:voice-chat:state', value);
  },
  stop: () => ipcRenderer.invoke('nuanban:voice-chat:stop'),
  failed: () => ipcRenderer.invoke('nuanban:voice-chat:failed'),
}));
