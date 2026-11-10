import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateRefinance } from '../src/lib/refinance.ts';
import { amortize } from '../src/lib/mortgage.ts';
import { createTranslator } from '../src/lib/i18n.ts';

const input = { principal: 800000, annualRate: 6.5, years: 30, extra: 0, afterMonth: 12, newRate: 5.5, newTermMonths: 360, closingCosts: 6000, financeCosts: false, horizonMonths: 60 };
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a-b) < tolerance, `${a} differs from ${b}`);
const payment = (p, rate, months) => rate === 0 ? p / months : p * (rate / 1200) / (1 - (1 + rate / 1200) ** -months);
const balance = (p, rate, months, paid) => rate === 0 ? p - paid * months : p * (1 + rate/1200)**months - paid * ((1 + rate/1200)**months - 1) / (rate/1200);

test('refinance uses the selected remaining balance and excludes all past interest', () => {
  const r = simulateRefinance(input), oldPayment = payment(800000, 6.5, 360);
  const before = balance(800000, 6.5, 12, oldPayment), newPayment = payment(before, 5.5, 360);
  close(r.balance, before); close(r.refinanced.scheduledPayment, newPayment);
  close(r.current.totalInterest, oldPayment * 348 - before, 1e-5);
  close(r.refinanced.totalInterest, newPayment * 360 - before, 1e-5);
  close(r.totalSavings, oldPayment * 348 - newPayment * 360 - 6000, 1e-5);
  const oldBalance = balance(before, 6.5, 60, oldPayment), newBalance = balance(before, 5.5, 60, newPayment);
  close(r.horizon.netSavings, (oldPayment-newPayment)*60 - 6000 + oldBalance-newBalance, 1e-5);
  assert.equal(r.current.months, 348); assert.equal(r.refinanced.months, 360);
});

test('cash fees and financed fees are counted exactly once and financed costs accrue interest', () => {
  const cash = simulateRefinance(input), financed = simulateRefinance({...input, financeCosts: true});
  close(cash.newPrincipal, cash.balance); close(cash.cashCosts, 6000);
  close(financed.newPrincipal, financed.balance+6000); assert.equal(financed.cashCosts, 0);
  assert.equal(cash.comparison[0].netSavings, -6000); assert.equal(financed.comparison[0].netSavings, -6000);
  assert.equal(financed.comparison[0].cashSavings, 0);
  assert.ok(financed.refinanced.totalInterest > cash.refinanced.totalInterest);
  close(financed.totalSavings, financed.current.totalInterest - financed.refinanced.totalInterest - 6000);
  close(cash.totalSavings, cash.current.totalInterest - cash.refinanced.totalInterest - 6000);
});

test('term extension with a lower payment is not falsely reported as an economic saving', () => {
  for (const financeCosts of [false, true]) {
    const r = simulateRefinance({principal:120000,annualRate:0,years:10,extra:0,afterMonth:12,newRate:0,newTermMonths:120,closingCosts:6000,financeCosts,horizonMonths:60});
    close(r.current.scheduledPayment,1000); close(r.refinanced.scheduledPayment,financeCosts ? 950 : 900);
    assert.ok(r.monthlyReduction>0); close(r.horizon.netSavings,-6000); close(r.totalSavings,-6000);
    assert.equal(r.breakEvenMonth,null);
  }
});

test('break-even includes debt as well as payments and can be absent or immediate with no fees', () => {
  const r = simulateRefinance(input);
  assert.ok(r.breakEvenMonth > 0);
  assert.ok(r.comparison[r.breakEvenMonth].netSavings >= 0);
  assert.ok(r.comparison[r.breakEvenMonth-1].netSavings < 0);
  assert.equal(simulateRefinance({...input,newRate:9}).breakEvenMonth,null);
  const free = simulateRefinance({...input,closingCosts:0});
  assert.equal(free.breakEvenMonth,0); assert.ok(free.horizon.netSavings>0);
});

test('matching remaining term at the same rate is unchanged without fees, including odd month counts', () => {
  for (const afterMonth of [0,12,41,359]) {
    const r = simulateRefinance({...input,afterMonth,newRate:6.5,newTermMonths:360-afterMonth,closingCosts:0});
    close(r.monthlyReduction,0); close(r.totalSavings,0);
    close(r.horizon.netSavings,0);
    assert.equal(r.refinanced.months,360-afterMonth);
  }
});

test('existing extra principal continues and shorter refinance terms can increase monthly payments', () => {
  const r = simulateRefinance({...input,extra:500,newTermMonths:180});
  const original = amortize({principal:800000,annualRate:6.5,years:30,extra:500});
  close(r.balance,original.rows[11].balance);
  close(r.current.rows[0].extra,500); close(r.refinanced.rows[0].extra,500);
  assert.ok(r.monthlyReduction<0); assert.ok(r.refinanced.months<180); assert.ok(r.totalSavings>0);
});

test('schedules reconcile principal, interest, fees, balances and final net savings', () => {
  for (const patch of [{},{financeCosts:true},{extra:500},{afterMonth:0},{newRate:0},{newTermMonths:1},{horizonMonths:600}]) {
    const r = simulateRefinance({...input,...patch});
    for (const [plan,principal] of [[r.current,r.balance],[r.refinanced,r.newPrincipal]]) {
      close(plan.rows.reduce((sum,row)=>sum+row.principal,0),principal);
      close(plan.rows.reduce((sum,row)=>sum+row.payment,0),plan.totalPaid,1e-5);
      assert.equal(plan.rows.at(-1).balance,0);
      assert.ok(plan.rows.every(row=>row.balance>=0 && row.principal>=0 && row.interest>=0));
    }
    close(r.comparison.reduce((sum,row)=>sum+row.cashFee,0),r.cashCosts);
    close(r.comparison.at(-1).netSavings,r.totalSavings,1e-5);
    if (patch.horizonMonths===600) close(r.horizon.netSavings,r.totalSavings,1e-5);
  }
});

test('refinancing after accelerated payoff and invalid inputs are rejected', () => {
  for (const patch of [{principal:0},{newRate:-1},{newRate:30.1},{newTermMonths:0},{newTermMonths:600.5},{newTermMonths:601},{closingCosts:-1},{closingCosts:Infinity},{horizonMonths:0},{horizonMonths:601},{horizonMonths:1.5},{afterMonth:-1},{afterMonth:360},{afterMonth:1.5},{financeCosts:'yes'}]) assert.throws(()=>simulateRefinance({...input,...patch}));
  assert.throws(()=>simulateRefinance({...input,extra:100000}),/refinance_after_payoff/);
});

test('English refinance UI text has translations and Chinese preserves the original labels', () => {
  const en = createTranslator('en'), zh = createTranslator('zh');
  const source = readFileSync(new URL('../src/components/refinance-simulator.tsx',import.meta.url),'utf8');
  const keys = [...source.matchAll(/\bt\('([^']+)'/g)].map(match=>match[1]);
  for (const key of keys) {
    assert.ok(!/[\u3400-\u9fff]/u.test(en(key)),`Missing English text: ${key}`);
    assert.equal(zh(key),key);
  }
});
