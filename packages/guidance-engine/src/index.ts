export interface Rect { x: number; y: number; width: number; height: number; }
export interface Size { width: number; height: number; }
export interface Point { x: number; y: number; }
export interface Insets { top: number; right: number; bottom: number; left: number; }
export type Rotation = 0 | 90 | 180 | 270;

export interface FrameContext {
  frameId: string;
  generation: number;
  displayId: string;
  windowId: string;
  transformId: string;
  layoutRevision: number;
  capturedAt: number;
  width: number;
  height: number;
  sourceSizePx: Size;
  contentRectPx: Rect;
  viewportRectPx: Rect;
  scaleFactor: number;
  rotation: Rotation;
}

export interface Target { frame: FrameContext; rect: Rect; expiresAt: number; }

export interface AndroidFrameInput {
  frameId: string;
  generation: number;
  displayId: string;
  windowId: string;
  transformId: string;
  layoutRevision: number;
  capturedAt: number;
  projectionSizePx: Size;
  contentRectPx?: Rect;
  systemInsetsPx: Insets;
  letterboxRectPx?: Rect | null;
  scaleFactor: number;
  rotation: Rotation;
}

export interface WindowsFrameInput {
  frameId: string;
  generation: number;
  displayId: string;
  windowId: string;
  transformId: string;
  layoutRevision: number;
  capturedAt: number;
  captureSizePx: Size;
  captureContentRectPx: Rect;
  displayOriginDip: Point;
  windowOriginDip: Point;
  contentOffsetDip: Point;
  contentSizeDip: Size;
  scaleFactor: number;
  rotation: Rotation;
}

export type TargetEvaluationCode = 'valid' | 'expired' | 'invalid_frame' | 'invalid_rect' | 'invalid_expiry' | 'stale_frame';

export interface TargetEvaluation {
  valid: boolean;
  code: TargetEvaluationCode;
  rect: Rect | null;
}

export type GuidanceTargetStatus = 'hidden' | 'visible' | 'verification_pending' | 'low_confidence';

export interface GuidanceTargetSnapshot {
  status: GuidanceTargetStatus;
  target: Target | null;
  reason: TargetEvaluationCode | 'cleared' | 'user_done' | null;
  verificationRequested: boolean;
}

export interface VerificationRequest {
  accepted: boolean;
  reason: 'user_done' | 'no_active_target';
}

export interface PointerObstacle { id: string; rect: Rect; }

export interface ChildPointerRequest {
  target: Target;
  currentFrame: FrameContext;
  start: Point;
  bounds: Rect;
  obstacles?: PointerObstacle[];
  margin?: number;
  now?: number;
}

export type ChildPointerStatus = 'ready' | 'expired' | 'stale' | 'unreachable';

export interface ChildPointerPlan {
  status: ChildPointerStatus;
  targetRect: Rect | null;
  dock: Point | null;
  path: Point[];
  reason: TargetEvaluationCode | 'outside_bounds' | 'no_safe_dock' | 'no_path' | null;
}

const EPSILON = 0.000001;

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}

