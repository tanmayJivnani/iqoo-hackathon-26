import assert from 'node:assert/strict';
import test from 'node:test';
import { emailAttachmentPlan, prepareEmailAttachments } from '../src/lib/email-evidence.ts';

const email = { ready: true, recipient: 'test@example.com', subject: 'Noise report', body: 'Report', attachment_url: '/report.pdf' };
const report = { domain: 'NOISE' as const, tracking_id: 'PUNE-FAST-TEST', audio_url: '/recording.wav', video_url: '/recording.mp4' };

test('saved noise recordings remain attachments when dispatch omits optional media URLs', async () => {
  const plan = emailAttachmentPlan(report, email);
  const requested: string[] = [];
  const attachments = await prepareEmailAttachments(plan, async attachment => {
    requested.push(attachment.url);
    return { uri: `file:///cache/${attachment.filename}`, exists: true, size: 1024 };
  });
  assert.deepEqual(requested, ['/report.pdf', '/recording.wav', '/recording.mp4']);
  assert.deepEqual(attachments, ['file:///cache/PUNE-FAST-TEST.pdf', 'file:///cache/PUNE-FAST-TEST_audio.wav', 'file:///cache/PUNE-FAST-TEST_video.mp4']);
});

test('audio-only reports keep the original M4A extension and do not invent a video', () => {
  const plan = emailAttachmentPlan({ ...report, audio_url: '/recording.m4a', video_url: null }, email);
  assert.deepEqual(plan.map(attachment => attachment.filename), ['PUNE-FAST-TEST.pdf', 'PUNE-FAST-TEST_audio.m4a']);
});

test('a noise report cannot be emailed without its audio recording', () => {
  assert.throws(() => emailAttachmentPlan({ ...report, audio_url: null }, email), /noise recording is missing/);
});

test('an unavailable video prevents preparing a partial email attachment list', async () => {
  const plan = emailAttachmentPlan(report, email);
  await assert.rejects(prepareEmailAttachments(plan, async attachment => {
    if (attachment.label === 'Video recording') throw new Error('Network unavailable');
    return { uri: `file:///cache/${attachment.filename}`, exists: true, size: 1024 };
  }), /Video recording could not be attached/);
});

test('empty or missing downloaded recordings are rejected before opening the composer', async () => {
  for (const file of [{ exists: true, size: 0 }, { exists: false, size: 1024 }]) {
    await assert.rejects(prepareEmailAttachments(emailAttachmentPlan(report, email), async attachment => ({
      uri: `file:///cache/${attachment.filename}`,
      ...(attachment.label === 'Audio recording' ? file : { exists: true, size: 1024 }),
    })), /Audio recording could not be attached/);
  }
});
