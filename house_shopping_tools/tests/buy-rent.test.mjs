import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateBuyRent } from '../src/lib/buy-rent.ts';
import { createTranslator } from '../src/lib/i18n.ts';

const simple = {price:120000,downPercent:0,annualRate:0,loanYears:10,extra:0,annualTax:0,annualInsurance:0,monthlyHoa:0,monthlyPmi:0,monthlyRent:500,monthlyRenterInsurance:0,rentGrowth:0,homeGrowth:0,investmentReturn:0,costGrowth:0,maintenancePercent:0,purchaseCostPercent:0,sellingCostPercent:0,years:1};
const close = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);

test('principal repayment creates equity once, with equal monthly household budgets', () => {
  const r=simulateBuyRent(simple);
  close(r.final.mortgageBalance,108000); close(r.final.homeEquity,12000);
  close(r.final.buyerNetWorth,12000); close(r.final.renterNetWorth,6000); close(r.final.difference,6000);
  for(const row of r.monthly) close(row.buyerHousingCost+row.buyerContribution,row.renterHousingCost+row.renterContribution);
  close(r.final.annualBuyCost,12000); close(r.final.annualRentCost,6000);
});

test('equal starting cash includes closing costs, and each hypothetical sale deducts selling costs once', () => {
  const r=simulateBuyRent({...simple,price:100000,downPercent:20,purchaseCostPercent:2,sellingCostPercent:6,years:3});
  close(r.initialCapital,22000); close(r.monthly[0].renterPortfolio,22000);
  close(r.monthly[0].buyerNetWorth,14000); close(r.monthly[0].difference,-8000);
  for(const row of r.yearly) { close(row.homeValue,100000); close(row.sellingCosts,6000); close(row.buyerNetWorth,row.homeEquity-6000+row.buyerPortfolio); }
  const noSelling=simulateBuyRent({...simple,price:100000,downPercent:20,purchaseCostPercent:2,years:3});
  close(noSelling.final.buyerNetWorth-r.final.buyerNetWorth,6000);
  close(noSelling.final.renterNetWorth,r.final.renterNetWorth);
});

test('effective annual investment return compounds with month-end contributions', () => {
  const r=simulateBuyRent({...simple,downPercent:20,investmentReturn:12});
  const monthlyReturn=1.12**(1/12)-1, contribution=800-500;
  close(r.final.renterPortfolio,24000*1.12+contribution*((1+monthlyReturn)**12-1)/monthlyReturn);
  close(r.renterInvestmentGain,r.final.renterPortfolio-r.final.renterContributed);
});

test('the buyer invests when renting costs more, including after mortgage payoff', () => {
  const r=simulateBuyRent({...simple,loanYears:1,monthlyRent:2000,years:2});
  close(r.monthly[12].mortgageBalance,0); close(r.monthly[13].mortgagePayment,0);
  close(r.monthly[13].buyerContribution,2000);
  close(r.final.buyerPortfolio,24000); close(r.final.renterPortfolio,96000);
  close(r.final.buyerNetWorth,144000); close(r.final.difference,48000);
  assert.ok(r.monthly.every(row=>row.buyerContribution===0 || row.renterContribution===0));
});

test('rent and running costs reset annually, while maintenance tracks the current home value', () => {
  const r=simulateBuyRent({...simple,downPercent:100,annualTax:1200,annualInsurance:600,monthlyHoa:100,monthlyRenterInsurance:20,rentGrowth:10,costGrowth:5,homeGrowth:12,maintenancePercent:1,years:2});
  close(r.yearly[1].homeValue,120000*1.12);
  close(r.monthly[12].renterHousingCost,520); close(r.monthly[13].renterHousingCost,550+21);
  close(r.monthly[1].buyerHousingCost,100+50+100+100);
  close(r.monthly[13].buyerHousingCost,(100+50+100)*1.05+120000*1.12*.01/12);
});

