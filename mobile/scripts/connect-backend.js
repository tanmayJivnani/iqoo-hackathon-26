const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function connectBackend({ sdkRoot, env = process.env } = {}) {
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const sdkCandidates = [
    sdkRoot, env.ANDROID_HOME, env.ANDROID_SDK_ROOT,
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    '/opt/android-sdk',
  ].filter(Boolean);
  const adb = sdkCandidates.map(sdk => path.join(sdk, 'platform-tools', executable))
    .find(candidate => fs.existsSync(candidate)) || executable;
  const devices = spawnSync(adb, ['devices'], { env, encoding: 'utf8', timeout: 10_000 });
  if (devices.error || devices.status !== 0) {
    console.warn('USB backend setup skipped: adb is unavailable. Install Android platform-tools or use EXPO_PUBLIC_API_URL for Wi-Fi.');
    return false;
  }
  const connected = devices.stdout.split(/\r?\n/)
    .map(line => line.trim().split(/\s+/))
    .filter(([, state]) => state === 'device')
    .map(([serial]) => serial);
  if (!connected.length) {
    console.log('No Android device connected. After connecting USB, run npm run connect:backend.');
    return false;
  }
  let success = true;
  for (const serial of connected) {
    const result = spawnSync(adb, ['-s', serial, 'reverse', 'tcp:3000', 'tcp:3000'], {
      env, encoding: 'utf8', timeout: 10_000,
    });
    if (result.error || result.status !== 0) {
      success = false;
      console.warn(`Could not forward backend port 3000 to ${serial}. Run npm run connect:backend after reconnecting USB.`);
    } else {
      console.log(`Backend USB connection ready on ${serial}: http://localhost:3000`);
    }
  }
  return success;
}

module.exports = { connectBackend };
if (require.main === module) connectBackend();
