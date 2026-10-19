import { beforeEach, describe, expect, it } from 'vitest';
import { currentPet, applyPet, undoPet, samePet, validPet } from '@nuanban/pet-engine';
import { IndexedDbRepository } from '@nuanban/local-data';
import { createDemoSnapshot } from '../fixtures/business-scenarios';
import { useApp } from '../../apps/web/src/store';
import type { Repository } from '@nuanban/application';
import type { PetConfiguration } from '@nuanban/domain';

const candidate: PetConfiguration = { kind: 'rabbit', appearance: { eyes: 'happy', mouth: 'open', color: '#D7C5AB', action: 'greeting' } };
const conversation = { async *stream(): AsyncGenerator<never> { throw new Error('not connected'); } };
beforeEach(() => useApp.setState({ snapshot: null, ready: false, error: null, busy: false, toast: null }));

describe('内置桌宠预览应用与撤回', () => {
  it('栗栗作为独立角色保存，重开保留，撤回恢复原伙伴', async () => {
    const lili: PetConfiguration = { kind: 'lili', appearance: { eyes: 'round', mouth: 'smile', color: '#A66B4B', action: 'idle' } };
    expect(validPet(lili)).toBe(true);
    expect(validPet({ ...lili, kind: 'unknown' } as unknown as PetConfiguration)).toBe(false);
    const repository = new IndexedDbRepository();
    const ownerId = crypto.randomUUID();
    const initial = createDemoSnapshot(ownerId);
    await useApp.getState().initialize({ repository, ownerId, conversation }, () => initial);
    await useApp.getState().applyPet(lili, 0);
    expect(currentPet((await repository.load(ownerId))!.preferences)).toEqual(lili);
    await useApp.getState().initialize({ repository, ownerId, conversation }, () => initial);
    expect(currentPet(useApp.getState().snapshot!.preferences)).toEqual(lili);
    await useApp.getState().undoPet(1);
    expect(currentPet((await repository.load(ownerId))!.preferences)).toEqual(currentPet(initial.preferences));
  });
  it('纯预览不改变偏好，应用保留原形象且不改变模式/语音', () => {
    const preferences = createDemoSnapshot('owner').preferences;
    const original = structuredClone(preferences);
    const next = applyPet(preferences, candidate, 0);
    expect(preferences).toEqual(original);
    expect(currentPet(next)).toEqual(candidate);
    expect(next.previousPet).toEqual(currentPet(original));
    expect(next.mode).toBe(original.mode);
    expect(next.speechRate).toBe(original.speechRate);
    expect(currentPet(undoPet(next, 1))).toEqual(currentPet(original));
    expect(undoPet(next, 1).previousPet).toBeNull();
    expect(() => undoPet(preferences, 0)).toThrow();
  });
  it('非法数据、过期版本和无变化不能覆盖现有桌宠', () => {
    const preferences = createDemoSnapshot('owner').preferences;
    expect(() => applyPet(preferences, { ...candidate, appearance: { ...candidate.appearance, color: 'url(secret)' } }, 0)).toThrow();
    expect(() => applyPet(preferences, candidate, 5)).toThrow();
    expect(() => applyPet(preferences, currentPet(preferences), 0)).toThrow();
    expect(samePet(currentPet(preferences), structuredClone(currentPet(preferences)))).toBe(true);
  });
  it('已确认设置和撤回路径重开后保留，并按账号隔离', async () => {
    const repository = new IndexedDbRepository();
    const ownerId = crypto.randomUUID();
    const initial = createDemoSnapshot(ownerId);
    await useApp.getState().initialize({ repository, ownerId, conversation }, () => initial);
    await useApp.getState().applyPet(candidate, 0);
    const saved = (await repository.load(ownerId))!.preferences;
    expect(currentPet(saved)).toEqual(candidate);
    expect(saved.previousPet).toEqual(currentPet(initial.preferences));
    expect(await repository.load(ownerId + '-other')).toBeNull();
    await useApp.getState().initialize({ repository, ownerId, conversation }, () => initial);
    await useApp.getState().undoPet(1);
    expect(currentPet((await repository.load(ownerId))!.preferences)).toEqual(currentPet(initial.preferences));
  });
  it('保存失败保持原偏好及旧撤回记录，双击不能覆盖较新版本', async () => {
    const initial = createDemoSnapshot('owner');
    let fail = true;
    const repository: Repository = { async load() { return initial; }, async commit() { if (fail) throw new Error('模拟本机保存失败'); }, async clear() { } };
    await useApp.getState().initialize({ repository, ownerId: 'owner', conversation }, () => initial);
    await expect(useApp.getState().applyPet(candidate, 0)).rejects.toThrow('模拟本机保存失败');
    expect(useApp.getState().snapshot).toEqual(initial);
    fail = false;
    const first = useApp.getState().applyPet(candidate, 0);
    const second = useApp.getState().applyPet({ ...candidate, kind: 'dog' }, 0);
    await first;
    await expect(second).rejects.toThrow('桌宠设置已变化');
    expect(currentPet(useApp.getState().snapshot!.preferences)).toEqual(candidate);
  });
});
