import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wavWaveform, waveformHeights } from '../src/lib/audio-waveform.ts';

function wav(samples: number[], metadata = false) {
  const bytes = new Uint8Array(44 + samples.length * 2 + (metadata ? 10 : 0));
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => { bytes[offset + i] = c.charCodeAt(0); });
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  let data = 36;
  if (metadata) { text(36, 'JUNK'); view.setUint32(40, 1, true); bytes[44] = 42; data += 10; }
  text(data, 'data'); view.setUint32(data + 4, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(data + 8 + index * 2, sample, true));
  return bytes;
}

test('waveform preserves loud and quiet parts of the actual recording, including padded metadata', () => {
  const peaks = wavWaveform(wav([0, 0, -32768, 16384, 8192, -4096, 0, 0], true), 4);
  assert.deepEqual(peaks, [0, 1, 0.25, 0]);
  assert.deepEqual(waveformHeights(peaks!), [4, 36, 20, 4]);
});

test('silent audio renders a flat baseline instead of invented peaks', () => {
  assert.deepEqual(waveformHeights(wavWaveform(wav([0, 0, 0, 0]), 4)!), [4, 4, 4, 4]);
});

test('unsupported formats and truncated WAV chunks safely fall back to playback samples', () => {
  assert.equal(wavWaveform(new Uint8Array(44)), null);
  const bytes = wav([100, -100]);
  assert.equal(wavWaveform(bytes.subarray(0, bytes.length - 1)), null);
  new DataView(bytes.buffer).setUint16(34, 24, true);
  assert.equal(wavWaveform(bytes), null);
});
