import { amortize, paymentForMonths, type PaymentRow } from './mortgage.ts';

export type RefinanceInput = {
  principal: number; annualRate: number; years: number; extra: number;
  afterMonth: number; newRate: number; newTermMonths: number;
  closingCosts: number; financeCosts: boolean; horizonMonths: number;
};
export type RefinancePlan = { rows: PaymentRow[]; scheduledPayment: number; months: number; totalInterest: number; totalPaid: number };
export type RefinanceComparisonRow = {
  month: number; currentPayment: number; newPayment: number; currentInterest: number; newInterest: number;
  newPrincipal: number; newExtra: number; cashFee: number; currentBalance: number; newBalance: number;
  cashSavings: number; netSavings: number;
};

function newSchedule(principal: number, annualRate: number, months: number, extra: number): RefinancePlan {
  const scheduledPayment = paymentForMonths(principal, annualRate, months), rows: PaymentRow[] = [];
  let balance = principal, totalInterest = 0;
  for (let month = 1; month <= months && balance > 0; month++) {
    const interest = balance * annualRate / 1200;
    const regularPrincipal = month === months ? balance : Math.min(balance, Math.max(0, scheduledPayment - interest));
    const extraPrincipal = Math.min(extra, Math.max(0, balance - regularPrincipal));
    const paidPrincipal = regularPrincipal + extraPrincipal;
    balance = Math.max(0, balance - paidPrincipal);
    if (balance < 1e-7) balance = 0;
    totalInterest += interest;
    rows.push({ month, payment: paidPrincipal + interest, principal: paidPrincipal, interest, extra: extraPrincipal, balance, totalInterest });
  }
  return { rows, scheduledPayment, months: rows.length, totalInterest, totalPaid: principal + totalInterest };
}

export function simulateRefinance(input: RefinanceInput) {
  const { principal, annualRate, years, extra, afterMonth, newRate, newTermMonths, closingCosts, financeCosts, horizonMonths } = input;
  const numbers = [principal, annualRate, years, extra, afterMonth, newRate, newTermMonths, closingCosts, horizonMonths];
  const termMonths = years * 12;
  if (!numbers.every(Number.isFinite) || typeof financeCosts !== 'boolean' || principal <= 0 || principal > 100000000 || annualRate < 0 || annualRate > 30 || newRate < 0 || newRate > 30 || extra < 0 || extra > 10000000 || closingCosts < 0 || closingCosts > 10000000 || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600 || !Number.isInteger(newTermMonths) || newTermMonths < 1 || newTermMonths > 600 || !Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 600) throw new Error('invalid_refinance_inputs');
  if (!Number.isInteger(afterMonth) || afterMonth < 0 || afterMonth >= termMonths) throw new Error('invalid_refinance_month');
  const original = amortize({ principal, annualRate, years, extra });
  const balance = afterMonth === 0 ? principal : (original.rows[afterMonth - 1]?.balance ?? 0);
  if (balance <= 0) throw new Error('refinance_after_payoff');
  let currentInterest = 0;
  const currentRows = original.rows.slice(afterMonth).map((row, index) => ({ ...row, month: index + 1, totalInterest: currentInterest += row.interest }));
  const current: RefinancePlan = { rows: currentRows, scheduledPayment: original.scheduledPayment, months: currentRows.length, totalInterest: currentInterest, totalPaid: balance + currentInterest };
  const cashCosts = financeCosts ? 0 : closingCosts;
  const newPrincipal = balance + (financeCosts ? closingCosts : 0);
  const refinanced = newSchedule(newPrincipal, newRate, newTermMonths, extra);
  const clean = (n: number) => Math.abs(n) < 1e-7 ? 0 : n;
  const comparison: RefinanceComparisonRow[] = [{ month: 0, currentPayment: 0, newPayment: 0, currentInterest: 0, newInterest: 0, newPrincipal: 0, newExtra: 0, cashFee: cashCosts, currentBalance: balance, newBalance: newPrincipal, cashSavings: clean(-cashCosts), netSavings: clean(-closingCosts) }];
  let currentPaid = 0, newPaid = cashCosts;
  let breakEvenMonth: number | null = closingCosts === 0 ? 0 : null;
  for (let month = 1; month <= Math.max(current.months, refinanced.months); month++) {
    const oldRow = current.rows[month - 1], newRow = refinanced.rows[month - 1];
    currentPaid += oldRow?.payment ?? 0; newPaid += newRow?.payment ?? 0;
    // Remaining debt matters when comparing different terms. Financed fees are
    // already in the new balance, so never add those fees a second time.
    const netSavings = clean(currentPaid + (oldRow?.balance ?? 0) - newPaid - (newRow?.balance ?? 0));
    comparison.push({ month, currentPayment: oldRow?.payment ?? 0, newPayment: newRow?.payment ?? 0, currentInterest: oldRow?.interest ?? 0, newInterest: newRow?.interest ?? 0, newPrincipal: newRow?.principal ?? 0, newExtra: newRow?.extra ?? 0, cashFee: 0, currentBalance: oldRow?.balance ?? 0, newBalance: newRow?.balance ?? 0, cashSavings: clean(currentPaid - newPaid), netSavings });
    if (breakEvenMonth === null && netSavings >= 0) breakEvenMonth = month;
  }
  const horizon = comparison[Math.min(horizonMonths, comparison.length - 1)];
  return { balance, newPrincipal, cashCosts, financedCosts: financeCosts ? closingCosts : 0, remainingMonths: termMonths - afterMonth,
    current, refinanced, comparison, horizon, breakEvenMonth,
    monthlyReduction: clean(current.scheduledPayment - refinanced.scheduledPayment),
    interestSavings: clean(current.totalInterest - refinanced.totalInterest),
    totalSavings: clean(current.totalPaid - refinanced.totalPaid - cashCosts),
  };
}
export type RefinanceResult = ReturnType<typeof simulateRefinance>;
