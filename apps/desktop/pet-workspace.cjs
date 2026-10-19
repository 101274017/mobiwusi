function createPetWorkspace({ ipcMain, isTrusted, getWindow, getToolWindow, getToolRevision, showPet }) {
  const channels = ['nuanban:workspace:status', 'nuanban:workspace:return-pet'];

  function requireTrusted(event, argumentsList) {
    if (!isTrusted(event) || argumentsList.length !== 0) throw new Error('不可信桌宠工具请求');
    const window = [getWindow(), getToolWindow()].find(candidate => candidate && !candidate.isDestroyed() && event.sender === candidate.webContents);
    if (!window) throw new Error('不可信桌宠工具请求');
    return window;
  }

  ipcMain.handle(channels[0], (event, ...argumentsList) => {
    const window = requireTrusted(event, argumentsList);
    return window === getToolWindow() ? 'pet-tool' : 'management';
  });
  ipcMain.handle(channels[1], async (event, ...argumentsList) => {
    const origin = requireTrusted(event, argumentsList);
    if (origin !== getToolWindow()) throw new Error('请从桌宠工具窗口返回桌宠');
    const revision = getToolRevision();
    await showPet();
    const window = getToolWindow();
    if (window && window === origin && revision === getToolRevision() && !window.isDestroyed() && isTrusted(event)) window.hide();
    return true;
  });

  return { dispose: () => { for (const channel of channels) ipcMain.removeHandler(channel); } };
}

module.exports = { createPetWorkspace };
