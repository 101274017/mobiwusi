export interface DrawingArtwork {
  dataUrl: string;
  width: number;
  height: number;
}

export type LocalArtwork = { kind: 'builtin' } | (DrawingArtwork & { kind: 'drawing'; updatedAt: string });

export interface LocalArtworkBridge {
  read(): Promise<LocalArtwork>;
  apply(artwork: DrawingArtwork): Promise<LocalArtwork>;
  clear(): Promise<LocalArtwork>;
  onChanged(listener: (artwork: LocalArtwork) => void): () => void;
}

declare global {
  interface Window { nuanbanArtwork?: LocalArtworkBridge; }
}

export function localArtworkBridge(): LocalArtworkBridge | undefined {
  const bridge = window.nuanbanArtwork;
  return bridge && typeof bridge.read === 'function' && typeof bridge.apply === 'function'
    && typeof bridge.clear === 'function' && typeof bridge.onChanged === 'function' ? bridge : undefined;
}
