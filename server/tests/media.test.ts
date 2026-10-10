import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test('recording downloads return complete audio/video bytes and reject invalid media paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'media-route-test-'));
  process.env.DATA_DIR = directory;
  const { GET, OPTIONS } = await import('../src/app/api/v1/media/[name]/route');
  await mkdir(path.join(directory, 'media'));
  const request = new Request('http://localhost/api/v1/media', { headers: { Origin: 'http://localhost:8081' } });
  const bytes = Buffer.from([0, 255, 128, 10, 13, 44, 90]);
  try {
    for (const [extension, mime] of Object.entries({ wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', jpg: 'image/jpeg', png: 'image/png' })) {
      const name = `${randomUUID()}.${extension}`;
      await writeFile(path.join(directory, 'media', name), bytes);
      const response = await GET(request, { params: Promise.resolve({ name }) });
      assert.equal(response.status, 200, extension);
      assert.equal(response.headers.get('Content-Type'), mime);
      assert.equal(response.headers.get('Content-Length'), String(bytes.length));
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes, 'Media bytes must not be converted to text or JSON');
    }
    for (const name of [`${randomUUID()}.wav`, '../complaints.db', 'recording.exe']) {
      const response = await GET(request, { params: Promise.resolve({ name }) });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { detail: 'Evidence not found.' });
    }
    assert.equal((await OPTIONS(request)).status, 204);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
