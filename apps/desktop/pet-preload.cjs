const { contextBridge, ipcRenderer } = require('electron');

function projectRecord(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result = {};
  for (const [field, kind] of Object.entries(fields)) {
    if (typeof value[field] === kind && (kind !== 'number' || Number.isFinite(value[field]))) result[field] = value[field];
  }
  return result;
}

function projectSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = projectRecord(value, { message: 'string' });
  const sections = {
    observation: { state: 'string', sourceName: 'string', reason: 'string', generation: 'number', captureActive: 'boolean' },
    task: { id: 'string', state: 'string', question: 'string', instruction: 'string', explanation: 'string', presentation: 'string', result: 'string' },
    analysis: { state: 'string', message: 'string' },
    captions: { enabled: 'boolean', text: 'string' },
    wake: { state: 'string', reason: 'string' },
  };
  for (const [name, fields] of Object.entries(sections)) {
    const section = projectRecord(value[name], fields);
    if (section) result[name] = section;
  }
  if (Array.isArray(value.messages)) {
    result.messages = value.messages.slice(-20).map(message => projectRecord(message, { id: 'string', role: 'string', text: 'string' })).filter(message => message && ['user', 'assistant', 'system'].includes(message.role) && typeof message.text === 'string');
  }
  return result;
}

function projectReply(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return typeof value === 'boolean' ? value : null;
  if (['observation', 'task', 'analysis', 'captions', 'wake'].some(section => Object.hasOwn(value, section))) return projectSnapshot(value);
  const result = projectRecord(value, { ok: 'boolean', accepted: 'boolean', success: 'boolean', status: 'string', message: 'string', reason: 'string', error: 'string' });
  if (Object.hasOwn(value, 'snapshot')) result.snapshot = projectSnapshot(value.snapshot);
  return result;
}

const commands = new Set(['observation.start', 'observation.stop', 'observation.resume', 'guidance.verify', 'guidance.finish', 'guidance.repeat', 'captions.toggle', 'wake.enable', 'wake.disable', 'panel.set-expanded']);

contextBridge.exposeInMainWorld('nuanbanPet', Object.freeze({
  snapshot: () => ipcRenderer.invoke('nuanban:pet:snapshot').then(projectSnapshot),
  onState: listener => {
    if (typeof listener !== 'function') throw new TypeError('状态监听器必须是函数');
    const handler = (_event, state) => listener(projectSnapshot(state));
    ipcRenderer.on('nuanban:pet:state', handler);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      ipcRenderer.removeListener('nuanban:pet:state', handler);
    };
  },
  command: payload => {
    if (!payload || !commands.has(payload.type)) throw new TypeError('不支持的桌宠指令');
    if (payload.type === 'panel.set-expanded' && typeof payload.expanded !== 'boolean') throw new TypeError('面板展开状态必须是布尔值');
    const command = payload.type === 'panel.set-expanded' ? { type: payload.type, expanded: payload.expanded } : { type: payload.type };
    return ipcRenderer.invoke('nuanban:pet:command', command).then(projectReply);
  },
  ask: text => {
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new TypeError('请输入 1 至 2000 字的问题');
    return ipcRenderer.invoke('nuanban:pet:ask', { text }).then(projectReply);
  },
  close: () => ipcRenderer.invoke('nuanban:pet:close'),
  openMain: (route = '/') => {
    if (typeof route !== 'string' || !/^\/(?!\/)[^?#\\\s]*$/.test(route)) throw new TypeError('请使用暖伴内部页面路径');
    return ipcRenderer.invoke('nuanban:pet:open-main', route);
  },
  showMenu: () => ipcRenderer.invoke('nuanban:pet:context-menu'),
}));
