export type PaymentRow = { month: number; payment: number; principal: number; interest: number; extra: number; balance: number; totalInterest: number };
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (![principal, annualRate, years].every(Number.isFinite) || principal < 0 || annualRate < 0 || years <= 0 || !Number.isInteger(years * 12)) throw new Error('Invalid mortgage inputs');
  if (!principal) return 0;
  const rate = annualRate / 1200, months = years * 12;
  return rate === 0 ? principal / months : principal * rate / -Math.expm1(-months * Math.log1p(rate));
}
export function amortize({ principal, annualRate, years, extra }: { principal: number; annualRate: number; years: number; extra: number }) {
  const scheduledPayment = monthlyPayment(principal, annualRate, years);
  if (!Number.isFinite(extra) || extra < 0) throw new Error('Invalid extra payment');
  const rows: PaymentRow[] = [];
  let balance = principal, totalInterest = 0;
  for (let month = 1; month <= years * 12 && balance > 0; month++) {
    const interest = balance * annualRate / 1200;
    const regularPrincipal = Math.min(balance, Math.max(0, scheduledPayment - interest));
    const extraPrincipal = Math.min(extra, Math.max(0, balance - regularPrincipal));
    const paidPrincipal = month === years * 12 ? balance : regularPrincipal + extraPrincipal;
    balance = Math.max(0, balance - paidPrincipal);
    if (balance < 1e-7) balance = 0;
    totalInterest += interest;
    rows.push({ month, payment: paidPrincipal + interest, principal: paidPrincipal, interest, extra: Math.min(extraPrincipal, paidPrincipal), balance, totalInterest });
  }
  return { rows, scheduledPayment, totalInterest, months: rows.length, totalPaid: principal + totalInterest };
}
export function yearlyRows(rows: PaymentRow[]) {
  const result: PaymentRow[] = [];
  rows.forEach((row, index) => {
    const year = Math.floor(index / 12);
    if (!result[year]) result[year] = { month: year + 1, payment: 0, principal: 0, interest: 0, extra: 0, balance: 0, totalInterest: 0 };
    const target = result[year];
    target.payment += row.payment; target.principal += row.principal; target.interest += row.interest; target.extra += row.extra;
    target.balance = row.balance; target.totalInterest = row.totalInterest;
  });
  return result;
}
