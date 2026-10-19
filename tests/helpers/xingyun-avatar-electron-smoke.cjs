const { app, desktopCapturer, ipcMain } = require('electron');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

const workspace = path.resolve(__dirname, '..', '..');
const cache = path.join(workspace, '.cache');
const userData = process.env.NUANBAN_SMOKE_USER_DATA;
if (!userData || !path.isAbsolute(userData) || !path.resolve(userData).startsWith(cache + path.sep)) throw new Error('An isolated cache profile is required');
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
global.__avatarSmoke = { screenRequests: 0, posts: 0, deletes: 0, sessionCodes: [], resourceHosts: [], hasResources: false, beginCalls: 0, exchangeCalls: [], sdkAudioFormats: [], sessionRequests: [] };
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) => handle(channel, (event, ...parameters) => {
  if (channel === 'nuanban:avatar:begin') global.__avatarSmoke.beginCalls++;
  if (channel === 'nuanban:avatar:exchange') global.__avatarSmoke.exchangeCalls.push(parameters[1]?.method);
  if (channel === 'nuanban:avatar:exchange' && parameters[1]?.method === 'POST') {
    const rawAudio = parameters[1].body?.config?.raw_audio;
    global.__avatarSmoke.sdkAudioFormats.push(typeof rawAudio === 'boolean' ? rawAudio : null);
  }
  return listener(event, ...parameters);
});
const synthetic = process.env.NUANBAN_AVATAR_SMOKE_SYNTHETIC === '1';
if (synthetic) require('../../apps/desktop/xingyun-credentials.cjs').loadXingyunCredentials = async () => ({ appId: '031ce3cd-synthetic-application-id', appSecret: 'synthetic-secret-00000000' });
desktopCapturer.getSources = async () => { global.__avatarSmoke.screenRequests++; throw new Error('Screen capture is disabled for avatar verification'); };
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const sessionRequest = url === 'https://nebula-agent.xingyun3d.com/user/v1/ttsa_v2/session';
  if (sessionRequest && options.method === 'POST') {
    global.__avatarSmoke.posts++;
    const body = JSON.parse(options.body);
    const rawAudio = body.config?.raw_audio;
    global.__avatarSmoke.sessionRequests.push({ rawAudio: typeof rawAudio === 'boolean' ? rawAudio : null, hasTag: Object.hasOwn(body, 'tag') });
  }
  if (sessionRequest && options.method === 'DELETE') global.__avatarSmoke.deletes++;
  const response = synthetic && sessionRequest ? new Response(JSON.stringify(options.method === 'POST' ? { error_code: 1008, error_reason: 'synthetic unavailable application' } : { error_code: 0, data: {} })) : await nativeFetch(url, options);
  if (sessionRequest) {
    try {
      const body = await response.clone().json();
      const reason = typeof body.error_reason === 'string' ? body.error_reason.replace(/[A-Za-z0-9_=-]{24,}/g, '[redacted]').replace(/https?:\/\/\S+/g, '[address]').slice(0, 200) : '';
      global.__avatarSmoke.sessionCodes.push({ method: options.method, httpStatus: response.status, code: body.error_code ?? body.code ?? null, reason });
      if (options.method === 'POST' && body.data?.resource_pack) {
        global.__avatarSmoke.hasResources = true;
        const hosts = new Set();
        const visit = value => {
          if (typeof value === 'string' && /^(https|wss):\/\//.test(value)) { try { hosts.add(new URL(value).hostname); } catch {} }
          else if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === 'object') Object.values(value).forEach(visit);
        };
        visit(body.data);
        global.__avatarSmoke.resourceHosts = [...hosts];
      }
    } catch {}
  }
  return response;
};
require('../../apps/desktop/main.cjs');
