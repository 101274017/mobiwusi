import type { Page } from '@playwright/test';
import type { TextQuestionReply } from '@nuanban/application';

export type TextBridgeMode = 'ready' | 'pending' | Extract<TextQuestionReply, { ok: false }>['code'];
export async function installTextBridge(page: Page, mode: TextBridgeMode = 'ready') {
  await page.addInitScript(mode => {
    let complete: (() => void) | undefined;
    window.nuanbanTextQuestion = {
      status: async () => ({ available: true }),
      answer: async input => {
        sessionStorage.setItem('text-request-count', String(Number(sessionStorage.getItem('text-request-count') || 0) + 1));
        sessionStorage.setItem('text-request-question', input.question);
        if (mode === 'pending') return new Promise(resolve => { complete = () => resolve({ ok: true, requestId: input.requestId, text: '迟到模型结果不能显示' }); });
        if (mode !== 'ready') return { ok: false, requestId: input.requestId, code: mode, retryable: true };
        return { ok: true, requestId: input.requestId, text: '合成接口回执：字太小可以亲手打开设备设置，核对显示与字体。每一步由你操作。' };
      },
      cancel: async () => { sessionStorage.setItem('text-cancelled', 'true'); complete?.(); return true; },
    };
  }, mode);
}
