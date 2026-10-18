const { app, BrowserWindow, ipcMain, safeStorage, session, Notification, screen, Menu } = require('electron');
const { createLifecycleController } = require('./lifecycle.cjs');
const { createDesktopReminderStore, createSafeStoragePayloadCodec } = require('./reminder-store.cjs');
const { createDesktopReminderNotificationBridge } = require('./reminder-notification-bridge.cjs');
const { createWindowsCapabilityPolicy } = require('./native-runtime.cjs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const indexPath = path.join(__dirname, 'ui', 'index.html');
const developmentIndex = path.join(__dirname, '..', 'web', 'dist', 'index.html');
const petPath = path.join(__dirname, 'pet.html');
const petRoutes = new Map([
  ['暖伴首页', '/'],
  ['和暖伴说说', '/chat/new'],
  ['学习笔记', '/notes'],
  ['待办与复习', '/todos'],
  ['我的小伙伴', '/pets'],
  ['画一画', '/pets/draw'],
  ['亲情陪伴', '/family'],
  ['手把手练习', '/overlay/guide'],
  ['大字字幕', '/overlay/captions'],
  ['设置与隐私', '/settings'],
]);
let mainWindow;
let petWindow;
let quitAfterLifecycle = false;
let reminderStore;
let reminderNotifications;
const lifecycle = createLifecycleController(async reason => ({ stopped:true, captureActive:false, mediaActive:false, reason }));
function notifyLifecycle(name) {
  if (!mainWindow?.webContents || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('nuanban:lifecycle', name);
}
function trusted(event) {
  const expected = pathToFileURL(fs.existsSync(indexPath) ? indexPath : developmentIndex).href;
  return event.sender === mainWindow?.webContents && event.senderFrame === mainWindow.webContents.mainFrame && event.senderFrame.url.split('#')[0] === expected;
}
function trustedPet(event) {
  const expected = pathToFileURL(petPath).href;
  return event.sender === petWindow?.webContents && event.senderFrame === petWindow.webContents.mainFrame && event.senderFrame.url.split('#')[0] === expected;
}
function showMainWindow(route = '/') {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  void mainWindow.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(route)};`, true).catch(() => undefined);
  mainWindow.focus();
  return true;
}
function createPetMenu() {
  const routeItems = [...petRoutes].map(([label, route]) => ({ label, click: () => { showMainWindow(route); } }));
  return Menu.buildFromTemplate([
    { label: '暖伴功能', enabled: false },
    { type: 'separator' },
    ...routeItems,
    { type: 'separator' },
    { label: '打开主客户端', click: () => { showMainWindow('/'); } },
    { label: '停止当前流程', click: () => { void lifecycle.requestStop('user').catch(() => undefined); } },
    { label: '关闭桌宠', click: () => { petWindow?.close(); } },
  ]);
}
function registerBridge() {
  const requireTrusted = event => { if (!trusted(event)) throw new Error('不可信桥接来源'); };
  const requireTrustedPet = event => { if (!trustedPet(event)) throw new Error('不可信桌宠来源'); };
  ipcMain.handle('nuanban:capabilities', event => {
    requireTrusted(event);
     return { ...createWindowsCapabilityPolicy({ safeStorage, Notification }), externalCapture:false, encryptedReminderPayload:Boolean(reminderStore?.encryptedReminderPayload), persistentReminderStore:Boolean(reminderStore) };
  });
  ipcMain.handle('nuanban:stop', event => {
    requireTrusted(event);
    return lifecycle.requestStop('user');
  });
  ipcMain.handle('nuanban:reminders:schedule', (event, input) => { requireTrusted(event); if (!reminderStore) throw new Error('本地提醒仓储不可用'); return reminderStore.schedule(input); });
  ipcMain.handle('nuanban:reminders:read', (event, accountId, reminderId) => { requireTrusted(event); if (!reminderStore) throw new Error('本地提醒仓储不可用'); return reminderStore.read(accountId, reminderId); });
  ipcMain.handle('nuanban:reminders:list', (event, accountId) => { requireTrusted(event); if (!reminderStore) throw new Error('本地提醒仓储不可用'); return reminderStore.list(accountId); });
  ipcMain.handle('nuanban:reminders:cancel', (event, input) => { requireTrusted(event); if (!reminderStore) throw new Error('本地提醒仓储不可用'); return reminderStore.cancel(input); });
  ipcMain.handle('nuanban:reminders:submit-due', (event, input) => { requireTrusted(event); if (!reminderStore) throw new Error('本地提醒仓储不可用'); return reminderStore.submitDue(input); });
  ipcMain.handle('nuanban:reminders:receipt', (event, input) => { requireTrusted(event); if (!reminderStore) throw new Error('本地提醒仓储不可用'); return reminderStore.recordReceipt(input); });
  ipcMain.handle('nuanban:reminders:complete', (event, input) => { requireTrusted(event); if (!reminderStore) throw new Error('本地提醒仓储不可用'); return reminderStore.complete(input); });
  ipcMain.handle('nuanban:reminders:notify-due', (event, input) => { requireTrusted(event); if (!reminderNotifications) return { status:'unsupported', reason:'桌面通知适配器不可用' }; return reminderNotifications.notifyDue(input); });
  ipcMain.handle('nuanban:pet:close', event => { requireTrustedPet(event); petWindow?.close(); return true; });
  ipcMain.handle('nuanban:pet:open-main', event => {
    requireTrustedPet(event);
    return showMainWindow('/');
  });
  ipcMain.handle('nuanban:pet:context-menu', event => {
    requireTrustedPet(event);
    if (!petWindow || petWindow.isDestroyed()) return false;
    createPetMenu().popup({ window: petWindow });
    return true;
  });
}
async function createWindow() {
  const startPage = fs.existsSync(indexPath) ? indexPath : developmentIndex;
  mainWindow = new BrowserWindow({ width:1360,height:920,minWidth:420,minHeight:640,title:'暖伴 · 前端演示',backgroundColor:'#FFF8EF',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true} });
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('render-process-gone', () => {
    notifyLifecycle('nuanban:host-renderer-gone');
    void lifecycle.requestStop('renderer-gone').catch(() => undefined);
  });
  mainWindow.on('close', () => notifyLifecycle('nuanban:host-before-quit'));
  mainWindow.on('move', () => notifyLifecycle('nuanban:host-window-moved'));
  mainWindow.on('closed', () => {
    void lifecycle.requestStop('process-terminated').catch(() => undefined);
    mainWindow = undefined;
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadFile(startPage);
}
async function createPetWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const petWidth = 280;
  const petHeight = 330;
  const petMargin = 24;
  petWindow = new BrowserWindow({
    x: workArea.x + workArea.width - petWidth - petMargin,
    y: workArea.y + workArea.height - petHeight - petMargin,
    width: petWidth,
    height: petHeight,
    minWidth: petWidth,
    minHeight: petHeight,
    maxWidth: petWidth,
    maxHeight: petHeight,
    title: '暖伴桌宠',
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'pet-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  petWindow.webContents.on('will-navigate', event => event.preventDefault());
  petWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) console.error(`[pet] load failed (${errorCode}): ${errorDescription} ${validatedURL}`);
  });
  petWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[pet] renderer exited: ${details.reason}`);
  });
  petWindow.on('unresponsive', () => console.error('[pet] window became unresponsive'));
  petWindow.on('responsive', () => console.warn('[pet] window became responsive'));
  petWindow.on('closed', () => {
    console.warn('[pet] window closed');
    petWindow = undefined;
  });
  const showPetWindow = () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.showInactive();
    petWindow.setAlwaysOnTop(true, 'floating');
    petWindow.moveTop();
  };
  petWindow.once('ready-to-show', showPetWindow);
  await petWindow.loadFile(petPath);
  showPetWindow();
}
app.on('before-quit', event => {
  if (quitAfterLifecycle) return;
  event.preventDefault();
  quitAfterLifecycle = true;
  notifyLifecycle('nuanban:host-before-quit');
  void lifecycle.requestStop('process-terminated').then(() => app.quit(), () => app.quit());
});
app.on('will-quit', () => {
  reminderNotifications?.dispose();
  reminderNotifications = undefined;
  reminderStore?.close();
  reminderStore = undefined;
});
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'"]}}));
  try {
    reminderStore = createDesktopReminderStore({ databasePath: path.join(app.getPath('userData'), 'nuanban-reminders.sqlite'), payloadCodec: createSafeStoragePayloadCodec(safeStorage) });
    reminderNotifications = createDesktopReminderNotificationBridge({
      store: reminderStore,
      Notification,
      getPermission: () => 'unknown',
      sendOpen: event => {
        if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('nuanban:reminder-open', { deepLink: event.deepLink });
      },
    });
  } catch { reminderStore = undefined; reminderNotifications = undefined; }
  registerBridge();
  await createWindow();
  await createPetWindow();
});
app.on('window-all-closed',()=>app.quit());
