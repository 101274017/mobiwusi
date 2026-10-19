const { app, desktopCapturer } = require('electron');
const path = require('node:path');
const { mkdirSync } = require('node:fs');

const workspace = path.resolve(__dirname, '..', '..');
const cacheRoot = path.join(workspace, '.cache');
const userData = process.env.NUANBAN_SMOKE_USER_DATA;
if (!userData || !path.isAbsolute(userData) || !path.resolve(userData).startsWith(`${cacheRoot}${path.sep}`)) {
  throw new Error('A dedicated workspace cache path is required for the standalone smoke test');
}
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
process.env.NUANBAN_DESKTOP_API_BASE_URL = '';
process.env.NUANBAN_DESKTOP_API_TOKEN = '';
global.__nuanbanSmoke = { screenRequestAttempts: 0 };
desktopCapturer.getSources = async () => {
  global.__nuanbanSmoke.screenRequestAttempts += 1;
  throw new Error('User screen capture is prohibited in the default-off smoke test');
};
require('../../apps/desktop/main.cjs');
