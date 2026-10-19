import { validDrawing, type DrawingStroke } from '@nuanban/pet-engine';
import type { DrawingArtwork } from './local-artwork';

export const drawingWidth = 800;
export const drawingHeight = 480;

export function paintDrawing(context: CanvasRenderingContext2D, strokes: DrawingStroke[]): void {
  context.clearRect(0, 0, drawingWidth, drawingHeight);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    context.beginPath();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
    if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y);
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
}

export function renderDrawingArtwork(strokes: DrawingStroke[]): DrawingArtwork {
  if (!validDrawing(strokes)) throw new Error('画稿格式无效或过大，请减少笔画后重试。');
  const canvas = document.createElement('canvas');
  canvas.width = drawingWidth;
  canvas.height = drawingHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('本机画布不可用，原画稿仍保留。');
  paintDrawing(context, strokes);
  const pixels = context.getImageData(0, 0, drawingWidth, drawingHeight).data;
  let left = drawingWidth;
  let top = drawingHeight;
  let right = -1;
  let bottom = -1;
  for (let offset = 3; offset < pixels.length; offset += 4) {
    if (!pixels[offset]) continue;
    const position = (offset - 3) / 4;
    const horizontal = position % drawingWidth;
    const vertical = Math.floor(position / drawingWidth);
    left = Math.min(left, horizontal);
    top = Math.min(top, vertical);
    right = Math.max(right, horizontal);
    bottom = Math.max(bottom, vertical);
  }
  if (right < left) throw new Error('画稿没有可见笔画，请先画一点内容再保存。');
  left = Math.max(0, left - 12);
  top = Math.max(0, top - 12);
  right = Math.min(drawingWidth - 1, right + 12);
  bottom = Math.min(drawingHeight - 1, bottom + 12);
  const cropped = document.createElement('canvas');
  cropped.width = right - left + 1;
  cropped.height = bottom - top + 1;
  const croppedContext = cropped.getContext('2d');
  if (!croppedContext) throw new Error('本机预览不可用，原画稿仍保留。');
  croppedContext.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return { dataUrl: cropped.toDataURL('image/png'), width: cropped.width, height: cropped.height };
}
