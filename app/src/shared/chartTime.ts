function axisToYear(value: number): number {
  return value < 0 ? value : value + 1;
}

function yearToAxis(year: number): number {
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
