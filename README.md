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
