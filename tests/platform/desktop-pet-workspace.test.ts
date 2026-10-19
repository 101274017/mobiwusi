import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const { createPetWorkspace } = createRequire(import.meta.url)('../../apps/desktop/pet-workspace.cjs');
type Handler = (event: unknown, ...argumentsList: unknown[]) => unknown;

function windowFixture() {
  return { isDestroyed: vi.fn(() => false), setTitle: vi.fn(), hide: vi.fn(), webContents: { mainFrame: {}, isDestroyed: () => false, send: vi.fn() } };
}

function fixture() {
  const handlers = new Map<string, Handler>();
  const management = windowFixture();
  const tool = windowFixture();
  const managementEvent = { sender: management.webContents, senderFrame: management.webContents.mainFrame };
  const toolEvent = { sender: tool.webContents, senderFrame: tool.webContents.mainFrame };
  let managementWindow: ReturnType<typeof windowFixture> | undefined = management;
  let toolWindow: ReturnType<typeof windowFixture> | undefined = tool;
  let revision = 1;
  const showPet = vi.fn(async (): Promise<void> => undefined);
  const bridge = createPetWorkspace({ ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler), removeHandler: (channel: string) => handlers.delete(channel) },
    isTrusted: (event: unknown) => event === managementEvent || event === toolEvent,
    getWindow: () => managementWindow, getToolWindow: () => toolWindow, getToolRevision: () => revision, showPet });
  return { bridge, management, tool, managementEvent, toolEvent, showPet, handlers,
    removeManagement: () => { managementWindow = undefined; },
    replaceTool: () => { toolWindow = windowFixture(); return toolWindow; },
    reopenTool: () => { revision += 1; } };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => { resolve = complete; });
  return { promise, resolve };
}

describe('桌宠工具与客户端固定使用独立工作区，不切换客户端界面', () => {
  it('工作区身份取自实际窗口，桌宠查询不能更改客户端模式、标题或导航', () => {
    const current = fixture();
    const status = current.handlers.get('nuanban:workspace:status')!;
    expect(status(current.managementEvent)).toBe('management');
    expect(status(current.toolEvent)).toBe('pet-tool');
    expect(status(current.managementEvent)).toBe('management');
    expect(current.management.setTitle).not.toHaveBeenCalled();
    expect(current.management.webContents.send).not.toHaveBeenCalled();
    expect(current.management.hide).not.toHaveBeenCalled();
  });

  it('桌宠工具可独立运行，不要求先打开客户端', () => {
    const current = fixture();
    current.removeManagement();
    expect(current.handlers.get('nuanban:workspace:status')!(current.toolEvent)).toBe('pet-tool');
    expect(() => current.handlers.get('nuanban:workspace:status')!(current.managementEvent)).toThrow();
    expect(current.showPet).not.toHaveBeenCalled();
  });

  it('只允许受信主框架无参数查询，拒绝伪造模式、子框架和已关闭窗口', async () => {
    const current = fixture();
    const status = current.handlers.get('nuanban:workspace:status')!;
    const back = current.handlers.get('nuanban:workspace:return-pet')!;
    expect(() => status({ sender: current.tool.webContents, senderFrame: {} })).toThrow();
    expect(() => status(current.managementEvent, { mode: 'pet-tool' })).toThrow();
    await expect(back({}, {})).rejects.toThrow();
    await expect(back(current.toolEvent, { capture: true })).rejects.toThrow();
    current.tool.isDestroyed.mockReturnValue(true);
    expect(() => status(current.toolEvent)).toThrow();
    expect(current.showPet).not.toHaveBeenCalled();
  });

  it('客户端不能借用工具返回请求隐藏主窗口', async () => {
    const current = fixture();
    await expect(current.handlers.get('nuanban:workspace:return-pet')!(current.managementEvent)).rejects.toThrow('桌宠工具窗口');
    expect(current.showPet).not.toHaveBeenCalled();
    expect(current.management.hide).not.toHaveBeenCalled();
  });

  it('先确认桌宠显示再隐藏独立工具，客户端和工具草稿仍保留', async () => {
    const current = fixture();
    const waiting = deferred();
    current.showPet.mockImplementation(() => waiting.promise);
    const returning = current.handlers.get('nuanban:workspace:return-pet')!(current.toolEvent);
    expect(current.tool.hide).not.toHaveBeenCalled();
    waiting.resolve();
    expect(await returning).toBe(true);
    expect(current.tool.hide).toHaveBeenCalledTimes(1);
    expect(current.management.hide).not.toHaveBeenCalled();
    expect(current.handlers.get('nuanban:workspace:status')!(current.managementEvent)).toBe('management');
  });

  it('返回失败不隐藏任一窗口，退出移除全部 IPC', async () => {
    const current = fixture();
    current.showPet.mockRejectedValue(new Error('synthetic pet unavailable'));
    await expect(current.handlers.get('nuanban:workspace:return-pet')!(current.toolEvent)).rejects.toThrow();
    expect(current.tool.hide).not.toHaveBeenCalled();
    expect(current.management.hide).not.toHaveBeenCalled();
    current.bridge.dispose();
    expect(current.handlers.size).toBe(0);
  });

  it('等待返回期间打开其他桌宠功能，旧请求不能隐藏新页面', async () => {
    const current = fixture();
    const waiting = deferred();
    current.showPet.mockImplementation(() => waiting.promise);
    const returning = current.handlers.get('nuanban:workspace:return-pet')!(current.toolEvent);
    current.reopenTool();
    waiting.resolve();
    await returning;
    expect(current.tool.hide).not.toHaveBeenCalled();
    expect(current.management.hide).not.toHaveBeenCalled();
  });

  it('等待返回期间重建工具窗口，不隐藏新工具或客户端', async () => {
    const current = fixture();
    const waiting = deferred();
    current.showPet.mockImplementation(() => waiting.promise);
    const returning = current.handlers.get('nuanban:workspace:return-pet')!(current.toolEvent);
    const replacement = current.replaceTool();
    waiting.resolve();
    await returning;
    expect(replacement.hide).not.toHaveBeenCalled();
    expect(current.tool.hide).not.toHaveBeenCalled();
    expect(current.management.hide).not.toHaveBeenCalled();
  });
});
