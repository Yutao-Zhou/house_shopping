import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateManagement, managementDefaults } from '../src/lib/management.ts';
import { monthlyPayment } from '../src/lib/mortgage.ts';
import { createTranslator } from '../src/lib/i18n.ts';

const input={balance:120000,payment:1000,annualRate:0,nextPayment:'2026-12',maturity:'2036-11',lumpSum:12000,extra:200};
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
test('projects actual pace and all four paths with an independent zero-interest solution',()=>{
  const r=simulateManagement(input);
  assert.equal(r.remainingMonths,120); close(r.requiredPayment,1000);
  assert.equal(r.current.months,120); assert.equal(r.lumpOnly.months,108);
  assert.equal(r.monthlyOnly.months,100); assert.equal(r.combined.months,90);
  assert.equal(r.monthsSaved,30); close(r.interestSaved,0);
});
test('original maturity is a reference and never forces a balloon payment',()=>{
  const r=simulateManagement({...input,maturity:'2027-11',lumpSum:0,extra:0});
  assert.equal(r.remainingMonths,12); close(r.requiredPayment,10000);
  assert.equal(r.current.months,120); assert.equal(r.current.rows[12].balance,108000);
});
test('a known fixed-rate payment pays off in the expected term and extra payments shorten it',()=>{
  const payment=500000*.005/(1-(1.005)**-360);
  const r=simulateManagement({...input,balance:500000,payment,annualRate:6,maturity:'2056-11',lumpSum:50000,extra:300});
  assert.equal(r.current.months,360); close(r.current.rows[1].interest,2500);
  close(r.current.totalInterest,payment*360-500000,1e-4);
  assert.ok(r.combined.months<r.lumpOnly.months); assert.ok(r.combined.months<r.monthlyOnly.months);
  assert.ok(r.interestSaved>0);
});
test('non-amortizing current payments remain visible while an improved plan can pay off',()=>{
  const r=simulateManagement({...input,balance:100000,annualRate:12,payment:500,lumpSum:50000,extra:600});
  assert.equal(r.current.status,'non-amortizing'); assert.equal(r.current.months,null); assert.equal(r.current.totalInterest,null);
  assert.equal(r.lumpOnly.status,'non-amortizing'); assert.equal(r.monthlyOnly.status,'paid'); assert.equal(r.combined.status,'paid');
  close(r.combined.rows[1].interest,500); close(r.combined.rows[1].principal,600);
  close(r.combined.rows[1].regular,500); close(r.combined.rows[1].additional,600);
  assert.equal(r.monthsSaved,null); assert.equal(r.interestSaved,null);
});
test('full immediate payoff and an already-paid balance require no future installments',()=>{
  const paid=simulateManagement({...input,lumpSum:120000});
  assert.equal(paid.combined.months,0); close(paid.combined.totalInterest,0);
  assert.equal(paid.combined.rows.length,1); close(paid.combined.totalPaid,120000);
  const empty=simulateManagement({...input,balance:0,lumpSum:0,payment:0,extra:0});
  assert.equal(empty.current.months,0); close(empty.requiredPayment,0);
});
test('principal, lump sums, monthly extras, final installments and interest all reconcile',()=>{
  for(const patch of [{},{annualRate:6.5,payment:1100},{lumpSum:120000},{payment:999,extra:123.45},{balance:1000.11,payment:1000,lumpSum:0,annualRate:0}]) {
    const args={...input,...patch},r=simulateManagement(args);
    for(const plan of [r.current,r.lumpOnly,r.monthlyOnly,r.combined]) {
      assert.equal(plan.status,'paid'); close(plan.rows.reduce((s,row)=>s+row.principal,0),args.balance);
      close(plan.rows.reduce((s,row)=>s+row.payment,0),plan.totalPaid,1e-5);
      close(plan.rows.reduce((s,row)=>s+row.interest,0),plan.totalInterest,1e-5);
      assert.equal(plan.rows.at(-1).balance,0);
      assert.ok(plan.rows.every(row=>row.balance>=0 && row.additional>=0 && row.regular>=0));
      for(const row of plan.rows) close(row.payment,row.regular+row.additional+row.lumpSum);
    }
  }
});
test('very slow amortization is labeled beyond the projection horizon without a false payoff',()=>{
  const r=simulateManagement({...input,balance:100000,annualRate:0,payment:1,lumpSum:0,extra:0});
  assert.equal(r.current.status,'beyond-horizon'); assert.equal(r.current.months,null); assert.equal(r.current.totalInterest,null);
  assert.equal(r.current.rows.length,1201); close(r.current.rows.at(-1).balance,98800);
});
test('invalid amounts, date order, dates and oversized lump sums are rejected',()=>{
  for(const patch of [{balance:-1},{annualRate:31},{payment:-1},{extra:NaN},{lumpSum:120001},{nextPayment:'2026-13'},{maturity:'2026-11'},{maturity:'2400-01'}]) assert.throws(()=>simulateManagement({...input,...patch}));
  close(simulateManagement({...input,payment:monthlyPayment(120000,0,10)}).current.totalInterest,0);
});
test('management defaults roll the next month and original term across calendar years',()=>{
  const d=managementDefaults(new Date(2026,11,23));
  assert.equal(d.manageNext,'2027-01'); assert.equal(d.manageMaturity,'2056-12');
});
test('management labels and help are available in both languages',()=>{
  const source=readFileSync(new URL('../src/components/management-calculator.tsx',import.meta.url),'utf8');
  const en=createTranslator('en'),zh=createTranslator('zh');
  for(const [,key] of source.matchAll(/\bt\('([^']+)'/g)) {
    assert.ok(!/[\u3400-\u9fff]/u.test(en(key)),`Missing English translation: ${key}`); assert.equal(zh(key),key);
  }
});
