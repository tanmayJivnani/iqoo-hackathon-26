import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('fast civic notices preserve evidence, avoid cloud latency and keep noise out of photo audits', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'civic-api-test-'));
  process.env.DATA_DIR = directory;
  const { GET, POST } = await import('../src/app/api/v1/complaints/[[...path]]/route');
  const { GET: mediaGet } = await import('../src/app/api/v1/media/[name]/route');
  const { repository } = await import('../src/lib/repository');
  const { isNightTime, requiresReverification } = await import('../src/lib/civic');
  const { routeIssue } = await import('../src/lib/routing');
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  // Minimal ISO-BMFF container fixture; a synthetic test sample, not captured audio.
  const audio = Buffer.concat([Buffer.from([0, 0, 0, 32]), Buffer.from('ftypM4A '), Buffer.alloc(20)]).toString('base64');
  const noise = { duration_ms: 10_000, average_dbfs: -35, peak_dbfs: -20, sample_count: 50, unit: 'dBFS', near_sensitive_site: true, site_label: 'Reported school' };
  const base = { latitude: 18.52, longitude: 73.85, captured_at: new Date().toISOString(), citizen_name: 'Test Citizen' };
  const call = (segments: string[], payload: unknown) => POST(new Request('http://localhost/api/v1/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), { params: Promise.resolve({ path: segments }) });
  const get = (segments: string[]) => GET(new Request('http://localhost/api/v1/complaints'), { params: Promise.resolve({ path: segments }) });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Fast reporting must not call a cloud provider.'); };
  try {
    assert.equal(isNightTime('2026-10-09T16:30:00Z'), true);
    assert.equal(isNightTime('2026-10-10T00:30:00Z'), false);
    assert.equal(routeIssue('FOOTPATH_ENCROACHMENT').issue_type, 'FOOTPATH_ENCROACHMENT');
    assert.equal(routeIssue('NIGHT_NOISE').routed_authority.emergency_phone, '112');
    assert.equal(requiresReverification('WASTE_BURNING'), false);
    for (const issue of ['ROAD_POTHOLE', 'OPEN_MANHOLE', 'FOOTPATH_ENCROACHMENT', 'WASTE_DUMP', 'WASTE_BURNING', 'HAZARDOUS_BRANCH']) {
      const response = await call(['fast-draft'], { ...base, issue_type: issue, photos_base64: [photo] });
      assert.equal(response.status, 200, issue);
      const draft = await response.json();
      assert.equal(draft.ai_provider, 'FAST_TEMPLATE'); assert.equal(draft.tree_detected, false);
      assert.equal(draft.evidence_classification, 'CITIZEN_REPORTED'); assert.equal(draft.photo_urls.length, 1);
      assert.match(draft.tracking_id, /^PUNE-FAST-/);
      assert.match(draft.draft_body_en, /not a statutory deadline/);
      assert.match(draft.draft_body_en, /original timestamps and locations of imported photos have not been verified/);
      if (draft.reverification_required) assert.ok(draft.reverification_due_at);
      else assert.equal(draft.reverification_due_at, null);
    }
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'ROAD_POTHOLE' })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'ROAD_POTHOLE', photos_base64: [photo], noise_evidence: noise })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', photos_base64: [photo] })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', audio_base64: audio, noise_evidence: { ...noise, unit: 'dB(A)' } })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', audio_base64: audio, noise_evidence: { ...noise, average_dbfs: -10 } })).status, 422);
    const response = await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', audio_base64: audio, noise_evidence: noise });
    assert.equal(response.status, 200); const draft = await response.json();
    assert.equal(draft.domain, 'NOISE'); assert.equal(draft.reverification_required, false); assert.equal(draft.reverification_due_at, null);
    assert.match(draft.draft_body_en, /not calibrated dB\(A\)/); assert.match(draft.draft_body_en, /whether it is a notified silence zone/);
    assert.equal(draft.audio_sha256.length, 64);
    const media = await mediaGet(new Request('http://localhost/media'), { params: Promise.resolve({ name: draft.audio_url.split('/').at(-1) }) });
    assert.equal(media.headers.get('content-type'), 'audio/mp4'); assert.equal((await media.arrayBuffer()).byteLength, 32);
    const rendered = await call(['render-pdf'], { complaint_id: draft.id }); assert.equal(rendered.status, 200);
    const pdf = Buffer.from(await (await get([draft.id, 'download-pdf'])).arrayBuffer());
    assert.match(pdf.toString('latin1'), /EmbeddedFiles/);
    const email = await (await call(['dispatch'], { complaint_id: draft.id, confirmed_by_citizen: true, channels: ['EMAIL'] })).json();
    assert.equal(email.email.sent, false); assert.equal(email.email.audio_attachment_url, draft.audio_url);
    assert.equal((await call([draft.id, 'verify'], { complaint_id: draft.id, latitude: 18.52, longitude: 73.85, photo_base64: photo })).status, 409);
    const nearby = await (await call(['check-duplicate'], { latitude: 18.52, longitude: 73.85, domain: 'ROADS' })).json();
    assert.equal(nearby.duplicate_count, 3); assert.ok(nearby.nearby_complaints.every((item: { domain: string }) => item.domain === 'ROADS'));
  } finally {
    globalThis.fetch = originalFetch; repository().close();
    assert.ok(path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}civic-api-test-`));
    rmSync(directory, { recursive: true, force: true });
  }
});
