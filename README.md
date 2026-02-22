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

## Over-the-air Sync (Free MVP)
LoopVault now includes a **Cloud Sync (MVP)** section in [Settings](src/pages/Settings.tsx) that can share core work data between devices using Supabase free tier and a shared site code.

### What syncs in MVP
- Tags
- Jobs
- Steps
- Audit event metadata
- Signatures (including signature image blob)
- Evidence photo blobs
- Tag document blobs

### Transport model
- Core records are stored in `sync_snapshots`.
- Binary file content is chunked into `sync_blob_chunks` rows for safer over-the-air transfer.

### Supabase setup (one-time)
1. Create a Supabase project (free tier).
2. In SQL editor, run:

```sql
create table if not exists public.sync_snapshots (
   site_code text primary key,
   payload jsonb not null,
   updated_by text not null default 'local-user',
   updated_at timestamptz not null default now()
);

create table if not exists public.sync_blob_chunks (
   site_code text not null,
   snapshot_id text not null,
   chunk_index integer not null,
   total_chunks integer not null,
   payload jsonb not null,
   primary key (site_code, snapshot_id, chunk_index)
);

alter table public.sync_snapshots enable row level security;
alter table public.sync_blob_chunks enable row level security;

create policy "allow anon read/write for mvp"
on public.sync_snapshots
for all
to anon
using (true)
with check (true);

create policy "allow anon read/write blobs for mvp"
on public.sync_blob_chunks
for all
to anon
using (true)
with check (true);
```

3. Copy **Project URL** and **anon public key** from Supabase project settings.
4. In LoopVault Settings → Cloud Sync (MVP), enter URL/key, shared site code, and operator name.
5. Click **Test Connection** in Settings to verify both cloud tables are reachable.
6. Use **Push to Cloud** on tech device and **Pull from Cloud** on supervisor/planner device.

> Note: This policy is intentionally open for quick MVP testing. Use proper auth/RLS before production rollout.

