export type CostMode = 'price' | 'fixed';
export type CostModes = {
  taxMode: CostMode; taxRate: string;
  insuranceMode: CostMode; insuranceRate: string;
};
export type AnnualCost = { mode: CostMode; rate: string; amount: string };
export type HousingCostSettings = CostModes & { tax: string; insurance: string };

export const costModeDefaults: CostModes = {
  taxMode: 'price', taxRate: '1.1',
  insuranceMode: 'price', insuranceRate: '0.18',
};

export function restoreCostModes(value: Record<string, unknown>) {
  // Earlier plans stored annual dollars only.
  return {
    taxMode: value.taxMode === 'price' ? 'price' : 'fixed',
    insuranceMode: value.insuranceMode === 'price' ? 'price' : 'fixed',
  } satisfies Pick<CostModes, 'taxMode' | 'insuranceMode'>;
}

function nonnegative(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function homePrice(price: string): number | null {
  const number = nonnegative(price);
  return number !== null && number >= .01 && number <= 100_000_000 ? number : null;
}

export function annualHousingCost(price: string, cost: AnnualCost, max = 10_000_000): number | null {
  const input = nonnegative(cost.mode === 'price' ? cost.rate : cost.amount);
  if (input === null) return null;
  if (cost.mode === 'fixed') return input <= max ? input : null;

  const base = homePrice(price);
  if (base === null) return null;
  const annual = base * input / 100;
  return annual <= max ? Math.round(annual * 100) / 100 : null;
}

export function housingCostItem(values: HousingCostSettings, kind: 'tax' | 'insurance'): AnnualCost {
  return { amount: values[kind], mode: values[`${kind}Mode`], rate: values[`${kind}Rate`] };
}

export function resolveHousingCosts(price: string, values: HousingCostSettings, max?: number) {
  const tax = annualHousingCost(price, housingCostItem(values, 'tax'), max);
  const insurance = annualHousingCost(price, housingCostItem(values, 'insurance'), max);
  return tax === null || insurance === null ? null : { tax, insurance };
}

export function changeCostMode(price: string, cost: AnnualCost, mode: CostMode, max?: number): AnnualCost {
  if (mode === cost.mode) return cost;
  const annual = annualHousingCost(price, cost, max);
  if (annual === null) return { ...cost, mode };
  if (mode === 'fixed') return { ...cost, mode, amount: annual.toFixed(2) };

  const base = homePrice(price);
  const rate = base === null ? cost.rate : String(Number((annual / base * 100).toPrecision(15)));
  return { ...cost, mode, rate };
}
