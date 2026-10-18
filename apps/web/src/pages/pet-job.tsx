import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, RotateCcw, Square } from 'lucide-react';
import { transitionDrawingJob, type DrawingJob, type DrawingJobEvent } from '@nuanban/pet-engine';
import { drawingJobService } from '../composition';
import { Badge, Empty, PageTitle } from '../components';

const stateNames = { queued: '等待你启动演示', processing: '模拟任务处理中', preview: '演示预览就绪 · 仅原画', failed: '模拟生成失败 · 画稿保留', cancelled: '演示任务已取消', confirmed: '已确认保留演示预览' };

function DrawingPreview({ job }: { job: DrawingJob }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 800, 480);
    for (const stroke of job.strokes) {
      if (!stroke.points.length) continue;
      context.beginPath();
      context.strokeStyle = stroke.eraser ? '#ffffff' : stroke.color;
      context.lineWidth = stroke.width;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points) context.lineTo(point.x, point.y);
      if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y);
      context.stroke();
    }
  }, [job.strokes]);
  return <figure className="drawing-job-preview"><canvas ref={canvas} width={800} height={480} aria-label="原始画稿静态预览，不是 AI 生成的可动桌宠" /><figcaption>这是你的原始画稿，不是 AI 生成结果。</figcaption></figure>;
}

export function PetJobPage() {
  const { id } = useParams();
  const [job, setJob] = useState<DrawingJob | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<'success' | 'failure'>('success');
  const [stored, setStored] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<DrawingJob | null>(null);
  const queue = useRef(Promise.resolve());
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    setReady(false);
    setRunning(false);
    current.current = null;
    let cancelled = false;
    void drawingJobService.load(id ?? '').then(value => {
      if (cancelled) return;
      current.current = value;
      setJob(value);
      setReady(true);
    }).catch(() => { if (!cancelled) { setError('演示任务读取失败，请刷新重试。原始画稿不会被替换。'); setReady(true); } });
    return () => { cancelled = true; alive.current = false; };
  }, [id]);

  async function persist(next: DrawingJob): Promise<boolean> {
    setStored(false);
    setError(null);
    const operation = queue.current.then(() => drawingJobService.save(next));
    queue.current = operation.catch(() => undefined);
    try {
      await operation;
      if (alive.current && current.current === next) setStored(true);
      return alive.current && current.current === next;
    } catch {
      if (alive.current) setError('任务状态未保存，请重试保存；原始画稿仍保留，不会替换当前桌宠。');
      return false;
    }
  }

  async function update(type: DrawingJobEvent['type'], generation?: number): Promise<boolean> {
    const previous = current.current;
    if (!previous || !alive.current) return false;
    const next = transitionDrawingJob(previous, { type, generation: generation ?? previous.generation }, new Date().toISOString());
    if (next === previous) return false;
    current.current = next;
    setJob(next);
    return persist(next);
  }

  useEffect(() => {
    const stop = () => { setRunning(false); void update('CANCEL'); };
    window.addEventListener('nuanban:stop', stop);
    return () => window.removeEventListener('nuanban:stop', stop);
  }, []);
  useEffect(() => {
    if (!running || job?.state !== 'processing') return;
    const generation = job.generation;
    const timer = setTimeout(() => { setRunning(false); void update(outcome === 'success' ? 'SUCCEED' : 'FAIL', generation); }, 900);
    return () => clearTimeout(timer);
  }, [running, job?.state, job?.generation, outcome]);

  if (!ready) return <p>正在读取本机演示任务…</p>;
  if (!job) return <Empty title="演示任务不存在或无法读取" description={error ?? '任务可能已被清理。不会自动创建替代结果，也不会更换当前桌宠。'}><Link className="button primary" to="/pets/draw">返回原始画稿</Link></Empty>;

  return <>
    <Link className="back-link" to="/pets/draw" aria-label="返回原始画稿">‹ 返回原始画稿</Link>
    <PageTitle eyebrow="B03 · 只演示任务状态" title="画稿任务流程演示" subtitle="没有调用生成供应商，不产出可动资产。确认只保留这份模拟流程结果，不替换正在使用的桌宠。"><Badge>Mock · generated: false</Badge></PageTitle>
    <div className="drawing-job-layout"><section className="panel"><DrawingPreview job={job} /></section><section className="panel drawing-job-controls" aria-label="画稿任务状态">
      <h2 aria-live="polite">{stateNames[job.state]}</h2><p>{stored ? '本机状态已保存，刷新后可继续。' : '正在保存本机状态…'}</p>
      {error && <div className="inline-error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => void persist(job)}>重试保存任务状态</button></div>}
      {job.state === 'queued' && <><label className="form-stack">演示结果<select aria-label="演示结果" value={outcome} onChange={event => setOutcome(event.target.value as 'success' | 'failure')}><option value="success">模拟成功，仅预览原画</option><option value="failure">模拟失败，保留草稿</option></select></label><button className="button primary" disabled={!stored} onClick={async () => { if (await update('START')) setRunning(true); }}>开始模拟处理</button></>}
      {job.state === 'processing' && !running && stored && <><p>上次处理未完成。不会在刷新后自动启动，请明确重新排队。</p><button className="button secondary" onClick={() => void update('RETRY')}>重新排队，不自动启动</button></>}
      {job.state === 'processing' && running && <p>正在演示等待过程，可以随时取消。</p>}
      {job.state === 'preview' && <><p>这里只展示原始画稿；手绘生成资产的微调尚未接入。可以另行微调内置演示伙伴，但它不是这份画稿的产物。</p><Link className="button secondary" to="/pets">微调内置伙伴（非本画稿）</Link><button className="button primary" disabled={!stored} onClick={() => void update('CONFIRM')}><Check size={18} />确认保留演示预览</button></>}
      {['failed', 'cancelled'].includes(job.state) && <><p>原始画稿仍在本机，当前桌宠未改变。</p><button className="button secondary" disabled={!stored} onClick={() => void update('RETRY')}><RotateCcw size={18} />重新排队，不自动启动</button></>}
      {['queued', 'processing', 'preview'].includes(job.state) && <button className="button stop-outline" onClick={() => { setRunning(false); void update('CANCEL'); }}><Square size={16} />取消本次演示任务</button>}
      {job.state === 'confirmed' && <p>你已确认保留这份演示预览。没有生成可动桌宠，当前桌宠未替换。</p>}
      <Link className="button plain" to="/pets/draw">继续修改原始画稿</Link>
    </section></div>
  </>;
}
