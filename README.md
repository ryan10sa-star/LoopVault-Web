# LoopVault Web Scaffold

This repository now contains a React + TypeScript + Vite scaffold for LoopVault Web with offline-first PWA setup foundations.

## Included scaffold
- Vite React TS entry points (`src/main.tsx`, `src/App.tsx`).
- Browser routing with `BrowserRouter`.
- Tailwind CSS setup with industrial dark mode and **Safety Yellow** (`#FCE300`).
- Mobile-first layout and large touch target home actions.
- Dexie DB bootstrap placeholder in `src/db`.
- Scanner and PDF utility placeholders in `src/hooks` and `src/utils`.
- PWA configuration in `vite.config.ts` + `public/manifest.json` and icons.
- GitHub Pages deploy workflow in `.github/workflows/deploy.yml`.

## Commands
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run typecheck`
- `npm run deploy`

## dist/ deployment process
1. Build app output into `dist/` using Vite (in fully provisioned env):
   - `npm run build`
2. Publish `dist/` to GitHub Pages branch:
   - `npm run deploy`
3. The provided workflow automatically runs lint/build/deploy on push to `main`.

> Note: In this execution environment, npm registry access may be restricted, so installing dependencies can fail even though the scaffold files are in place.

## Dev DB test route
- Open `/dev/db-test` to seed dummy records and verify table counts persist across refreshes.
- Seed action creates 1 tag, 1 job, and 5 calibration steps (0/25/50/75/100%).

## Tags UX implemented
- `/tags` list view uses Dexie `useLiveQuery` updates with case-insensitive search by tag number or description.
- `/tags/:tagNumber` detail view shows metadata grid and supports creating a new Loop Check or Calibration job.
- Importing tags from Home redirects to `/tags` on success.


## Weekly backup routine
1. Open **Diagnostics** (`/diagnostics`).
2. Tap **Export Backup (ZIP)** and store the downloaded file in a safe location (cloud drive + local copy).
3. Repeat weekly (or after major field changes).
4. To restore, use **Import Backup**, review the overwrite warning, then confirm.