function nonNegativeNumber(value: unknown): value is number {
  return finiteNumber(value) && value >= 0;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSize(value: unknown): value is Size {
  return Boolean(value) && typeof value === 'object' && positiveNumber((value as Size).width) && positiveNumber((value as Size).height);
}

function validPoint(value: unknown): value is Point {
  return Boolean(value) && typeof value === 'object'
    && finiteNumber((value as Point).x)
    && finiteNumber((value as Point).y);
}

function validRect(value: unknown): value is Rect {
  return Boolean(value) && typeof value === 'object'
    && finiteNumber((value as Rect).x)
    && finiteNumber((value as Rect).y)
    && positiveNumber((value as Rect).width)
    && positiveNumber((value as Rect).height);
}

function rectWithin(rect: Rect, bounds: Rect): boolean {
  return rect.x >= bounds.x - EPSILON
    && rect.y >= bounds.y - EPSILON
    && rect.x + rect.width <= bounds.x + bounds.width + EPSILON
    && rect.y + rect.height <= bounds.y + bounds.height + EPSILON;
}

function validInsets(value: unknown): value is Insets {
  return Boolean(value) && typeof value === 'object'
    && nonNegativeNumber((value as Insets).top)
    && nonNegativeNumber((value as Insets).right)
    && nonNegativeNumber((value as Insets).bottom)
    && nonNegativeNumber((value as Insets).left);
}

function validRotation(value: unknown): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

function sameRect(first: Rect, second: Rect): boolean {
  return first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height;
}

function sameSize(first: Size, second: Size): boolean {
  return first.width === second.width && first.height === second.height;
}

function projectionRect(size: Size): Rect {
  return { x: 0, y: 0, width: size.width, height: size.height };
}

function insetRect(rect: Rect, insets: Insets): Rect | null {
  const result = {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: rect.width - insets.left - insets.right,
    height: rect.height - insets.top - insets.bottom,
  };
  return validRect(result) ? result : null;
}

function intersectRects(first: Rect, second: Rect): Rect | null {
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const result = { x, y, width: right - x, height: bottom - y };
  return validRect(result) ? result : null;
}

function validNormalizedRect(rect: unknown): rect is Rect {
  return validRect(rect)
    && rect.x >= -EPSILON
    && rect.y >= -EPSILON
    && rect.x + rect.width <= 1 + EPSILON
    && rect.y + rect.height <= 1 + EPSILON;
}

function validFrameContext(context: unknown): context is FrameContext {
  if (!context || typeof context !== 'object') return false;
  const frame = context as FrameContext;
  if (!validSize(frame.sourceSizePx)) return false;
  const sourceBounds = projectionRect(frame.sourceSizePx);
  return nonEmptyText(frame.frameId)
    && Number.isSafeInteger(frame.generation) && frame.generation >= 0
    && nonEmptyText(frame.displayId)
    && nonEmptyText(frame.windowId)
    && nonEmptyText(frame.transformId)
    && Number.isSafeInteger(frame.layoutRevision) && frame.layoutRevision >= 0
    && finiteNumber(frame.capturedAt) && frame.capturedAt >= 0
    && positiveNumber(frame.width)
    && positiveNumber(frame.height)
    && frame.width === frame.sourceSizePx.width
    && frame.height === frame.sourceSizePx.height
    && validRect(frame.contentRectPx)
    && rectWithin(frame.contentRectPx, sourceBounds)
    && validRect(frame.viewportRectPx)
    && positiveNumber(frame.scaleFactor)
    && validRotation(frame.rotation);
}

function sameFrameIdentity(first: FrameContext, second: FrameContext): boolean {
  return first.frameId === second.frameId
    && first.generation === second.generation
    && first.displayId === second.displayId
    && first.windowId === second.windowId
    && first.transformId === second.transformId
    && first.layoutRevision === second.layoutRevision
    && first.width === second.width
    && first.height === second.height
    && sameSize(first.sourceSizePx, second.sourceSizePx)
    && sameRect(first.contentRectPx, second.contentRectPx)
    && sameRect(first.viewportRectPx, second.viewportRectPx)
    && first.scaleFactor === second.scaleFactor
    && first.rotation === second.rotation;
}

function rotateRect(rect: Rect, contentSize: Size, rotation: Rotation): Rect {
  if (rotation === 0) return { ...rect };
  if (rotation === 90) return {
    x: contentSize.height - rect.y - rect.height,
    y: rect.x,
    width: rect.height,
    height: rect.width,
  };
  if (rotation === 180) return {
    x: contentSize.width - rect.x - rect.width,
    y: contentSize.height - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
  return {
    x: rect.y,
    y: contentSize.width - rect.x - rect.width,
    width: rect.height,
    height: rect.width,
  };
}

function rotatedSize(size: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270 ? { width: size.height, height: size.width } : { ...size };
}

function scaleInto(rect: Rect, sourceSize: Size, destination: Rect): Rect {
  return {
    x: destination.x + (rect.x / sourceSize.width) * destination.width,
    y: destination.y + (rect.y / sourceSize.height) * destination.height,
    width: (rect.width / sourceSize.width) * destination.width,
    height: (rect.height / sourceSize.height) * destination.height,
  };
}

export function createAndroidFrameContext(input: AndroidFrameInput): FrameContext {
  if (!validSize(input.projectionSizePx) || !validInsets(input.systemInsetsPx) || !validRotation(input.rotation)) {
    throw new RangeError('Android 投影尺寸、系统 inset 或旋转无效');
  }
  const projection = projectionRect(input.projectionSizePx);
  const safeArea = insetRect(projection, input.systemInsetsPx);
  if (!safeArea) throw new RangeError('Android 系统 inset 已耗尽投影区域');
  const content = input.contentRectPx ?? safeArea;
  if (!validRect(content) || !rectWithin(content, safeArea)) throw new RangeError('Android content rect 超出安全内容区域');
  const viewport = input.letterboxRectPx ? intersectRects(safeArea, input.letterboxRectPx) : safeArea;
  if (!viewport) throw new RangeError('Android letterbox 与安全内容区域没有交集');
  return {
    frameId: input.frameId,
    generation: input.generation,
    displayId: input.displayId,
    windowId: input.windowId,
    transformId: input.transformId,
    layoutRevision: input.layoutRevision,
    capturedAt: input.capturedAt,
    width: input.projectionSizePx.width,
    height: input.projectionSizePx.height,
    sourceSizePx: { ...input.projectionSizePx },
    contentRectPx: { ...content },
    viewportRectPx: { ...viewport },
    scaleFactor: input.scaleFactor,
    rotation: input.rotation,
  };
}

export function createWindowsFrameContext(input: WindowsFrameInput): FrameContext {
  if (!validSize(input.captureSizePx) || !validRect(input.captureContentRectPx) || !rectWithin(input.captureContentRectPx, projectionRect(input.captureSizePx))) {
    throw new RangeError('Windows 捕获内容区域无效');
  }
  if (!validPoint(input.displayOriginDip) || !validPoint(input.windowOriginDip) || !validPoint(input.contentOffsetDip) || !validSize(input.contentSizeDip) || !positiveNumber(input.scaleFactor) || !validRotation(input.rotation)) {
    throw new RangeError('Windows 内容尺寸、缩放或旋转无效');
  }
  const originDip = {
    x: input.displayOriginDip.x + input.windowOriginDip.x + input.contentOffsetDip.x,
    y: input.displayOriginDip.y + input.windowOriginDip.y + input.contentOffsetDip.y,
  };
  const viewportRectPx = {
    x: originDip.x * input.scaleFactor,
    y: originDip.y * input.scaleFactor,
    width: input.contentSizeDip.width * input.scaleFactor,
    height: input.contentSizeDip.height * input.scaleFactor,
  };
  if (!validRect(viewportRectPx)) throw new RangeError('Windows 物理窗口区域无效');
  return {
    frameId: input.frameId,
    generation: input.generation,
    displayId: input.displayId,
    windowId: input.windowId,
    transformId: input.transformId,
    layoutRevision: input.layoutRevision,
    capturedAt: input.capturedAt,
    width: input.captureSizePx.width,
    height: input.captureSizePx.height,
    sourceSizePx: { ...input.captureSizePx },
    contentRectPx: { ...input.captureContentRectPx },
    viewportRectPx,
    scaleFactor: input.scaleFactor,
    rotation: input.rotation,
  };
}

export function mapRect(rect: Rect, content: Rect): Rect {
  if (!validNormalizedRect(rect) || !validRect(content)) throw new RangeError('归一化目标或内容区域无效');
  return {
    x: content.x + rect.x * content.width,
    y: content.y + rect.y * content.height,
    width: rect.width * content.width,
    height: rect.height * content.height,
  };
}

export function mapFrameRect(rect: Rect, frame: FrameContext): Rect | null {
  if (!validNormalizedRect(rect) || !validFrameContext(frame)) return null;
  const contentSize = { width: frame.contentRectPx.width, height: frame.contentRectPx.height };
  const contentRect = mapRect(rect, { x: 0, y: 0, width: contentSize.width, height: contentSize.height });
  const rotatedRect = rotateRect(contentRect, contentSize, frame.rotation);
  return scaleInto(rotatedRect, rotatedSize(contentSize, frame.rotation), frame.viewportRectPx);
}

export function evaluateTarget(target: Target, current: FrameContext, now = Date.now()): TargetEvaluation {
  if (!validFrameContext(target?.frame) || !validFrameContext(current)) return { valid: false, code: 'invalid_frame', rect: null };
  if (!validNormalizedRect(target.rect)) return { valid: false, code: 'invalid_rect', rect: null };
  if (!finiteNumber(target.expiresAt)) return { valid: false, code: 'invalid_expiry', rect: null };
  if (!finiteNumber(now) || target.expiresAt <= now) return { valid: false, code: 'expired', rect: null };
  if (!sameFrameIdentity(target.frame, current)) return { valid: false, code: 'stale_frame', rect: null };
  return { valid: true, code: 'valid', rect: mapFrameRect(target.rect, current) };
}

export function validateTarget(target: Target, current: FrameContext, now = Date.now()): boolean {
  const evaluation = evaluateTarget(target, current, now);
  return evaluation.valid && evaluation.rect !== null;
}

export function mapTargetRect(target: Target, current: FrameContext, now = Date.now()): Rect | null {
  const evaluation = evaluateTarget(target, current, now);
  return evaluation.valid ? evaluation.rect : null;
}

export class GuidanceTargetLifecycle {
  private state: GuidanceTargetSnapshot = { status: 'hidden', target: null, reason: null, verificationRequested: false };

  snapshot(): GuidanceTargetSnapshot {
    return {
      status: this.state.status,
      target: this.state.target,
      reason: this.state.reason,
      verificationRequested: this.state.verificationRequested,
    };
  }

  publish(target: Target, now = Date.now()): GuidanceTargetSnapshot {
    const evaluation = evaluateTarget(target, target.frame, now);
    if (!evaluation.valid) {
      this.state = { status: 'low_confidence', target: null, reason: evaluation.code, verificationRequested: false };
      return this.snapshot();
    }
    this.state = { status: 'visible', target, reason: null, verificationRequested: false };
    return this.snapshot();
  }

  observeFrame(current: FrameContext, now = Date.now()): GuidanceTargetSnapshot {
    if (!this.state.target) return this.snapshot();
    const evaluation = evaluateTarget(this.state.target, current, now);
    if (!evaluation.valid) {
      this.state = { status: 'low_confidence', target: null, reason: evaluation.code, verificationRequested: false };
    }
    return this.snapshot();
  }

  requestVerification(): VerificationRequest {
    if (this.state.status !== 'visible' || !this.state.target) return { accepted: false, reason: 'no_active_target' };
    this.state = { ...this.state, status: 'verification_pending', verificationRequested: true, reason: 'user_done' };
    return { accepted: true, reason: 'user_done' };
  }

  clear(): GuidanceTargetSnapshot {
    this.state = { status: 'hidden', target: null, reason: 'cleared', verificationRequested: false };
    return this.snapshot();
  }
}

function pointInsideOpenRect(point: Point, rect: Rect): boolean {
  return point.x > rect.x + EPSILON
    && point.x < rect.x + rect.width - EPSILON
    && point.y > rect.y + EPSILON
    && point.y < rect.y + rect.height - EPSILON;
}

function segmentCrossesInterior(first: Point, second: Point, rect: Rect): boolean {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  const times = [0, 1];
  if (Math.abs(deltaX) > EPSILON) {
    times.push((rect.x - first.x) / deltaX, (rect.x + rect.width - first.x) / deltaX);
  }
  if (Math.abs(deltaY) > EPSILON) {
    times.push((rect.y - first.y) / deltaY, (rect.y + rect.height - first.y) / deltaY);
  }
  const ordered = [...new Set(times.filter(value => value >= 0 && value <= 1).sort((firstTime, secondTime) => firstTime - secondTime))];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const startTime = ordered[index];
    const endTime = ordered[index + 1];
    if (endTime - startTime <= EPSILON) continue;
    const middleTime = (startTime + endTime) / 2;
    const middle = { x: first.x + deltaX * middleTime, y: first.y + deltaY * middleTime };
    if (pointInsideOpenRect(middle, rect)) return true;
  }
  return pointInsideOpenRect(first, rect) || pointInsideOpenRect(second, rect);
}

function inflateRect(rect: Rect, amount: number): Rect {
  return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
}

function pointWithinBounds(point: Point, bounds: Rect, margin: number): boolean {
  return point.x >= bounds.x + margin
    && point.y >= bounds.y + margin
    && point.x <= bounds.x + bounds.width - margin
    && point.y <= bounds.y + bounds.height - margin;
}

function pointBlocked(point: Point, blockers: Rect[]): boolean {
  return blockers.some(blocker => pointInsideOpenRect(point, blocker));
}

function safeDockCandidates(target: Rect, bounds: Rect, blockers: Rect[], margin: number): Point[] {
  const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const horizontalOffset = target.width / 2 + margin;
  const verticalOffset = target.height / 2 + margin;
  const candidates = [
    { x: center.x - horizontalOffset, y: center.y },
    { x: center.x + horizontalOffset, y: center.y },
    { x: center.x, y: center.y - verticalOffset },
    { x: center.x, y: center.y + verticalOffset },
    { x: center.x - horizontalOffset, y: center.y - verticalOffset },
    { x: center.x + horizontalOffset, y: center.y - verticalOffset },
    { x: center.x - horizontalOffset, y: center.y + verticalOffset },
    { x: center.x + horizontalOffset, y: center.y + verticalOffset },
  ];
  return candidates.filter(candidate => pointWithinBounds(candidate, bounds, 0) && !pointBlocked(candidate, blockers));
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function pathBetween(start: Point, dock: Point, blockers: Rect[]): Point[] | null {
  const nodes: Point[] = [{ ...start }, { ...dock }];
  for (const blocker of blockers) {
    const gap = 1;
    nodes.push(
      { x: blocker.x - gap, y: blocker.y - gap },
      { x: blocker.x + blocker.width + gap, y: blocker.y - gap },
      { x: blocker.x - gap, y: blocker.y + blocker.height + gap },
      { x: blocker.x + blocker.width + gap, y: blocker.y + blocker.height + gap },
    );
  }
  const neighbours = nodes.map(() => [] as Array<{ index: number; weight: number }>);
  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      if (blockers.some(blocker => segmentCrossesInterior(nodes[firstIndex], nodes[secondIndex], blocker))) continue;
      const weight = distance(nodes[firstIndex], nodes[secondIndex]);
      neighbours[firstIndex].push({ index: secondIndex, weight });
      neighbours[secondIndex].push({ index: firstIndex, weight });
    }
  }
  const costs = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = nodes.map(() => false);
  costs[0] = 0;
  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    let currentIndex = -1;
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
      if (!visited[nodeIndex] && (currentIndex === -1 || costs[nodeIndex] < costs[currentIndex])) currentIndex = nodeIndex;
    }
    if (currentIndex === -1 || !Number.isFinite(costs[currentIndex])) break;
    visited[currentIndex] = true;
    for (const neighbour of neighbours[currentIndex]) {
      const candidateCost = costs[currentIndex] + neighbour.weight;
      if (candidateCost < costs[neighbour.index]) {
        costs[neighbour.index] = candidateCost;
        previous[neighbour.index] = currentIndex;
      }
    }
  }
  if (!Number.isFinite(costs[1])) return null;
  const path: Point[] = [];
  for (let currentIndex = 1; currentIndex >= 0; currentIndex = previous[currentIndex]) {
    path.unshift(nodes[currentIndex]);
    if (currentIndex === 0) break;
  }
  return path.length >= 2 && path[0] && path[path.length - 1] ? path : null;
}

