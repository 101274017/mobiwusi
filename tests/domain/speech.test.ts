import { describe, expect, it } from 'vitest';
import { speechAvailable } from '../../apps/web/src/components';

describe('语音播放能力边界', () => {
  it('只把存在 speechSynthesis 的环境视为可播放', () => {
    expect(speechAvailable({ speechSynthesis: {} as SpeechSynthesis })).toBe(true);
    expect(speechAvailable({ speechSynthesis: undefined as never })).toBe(false);
    expect(speechAvailable(undefined)).toBe(false);
  });
});
