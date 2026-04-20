# External Integrations

**Analysis Date:** 2026-04-20

## APIs & External Services

**HTTP / SaaS:**
- Not detected — no `fetch()` calls, no SDK imports for third-party APIs under `src/`
- No `src/routes/**/+server.ts` handlers; no server-side integration layer in this codebase

## Data Storage

**Databases:**
- **IndexedDB (client)** — primary persistence via Dexie (`src/lib/db/client.ts`)
  - Database name: `lesson-planner-db`
  - Tables: `classes`, `students`, `lessons`, `absences` (version 1 schema in `LessonPlannerDB`)
  - Access pattern: repository modules under `src/lib/repos/*.repo.ts` import `db` from `src/lib/db/client.ts`

**File Storage:**
- Local filesystem only for **build output** (`build/` after `bun run build`). Application data is not written to disk by the app itself.

**Caching:**
- Browser-managed storage only (IndexedDB + `localStorage`); no separate cache service

## Authentication & Identity

**Auth Provider:**
- None — no login, sessions, OAuth, or identity SDKs in `package.json` or `src/`

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or similar in dependencies or `src/`

**Logs:**
- Not applicable at scale; client-side only. Use browser devtools when debugging.

## CI/CD & Deployment

**Hosting:**
- Not defined in-repo — `README.md` describes generic static hosting of `build/` with SPA fallback. No `vercel.json`, `netlify.toml`, or platform-specific config detected.

**CI Pipeline:**
- None detected — no `.github/workflows/*.yml` or other CI config in the project root.

## Environment Configuration

**Required env vars:**
- None for the current application — no `PUBLIC_*` or server env consumption in `src/`

**Secrets location:**
- Not applicable for the shipped app (offline-first browser storage). If future features add backends, introduce `.env` handling per SvelteKit docs and keep secrets out of git.

## Webhooks & Callbacks

**Incoming:**
- None — no API routes or edge handlers

**Outgoing:**
- None — no webhook emitters or background jobs

## Browser APIs (not external services, but integration surface)

When extending the app, prefer existing patterns:
- **IndexedDB** — via `dexie` in `src/lib/db/client.ts`
- **localStorage** — last-opened class id in `src/lib/preferences/activeClass.ts` (key `lesson-planner:last-class-id`)

---

*Integration audit: 2026-04-20*
