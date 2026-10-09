# Pune Tree Rakshak

An Expo Android app for Pune tree complaints, backed by Next.js. Citizens capture tree evidence and GPS, review a bilingual complaint, share it through their email app or WhatsApp, and return for photo verification.

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

- Seven tree issue categories with guided wide, structural and close-up photos.
- Gemini/OpenRouter photo analysis with optional on-device Gemma drafting.
- Deterministic authority routing and complaint references.
- Nearby duplicate detection and witness corroboration.
- PDF notice with photos, English statement, Marathi summary, QR link and record digest.
- Phone email composer with PDF attachment, and separate WhatsApp sharing.
- Follow-up deadline, 50-metre GPS check, and before/after photo comparison.

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
