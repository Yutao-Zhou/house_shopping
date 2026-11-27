import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMoveSettings, moveDefaults } from '../src/lib/home-move.ts';

test('a fixed down payment balances sale proceeds, costs, and cash', () => {
  const r = calculateMoveSettings(moveDefaults);
  assert.equal(r.netSale, 340_000);
  assert.equal(r.moveCosts, 105_500);
  assert.equal(r.overlap, 4_500);
  assert.equal(r.downPayment, 325_000);
  assert.equal(r.principal, 975_000);
  assert.equal(r.purchaseCash, 356_000);
  assert.equal(r.cashAfterMove, 44_500);
  assert.equal(r.reserveGap, 0);
  assert.equal(r.preSaleGap, 325_500);
  const rate = 0.065 / 12;
  const expected = 975_000 * rate / (1 - (1 + rate) ** -360);
  assert.ok(Math.abs(r.payment - expected) < 1e-8);
  assert.ok(Math.abs(r.monthlyHousing - r.payment - (14_300 + 2_400) / 12) < 1e-8);
});

test('using available cash leaves the reserve and spends prepaids once', () => {
  const r = calculateMoveSettings({ ...moveDefaults, downMode: 'available', downPercent: '' });
  assert.equal(r.downPayment, 339_500);
  assert.equal(r.principal, 960_500);
  assert.equal(r.cashAfterMove, 30_000);
  assert.equal(r.reserveGap, 0);
});

test('negative sale proceeds reduce funds and identify cash needed even at zero down', () => {
  const input = { ...moveDefaults, payoff: '1020000', savings: '25000', downMode: 'available' };
  const r = calculateMoveSettings(input);
  assert.equal(r.netSale, -80_000);
  assert.equal(r.downPayment, 0);
  assert.equal(r.principal, 1_300_000);
  assert.equal(r.cashAfterMove, -105_500);
  assert.equal(r.reserveGap, 135_500);
  assert.equal(r.preSaleGap, 55_500);
});

test('large proceeds fund a cash purchase and preserve excess cash', () => {
  const r = calculateMoveSettings({ ...moveDefaults, downMode: 'available', buyPrice: '200000', monthlyPmi: '100', taxMode: 'fixed', insuranceMode: 'fixed' });
  assert.equal(r.downPayment, 200_000);
  assert.equal(r.principal, 0);
  assert.equal(r.payment, 0);
  assert.equal(r.cashAfterMove, 169_500);
  assert.equal(r.monthlyHousing, (14_300 + 2_400) / 12);
});

test('new home price reprices linked tax and insurance without using the old sale price', () => {
  const r = calculateMoveSettings({ ...moveDefaults, buyPrice: '2600000', salePrice: '1040000' });
  assert.ok(Math.abs(r.monthlyHousing - r.payment - (28_600 + 4_800) / 12) < 1e-8);
  const mixed = calculateMoveSettings({ ...moveDefaults, buyPrice: '2600000', insuranceMode: 'fixed' });
  assert.ok(Math.abs(mixed.monthlyHousing - mixed.payment - (28_600 + 2_400) / 12) < 1e-8);
});

test('invalid amounts, terms and overlap are rejected', () => {
  for (const values of [{ salePrice: '0' }, { buyPrice: '0' }, { annualRate: 'Infinity' }, { years: '1.5' }, { overlapMonths: '37' }, { prepaids: '-2' }, { downPercent: '' }]) {
    assert.throws(() => calculateMoveSettings({ ...moveDefaults, ...values }));
  }
});
