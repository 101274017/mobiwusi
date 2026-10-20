import type { ModelSource } from '../local-model';
import { localModelBridge } from '../local-model';

const root = `${import.meta.env.BASE_URL}models/lumi/`;

export const lumiModel = {
  id: 'lumi',
  name: '露米 Lumi',
  version: '1.0.0',
  fileName: 'Lumi_Magical_Kitten.glb',
  sha256: '7fbe808f7de41e0e15181a0094038f79d6168ea99888dc8947846a2f70cf019b',
  modelUrl: `${root}Lumi_Magical_Kitten.glb`,
  posterUrl: `${root}poster.png`,
  manifestUrl: `${root}character_manifest.json`,
  actions: [
    { name: 'idle', label: '陪伴' },
    { name: 'walk', label: '走一走' },
    { name: 'wave', label: '打招呼' },
    { name: 'happy', label: '开心' },
    { name: 'think', label: '想一想' },
    { name: 'cast', label: '施展魔法' },
    { name: 'surprise', label: '惊喜' },
    { name: 'sleep', label: '打个盹' },
    { name: 'tap_react', label: '摸摸头' },
  ],
} as const;

export async function loadLumiModel(signal?: AbortSignal): Promise<ModelSource> {
  signal?.throwIfAborted();
  const bridge = localModelBridge();
  let bytes: Uint8Array<ArrayBuffer>;
  if (bridge?.readBuiltin) {
    const source = await bridge.readBuiltin('lumi');
    if (source.format !== 'glb') throw new Error('小猫模型格式不正确，请更新客户端。');
    bytes = new Uint8Array(source.bytes);
  } else {
    const response = await fetch(lumiModel.modelUrl, { signal, credentials: 'omit' });
    if (!response.ok) throw new Error('小猫模型未能读取，请检查客户端资源后重试。');
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  signal?.throwIfAborted();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== lumiModel.sha256) throw new Error('小猫资源校验失败，请重新构建或安装客户端。');
  return { format: 'glb', bytes };
}
