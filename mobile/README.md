# Pune Tree Rakshak — Expo client

This is the Android-first React Native client. The prior Kotlin/Compose implementation stays in `../android` as a reference during the migration.

## Development

```bash
npm install
npm run android
```

Use Node.js 22.13 or newer. `npm run android` selects an Android SDK and launches a native Expo development build. It prefers NDK `27.1.12297006` when installed, otherwise selects the latest installed NDK; set `ANDROID_NDK_VERSION` to select a specific installed version. It checks the standard Windows, macOS, and Linux SDK locations, as well as `ANDROID_HOME` and `ANDROID_SDK_ROOT`. It uses JDK 17 from `JAVA_HOME`, the repository's ignored `tools/jdk17` folder, or standard installation locations when available. Expo Go is not supported because the app includes a local Android Expo module for GenieX Qwen inference. Install an NDK from Android Studio's SDK Manager if none is available.

The Android package id remains `org.punetrees.app`, so a signed release can retain the existing app identity. The generated `android/` directory is ignored; change native configuration in `app.json` or `modules/local-tree-ai` and regenerate it with `npm run prebuild:android`.

## Local Qwen3.5 model

Choose **Local Qwen3.5** in AI settings and import the Qwen3.5-4B GGUF model and its matching multimodal projector (mmproj). Both files stay in app-private storage and are never bundled into the APK. Cloud mode remains available. Backend connectivity is still needed for routing, saving reports, PDF generation and dispatch.

Local mode starts loading the model on the report guidance screen, before photo capture. The loaded model and projector are reused throughout the report; the inference context is cleared before and after each analysis. Returning home, leaving the report, switching to cloud, or replacing the model releases the runtime and clears cached observations. Five idle minutes release model memory while retaining retry results for the current report.

Up to eight summaries are cached in memory, keyed by the complete prompt and ordered photo contents supplied to inference. Retrying unchanged evidence reuses its summary; changing photos, issue, notes or other prompt details triggers new analysis. Cache contents do not survive process restarts. Temporary AI photos are limited to 512 pixels on the longest edge; original photos remain available for report/PDF evidence. Keeping the runtime loaded uses additional RAM, and the first analysis may still wait for loading if photo capture finishes quickly.

Audio and video are report attachments, not AI inputs. Noise notices use device-reported decibel measurements. The user completes email sending in their email app.

Regression checks need a JDK (`javac` and `java` on PATH) for the native model lifecycle/cache test.

## API endpoint

The Next.js backend defaults to `http://localhost:3000`. Start it from the repository root with `npm run backend:dev`. For an Android phone connected by USB, run `adb reverse tcp:3000 tcp:3000` so the phone can reach the laptop. Override the URL with `EXPO_PUBLIC_API_URL` for Wi-Fi or a tunnel, for example:

```bash
EXPO_PUBLIC_API_URL=https://your-development-tunnel.example npm run android
```

Restart Metro after changing this variable. `localhost` on the phone refers to the phone itself unless USB port forwarding is enabled. For Wi-Fi use your laptop's LAN IP and keep both devices on the same network.

Email opens the phone's email app with the generated PDF attached; sending is completed there. WhatsApp opens separately with a prepared summary. The backend does not send SMTP email or claim delivery.
