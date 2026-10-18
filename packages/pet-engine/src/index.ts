export type PetAction = 'idle' | 'listening' | 'thinking' | 'speaking' | 'pointing' | 'celebrating' | 'concerned' | 'paused';
export { currentPet, applyPet, undoPet, validPet, samePet } from './appearance.ts';
export { inspectThreeDAsset, threeDBudgets, threeDSupportMatrix, validThreeDAsset } from './three-d.ts';
export type { ThreeDActionCompatibility, ThreeDAssetCandidate, ThreeDFormat, ThreeDFormatSupportSpec, ThreeDInspection, ThreeDMaterialKind, ThreeDPreflightCheck, ThreeDPreflightCode, ThreeDPreflightDisposition, ThreeDPreflightReport, ThreeDSkeletonKind, ThreeDTextureDimension } from './three-d.ts';
export interface PetManifest { version:'1'; source:'built-in-demo'; actions:PetAction[]; generated:false; }
export const builtinManifest: PetManifest = { version:'1',source:'built-in-demo',actions:['idle','listening','thinking','speaking','pointing','celebrating','concerned','paused'],generated:false };
export interface DrawingStroke { color: string; width: number; eraser: boolean; points: {x:number;y:number}[]; }
export interface DrawingPort { load():Promise<DrawingStroke[]|null>; save(strokes:DrawingStroke[]):Promise<void>; clear():Promise<void>; }
export type DrawingJobState = 'queued' | 'processing' | 'preview' | 'failed' | 'cancelled' | 'confirmed';
export interface DrawingJob {
  id: string;
  ownerId: string;
  state: DrawingJobState;
  generation: number;
  strokes: DrawingStroke[];
  source: 'simulation';
  generated: false;
  createdAt: string;
  updatedAt: string;
}
export interface DrawingJobPort {
  load(id: string): Promise<DrawingJob | null>;
  latest(): Promise<DrawingJob | null>;
  save(job: DrawingJob): Promise<void>;
  clear(): Promise<void>;
}
export type DrawingJobEvent = { type: 'START' | 'SUCCEED' | 'FAIL' | 'CANCEL' | 'RETRY' | 'CONFIRM'; generation: number };
export function validDrawing(strokes: DrawingStroke[]): boolean {
  if (!Array.isArray(strokes) || strokes.length > 2000) return false;
  let points = 0;
  for (const stroke of strokes) {
    if (!stroke || !/^#[\da-f]{6}$/i.test(stroke.color) || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 40 || typeof stroke.eraser !== 'boolean' || !Array.isArray(stroke.points)) return false;
    points += stroke.points.length;
    if (points > 100000 || !stroke.points.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 800 && point.y >= 0 && point.y <= 480)) return false;
  }
  return true;
}
export function createDrawingJob(id: string, ownerId: string, strokes: DrawingStroke[], now: string): DrawingJob {
  if (!validDrawing(strokes) || !strokes.some(stroke => !stroke.eraser && stroke.points.length)) throw new Error('先画一点内容，再演示任务流程。');
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !ownerId || !Number.isFinite(Date.parse(now))) throw new Error('演示任务信息无效。');
  return { id, ownerId, state: 'queued', generation: 0, strokes: structuredClone(strokes), source: 'simulation', generated: false, createdAt: now, updatedAt: now };
}
export function transitionDrawingJob(job: DrawingJob, event: DrawingJobEvent, now: string): DrawingJob {
  if (event.generation !== job.generation || !Number.isFinite(Date.parse(now))) return job;
  let state = job.state;
  let generation = job.generation;
  if (event.type === 'START' && state === 'queued') { state = 'processing'; generation++; }
  else if (event.type === 'SUCCEED' && state === 'processing') state = 'preview';
  else if (event.type === 'FAIL' && state === 'processing') state = 'failed';
  else if (event.type === 'CANCEL' && ['queued', 'processing', 'preview'].includes(state)) { state = 'cancelled'; generation++; }
  else if (event.type === 'RETRY' && ['failed', 'cancelled', 'processing'].includes(state)) { state = 'queued'; generation++; }
  else if (event.type === 'CONFIRM' && state === 'preview') { state = 'confirmed'; generation++; }
  else return job;
  return { ...job, state, generation, updatedAt: now };
}

