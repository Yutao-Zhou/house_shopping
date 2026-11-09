import { amortize, paymentForMonths, type PaymentRow } from './mortgage.ts';

export type RecastInput = {
  principal: number;
  annualRate: number;
  years: number;
  extra: number;
  afterMonth: number;
  lumpSum: number;
  fee: number;
};
export type RecastRow = PaymentRow & { regularPayment: number; requiredPayment: number; lumpSum: number; fee: number };
export type RecastPlan = { rows: RecastRow[]; months: number; totalInterest: number; totalPaid: number; totalOutflow: number };

export function simulateRecast(input: RecastInput) {
  const { principal, annualRate, years, extra, afterMonth, lumpSum, fee } = input;
  const termMonths = years * 12;
  if (!Object.values(input).every(Number.isFinite) || principal <= 0 || annualRate < 0 || extra < 0 || lumpSum < 0 || fee < 0 || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600) throw new Error('invalid_recast_inputs');
  if (!Number.isInteger(afterMonth) || afterMonth < 0 || afterMonth >= termMonths) throw new Error('invalid_recast_month');
  const original = amortize({ principal, annualRate, years, extra });
  const before = afterMonth === 0 ? principal : (original.rows[afterMonth - 1]?.balance ?? 0);
  if (before <= 0) throw new Error('recast_after_payoff');
  const centBalance = Math.round(before * 100) / 100;
  if (lumpSum > Math.max(before, centBalance) + 1e-8) throw new Error('recast_exceeds_balance');
  const appliedLumpSum = Math.min(lumpSum, before);
  const after = before - appliedLumpSum;
  const remainingMonths = termMonths - afterMonth;
  const newPayment = paymentForMonths(after, annualRate, remainingMonths);
  const originalPayment = original.scheduledPayment;

  const scenario = (recast: boolean): RecastPlan => {
    const rows: RecastRow[] = [];
    let balance = principal, totalInterest = 0;
    if (afterMonth === 0) {
      balance -= appliedLumpSum;
      rows.push({ month: 0, payment: appliedLumpSum, principal: appliedLumpSum, interest: 0, extra: 0, balance, totalInterest: 0, regularPayment: 0, requiredPayment: 0, lumpSum: appliedLumpSum, fee: recast ? fee : 0 });
    }
    for (let month = 1; month <= termMonths && balance > 0; month++) {
      const requiredPayment = recast && month > afterMonth ? newPayment : originalPayment;
      const interest = balance * annualRate / 1200;
      const regularPrincipal = month === termMonths ? balance : Math.min(balance, Math.max(0, requiredPayment - interest));
      const extraPrincipal = Math.min(extra, Math.max(0, balance - regularPrincipal));
      const appliedLump = month === afterMonth ? Math.min(appliedLumpSum, Math.max(0, balance - regularPrincipal - extraPrincipal)) : 0;
      const paidPrincipal = regularPrincipal + extraPrincipal + appliedLump;
      balance = Math.max(0, balance - paidPrincipal);
      if (balance < 1e-7) balance = 0;
      totalInterest += interest;
      rows.push({ month, payment: paidPrincipal + interest, principal: paidPrincipal, interest, extra: extraPrincipal, balance, totalInterest, requiredPayment, regularPayment: regularPrincipal + interest, lumpSum: appliedLump, fee: recast && month === afterMonth ? fee : 0 });
    }
    return { rows, months: rows.at(-1)?.month ?? 0, totalInterest, totalPaid: principal + totalInterest, totalOutflow: principal + totalInterest + (recast ? fee : 0) };
  };
  const baseline: RecastPlan = { ...original, totalOutflow: original.totalPaid, rows: original.rows.map(row => ({ ...row, regularPayment: row.payment - row.extra, requiredPayment: originalPayment, lumpSum: 0, fee: 0 })) };
  const recast = scenario(true), lumpOnly = scenario(false);
  const clean = (n: number) => Math.abs(n) < 1e-7 ? 0 : n;
  return { baseline, recast, lumpOnly, balanceBefore: before, balanceAfter: after, appliedLumpSum, remainingMonths, originalPayment, newPayment, monthlyReduction: clean(originalPayment - newPayment), interestSavings: clean(baseline.totalInterest - recast.totalInterest), netSavings: clean(baseline.totalOutflow - recast.totalOutflow), upfront: appliedLumpSum + fee };
}
export type RecastResult = ReturnType<typeof simulateRecast>;
