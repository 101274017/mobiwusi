import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { validDrawing, type DrawingJob, type DrawingStroke } from '@nuanban/pet-engine';
import { createDrawingJob, transitionDrawingJob } from '../fixtures/drawing-job';
import { IndexedDbDrawing, IndexedDbDrawingJobs, IndexedDbRepository } from '@nuanban/local-data';
import { createScenarioSnapshot } from '../fixtures/business-scenarios';

const now = '2026-10-15T01:00:00.000Z';
const strokes: DrawingStroke[] = [{ color: '#A64B2A', width: 9, eraser: false, points: [{ x: 40, y: 70 }] }];
function job(): DrawingJob { return createDrawingJob('demo-job', 'demo-owner', strokes, now); }
afterEach(() => vi.unstubAllGlobals());

describe('画稿任务纯状态机', () => {
  it('复制原画且始终明确为模拟，不产生可动资产', () => {
    const created = job();
    expect(created.source).toBe('simulation');
    expect(created.generated).toBe(false);
    expect(created.strokes).toEqual(strokes);
    expect(created.strokes).not.toBe(strokes);
  });
  it('只有完成预览并明确确认才进入已确认状态', () => {
    const created = job();
    expect(transitionDrawingJob(created, { type: 'CONFIRM', generation: 0 }, now)).toBe(created);
    const processing = transitionDrawingJob(created, { type: 'START', generation: 0 }, now);
    const preview = transitionDrawingJob(processing, { type: 'SUCCEED', generation: processing.generation }, now);
    const confirmed = transitionDrawingJob(preview, { type: 'CONFIRM', generation: preview.generation }, now);
    expect(confirmed.state).toBe('confirmed');
    expect(confirmed.generated).toBe(false);
    expect(transitionDrawingJob(confirmed, { type: 'CANCEL', generation: confirmed.generation }, now)).toBe(confirmed);
  });
  it.each(['CANCEL', 'FAIL'] as const)('%s 保留草稿，可重排但不自动处理', type => {
    const processing = transitionDrawingJob(job(), { type: 'START', generation: 0 }, now);
    const stopped = transitionDrawingJob(processing, { type, generation: processing.generation }, now);
    expect(stopped.strokes).toEqual(strokes);
    const retried = transitionDrawingJob(stopped, { type: 'RETRY', generation: stopped.generation }, now);
    expect(retried.state).toBe('queued');
    expect(retried.generation).toBeGreaterThan(processing.generation);
  });
  it('取消后迟到成功不能复活任务', () => {
    const processing = transitionDrawingJob(job(), { type: 'START', generation: 0 }, now);
    const cancelled = transitionDrawingJob(processing, { type: 'CANCEL', generation: processing.generation }, now);
    expect(transitionDrawingJob(cancelled, { type: 'SUCCEED', generation: processing.generation }, now)).toBe(cancelled);
  });
  it('空画、越界点、无效颜色和过量内容被拒绝', () => {
    expect(() => createDrawingJob('job', 'owner', [], now)).toThrow('先画一点');
    expect(validDrawing([{ ...strokes[0], color: 'url(https://invalid)' }])).toBe(false);
    expect(validDrawing([{ ...strokes[0], points: [{ x: NaN, y: 70 }] }])).toBe(false);
    expect(validDrawing([{ ...strokes[0], points: [{ x: 900, y: 70 }] }])).toBe(false);
    expect(validDrawing(Array.from({ length: 2001 }, () => strokes[0]))).toBe(false);
  });
});

describe('任务持久化和升级', () => {
  it('任务刷新可读取，但不能跨账号读取、写入或清理', async () => {
    const owner = crypto.randomUUID();
    const other = crypto.randomUUID();
    const first = new IndexedDbDrawingJobs(owner);
    const second = new IndexedDbDrawingJobs(other);
    const created = createDrawingJob('job-test', owner, strokes, now);
    await first.save(created);
    expect(await new IndexedDbDrawingJobs(owner).latest()).toEqual(created);
    expect(await second.load(created.id)).toBeNull();
    await expect(second.save(created)).rejects.toThrow('无效');
    await second.clear();
    expect(await first.load(created.id)).toEqual(created);
    await first.clear();
    expect(await first.latest()).toBeNull();
    expect(await first.load(created.id)).toBeNull();
  });
  it('v2 升级保留已有账号与画稿，新增任务仓储', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const snapshot = createScenarioSnapshot('migration-owner', 'success');
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('nuanban-demo-v1', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('accounts').put(snapshot, 'migration-owner');
        request.result.createObjectStore('drafts').put(strokes, 'migration-owner');
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    expect(await new IndexedDbDrawing('migration-owner').load()).toEqual(strokes);
    expect(await new IndexedDbRepository().load('migration-owner')).toEqual(snapshot);
    const tasks = new IndexedDbDrawingJobs('migration-owner');
    const created = createDrawingJob('job-migrated', 'migration-owner', strokes, now);
    await tasks.save(created);
    expect(await tasks.load(created.id)).toEqual(created);
  });
});
