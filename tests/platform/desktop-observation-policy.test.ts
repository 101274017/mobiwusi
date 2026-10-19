import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { evaluateLocalFrame, isAdmittedFrame, safeSummary } from '../../apps/desktop/observation-policy.cjs';
import { createControlLayout } from '../../apps/desktop/observation/control-layout.cjs';
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

  it('完整检测的大幅画面超出发送上限时只输出独立控件布局，不误判检测失败', () => {
    const png = syntheticPng(255, 1200, 1000, true);
    const frame = { ...syntheticFrame(), width: 1200, height: 1000, geometry: null, png, frameHash: createHash('sha256').update(png).digest('hex') };
    const detection = syntheticDetection(frame);
    detection.sanitizedPng = syntheticPng(0, frame.width, frame.height, true);
    expect(detection.sanitizedPng.length).toBeGreaterThan(2_000_000);
    const projected = evaluateLocalFrame(frame, detection);
    expect(projected).toMatchObject({ decision: 'allow', scene: 'controls_only', reason: 'locally_projected_controls' });
    if (projected.decision !== 'allow') throw new Error('missing safe control layout');
    expect(projected.sanitizedPng).toEqual(createControlLayout(detection.words, frame.width, frame.height));
    expect(projected.sanitizedPng.length).toBeLessThan(2_000_000);
    expect(projected.sanitizedPng).not.toEqual(detection.sanitizedPng);
    detection.words.push({ text: '验证码', rect: { x: 200, y: 20, width: 80, height: 30 } });
    expect(evaluateLocalFrame(frame, detection)).toMatchObject({ decision: 'pause', reason: 'sensitive_screen' });
    detection.words = [{ text: '未经识别的正文', rect: { x: 20, y: 20, width: 120, height: 30 } }];
    expect(evaluateLocalFrame(frame, detection)).toMatchObject({ decision: 'pause', reason: 'unclassified_screen' });
  });

  it('屏幕分词超过旧的 1024 阈值仍扫描全部内容，不能遗漏末尾敏感文字', () => {
    const frame = syntheticFrame();
    const detection = syntheticDetection(frame, ['文件', '编辑', '查看']);
    detection.words.push(...Array.from({ length: 1200 }, (_, index) => ({ text: 'a', rect: { x: 20 + index % 40 * 18, y: 160 + Math.floor(index / 40) * 10, width: 12, height: 8 } })));
    expect(evaluateLocalFrame(frame, detection)).toMatchObject({ decision: 'allow', scene: 'controls_only' });
    detection.words.push({ text: '私人聊天', rect: { x: 20, y: 500, width: 100, height: 30 } });
    expect(evaluateLocalFrame(frame, detection)).toMatchObject({ decision: 'pause', reason: 'sensitive_screen' });
  });

  it('完整检测但没有可读文字时明确暂停原因，不能冒充检测器损坏', () => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, []))).toMatchObject({ decision: 'pause', reason: 'no_readable_text' });
  });

  it('本地完整性与处理量上限仍保守拒绝，不因控件布局回退而绕过', () => {
    const frame = syntheticFrame();
    const detection = syntheticDetection(frame);
    const region = { x: 20, y: 20, width: 100, height: 30 };
    expect(evaluateLocalFrame(frame, { ...detection, words: Array.from({ length: 8193 }, () => ({ text: 'a', rect: region })) }))
      .toMatchObject({ decision: 'pause', reason: 'local_detection_limit' });
    expect(evaluateLocalFrame(frame, { ...detection, faces: Array.from({ length: 513 }, () => ({ rect: region })) }))
      .toMatchObject({ decision: 'pause', reason: 'local_detection_limit' });
    expect(evaluateLocalFrame(frame, { ...detection, words: Array.from({ length: 1025 }, () => ({ text: '设置', rect: region })) }))
      .toMatchObject({ decision: 'pause', reason: 'control_layout_limit' });
    expect(evaluateLocalFrame(frame, { ...detection, redaction: { text: false, faces: true } }))
      .toMatchObject({ decision: 'pause', reason: 'incomplete_local_detection' });
    expect(evaluateLocalFrame(frame, { ...detection, sanitizedPng: Buffer.from(frame.png) }))
      .toMatchObject({ decision: 'pause', reason: 'unredacted_frame' });
  });

  it('未知软件名称不等于风险未知，但未经识别的页面必须暂停', () => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['任意新软件', '设置', '显示', '字体大小', '返回'])).decision).toBe('allow');
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['任意新软件', '一段未知内容', '另一个未知内容']))).toMatchObject({ decision: 'pause', reason: 'unclassified_screen' });
  });

  it.each([
    [['未知浏览器', '书签', '添加书签', '取消'], 'browser_controls'],
    [['任意编辑器', '文件', '编辑', '查看', '自动换行'], 'editor_controls'],
    [['Unlisted editor', 'File', 'Edit', 'Format', 'Word wrap', 'Save'], 'editor_controls'],
  ])('软件名称不参与白名单，纯已识别安全控件可独立分类：%s', (labels, scene) => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, labels as string[]))).toMatchObject({ decision: 'allow', scene });
  });

  it('通用软件控件只能获得不含原画面的布局，不能带出未知正文或敏感页面', () => {
    const frame = syntheticFrame();
    const detection = syntheticDetection(frame, ['陌生软件', '文件', '编辑', '查看', '格式', '未知文档正文']);
    const projected = evaluateLocalFrame(frame, detection);
    expect(projected).toMatchObject({ decision: 'allow', scene: 'controls_only', reason: 'locally_projected_controls' });
    if (projected.decision === 'allow') {
      expect(projected.sanitizedPng).not.toEqual(detection.sanitizedPng);
      expect(projected.sanitizedPng).not.toEqual(frame.png);
      expect(projected.elements.map(element => element.label)).toEqual(['文件', '编辑', '查看', '格式']);
    }
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['文件', '编辑', '查看', '格式', '私人聊天'])))
      .toMatchObject({ decision: 'pause', reason: 'sensitive_screen' });
  });

  it.each([
    [['此电脑', '回收站', '控制面板', '学习资料', '练习.txt'], 'desktop_controls'],
    [['This PC', 'Recycle Bin', 'Search', 'practice.txt'], 'desktop_controls'],
    [['文件资源管理器', '此电脑', '下载', '名称', '修改日期', '类型', '大小', '练习.txt'], 'file_manager_controls'],
    [['File Explorer', 'This PC', 'Name', 'Date modified', 'Type', 'Size', 'practice.txt'], 'file_manager_controls'],
    [['文件资源管理器', '此电脑', '快速访问', '新建', '剪切', '排序', '练习.txt'], 'file_manager_controls'],
  ])('完整检测后的普通系统控件可以分类，文件名不成为云端元素：%s', (labels, scene) => {
    const frame = syntheticFrame();
    const admitted = evaluateLocalFrame(frame, syntheticDetection(frame, labels as string[]));
    expect(admitted).toMatchObject({ decision: 'allow', scene });
    if (admitted.decision === 'allow') expect(admitted.elements.some(element => /练习|practice|学习资料/.test(element.label))).toBe(false);
  });

  it.each([
    ['文件资源管理器', '此电脑', '名称', '修改日期', '类型', '大小', '验证码123456'],
    ['此电脑', '回收站', '控制面板', '13812345678'],
  ])('敏感文件名不能借系统分类或控件布局放行：%s', (...labels) => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, labels)).decision).toBe('pause');
  });

  it.each([
    ['回收站', '练习文档', '学习材料'],
    ['此电脑', '一段任意正文'],
    ['文件资源管理器', '搜索', '一段任意正文'],
    ['此电脑', '回收站', '控制面板', ...Array.from({ length: 11 }, (_, index) => `未知正文${index}`)],
    ['新建标签页', '收藏夹', '刷新', '普通网页标题', '普通网页正文', '另一个内容区域'],
    ['文件', '编辑', '查看', '格式', '练习文档', '普通正文', '第二行内容'],
  ])('稀疏桌面和正文较多的常见界面降为安全控件布局，不再整页误停：%s', (...labels) => {
    const frame = syntheticFrame();
    const projected = evaluateLocalFrame(frame, syntheticDetection(frame, labels));
    expect(projected).toMatchObject({ decision: 'allow', scene: 'controls_only' });
    expect(isAdmittedFrame(projected)).toBe(true);
  });

  it('布局只含已识别控件矩形，原始像素、未知文字及其位置均不进入输出', () => {
    const first = syntheticFrame();
    const changedPng = syntheticPng(144);
    const second = { ...first, png: changedPng, frameHash: createHash('sha256').update(changedPng).digest('hex') };
    const firstDetection = syntheticDetection(first, ['文件', '编辑', '查看', '普通正文', '另一个内容']);
    const secondDetection = syntheticDetection(second, ['文件', '编辑', '查看', '完全不同的内容', '另一份练习']);
    secondDetection.words[3].rect = { x: 400, y: 400, width: 200, height: 40 };
    const firstResult = evaluateLocalFrame(first, firstDetection);
    const secondResult = evaluateLocalFrame(second, secondDetection);
    expect(firstResult).toMatchObject({ decision: 'allow', scene: 'controls_only' });
    expect(secondResult).toMatchObject({ decision: 'allow', scene: 'controls_only' });
    if (firstResult.decision !== 'allow' || secondResult.decision !== 'allow') throw new Error('missing projected frame');
    expect(firstResult.sanitizedPng).toEqual(secondResult.sanitizedPng);
    expect(firstResult.sanitizedPng[24]).toBe(8);
    expect(firstResult.sanitizedPng[25]).toBe(0);
    const pixels = inflateSync(firstResult.sanitizedPng.subarray(41, 41 + firstResult.sanitizedPng.readUInt32BE(33)));
    expect(pixels.length).toBe((first.width + 1) * first.height);
    expect(pixels[20 * (first.width + 1) + 21]).toBe(48);
    expect(pixels[140 * (first.width + 1) + 21]).toBe(255);
    expect(pixels[400 * (first.width + 1) + 401]).toBe(255);
    expect(pixels.at(-1)).toBe(255);
    firstResult.sanitizedPng.fill(0);
    expect(isAdmittedFrame(firstResult)).toBe(false);
  });

  it('控件布局同样限制图像尺寸、像素、矩形和工作量', () => {
    expect(() => createControlLayout([], 800, 600)).toThrow('control_layout_invalid');
    expect(() => createControlLayout([{ rect: { x: -1, y: 0, width: 1, height: 1 } }], 800, 600)).toThrow('control_layout_invalid');
    expect(() => createControlLayout([{ rect: { x: 0, y: 0, width: 800, height: 600 } }], 8193, 600)).toThrow('image_dimensions_invalid');
    expect(() => createControlLayout([{ rect: { x: 0, y: 0, width: 1, height: 1 } }], 4097, 4096)).toThrow('image_dimensions_invalid');
    expect(() => createControlLayout(Array.from({ length: 5 }, () => ({ rect: { x: 0, y: 0, width: 4096, height: 4096 } })), 4096, 4096)).toThrow('control_layout_limit');
  });

  it('合并同一行相邻 OCR 分词，不把中文或英文控件拆词误作未知', () => {
    const frame = syntheticFrame();
    const detection = syntheticDetection(frame, ['文件资源管理器', '此电脑', '名称', '修改日期', '类型', '大小']);
    const title = detection.words[0];
    detection.words.splice(0, 1, ...['文件', '资源', '管理器'].map((text, index) => ({ text, rect: { ...title.rect, x: 20 + index * 32, width: 30 } })));
    expect(evaluateLocalFrame(frame, detection)).toMatchObject({ decision: 'allow', scene: 'file_manager_controls' });
    detection.words[1].rect.y += 40;
    const unmerged = evaluateLocalFrame(frame, detection);
    expect(unmerged).toMatchObject({ decision: 'allow', scene: 'controls_only' });
    if (unmerged.decision !== 'allow') throw new Error('missing safe control layout');
    expect(unmerged.elements.some(element => element.label === '文件资源管理器')).toBe(false);
  });

  it.each(['密码', '验证码', '私人聊天', '付款确认', 'api_key sk-abcdefghijklmnopq', '13812345678', 'private@example.com'])('敏感文字本地拒绝：%s', text => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['设置', '显示', '文本大小', text]))).toMatchObject({ decision: 'pause', reason: 'sensitive_screen' });
  });

  it('拆词敏感内容、帧身份不符和人脸检测缺失都不能放行', () => {
    const frame = syntheticFrame();
    expect(evaluateLocalFrame(frame, syntheticDetection(frame, ['设置', '显示', '文本大小', '支', '付']))).toMatchObject({ decision: 'pause' });
    expect(evaluateLocalFrame(frame, { ...syntheticDetection(frame), frameHash: 'different' }).decision).toBe('pause');
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