export interface AnimatedPetLayer {
  id: string;
  kind: 'body' | 'eyes' | 'mouth' | 'accessory';
  source: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface AnimatedPetAction {
  frames: number[];
  durationMs: number;
  loop: boolean;
}

export interface AnimatedPetAssetManifest {
  version: '1';
  kind: 'animated_2d';
  source: 'generated_2d';
  generated: true;
  assetId: string;
  canvas: { width: number; height: number };
  decodedBytes: number;
  palette: string[];
  layers: AnimatedPetLayer[];
  actions: Record<PetAction, AnimatedPetAction>;
}

export type AnimatedPetQualityCode =
  | 'INVALID_MANIFEST'
  | 'INVALID_IDENTITY'
  | 'INVALID_CANVAS'
  | 'DECODED_MEMORY_LIMIT'
  | 'INVALID_PALETTE'
  | 'INVALID_LAYERS'
  | 'MISSING_LAYER'
  | 'EXTERNAL_ASSET_URI'
  | 'INVALID_LAYER_BOUNDS'
  | 'INVALID_ACTIONS'
  | 'MISSING_ACTION'
  | 'INVALID_KEYFRAMES';

export interface AnimatedPetQualityCheck {
  code: AnimatedPetQualityCode;
  passed: boolean;
  detail: string;
}

export interface AnimatedPetQualityReport {
  previewAllowed: boolean;
  publishEligible: false;
  manualReviewRequired: true;
  score: number;
  checks: AnimatedPetQualityCheck[];
  failureCodes: AnimatedPetQualityCode[];
}

const animatedPetActions: PetAction[] = ['idle', 'listening', 'thinking', 'speaking', 'pointing', 'celebrating', 'concerned', 'paused'];
const assetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assetLayerKinds = new Set<AnimatedPetLayer['kind']>(['body', 'eyes', 'mouth', 'accessory']);
const assetPath = /^assets\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\.(?:png|webp)$/i;

function assetRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assetKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.has(key));
}

function assetNumber(value: unknown, minimum: number, maximum: number, integer = false): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum && (!integer || Number.isInteger(value));
}

function qualityCheck(checks: AnimatedPetQualityCheck[], code: AnimatedPetQualityCode, passed: boolean, detail: string): void {
  checks.push({ code, passed, detail });
}

