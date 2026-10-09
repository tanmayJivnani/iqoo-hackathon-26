export type NoiseEvidence = { uri: string; captured_at: string; duration_ms: number; average_dbfs: number; peak_dbfs: number; sample_count: number; unit: 'dBFS'; near_sensitive_site: boolean; site_label?: string };
// Recording-quality cutoff only: dBFS cannot establish ambient dB(A) pollution.
export const MIN_RECORDING_PEAK_DBFS = -60;
export const QUIET_RECORDING_MESSAGE = 'This sample is at or below the recording-quality cutoff. Please record again while the noise is happening. Point your microphone toward the noise and keep it uncovered.';
export function isUsableNoiseRecording(levels: Pick<NoiseEvidence, 'peak_dbfs'>) {
  return Number.isFinite(levels.peak_dbfs) && levels.peak_dbfs > MIN_RECORDING_PEAK_DBFS && levels.peak_dbfs <= 0;
}
export function summarizeLevels(samples: number[]) {
  const valid = samples.filter(value => Number.isFinite(value) && value >= -160 && value <= 0);
  if (valid.length < 2) throw new Error('Microphone readings were unavailable. Please record another sample.');
  const meanPower = valid.reduce((sum, value) => sum + 10 ** (value / 10), 0) / valid.length;
  return { average_dbfs: 10 * Math.log10(meanPower), peak_dbfs: Math.max(...valid), sample_count: valid.length, unit: 'dBFS' as const };
}
