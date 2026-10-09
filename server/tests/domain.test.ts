import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { routeIssue } from '../src/lib/routing';
import { parseAudit, parseModelJson, comparePhotos } from '../src/lib/ai';
import { auditStatus } from '../src/lib/complaints';
import { ComplaintRepository } from '../src/lib/repository';
import { decodePhoto, mediaPath } from '../src/lib/media';
import { distanceMeters } from '../src/lib/spatial';
import { ApiError, parseBody } from '../src/lib/http';
import { duplicateSchema } from '../src/lib/schemas';
import type { Complaint, Audit } from '../src/lib/types';

export const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('routing keeps emergency intervention and distinct follow-up deadlines', () => {
  assert.equal(routeIssue('ILLEGAL_FELLING', 'IN_PROGRESS').urgency_level, 'CRITICAL_EMERGENCY');
  assert.equal(routeIssue('ILLEGAL_FELLING', 'IN_PROGRESS').routed_authority.emergency_phone, '112');
  assert.equal(routeIssue('ILLEGAL_FELLING_COMPLETED').reverification_due_hours, 48);
  assert.equal(routeIssue('DANGEROUS_LEANING_FALL_RISK').reverification_due_hours, 24);
  assert.equal(routeIssue('UNAUTHORIZED_PRUNING').reverification_due_hours, 72);
  assert.equal(routeIssue('DISEASE_PEST').reverification_due_hours, 168);
  assert.equal(routeIssue('ROOT_CONCRETIZATION').reverification_due_hours, 168);
  assert.equal(routeIssue('NAILS_BOARDS_CABLE_STRANGULATION').reverification_due_hours, 96);
});
test('unresolved and invalid AI verdicts cannot accidentally close a complaint', () => {
  assert.throws(() => parseAudit({ ai_verdict: 'UNRESOLVED', ai_confidence: 0.9, ai_notes_en: 'Still damaged', ai_notes_mr: 'धोका कायम' }));
  const audit: Audit = { ai_verdict: 'INCONCLUSIVE', ai_confidence: 0, ai_notes_en: 'Unavailable', ai_notes_mr: 'उपलब्ध नाही', is_fallback: true, ai_provider: 'UNAVAILABLE' };
  assert.equal(auditStatus(audit), 'AWAITING_CITIZEN_PHOTO');
  assert.equal(auditStatus({ ...audit, ai_verdict: 'RESOLVED_CLEARED', ai_confidence: 0.5 }), 'AWAITING_CITIZEN_PHOTO');
  assert.equal(auditStatus({ ...audit, ai_verdict: 'RESOLVED_CLEARED', ai_confidence: 0.9 }, 'DISPUTED_NOT_RESOLVED'), 'VERIFIED_UNRESOLVED_ESCALATED');
});
test('model JSON handles fences while malformed results fail validation', () => {
  assert.deepEqual(parseModelJson('```json\n{"tree_detected":false}\n```'), { tree_detected: false });
  assert.throws(() => parseModelJson('no analysis'));
});
test('invalid evidence and path traversal are rejected', () => {
  assert.equal(decodePhoto(image).mime, 'image/png');
  assert.throws(() => decodePhoto(Buffer.from('not a photo').toString('base64')), ApiError);
  assert.throws(() => mediaPath('../.env.local'), ApiError);
});
test('GPS distances support on-site checks rather than trusting client flags', () => {
  assert.equal(distanceMeters(18.52, 73.85, 18.52, 73.85), 0);
  assert.ok(distanceMeters(18.52, 73.85, 18.53, 73.85) > 1000);
});
test('request validation rejects invalid GPS and oversized radius', async () => {
  const request = new Request('http://localhost/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: 100, longitude: 73.85, radius_meters: 10_000 }) });
  await assert.rejects(() => parseBody(request, duplicateSchema), (e: unknown) => e instanceof ApiError && e.status === 422);
});
test('SQLite survives reopening and prevents duplicate witness counts', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tree-repository-test-'));
  const filename = path.join(directory, 'complaints.db');
  let repo = new ComplaintRepository(filename);
  try {
    const record = { id: 'loc-test', tracking_id: 'PUNE-TREE-2026-TEST', created_at: new Date().toISOString(), witness_count: 1 } as Complaint;
    repo.save(record); repo.close(); repo = new ComplaintRepository(filename);
    assert.equal(repo.get(record.tracking_id)?.id, record.id);
    assert.equal(repo.addWitness(record.id, 'phone-hash', { name: 'Citizen' }), true);
    assert.equal(repo.addWitness(record.id, 'phone-hash', { name: 'Citizen' }), false);
    assert.throws(() => repo.transaction(() => { repo.save({ ...record, witness_count: 99 }); throw new Error('rollback'); }));
    assert.equal(repo.get(record.id)?.witness_count, 1);
  } finally {
    repo.close();
    assert.ok(path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}tree-repository-test-`));
    rmSync(directory, { recursive: true, force: true });
  }
});
test('AI outage audit is inconclusive, even if citizen notes claim resolution', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try { const audit = await comparePhotos(image, image, 'HAZARDOUS_BRANCH', 'resolved'); assert.equal(audit.ai_verdict, 'INCONCLUSIVE'); assert.equal(audit.ai_confidence, 0); }
  finally { globalThis.fetch = previous; }
});