export function planChildPointer(request: ChildPointerRequest): ChildPointerPlan {
  const now = request.now ?? Date.now();
  const evaluation = evaluateTarget(request.target, request.currentFrame, now);
  if (evaluation.code === 'expired') return { status: 'expired', targetRect: null, dock: null, path: [], reason: evaluation.code };
  if (evaluation.code === 'stale_frame') return { status: 'stale', targetRect: null, dock: null, path: [], reason: evaluation.code };
  if (!evaluation.valid || !evaluation.rect) return { status: 'unreachable', targetRect: null, dock: null, path: [], reason: evaluation.code };
  if (!validRect(request.bounds) || !validPoint(request.start) || !rectWithin(evaluation.rect, request.bounds) || !pointWithinBounds(request.start, request.bounds, 0)) {
    return { status: 'unreachable', targetRect: evaluation.rect, dock: null, path: [], reason: 'outside_bounds' };
  }
  const margin = request.margin ?? 16;
  if (!positiveNumber(margin)) return { status: 'unreachable', targetRect: evaluation.rect, dock: null, path: [], reason: 'no_safe_dock' };
  const blockers = [
    inflateRect(evaluation.rect, margin / 2),
    ...(request.obstacles ?? []).filter(obstacle => validRect(obstacle.rect)).map(obstacle => inflateRect(obstacle.rect, margin / 2)),
  ];
  const candidates = safeDockCandidates(evaluation.rect, request.bounds, blockers, margin);
  const ranked = candidates.sort((first, second) => distance(request.start, first) - distance(request.start, second));
  for (const candidate of ranked) {
    const path = pathBetween(request.start, candidate, blockers);
    if (path) return { status: 'ready', targetRect: evaluation.rect, dock: candidate, path, reason: null };
  }
  return { status: 'unreachable', targetRect: evaluation.rect, dock: null, path: [], reason: candidates.length ? 'no_path' : 'no_safe_dock' };
}
