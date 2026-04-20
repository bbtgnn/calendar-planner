# Testing Patterns

**Analysis Date:** 2026-04-20

## Test Framework

**Runner:**
- **Vitest** `^4.1.3` (lockfile may resolve slightly newer patch) — configured in `vite.config.ts` via `defineConfig` from `vitest/config`.
- Config: `vite.config.ts` (test section embedded in Vite config, not a separate `vitest.config.ts`).

**Assertion Library:**
- **Vitest built-ins** (`expect`, `describe`, `it`) — re-exported style from `vitest` in test files.

**Run Commands:**
```bash
bun run test              # CI-style: vitest --run (see package.json "test" script)
bun run test:unit         # vitest (watch / interactive default)
bun run test:unit -- --run # equivalent explicit run mode if not using "test" script
```

**Package manager note:** `package.json` invokes **`bun run`** for the `test` script; **`npm run test:unit`** also works if `vitest` is on `PATH` via local `node_modules`.

## Test File Organization

**Location:**
- **Co-located** next to implementation: `src/lib/logic/stats.test.ts`, `src/lib/db/withRetry.test.ts`, `src/lib/repos/classes.repo.test.ts`, etc.

**Naming:**
- **`*.test.ts`** for TypeScript unit tests (pattern enforced by Vitest `include` in `vite.config.ts`).
- **`*.smoke.test.ts`** for lightweight integration smoke tests (`src/lib/db/client.smoke.test.ts`).

**Structure:**
```
src/
├── lib/
│   ├── db/
│   │   ├── client.ts
│   │   ├── client.smoke.test.ts
│   │   ├── withRetry.ts
│   │   └── withRetry.test.ts
│   ├── logic/
│   │   ├── stats.ts
│   │   ├── stats.test.ts
│   │   ├── rosterImport.ts
│   │   └── rosterImport.test.ts
│   └── repos/
│       ├── classes.repo.ts
│       └── classes.repo.test.ts
└── test/
    └── setup.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest';
import { fnUnderTest } from './module';

describe('moduleName', () => {
	it('does expected thing', () => {
		expect(fnUnderTest(input)).toBe(expected);
	});
});
```
(Representative pattern from `src/lib/logic/stats.test.ts`, `src/lib/logic/rosterImport.test.ts`.)

**Patterns:**
- **Setup:** global test setup imports **`fake-indexeddb/auto`** once via `src/test/setup.ts`, referenced by `setupFiles` in `vite.config.ts`.
- **Per-suite reset:** use `beforeEach` to reset Dexie state when tests need a clean DB (`src/lib/repos/classes.repo.test.ts`: `await db.delete(); await db.open();`).
- **Assertions:** Vitest is configured with **`expect: { requireAssertions: true }`** in `vite.config.ts` — every test must perform at least one assertion (or it fails the suite).

## Mocking

**Framework:** **Vitest** (`vi` from `vitest`).

**Patterns:**
```typescript
import { describe, expect, it, vi } from 'vitest';

const fn = vi.fn(async () => { /* ... */ });
await expect(withRetry(fn, { retries: 1 })).resolves.toBe(42);
expect(fn).toHaveBeenCalledTimes(2);
```
(From `src/lib/db/withRetry.test.ts`.)

**What to Mock:**
- **Short-lived async collaborators** inside a single test when verifying retry or call counts (`vi.fn` wrapping the operation under test).

**What NOT to Mock:**
- **Dexie tables** in repo tests — prefer **real IndexedDB** via `fake-indexeddb` and reset `db` between tests (`src/lib/repos/classes.repo.test.ts`, `src/lib/db/client.smoke.test.ts`).

## Fixtures and Factories

**Test Data:**
- Build **minimal rows inline** with `crypto.randomUUID()` for IDs and literal field values (`src/lib/repos/classes.repo.test.ts`, `src/lib/db/client.smoke.test.ts`).
- Use **small in-memory structures** for pure logic tests (arrays of lesson-like objects in `src/lib/logic/stats.test.ts`).

**Location:**
- **No shared `fixtures/` directory** — keep data next to the test or inside the `it` block.

## Coverage

**Requirements:** **None enforced** — `package.json` defines no `test:coverage` script and Vitest coverage providers are not configured in-repo.

**View Coverage:**
```bash
# Not configured — to add coverage, install @vitest/coverage-v8 (or istanbul) and extend vite.config.ts / package.json scripts
```

## Test Types

**Unit Tests:**
- **Pure functions** — `src/lib/logic/stats.test.ts`, `src/lib/logic/rosterImport.test.ts`.
- **Small async helpers** — `src/lib/db/withRetry.test.ts`.

**Integration Tests:**
- **IndexedDB + Dexie** — `src/lib/db/client.smoke.test.ts` (open, put, get, delete), `src/lib/repos/classes.repo.test.ts` (transactions and cascade delete).

**E2E Tests:**
- **Not used** — no Playwright/Cypress dependency in `package.json`; UI is not covered by automated browser tests in this repo.

## Environment & Projects

**Vitest project:** single project named **`server`** with **`environment: 'node'`** in `vite.config.ts`.

**Includes / excludes:**
- **Include:** `src/**/*.{test,spec}.{js,ts}`.
- **Exclude:** `src/**/*.svelte.{test,spec}.{js,ts}` — **Svelte single-file component tests are excluded**; add a separate Vitest project with `environment: 'browser'` and a Svelte testing setup if component tests are required later.

## Common Patterns

**Async Testing:**
```typescript
await expect(withRetry(fn, { retries: 1 })).resolves.toBe(42);
await expect(withRetry(fn, { retries: 1 })).rejects.toThrow('x');
```
(From `src/lib/db/withRetry.test.ts`.)

**Error Testing:**
- Use **`rejects.toThrow`** for async errors after retries are exhausted (`src/lib/db/withRetry.test.ts`).

**Database isolation:**
- For tests touching `db` from `src/lib/db/client.ts`, call **`db.delete()`** then **`db.open()`** in `beforeEach` when a pristine schema is required (`src/lib/repos/classes.repo.test.ts`).

---

*Testing analysis: 2026-04-20*
