import type { PetConfiguration, Preferences } from '@nuanban/domain';

export function currentPet(preferences: Preferences): PetConfiguration {
  return { kind: preferences.pet, appearance: { eyes: 'round', mouth: 'smile', action: 'idle', ...preferences.petAppearance, color: preferences.petColor } };
}

export function validPet(value: PetConfiguration): boolean {
  return !!value && ['cat', 'rabbit', 'dog'].includes(value.kind) && !!value.appearance && /^#[a-f0-9]{6}$/i.test(value.appearance.color) && ['round', 'happy', 'sleepy'].includes(value.appearance.eyes) && ['smile', 'small', 'open'].includes(value.appearance.mouth) && ['idle', 'greeting', 'celebrating'].includes(value.appearance.action);
}

export function samePet(first: PetConfiguration, second: PetConfiguration): boolean {
  return first.kind === second.kind && (['eyes', 'mouth', 'color', 'action'] as const).every(key => first.appearance[key] === second.appearance[key]);
}

export function applyPet(preferences: Preferences, candidate: PetConfiguration, expectedRevision: number): Preferences {
  if ((preferences.petRevision ?? 0) !== expectedRevision) throw new Error('桌宠设置已变化，请重新读取后再确认，不会覆盖较新设置。');
  if (!validPet(candidate)) throw new Error('桌宠微调数据无效，原有伙伴未改变。');
  if (samePet(currentPet(preferences), candidate)) throw new Error('微调还没有变化，无需重复保存。');
  return withPet(preferences, candidate, currentPet(preferences));
}

export function undoPet(preferences: Preferences, expectedRevision: number): Preferences {
  if ((preferences.petRevision ?? 0) !== expectedRevision) throw new Error('桌宠设置已变化，请重新读取后再撤回。');
  if (!preferences.previousPet || !validPet(preferences.previousPet)) throw new Error('没有可撤回的上一套桌宠设置。');
  return withPet(preferences, preferences.previousPet, null);
}

function withPet(preferences: Preferences, value: PetConfiguration, previous: PetConfiguration | null): Preferences {
  const { color, ...appearance } = value.appearance;
  return { ...preferences, pet: value.kind, petColor: color, petAppearance: { ...appearance }, previousPet: previous ? structuredClone(previous) : null, petRevision: (preferences.petRevision ?? 0) + 1 };
}
