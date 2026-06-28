const dayMilliseconds = 86_400_000;

export function axisToYear(value: number): number {
  return value < 0 ? value : value + 1;
}

export function yearToAxis(year: number): number {
  if (year === 0) return 0;
  return year < 0 ? year : year - 1;
}

export function pointToMonthAxis(year: number, month: number | null): number {
  const normalizedMonth = month ?? 1;
  return yearToAxis(year) * 12 + normalizedMonth - 1;
}

export function monthAxisToYear(value: number): number {
  return axisToYear(Math.floor(value / 12));
}

export function monthAxisToMonth(value: number): number {
  return modulo(value, 12) + 1;
}

export function monthAxisToPoint(value: number): { month: number; year: number } {
  return {
    month: monthAxisToMonth(value),
    year: monthAxisToYear(value)
  };
}

export function dateToDay(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / dayMilliseconds);
}

export function dayToDate(value: number): string {
  return new Date(value * dayMilliseconds).toISOString().slice(0, 10);
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const time = new Date(`${value}T00:00:00.000Z`).getTime();
  return !Number.isNaN(time) && dayToDate(Math.floor(time / dayMilliseconds)) === value;
}

export function rangeToArray<T>(start: T, end: T): T[] {
  return start === end ? [start] : [start, end];
}

export function rangeToStringArray(start: string | number, end: string | number): string[] {
  return start === end ? [String(start)] : [String(start), String(end)];
}

export function shiftDateYears(value: string, deltaYears: number): string {
  if (deltaYears === 0) return value;

  const date = new Date(`${value}T00:00:00.000Z`);
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const nextYear = date.getUTCFullYear() + deltaYears;
  const lastDay = new Date(Date.UTC(nextYear, month + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(nextYear, month, Math.min(day, lastDay)));

  return next.toISOString().slice(0, 10);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
