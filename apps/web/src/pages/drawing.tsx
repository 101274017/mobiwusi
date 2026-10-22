import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Eraser, Eye, PawPrint, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { validDrawing, type DrawingStroke } from '@nuanban/pet-engine';
import { drawingService } from '../composition';
import { announce } from '../store';
import { Modal, PageTitle } from '../components';
import { drawingHeight, drawingWidth, paintDrawing, renderDrawingArtwork } from '../drawing-artwork';
import { localArtworkBridge, type DrawingArtwork, type LocalArtwork } from '../local-artwork';
import { showBrowserCompanion } from '../browser-companion';
import './drawing.css';

const colors = [['#A64B2A', '暖棕'], ['#6C8172', '草绿'], ['#D5A134', '金黄'], ['#4C7493', '天空蓝'], ['#2D2521', '深棕']];

export function DrawingPage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<DrawingStroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const busyRef = useRef(false);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [color, setColor] = useState('#A64B2A');
  const [width, setWidth] = useState(9);
  const [eraser, setEraser] = useState(false);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [preview, setPreview] = useState<DrawingArtwork | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [currentArtwork, setCurrentArtwork] = useState<LocalArtwork | null>(null);
  const [artworkError, setArtworkError] = useState('');
  const bridge = localArtworkBridge();
  const hasInk = strokes.some(stroke => !stroke.eraser && stroke.points.length > 0);

  useEffect(() => {
    let alive = true;
    void drawingService.load().then(value => {
      if (!alive) return;
      if (value && !validDrawing(value)) throw new Error('已保存的画稿格式无效，未自动使用。');
      setStrokes(value ?? []);
      setSaved(Boolean(value));
      setReady(true);
    }).catch(error => {
      if (!alive) return;
      announce(error instanceof Error ? error.message : '画稿读取失败，可以重新画一张。');
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    let changed = false;
    const unsubscribe = bridge.onChanged(artwork => {
      changed = true;
      if (alive) { setCurrentArtwork(artwork); setArtworkError(''); }
    });
    void bridge.read().then(artwork => { if (alive && !changed) setCurrentArtwork(artwork); })
      .catch(() => { if (alive && !changed) setArtworkError('当前桌宠原画读取失败，可以重新预览并应用。'); });
    return () => { alive = false; unsubscribe(); };
  }, [bridge]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context) paintDrawing(context, strokes);
  }, [strokes]);

  async function perform(operation: () => Promise<void>, onFailure?: (message: string) => void) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await operation(); }
    catch (error) {
      const message = error instanceof Error ? error.message : '操作未完成，原画稿仍保留，请重试。';
      onFailure?.(message);
      announce(message);
    }
    finally { busyRef.current = false; setBusy(false); }
  }

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(drawingWidth, (event.clientX - bounds.left) / bounds.width * drawingWidth)),
      y: Math.max(0, Math.min(drawingHeight, (event.clientY - bounds.top) / bounds.height * drawingHeight)) };
  }

  function begin(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!ready || busyRef.current || activeStroke.current || event.button !== 0) return;
    if (strokes.length >= 2000 || strokes.reduce((total, stroke) => total + stroke.points.length, 0) >= 100000) {
      announce('画稿笔画较多，请撤销部分笔画后继续。');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    activeStroke.current = { color, width, eraser, points: [point(event)] };
    setSaved(false);
    const context = canvas.current?.getContext('2d');
    if (context) paintDrawing(context, [...strokes, activeStroke.current]);
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = activeStroke.current;
    if (!stroke || activePointer.current !== event.pointerId || stroke.points.length >= 10000) return;
    if (strokes.reduce((total, existing) => total + existing.points.length, 0) + stroke.points.length >= 100000) return;
    stroke.points.push(point(event));
    const context = canvas.current?.getContext('2d');
    if (context) paintDrawing(context, [...strokes, stroke]);
  }

  function finish(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeStroke.current || activePointer.current !== event.pointerId) return;
    const completed = activeStroke.current;
    activeStroke.current = null;
    activePointer.current = null;
    setStrokes(previous => [...previous, completed]);
  }

  function save() {
    void perform(async () => {
      if (!validDrawing(strokes)) throw new Error('画稿格式无效，请减少笔画后重试。');
      await drawingService.save(strokes);
      setSaved(true);
      announce('原始画稿已保存在本机，可以预览并直接设为桌宠，无需 AI。');
    });
  }

  function showPreview() {
    void perform(async () => {
      const original = await drawingService.load();
      if (!original) throw new Error('请先保存原画，再打开预览。');
      setPreview(renderDrawingArtwork(original));
      setPreviewError('');
    });
  }

  function apply() {
    setPreviewError('');
    void perform(async () => {
      if (!preview) throw new Error('请先打开原画预览。');
      if (!bridge) {
        showBrowserCompanion({ kind: 'drawing', label: '你的原画', imageUrl: preview.dataUrl });
        setPreview(null);
        announce('你的原画已显示在当前页面；系统悬浮桌宠仍需使用 Windows 客户端。');
        return;
      }
      const artwork = await bridge.apply(preview);
      if (artwork.kind !== 'drawing') throw new Error('桌宠未确认替换成功，原画稿仍保留。');
      setCurrentArtwork(artwork);
      setPreview(null);
      setArtworkError('');
      announce('已直接设为桌宠，独立悬浮窗口已切换为你的原画。全程本地处理，未调用 AI。');
    }, setPreviewError);
  }

  function restore() {
    void perform(async () => {
      if (!bridge) return;
      const artwork = await bridge.clear();
      if (artwork.kind !== 'builtin') throw new Error('尚未确认恢复成功，请重试。');
      setCurrentArtwork(artwork);
      setArtworkError('');
      announce('已恢复内置桌宠，你保存的原画稿仍保留。');
    });
  }

  return <>
    <Link className="back-link" to="/pets">‹ 返回我的小伙伴</Link>
    <PageTitle eyebrow="把自己的小想象，留在这里" title="画一画，我的小伙伴" subtitle="原画保存在本机。保存、预览、亲手确认，就能直接作为桌宠形象，不需要 AI。" />
    <ol className="drawing-flow" aria-label="原画桌宠使用流程"><li><span>01</span>保存原画</li><li><span>02</span>预览形象</li><li><span>03</span>直接设为桌宠</li></ol>
    <section className="panel drawing-panel">
      <div className="drawing-tools"><div className="drawing-colors">
        {colors.map(([value, label]) => <button key={value} className={'color-swatch ' + (color === value && !eraser ? 'selected' : '')} aria-label={label + '画笔'} aria-pressed={color === value && !eraser} disabled={busy} style={{ backgroundColor: value }} onClick={() => { setColor(value); setEraser(false); }} />)}
        <label className="sr-only" htmlFor="brush-width">画笔粗细</label><select id="brush-width" disabled={busy} value={width} onChange={event => setWidth(Number(event.target.value))}><option value={5}>细画笔</option><option value={9}>中画笔</option><option value={18}>粗画笔</option></select>
      </div><div>
        <button className={'tool-button ' + (eraser ? 'active' : '')} disabled={busy} aria-pressed={eraser} onClick={() => setEraser(!eraser)}><Eraser size={20} />橡皮</button>
        <button className="tool-button" disabled={busy || !strokes.length} onClick={() => { setStrokes(previous => previous.slice(0, -1)); setSaved(false); }}><Undo2 size={20} />撤销</button>
        <button className="tool-button" disabled={busy} onClick={() => setClearConfirm(true)}><Trash2 size={18} />清画布</button>
      </div></div>
      <canvas ref={canvas} width={drawingWidth} height={drawingHeight} className="drawing-canvas" aria-label="绘画画布，使用手指或鼠标绘画。无法绘画时可选择内置桌宠。" onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
      <div className="drawing-bottom"><p>{saved ? '✓ 原画已保存，刷新后仍可继续。' : '画一只猫，或一个你喜欢的小伙伴。'}<br /><span>先保存再预览；修改画作后请重新保存。</span></p>
        <button className="button secondary" disabled={!ready || busy} onClick={save}><Save size={20} />保存本机草稿</button>
        <button className="button primary" disabled={!ready || busy || !saved || !hasInk} onClick={showPreview}><Eye size={20} />预览原画桌宠</button>
      </div>
      {!bridge && <p className="drawing-local-notice">手机浏览器可保存、预览并在当前页面显示原画；替换独立悬浮窗口请使用 Windows 客户端。</p>}
      {artworkError && <p className="drawing-local-notice" role="alert">{artworkError}</p>}
      {currentArtwork?.kind === 'drawing' && <div className="drawing-applied"><img src={currentArtwork.dataUrl} alt="当前悬浮桌宠原画" /><div><strong>正在陪伴你的是这张原画</strong><p>已保存在本机，重启桌宠后仍会使用。清画布不会替换已应用的形象。</p></div><button className="button secondary" disabled={busy} onClick={restore}><RotateCcw size={18} />恢复内置桌宠</button></div>}
      <div className="drawing-optional" aria-label="生成服务状态"><p>以下功能与直接使用原画无关，不是必经步骤。</p>
        <button className="button plain" onClick={() => announce('真实 AI 生成未接入，不伪造生成结果。直接使用原画无需 AI，请保存后预览。')}><PawPrint size={18} />AI 生成（未接入）</button>
      </div>
    </section>
    <Modal open={preview !== null} onOpenChange={open => { if (!open && !busy) setPreview(null); }} title="原画桌宠预览" description="保留你的原始笔画，仅裁去四周空白并保留透明背景。不会上传、改画或调用 AI。">
      {preview && <div className="drawing-artwork-preview"><img src={preview.dataUrl} alt="你的原画桌宠预览，透明背景" /></div>}
      <p className="drawing-preview-note">电脑客户端确认后会替换独立悬浮窗口；手机浏览器确认后会在当前页面显示这张原画。两种方式都不会调用 AI 或修改原始笔画。</p>
      {previewError && <p className="inline-error" role="alert">{previewError}</p>}
      {!bridge && <p className="drawing-local-notice">当前页面不会替换系统桌宠；确认后会显示网页陪伴。</p>}
      <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setPreview(null)}>继续修改</button><button className="button primary" disabled={busy} onClick={apply}>{busy ? '正在应用…' : bridge ? '直接设为桌宠' : '在本页显示原画'}</button></div>
    </Modal>
    <Modal open={clearConfirm} onOpenChange={setClearConfirm} title="清空当前画布？" description="只清除当前编辑内容；已保存的本机草稿在你再次保存前保持不变。已应用的桌宠不会随画布清空。">
      <button className="button primary" onClick={() => { activeStroke.current = null; activePointer.current = null; setStrokes([]); setSaved(false); setClearConfirm(false); }}>确认清空画布</button>
    </Modal>
  </>;
}
