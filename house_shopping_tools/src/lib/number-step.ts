type Bounds = { min: number; max: number };

export function numberBounds(min: number, max?: number): Bounds {
  return { min, max: max !== undefined && Number.isFinite(max) && max >= min ? max : Infinity };
}

function decimalPlaces(value: string) {
  const [coefficient, exponent = '0'] = value.toLowerCase().split('e');
  return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
}

export function stepNumber(value: string, direction: 1 | -1, increment: number, bounds: Bounds, whole: boolean) {
  const { min, max } = bounds;
  const clamp = (number: number) => Math.max(min, Math.min(max, number));
  const current = Number(value);
  if (!value.trim() || !Number.isFinite(current)) return String(clamp(direction * increment));
  if (current < min || current > max) return String(clamp(current));
  if (whole && !Number.isInteger(current)) return String(clamp(direction > 0 ? Math.ceil(current) : Math.floor(current)));
  const places = Math.min(15, Math.max(decimalPlaces(value), decimalPlaces(String(increment))));
  const next = Number((current + direction * increment).toFixed(places));
  return String(clamp(next));
}
