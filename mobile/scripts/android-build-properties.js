const fs = require('node:fs');
const path = require('node:path');

const genieXGradleProperties = {
  'android.minSdkVersion': '27',
  'expo.useLegacyPackaging': 'true',
};

// Expo plugins run during prebuild. Existing Android checkouts also need these
// properties synced before run:android, which can reuse the generated project.
function syncAndroidBuildProperties(androidRoot = path.join(__dirname, '..', 'android')) {
  const filename = path.join(androidRoot, 'gradle.properties');
  if (!fs.existsSync(filename)) return; // A fresh prebuild applies with-geniex.
  const current = fs.readFileSync(filename, 'utf8');
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  let updated = current;
  for (const [key, value] of Object.entries(genieXGradleProperties)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedKey}\\s*=([^\\r\\n]*)`, 'm');
    const existing = updated.match(pattern);
    // Keep a stricter platform minimum if this checkout already uses one.
    const nextValue = key === 'android.minSdkVersion'
      ? String(Math.max(Number.parseInt(existing?.[1], 10) || 0, Number(value))) : value;
    const assignment = `${key}=${nextValue}`;
    updated = existing ? updated.replace(pattern, assignment)
      : `${updated}${updated && !updated.endsWith('\n') ? newline : ''}${assignment}${newline}`;
  }
  if (updated !== current) {
    fs.writeFileSync(filename, updated);
    console.log('Synced Android build settings: minimum SDK 27 and GenieX native-library packaging.');
  }
}

module.exports = { genieXGradleProperties, syncAndroidBuildProperties };
