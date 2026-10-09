import assert from 'node:assert/strict';
import test from 'node:test';
import { apiDate, canUseLocalAnalysis, isResolved, isTimelocked, nextPhotoRejection } from '../src/lib/complaint-flow.ts';

test('three rejections trigger a three-hour cooldown', () => {
  const now = 1000;
  let guard = { count: 0, cooldownUntil: 0 };
  guard = nextPhotoRejection(guard, now);
  guard = nextPhotoRejection(guard, now);
  assert.equal(guard.count, 2);
  assert.deepEqual(nextPhotoRejection(guard, now), { count: 0, cooldownUntil: now + 10_800_000 });
});

test('an expired cooldown starts a new rejection quota', () => {
  assert.deepEqual(nextPhotoRejection({ count: 3, cooldownUntil: 1000 }, 2000), { count: 1, cooldownUntil: 0 });
});

test('failed or unavailable local analysis cannot create an AI draft', () => {
  assert.equal(canUseLocalAnalysis(), false);
  assert.equal(canUseLocalAnalysis({ available: false, treeDetected: true }), false);
  assert.equal(canUseLocalAnalysis({ available: true, treeDetected: false }), false);
  assert.equal(canUseLocalAnalysis({ available: true, treeDetected: true }), true);
});

test('unresolved escalations must not appear resolved', () => {
  assert.equal(isResolved('VERIFIED_UNRESOLVED_ESCALATED'), false);
  assert.equal(isResolved('PENDING_TIMELOCK'), false);
  assert.equal(isResolved('VERIFIED_RESOLVED'), true);
});

test('UTC API dates and the remaining timelock are preserved', () => {
  assert.equal(apiDate('2026-10-09T12:00:00').toISOString(), '2026-10-09T12:00:00.000Z');
  assert.equal(apiDate('2026-10-09T17:30:00+05:30').toISOString(), '2026-10-09T12:00:00.000Z');
  const now = Date.parse('2026-10-09T11:59:00Z');
  assert.equal(isTimelocked('PENDING_TIMELOCK', '2026-10-09T12:00:00', now), true);
  assert.equal(isTimelocked('PENDING_TIMELOCK', '2026-10-09T12:00:00', now + 60_000), false);
  assert.equal(isTimelocked('VERIFIED_UNRESOLVED_ESCALATED', '2026-10-09T12:00:00', now), false);
});
