import { LoopOnce, LoopRepeat } from 'three';
import type { AnimationAction, AnimationClip, AnimationMixer } from 'three';

const loopingActions = new Set(['idle', 'walk', 'think', 'sleep']);

export function createModelAnimationController(mixer: AnimationMixer, clips: AnimationClip[], onChange?: (name: string) => void) {
  const available = new Map(clips.map(clip => [clip.name, clip]));
  const defaultName = available.has('idle') ? 'idle' : clips[0]?.name;
  let body: AnimationAction | undefined;
  let face: AnimationAction | undefined;
  let current = '';
  let disposed = false;

  function transition(previous: AnimationAction | undefined, clip: AnimationClip, loop: boolean) {
    const action = mixer.clipAction(clip);
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.play();
    if (previous && previous !== action) action.crossFadeFrom(previous, 0.18, false);
    return action;
  }

  function play(name: string) {
    const clip = available.get(name);
    if (disposed || !clip) return false;
    const loop = loopingActions.has(name) || name === defaultName;
    body = transition(body, clip, loop);
    const facialClip = available.get(`face_${name}`) ?? (name !== 'blink' ? available.get('blink') : undefined);
    if (facialClip) face = transition(face, facialClip, facialClip.name === 'blink' || loop);
    else { face?.fadeOut(0.18); face = undefined; }
    current = name;
    onChange?.(name);
    return true;
  }

  const finished = (event: { action: AnimationAction }) => {
    if (event.action === body && defaultName && current !== defaultName) play(defaultName);
  };
  mixer.addEventListener('finished', finished);
  return {
    names: [...available.keys()],
    defaultName,
    play,
    get current() { return current; },
    dispose() { disposed = true; mixer.removeEventListener('finished', finished); },
  };
}
