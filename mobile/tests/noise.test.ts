import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isUsableNoiseRecording, summarizeLevels } from '../src/lib/noise.ts';

test('digital microphone readings retain their units and average power rather than decibel numbers', () => {
  const sample = summarizeLevels([-20, -40]);
  assert.equal(sample.unit, 'dBFS'); assert.equal(sample.peak_dbfs, -20);
  assert.ok(Math.abs(sample.average_dbfs - -22.9670862188) < 0.0001);
  assert.throws(() => summarizeLevels([NaN, Infinity, 99, -20]));
});

test('silent evidence is rejected and a subsequent audible recording can be used', () => {
  assert.equal(isUsableNoiseRecording(summarizeLevels([-160, -160, -160])), false);
  assert.equal(isUsableNoiseRecording(summarizeLevels([-90, -61, -80])), false);
  assert.equal(isUsableNoiseRecording(summarizeLevels([-90, -60, -80])), false);
  assert.equal(isUsableNoiseRecording(summarizeLevels([-90, -59.9, -80])), true);
  assert.equal(isUsableNoiseRecording(summarizeLevels([-25, -20, -22])), true);
  assert.equal(isUsableNoiseRecording({ peak_dbfs: NaN }), false);
  assert.equal(isUsableNoiseRecording({ peak_dbfs: 1 }), false);
});
