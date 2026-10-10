import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateNoiseActionability,
  isUsableNoiseRecording,
  summarizeLevels,
  DAYTIME_ACTIONABLE_DBA,
} from '../src/lib/noise.ts';

test('digital microphone readings retain their units and average power rather than decibel numbers', () => {
  const sample = summarizeLevels([-20, -40]);
  assert.equal(sample.unit, 'dBFS');
  assert.equal(sample.peak_dbfs, -20);
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

test('approximate residential policy uses average levels, excludes equality and rejects missing estimates', () => {
  // Nominal estimates cannot certify a breach or disqualify an otherwise usable recording.
  const quietDaytime = { average_dbfs: -40, peak_dbfs: -35, average_dba: 56, peak_dba: 61 };
  const quietCheck = evaluateNoiseActionability(quietDaytime, false, false);
  assert.equal(quietCheck.actionable, true);
  assert.equal(quietCheck.thresholdDba, 55);
  assert.equal(DAYTIME_ACTIONABLE_DBA, 55);

  // The same quality check applies to loud samples.
  const loudDaytime = { average_dbfs: -20, peak_dbfs: -15, average_dba: 76, peak_dba: 81 };
  const loudCheck = evaluateNoiseActionability(loudDaytime, false, false);
  assert.equal(loudCheck.actionable, true);

  // Nighttime changes the reference value, not confidence in an uncalibrated sensor.
  const nightCheck = evaluateNoiseActionability(quietDaytime, true, false);
  assert.equal(nightCheck.actionable, true);
  assert.equal(nightCheck.thresholdDba, 45);
  const silent = summarizeLevels([-160, -160]);
  for (const isNight of [false, true]) {
    assert.equal(evaluateNoiseActionability(silent, isNight, true).actionable, false);
  }
  assert.equal('average_dba' in summarizeLevels([-40, -35]), false);
  for (const [isNight, limit] of [[false, 55], [true, 45]] as const) {
    const evidence = { average_dbfs: -35, peak_dbfs: -10, average_dba: limit, peak_dba: 100 };
    assert.equal(evaluateNoiseActionability(evidence, isNight, true).actionable, false);
    assert.equal(evaluateNoiseActionability({ ...evidence, average_dba: limit - 0.1 }, isNight, false).actionable, false);
    assert.equal(evaluateNoiseActionability({ ...evidence, average_dba: limit + 0.1 }, isNight, false).actionable, true);
    assert.equal(evaluateNoiseActionability(summarizeLevels([-20, -15]), isNight, false).actionable, false);
    assert.equal(evaluateNoiseActionability({ ...evidence, average_dba: NaN }, isNight, false).actionable, false);
  }
});
