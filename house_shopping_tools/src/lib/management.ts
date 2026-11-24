import { paymentForMonths } from './mortgage.ts';

export type ManagementSettings = {
  manageBalance: string; managePayment: string; manageRate: string; manageNext: string;
  manageMaturity: string; manageLump: string; manageExtra: string;
};
export function managementDefaults(now = new Date()): ManagementSettings {
  const next = now.getFullYear() * 12 + now.getMonth() + 1;
  const format = (month: number) => `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`;
  return { manageBalance: '800000', managePayment: '5100', manageRate: '6.5', manageNext: format(next), manageMaturity: format(next + 359), manageLump: '0', manageExtra: '0' };
}
export type ManagementInput = { balance: number; payment: number; annualRate: number; nextPayment: string; maturity: string; lumpSum: number; extra: number };
export type ManagementRow = { month: number; payment: number; regular: number; additional: number; lumpSum: number; principal: number; interest: number; balance: number; totalInterest: number };
export type ManagementPlan = { status: 'paid' | 'non-amortizing' | 'beyond-horizon'; rows: ManagementRow[]; months: number | null; totalInterest: number | null; totalPaid: number | null; monthlyPayment: number; lumpSum: number; startingBalance: number; firstInterest: number };
const LIMIT = 1200;
function parseMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2300) throw new Error('invalid_management_date');
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
}

export function simulateManagement(input: ManagementInput) {
  const { balance, payment, annualRate, nextPayment, maturity, lumpSum, extra } = input;
  if (![balance, payment, annualRate, lumpSum, extra].every(Number.isFinite) || balance < 0 || balance > 100000000 || payment < 0 || payment > 10000000 || extra < 0 || extra > 10000000 || lumpSum < 0 || annualRate < 0 || annualRate > 30) throw new Error('invalid_management_inputs');
  if (lumpSum > balance + 1e-8) throw new Error('management_lump_exceeds_balance');
  const remainingMonths = parseMonth(maturity) - parseMonth(nextPayment) + 1;
  if (remainingMonths < 1 || remainingMonths > LIMIT) throw new Error('invalid_management_maturity');
  const appliedLump = Math.min(lumpSum, balance);
  const makePlan = (lump: number, additional: number): ManagementPlan => {
    const startingBalance = balance - lump, monthlyPayment = payment + additional, firstInterest = startingBalance * annualRate / 1200;
    const rows: ManagementRow[] = [{ month: 0, payment: lump, regular: 0, additional: 0, lumpSum: lump, principal: lump, interest: 0, balance: startingBalance, totalInterest: 0 }];
    const result = (status: ManagementPlan['status'], months: number | null, totalInterest: number | null): ManagementPlan => ({ status, rows, months, totalInterest, totalPaid: totalInterest === null ? null : balance + totalInterest, monthlyPayment, lumpSum: lump, startingBalance, firstInterest });
    if (startingBalance === 0) return result('paid', 0, 0);
    if (monthlyPayment <= firstInterest) return result('non-amortizing', null, null);
    let owed = startingBalance, totalInterest = 0;
    for (let month = 1; month <= LIMIT; month++) {
      const interest = owed * annualRate / 1200;
      const actualPayment = Math.min(monthlyPayment, owed + interest);
      const regular = Math.min(payment, actualPayment), additionalPaid = actualPayment - regular;
      const principal = Math.min(owed, Math.max(0, actualPayment - interest));
      owed = Math.max(0, owed - principal);
      if (owed < 1e-7) owed = 0;
      totalInterest += interest;
      rows.push({ month, payment: actualPayment, regular, additional: additionalPaid, lumpSum: 0, principal, interest, balance: owed, totalInterest });
      if (owed === 0) return result('paid', month, totalInterest);
    }
    return result('beyond-horizon', null, null);
  };
  const current = makePlan(0, 0), lumpOnly = makePlan(appliedLump, 0), monthlyOnly = makePlan(0, extra), combined = makePlan(appliedLump, extra);
  return { current, lumpOnly, monthlyOnly, combined, remainingMonths, requiredPayment: paymentForMonths(balance, annualRate, remainingMonths),
    monthsSaved: current.months !== null && combined.months !== null ? current.months - combined.months : null,
    interestSaved: current.totalInterest !== null && combined.totalInterest !== null ? current.totalInterest - combined.totalInterest : null,
    projectionLimit: LIMIT };
}
export type ManagementResult = ReturnType<typeof simulateManagement>;
