const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { connectBackend } = require('./connect-backend');

const preferredNdkVersion = '30.0.16248370';
const requestedNdkVersion = process.env.ANDROID_NDK_VERSION;
const directories = (root) => fs.existsSync(root)
  ? fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name))
  : [];
const installedNdkVersions = (sdk) => directories(path.join(sdk, 'ndk'))
  .filter((candidate) => fs.existsSync(path.join(candidate, 'source.properties')))
  .map((candidate) => path.basename(candidate))
  .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  path.join(os.homedir(), 'Android', 'Sdk'),
  path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  '/opt/android-sdk',
].filter(Boolean);

const sdkRoot = [...new Set(sdkCandidates)].find((candidate) =>
  requestedNdkVersion
    ? installedNdkVersions(candidate).includes(requestedNdkVersion)
    : installedNdkVersions(candidate).length > 0,
);

if (!sdkRoot) {
  console.error(`Could not find an Android SDK with ${requestedNdkVersion ? `NDK ${requestedNdkVersion}` : 'an installed NDK'}.`);
  console.error('Install the NDK in Android Studio, or set ANDROID_HOME to an SDK that contains it.');
  process.exit(1);
}

const availableNdkVersions = installedNdkVersions(sdkRoot);
const ndkVersion = requestedNdkVersion || (availableNdkVersions.includes(preferredNdkVersion)
  ? preferredNdkVersion : availableNdkVersions[0]);
const env = { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot, ORG_GRADLE_PROJECT_ndkVersion: ndkVersion };
// Windows exposes Path with mixed casing; Node keeps only one case-insensitive
// entry when spawning. Preserve it and make the current Node runtime explicit.
const originalPath = env.PATH || env.Path || '';
if (process.platform === 'win32') {
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
}
env.PATH = [path.dirname(process.execPath), path.join(sdkRoot, 'platform-tools'), originalPath].join(path.delimiter);

// React Native's Gradle plugins request a Java 17 toolchain.
const java17Candidates = [
  process.env.JAVA_HOME,
  ...directories(path.join(__dirname, '..', '..', 'tools', 'jdk17')),
  ...directories(path.join(os.homedir(), '.jdks')),
  ...(process.platform === 'win32' ? directories(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Java')) : []),
  '/usr/lib/jvm/java-17-openjdk',
  '/usr/lib/jvm/java-17-openjdk-amd64',
  '/usr/lib/jvm/temurin-17-jdk-amd64',
].filter(Boolean);
const java17Home = java17Candidates.find((candidate) => {
  const release = path.join(candidate, 'release');
  return fs.existsSync(path.join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
    && fs.existsSync(release) && /^JAVA_VERSION="17[."]/m.test(fs.readFileSync(release, 'utf8'));
});
if (java17Home) {
  // Android Studio's daemon JVM criteria take precedence over JAVA_HOME.
  // Preserve conflicting criteria as a backup so this script can use JDK 17.
  const daemonCriteria = path.join(__dirname, '..', 'android', 'gradle', 'gradle-daemon-jvm.properties');
  if (fs.existsSync(daemonCriteria)) {
    fs.renameSync(daemonCriteria, `${daemonCriteria}.disabled-${Date.now()}`);
    console.log('Disabled Gradle daemon JVM override; using the selected JDK 17.');
  }
  env.JAVA_HOME = java17Home;
  env.PATH = `${path.join(java17Home, 'bin')}${path.delimiter}${env.PATH}`;
}

console.log(`Using Android SDK: ${sdkRoot}`);
console.log(`Using NDK: ${ndkVersion}`);
if (env.JAVA_HOME) console.log(`Using Java: ${env.JAVA_HOME}`);

connectBackend({ sdkRoot, env });

const expoCli = path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
const result = spawnSync(process.execPath, [expoCli, 'run:android', ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
