// Approximate app submission policy, not a certified legal assessment.
export const RESIDENTIAL_DAY_DBA = 55;
export const RESIDENTIAL_NIGHT_DBA = 45;
export function evaluateResidentialNoiseEstimate(averageDba: number | undefined, isNight: boolean) {
  const thresholdDba = isNight ? RESIDENTIAL_NIGHT_DBA : RESIDENTIAL_DAY_DBA;
  if (averageDba == null || !Number.isFinite(averageDba) || averageDba < 0 || averageDba > 160) return { allowed: false, thresholdDba, reason: 'An A-weighted estimate is unavailable. Use the updated Android app and record again.' };
  if (averageDba <= thresholdDba) return { allowed: false, thresholdDba, reason: `The estimated average (${averageDba.toFixed(1)} dB(A)) is at or below the ${thresholdDba} dB(A) ${isNight ? 'night' : 'day'} limit used by this app. Please re-record while the noise is happening, pointing the microphone toward it. This is an approximate recording filter, not a certified legal assessment.` };
  return { allowed: true, thresholdDba };
}
