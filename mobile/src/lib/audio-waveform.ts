/** Read real amplitude peaks from the PCM16 WAV files produced by AudioMeter. */
export function wavWaveform(bytes: Uint8Array, bins = 48): number[] | null {
  if (bytes.length < 44 || bins < 1) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let pcm16 = false;
  let dataOffset = 0;
  let dataLength = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.length) return null;
    if (tag(offset) === 'fmt ' && size >= 16) {
      pcm16 = view.getUint16(start, true) === 1 && view.getUint16(start + 14, true) === 16;
    }
    if (tag(offset) === 'data') { dataOffset = start; dataLength = size; }
    offset = start + size + (size % 2);
  }
  if (!pcm16 || dataLength < 2 || dataLength % 2) return null;
  const samples = dataLength / 2;
  const peaks = Array.from({ length: bins }, () => 0);
  for (let index = 0; index < samples; index++) {
    const bin = Math.min(bins - 1, Math.floor(index * bins / samples));
    peaks[bin] = Math.max(peaks[bin], Math.abs(view.getInt16(dataOffset + index * 2, true)) / 32768);
  }
  return peaks;
}

export function waveformHeights(peaks: number[]): number[] {
  const max = Math.max(...peaks, 0.001);
  return peaks.map(peak => 4 + 32 * Math.sqrt(Math.max(0, peak) / max));
}
