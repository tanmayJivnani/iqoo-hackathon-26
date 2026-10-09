import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('complaint lifecycle preserves evidence, prepares sharing, and enforces audit gates', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tree-api-test-'));
  process.env.DATA_DIR = directory;
  process.env.GEMINI_API_KEY = 'test-key-never-sent';
  process.env.OPENROUTER_API_KEY = '';
  const { GET, POST } = await import('../src/app/api/v1/complaints/[[...path]]/route');
  const { GET: photoGet } = await import('../src/app/api/v1/media/[name]/route');
  const { repository } = await import('../src/lib/repository');
  const originalFetch = globalThis.fetch;
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ tree_detected: true, detected_issue_category: 'HAZARDOUS_BRANCH', felling_stage: 'NOT_APPLICABLE', visual_damage_summary: 'Test fixture only.', draft_subject_en: 'Test tree complaint', draft_body_en: 'I request an on-site inspection.', draft_summary_mr: 'कृपया झाडाची पाहणी करावी.' }) }] } }] });
  const call = async (method: 'GET' | 'POST', segments: string[], payload?: unknown) => {
    const request = new Request(`http://localhost:3000/api/v1/complaints/${segments.join('/')}`, payload === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return (method === 'GET' ? GET : POST)(request, { params: Promise.resolve({ path: segments }) });
  };
  try {
    const analysis = await call('POST', ['analyze-and-draft'], { latitude: 18.52, longitude: 73.85, photo_base64: image, photos_base64: [image, image, image], perpetrator_photos_base64: [image], citizen_selected_category: 'HAZARDOUS_BRANCH,ROOT_CONCRETIZATION', citizen_name: 'Test Citizen' });
    assert.equal(analysis.status, 200); const draft = await analysis.json();
    assert.equal(draft.photo_urls.length, 4);
    assert.ok(!('census_tree' in draft));
    const photoResponse = await photoGet(new Request('http://localhost/photo'), { params: Promise.resolve({ name: draft.photo_urls[0].split('/').at(-1) }) });
    assert.equal(photoResponse.headers.get('content-type'), 'image/png'); assert.ok((await photoResponse.arrayBuffer()).byteLength > 20);
    const nearby = await (await call('POST', ['check-duplicate'], { latitude: 18.52, longitude: 73.85 })).json();
    assert.equal(nearby.duplicate_count, 1); assert.equal(nearby.nearby_complaints[0].distance_meters, 0);
    const firstWitness = await (await call('POST', ['upvote-witness'], { complaint_id: draft.id, witness_phone: '9876543210' })).json();
    const repeatWitness = await (await call('POST', ['upvote-witness'], { complaint_id: draft.id, witness_phone: '9876543210' })).json();
    assert.equal(firstWitness.new_witness_count, 2); assert.equal(repeatWitness.new_witness_count, 2);
    const rendered = await call('POST', ['render-pdf'], { complaint_id: draft.id, draft_body_en: 'Citizen-approved edited statement.' });
    assert.equal(rendered.status, 200); assert.ok((await rendered.json()).file_size_bytes > 10_000);
    const pdf = await call('GET', [draft.id, 'download-pdf']);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    const pdfText = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
    assert.ok(pdfText.startsWith('%PDF')); assert.ok(pdfText.includes('/FontFile2')); assert.ok(pdfText.includes('/Subtype /Image'));
    const shared = await call('POST', ['dispatch'], { complaint_id: draft.id, confirmed_by_citizen: true, channels: ['EMAIL', 'WHATSAPP'] });
    const prepared = await shared.json();
    assert.equal(prepared.status, 'PREPARED'); assert.equal(prepared.email.sent, false); assert.equal(prepared.dispatched_at, null);
    assert.ok(prepared.email.body.includes('Citizen-approved edited statement.')); assert.ok(prepared.email.attachment_url.endsWith('/download-pdf'));
    const verifyPayload = { complaint_id: draft.id, photo_base64: image, latitude: 18.52, longitude: 73.85 };
    assert.equal((await call('POST', [draft.id, 'verify'], verifyPayload)).status, 409);
    const c = repository().get(draft.id)!; c.reverification_due_at = new Date(Date.now() - 1000).toISOString(); repository().save(c);
    assert.equal((await call('POST', [draft.id, 'verify'], { ...verifyPayload, latitude: 19 })).status, 422);
    globalThis.fetch = async () => { throw new Error('AI offline'); };
    const audit = await (await call('POST', [draft.id, 'verify'], verifyPayload)).json();
    assert.equal(audit.ai_verdict, 'INCONCLUSIVE'); assert.equal(audit.final_status, 'AWAITING_CITIZEN_PHOTO');
    const repeatedNearby = await (await call('POST', ['check-duplicate'], { latitude: 18.52, longitude: 73.85 })).json();
    assert.equal(repeatedNearby.duplicate_count, 1);
    const record = await (await call('GET', ['verify', draft.tracking_id])).json();
    assert.match(record.sha256_evidence_digest, /^[a-f0-9]{64}$/);
    const invalidLocal = await call('POST', ['render-pdf'], { complaint_id: 'loc-PUNE-TREE-2026-INVALID', photos_base64: [image] });
    assert.equal(invalidLocal.status, 422);
    const local = await call('POST', ['render-pdf'], { complaint_id: 'loc-PUNE-TREE-2026-LOCALTEST', tracking_id: 'PUNE-TREE-2026-LOCALTEST', latitude: 18.52, longitude: 73.85, photos_base64: [image], issue_type: 'ROOT_CONCRETIZATION' });
    assert.equal(local.status, 200);
    assert.equal((await call('GET', ['loc-PUNE-TREE-2026-LOCALTEST'])).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    repository().close();
    assert.ok(path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}tree-api-test-`));
    rmSync(directory, { recursive: true, force: true });
  }
});
