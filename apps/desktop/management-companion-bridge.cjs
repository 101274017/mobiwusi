function registerManagementCompanionBridge({ ipcMain, isTrusted, getHost }) {
  const channel = 'nuanban:companion:show-lili';
  ipcMain.handle(channel, async (event, ...argumentsList) => {
    if (!isTrusted(event)) throw new Error('不可信伙伴调用来源');
    if (argumentsList.length !== 0) throw new Error('栗栗调用不接受额外参数');
    const host = getHost();
    if (!host || !host.hasPetWindow()) throw new Error('独立桌宠尚未就绪，请重新打开客户端。');
    const selected = await host.selectLili(true);
    if (selected?.ok !== true) {
      if (selected?.code === 'avatar_stop_unconfirmed') throw new Error('原角色尚未停止，未切换为栗栗。请稍后重试。');
      throw new Error('栗栗资源未能加载，未完成桌宠切换。请重试。');
    }
    const shown = host.lili.command({ type: 'display.set', options: { visible: true, clickThrough: false } });
    if (shown?.ok !== true) throw new Error('栗栗窗口未能显示，请重试。');
    await host.showPetPanel({ focusInput: false });
    const current = host.lili.snapshot();
    if (!current.enabled || current.failure || typeof current.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(current.version)) throw new Error('栗栗资源状态未确认，请重试。');
    return { id: 'lili', version: current.version };
  });
  return { dispose() { ipcMain.removeHandler(channel); } };
}

module.exports = { registerManagementCompanionBridge };
