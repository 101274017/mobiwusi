import { validDrawing, type DrawingJob, type DrawingStroke } from '@nuanban/pet-engine';

export type DrawingJobEvent = { type: 'START' | 'SUCCEED' | 'FAIL' | 'CANCEL' | 'RETRY' | 'CONFIRM'; generation: number };
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
