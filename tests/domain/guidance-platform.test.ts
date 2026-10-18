import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GuidanceTargetLifecycle,
  createAndroidFrameContext,
  createWindowsFrameContext,
  mapFrameRect,
  planChildPointer,
  type FrameContext,
  type Rect,
} from '@nuanban/guidance-engine';

const androidFrame = createAndroidFrameContext({
  frameId: 'android-frame-1',
  generation: 4,
  displayId: 'android-display-1',
  windowId: 'projection-1',
  transformId: 'android-transform-portrait',
  layoutRevision: 7,
  capturedAt: 1000,
  projectionSizePx: { width: 1080, height: 2400 },
  systemInsetsPx: { top: 100, right: 0, bottom: 200, left: 0 },
  letterboxRectPx: { x: 90, y: 300, width: 900, height: 1500 },
  scaleFactor: 3,
  rotation: 90,
});

const windowsFrame = createWindowsFrameContext({
  frameId: 'windows-frame-1',
  generation: 2,
  displayId: 'display-negative-origin',
  windowId: 'window-22',
  transformId: 'windows-transform-125',
  layoutRevision: 3,
  capturedAt: 2000,
  captureSizePx: { width: 1600, height: 900 },
  captureContentRectPx: { x: 0, y: 0, width: 1600, height: 900 },
  displayOriginDip: { x: -1920, y: 0 },
  windowOriginDip: { x: 100, y: 80 },
  contentOffsetDip: { x: 12, y: 34 },
  contentSizeDip: { width: 800, height: 600 },
  scaleFactor: 1.25,
  rotation: 0,
});

const target = (frame: FrameContext, rect: Rect = { x: 0.2, y: 0.1, width: 0.3, height: 0.2 }) => ({ frame, rect, expiresAt: 5000 });

describe('C05 Android 坐标变换', () => {
  it('先扣除状态栏/导航栏，再把旋转内容映射到 letterbox', () => {
    expect(androidFrame.contentRectPx).toEqual({ x: 0, y: 100, width: 1080, height: 2100 });
    expect(androidFrame.viewportRectPx).toEqual({ x: 90, y: 300, width: 900, height: 1500 });
    expect(mapFrameRect({ x: 0.2, y: 0.1, width: 0.3, height: 0.2 }, androidFrame)).toEqual({
      x: 720,
      y: 600,
      width: 180,
      height: 450,
    });
  });

  it('letterbox 不在安全内容区时拒绝建立变换', () => {
    expect(() => createAndroidFrameContext({
      frameId: 'android-frame-invalid',
      generation: 1,
      displayId: 'display',
      windowId: 'projection',
      transformId: 'transform',
      layoutRevision: 1,
      capturedAt: 1,
      projectionSizePx: { width: 1080, height: 2400 },
      systemInsetsPx: { top: 100, right: 0, bottom: 200, left: 0 },
      letterboxRectPx: { x: 0, y: 0, width: 10, height: 50 },
      scaleFactor: 3,
      rotation: 0,
    })).toThrow();
  });
});

describe('C06 Windows 坐标变换', () => {
  it('保留负显示器原点并应用 DIP 到物理像素缩放', () => {
    expect(windowsFrame.viewportRectPx).toEqual({ x: -2260, y: 142.5, width: 1000, height: 750 });
    expect(mapFrameRect({ x: 0.5, y: 0.25, width: 0.2, height: 0.3 }, windowsFrame)).toEqual({
      x: -1760,
      y: 330,
      width: 200,
      height: 225,
    });
  });

  it('窗口移动或 DPI 变换后旧目标立即失效', () => {
    const oldTarget = target(windowsFrame);
    expect(planChildPointer({ target: oldTarget, currentFrame: { ...windowsFrame, viewportRectPx: { ...windowsFrame.viewportRectPx, x: -1000 } }, start: { x: -2100, y: 200 }, bounds: windowsFrame.viewportRectPx, now: 3000 }).status).toBe('stale');
    expect(planChildPointer({ target: oldTarget, currentFrame: { ...windowsFrame, transformId: 'windows-transform-200', scaleFactor: 2 }, start: { x: -2100, y: 200 }, bounds: windowsFrame.viewportRectPx, now: 3000 }).status).toBe('stale');
  });
});

describe('目标生命周期与儿童指向', () => {
  it('布局变化、旋转或过期会撤标并转低置信', () => {
    const lifecycle = new GuidanceTargetLifecycle();
    expect(lifecycle.publish(target(androidFrame), 2000).status).toBe('visible');
    expect(lifecycle.observeFrame({ ...androidFrame, layoutRevision: 8 }, 2000)).toMatchObject({ status: 'low_confidence', reason: 'stale_frame', target: null });
    lifecycle.publish(target(androidFrame), 2000);
    expect(lifecycle.observeFrame(androidFrame, 5000)).toMatchObject({ status: 'low_confidence', reason: 'expired', target: null });
  });

  it('我点好了只产生核验请求，不直接完成', () => {
    const lifecycle = new GuidanceTargetLifecycle();
    lifecycle.publish(target(androidFrame), 2000);
    expect(lifecycle.requestVerification()).toEqual({ accepted: true, reason: 'user_done' });
    expect(lifecycle.snapshot()).toMatchObject({ status: 'verification_pending', verificationRequested: true });
    expect(lifecycle.requestVerification()).toEqual({ accepted: false, reason: 'no_active_target' });
  });

  it('儿童模式在安全位置停靠并避让遮挡矩形', () => {
    const bounds = { x: -2260, y: 142.5, width: 1000, height: 750 };
    const pointerTarget = target(windowsFrame, { x: 0.55, y: 0.35, width: 0.2, height: 0.2 });
    const plan = planChildPointer({
      target: pointerTarget,
      currentFrame: windowsFrame,
      start: { x: -2200, y: 200 },
      bounds,
      obstacles: [{ id: 'panel', rect: { x: -2000, y: 300, width: 160, height: 240 } }],
      margin: 20,
      now: 3000,
    });
    expect(plan.status).toBe('ready');
    expect(plan.dock).not.toBeNull();
    expect(plan.path.length).toBeGreaterThanOrEqual(2);
    expect(plan.targetRect).not.toBeNull();
  });

  it('目标没有可用停靠空间时不猜路径', () => {
    const frame = createWindowsFrameContext({
      frameId: 'windows-frame-tight',
      generation: 1,
      displayId: 'display',
      windowId: 'window',
      transformId: 'transform',
      layoutRevision: 1,
      capturedAt: 1,
      captureSizePx: { width: 100, height: 100 },
      captureContentRectPx: { x: 0, y: 0, width: 100, height: 100 },
      displayOriginDip: { x: 0, y: 0 },
      windowOriginDip: { x: 0, y: 0 },
      contentOffsetDip: { x: 0, y: 0 },
      contentSizeDip: { width: 100, height: 100 },
      scaleFactor: 1,
      rotation: 0,
    });
    const plan = planChildPointer({ target: target(frame, { x: 0, y: 0, width: 1, height: 1 }), currentFrame: frame, start: { x: 50, y: 50 }, bounds: frame.viewportRectPx, margin: 20, now: 2 });
    expect(plan).toMatchObject({ status: 'unreachable', reason: 'no_safe_dock', path: [] });
  });
});

describe('C05/C06 输入边界', () => {
  it('共享指向引擎没有系统输入注入入口', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../../packages/guidance-engine/src/index.ts'), 'utf8');
    expect(source).not.toMatch(/InputManager\.injectInputEvent|Instrumentation\.sendPointerSync|SendInput|robotjs|nut\.js|uinput/i);
  });
});
