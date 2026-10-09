# Next.js backend

Requires Node.js 24 or later. This replaces FastAPI for the Expo app and future website. Census and SMTP are excluded.

```powershell
cd server
npm install
# Optional: copy .env.example to .env.local and configure AI credentials.
npm run dev
```

The backend listens on **http://localhost:3000**. From the repository root use `npm run backend:dev`.

SQLite records are saved in `server/data/complaints.db` and photos/PDFs in `server/data/media/`. These survive app restarts. Back up that directory with the server stopped. They are ignored by Git; committing code does not back up complaint data. `DATA_DIR` and `DATABASE_PATH` override these paths. The default local SQLite adapter must be replaced or moved to persistent storage before cloud deployment.

## Phone connection

For an Android phone connected by USB:

```powershell
& "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" reverse tcp:3000 tcp:3000
```

Expo defaults to `http://localhost:3000`. Restart Metro after changing `EXPO_PUBLIC_API_URL`. For Wi-Fi, use `http://<laptop-LAN-IP>:3000` and keep both devices on the same network. For a tunnel, set the Expo URL and backend `PUBLIC_BASE_URL` to the tunnel's HTTPS address. Keep the laptop awake and server running. `PUBLIC_BASE_URL` is used in PDF QR links; regenerate PDFs after changing it.

This is a local hackathon backend. API authentication and per-citizen record visibility must be added before public rollout. CORS limits browser origins but is not authentication. Add browser origins to `CORS_ORIGINS` when testing a website from another host.

## API compatibility

Existing `/api/v1/complaints` URLs are retained: analyze-and-draft, check-duplicate, upvote-witness, render-pdf, dispatch, list, details, download-pdf, record digest, and photo verification. JPEG/PNG evidence is validated and stored as actual files. API timestamps are UTC with `Z`.

`dispatch` prepares an email composer payload and WhatsApp/X links. It returns `PREPARED` and `email.sent=false`; it never sends mail or claims external delivery. Expo downloads the PDF and attaches it to the phone's email composer. The user completes sending.

Gemini and OpenRouter are tried once each with a 40-second timeout. Without successful cloud analysis the backend returns 503; a successful on-device model can still prepare a local draft and register it through `render-pdf`. Re-audits enforce the due date and 50-metre location limit. Unavailable or invalid AI comparisons stay inconclusive; they never automatically resolve a complaint. Only tree photos are sent for analysis; optional contractor photos are stored as evidence.

## Existing FastAPI data

`npm run import:legacy` imports complaint and verification records from `../backend/pune_trees.db` read-only. Existing IDs and timestamps are retained; rerunning skips records already imported. The source database is left unchanged. Historical malformed image placeholders cannot be recovered. Generate PDFs again using Next.js after import. The Python source remains available as a migration reference, but is not needed to run this server.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Use `NEXT_BUILD_DIR=.next-build` when building while the development server is running. The bundled Noto Sans Devanagari font supports Marathi PDF summaries; its license is in `assets/OFL.txt`.
