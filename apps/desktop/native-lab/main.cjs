const { app, BrowserWindow, ipcMain, session, screen, powerMonitor } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { CaptureSession, exactRecord, pointInBounds, checkedPoint, ACK_TIMEOUT_MS } = require('./policy.cjs');

const selfTest = process.argv.includes('--nuanban-c02-self-test');
if (process.platform !== 'win32') throw new Error('C02 本地样例仅面向 Windows 验证');
if (selfTest && process.env.NUANBAN_C02_USER_DATA) app.setPath('userData', process.env.NUANBAN_C02_USER_DATA);
const capture = new CaptureSession();
const localFiles = ['control.html', 'control.css', 'control.js', 'canary.html', 'canary.css', 'canary.js', 'overlay.html', 'overlay.css', 'stop.html', 'stop.css', 'stop.js'];
const allowedUrls = new Set(localFiles.map(file => pathToFileURL(path.join(__dirname, file)).href));
let control;
let canary;
let marker;
let stopWindow;
let activeTicket;
let partition;
let ticker;
let cleanupTimer;
let quitting = false;
let displayRequestCount = 0;
let deniedNetworkRequests = 0;
const pageErrors = [];

app.setName('NuanbanC02Lab');
app.commandLine.appendSwitch('disable-background-networking');

function expectedUrl(file) { return pathToFileURL(path.join(__dirname, file)).href; }
function live(window) { return window && !window.isDestroyed(); }
function trusted(event, window, file) {
  return live(window) && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === expectedUrl(file);
}
function requireControl(event) { if (!trusted(event, control, 'control.html')) throw new Error('不可信的实验消息来源'); }
function matchesActive(ticket) { return ticket?.generation === activeTicket?.generation && ticket?.nonce === activeTicket?.nonce; }

function windowOptions(extra = {}) {
  return { show: false, backgroundColor: '#FFF8EB', webPreferences: { session: partition, preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false, offscreen: selfTest }, ...extra };
}

function guard(window) {
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('preload-error', () => pageErrors.push('preload-error'));
  window.webContents.on('console-message', details => { if (details.level === 'error' || details.level === 3) pageErrors.push('renderer-console-error'); });
  window.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => { if (mainFrame && code !== -3) pageErrors.push('main-frame-load-failed'); });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || ((input.control || input.meta) && ['r', '+', '-', '='].includes(input.key.toLowerCase()))) event.preventDefault();
  });
}

function displays() {
  return screen.getAllDisplays().map(display => ({ id: display.id, bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor, rotation: display.rotation }));
}

function geometry() {
  if (!live(canary)) return { status: 'canary-closed' };
  const contentDip = canary.getContentBounds();
  const centerDip = pointInBounds(contentDip, { x: 0.5, y: 0.5 });
  const centerPhysical = checkedPoint(screen.dipToScreenPoint({ x: Math.round(centerDip.x), y: Math.round(centerDip.y) }));
  const roundTripDip = checkedPoint(screen.screenToDipPoint(centerPhysical));
  return { contentDip, windowDip: canary.getBounds(), contentPhysical: screen.dipToScreenRect(canary, contentDip), centerDip, centerPhysical, roundTripDip, captureFrameCalibration: 'not-implemented', note: '窗口几何记录，不是跨应用教学坐标或捕获内容区标定' };
}

function snapshot() { return { session: capture.snapshot(), displays: displays(), geometry: geometry() }; }
function notify() { if (live(control)) control.webContents.send('c02:state', snapshot()); }
function removeOverlays() {
  for (const window of [marker, stopWindow]) if (live(window)) window.destroy();
  marker = null;
  stopWindow = null;
}

function requestStop(reason) {
  capture.stop(reason);
  removeOverlays();
  notify();
  if (capture.snapshot().cleanupPending && !cleanupTimer && !quitting) {
    cleanupTimer = setTimeout(() => {
      cleanupTimer = null;
      if (!capture.snapshot().cleanupPending) return;
      if (live(control)) control.destroy();
      capture.rendererTerminated();
      removeOverlays();
    }, ACK_TIMEOUT_MS);
  }
}

