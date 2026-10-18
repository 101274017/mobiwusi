const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nuanbanC02', Object.freeze({
  read: () => ipcRenderer.invoke('c02:read'),
  begin: options => ipcRenderer.invoke('c02:begin', options),
  started: payload => ipcRenderer.invoke('c02:started', payload),
  frame: payload => ipcRenderer.invoke('c02:frame', payload),
  stopped: payload => ipcRenderer.invoke('c02:stopped', payload),
  failed: ticket => ipcRenderer.invoke('c02:failed', ticket),
  ended: ticket => ipcRenderer.invoke('c02:ended', ticket),
  stop: () => ipcRenderer.invoke('c02:stop'),
  showCanary: () => ipcRenderer.invoke('c02:show-canary'),
  moveCanary: displayId => ipcRenderer.invoke('c02:move-canary', displayId),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('c02:state', listener);
    return () => ipcRenderer.removeListener('c02:state', listener);
  },
}));
