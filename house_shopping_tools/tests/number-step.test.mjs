import assert from 'node:assert/strict';
import { test } from 'node:test';
import { numberBounds, stepNumber } from '../src/lib/number-step.ts';

test('uses the same decimal-safe increment for the keyboard and buttons', () => {
  const bounds = numberBounds(-20, 30);
  assert.equal(stepNumber('6.25', 1, .1, bounds, false), '6.35');
  assert.equal(stepNumber('6.35', -1, .1, bounds, false), '6.25');
  assert.equal(stepNumber('0', -1, .1, bounds, false), '-0.1');
  assert.equal(stepNumber('1e-3', 1, .1, bounds, false), '0.101');
});

test('stops at a bound, including when the remaining distance is less than one step', () => {
  const bounds = numberBounds(.01, 120250);
  assert.equal(stepNumber('120000', 1, 1000, bounds, false), '120250');
  assert.equal(stepNumber('120250', 1, 1000, bounds, false), '120250');
  assert.equal(stepNumber('25', -1, 1000, bounds, false), '0.01');
});

test('the arrows recover a cleared, fractional, or out-of-range whole number', () => {
  const bounds = numberBounds(1, 50);
  assert.equal(stepNumber('', 1, 1, bounds, true), '1');
  assert.equal(stepNumber('12.3', 1, 1, bounds, true), '13');
  assert.equal(stepNumber('12.3', -1, 1, bounds, true), '12');
  assert.equal(stepNumber('60', -1, 1, bounds, true), '50');
});
