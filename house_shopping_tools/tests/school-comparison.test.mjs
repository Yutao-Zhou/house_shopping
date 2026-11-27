import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateSchoolComparison, schoolDefaults } from '../src/lib/school-comparison.ts';

const freeOwnership = { tax: '0', insurance: '0', taxMode: 'fixed', insuranceMode: 'fixed', taxRate: '0', insuranceRate: '0' };
const neutral = {
  ...schoolDefaults, horizon: '3', tuition: '0', tuitionGrowth: '0', publicSchool: '0',
  currentPrice: '100000', currentBalance: '0', currentMonths: '0', currentOther: '0', currentGrowth: '0',
  districtPrice: '100000', districtDown: '100', districtOther: '0', districtGrowth: '0',
  currentCosts: freeOwnership, districtCosts: freeOwnership, savings: '0',
  sellRate: '0', buyingCosts: '0', movingCosts: '0', exitRate: '0',
  investmentReturn: '0', holdingGrowth: '0',
};

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `Expected ${expected}, got ${actual}`);

test('identical homes with no costs finish even, and price gains flow through to net worth', () => {
  const equal = calculateSchoolComparison(neutral);
  assert.equal(equal.final.private.netWorth, equal.final.district.netWorth);
  const growth = calculateSchoolComparison({ ...neutral, districtGrowth: '10', exitRate: '5' });
  near(growth.final.district.homeValue, 133100);
  near(growth.final.district.appreciation, 33100);
  near(growth.final.district.netWorth, 126445);
  near(growth.final.private.netWorth, 95000);
});

test('school costs reflect child count, annual increases, and the end of enrollment', () => {
  const result = calculateSchoolComparison({
    ...neutral, tuition: '10000', children: '2', tuitionGrowth: '10', schoolYears: '2', publicSchool: '1000',
  });
  assert.deepEqual(result.yearly.map(row => row.tuition), [0, 20000, 22000, 0]);
  assert.deepEqual(result.yearly.map(row => row.publicSchool), [0, 2000, 2000, 0]);
  near(result.firstMonth.tuition, 20000 / 12);
  near(result.final.totalPrivateCash, 42000);
  near(result.final.totalDistrictCash, 4000);
  near(result.final.district.portfolio, 38000);
});

test('selling proceeds offset day-one cash and taking out a loan does not count principal as an expense', () => {
  const result = calculateSchoolComparison({
    ...neutral, horizon: '1', currentBalance: '50000', currentRate: '0', currentMonths: '24',
    districtDown: '50', districtRate: '0', districtTerm: '1', savings: '20000',
    sellRate: '5', buyingCosts: '2000', movingCosts: '1000',
  });
  assert.equal(result.move.netSale, 45000);
  assert.equal(result.netMoveCash, 8000);
  assert.equal(result.move.cashAfterMove, 12000);
  assert.equal(result.move.principal, 50000);
  near(result.final.totalPrivateCash, 25000);
  near(result.final.totalPrivateExpense, 0);
  near(result.final.totalDistrictCash, 58000);
  near(result.final.totalDistrictExpense, 8000);
  assert.equal(result.final.district.mortgageBalance, 0);
});

test('a funding gap is shown separately and the projections use equal funded starting cash', () => {
  const result = calculateSchoolComparison({ ...neutral, districtPrice: '130000', savings: '5000' });
  assert.equal(result.cashGap, 25000);
  assert.equal(result.openingCash, 30000);
  assert.equal(result.yearly[0].private.portfolio, 30000);
  assert.equal(result.yearly[0].district.portfolio, 0);
  assert.equal(result.final.private.netWorth, result.final.district.netWorth);
});

test('price-linked holding costs use the selected home and explicit future cost growth', () => {
  const districtCosts = { ...freeOwnership, taxMode: 'price', taxRate: '1.2', insurance: '1200' };
  const result = calculateSchoolComparison({ ...neutral, districtPrice: '200000', districtCosts, holdingGrowth: '10' });
  near(result.firstMonth.districtHousing, 300);
  near(result.yearly[2].districtOutflow, 3960);
  near(result.final.district.homeValue, 200000);
});

test('the cheaper path can switch when tuition ends or the existing mortgage pays off', () => {
  const result = calculateSchoolComparison({
    ...neutral, currentBalance: '12000', currentRate: '0', currentMonths: '12',
    tuition: '1200', schoolYears: '1', districtOther: '100',
  });
  near(result.yearly[1].districtOutflow, 1200);
  near(result.yearly[1].district.portfolio - result.yearly[0].district.portfolio, 12000);
  assert.equal(result.yearly[2].privateOutflow, 0);
  near(result.yearly[2].private.portfolio - result.yearly[1].private.portfolio, 1200);
});

test('rejects incomplete and out-of-range assumptions', () => {
  assert.throws(() => calculateSchoolComparison({ ...neutral, currentBalance: '1' }), /currentTerm/);
  assert.throws(() => calculateSchoolComparison({ ...neutral, children: '1.5' }), /children/);
  assert.throws(() => calculateSchoolComparison({ ...neutral, tuition: '' }), /tuition/);
  assert.throws(() => calculateSchoolComparison({ ...neutral, districtGrowth: '-50' }), /districtGrowth/);
});
