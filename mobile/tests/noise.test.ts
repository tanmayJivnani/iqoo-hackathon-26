import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeLevels } from '../src/lib/noise.ts';

test('digital microphone readings retain their units and average power rather than decibel numbers', () => {
  const sample = summarizeLevels([-20, -40]);
  assert.equal(sample.unit, 'dBFS'); assert.equal(sample.peak_dbfs, -20);
  assert.ok(Math.abs(sample.average_dbfs - -22.9670862188) < 0.0001);
  assert.throws(() => summarizeLevels([NaN, Infinity, 99, -20]));
});
