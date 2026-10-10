# Pune Fast Complaint

An Expo Android app backed by Next.js, with Trees, Roads, Garbage and Noise tabs. Citizens capture evidence and GPS, review a complaint notice, and send it through their email app. Selected physical reports support follow-up photo verification.

## Run locally

Use Node.js 24 or later for the backend.

```powershell
npm --prefix server install
npm run backend:dev
```

The backend runs at **http://localhost:3000**. It stores SQLite records, photos, and PDFs in `server/data/`, which survives restarts and is excluded from Git. Back up this folder separately. No Render or Vercel deployment is required.

For a USB-connected Android phone:

```powershell
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" reverse tcp:3000 tcp:3000
npm --prefix mobile install
npm run android
```

Running `npm start` or `npm run android` in `mobile/` sets up backend port 3000 forwarding for connected Android devices. If USB is disconnected and reconnected while the app is running, run `npm run connect:backend` in `mobile/` to restore the connection.

The Expo app defaults to this local backend. `EXPO_PUBLIC_API_URL` selects another address for Wi-Fi or an HTTPS tunnel. The laptop must remain awake with the server running. The native app requires Android SDK/NDK installation; Expo Go cannot load the custom MediaPipe module.

## Project layout

- `mobile/`: Expo/React Native client and on-device Gemma module.
- `server/`: Next.js API routes, deterministic routing rules, SQLite repository, AI providers, evidence storage, bilingual PDFs and re-audits.
- `backend/`: prior FastAPI implementation, retained as a migration reference and source for existing local records.
- `android/`: prior Kotlin/Compose client.

Read [server/README.md](server/README.md) for configuration, data migration, API behavior and checks, and [mobile/README.md](mobile/README.md) for Android setup.

## Features

- One photo plus GPS prepares a notice without waiting for AI; optional tree AI review uses three guided photos.
- Roads cover potholes, open manholes/drains and blocked footpaths. Garbage covers waste dumps and burning.
- Noise captures a ten-second ambient audio sample, timestamp, GPS and relative microphone levels in dBFS. These are not calibrated dB(A) measurements or proof of a legal threshold breach.
- Gemini/OpenRouter tree analysis with optional on-device Gemma drafting.
- Deterministic authority routing and complaint references.
- Nearby duplicate detection and witness corroboration.
- PDF notice with photos, English statement, Marathi summary, QR link and record digest.
- Phone email composer with PDF and optional M4A recording attached; separate WhatsApp sharing where configured.
- Photo follow-up for trees, potholes, open drains and waste dumps, with a 50-metre GPS check and before/after comparison. Reminder times are app settings, not statutory deadlines.

Direct ward contacts can be set in `server/.env.local`; until configured, municipal notices use PMC central reception and request forwarding. Noise notices use Pune Police, with an explicit 112 dialler shortcut. Selecting a category records the citizen's observation; it does not certify a violation. The under-60-second flow is a design target and has not yet been timed end to end on a device. See [legal reference notes](docs/civic-legal-references.md).

Census and SMTP are excluded from the Next.js backend. Sharing is recorded as prepared; the app cannot confirm delivery from external email or WhatsApp apps. An unavailable AI audit leaves the complaint open.

This local hackathon setup needs authentication and per-citizen access controls before public rollout. Census-related assets in the old Python implementation are not loaded by Next.js.

## Checks

```powershell
npm --prefix server run typecheck
npm --prefix server run lint
npm run backend:test
npm run backend:build
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile test
```


### Local Qwen2.5-Omni with GenieX (Android)

Select **Local Omni** or **Cloud AI** in Citizen profile, Review evidence, Noise evidence and Ground re-audit. The choice persists across restarts; previous Local Qwen preferences migrate to Omni. Local mode never silently calls cloud AI.

- Import **Qwen2.5-Omni-7B-Q4_K_M.gguf**, then its **matching mmproj GGUF** from the same conversion. Both are required. Import copies both into a staging directory and replaces the pair together; cancellation or a failed copy preserves the previous pair. Qwen3 weights cannot be relabelled as Omni.
- Uses Qualcomm `geniex-android:0.4.0` and llama.cpp/mtmd. The language model uses the Hexagon NPU; the vision/audio projector runs on CPU in this SDK. Android API 27+ and a supported Snapdragon ARM64 phone are required. Rebuild/install after pulling; the native API changed. Keep the app open during inference. A temporary CPU wake lock and screen timeout protection prevent suspension while analysis runs. The F32 projector can take several minutes for media encoding; the token-generation deadline is 15 minutes.
- Local reports analyze up to three photos and the recorded audio, then prepare English/Marathi observations. Photos are resized to 640 pixels for the local encoder. WAV and AAC/M4A recordings are decoded to mono 16 kHz PCM WAV, up to 30 seconds. The runtime must confirm both image and audio capability before analysis; missing/invalid projectors fail visibly.
- This Omni GGUF accepts text, images and audio. It does not accept direct video or generate speech. Video stays attached to the report; the separately captured audio is analyzed. Re-audits compare original/follow-up photos but remain advisory (INCONCLUSIVE) and require authority confirmation.
- Backend saving, tracking, PDFs and email preparation still require the backend. Evidence is uploaded there. Local inference does not make these workflows fully offline.
- The Q4_K_M model is about 4.7 GB; the downloaded F32 projector is about 5.3 GB. Allow space for both files and an additional pair during replacement. Runtime memory needs are substantial (about 7.4 GB resident memory in the image/audio diagnostic). Imported weights are never committed. Debug-accessible GenieX downloads can be copied into this app's private `files/qwen25-omni/model.gguf` and `mmproj.gguf`; production users use the file picker.
