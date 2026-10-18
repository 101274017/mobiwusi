import { describe, expect, it } from 'vitest';
import { evaluateLocalFrame, isAdmittedFrame, safeSummary } from '../../apps/desktop/observation-policy.cjs';
import { syntheticDetection, syntheticFrame, syntheticPng } from '../helpers/standalone-frame';

describe('独立桌宠本地帧门控（合成单测，不是真实外部软件验收）', () => {
  it('只有本地完整检测和同帧脱敏结果可以获得发送资格', () => {
    const frame = syntheticFrame();
    const decision = evaluateLocalFrame(frame, syntheticDetection(frame));
    expect(decision.decision).toBe('allow');
    expect(isAdmittedFrame(decision)).toBe(true);
    expect(isAdmittedFrame({ ...decision })).toBe(false);
    if (decision.decision === 'allow') {
      expect(decision.elements.map(element => element.label)).toEqual(['设置', '显示', '文本大小', '返回']);
      expect(decision.sanitizedHash).not.toBe(decision.frameHash);
      decision.sanitizedPng[decision.sanitizedPng.length - 1] ^= 1;
      expect(isAdmittedFrame(decision)).toBe(false);
    }
  });

  it('未知软件名称不等于风险未知，但未经识别的页面必须暂停', () => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['任意新软件', '设置', '显示', '字体大小', '返回'])).decision).toBe('allow');
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['任意新软件', '一段未知内容', '另一个未知内容']))).toMatchObject({ decision: 'pause', reason: 'unclassified_screen' });
  });

  it.each(['密码', '验证码', '私人聊天', '付款确认', 'api_key sk-abcdefghijklmnopq', '13812345678', 'private@example.com'])('敏感文字本地拒绝：%s', text => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['设置', '显示', '文本大小', text]))).toMatchObject({ decision: 'pause', reason: 'sensitive_screen' });
  });

  it('拆词敏感内容、帧身份不符和人脸检测缺失都不能放行', () => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['设置', '显示', '文本大小', '支', '付']))).toMatchObject({ decision: 'pause' });
    expect(evaluateLocalFrame(frame, { ...syntheticDetection(frame), frameHash: 'different' })).decision).toBe('pause');
    expect(evaluateLocalFrame(frame, { ...syntheticDetection(frame), redaction: { text: true, faces: false } }).decision).toBe('pause');
    expect(evaluateLocalFrame(frame, { ...syntheticDetection(frame), status: 'unavailable' }).decision).toBe('pause');
  });

  it('原图、过期帧、尺寸伪造和越界控件均拒绝', () => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, { ...syntheticDetection(frame), sanitizedPng: Buffer.from(frame.png) }).decision).toBe('pause');
    expect(evaluateLocalFrame(frame, syntheticDetection(frame), { now: frame.capturedAt + 5001 }).decision).toBe('pause');
    expect(evaluateLocalFrame(frame, { ...syntheticDetection(frame), sanitizedPng: syntheticPng(0, 1, 1) }).decision).toBe('pause');
    expect(evaluateLocalFrame(frame, { ...syntheticDetection(frame), words: [{ text: '设置', rect: { x: -1, y: 0, width: 100, height: 30 } }] }).decision).toBe('pause');
  });

  it('笔记摘要不重新留存秘密', () => {
    expect(safeSummary('验证码123456')).not.toContain('123456');
    expect(safeSummary('学习调整字体')).toBe('学习调整字体');
  });
});
