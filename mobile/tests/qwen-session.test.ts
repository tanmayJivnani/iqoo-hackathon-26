import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('native model lifecycle and evidence cache', () => {
  const output = mkdtempSync(join(tmpdir(), 'qwen-session-'));
  try {
    execFileSync('javac', ['-d', output,
      fileURLToPath(new URL('../modules/local-tree-ai/android/src/main/java/expo/modules/localtreeai/QwenSession.java', import.meta.url)),
      fileURLToPath(new URL('./java/QwenSessionCheck.java', import.meta.url)),
    ], { stdio: 'pipe' });
    execFileSync('java', ['-cp', output, 'expo.modules.localtreeai.QwenSessionCheck'], { stdio: 'pipe' });
  } finally { rmSync(output, { recursive: true, force: true }); }
});