export function assessAnimatedPetAsset(value: unknown): AnimatedPetQualityReport {
  const checks: AnimatedPetQualityCheck[] = [];
  if (!assetRecord(value) || !assetKeys(value, ['version', 'kind', 'source', 'generated', 'assetId', 'canvas', 'decodedBytes', 'palette', 'layers', 'actions'])) {
    qualityCheck(checks, 'INVALID_MANIFEST', false, 'manifest 字段缺失或包含未知字段。');
    return { previewAllowed: false, publishEligible: false, manualReviewRequired: true, score: 0, checks, failureCodes: ['INVALID_MANIFEST'] };
  }
  const manifest = value;
  const failures = new Set<AnimatedPetQualityCode>();
  const check = (code: AnimatedPetQualityCode, passed: boolean, detail: string) => { qualityCheck(checks, code, passed, detail); if (!passed) failures.add(code); };
  const identityValid = manifest.version === '1' && manifest.kind === 'animated_2d' && manifest.source === 'generated_2d' && manifest.generated === true && typeof manifest.assetId === 'string' && assetUuid.test(manifest.assetId);
  check('INVALID_IDENTITY', identityValid, identityValid ? '生成资产身份字段有效。' : '只接受 generated_2d 且 generated=true 的 UUID 资产。');
  const canvas = manifest.canvas;
  const canvasRecord = assetRecord(canvas) ? canvas : null;
  const canvasValid = canvasRecord !== null && assetKeys(canvasRecord, ['width', 'height']) && assetNumber(canvasRecord.width, 1, 2048, true) && assetNumber(canvasRecord.height, 1, 2048, true);
  const canvasWidth = canvasRecord && typeof canvasRecord.width === 'number' ? canvasRecord.width : 0;
  const canvasHeight = canvasRecord && typeof canvasRecord.height === 'number' ? canvasRecord.height : 0;
  check('INVALID_CANVAS', canvasValid, canvasValid ? '画布尺寸在 2048px 上限内。' : '画布必须是 1～2048px 的整数尺寸。');
  const memoryValid = assetNumber(manifest.decodedBytes, 1, 64 * 1024 * 1024, true);
  check('DECODED_MEMORY_LIMIT', memoryValid, memoryValid ? '解码内存不超过 64MiB。' : '解码内存超过 64MiB 或不是安全整数。');
  const palette = manifest.palette;
  const paletteValid = Array.isArray(palette) && palette.length >= 1 && palette.length <= 16 && palette.every(color => typeof color === 'string' && /^#[a-f\d]{6}$/i.test(color));
  check('INVALID_PALETTE', paletteValid, paletteValid ? '配色数量和颜色格式有效。' : '配色必须是 1～16 个六位十六进制颜色。');
  const rawLayers = manifest.layers;
  const layerShapeValid = Array.isArray(rawLayers) && rawLayers.length >= 3 && rawLayers.length <= 32 && rawLayers.every(layer => assetRecord(layer) && assetKeys(layer, ['id', 'kind', 'source', 'rect']));
  check('INVALID_LAYERS', layerShapeValid, layerShapeValid ? '图层结构字段完整。' : '图层数量或字段不符合 manifest 约束。');
  const layers = layerShapeValid ? rawLayers as Record<string, unknown>[] : [];
  let layerIds = new Set<string>();
  let layerKinds = new Set<AnimatedPetLayer['kind']>();
  if (layerShapeValid) {
    layerIds = new Set(layers.map(layer => typeof layer.id === 'string' ? layer.id : ''));
    layerKinds = new Set(layers.map(layer => typeof layer.kind === 'string' && assetLayerKinds.has(layer.kind as AnimatedPetLayer['kind']) ? layer.kind as AnimatedPetLayer['kind'] : 'accessory'));
  }
  const requiredLayersPresent = layerShapeValid && layerIds.size === layers.length && ['body', 'eyes', 'mouth'].every(kind => layerKinds.has(kind as AnimatedPetLayer['kind']));
  check('MISSING_LAYER', requiredLayersPresent, requiredLayersPresent ? 'body、eyes、mouth 图层齐全且 ID 不重复。' : '缺少 body、eyes 或 mouth 图层，或图层 ID 重复。');
  const layerSourcesValid = layerShapeValid && layers.every(layer => typeof layer.source === 'string' && assetPath.test(layer.source) && !layer.source.includes('..') && !/^(?:https?:|data:|file:|asset:)/i.test(layer.source));
  check('EXTERNAL_ASSET_URI', layerSourcesValid, layerSourcesValid ? '图层只引用受控本地资源路径。' : '禁止外部 URI、data URI、file URI 或路径穿越。');
  const boundsValid = layerShapeValid && canvasValid && layers.every(layer => {
    const rect = layer.rect;
    const rectRecord = assetRecord(rect) ? rect : null;
    return rectRecord !== null && assetKeys(rectRecord, ['x', 'y', 'width', 'height']) && assetNumber(rectRecord.x, 0, canvasWidth, true) && assetNumber(rectRecord.y, 0, canvasHeight, true) && assetNumber(rectRecord.width, 1, canvasWidth, true) && assetNumber(rectRecord.height, 1, canvasHeight, true) && typeof rectRecord.x === 'number' && typeof rectRecord.y === 'number' && typeof rectRecord.width === 'number' && typeof rectRecord.height === 'number' && rectRecord.x + rectRecord.width <= canvasWidth && rectRecord.y + rectRecord.height <= canvasHeight;
  });
  check('INVALID_LAYER_BOUNDS', boundsValid, boundsValid ? '图层边界在画布内。' : '图层边界越界、为空或不是整数。');
  const actionRecord = assetRecord(manifest.actions) ? manifest.actions : null;
  const actions = actionRecord ?? {};
  const actionShapeValid = actionRecord !== null && animatedPetActions.every(action => Object.hasOwn(actionRecord, action)) && Object.keys(actionRecord).every(action => animatedPetActions.includes(action as PetAction)) && animatedPetActions.every(action => assetRecord(actionRecord[action]) && assetKeys(actionRecord[action] as Record<string, unknown>, ['frames', 'durationMs', 'loop']));
  check('INVALID_ACTIONS', actionShapeValid, actionShapeValid ? '动作集合只包含受支持状态且字段完整。' : '动作集合缺字段、含未知动作或包含额外动作。');
  const actionKeysValid = actionShapeValid && animatedPetActions.every(action => {
    const candidate = actions[action];
    if (!assetRecord(candidate)) return false;
    const frames = candidate.frames;
    return Array.isArray(frames) && frames.length >= 1 && frames.length <= 128 && frames.every(frame => assetNumber(frame, 0, 4095, true)) && assetNumber(candidate.durationMs, 16, 10000, true) && typeof candidate.loop === 'boolean';
  });
  check('MISSING_ACTION', actionKeysValid, actionKeysValid ? '八种桌宠状态均有至少一个关键帧。' : '动作关键帧、时长或循环标记无效。');
  check('INVALID_KEYFRAMES', actionKeysValid && layers.length > 0, actionKeysValid ? '关键帧引用通过结构校验，仍需视觉穿帮复核。' : '关键帧无法用于预览。');
  const passed = checks.every(item => item.passed);
  return { previewAllowed: passed, publishEligible: false, manualReviewRequired: true, score: checks.length === 0 ? 0 : checks.filter(item => item.passed).length / checks.length, checks, failureCodes: [...failures] };
}

export function validAnimatedPetAsset(value: unknown): value is AnimatedPetAssetManifest {
  return assessAnimatedPetAsset(value).previewAllowed;
}
