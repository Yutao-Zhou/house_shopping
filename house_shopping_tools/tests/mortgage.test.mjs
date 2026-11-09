import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyPayment, amortize, yearlyRows } from '../src/lib/mortgage.ts';
test('matches the original calculator and a known fixed-rate benchmark', () => {
  assert.equal(monthlyPayment(800000, 6.5, 30).toFixed(2), '5056.54');
  assert.equal(monthlyPayment(100000, 4, 30).toFixed(2), '477.42');
});
test('zero interest, zero principal, and immediate payoff do not overshoot', () => {
  const zero = amortize({principal: 120000, annualRate: 0, years: 10, extra: 0});
  assert.equal(zero.months, 120); assert.equal(zero.scheduledPayment, 1000); assert.equal(zero.totalInterest, 0);
  assert.equal(zero.rows.at(-1).balance, 0);
  const all = amortize({principal: 1000, annualRate: 6, years: 30, extra: 10000});
  assert.equal(all.months, 1); assert.equal(all.rows[0].payment, 1005);
  assert.equal(amortize({principal: 0, annualRate: 6.5, years: 30, extra: 500}).months, 0);
});
test('extra payments reduce duration and interest and conserve principal', () => {
  const input = { principal: 800000, annualRate: 6.5, years: 30, extra: 0 };
  const base = amortize(input), accelerated = amortize({...input, extra:500});
  assert.equal(base.months, 360); assert.ok(accelerated.months < base.months); assert.ok(accelerated.totalInterest < base.totalInterest);
  for (const plan of [base, accelerated]) {
    assert.ok(Math.abs(plan.rows.reduce((a, r) => a + r.principal, 0) - input.principal) < 1e-6);
    assert.equal(plan.rows.at(-1).balance, 0);
    assert.ok(plan.rows.every(r => r.balance >= 0 && r.payment >= 0 && r.extra <= r.principal));
    assert.ok(Math.abs(plan.rows.reduce((a, r) => a + r.payment, 0) - plan.totalPaid) < 1e-6);
    assert.ok(Math.abs(yearlyRows(plan.rows).reduce((a, r) => a + r.payment, 0) - plan.totalPaid) < 1e-6);
  }
});
test('near-zero interest is stable and invalid data is rejected', () => {
  assert.ok(Math.abs(monthlyPayment(360000, 1e-10, 30) - 1000) < 0.00001);
  assert.throws(() => monthlyPayment(100000, -1, 30));
  assert.throws(() => monthlyPayment(100000, 4, 0));
  assert.throws(() => amortize({principal:100000, annualRate:4, years:30, extra:NaN}));
});