async function settledStop(reason) {
  requestStop(reason);
  const deadline = performance.now() + ACK_TIMEOUT_MS + 100;
  while (capture.snapshot().cleanupPending && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  if (!['idle', 'stopped'].includes(capture.snapshot().phase)) throw new Error('清理尚未确认，拒绝移动或重新捕获');
}

async function createCanary() {
  const options = windowOptions({ width: 640, height: 650, minWidth: 440, minHeight: 500, title: '微光指引 C02 · 固定合成窗口' });
  delete options.webPreferences.preload;
  canary = new BrowserWindow(options);
  guard(canary);
  canary.webContents.setZoomFactor(1);
  canary.on('move', () => { requestStop('canary-changed'); });
  canary.on('resize', () => { requestStop('canary-changed'); });
  canary.on('hide', () => { requestStop('canary-hidden'); });
  canary.on('minimize', () => { requestStop('canary-hidden'); });
  canary.on('closed', () => { canary = null; requestStop('canary-changed'); });
  canary.webContents.on('render-process-gone', () => requestStop('renderer-gone'));
  await canary.loadFile(path.join(__dirname, 'canary.html'));
}

async function createOverlays(ticket) {
  if (!live(canary) || !matchesActive(ticket) || capture.snapshot().phase !== 'capturing') return;
  const bounds = canary.getContentBounds();
  const rect = await canary.webContents.executeJavaScript("(() => { const rect = document.getElementById('target').getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}; })()");
  const target = checkedPoint(rect);
  if (!matchesActive(ticket) || capture.snapshot().phase !== 'capturing') return;
  marker = new BrowserWindow(windowOptions({ width: 80, height: 80, x: Math.round(bounds.x + target.x - 40), y: Math.round(bounds.y + target.y - 40), transparent: true, frame: false, hasShadow: false, focusable: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, backgroundColor: '#00000000' }));
  marker.setIgnoreMouseEvents(true, { forward: true });
  if (!selfTest) marker.setContentProtection(true);
  guard(marker);
  stopWindow = new BrowserWindow(windowOptions({ width: 132, height: 52, x: bounds.x + Math.max(0, bounds.width - 145), y: bounds.y + 8, transparent: true, frame: false, hasShadow: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, backgroundColor: '#00000000' }));
  guard(stopWindow);
  if (!selfTest) stopWindow.setContentProtection(true);
  const createdMarker = marker;
  const createdStop = stopWindow;
  await Promise.all([createdMarker.loadFile(path.join(__dirname, 'overlay.html')), createdStop.loadFile(path.join(__dirname, 'stop.html'))]);
  if (!matchesActive(ticket) || capture.snapshot().phase !== 'capturing') { removeOverlays(); return; }
  if (!selfTest) { createdMarker.showInactive(); createdStop.showInactive(); }
}

function configureSession() {
  partition = session.fromPartition(`nuanban-c02-${randomUUID()}`);
  partition.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'display-capture' && contents === control?.webContents && ['awaiting', 'starting'].includes(capture.snapshot().phase) && !selfTest));
  partition.setPermissionCheckHandler((contents, permission) => permission === 'display-capture' && contents === control?.webContents && ['awaiting', 'starting'].includes(capture.snapshot().phase) && !selfTest);
  partition.webRequest.onBeforeRequest((details, callback) => {
    const allowed = allowedUrls.has(details.url.split('#')[0]);
    if (!allowed) deniedNetworkRequests += 1;
    callback({ cancel: !allowed });
  });
  partition.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'none'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'none'; img-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"] } }));
  partition.setDisplayMediaRequestHandler((request, callback) => {
    displayRequestCount += 1;
    const ownFrame = live(control) && request.frame === control.webContents.mainFrame && request.frame.url === expectedUrl('control.html');
    const sourceId = live(canary) ? canary.getMediaSourceId() : '';
    const grant = selfTest ? null : capture.grant({ trusted: Boolean(ownFrame && live(canary) && canary.isVisible() && !canary.isMinimized()), userGesture: request.userGesture, videoRequested: request.videoRequested, audioRequested: request.audioRequested, ownSourceId: sourceId });
    if (!grant) { callback({}); if (ownFrame) requestStop('capture-failed'); return; }
    notify();
    callback({ video: { id: grant.sourceId, name: 'NUANBAN-C02-SYNTHETIC' } });
  }, { useSystemPicker: false });
}

