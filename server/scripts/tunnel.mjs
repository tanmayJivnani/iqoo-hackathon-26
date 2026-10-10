import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const localBinary = path.join(repoRoot, 'tools', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const executable = process.env.CLOUDFLARED_PATH || (existsSync(localBinary) ? localBinary : 'cloudflared');
const origin = process.env.TUNNEL_ORIGIN || 'http://127.0.0.1:3000';
const mobileEnv = path.join(repoRoot, 'mobile', '.env.local');

console.log(`Opening a Cloudflare tunnel to ${origin}. Keep the backend running in another terminal.`);
const tunnel = spawn(executable, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', origin], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let recentOutput = '';
let configuredUrl;
function onOutput(chunk) {
  const output = chunk.toString();
  process.stdout.write(output);
  recentOutput = `${recentOutput}${output}`.slice(-4096);
  const url = recentOutput.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i)?.[0];
  if (!url || configuredUrl === url) return;
  configuredUrl = url;
  const current = existsSync(mobileEnv) ? readFileSync(mobileEnv, 'utf8') : '';
  const assignment = `EXPO_PUBLIC_API_URL=${url}`;
  const updated = /^EXPO_PUBLIC_API_URL\s*=/m.test(current)
    ? current.replace(/^EXPO_PUBLIC_API_URL\s*=.*$/m, assignment)
    : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${assignment}\n`;
  writeFileSync(mobileEnv, updated);
  console.log(`\nBackend URL: ${url}\nUpdated mobile/.env.local. Restart Metro from mobile: npm start -- --lan\n`);
}
tunnel.stdout.on('data', onOutput);
tunnel.stderr.on('data', onOutput);
tunnel.on('error', error => {
  console.error(`Could not launch cloudflared: ${error.message}. Install cloudflared or set CLOUDFLARED_PATH.`);
  process.exitCode = 1;
});
tunnel.on('exit', code => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => tunnel.kill(signal));
