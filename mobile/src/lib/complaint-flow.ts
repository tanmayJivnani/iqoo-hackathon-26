export type PhotoGuard = { count: number; cooldownUntil: number };

export function nextPhotoRejection(guard: PhotoGuard, now = Date.now()): PhotoGuard {
  const count = guard.cooldownUntil > 0 && guard.cooldownUntil <= now ? 1 : guard.count + 1;
  return count >= 3 ? { count: 0, cooldownUntil: now + 3 * 60 * 60 * 1000 } : { count, cooldownUntil: 0 };
}

export function canUseLocalAnalysis(result?: { available: boolean; treeDetected: boolean }): boolean {
  return result?.available === true && result.treeDetected === true;
}

export function isResolved(status: string): boolean {
  return status === 'VERIFIED_RESOLVED';
}

// FastAPI stores naive UTC datetimes; JavaScript otherwise treats these as local time.
export function apiDate(value: string): Date {
  return new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}

export function isTimelocked(status?: string, dueAt?: string | null, now = Date.now()): boolean {
  return status === 'PENDING_TIMELOCK' && !!dueAt && apiDate(dueAt).getTime() > now;
}

export function verificationLabel(status?: string, dueAt?: string | null): string {
  if (status === 'PENDING_TIMELOCK') return isTimelocked(status, dueAt) ? 'Reverify later' : 'Ready to reverify';
  const labels: Record<string, string> = {
    REPORTED: 'Reported', VERIFIED_RESOLVED: 'Resolved',
    VERIFIED_UNRESOLVED_ESCALATED: 'Unresolved · Follow-up requested',
    VERIFIED_INCONCLUSIVE: 'Needs another photo check',
    AWAITING_CITIZEN_PHOTO: 'Needs another photo check',
  };
  return labels[status || ''] || (status ? status.toLowerCase().replaceAll('_', ' ') : 'Reported');
}

export function reverificationMessage(dueAt?: string | null): string {
  if (!dueAt) return 'Reverify this concern';
  const date = apiDate(dueAt);
  if (!Number.isFinite(date.getTime())) return 'Reverify later';
  if (date.getTime() <= Date.now()) return 'Ready to reverify';
  const when = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(date);
  return `Reverify after ${when}`;
}
