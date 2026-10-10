import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('AI civic notices populate templates, require analysis and keep noise out of photo audits', async () => {
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
  const noise = { duration_ms: 10_000, average_dbfs: -35, peak_dbfs: -20, average_dba: 70, peak_dba: 85, measurement_method: 'KOTLIN_AUDIO_RECORD_A_WEIGHTED', sample_count: 50, unit: 'dBFS', near_sensitive_site: true, site_label: 'Reported school' };
  const base = { latitude: 18.52, longitude: 73.85, captured_at: new Date().toISOString(), citizen_name: 'Test Citizen' };
  const call = (segments: string[], payload: unknown) => POST(new Request('http://localhost/api/v1/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), { params: Promise.resolve({ path: segments }) });
  const get = (segments: string[]) => GET(new Request('http://localhost/api/v1/complaints'), { params: Promise.resolve({ path: segments }) });
  const originalFetch = globalThis.fetch;
  const { config } = await import('../src/lib/config');
  const originalKeys = { geminiKey: config.geminiKey, openrouterKey: config.openrouterKey };
  config.geminiKey = 'test-key'; config.openrouterKey = '';
  let aiCalls = 0;
  let aiMode: 'ok' | 'unrelated' | 'offline' = 'ok';
  globalThis.fetch = async () => {
    aiCalls++;
    if (aiMode === 'offline') throw new Error('AI offline');
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      evidence_relevant: aiMode === 'ok', rejection_reason: 'Retake a clear photo of the concern.',
      observations_en: 'Visible damage and surrounding pavement in the supplied test photo.',
      observations_mr: 'छायाचित्रात नुकसान आणि जवळील रस्ता दिसतो.',
    }) }] } }] });
  };
  try {
    assert.equal(isNightTime('2026-10-09T16:30:00Z'), true);
    assert.equal(isNightTime('2026-10-10T00:30:00Z'), false);
    assert.equal(routeIssue('FOOTPATH_ENCROACHMENT').issue_type, 'FOOTPATH_ENCROACHMENT');
    assert.equal(routeIssue('NIGHT_NOISE').routed_authority.emergency_phone, '112');
    assert.equal(requiresReverification('WASTE_BURNING'), false);
    for (const issue of ['ROAD_POTHOLE', 'OPEN_MANHOLE', 'FOOTPATH_ENCROACHMENT', 'WASTE_DUMP', 'WASTE_BURNING', 'HAZARDOUS_BRANCH']) {
      const response = await call(['fast-draft'], { ...base, issue_type: issue, photos_base64: issue === 'HAZARDOUS_BRANCH' ? [photo, photo] : [photo] });
      assert.equal(response.status, 200, issue);
      const draft = await response.json();
      assert.equal(draft.ai_provider, 'GEMINI'); assert.equal(draft.tree_detected, issue === 'HAZARDOUS_BRANCH');
      assert.match(draft.draft_body_en, /Visible damage and surrounding pavement/);
      assert.match(draft.draft_summary_mr, /छायाचित्रात/);
      assert.match(draft.visual_damage_summary, /Visible damage/);
      assert.equal(draft.evidence_classification, 'AI_ASSISTED_VISUAL'); assert.equal(draft.photo_urls.length, issue === 'HAZARDOUS_BRANCH' ? 2 : 1);
      assert.match(draft.tracking_id, /^PUNE-FAST-/);
      assert.match(draft.draft_body_en, /not a statutory deadline/);
      assert.match(draft.draft_body_en, /original timestamps and locations of imported photos have not been verified/);
      if (draft.reverification_required) assert.ok(draft.reverification_due_at);
      else assert.equal(draft.reverification_due_at, null);
    }
    assert.equal(aiCalls, 6);
    const beforeFailedAnalysis = repository().list().length;
    aiMode = 'unrelated';
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'ROAD_POTHOLE', photos_base64: [photo] })).status, 422);
    aiMode = 'offline';
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'ROAD_POTHOLE', photos_base64: [photo] })).status, 503);
    assert.equal(repository().list().length, beforeFailedAnalysis, 'Failed AI must not register an unanalysed complaint');
    aiMode = 'ok';
    const callsBeforeNoise = aiCalls;
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'ROAD_POTHOLE' })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'ROAD_POTHOLE', photos_base64: [photo], noise_evidence: noise })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', photos_base64: [photo] })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', audio_base64: audio, noise_evidence: { ...noise, unit: 'dB(A)' } })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', audio_base64: audio, noise_evidence: { ...noise, average_dbfs: -10 } })).status, 422);
    const response = await call(['fast-draft'], { ...base, issue_type: 'NIGHT_NOISE', audio_base64: audio, noise_evidence: noise });
    assert.equal(response.status, 200); const draft = await response.json();
    assert.equal(aiCalls, callsBeforeNoise, 'Noise evidence uses measurements, not photo analysis');
    assert.equal(draft.ai_provider, 'MEASURED_NOISE_TEMPLATE');
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
    // Synthetic PCM fixture verifies the native WAV path without capturing a microphone.
    const wav = Buffer.alloc(44 + 44100 * 2 * 10);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    const nativeNoise = { ...noise, average_dba: 70, peak_dba: 85, sample_count: 441000, measurement_method: 'KOTLIN_AUDIO_RECORD_A_WEIGHTED' };
    const video = Buffer.concat([Buffer.from([0, 0, 0, 32]), Buffer.from('ftypisom'), Buffer.alloc(20), Buffer.from('vide')]).toString('base64');
    const nativeResponse = await call(['fast-draft'], { ...base, issue_type: 'FESTIVAL_NOISE', audio_base64: wav.toString('base64'), video_base64: video, noise_evidence: nativeNoise });
    assert.equal(nativeResponse.status, 200);
    const nativeDraft = await nativeResponse.json();
    assert.ok(nativeDraft.audio_url.endsWith('.wav'));
    assert.equal(nativeDraft.noise_evidence.average_dba, 70);
    assert.equal(nativeDraft.noise_evidence.sample_count, 441000);
    const wavMedia = await mediaGet(new Request('http://localhost/media'), { params: Promise.resolve({ name: nativeDraft.audio_url.split('/').at(-1) }) });
    assert.equal(wavMedia.headers.get('content-type'), 'audio/wav');
    assert.deepEqual(Buffer.from(await wavMedia.arrayBuffer()), wav);
    assert.equal((await call(['render-pdf'], { complaint_id: nativeDraft.id })).status, 200);
    const wavPdf = Buffer.from(await (await get([nativeDraft.id, 'download-pdf'])).arrayBuffer());
    assert.match(wavPdf.toString('latin1'), /EmbeddedFiles/);
    assert.equal(nativeDraft.video_sha256.length, 64);
    const videoMedia = await mediaGet(new Request('http://localhost/media'), { params: Promise.resolve({ name: nativeDraft.video_url.split('/').at(-1) }) });
    assert.equal(videoMedia.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(Buffer.from(await videoMedia.arrayBuffer()), Buffer.from(video, 'base64'));
    const videoEmail = await (await call(['dispatch'], { complaint_id: nativeDraft.id, confirmed_by_citizen: true, channels: ['EMAIL'] })).json();
    assert.equal(videoEmail.email.video_attachment_url, nativeDraft.video_url);
    const limit = isNightTime(base.captured_at) ? 45 : 55;
    for (const average of [limit - 1, limit]) assert.equal((await call(['fast-draft'], { ...base, issue_type: 'FESTIVAL_NOISE', audio_base64: audio, noise_evidence: { ...noise, average_dba: average } })).status, 422);
    const stored = repository().get(nativeDraft.id)!;
    stored.noise_evidence!.average_dba = limit; repository().save(stored);
    assert.equal((await call(['dispatch'], { complaint_id: stored.id, confirmed_by_citizen: true, channels: ['EMAIL'] })).status, 422);
    assert.equal((await call(['fast-draft'], { ...base, issue_type: 'FESTIVAL_NOISE', audio_base64: audio, noise_evidence: { ...nativeNoise, measurement_method: 'EXPO_AUDIO_METERED' } })).status, 422);
    assert.equal((await call([draft.id, 'verify'], { complaint_id: draft.id, latitude: 18.52, longitude: 73.85, photo_base64: photo })).status, 409);
    const nearby = await (await call(['check-duplicate'], { latitude: 18.52, longitude: 73.85, domain: 'ROADS' })).json();
    assert.equal(nearby.duplicate_count, 3); assert.ok(nearby.nearby_complaints.every((item: { domain: string }) => item.domain === 'ROADS'));
  } finally {
    globalThis.fetch = originalFetch; Object.assign(config, originalKeys); repository().close();
    assert.ok(path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}civic-api-test-`));
    rmSync(directory, { recursive: true, force: true });
  }
});