function registerBridge() {
  ipcMain.handle('c02:read', event => { requireControl(event); return snapshot(); });
  ipcMain.handle('c02:begin', (event, options) => {
    requireControl(event);
    if (!live(canary) || (!selfTest && (!canary.isVisible() || canary.isMinimized()))) throw new Error('请先显示合成窗口');
    activeTicket = capture.begin(options);
    notify();
    return activeTicket;
  });
  ipcMain.handle('c02:started', async (event, payload) => {
    requireControl(event);
    if (!exactRecord(payload, ['ticket', 'details'])) return false;
    const accepted = capture.started(payload.ticket, payload.details);
    if (!accepted) { if (matchesActive(payload.ticket)) requestStop('invalid-message'); return false; }
    try { if (capture.snapshot().overlay) await createOverlays(payload.ticket); }
    catch { requestStop('capture-failed'); return false; }
    notify();
    return capture.snapshot().phase === 'capturing';
  });
  ipcMain.handle('c02:frame', (event, payload) => {
    requireControl(event);
    if (!exactRecord(payload, ['ticket', 'sequence'])) return false;
    const accepted = capture.frame(payload.ticket, payload.sequence);
    if (!accepted && matchesActive(payload.ticket)) requestStop('invalid-message');
    return accepted;
  });
  ipcMain.handle('c02:stopped', (event, payload) => {
    requireControl(event);
    if (!exactRecord(payload, ['ticket', 'proof']) || !capture.acknowledge(payload.ticket, payload.proof)) return false;
    clearTimeout(cleanupTimer); cleanupTimer = null; activeTicket = null;
    notify();
    return true;
  });
  for (const [channel, reason] of [['c02:failed', 'capture-failed'], ['c02:ended', 'capture-ended']]) {
    ipcMain.handle(channel, (event, ticket) => { requireControl(event); if (matchesActive(ticket)) requestStop(reason); return true; });
  }
  ipcMain.handle('c02:stop', event => {
    if (!trusted(event, control, 'control.html') && !trusted(event, stopWindow, 'stop.html')) throw new Error('不可信停止来源');
    requestStop('user'); return true;
  });
  ipcMain.handle('c02:show-canary', async event => { requireControl(event); if (!live(canary)) await createCanary(); if (!selfTest) { canary.show(); canary.focus(); } return true; });
  ipcMain.handle('c02:move-canary', async (event, displayId) => {
    requireControl(event);
    if (!Number.isSafeInteger(displayId)) throw new Error('显示器 ID 无效');
    const display = screen.getAllDisplays().find(candidate => candidate.id === displayId);
    if (!display || !live(canary)) throw new Error('显示器或合成窗口已不可用');
    await settledStop('canary-changed');
    const area = display.workArea;
    canary.setBounds({ x: area.x + 20, y: area.y + 20, width: Math.min(640, area.width - 40), height: Math.min(650, area.height - 40) });
    if (!selfTest) canary.show();
    notify(); return true;
  });
}

app.whenReady().then(async () => {
  configureSession();
  registerBridge();
  control = new BrowserWindow(windowOptions({ width: 1160, height: 960, minWidth: 760, minHeight: 640, title: '微光指引 · C02 原生验证' }));
  guard(control);
  if (!selfTest) control.setContentProtection(true);
  control.webContents.setZoomFactor(1);
  control.on('close', () => requestStop('control-closed'));
  control.on('closed', () => { control = null; capture.rendererTerminated(); clearTimeout(cleanupTimer); removeOverlays(); if (live(canary)) canary.destroy(); });
  control.webContents.on('render-process-gone', () => { requestStop('renderer-gone'); if (live(control)) control.destroy(); });
  await Promise.all([control.loadFile(path.join(__dirname, 'control.html')), createCanary()]);
  const changed = () => requestStop('display-changed');
  screen.on('display-added', changed); screen.on('display-removed', changed); screen.on('display-metrics-changed', changed);
  powerMonitor.on('suspend', () => requestStop('display-changed'));
  powerMonitor.on('lock-screen', () => requestStop('canary-hidden'));
  ticker = setInterval(() => { const due = capture.dueReason(); if (due) requestStop(due); notify(); }, 250);
  if (selfTest) {
    try {
      await require('./self-test.cjs').run({ app, control, canary, capture, snapshot, createOverlays, requestStop, getCounters: () => ({ displayRequestCount, deniedNetworkRequests, pageErrors: [...pageErrors] }), getOverlays: () => ({ marker, stopWindow }) });
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  } else { control.show(); canary.showInactive(); }
}).catch(error => { console.error(error); app.exit(1); });

app.on('before-quit', () => { if (quitting) return; quitting = true; clearInterval(ticker); clearTimeout(cleanupTimer); requestStop('app-quit'); removeOverlays(); });
app.on('window-all-closed', () => app.quit());
