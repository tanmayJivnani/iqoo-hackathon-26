import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeAudio } from '../src/lib/media';

test('WAV evidence rejects truncated containers and accepts the full 30-second native capture', () => {
  const wav = Buffer.alloc(44 + 44100 * 2 * 30);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  assert.equal(decodeAudio(wav.toString('base64')).extension, 'wav');
  assert.throws(() => decodeAudio(wav.subarray(0, 40).toString('base64')));
  assert.throws(() => decodeAudio(wav.subarray(0, wav.length - 2).toString('base64')));
});
