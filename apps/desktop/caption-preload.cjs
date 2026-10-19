const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nuanbanCaption', Object.freeze({
  onState(listener) {
    if (typeof listener !== 'function') throw new TypeError('字幕监听器无效');
    const handler = (_event, state) => listener({ visible: state?.visible === true, text: typeof state?.text === 'string' ? state.text.slice(0, 600) : '' });
    ipcRenderer.on('nuanban:caption:state', handler);
    return () => ipcRenderer.removeListener('nuanban:caption:state', handler);
  },
}));
