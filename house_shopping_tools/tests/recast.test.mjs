import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateRecast } from '../src/lib/recast.ts';
import { monthlyPayment, paymentForMonths, amortize } from '../src/lib/mortgage.ts';

const input = { principal:800000, annualRate:6.5, years:30, extra:0, afterMonth:12, lumpSum:100000, fee:300 };
const close = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b) < tolerance, `${a} differs from ${b}`);
test('recasts after the selected payment over the original remaining term', () => {
  const r = simulateRecast(input), rate = input.annualRate / 1200;
  const payment = monthlyPayment(input.principal,input.annualRate,input.years);
  const expectedBalance = input.principal * (1+rate)**12 - payment * ((1+rate)**12 - 1) / rate;
  close(r.balanceBefore, expectedBalance);
  close(r.newPayment, (expectedBalance-input.lumpSum)*rate/(1-(1+rate)**-348));
  close(r.recast.rows[11].regularPayment,payment);
  close(r.recast.rows[11].lumpSum,100000);
  close(r.recast.rows[12].regularPayment,r.newPayment);
  assert.equal(r.recast.months,360);
  assert.ok(r.lumpOnly.months<360);
  assert.ok(r.lumpOnly.totalInterest<r.recast.totalInterest);
  close(r.netSavings,r.baseline.totalInterest-r.recast.totalInterest-300);
});
test('zero interest has an independent exact principal-only solution', () => {
  const r=simulateRecast({principal:120000,annualRate:0,years:10,extra:0,afterMonth:12,lumpSum:12000,fee:250});
  close(r.balanceBefore,108000); close(r.balanceAfter,96000); close(r.newPayment,96000/108);
  assert.equal(r.recast.months,120); assert.equal(r.lumpOnly.months,108);
  assert.equal(r.interestSavings,0); assert.equal(r.netSavings,-250);
});
test('an immediate recast includes a month-zero cash event and can pay off fully', () => {
  const r=simulateRecast({...input,afterMonth:0});
  close(r.newPayment,monthlyPayment(700000,6.5,30));
  assert.equal(r.recast.rows[0].month,0); assert.equal(r.recast.rows[0].lumpSum,100000);
  const paid=simulateRecast({...input,afterMonth:0,lumpSum:800000});
  assert.equal(paid.newPayment,0); assert.equal(paid.recast.months,0);
  assert.equal(paid.recast.totalInterest,0); assert.equal(paid.recast.totalOutflow,800300);
});
test('extra principal continues before and after recast and may change savings', () => {
  const r=simulateRecast({...input,extra:500,afterMonth:60,lumpSum:0});
  const baseline=amortize({principal:800000,annualRate:6.5,years:30,extra:500});
  close(r.balanceBefore,baseline.rows[59].balance);
  close(r.newPayment,paymentForMonths(r.balanceAfter,6.5,300));
  close(r.recast.rows[60].extra,500);
  assert.ok(r.recast.months>baseline.months);
  assert.ok(r.netSavings<0);
});
test('every scenario conserves principal and reconciles all payments and fees', () => {
  for(const args of [input,{...input,afterMonth:0},{...input,extra:500},{...input,afterMonth:359,lumpSum:100}]) {
    const r=simulateRecast(args);
    for(const plan of [r.baseline,r.lumpOnly,r.recast]) {
      close(plan.rows.reduce((s,row)=>s+row.principal,0),args.principal);
      close(plan.rows.reduce((s,row)=>s+row.payment+row.fee,0),plan.totalOutflow);
      assert.equal(plan.rows.at(-1).balance,0);
      assert.ok(plan.rows.every(row=>row.balance>=0 && row.principal>=0 && row.payment>=0));
    }
  }
});
test('a zero-lump recast without extra payments is unchanged apart from the fee', () => {
  const r=simulateRecast({...input,lumpSum:0});
  close(r.newPayment,r.originalPayment);
  close(r.recast.totalInterest,r.baseline.totalInterest);
  assert.equal(r.monthlyReduction,0); close(r.netSavings,-input.fee);
});
test('full repayment at an intermediate event has no later installments', () => {
  const before=simulateRecast(input).balanceBefore;
  const r=simulateRecast({...input,lumpSum:before});
  assert.equal(r.newPayment,0); assert.equal(r.recast.months,12);
  assert.equal(r.recast.rows.at(-1).balance,0);
});
test('a displayed cent-rounded payoff balance is accepted without overpaying principal', () => {
  const before=simulateRecast(input).balanceBefore;
  const r=simulateRecast({...input,lumpSum:Number(before.toFixed(2))});
  assert.equal(r.newPayment,0);
  close(r.appliedLumpSum,before);
  close(r.recast.rows.reduce((sum,row)=>sum+row.principal,0),input.principal);
  assert.throws(()=>simulateRecast({...input,lumpSum:Number(before.toFixed(2))+.01}),/recast_exceeds_balance/);
});
test('invalid inputs and recasts after early payoff are rejected', () => {
  for(const patch of [{afterMonth:-1},{afterMonth:360},{afterMonth:1.5},{lumpSum:900000},{fee:-1},{lumpSum:NaN},{principal:0}]) assert.throws(()=>simulateRecast({...input,...patch}));
  assert.throws(()=>simulateRecast({...input,extra:100000,afterMonth:12}),/recast_after_payoff/);
  assert.ok(Number.isFinite(paymentForMonths(100000,6.5,319)));
});