test('PMI and loan payments stop after payoff; tax, insurance and HOA continue', () => {
  const r=simulateBuyRent({...simple,loanYears:1,monthlyPmi:100,annualTax:1200,annualInsurance:600,monthlyHoa:50,years:2});
  close(r.monthly[12].buyerHousingCost,10000+100+100+50+50);
  close(r.monthly[13].buyerHousingCost,200);
  const early=simulateBuyRent({...simple,annualRate:6.5,extra:10000000,years:2});
  assert.equal(early.mortgage.months,1); close(early.monthly[2].mortgagePayment,0); close(early.monthly[2].mortgageBalance,0);
});

test('negative returns and home prices retain finite results and can produce negative equity', () => {
  const r=simulateBuyRent({...simple,downPercent:5,homeGrowth:-20,investmentReturn:-50,years:2});
  close(r.final.homeValue,120000*.8**2);
  assert.ok(r.final.homeEquity<0); assert.ok(r.renterInvestmentGain<0);
  assert.ok(r.monthly.every(row=>Object.values(row).every(Number.isFinite)));
  const cash=simulateBuyRent({...simple,price:120000.37,downPercent:100,monthlyPmi:500,years:2});
  close(cash.firstMonth.mortgagePayment,0); close(cash.firstMonth.buyerHousingCost,0);
});

test('yearly totals reconcile all monthly costs, contributions and final portfolio wealth', () => {
  const r=simulateBuyRent({...simple,price:1000000,downPercent:20,annualRate:6.5,loanYears:30,annualTax:11000,annualInsurance:1800,monthlyRent:4500,monthlyRenterInsurance:20,rentGrowth:3,homeGrowth:3,investmentReturn:7,costGrowth:2,maintenancePercent:1,purchaseCostPercent:2,sellingCostPercent:6,years:40});
  close(r.yearly.reduce((sum,row)=>sum+row.annualBuyCost,0),r.final.buyerHousingPaid,1e-5);
  close(r.yearly.reduce((sum,row)=>sum+row.annualRentCost,0),r.final.renterHousingPaid,1e-5);
  close(r.yearly.reduce((sum,row)=>sum+row.annualBuyInvestment,0),r.final.buyerContributed,1e-5);
  close(r.yearly.reduce((sum,row)=>sum+row.annualRentInvestment,0)+r.initialCapital,r.final.renterContributed,1e-5);
  close(r.final.buyerNetWorth,r.final.homeValue-r.final.mortgageBalance-r.final.sellingCosts+r.final.buyerPortfolio);
  close(r.final.renterNetWorth,r.final.renterContributed+r.renterInvestmentGain);
  assert.equal(r.yearly.length,41); assert.equal(r.monthly.length,481);
});

test('invalid rates, costs and horizons are rejected, including nonfinite inputs', () => {
  for(const patch of [{price:0},{downPercent:101},{annualRate:-1},{loanYears:1.5},{monthlyRent:-1},{purchaseCostPercent:21},{sellingCostPercent:-1},{maintenancePercent:25},{investmentReturn:-100},{homeGrowth:-21},{rentGrowth:21},{costGrowth:30},{years:0},{years:1.5},{years:51},{monthlyRent:NaN}]) assert.throws(()=>simulateBuyRent({...simple,...patch}));
  const missing={...simple}; delete missing.homeGrowth;
  assert.throws(()=>simulateBuyRent(missing),/invalid_buy_rent_inputs/);
});

test('Buy vs Rent labels and help are translated in English and preserved in Chinese', () => {
  const source=readFileSync(new URL('../src/components/buy-rent-simulator.tsx',import.meta.url),'utf8');
  const en=createTranslator('en'),zh=createTranslator('zh');
  for(const [,key] of source.matchAll(/\bt\('([^']+)'/g)) {
    assert.ok(!/[\u3400-\u9fff]/u.test(en(key)),`Missing English translation: ${key}`);
    assert.equal(zh(key),key);
  }
});
