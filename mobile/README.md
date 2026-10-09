# Pune Tree Rakshak — Expo client

This is the Android-first React Native client. The prior Kotlin/Compose implementation stays in `../android` as a reference during the migration.

## Development

```bash
npm install
npm run android
```

`npm run android` selects an Android SDK containing NDK `27.1.12297006` and launches a native Expo development build. On Linux it uses JDK 17 when available. Expo Go is not supported because the app includes a local Android Expo module for MediaPipe Gemma inference. If the required NDK is not installed, install it from Android Studio's SDK Manager or set `ANDROID_HOME` to an SDK that contains it.

The Android package id remains `org.punetrees.app`, so a signed release can retain the existing app identity. The generated `android/` directory is ignored; change native configuration in `app.json` or `modules/local-tree-ai` and regenerate it with `npm run prebuild:android`.

## Local Gemma model

From the tracker, choose **Import local AI model** and select a compatible MediaPipe multimodal Gemma `.task` file (the default expected filename is `gemma-3n-E2B-it-int4.task`). The model is copied into app-private storage and never added to the repository or bundled APK. The model can occupy several gigabytes, so allow enough free device storage. The native module runs an on-device photo check and damage summary. Backend connectivity is still used for the municipal tree census match, statutory routing, PDF rendering, dispatch, and follow-up verification. When the API is unreachable and a local model is installed, the app prepares an offline draft for review and citizen initiated sharing.

## API endpoint

The hosted service from the Kotlin client remains the default. Override it with `EXPO_PUBLIC_API_URL`, for example:

```bash
EXPO_PUBLIC_API_URL=https://your-development-tunnel.example npm run android
```

Use an HTTPS tunnel for a development API. `localhost` on the phone refers to the phone itself.
