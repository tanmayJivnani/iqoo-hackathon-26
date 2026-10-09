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

test('actionability rejects low-volume daytime noise but accepts loud disturbances and night curfew violations', () => {
  // Low daytime noise: ~56 dB(A) (below 65 dB(A) limit)
  const quietDaytime = { average_dbfs: -40, peak_dbfs: -35, average_dba: 56, peak_dba: 61 };
  const quietCheck = evaluateNoiseActionability(quietDaytime, false, false);
  assert.equal(quietCheck.actionable, false);
  assert.ok(quietCheck.reason?.includes(`below the statutory actionable daytime limit of ${DAYTIME_ACTIONABLE_DBA}`));

  // Loud daytime DJ: ~76 dB(A) (above 65 dB(A) limit)
  const loudDaytime = { average_dbfs: -20, peak_dbfs: -15, average_dba: 76, peak_dba: 81 };
  const loudCheck = evaluateNoiseActionability(loudDaytime, false, false);
  assert.equal(loudCheck.actionable, true);

  // Night curfew: same 56 dB(A) noise is actionable at night because Rule 5 prohibits night loudspeakers
  const nightCheck = evaluateNoiseActionability(quietDaytime, true, false);
  assert.equal(nightCheck.actionable, true);
});
