# External Integrations

**Analysis Date:** 2026-05-15

## APIs & External Services

**HTTP / REST / GraphQL:**
- None in application runtime code under `src/`
- No `fetch()` calls to third-party URLs in `src/`

**Cloud SDKs:**
- Not detected in `package.json` dependencies or `src/` imports (no Supabase, Stripe, AWS, Google APIs, OpenAI, etc.)

**Agent / planning tooling (repository only, not shipped app):**
- GSD workflow scripts under `.cursor/get-shit-done/` may reference optional search API keys (`BRAVE_API_KEY`, `FIRECRAWL_API_KEY`, `EXA_API_KEY`) in developer tooling — unrelated to the lesson planner UI
- GitNexus MCP indexing for code intelligence (`AGENTS.md`) — developer workflow, not end-user integration

## Data Storage

**Databases:**
- IndexedDB (browser), database name `lesson-planner-db`
  - Client: Dexie 4.4.2 (`src/lib/db/client.ts`)
  - Tables: `classes`, `students`, `lessons`, `absences` (schema versions 1–3 with upgrades)
  - Access layer: repositories in `src/lib/repos/classes.repo.ts`, `students.repo.ts`, `lessons.repo.ts`, `attendance.repo.ts`
  - Retry helper for transient IDB errors: `src/lib/db/withRetry.ts`
  - No connection string or server-side database

**File Storage:**
- Local filesystem only via user-initiated file picker (roster import)
  - Parser logic: `src/lib/logic/rosterImport.ts` (`parseTxtNames`, `parseCsvNames`)
  - UI: `src/routes/class/[classId]/students/+page.svelte` (`accept=".txt,.csv"`, `FileReader.readAsText`)
  - Files are read in-browser; contents are not uploaded to any server

**Browser key-value storage:**
- `localStorage` key `lesson-planner:last-class-id` for UX preference (`src/lib/preferences/activeClass.ts`)

**Caching:**
- None beyond browser IndexedDB and SvelteKit client-side `load` cache invalidation (`invalidate` / custom load keys in `src/lib/kit/loadKeys.ts`, `src/lib/kit/runMutation.ts`)

## Authentication & Identity

**Auth Provider:**
- None — fully offline, single-user-per-browser assumption
- No login, sessions, JWT, or OAuth in `src/`

**Identity for records:**
- `crypto.randomUUID()` for row ids in repos (see `src/lib/repos/classes.repo.ts`)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, LogRocket, etc.)

**Logs:**
- No structured logging framework in `src/`
- User-facing errors via toast store `src/lib/stores/toast.ts` and `runMutation` error toasts (`src/lib/kit/runMutation.ts`)

## CI/CD & Deployment

**Hosting:**
- Not configured in-repo (no `.github/workflows`, `netlify.toml`, `vercel.json`, or `wrangler` config)
- `.gitignore` lists common deploy dirs (`.vercel`, `.netlify`, `.wrangler`) as build/output artifacts only
- `README.md` documents manual static deploy: build to `build/`, serve as static files with SPA fallback

**CI Pipeline:**
- None detected in repository

## Environment Configuration

**Required env vars:**
- None for running or building the application (no `src/` usage of `import.meta.env` / `process.env`)

**Optional / future:**
- `.gitignore` reserves `.env` and `.env.*` for future secrets if backend or analytics are added; no `.env.example` committed

**Secrets location:**
- Not applicable for current app scope

## Webhooks & Callbacks

**Incoming:**
- None (no API routes)

**Outgoing:**
- None

## Browser & Platform Integrations

| Integration | Mechanism | Location |
|-------------|-----------|----------|
| IndexedDB | Dexie | `src/lib/db/client.ts` |
| localStorage | Native API | `src/lib/preferences/activeClass.ts` |
| File import | `<input type="file">` + FileReader | `src/routes/class/[classId]/students/+page.svelte` |
| Dialogs | `window.prompt`, `window.confirm` | `src/routes/+layout.svelte`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte` |
| Navigation / cache | SvelteKit `invalidate`, `depends` | `src/lib/kit/runMutation.ts`, route `+page.ts` / `+layout.ts` loaders |

## Test Environment Integrations

**IndexedDB in Node tests:**
- `fake-indexeddb/auto` imported in `src/test/setup.ts` so Vitest can run repo and DB tests without a browser

**Test commands:**
```bash
bun run test          # vitest --run (all unit tests)
bun run test:unit     # vitest (watch-capable)
```

## Static Assets

**Committed static files:**
- `static/robots.txt` — Allows all crawlers (relevant only if the built SPA is published to a public URL)

---

*Integration audit: 2026-05-15*
