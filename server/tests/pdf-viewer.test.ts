import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pdfViewerAsset } from '../src/lib/pdf-viewer';
import { ApiError } from '../src/lib/http';

test('PDF viewer serves its browser module and worker from installed package files', async () => {
  for (const [name, exportName] of [['pdf.mjs', 'getDocument'], ['pdf.worker.mjs', 'WorkerMessageHandler']]) {
    const response = await pdfViewerAsset(name);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.match(await response.text(), new RegExp(exportName));
  }
});

test('PDF viewer rejects arbitrary files and directory traversal', async () => {
  for (const name of ['../package.json', 'package.json', 'pdf.mjs/../../package.json']) {
    await assert.rejects(pdfViewerAsset(name), error => error instanceof ApiError && error.status === 404);
  }
});
