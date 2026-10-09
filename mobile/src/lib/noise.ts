export type NoiseEvidence = {
  uri: string;
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

// Nominal mobile calibration offset to map 0 dBFS to reference peak acoustic SPL (~96 dB SPL)
export const NOMINAL_CALIBRATION_OFFSET_DB = 96.0;

export function estimateDbaFromDbfs(dbfs: number): number {
  if (!Number.isFinite(dbfs) || dbfs <= -160) return 0;
  return Math.max(0, Math.min(140, dbfs + NOMINAL_CALIBRATION_OFFSET_DB));
}

// Recording-quality cutoff: silent/covered phone rejection
export const MIN_RECORDING_PEAK_DBFS = -60;
export const QUIET_RECORDING_MESSAGE =
  'This sample is at or below the recording-quality cutoff. Please record again while the noise is happening. Point your microphone toward the noise and keep it uncovered.';

// Statutory threshold limits (Noise Pollution Rules, 2000)
export const DAYTIME_ACTIONABLE_DBA = 65.0; // Daytime commercial/mixed threshold
export const DAYTIME_ACTIONABLE_PEAK_DBA = 75.0; // Peak blast threshold
export const NIGHT_ACTIONABLE_DBA = 50.0; // Night curfew / silence-zone threshold

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
  const effectiveDba = evidence.average_dba ?? estimateDbaFromDbfs(evidence.average_dbfs);
  const effectivePeakDba = evidence.peak_dba ?? estimateDbaFromDbfs(evidence.peak_dbfs);

  // 1. Silent or covered recording
  if (!isUsableNoiseRecording(evidence)) {
    return {
      actionable: false,
      effectiveDba,
      effectivePeakDba,
      thresholdDba: DAYTIME_ACTIONABLE_DBA,
      reason: QUIET_RECORDING_MESSAGE,
    };
  }

  // 2. Night-time (22:00 - 06:00 IST) or Sensitive Zone
  if (isNight || nearSensitiveSite) {
    const threshold = NIGHT_ACTIONABLE_DBA;
    if (isNight) {
      // Under Rule 5(2), loudspeakers are banned during night curfew by default.
      // If peak is above silent cutoff, complaint is permissible citing night curfew.
      return {
        actionable: true,
        effectiveDba,
        effectivePeakDba,
        thresholdDba: threshold,
      };
    }

    if (effectiveDba >= threshold || effectivePeakDba >= threshold + 10) {
      return {
        actionable: true,
        effectiveDba,
        effectivePeakDba,
        thresholdDba: threshold,
      };
    }

    return {
      actionable: false,
      effectiveDba,
      effectivePeakDba,
      thresholdDba: threshold,
      reason: `Recorded level (~${effectiveDba.toFixed(1)} dB(A)) is below the silence-zone actionable threshold (${threshold} dB(A)). Please record when the loudspeaker or disturbance is audible.`,
    };
  }

  // 3. Daytime standard threshold (65 dB(A) average or 75 dB(A) peak)
  if (effectiveDba >= DAYTIME_ACTIONABLE_DBA || effectivePeakDba >= DAYTIME_ACTIONABLE_PEAK_DBA) {
    return {
      actionable: true,
      effectiveDba,
      effectivePeakDba,
      thresholdDba: DAYTIME_ACTIONABLE_DBA,
    };
  }

  return {
    actionable: false,
    effectiveDba,
    effectivePeakDba,
    thresholdDba: DAYTIME_ACTIONABLE_DBA,
    reason: `Measured noise level (~${effectiveDba.toFixed(1)} dB(A), peak ${effectivePeakDba.toFixed(1)} dB(A)) is below the statutory actionable daytime limit of ${DAYTIME_ACTIONABLE_DBA} dB(A). Filing is restricted to verifiable high-decibel disturbances. Record while the loudspeaker/DJ is active.`,
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
    average_dba: estimateDbaFromDbfs(average_dbfs),
    peak_dba: estimateDbaFromDbfs(peak_dbfs),
    sample_count: valid.length,
    unit: 'dBFS' as const,
  };
}
