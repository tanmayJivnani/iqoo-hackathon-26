import { evaluateResidentialNoiseEstimate, RESIDENTIAL_DAY_DBA, RESIDENTIAL_NIGHT_DBA } from '../../../shared/noise-policy.ts';
export type NoiseEvidence = {
  uri: string;
  video_uri?: string;
  captured_at: string;
  duration_ms: number;
  average_dbfs: number;
  peak_dbfs: number;
  average_dba?: number;
  peak_dba?: number;
  sample_count: number;
  unit: 'dBFS';
  near_sensitive_site: boolean;
  site_label?: string;
  measurement_method?: 'KOTLIN_AUDIO_RECORD_A_WEIGHTED' | 'EXPO_AUDIO_METERED';
};

// Recording-quality cutoff: silent/covered phone rejection
export const MIN_RECORDING_PEAK_DBFS = -60;
export const QUIET_RECORDING_MESSAGE =
  'This sample is at or below the recording-quality cutoff. Please record again while the noise is happening. Point your microphone toward the noise and keep it uncovered.';

export const DAYTIME_ACTIONABLE_DBA = RESIDENTIAL_DAY_DBA;
export const NIGHT_ACTIONABLE_DBA = RESIDENTIAL_NIGHT_DBA;

export function isUsableNoiseRecording(levels: Pick<NoiseEvidence, 'peak_dbfs'>) {
  return Number.isFinite(levels.peak_dbfs) && levels.peak_dbfs > MIN_RECORDING_PEAK_DBFS && levels.peak_dbfs <= 0;
}

export type ActionabilityResult = {
  actionable: boolean;
  effectiveDba: number;
  effectivePeakDba: number;
  thresholdDba: number;
  reason?: string;
};

export function evaluateNoiseActionability(
  evidence: Pick<NoiseEvidence, 'average_dbfs' | 'peak_dbfs' | 'average_dba' | 'peak_dba'>,
  isNight: boolean,
  nearSensitiveSite: boolean
): ActionabilityResult {
  const effectiveDba = evidence.average_dba ?? 0;
  const effectivePeakDba = evidence.peak_dba ?? 0;
  const thresholdDba = isNight ? NIGHT_ACTIONABLE_DBA : DAYTIME_ACTIONABLE_DBA;
  // An observed nearby school/hospital does not establish a notified silence zone.
  void nearSensitiveSite;

  // 1. Silent or covered recording
  if (!isUsableNoiseRecording(evidence)) {
    return {
      actionable: false,
      effectiveDba,
      effectivePeakDba,
      thresholdDba,
      reason: QUIET_RECORDING_MESSAGE,
    };
  }

  const policy = evaluateResidentialNoiseEstimate(evidence.average_dba, isNight);
  return {
    actionable: policy.allowed,
    effectiveDba,
    effectivePeakDba,
    thresholdDba,
    reason: policy.reason,
  };
}

export function summarizeLevels(samples: number[]) {
  const valid = samples.filter(value => Number.isFinite(value) && value >= -160 && value <= 0);
  if (valid.length < 2) throw new Error('Microphone readings were unavailable. Please record another sample.');
  const meanPower = valid.reduce((sum, value) => sum + 10 ** (value / 10), 0) / valid.length;
  const average_dbfs = 10 * Math.log10(meanPower);
  const peak_dbfs = Math.max(...valid);
  return {
    average_dbfs,
    peak_dbfs,
    sample_count: valid.length,
    unit: 'dBFS' as const,
  };
}
