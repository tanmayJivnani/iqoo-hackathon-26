const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ndkVersion = '27.1.12297006';
const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(os.homedir(), 'Android', 'Sdk'),
  '/opt/android-sdk',
].filter(Boolean);

const sdkRoot = [...new Set(sdkCandidates)].find((candidate) =>
  fs.existsSync(path.join(candidate, 'ndk', ndkVersion, 'source.properties')),
);

if (!sdkRoot) {
  console.error(`Could not find an Android SDK with NDK ${ndkVersion}.`);
  console.error('Install that NDK in Android Studio, or set ANDROID_HOME to an SDK that contains it.');
  process.exit(1);
}

const env = { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot };
env.PATH = `${path.join(sdkRoot, 'platform-tools')}${path.delimiter}${env.PATH || ''}`;

// The installed Gradle/Android toolchain in this environment builds with JDK 17.
if (process.platform === 'linux') {
  const java17Candidates = [
    '/usr/lib/jvm/java-17-openjdk',
    '/usr/lib/jvm/java-17-openjdk-amd64',
    '/usr/lib/jvm/temurin-17-jdk-amd64',
  ];
  const java17Home = java17Candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'bin', 'java')),
  );
  if (java17Home) env.JAVA_HOME = java17Home;
}

console.log(`Using Android SDK: ${sdkRoot}`);
if (env.JAVA_HOME) console.log(`Using Java: ${env.JAVA_HOME}`);

const expoCli = path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
const result = spawnSync(process.execPath, [expoCli, 'run:android'], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
