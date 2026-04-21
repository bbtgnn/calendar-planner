# External Integrations

**Analysis Date:** 2026-04-21

## APIs & External Services

**Third-party HTTP APIs:**
- Not detected in application code under `src/` (no `fetch` calls or API SDK imports found in TypeScript/Svelte sources).

**Browser Platform APIs (runtime dependencies):**
- IndexedDB - Persistent storage backing via Dexie in `src/lib/db/client.ts`.
  - SDK/Client: `dexie` (`package.json`).
  - Auth: Not applicable (browser-local database).
- localStorage - Last active class preference in `src/lib/preferences/activeClass.ts`, invoked from `src/routes/class/[classId]/+layout.svelte` and `src/routes/+page.svelte`.
  - SDK/Client: Native browser API.
  - Auth: Not applicable.
- FileReader - Local roster file import (`.txt` / `.csv`) in `src/routes/class/[classId]/students/+page.svelte`.
  - SDK/Client: Native browser API.
  - Auth: Not applicable.

## Data Storage

**Databases:**
- IndexedDB (in-browser), wrapped by Dexie.
  - Connection: Not applicable (no server connection string).
  - Client: `LessonPlannerDB` in `src/lib/db/client.ts`.
  - Schema usage: `classes`, `students`, `lessons`, `absences` tables defined in `src/lib/db/client.ts`; row contracts in `src/lib/db/types.ts`.

**File Storage:**
- Local filesystem only for user-selected import files during session (`FileReader` in `src/routes/class/[classId]/students/+page.svelte`).
- No remote object storage integration detected.

**Caching:**
- None as a separate service; persistence is direct IndexedDB access through repositories in `src/lib/repos/*.repo.ts`.

## Authentication & Identity

**Auth Provider:**
- Custom: none (no account system, token flow, or identity provider integration detected).
  - Implementation: App is local/browser-only by design in `README.md` and `docs/superpowers/specs/2026-04-20-lesson-planner-design.md`.

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Datadog/Bugsnag SDK usage detected).

**Logs:**
- User-facing in-app transient feedback through toast store (`src/lib/stores/toast.ts`) and route-level error catch paths in:
  - `src/routes/+layout.svelte`
  - `src/routes/class/[classId]/+page.svelte`
  - `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
  - `src/routes/class/[classId]/students/+page.svelte`

## CI/CD & Deployment

**Hosting:**
- Static hosting target inferred from adapter-static config in `svelte.config.js` and build output guidance in `README.md` (`build/` directory with SPA fallback).

**CI Pipeline:**
- Not detected (`.github/workflows/` absent).

## Environment Configuration

**Required env vars:**
- None detected for runtime or integrations (no `.env*` files and no `process.env`/`import.meta.env` usage surfaced in `src/`).

**Secrets location:**
- Not applicable for current architecture (no external secret-backed integrations).

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook endpoint handlers; app is client-only with `ssr = false` in `src/routes/+layout.ts`).

**Outgoing:**
- None detected (no outbound webhook POST integrations in app source).

## Integration Notes For New Business Logic

- Contract planning metrics (teacher vs student hour transforms, flex pool, class/extra split) are pure local computation in `src/lib/logic/stats.ts`; no external analytics service dependency.
- Session-kind transition guard that blocks `class` -> `extra` when absences exist is enforced through local Dexie transactions in `src/lib/repos/lessons.repo.ts`.
- Dexie v2 upgrade path that backfills new domain fields is implemented in `src/lib/db/client.ts`, so existing local datasets can adopt newer contract logic without remote migration tooling.

---

*Integration audit: 2026-04-21*
