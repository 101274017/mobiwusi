const { contextBridge, ipcRenderer } = require('electron');
const lifecycleEvents = new Set(['nuanban:host-before-quit','nuanban:host-renderer-gone','nuanban:host-window-moved','nuanban:host-recursive-capture']);
ipcRenderer.on('nuanban:lifecycle', (_event, name) => {
  if (lifecycleEvents.has(name)) window.dispatchEvent(new Event(name));
});
ipcRenderer.on('nuanban:reminder-open', (_event, detail) => {
  if (detail && typeof detail.deepLink === 'string') window.dispatchEvent(new CustomEvent('nuanban:reminder-open', { detail: { deepLink: detail.deepLink } }));
});
const reminderStore = Object.freeze({
  schedule: input => ipcRenderer.invoke('nuanban:reminders:schedule', input),
  read: (accountId, reminderId) => ipcRenderer.invoke('nuanban:reminders:read', accountId, reminderId),
  list: accountId => ipcRenderer.invoke('nuanban:reminders:list', accountId),
  cancel: input => ipcRenderer.invoke('nuanban:reminders:cancel', input),
  submitDue: input => ipcRenderer.invoke('nuanban:reminders:submit-due', input),
  recordReceipt: input => ipcRenderer.invoke('nuanban:reminders:receipt', input),
  complete: input => ipcRenderer.invoke('nuanban:reminders:complete', input),
  notifyDue: input => ipcRenderer.invoke('nuanban:reminders:notify-due', input),
});
contextBridge.exposeInMainWorld('nuanbanHost',Object.freeze({ platform:'windows', capabilities:()=>ipcRenderer.invoke('nuanban:capabilities'), stopAll:()=>ipcRenderer.invoke('nuanban:stop'), reminderStore }));
