export type NoiseEvidence = { uri: string; captured_at: string; duration_ms: number; average_dbfs: number; peak_dbfs: number; sample_count: number; unit: 'dBFS'; near_sensitive_site: boolean; site_label?: string };
export function summarizeLevels(samples: number[]) {
  const valid = samples.filter(value => Number.isFinite(value) && value >= -160 && value <= 0);
  if (valid.length < 2) throw new Error('Microphone readings were unavailable. Please record another sample.');
  const meanPower = valid.reduce((sum, value) => sum + 10 ** (value / 10), 0) / valid.length;
  return { average_dbfs: 10 * Math.log10(meanPower), peak_dbfs: Math.max(...valid), sample_count: valid.length, unit: 'dBFS' as const };
}
