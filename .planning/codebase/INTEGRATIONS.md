# External Integrations

**Analysis Date:** 2026-05-15

## APIs & External Services

**HTTP / REST / GraphQL:**
- None — No `fetch`, Axios, or third-party API clients in `src/`

**Third-party SDKs:**
- None in application dependencies (`package.json` lists only `dexie` at runtime)

**Note:** `.cursor/get-shit-done/` tooling may reference optional search APIs (`BRAVE_API_KEY`, `FIRECRAWL_API_KEY`, `EXA_API_KEY`) for GSD workflows; that is separate from the lesson planner app and not used by `src/`.

## Data Storage

**Databases:**
- IndexedDB (browser), via Dexie
  - Client: `dexie` in `src/lib/db/client.ts`
  - Database name: `lesson-planner-db`
  - Tables: `classes`, `students`, `lessons`, `absences` (schema versions 1–3 with upgrades in same file)
  - Types: `src/lib/db/types.ts`
  - Access layer: repositories in `src/lib/repos/` (`classes.repo.ts`, `students.repo.ts`, `lessons.repo.ts`, `attendance.repo.ts`)

**File Storage:**
- Local filesystem only at **import time** — User selects `.txt` or `.csv` via `<input type="file">`; content read with `FileReader` in `src/routes/class/[classId]/students/+page.svelte`, parsed by `src/lib/logic/rosterImport.ts`. Files are not uploaded to any server.

**Caching:**
- None (no service worker or CDN integration in app code)

**Preferences (non-Dexie):**
- `localStorage` key `lesson-planner:last-class-id` — Last active class for redirect (`src/lib/preferences/activeClass.ts`, used from `src/routes/+page.ts` and `src/routes/class/[classId]/+layout.svelte`)

## Authentication & Identity

**Auth Provider:**
- None — No login, sessions, JWT, or OAuth

**Identity:**
- Primary keys generated with `crypto.randomUUID()` in repos (`src/lib/repos/classes.repo.ts`, `students.repo.ts`, `lessons.repo.ts`)

## Monitoring & Observability

**Error Tracking:**
- None — Errors surfaced to users via toast store (`src/lib/stores/toast.ts`) and `window.confirm` / `window.prompt` in UI

**Logs:**
- No structured logging framework; no server-side logs (static client app)

## CI/CD & Deployment

**Hosting:**
- Static SPA (`build/` after `bun run build`) — Any static host (README: “Serve as static files”)
- No `.github/workflows`, Netlify, or Vercel config committed

**CI Pipeline:**
- Not detected in repository

**Build artifact:**
- `build/` (gitignored) — Produced by `@sveltejs/adapter-static`

## Environment Configuration

**Required env vars:**
- None for the application

**Secrets location:**
- Not applicable for app runtime
- `.gitignore` excludes `.env` and `.env.*` (except optional `.env.example` / `.env.test` patterns); no committed env templates

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Browser APIs (in-app “integrations”)

These are the only external interfaces the app uses at runtime:

| API | Purpose | Location |
|-----|---------|----------|
| IndexedDB | Persistent class/lesson/student/absence data | Dexie `src/lib/db/client.ts` |
| `localStorage` | Remember last selected class | `src/lib/preferences/activeClass.ts` |
| `FileReader` | Read roster files client-side | `src/routes/class/[classId]/students/+page.svelte` |
| `crypto.randomUUID` | Entity IDs | `src/lib/repos/*.ts` |
| `window.prompt` / `window.confirm` | Class create/rename/delete and destructive actions | `src/routes/+layout.svelte`, student/lesson pages |

## Test Environment Integration

**IndexedDB in Vitest:**
- `fake-indexeddb/auto` loaded in `src/test/setup.ts` so repo and DB tests run in Node without a browser

---

*Integration audit: 2026-05-15*
