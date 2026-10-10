# Frontend structure

- `app/`: Expo route and provider setup. The main route composes the complaint screens, header and profile sheet.
- `features/complaints/screens/`: Individual flow screens with typed props. Keep API requests and device operations out of these components.
- `hooks/`: Complaint flow coordination, capture, GPS, AI drafting, noise recording and scroll behaviour. Flow state stays mounted while screens change so photos and drafts survive back navigation.
- `components/ui/`: Shared Paper-backed buttons, fields, cards and page headers. Use these for new controls rather than duplicating styles.
- `components/EvidencePhotos.tsx`: Shared evidence previews for review and AI analysis.
- `theme/`: Current palette and Paper theme. Category colour changes belong here when the redesign is applied.
- `data/` and `lib/`: Category definitions, API types and pure evidence/dispatch rules.

The existing in-app complaint step navigation is preserved; `previousPage` centralizes Android back targets. This refactor does not introduce separate deep-linked routes for each step.

After dependency changes, restart Metro. These changes use existing native modules and do not require an APK rebuild or backend restart. The user performs device testing; do not run build/lint/test commands unless requested.
