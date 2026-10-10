import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { fastDraftSchema, verifySchema } from '../src/lib/schemas';

const local_text = { observations_en: 'Citizen reports a blocked footpath.', observations_mr: 'नागरिक पदपथावर अडथळा असल्याचे सांगतात.' };
const base = { issue_type: 'FOOTPATH_ENCROACHMENT', latitude: 18.52, longitude: 73.85, captured_at: new Date().toISOString() };
test('local mode requires summaries and never accepts them in cloud mode', () => {
  assert.equal(fastDraftSchema.safeParse({ ...base, ai_mode: 'LOCAL_QWEN' }).success, false);
  assert.equal(fastDraftSchema.safeParse({ ...base, local_text }).success, false);
  assert.equal(fastDraftSchema.safeParse({ ...base, ai_mode: 'LOCAL_QWEN', local_text }).success, true);
  assert.equal(verifySchema.safeParse({ complaint_id: 'one', latitude: 18.52, longitude: 73.85, photo_base64: 'x'.repeat(20), ai_mode: 'LOCAL_QWEN' }).success, false);
});
test('local reports save real attachments without any cloud call; text-only audits cannot close a report', async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'local-ai-test-'));
  const { fastDraft, verify } = await import('../src/lib/complaints');
  const { repository } = await import('../src/lib/repository');
  const photo = (await sharp({ create: { width: 4, height: 4, channels: 3, background: '#669966' } }).png().toBuffer()).toString('base64');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Cloud forbidden in local mode'); };
  try {
    const report = await fastDraft(fastDraftSchema.parse({ ...base, issue_type: 'DANGEROUS_LEANING_FALL_RISK', ai_mode: 'LOCAL_QWEN', local_text, photos_base64: [photo, photo] }));
    assert.equal(calls, 0); assert.equal(report.ai_provider, 'LOCAL_QWEN_TEXT');
    assert.equal(report.evidence_classification, 'CITIZEN_REPORTED'); assert.equal(report.tree_detected, false);
    assert.equal(report.photo_urls.length, 2); assert.match(report.draft_body_en, /photos\/audio not analyzed/);
    const stored = repository().get(report.complaint_id)!; stored.reverification_due_at = null; repository().save(stored);
    const result = await verify(report.complaint_id, verifySchema.parse({ complaint_id: report.complaint_id, latitude: 18.52, longitude: 73.85, photo_base64: photo, ai_mode: 'LOCAL_QWEN', local_text, citizen_notes: 'resolved' }));
    assert.equal(calls, 0); assert.equal(result.ai_verdict, 'INCONCLUSIVE'); assert.equal(result.ai_confidence, 0);
    assert.equal(result.final_status, 'AWAITING_CITIZEN_PHOTO'); assert.equal(result.ai_provider, 'LOCAL_QWEN_TEXT');
  } finally { globalThis.fetch = originalFetch; repository().close(); }
});
