import { monthlyPayment } from './mortgage.ts';

export const moveDefaults = {
  salePrice: '1000000',
  payoff: '600000',
  saleFeeRate: '5',
  otherSaleCosts: '10000',
  buyPrice: '1300000',
  closingCosts: '26000',
  prepaids: '5000',
  movers: '5000',
  repairs: '10000',
  overlapMonths: '1',
  overlapMonthly: '4500',
  savings: '80000',
  reserve: '30000',
  downMode: 'target',
  downPercent: '25',
  annualRate: '6.5',
  years: '30',
  annualTax: '14300',
  annualInsurance: '2400',
  monthlyHoa: '0',
  monthlyPmi: '0',
};

export type MoveSettings = typeof moveDefaults;
export type MoveAmount = Exclude<keyof MoveSettings, 'downMode'>;
type MoveInput = Record<MoveAmount, number> & { downMode: 'target' | 'available' };

export const moveLimits: Partial<Record<MoveAmount, number>> = {
  saleFeeRate: 100, downPercent: 100, annualRate: 30, years: 50, overlapMonths: 36,
};
export const moveMaxAmount = 100_000_000;
const dollars = (amount: number) => Math.round(amount * 100) / 100;

export function calculateHomeMove(input: MoveInput) {
  const { salePrice, payoff, saleFeeRate, otherSaleCosts, buyPrice, closingCosts, prepaids,
    movers, repairs, overlapMonths, overlapMonthly, savings, reserve, downPercent, downMode,
    annualRate, years, annualTax, annualInsurance, monthlyHoa, monthlyPmi } = input;

  for (const [key, value] of Object.entries(input)) {
    if (key === 'downMode') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
        value > (moveLimits[key as MoveAmount] ?? moveMaxAmount)) throw new Error('amount');
  }
  if (salePrice < .01 || buyPrice < .01) throw new Error('price');
  if (!Number.isInteger(years) || years < 1 || !Number.isInteger(overlapMonths)) throw new Error('term');
  if (downMode !== 'available' && downMode !== 'target') throw new Error('amount');

  const saleFees = dollars(salePrice * saleFeeRate / 100);
  const sellingCosts = dollars(saleFees + otherSaleCosts);
  const netSale = dollars(salePrice - payoff - sellingCosts);
  const overlap = dollars(overlapMonths * overlapMonthly);
  const transitionCosts = dollars(movers + repairs + overlap);
  const moveCosts = dollars(sellingCosts + closingCosts + transitionCosts);
  const purchaseOutlays = dollars(closingCosts + prepaids + transitionCosts);
  const cashAvailable = dollars(netSale + savings);
  const cashForDown = dollars(cashAvailable - reserve - purchaseOutlays);

  const downPayment = downMode === 'target'
    ? dollars(dollars(buyPrice) * downPercent / 100)
    : Math.min(dollars(buyPrice), Math.max(0, cashForDown));
  const principal = dollars(dollars(buyPrice) - downPayment);
  const purchaseCash = dollars(downPayment + closingCosts + prepaids);
  const cashAfterMove = dollars(cashAvailable - purchaseCash - transitionCosts);
  const reserveGap = Math.max(0, dollars(reserve - cashAfterMove));
  // Conservative timing scenario: all buying and moving outlays precede the sale.
  const preSaleGap = Math.max(0, dollars(purchaseCash + transitionCosts + reserve - savings));
  const payment = monthlyPayment(principal, annualRate, years);
  const monthlyHousing = payment + (annualTax + annualInsurance) / 12 + monthlyHoa + (principal > 0 ? monthlyPmi : 0);

  return {
    saleFees, netSale, overlap, transitionCosts, moveCosts,
    downPayment, downRatio: downPayment / dollars(buyPrice) * 100, principal,
    purchaseCash, cashAfterMove, reserveGap, preSaleGap, payment, monthlyHousing,
  };
}

export function calculateMoveSettings(settings: MoveSettings) {
  const { downMode, ...amounts } = settings;
  if (downMode === 'available') amounts.downPercent = '0';
  const numbers = Object.entries(amounts).map(([key, raw]) => {
    if (!raw.trim()) throw new Error('blank');
    return [key, Number(raw)];
  });
  if (downMode !== 'target' && downMode !== 'available') throw new Error('amount');
  return calculateHomeMove({ ...Object.fromEntries(numbers), downMode } as MoveInput);
}
