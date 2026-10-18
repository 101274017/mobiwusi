export function validInstant(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[0] !== value) return false;
  const [, year, month, day, hour, minute, second, offset] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const maximumDays = new Date(Date.UTC(yearNumber < 100 ? yearNumber + 400 : yearNumber, monthNumber, 0)).getUTCDate();
  if (monthNumber < 1 || monthNumber > 12 || Number(day) < 1 || Number(day) > maximumDays || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  if (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

export function validTimezone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z_+-]+\/[A-Za-z0-9_+\-/]+$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; }
}

export const contractFormats = {
  'date-time': validInstant,
  'iana-timezone': validTimezone,
  uuid: (value: string) => value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
};
