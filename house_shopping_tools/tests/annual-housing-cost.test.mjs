import assert from 'node:assert/strict';
import test from 'node:test';
import { annualHousingCost, changeCostMode, restoreCostModes, resolveHousingCosts, costModeDefaults } from '../src/lib/annual-housing-cost.ts';

test('one cost can scale with price while the other stays locked', () => {
  const values = { ...costModeDefaults, tax: '11000', insurance: '1945.63', insuranceMode: 'fixed' };
  assert.deepEqual(resolveHousingCosts('1000000', values), { tax: 11000, insurance: 1945.63 });
  assert.deepEqual(resolveHousingCosts('1500000', values), { tax: 16500, insurance: 1945.63 });
});

test('converting modes retains the current estimate to the cent', () => {
  const fixed = { mode: 'fixed', amount: '1945.63', rate: '0.18' };
  const linked = changeCostMode('1370000', fixed, 'price');
  assert.equal(annualHousingCost('1370000', linked), 1945.63);
  assert.equal(annualHousingCost('2740000', linked), 3891.26);
  const locked = changeCostMode('2740000', linked, 'fixed');
  assert.equal(annualHousingCost('2500000', locked), 3891.26);
});

test('fixed amounts can be used without a home price and legacy plans remain fixed', () => {
  const legacy = { tax: '9999', insurance: '1234' };
  const values = { ...costModeDefaults, ...legacy, ...restoreCostModes(legacy) };
  assert.deepEqual(resolveHousingCosts('', values), { tax: 9999, insurance: 1234 });
  assert.deepEqual(restoreCostModes({ taxMode: 'price', insuranceMode: 'fixed' }), { taxMode: 'price', insuranceMode: 'fixed' });
});

test('linked mode rejects missing or invalid inputs while zero rates remain valid', () => {
  const linked = { mode: 'price', amount: '1500', rate: '1' };
  for (const price of ['', '0', '-100', 'Infinity']) assert.equal(annualHousingCost(price, linked), null);
  for (const rate of ['', '-1', 'Infinity']) assert.equal(annualHousingCost('1000000', { ...linked, rate }), null);
  assert.equal(annualHousingCost('1000000', { ...linked, rate: '0' }), 0);
});
