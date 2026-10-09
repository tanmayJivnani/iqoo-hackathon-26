# Pune Tree Rakshak — Expo client

This is the Android-first React Native client. The prior Kotlin/Compose implementation stays in `../android` as a reference during the migration.

## Development

```bash
npm install
npm run android
```

Use Node.js 22.13 or newer. `npm run android` selects an Android SDK and launches a native Expo development build. It prefers NDK `27.1.12297006` when installed, otherwise selects the latest installed NDK; set `ANDROID_NDK_VERSION` to select a specific installed version. It checks the standard Windows, macOS, and Linux SDK locations, as well as `ANDROID_HOME` and `ANDROID_SDK_ROOT`. It uses JDK 17 from `JAVA_HOME`, the repository's ignored `tools/jdk17` folder, or standard installation locations when available. Expo Go is not supported because the app includes a local Android Expo module for MediaPipe Gemma inference. Install an NDK from Android Studio's SDK Manager if none is available.

The Android package id remains `org.punetrees.app`, so a signed release can retain the existing app identity. The generated `android/` directory is ignored; change native configuration in `app.json` or `modules/local-tree-ai` and regenerate it with `npm run prebuild:android`.

## Local Gemma model

Trees, Roads, Garbage and Noise have separate tracker tabs. The primary physical flow requires one photo and GPS and prepares a notice without AI. Optional tree AI review still uses three photos. Noise uses `expo-audio` for a ten-second foreground recording and relative dBFS readings, which are not calibrated sound-pressure measurements. Rebuild the native app after installing the audio module; an old APK cannot load it. Noise email drafts attach both the PDF and M4A recording.

From the tracker, choose **Import local AI model** and select a compatible MediaPipe multimodal Gemma `.task` file (the default expected filename is `gemma-3n-E2B-it-int4.task`). The model is copied into app-private storage and never added to the repository or bundled APK. The model can occupy several gigabytes, so allow enough free device storage. The native module runs an on-device photo check and damage summary. Backend connectivity is used for routing, PDF rendering, saving reports, and follow-up verification. When the API is unreachable and local inference successfully verifies a tree, the app prepares a draft for review. Reconnect before sharing: the backend registers the draft, routes it, and generates its PDF with all evidence. A failed or malformed local assessment cannot create an AI draft. Census is excluded.

## API endpoint

The Next.js backend defaults to `http://localhost:3000`. Start it from the repository root with `npm run backend:dev`. For an Android phone connected by USB, run `adb reverse tcp:3000 tcp:3000` so the phone can reach the laptop. Override the URL with `EXPO_PUBLIC_API_URL` for Wi-Fi or a tunnel, for example:

```bash
EXPO_PUBLIC_API_URL=https://your-development-tunnel.example npm run android
```

Restart Metro after changing this variable. `localhost` on the phone refers to the phone itself unless USB port forwarding is enabled. For Wi-Fi use your laptop's LAN IP and keep both devices on the same network.

Email opens the phone's email app with the generated PDF attached; sending is completed there. WhatsApp opens separately with a prepared summary. The backend does not send SMTP email or claim delivery.
